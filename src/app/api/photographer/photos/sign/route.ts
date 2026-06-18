import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2Keys, r2PresignPut } from "@/lib/r2";
import { getEffectivePhotographerId } from "@/lib/photographerLock";
import { isAdmin, normalizeRoles } from "@/lib/permissions";
import { canUploadToEvent } from "@/lib/events";

/**
 * Mint a presigned PUT URL so the browser can upload the original JPEG straight
 * to R2 (no 4.5MB Vercel body limit).
 *
 * Body:
 *   eventId      required
 *   contentType  default image/jpeg
 *   fingerprint  optional client-side SHA-256 hex of the file bytes — used
 *                for duplicate detection. If a non-hidden Photo with the same
 *                fingerprint already exists for this (eventId, photographer),
 *                we return { duplicate: true, existing: { id, createdAt } }
 *                instead of creating a new placeholder. The client then asks
 *                the user whether to overwrite (DELETE the existing row + R2
 *                blobs, then re-sign with `force: true`) or skip.
 *   force        when true, skip the duplicate check entirely. Used by the
 *                client after the user has confirmed overwrite.
 *
 * Returns: either
 *   { photoId, uploadUrl }                      — normal happy path
 *   { duplicate: true, existing: { id, createdAt } } — caller decides
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return NextResponse.json(
      { error: "Photographer access required — sign in or unlock first" },
      { status: 401 }
    );
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    eventId?: string;
    contentType?: string;
    fingerprint?: string;
    force?: boolean;
  };
  if (!body.eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id: body.eventId } });
  if (!event) {
    return NextResponse.json({ error: "unknown eventId" }, { status: 404 });
  }

  // Per-event upload access (the real gate — the picker is only UX). Owner +
  // race_director may upload anywhere; a plain photographer needs a membership.
  const uploader = await db.photographer.findUnique({
    where: { id: photographerId },
    select: { roles: true },
  });
  const admin = isAdmin({ roles: normalizeRoles(uploader?.roles) });
  const allowed = await canUploadToEvent({ photographerId, isAdmin: admin, eventId: body.eventId });
  if (!allowed) {
    return NextResponse.json(
      { error: "You don't have access to upload to this event" },
      { status: 403 }
    );
  }

  // Duplicate detection. Only meaningful when a fingerprint is provided AND
  // the caller hasn't explicitly opted to force a fresh upload.
  if (body.fingerprint && !body.force) {
    const existing = await db.photo.findFirst({
      where: {
        eventId: body.eventId,
        photographerId,
        fingerprint: body.fingerprint,
        // Exclude "pending" rows from past aborted uploads — they'd false-
        // positive on a fingerprint match before the original was even
        // written. Match only rows that successfully finalised.
        NOT: { r2OriginalKey: "pending" },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        duplicate: true,
        existing: {
          id: existing.id,
          createdAt: existing.createdAt.toISOString(),
        },
      });
    }
  }

  const placeholder = await db.photo.create({
    data: {
      eventId: body.eventId,
      photographerId,
      r2OriginalKey: "pending",
      r2PreviewKey: "pending",
      fingerprint: body.fingerprint ?? null,
    },
    select: { id: true },
  });

  const originalKey = r2Keys.original(placeholder.id);
  const uploadUrl = await r2PresignPut(originalKey, body.contentType ?? "image/jpeg", 900);

  return NextResponse.json({
    photoId: placeholder.id,
    uploadUrl,
  });
}
