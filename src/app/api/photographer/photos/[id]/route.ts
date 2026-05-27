import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectivePhotographerId, isPhotographerUnlocked } from "@/lib/photographerLock";
import { r2Configured, r2Delete, r2Keys } from "@/lib/r2";

/**
 * Resolve the caller's photographer id + admin status. Used by both PATCH
 * and DELETE — keeps the ownership check in one place.
 *
 * Returns null if no valid identity, otherwise { photographerId, isAdmin }.
 */
async function resolveActor(): Promise<{ photographerId: string; isAdmin: boolean } | null> {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) return null;
  let isAdmin = isPhotographerUnlocked(); // unlock cookie implies admin
  if (!isAdmin) {
    try {
      const session = await getServerSession(authOptions);
      isAdmin = Boolean(session?.isAdmin);
    } catch {
      /* NextAuth misconfigured — admin stays false */
    }
  }
  return { photographerId, isAdmin };
}

// PATCH — edit metadata (bib, mile, hidden). Photographer can only touch their
// own; admins (or anyone holding the unlock cookie) can touch any.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await resolveActor();
  if (!actor) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { photographerId: true },
  });
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (photo.photographerId !== actor.photographerId && !actor.isAdmin) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    bib?: number | null;
    mile?: number | null;
    hidden?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (body.mile === null || typeof body.mile === "number") data.mile = body.mile;
  if (typeof body.hidden === "boolean") {
    data.hidden = body.hidden;
    data.hiddenBy = body.hidden ? actor.photographerId : null;
    data.hiddenAt = body.hidden ? new Date() : null;
  }

  // Bib edits go through PhotoBib (multi-bib). A non-null bib *adds* a manual
  // tag; null clears manual tags only — OCR detections are preserved.
  if (body.bib === null) {
    await db.photoBib.deleteMany({ where: { photoId: params.id, source: "manual" } });
  } else if (typeof body.bib === "number") {
    await db.photoBib.upsert({
      where: { photoId_bib: { photoId: params.id, bib: body.bib } },
      update: { confidence: 1.0, source: "manual" },
      create: { photoId: params.id, bib: body.bib, confidence: 1.0, source: "manual" },
    });
  }

  const updated = await db.photo.update({
    where: { id: params.id },
    data,
    select: {
      id: true, eventId: true, mile: true, hidden: true, takenAt: true,
      bibs: { select: { bib: true } },
    },
  });
  return NextResponse.json({ photo: updated });
}

/**
 * DELETE — permanently remove a photo. Drops the original + preview from R2,
 * then deletes the Postgres row (PhotoBib cascades via the schema relation).
 *
 * Photographer can delete their own; admin can delete any. R2 delete failures
 * don't block the DB delete — we'd rather have an orphan blob than a broken
 * UI showing photos that no longer exist as DB rows. Orphans can be reaped
 * periodically.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const actor = await resolveActor();
  if (!actor) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      photographerId: true,
      r2OriginalKey: true,
      r2PreviewKey: true,
    },
  });
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (photo.photographerId !== actor.photographerId && !actor.isAdmin) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  // R2 first — if this fails we still want to bail before touching the DB so
  // the operator sees the underlying error and can retry. But we only fail
  // the request for "real" errors (network, auth); missing-key is fine.
  if (r2Configured()) {
    try {
      // Trust the row's keys when populated, otherwise fall back to the
      // deterministic key helpers (handles "pending" placeholders from
      // aborted uploads).
      const original =
        photo.r2OriginalKey && photo.r2OriginalKey !== "pending"
          ? photo.r2OriginalKey
          : r2Keys.original(photo.id);
      const preview =
        photo.r2PreviewKey && photo.r2PreviewKey !== "pending"
          ? photo.r2PreviewKey
          : r2Keys.preview(photo.id);
      await r2Delete([original, preview]);
    } catch (e) {
      return NextResponse.json(
        { error: `R2 delete failed: ${e instanceof Error ? e.message : e}` },
        { status: 500 }
      );
    }
  }

  await db.photo.delete({ where: { id: photo.id } });

  return NextResponse.json({ id: photo.id, deleted: true });
}
