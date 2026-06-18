import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { autoConfirmClusterForBib, getConfirmedCluster } from "@/lib/faceAssignment";
import { getEventPricing, centsToDollars } from "@/lib/pricing";
import { getEvent } from "@/lib/events";
import { eventCapabilities } from "@/lib/eventConfig";
import { colorGroupLabel } from "@/lib/colorGroups";
import {
  resolveEventAccess,
  secretLinkCookieName,
  galleryPasswordCookieName,
} from "@/lib/eventAccess";
import type { Prisma } from "@prisma/client";

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

  // Enforce the event's access mode HERE too — not just on the page — so a
  // locked event can't leak its photos through this JSON endpoint. Token comes
  // from ?k= (initial secure-link load) or the remembered cookie.
  const accessToken =
    url.searchParams.get("k") ||
    cookies().get(secretLinkCookieName(eventId))?.value ||
    null;
  const passwordToken = cookies().get(galleryPasswordCookieName(eventId))?.value || null;
  const access = await resolveEventAccess(eventId, { token: accessToken, passwordToken });
  if (!access.ok) {
    // needs-password (locked gallery) + needs-auth both surface as 401; missing/
    // unlisted as 404.
    const unauthorized = access.reason === "needs-auth" || access.reason === "needs-password";
    return NextResponse.json(
      { error: unauthorized ? "locked" : "not found" },
      { status: unauthorized ? 401 : 404 }
    );
  }

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
        colorGroups: { select: { colorGroup: true } },
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
          colorGroups: { select: { colorGroup: true } },
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
            colorGroups: { select: { colorGroup: true } },
          },
        });
        for (const p of expansionRows) {
          sourcesByPhotoId.set(p.id, new Set<Source>(["face"]));
        }
      }
      combined = [...baseRows, ...expansionRows];
      crossLinked = expansionRows.length;
      // True (uncapped) count of the matched set — the teaser advertises
      // "6 of N". When a cluster is applied (the runner confirmed a face, or
      // we auto-confirmed one), the matched set is the UNION of bib-tagged and
      // face-cluster photos, so the count must be that union — not bib-only
      // (which was the bug behind "showing 36 but says 23"). Independent of the
      // maxPhotos() cap that bounds how many rows we actually return.
      const orClauses: Prisma.PhotoWhereInput[] = [];
      if (bib !== null) orClauses.push({ bibs: { some: { bib } } });
      if (clusterParam) orClauses.push({ faces: { some: { faceClusterId: clusterParam } } });
      total = await db.photo.count({
        where: {
          eventId,
          hidden: false,
          ...(orClauses.length > 0 ? { OR: orClauses } : {}),
        },
      });
    }

    // Whether this bib confidently maps to a single face — when so the client
    // auto-confirms (union) without asking. Only meaningful on the initial bib
    // query, before a cluster has been chosen.
    let autoConfirmClusterId: string | null = null;
    if (bib !== null && !clusterParam && baseRows.length > 0) {
      // A face the owner CONFIRMED on the runner profile wins — we already
      // vouched for it by hand, so the client auto-expands (union) and skips
      // the "Is this you?" prompt entirely. Fall back to the geometry
      // heuristic (single confident cluster) when nothing is confirmed.
      autoConfirmClusterId =
        (await getConfirmedCluster(eventId, bib)) ??
        (await autoConfirmClusterForBib(eventId, bib));
    }

    const { isFree, bundleCents } = await getEventPricing(eventId);
    const bundlePrice = centsToDollars(bundleCents);
    // Display metadata so the runner flow can render the event headline without
    // a hardcoded constant (multi-event: the event comes from the /e/[slug] URL).
    const evDto = await getEvent(eventId);
    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    // Only PUBLIC events serve previews straight from the public CDN domain.
    // Locked events (secure-link / private / account-only) route previews
    // through the access-gated /preview endpoint so their images can't be
    // fetched by URL without the event's secret link.
    const useCdn = Boolean(publicBase) && evDto?.accessMode === "public";

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
          // The camp color groups visible in this photo (display labels). Empty
          // for race events / photos with no detected groups.
          colorGroups: p.colorGroups.map((c) => ({
            key: c.colorGroup,
            label: colorGroupLabel(c.colorGroup, evDto?.colorGroupLabels),
          })),
          mile: p.mile,
          gps: p.gpsLat !== null && p.gpsLng !== null ? [p.gpsLat, p.gpsLng] : null,
          takenAt: p.takenAt,
          photographer: p.photographer.name,
          photographerId: p.photographer.id,
          previewUrl: useCdn
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
      isFree,
      event: evDto
        ? {
            id: evDto.id,
            name: evDto.name,
            nameParts: evDto.nameParts,
            date: evDto.date.toISOString(),
            city: evDto.city,
            type: evDto.type,
            externalBrowseUrl: evDto.externalBrowseUrl,
            searchHeadline: evDto.searchHeadline,
          }
        : null,
      capabilities: evDto ? eventCapabilities(evDto) : null,
      cap,
      total,
      crossLinked,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
