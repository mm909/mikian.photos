import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoConfirmClusterForBib } from "@/lib/faceAssignment";
import { resolveBundlePriceCents, centsToDollars } from "@/lib/pricing";

/**
 * Public photo catalog for the runner-facing flow.
 *
 *   GET /api/photos?eventId=lighthouse-half-2026
 *   GET /api/photos?eventId=lighthouse-half-2026&bib=1248
 *   GET /api/photos?eventId=lighthouse-half-2026&bib=1248&cluster=<id>
 *   GET /api/photos?eventId=lighthouse-half-2026&bib=1248&cluster=<id>&faceOnly=1
 *
 * Returns non-hidden photos for the event.
 *
 * ## How bib search works (two-step "Is this you?" flow)
 *
 * Bib OCR can miss photos where the number is obscured (arms covering it,
 * back of runner to camera, motion blur, etc). We use the runner's *face*
 * to rescue those — but instead of guessing which face is theirs, we ask:
 *
 *   Step 1: `?bib=N` (no cluster yet)
 *     → return photos directly tagged with bib N
 *     → return `faceCandidates`: top clusters from those photos, ranked
 *       by how many of the bib's photos contain each face. The UI shows
 *       these as "Is this you?" thumbnails.
 *     → return `autoConfirmClusterId`: when the bib confidently maps to ONE
 *       face (a single cluster across ≥2 photos), the cluster id so the
 *       client can expand silently without asking. null otherwise.
 *
 *   Step 2: `?bib=N&cluster=<id>` (after the runner clicks a candidate)
 *     → UNION: bib-tagged photos PLUS every other photo in the event whose
 *       PhotoFaces share the picked cluster.
 *
 *   Step 2b: `?bib=N&cluster=<id>&faceOnly=1` (the explicit "This is me")
 *     → FILTER: ONLY photos containing the picked face cluster. Bib-tagged
 *       photos that don't actually show the runner's face are dropped — the
 *       point of this path is to trust the face over the bib OCR.
 *
 * Why a deliberate confirmation step: blind auto-expansion was too eager
 * — when a bib only has 1–2 photos, every face in those photos qualifies
 * as "the runner," which sometimes brings in friends/family standing next
 * to the runner. Making the confirmation explicit removes the false
 * positives at the cost of one extra click.
 *
 * `previewUrl` points directly at the CDN (`R2_PUBLIC_URL`) when set, so the
 * browser fetches bytes straight from R2 with zero Vercel egress. When the env
 * isn't set we fall back to the streaming /api/photos/[id]/preview route.
 */
export const runtime = "nodejs";

/** Max face-candidate tiles we return for the "Is this you?" strip.
 *  More than ~4 is hard for a user to scan; fewer leaves the runner
 *  stranded when they're not the dominant face. */
const MAX_FACE_CANDIDATES = 4;

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
  const clusterParam = url.searchParams.get("cluster");
  // faceOnly=1 (with a cluster) switches the result set from "bib photos +
  // face matches" (union) to "only photos containing this face" (filter) —
  // the explicit "This is me" path, which drops bib-tagged photos that don't
  // actually show the runner's face.
  const faceOnly = url.searchParams.get("faceOnly") === "1" && Boolean(clusterParam);
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

    type Source = "bib" | "face";
    const sourcesByPhotoId = new Map<string, Set<Source>>();
    for (const p of baseRows) {
      sourcesByPhotoId.set(p.id, new Set<Source>(["bib"]));
    }

    // Build face candidates from the bib's photos. Only when a bib search
    // was actually issued.
    type FaceCandidate = {
      clusterId: string;
      photoCountInBib: number;
      photoCountInEvent: number;
      /** Full set of event-wide photo IDs for this cluster — the client
       *  subtracts these against the on-screen result set to compute the
       *  truly-new count rendered as "+N more photos". */
      photoIdsInEvent: string[];
      sample: { photoId: string; faceId: string };
    };
    let faceCandidates: FaceCandidate[] = [];

    if (bib !== null && baseRows.length > 0) {
      const bibPhotoIds = baseRows.map((p) => p.id);
      const bibFaces = await db.photoFace.findMany({
        where: { photoId: { in: bibPhotoIds }, faceClusterId: { not: null } },
        select: {
          id: true,
          photoId: true,
          faceClusterId: true,
          confidence: true,
        },
        orderBy: { confidence: "desc" },
      });

      // Cluster → {photo set, best sample face row}
      const aggregate = new Map<
        string,
        { photoIds: Set<string>; sampleId: string; sampleConfidence: number; samplePhotoId: string }
      >();
      for (const f of bibFaces) {
        if (!f.faceClusterId) continue;
        const slot = aggregate.get(f.faceClusterId);
        if (!slot) {
          aggregate.set(f.faceClusterId, {
            photoIds: new Set([f.photoId]),
            sampleId: f.id,
            sampleConfidence: f.confidence,
            samplePhotoId: f.photoId,
          });
        } else {
          slot.photoIds.add(f.photoId);
          // Already sorted by confidence desc — first row per cluster is best.
        }
      }

      // Look up the photo IDs (event-wide) for the top clusters. We return
      // the full id list rather than just a count so the client can compute
      // "how many of these are NEW to my current results" — accounting for
      // photos already pulled in via the bib match, an Add-a-bib, or a
      // previously-confirmed face cluster.
      const topClusterIds = [...aggregate.entries()]
        .sort(
          (a, b) =>
            b[1].photoIds.size - a[1].photoIds.size ||
            b[1].sampleConfidence - a[1].sampleConfidence
        )
        .slice(0, MAX_FACE_CANDIDATES)
        .map(([id]) => id);

      const eventWideRows = await db.photoFace.findMany({
        where: { eventId, faceClusterId: { in: topClusterIds } },
        select: { faceClusterId: true, photoId: true },
      });
      const eventPhotoIdsByCluster = new Map<string, Set<string>>();
      for (const r of eventWideRows) {
        if (!r.faceClusterId) continue;
        const set = eventPhotoIdsByCluster.get(r.faceClusterId) ?? new Set<string>();
        set.add(r.photoId);
        eventPhotoIdsByCluster.set(r.faceClusterId, set);
      }

      faceCandidates = topClusterIds.map((cid) => {
        const slot = aggregate.get(cid)!;
        const eventIds = eventPhotoIdsByCluster.get(cid) ?? new Set<string>();
        return {
          clusterId: cid,
          photoCountInBib: slot.photoIds.size,
          photoCountInEvent: eventIds.size || slot.photoIds.size,
          // Explicit id list so the client can subtract whatever's already
          // on screen. Capped at a few dozen ids per cluster in practice —
          // cheap enough to ship and avoids re-roundtripping.
          photoIdsInEvent: Array.from(eventIds),
          sample: { photoId: slot.samplePhotoId, faceId: slot.sampleId },
        };
      });
    }

    let combined: typeof baseRows;
    let total: number;
    let crossLinked = 0;

    if (faceOnly && clusterParam) {
      // "This is me" — the result set is exactly the photos containing this
      // face cluster, regardless of bib. Bib-tagged photos that DON'T show
      // the runner's face drop out entirely (the whole point of this path).
      const faceRows = await db.photo.findMany({
        where: {
          eventId,
          hidden: false,
          faces: { some: { faceClusterId: clusterParam } },
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
      const bibIdSet = new Set(baseRows.map((p) => p.id));
      for (const p of faceRows) {
        sourcesByPhotoId.set(
          p.id,
          new Set<Source>(bibIdSet.has(p.id) ? ["bib", "face"] : ["face"])
        );
      }
      combined = faceRows;
      crossLinked = faceRows.filter((p) => !bibIdSet.has(p.id)).length;
      total = await db.photo.count({
        where: {
          eventId,
          hidden: false,
          faces: { some: { faceClusterId: clusterParam } },
        },
      });
    } else {
      // Union mode (default). Expand by cluster only when the runner confirmed
      // one (passed as ?cluster=X) — face matches are added ON TOP of the
      // bib-tagged photos rather than replacing them.
      let expansionRows: typeof baseRows = [];
      if (bib !== null && clusterParam && baseRows.length > 0) {
        const bibPhotoIds = baseRows.map((p) => p.id);
        expansionRows = await db.photo.findMany({
          where: {
            eventId,
            hidden: false,
            id: { notIn: bibPhotoIds },
            faces: { some: { faceClusterId: clusterParam } },
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
      combined = [...baseRows, ...expansionRows];
      crossLinked = expansionRows.length;
      // True (uncapped) count of the matched set — the teaser advertises
      // "6 of N". Mirrors the baseRows where clause; independent of the
      // maxPhotos() cap that bounds how many rows we actually return.
      total = await db.photo.count({
        where: {
          eventId,
          hidden: false,
          ...(bib !== null ? { bibs: { some: { bib } } } : {}),
        },
      });
    }

    // Whether this bib confidently maps to a single face — when so the client
    // auto-confirms (union) without asking. Only meaningful on the initial bib
    // query, before a cluster has been chosen.
    let autoConfirmClusterId: string | null = null;
    if (bib !== null && !clusterParam && baseRows.length > 0) {
      autoConfirmClusterId = await autoConfirmClusterForBib(eventId, bib);
    }

    const bundlePrice = centsToDollars(await resolveBundlePriceCents(eventId));
    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

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
      faceCandidates: faceCandidates.map((c) => ({
        ...c,
        // Hand the client a ready-to-use thumbnail URL so it doesn't have
        // to assemble routes from raw ids.
        sampleFaceUrl: `/api/photos/${c.sample.photoId}/face/${c.sample.faceId}`,
      })),
      confirmedCluster: clusterParam ?? null,
      autoConfirmClusterId,
      faceOnly,
      bundlePrice,
      cap,
      total,
      crossLinked,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
