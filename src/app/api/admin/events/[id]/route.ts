import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventManager } from "@/lib/permissions";
import { isAccessMode, isEventStatus, isEventType } from "@/lib/eventConfig";
import { adminEventShape, mintSecretLinkToken, MAX_PRICE_CENTS } from "@/lib/eventAdmin";
import { hashGalleryPassword } from "@/lib/eventAccess";
import { r2Configured, r2Delete, r2Keys } from "@/lib/r2";
import { faceRecConfigured, deleteCollectionForEvent } from "@/lib/faceRec";

/**
 * Owner-only per-event config.
 *
 *   GET   /api/admin/events/[id]   → full config for one event
 *   PATCH /api/admin/events/[id]   → update any subset of the config
 *
 * Switching accessMode to "secure-link" mints a token; switching away clears it.
 * Bundle price is owned here (the legacy /api/admin/pricing route still works).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COUNTS = { _count: { select: { photos: true, eventPhotographers: true } } } as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const ev = await db.event.findUnique({ where: { id: params.id }, include: COUNTS });
  if (!ev) return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  return NextResponse.json({ event: adminEventShape(ev) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const existing = await db.event.findUnique({
    where: { id: params.id },
    select: { accessMode: true, secretLinkToken: true },
  });
  if (!existing) return NextResponse.json({ error: "Unknown event" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.city === "string") data.city = body.city;
  if (typeof body.org === "string") data.org = body.org;
  if (body.type !== undefined) {
    if (!isEventType(body.type)) {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }
    data.type = body.type;
  }
  if (typeof body.date === "string") {
    const d = new Date(body.date);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "invalid date" }, { status: 400 });
    }
    data.date = d;
  }
  if (body.status !== undefined) {
    if (!isEventStatus(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.isFree !== undefined) data.isFree = body.isFree === true;
  if (body.ocrEnabled !== undefined) data.ocrEnabled = body.ocrEnabled === true;
  if (body.faceRecEnabled !== undefined) data.faceRecEnabled = body.faceRecEnabled === true;
  if (body.colorGroupEnabled !== undefined) data.colorGroupEnabled = body.colorGroupEnabled === true;
  // colorGroupLabels: a flat { key: label } rename map, or null to clear.
  if (body.colorGroupLabels !== undefined) {
    const v = body.colorGroupLabels;
    if (v === null) {
      data.colorGroupLabels = null;
    } else if (typeof v === "object" && !Array.isArray(v)) {
      const map: Record<string, string> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (typeof val === "string") map[k] = val;
      }
      data.colorGroupLabels = map;
    } else {
      return NextResponse.json({ error: "invalid colorGroupLabels" }, { status: 400 });
    }
  }

  // External "browse all" URL (e.g. a shared Google Photos album). Empty string
  // or null clears it; a non-empty value must be a well-formed http(s) URL.
  if (body.externalBrowseUrl !== undefined) {
    const v = body.externalBrowseUrl;
    if (v === null || (typeof v === "string" && v.trim() === "")) {
      data.externalBrowseUrl = null;
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      if (!/^https?:\/\/\S+$/i.test(trimmed)) {
        return NextResponse.json(
          { error: "externalBrowseUrl must be an http(s) URL" },
          { status: 400 }
        );
      }
      data.externalBrowseUrl = trimmed;
    } else {
      return NextResponse.json({ error: "invalid externalBrowseUrl" }, { status: 400 });
    }
  }

  // Custom runner headline ("Find your photos."). Empty/null clears it.
  if (body.searchHeadline !== undefined) {
    const v = body.searchHeadline;
    if (v === null || (typeof v === "string" && v.trim() === "")) {
      data.searchHeadline = null;
    } else if (typeof v === "string") {
      data.searchHeadline = v.trim().slice(0, 120);
    } else {
      return NextResponse.json({ error: "invalid searchHeadline" }, { status: 400 });
    }
  }

  // Gallery password (used by accessMode === "password"). A non-empty value sets
  // a new keyed hash; an empty string leaves the existing one untouched (so the
  // owner can save other fields without re-typing it). Clearing happens when
  // accessMode switches away from "password" (handled below).
  if (typeof body.galleryPassword === "string" && body.galleryPassword.trim()) {
    data.galleryPasswordHash = hashGalleryPassword(params.id, body.galleryPassword.trim());
  }

  if (body.bundlePriceCents !== undefined) {
    if (body.bundlePriceCents === null) {
      data.bundlePriceCents = null;
    } else {
      const cents = Number(body.bundlePriceCents);
      if (!Number.isInteger(cents) || cents < 0 || cents > MAX_PRICE_CENTS) {
        return NextResponse.json({ error: "bundlePriceCents out of range" }, { status: 400 });
      }
      data.bundlePriceCents = cents;
    }
  }

  // Access mode change: mint a token when switching to secure-link, clear it
  // when switching away. Keep an existing token if staying on secure-link.
  if (body.accessMode !== undefined) {
    if (!isAccessMode(body.accessMode)) {
      return NextResponse.json({ error: "invalid accessMode" }, { status: 400 });
    }
    data.accessMode = body.accessMode;
    if (body.accessMode === "secure-link" || body.accessMode === "private") {
      if (!existing.secretLinkToken) data.secretLinkToken = mintSecretLinkToken();
    } else {
      data.secretLinkToken = null;
    }
    // Password mode owns galleryPasswordHash; switching away clears it so a
    // later switch back doesn't silently reuse a stale password.
    if (body.accessMode !== "password") {
      data.galleryPasswordHash = null;
    }
  }

  const ev = await db.event.update({
    where: { id: params.id },
    data,
    include: COUNTS,
  });
  return NextResponse.json({ event: adminEventShape(ev) });
}

/**
 * DELETE /api/admin/events/[id] — permanently delete an event and everything
 * tied to it: every photo's R2 objects (originals + previews), the event's
 * Rekognition collection, and all DB rows.
 *
 * Order matters. The Photo→Event relation has NO onDelete cascade (it's
 * Restrict), so `db.event.delete()` would FK-fail while any photo exists — we
 * must delete the photos first (PhotoBib/PhotoFace/PhotoColorGroup then cascade
 * off each Photo). External cleanup (R2, Rekognition) runs BEFORE the DB delete,
 * while we still have the photo rows to enumerate keys from, and is best-effort:
 * an orphan blob is reapable, but a half-deleted event you can't retry is worse.
 *
 * Paid Order rows are intentionally KEPT (eventIdCovered just dangles) so
 * receipts + refund history survive the event.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const eventId = params.id;
  const existing = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Unknown event" }, { status: 404 });

  // Enumerate the event's photos (with their R2 keys) before any deletion.
  const photos = await db.photo.findMany({
    where: { eventId },
    select: { id: true, r2OriginalKey: true, r2PreviewKey: true },
  });

  let r2Failed = false;

  // R2: delete all originals + previews in batches of up to 1000 keys. Trust the
  // row keys when populated, else fall back to the deterministic helpers (covers
  // "pending" placeholders). Best-effort — log + flag, never block the DB delete.
  if (r2Configured() && photos.length > 0) {
    const keys: string[] = [];
    for (const p of photos) {
      keys.push(
        p.r2OriginalKey && p.r2OriginalKey !== "pending"
          ? p.r2OriginalKey
          : r2Keys.original(p.id)
      );
      keys.push(
        p.r2PreviewKey && p.r2PreviewKey !== "pending"
          ? p.r2PreviewKey
          : r2Keys.preview(p.id)
      );
    }
    for (let i = 0; i < keys.length; i += 1000) {
      try {
        await r2Delete(keys.slice(i, i + 1000));
      } catch (e) {
        r2Failed = true;
        console.warn(
          `R2 cleanup failed for a batch while deleting event ${eventId}:`,
          e instanceof Error ? e.message : e
        );
      }
    }
  }

  // Rekognition: drop the whole per-event collection in one call (best-effort).
  if (faceRecConfigured()) {
    await deleteCollectionForEvent(eventId);
  }

  // DB teardown, FK-safe, in a transaction. Deleting the photos first clears the
  // Photo→Event Restrict (and cascades PhotoBib/PhotoFace/PhotoColorGroup);
  // FaceAssignment (loose eventId, no FK) is cleaned explicitly; then the event
  // itself (EventPhotographer cascades, Photographer.primaryEventId SetNull).
  await db.$transaction([
    db.photo.deleteMany({ where: { eventId } }),
    db.faceAssignment.deleteMany({ where: { eventId } }),
    db.event.delete({ where: { id: eventId } }),
  ]);

  return NextResponse.json({
    id: eventId,
    deleted: true,
    photosDeleted: photos.length,
    r2Failed,
  });
}
