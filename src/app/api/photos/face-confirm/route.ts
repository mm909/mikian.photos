import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { faceRecConfigured, searchFacesByFaceId } from "@/lib/faceRec";
import {
  resolveEventAccess,
  secretLinkCookieName,
  galleryPasswordCookieName,
} from "@/lib/eventAccess";
import { clientIp, envInt, rateLimit } from "@/lib/rateLimit";

/**
 * "This is me" confirm — runner-facing face confirm from a bib search.
 *
 *   POST /api/photos/face-confirm
 *   JSON: { eventId: string, faceId: string, k?: string }
 *     faceId = a PhotoFace.id from the "Is this you?" candidate the runner picked.
 *
 * We resolve that face to its Rekognition FaceId and run SearchFaces to return
 * EVERY photo in the event containing that person — the face-authoritative set.
 * This deliberately drops bib-tagged photos that don't show the runner and adds
 * photos where the bib wasn't readable, and it's robust to our stored clustering
 * over/under-merging (see searchFacesByFaceId).
 *
 * Response mirrors /api/photos/face-search: { photos, matchCount } so the runner
 * UI can drop it straight into the results grid.
 *
 * Like the selfie search this is a paid Rekognition call reachable from the
 * public funnel, so it's rate-limited per IP (burst + daily) — generous for a
 * real runner (confirm a face, try a friend's) but a ceiling on abuse.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const BURST_LIMIT = envInt("FACE_CONFIRM_BURST_LIMIT", 30);
const BURST_WINDOW_SEC = envInt("FACE_CONFIRM_BURST_WINDOW_SEC", 60);
const DAILY_LIMIT = envInt("FACE_CONFIRM_DAILY_LIMIT", 200);
// The runner-confirm search runs a bit looser than the strict cluster threshold
// so a face fragmented across clusters still comes back whole. Matches the
// selfie search default; override without a code change if recall needs tuning.
const CONFIRM_THRESHOLD = envInt("FACE_CONFIRM_THRESHOLD", 80);

function tooMany(message: string, retryAfterSec: number) {
  return NextResponse.json(
    { error: message, retryAfterSec },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSec)) } }
  );
}

export async function POST(req: Request) {
  if (!faceRecConfigured()) {
    return NextResponse.json(
      { error: "Face search is not configured on this deploy." },
      { status: 503 }
    );
  }

  // Throttle before any DB/Rekognition work.
  const ip = clientIp(req);
  const burst = await rateLimit({
    key: `face-confirm:burst:${ip}`,
    limit: BURST_LIMIT,
    windowSec: BURST_WINDOW_SEC,
  });
  if (!burst.ok) {
    return tooMany("You're going a little fast — give it a moment and try again.", burst.retryAfterSec);
  }
  const today = new Date().toISOString().slice(0, 10);
  const daily = await rateLimit({
    key: `face-confirm:daily:${ip}:${today}`,
    limit: DAILY_LIMIT,
    windowSec: 86_400,
  });
  if (!daily.ok) {
    return tooMany("You've reached today's limit. Please try again tomorrow.", daily.retryAfterSec);
  }

  let body: { eventId?: string; faceId?: string; k?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }
  const eventId = body.eventId?.trim();
  const faceId = body.faceId?.trim();
  if (!eventId || !faceId) {
    return NextResponse.json({ error: "eventId and faceId required" }, { status: 400 });
  }

  // Same access gate as /api/photos + face-search.
  const accessToken =
    body.k?.trim() || cookies().get(secretLinkCookieName(eventId))?.value || null;
  const passwordToken = cookies().get(galleryPasswordCookieName(eventId))?.value || null;
  const access = await resolveEventAccess(eventId, { token: accessToken, passwordToken });
  if (!access.ok) {
    const unauthorized = access.reason === "needs-auth" || access.reason === "needs-password";
    return NextResponse.json(
      { error: unauthorized ? "locked" : "not found" },
      { status: unauthorized ? 401 : 404 }
    );
  }

  // Resolve the picked PhotoFace → its Rekognition FaceId (event-scoped so a
  // face id from another event can't be used to search this one).
  const face = await db.photoFace.findFirst({
    where: { id: faceId, eventId },
    select: { rekognitionFaceId: true },
  });
  if (!face?.rekognitionFaceId) {
    return NextResponse.json({ error: "face not found" }, { status: 404 });
  }

  let matches: Awaited<ReturnType<typeof searchFacesByFaceId>>;
  try {
    matches = await searchFacesByFaceId({
      eventId,
      rekognitionFaceId: face.rekognitionFaceId,
      threshold: CONFIRM_THRESHOLD,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `face confirm failed: ${msg}` }, { status: 500 });
  }

  if (matches.length === 0) {
    return NextResponse.json({ photos: [], matchCount: 0 });
  }

  const ids = matches.map((m) => m.photoId);
  const simByPhoto = new Map(matches.map((m) => [m.photoId, m.similarity]));
  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { accessMode: true },
  });
  const rows = await db.photo.findMany({
    where: { id: { in: ids }, hidden: false, eventId },
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

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  const useCdn = Boolean(publicBase) && ev?.accessMode === "public";

  const photos = rows
    .map((p) => ({
      id: p.id,
      eventId: p.eventId,
      bibs: p.bibs.map((b) => b.bib),
      bib: p.bibs[0]?.bib ?? 0,
      mile: p.mile,
      gps: p.gpsLat !== null && p.gpsLng !== null ? [p.gpsLat, p.gpsLng] : null,
      takenAt: p.takenAt,
      photographer: p.photographer.name,
      photographerId: p.photographer.id,
      previewUrl: useCdn ? `${publicBase}/previews/${p.id}.jpg` : `/api/photos/${p.id}/preview`,
      faceSimilarity: simByPhoto.get(p.id),
      _sortAt: new Date(p.takenAt ?? p.createdAt).getTime(),
    }))
    // Chronological (capture-time) order, mirroring the other photo surfaces.
    .sort((a, b) => a._sortAt - b._sortAt);

  return NextResponse.json({
    photos: photos.map(({ _sortAt, ...p }) => p),
    matchCount: photos.length,
  });
}
