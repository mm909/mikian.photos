import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { faceRecConfigured, searchFacesByImage } from "@/lib/faceRec";

/**
 * Runner-facing face search.
 *
 *   POST /api/photos/face-search
 *   multipart/form-data:
 *     selfie:  <File>      buyer's reference photo (a selfie or any clear
 *                          shot of their face)
 *     eventId: <string>    which event's collection to search
 *
 * Response shape matches /api/photos so the runner UI can drop the result
 * list into the same results grid without a second hydration query:
 *
 *   { photos: Photo[], matchCount: number }
 *
 * Each photo carries an extra `faceSimilarity` (0–100) so the UI can sort
 * or filter, but the default order is similarity-descending.
 *
 * No auth required — face search is part of the public buying funnel.
 * Heavy abuse (mass scraping) would need rate-limiting; we'll add that
 * if it becomes a real problem. Rekognition itself charges per query
 * (~$0.001), so the cost floor is small.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

// Vercel body cap is 4.5MB. Selfies from phones are typically 2–4MB; we
// reject anything bigger to fail fast rather than dribble bytes for ages.
const MAX_SELFIE_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  if (!faceRecConfigured()) {
    return NextResponse.json(
      { error: "Face search is not configured on this deploy." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart/form-data body" },
      { status: 400 }
    );
  }

  const eventId = (form.get("eventId") as string | null)?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const selfie = form.get("selfie");
  if (!(selfie instanceof Blob)) {
    return NextResponse.json({ error: "selfie file required" }, { status: 400 });
  }
  if (selfie.size === 0) {
    return NextResponse.json({ error: "selfie is empty" }, { status: 400 });
  }
  if (selfie.size > MAX_SELFIE_BYTES) {
    return NextResponse.json(
      { error: `selfie too large (max ${MAX_SELFIE_BYTES} bytes)` },
      { status: 413 }
    );
  }

  const bytes = Buffer.from(await selfie.arrayBuffer());

  let matches: Awaited<ReturnType<typeof searchFacesByImage>>;
  try {
    matches = await searchFacesByImage({ eventId, selfieBytes: bytes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `face search failed: ${msg}` },
      { status: 500 }
    );
  }

  if (matches.length === 0) {
    return NextResponse.json({ photos: [], matchCount: 0 });
  }

  // Hydrate matched photoIds in the same shape as /api/photos so the
  // runner UI can drop them straight into resultPhotos.
  const photoIds = matches.map((m) => m.photoId);
  const rows = await db.photo.findMany({
    where: { id: { in: photoIds }, hidden: false, eventId },
    select: {
      id: true,
      eventId: true,
      mile: true,
      gpsLat: true,
      gpsLng: true,
      takenAt: true,
      createdAt: true,
      photographer: { select: { id: true, name: true } },
      bibs: { select: { bib: true } },
    },
  });

  const rowById = new Map(rows.map((r) => [r.id, r]));
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  const photos = matches
    .map((m) => {
      const p = rowById.get(m.photoId);
      if (!p) return null;
      const bibs = p.bibs.map((b) => b.bib);
      return {
        id: p.id,
        eventId: p.eventId,
        bibs,
        bib: bibs[0] ?? 0,
        mile: p.mile,
        gps: p.gpsLat !== null && p.gpsLng !== null ? [p.gpsLat, p.gpsLng] : null,
        takenAt: p.takenAt,
        photographer: p.photographer.name,
        photographerId: p.photographer.id,
        previewUrl: publicBase
          ? `${publicBase}/previews/${p.id}.jpg`
          : `/api/photos/${p.id}/preview`,
        faceSimilarity: m.similarity,
        // Capture-time tiebreaker (not exposed in the response shape) — used
        // only to sort below, mirroring the canonical takenAt→createdAt order.
        _sortAt: new Date(p.takenAt ?? p.createdAt).getTime(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // The owner wants chronological (capture-time) order, not face-similarity
  // order: takenAt ascending, falling back to createdAt when takenAt is null.
  photos.sort((a, b) => a._sortAt - b._sortAt);

  return NextResponse.json({
    photos: photos.map(({ _sortAt, ...p }) => p),
    matchCount: photos.length,
  });
}
