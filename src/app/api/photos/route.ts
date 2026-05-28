import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Public photo catalog for the runner-facing flow.
 *
 *   GET /api/photos?eventId=lighthouse-half-2026
 *   GET /api/photos?eventId=lighthouse-half-2026&bib=1248
 *   GET /api/photos?eventId=lighthouse-half-2026&bib=1248&crossLink=0  (opt-out)
 *
 * Returns non-hidden photos for the event. When `bib` is provided, only photos
 * tagged with that bib (via the PhotoBib join table) are returned — plus, by
 * default, additional photos sharing the bibbed runner's face clusters (see
 * the "Bib ↔ face cross-link" section below). Pass `crossLink=0` to disable.
 *
 * ## Bib ↔ face cross-link
 *
 * Bib OCR can miss photos where the number is obscured (arms covering it,
 * back of runner to camera, motion blur, etc). To rescue those, we use the
 * runner's *face*:
 *
 *   1. Pull the photos directly tagged with this bib.
 *   2. From those photos' PhotoFace rows, count which face clusters appear.
 *   3. A cluster is "the runner's" if it appears in ≥2 of the bib-tagged
 *      photos. (Multiple bibbed photos containing the same face is strong
 *      evidence that face = the bib's runner. Random crowd faces appear
 *      once and get filtered out.) When the bib has only 1 tagged photo,
 *      we accept every cluster from it — small false-positive risk but
 *      higher recall when coverage is sparse.
 *   4. Union with any other photos in the event whose PhotoFaces share
 *      one of those clusters.
 *   5. Each returned photo carries `matchedVia: "bib" | "face" | "both"`
 *      so the UI can mark face-only matches subtly differently.
 *
 * `previewUrl` points directly at the CDN (`R2_PUBLIC_URL`) when set, so the
 * browser fetches bytes straight from R2 with zero Vercel egress. When the env
 * isn't set we fall back to the streaming /api/photos/[id]/preview route.
 */
export const runtime = "nodejs";

/** When a bib has only a few tagged photos, the "appears in 2+" rule
 *  becomes too strict to ever trigger. Below this count we accept all
 *  clusters from the bib-tagged photos. */
const BIB_SPARSE_THRESHOLD = 2;

// Dev cost guardrail: hard-cap how many rows ever come back.
function maxPhotos(): number {
  const envKey = process.env.NODE_ENV === "production" ? "MAX_PHOTOS_PROD" : "MAX_PHOTOS_DEV";
  const v = Number(process.env[envKey]);
  if (Number.isFinite(v) && v > 0) return v;
  return process.env.NODE_ENV === "production" ? 500 : 50;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const bibParam = url.searchParams.get("bib");
  const crossLink = url.searchParams.get("crossLink") !== "0"; // default ON
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const bib = bibParam ? Number(bibParam) : null;
  if (bibParam && (!Number.isFinite(bib) || (bib as number) <= 0)) {
    return NextResponse.json({ error: "invalid bib" }, { status: 400 });
  }

  try {
    const cap = maxPhotos();

    // Base set: photos directly tagged with the bib (or every visible photo
    // when no bib filter is in play).
    const baseRows = await db.photo.findMany({
      where: {
        eventId,
        hidden: false,
        ...(bib !== null ? { bibs: { some: { bib } } } : {}),
      },
      take: cap,
      orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        eventId: true,
        mile: true,
        gpsLat: true,
        gpsLng: true,
        takenAt: true,
        photographer: { select: { id: true, name: true } },
        bibs: { select: { bib: true } },
      },
    });

    // Cross-link expansion: only when a bib was requested, the feature is
    // on, and we have at least one bib-tagged photo to anchor from.
    type Source = "bib" | "face";
    const sourcesByPhotoId = new Map<string, Set<Source>>();
    for (const p of baseRows) {
      sourcesByPhotoId.set(p.id, new Set<Source>(["bib"]));
    }

    let expansionRows: typeof baseRows = [];
    if (crossLink && bib !== null && baseRows.length > 0) {
      const bibPhotoIds = baseRows.map((p) => p.id);
      const bibFaces = await db.photoFace.findMany({
        where: { photoId: { in: bibPhotoIds }, faceClusterId: { not: null } },
        select: { photoId: true, faceClusterId: true },
      });

      // Cluster → set of bib-tagged photos it appears in.
      const photosPerCluster = new Map<string, Set<string>>();
      for (const f of bibFaces) {
        if (!f.faceClusterId) continue;
        const set = photosPerCluster.get(f.faceClusterId) ?? new Set<string>();
        set.add(f.photoId);
        photosPerCluster.set(f.faceClusterId, set);
      }

      // Pick clusters that look like "the runner."
      const runnerClusters: string[] = [];
      const sparse = baseRows.length < BIB_SPARSE_THRESHOLD;
      for (const [clusterId, photoSet] of photosPerCluster) {
        // Dense path: keep clusters appearing in 2+ bib-tagged photos
        // (a single appearance is too easy to false-positive on crowd
        // shots). Sparse path: with only 1 bib photo we can't apply the
        // ≥2 rule; accept every cluster from that photo.
        if (sparse || photoSet.size >= 2) runnerClusters.push(clusterId);
      }

      if (runnerClusters.length > 0) {
        expansionRows = await db.photo.findMany({
          where: {
            eventId,
            hidden: false,
            id: { notIn: bibPhotoIds },
            faces: { some: { faceClusterId: { in: runnerClusters } } },
          },
          take: Math.max(0, cap - baseRows.length),
          orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            eventId: true,
            mile: true,
            gpsLat: true,
            gpsLng: true,
            takenAt: true,
            photographer: { select: { id: true, name: true } },
            bibs: { select: { bib: true } },
          },
        });
        for (const p of expansionRows) {
          sourcesByPhotoId.set(p.id, new Set<Source>(["face"]));
        }
      }
    }

    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    const combined = [...baseRows, ...expansionRows];

    return NextResponse.json({
      photos: combined.map((p) => {
        const bibs = p.bibs.map((b) => b.bib);
        const srcs = sourcesByPhotoId.get(p.id) ?? new Set<Source>(["bib"]);
        const matchedVia: "bib" | "face" | "both" =
          srcs.has("bib") && srcs.has("face")
            ? "both"
            : srcs.has("face")
              ? "face"
              : "bib";
        return {
          id: p.id,
          eventId: p.eventId,
          bibs,
          bib: bibs[0] ?? 0, // backward-compat
          mile: p.mile,
          gps: p.gpsLat !== null && p.gpsLng !== null ? [p.gpsLat, p.gpsLng] : null,
          takenAt: p.takenAt,
          photographer: p.photographer.name,
          photographerId: p.photographer.id,
          previewUrl: publicBase
            ? `${publicBase}/previews/${p.id}.jpg`
            : `/api/photos/${p.id}/preview`,
          matchedVia,
        };
      }),
      cap,
      crossLinked: expansionRows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
