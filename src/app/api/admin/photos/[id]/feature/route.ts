import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOwnerActor } from "@/lib/permissions";

/**
 * OWNER-ONLY toggle for a photo's "featured" flag — the photos that headline
 * the event's search landing (the portfolio hero).
 *
 *   POST /api/admin/photos/[id]/feature   { featured: boolean }
 *     → { ok: true, featured, featuredAt }
 *
 * Auth: the platform owner ONLY (isOwnerActor) — featuring is Mikian's personal
 * curation, deliberately not delegated to per-event managers/photographers.
 *
 * Requires the Photo.featured column (prisma db push). Until it's pushed the
 * update throws; we surface a clear 503 rather than a raw 500 so the owner
 * knows to run the migration. The landing itself degrades to a random sample
 * in the meantime (see /api/photos).
 */
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Owner only — do the cheap auth check before the DB lookup.
  if (!(await isOwnerActor())) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true },
  });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  let body: { featured?: unknown };
  try {
    body = (await req.json()) as { featured?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const featured = body.featured === true;

  try {
    const updated = await db.photo.update({
      where: { id: photo.id },
      data: { featured, featuredAt: featured ? new Date() : null },
      select: { featured: true, featuredAt: true },
    });
    return NextResponse.json({
      ok: true,
      featured: updated.featured,
      featuredAt: updated.featuredAt,
    });
  } catch (e) {
    // Most likely the column doesn't exist yet (pre-`prisma db push`).
    console.error(`feature toggle failed for ${photo.id}:`, e);
    return NextResponse.json(
      {
        error:
          "Featuring isn't available yet — run `npm run prisma:push` to add the Photo.featured column.",
      },
      { status: 503 }
    );
  }
}
