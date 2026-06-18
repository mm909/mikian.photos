import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { faceRecConfigured, searchFacesByImage } from "@/lib/faceRec";
import { resolveEventAccess, secretLinkCookieName } from "@/lib/eventAccess";
import { clientIp, envInt, rateLimit } from "@/lib/rateLimit";
import { clusterColorGroup, colorGroupLabel } from "@/lib/colorGroups";

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
 * No auth required — face search is part of the public buying funnel. Since
 * the site went public (v0.8) this endpoint is reachable unauthenticated by
 * anyone, and every call runs a paid Rekognition query (~$0.001) plus real
 * compute. So we rate-limit per IP: a short burst window to stop rapid
 * hammering, and a daily cap as a hard cost ceiling. See src/lib/rateLimit.ts
 * — it uses Upstash Redis when configured (a real shared limit on Vercel's
 * ephemeral instances) and an in-memory counter otherwise.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

// Vercel body cap is 4.5MB. Selfies from phones are typically 2–4MB; we
// reject anything bigger to fail fast rather than dribble bytes for ages.
const MAX_SELFIE_BYTES = 4 * 1024 * 1024;

// Cap on the camp color-group expansion: how many additional same-group photos
// a single face search may pull in. Bounds the response payload for a big camp
// where one color group spans hundreds of photos.
const COLOR_EXPAND_MAX = 400;

// TEMPORARILY DISABLED (2026-06-17): color-group matching isn't accurate enough
// yet, so a face search returns ONLY the runner's own face matches — no team-
// color expansion. Color DETECTION still runs at ingest (so the owner can
// review the identified groups in Event Settings and judge the approach); flip
// this back to true to re-enable the runner-facing expansion once it's solid.
const COLOR_GROUP_SEARCH_EXPANSION = false;

// Per-IP rate-limit tunables (override via env without a code change). Defaults
// are generous for a real runner — retry a blurry selfie, add a handful of
// friends/family faces — but choke mass scraping. The limit is keyed on IP
// only (not event) so the daily cap is a true per-attacker spend ceiling.
const BURST_LIMIT = envInt("FACE_SEARCH_BURST_LIMIT", 15);
const BURST_WINDOW_SEC = envInt("FACE_SEARCH_BURST_WINDOW_SEC", 60);
const DAILY_LIMIT = envInt("FACE_SEARCH_DAILY_LIMIT", 50);
// Per-event daily cost ceiling across ALL IPs — the true spend cap. Per-IP
// limits alone don't bound a botnet rotating addresses; this does. Generous
// enough that real race traffic never trips it (~$5/day of Rekognition at the
// default). Tune or disable (0) via env.
const EVENT_DAILY_LIMIT = envInt("FACE_SEARCH_EVENT_DAILY_LIMIT", 5000);

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

  // Throttle before any DB/Rekognition work so abuse is cheap to reject. Burst
  // window first (catches rapid hammering), then the daily cost ceiling.
  const ip = clientIp(req);
  const burst = await rateLimit({
    key: `face-search:burst:${ip}`,
    limit: BURST_LIMIT,
    windowSec: BURST_WINDOW_SEC,
  });
  if (!burst.ok) {
    return tooMany(
      "You're searching very quickly — give it a few seconds and try again.",
      burst.retryAfterSec
    );
  }
  const today = new Date().toISOString().slice(0, 10); // UTC day → resets at midnight UTC
  const daily = await rateLimit({
    key: `face-search:daily:${ip}:${today}`,
    limit: DAILY_LIMIT,
    windowSec: 86_400,
  });
  if (!daily.ok) {
    return tooMany(
      "You've reached today's face-search limit. Please try again tomorrow.",
      daily.retryAfterSec
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

  // Same access gate as /api/photos — a locked event must not be face-searchable.
  // The secure-link token rides the remembered cookie (set when the event page
  // loaded), so face search after browsing the event works.
  // Token from the form field (parallels ?k= on the other event routes) first,
  // then the remembered cookie — so a secure-link face search authorizes even
  // before/without the cookie. Fails closed: a missing token only ever denies.
  const accessToken =
    (form.get("k") as string | null)?.trim() ||
    cookies().get(secretLinkCookieName(eventId))?.value ||
    null;
  const access = await resolveEventAccess(eventId, { token: accessToken });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason === "needs-auth" ? "sign-in required" : "not found" },
      { status: access.reason === "needs-auth" ? 401 : 404 }
    );
  }

  // Per-event daily cost ceiling — bounds total Rekognition spend for this
  // event regardless of how many IPs are involved (the per-IP caps above can be
  // dodged by rotating addresses; this can't).
  const eventDaily = await rateLimit({
    key: `face-search:event-daily:${eventId}:${today}`,
    limit: EVENT_DAILY_LIMIT,
    windowSec: 86_400,
  });
  if (!eventDaily.ok) {
    return tooMany(
      "Face search is busy for this event right now — please try again later.",
      eventDaily.retryAfterSec
    );
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
    return NextResponse.json({
      photos: [],
      matchCount: 0,
      faceMatchCount: 0,
      colorMatchCount: 0,
      colorGroup: null,
    });
  }

  // --- Camp color-group expansion ---------------------------------------
  // For a camp event with color grouping on, a face search returns the runner's
  // own photos PLUS everyone in their color group. We infer the group from the
  // matched face cluster(s) — the statistical MODE of the per-person shirt
  // colors we sampled at ingest (see src/lib/colorGroups.ts) — then union in
  // every photo carrying that group. Race events skip all of this.
  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { colorGroupEnabled: true, colorGroupLabels: true, accessMode: true },
  });
  const colorOn = COLOR_GROUP_SEARCH_EXPANSION && ev?.colorGroupEnabled === true;

  const facePhotoIds = matches.map((m) => m.photoId);
  const faceSet = new Set(facePhotoIds);
  const faceSimByPhoto = new Map<string, number>();
  for (const m of matches) faceSimByPhoto.set(m.photoId, m.similarity);

  let inferredGroup: string | null = null;
  const colorSet = new Set<string>();
  if (colorOn) {
    // Resolve the matched faces → their cluster(s), then the cluster's group.
    const matchedFaceIds = matches
      .map((m) => m.rekognitionFaceId)
      .filter((x): x is string => !!x);
    const clusterRows = matchedFaceIds.length
      ? await db.photoFace.findMany({
          where: { rekognitionFaceId: { in: matchedFaceIds }, eventId },
          select: { faceClusterId: true },
        })
      : [];
    const clusters = [
      ...new Set(clusterRows.map((r) => r.faceClusterId).filter((x): x is string => !!x)),
    ];
    inferredGroup = await clusterColorGroup(eventId, clusters);
    if (inferredGroup) {
      const groupRows = await db.photoColorGroup.findMany({
        where: { eventId, colorGroup: inferredGroup },
        select: { photoId: true },
        take: COLOR_EXPAND_MAX,
      });
      for (const r of groupRows) colorSet.add(r.photoId);
    }
  }

  // Hydrate the union of face-matched + color-group photoIds in one query,
  // in the same shape as /api/photos so the runner UI can drop them straight
  // into resultPhotos.
  const allIds = [...new Set([...facePhotoIds, ...colorSet])];
  const rows = await db.photo.findMany({
    where: { id: { in: allIds }, hidden: false, eventId },
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
  // Locked events route previews through the access-gated endpoint (see
  // /api/photos/[id]/preview); only public events use the zero-egress CDN.
  const useCdn = Boolean(publicBase) && ev?.accessMode === "public";

  const photos = rows.map((p) => {
    const bibs = p.bibs.map((b) => b.bib);
    const isFace = faceSet.has(p.id);
    const isColor = colorSet.has(p.id);
    const matchedVia: "face" | "color" | "both" =
      isFace && isColor ? "both" : isFace ? "face" : "color";
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
      previewUrl: useCdn
        ? `${publicBase}/previews/${p.id}.jpg`
        : `/api/photos/${p.id}/preview`,
      // Present only for face matches (color-only photos have no similarity).
      faceSimilarity: isFace ? faceSimByPhoto.get(p.id) : undefined,
      matchedVia,
      // Capture-time tiebreaker (not exposed) — sorts chronologically below,
      // mirroring the canonical takenAt→createdAt order.
      _sortAt: new Date(p.takenAt ?? p.createdAt).getTime(),
    };
  });

  // The owner wants chronological (capture-time) order, not face-similarity
  // order: takenAt ascending, falling back to createdAt when takenAt is null.
  photos.sort((a, b) => a._sortAt - b._sortAt);

  const faceMatchCount = photos.filter((p) => faceSet.has(p.id)).length;
  const labels =
    ev?.colorGroupLabels && typeof ev.colorGroupLabels === "object" && !Array.isArray(ev.colorGroupLabels)
      ? (ev.colorGroupLabels as Record<string, string>)
      : null;

  return NextResponse.json({
    photos: photos.map(({ _sortAt, ...p }) => p),
    matchCount: photos.length,
    faceMatchCount,
    colorMatchCount: photos.length - faceMatchCount,
    colorGroup: inferredGroup
      ? { key: inferredGroup, label: colorGroupLabel(inferredGroup, labels) }
      : null,
  });
}
