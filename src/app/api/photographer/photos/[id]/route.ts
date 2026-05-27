import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectivePhotographerId, isPhotographerUnlocked } from "@/lib/photographerLock";

// PATCH — edit metadata (bib, mile, hidden). Photographer can only touch their
// own; admins (or anyone holding the unlock cookie) can touch any.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Admin status: either NextAuth session says so, or the unlock cookie is set
  // (unlock implies admin).
  let isAdmin = isPhotographerUnlocked();
  if (!isAdmin) {
    try {
      const session = await getServerSession(authOptions);
      isAdmin = Boolean(session?.isAdmin);
    } catch {
      /* NextAuth misconfigured — admin stays false */
    }
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { photographerId: true },
  });
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (photo.photographerId !== photographerId && !isAdmin) {
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
    data.hiddenBy = body.hidden ? photographerId : null;
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
