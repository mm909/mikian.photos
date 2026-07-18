import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import {
  autoConfirmClusterForBib,
  getConfirmedCluster,
  isOversizedCluster,
  superclusterCeiling,
} from "@/lib/faceAssignment";
import { getEventPricing, centsToDollars } from "@/lib/pricing";
import { featuredLandingPhotoIds } from "@/lib/featured";
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

/** Ceiling on the `matchedIds` list (the FULL matched set as bare ids, which
 *  the client snapshots into a bundle so an order covers every matched photo,
 *  not just the display-capped rows). Bounds the JSON payload; an event or
 *  match set bigger than this falls back to a count-only total. */
const MATCHED_IDS_MAX = 10_000;

/** Stable chronological order shared by every photo query in this route:
 *  capture time first (photos WITHOUT an EXIF timestamp sort last, explicitly —
 *  don't rely on the DB's null placement), then upload time, then `id` as the
 *  pagination tiebreaker (photos shot in the same second would otherwise
 *  shuffle between pages). */
const PHOTO_ORDER = [
  { takenAt: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.PhotoOrderByWithRelationInput[];

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
  // face matches" (union) to "only photos containing this face" (filter). The
  // effective value is resolved below, after the supercluster guard decides
  // whether the requested cluster is trustworthy.
  const faceOnlyRequested = url.searchParams.get("faceOnly") === "1";
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

  // Pagination for the gallery surface: ?offset=N&limit=M pages through the
  // matched set in stable chronological order. limit clamps to the cost
  // guardrail; existing callers (no params) get the old cap-sized first page.
  const offsetParam = Number(url.searchParams.get("offset"));
  const offset =
    Number.isFinite(offsetParam) && offsetParam > 0 ? Math.floor(offsetParam) : 0;

  try {
    const cap = maxPhotos();
    const limitParam = Number(url.searchParams.get("limit"));
    const take =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), cap)
        : cap;

    // Supercluster guard: only the searches that actually involve a bib or a
    // cluster need the event-size lookup (a plain catalog/gallery load doesn't).
    // An incoming cluster that spans an implausible share of the event is an
    // over-merged clustering error, so we treat it as ABSENT — the search falls
    // back to bib-only rather than unioning in ~the whole event. Candidates are
    // filtered by the same ceiling below.
    let eventVisiblePhotos: number | null = null;
    if (bib !== null || clusterParam) {
      eventVisiblePhotos = await db.photo.count({ where: { eventId, hidden: false } });
    }
    let effectiveCluster = clusterParam;
    if (
      effectiveCluster &&
      eventVisiblePhotos != null &&
      (await isOversizedCluster(eventId, effectiveCluster, eventVisiblePhotos))
    ) {
      effectiveCluster = null;
    }
    // Resolve the filter-vs-union mode against the TRUSTED cluster: an oversized
    // (ignored) cluster can't put us into faceOnly mode.
    const faceOnly = faceOnlyRequested && Boolean(effectiveCluster);

    // Base set: photos directly tagged with the bib (or every visible photo
    // when no bib filter is in play).
    const baseRows = await db.photo.findMany({
      where: {
        eventId,
        hidden: false,
        ...(bib !== null ? { bibs: { some: { bib } } } : {}),
      },
      skip: offset,
      take,
      orderBy: PHOTO_ORDER,
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
          // Geometric face↔bib link: the face directly above THIS bib's number
          // (see faceBibMatch). This is the runner's own face vs a bystander who
          // merely shares the frame — we surface the runner's face first and use
          // it to seed the "This is me" search.
          bib: true,
        },
        orderBy: { confidence: "desc" },
      });

      // Cluster → aggregate. Track whether the cluster is geometrically linked
      // to THIS bib, and prefer a geo-linked face as the sample so "This is me"
      // seeds Rekognition with the RUNNER's face, not a bystander's.
      const aggregate = new Map<
        string,
        {
          photoIds: Set<string>;
          sampleId: string;
          samplePhotoId: string;
          sampleConfidence: number;
          sampleGeo: boolean; // is the current sample a geo-linked face?
          geoLinked: boolean; // does the cluster contain any geo-linked face?
        }
      >();
      for (const f of bibFaces) {
        if (!f.faceClusterId) continue;
        const isGeo = f.bib === bib;
        const slot = aggregate.get(f.faceClusterId);
        if (!slot) {
          aggregate.set(f.faceClusterId, {
            photoIds: new Set([f.photoId]),
            sampleId: f.id,
            samplePhotoId: f.photoId,
            sampleConfidence: f.confidence,
            sampleGeo: isGeo,
            geoLinked: isGeo,
          });
        } else {
          slot.photoIds.add(f.photoId);
          slot.geoLinked = slot.geoLinked || isGeo;
          // Promote a geo-linked face to be the sample (rows are confidence-desc,
          // so the first geo-linked one we see is the best).
          if (isGeo && !slot.sampleGeo) {
            slot.sampleId = f.id;
            slot.samplePhotoId = f.photoId;
            slot.sampleConfidence = f.confidence;
            slot.sampleGeo = true;
          }
        }
      }

      // Look up the photo IDs (event-wide) for the top clusters. We return
      // the full id list rather than just a count so the client can compute
      // "how many of these are NEW to my current results" — accounting for
      // photos already pulled in via the bib match, an Add-a-bib, or a
      // previously-confirmed face cluster.
      // Rank the runner's own face (geo-linked) FIRST, then by how many of the
      // bib's photos show the face, then confidence.
      const topClusterIds = [...aggregate.entries()]
        .sort(
          (a, b) =>
            Number(b[1].geoLinked) - Number(a[1].geoLinked) ||
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

      // Drop over-merged superclusters from the "Is this you?" tiles — offering
      // one would let the runner confirm a cluster that unions in strangers.
      if (eventVisiblePhotos != null) {
        const ceiling = superclusterCeiling(eventVisiblePhotos);
        faceCandidates = faceCandidates.filter((c) => c.photoCountInEvent <= ceiling);
      }
    }

    let combined: typeof baseRows;
    let crossLinked = 0;

    if (faceOnly && effectiveCluster) {
      // "This is me" — the result set is exactly the photos containing this
      // face cluster, regardless of bib. Bib-tagged photos that DON'T show
      // the runner's face drop out entirely (the whole point of this path).
      const faceRows = await db.photo.findMany({
        where: {
          eventId,
          hidden: false,
          faces: { some: { faceClusterId: effectiveCluster } },
        },
        take: cap,
        orderBy: PHOTO_ORDER,
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
    } else {
      // Union mode (default). Expand by cluster only when the runner confirmed
      // one (passed as ?cluster=X) — face matches are added ON TOP of the
      // bib-tagged photos rather than replacing them.
      let expansionRows: typeof baseRows = [];
      if (bib !== null && effectiveCluster && baseRows.length > 0) {
        const bibPhotoIds = baseRows.map((p) => p.id);
        expansionRows = await db.photo.findMany({
          where: {
            eventId,
            hidden: false,
            id: { notIn: bibPhotoIds },
            faces: { some: { faceClusterId: effectiveCluster } },
          },
          take: Math.max(0, cap - baseRows.length),
          orderBy: PHOTO_ORDER,
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
    }

    // The FULL matched set as bare ids, in the same chronological order as the
    // rows above — independent of the maxPhotos() display cap. Two jobs:
    //   1. `total` — the true uncapped count of the matched set. When a cluster
    //      is applied the set is the UNION of bib-tagged and face-cluster
    //      photos, so the count must be that union — not bib-only (the old
    //      "showing 36 but says 23" bug).
    //   2. `matchedIds` — the client snapshots these into a bundle at checkout
    //      so an order covers EVERY matched photo. Snapshotting the capped
    //      display rows instead was the "60 photos matched but the ZIP only
    //      has 50" bug.
    // Only shipped on the first page (offset 0) — pagination callers already
    // have it, and re-sending 10k ids per page would bloat every response.
    const matchWhere: Prisma.PhotoWhereInput =
      faceOnly && effectiveCluster
        ? { eventId, hidden: false, faces: { some: { faceClusterId: effectiveCluster } } }
        : (() => {
            const orClauses: Prisma.PhotoWhereInput[] = [];
            if (bib !== null) orClauses.push({ bibs: { some: { bib } } });
            if (effectiveCluster)
              orClauses.push({ faces: { some: { faceClusterId: effectiveCluster } } });
            return {
              eventId,
              hidden: false,
              ...(orClauses.length > 0 ? { OR: orClauses } : {}),
            };
          })();
    let matchedIds: string[] | null = null;
    if (offset === 0) {
      const matchedIdRows = await db.photo.findMany({
        where: matchWhere,
        orderBy: PHOTO_ORDER,
        select: { id: true },
        take: MATCHED_IDS_MAX,
      });
      matchedIds = matchedIdRows.map((r) => r.id);
    }
    const total =
      matchedIds !== null && matchedIds.length < MATCHED_IDS_MAX
        ? matchedIds.length
        : await db.photo.count({ where: matchWhere });

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

    // Portfolio hero for the search landing — owner-featured photos first, then
    // a random fill. Only computed for the catalog request (no bib / cluster /
    // pagination), which is the only caller that renders the landing; search
    // requests skip it. A URL builder shared with the photos map above.
    const previewUrlFor = (id: string) =>
      useCdn ? `${publicBase}/previews/${id}.jpg` : `/api/photos/${id}/preview`;
    let featured: { id: string; previewUrl: string; pinned: boolean }[] | undefined;
    if (bib === null && !clusterParam && offset === 0) {
      const { ids, pinnedIds } = await featuredLandingPhotoIds(eventId);
      const pinnedSet = new Set(pinnedIds);
      featured = ids.map((id) => ({
        id,
        previewUrl: previewUrlFor(id),
        pinned: pinnedSet.has(id),
      }));
    }

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
        // The PhotoFace id of the sample — the client sends this to
        // /api/photos/face-confirm so "This is me" searches Rekognition by this
        // exact face (see the face-confirm route).
        sampleFaceId: c.sample.faceId,
      })),
      confirmedCluster: effectiveCluster ?? null,
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
            galleryVisibility: evDto.galleryVisibility,
          }
        : null,
      capabilities: evDto ? eventCapabilities(evDto) : null,
      cap,
      total,
      crossLinked,
      offset,
      // Full matched-set ids (chronological, uncapped up to MATCHED_IDS_MAX).
      // null on paginated follow-up requests (offset > 0).
      matchedIds,
      // Portfolio hero photos for the landing (catalog request only; undefined
      // on search/pagination requests).
      featured,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
