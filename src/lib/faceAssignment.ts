/**
 * Event-wide face → runner assignment. Server-only.
 *
 * Builds on the per-photo geometric links (PhotoFace.bib, set by
 * linkFacesToBibsForPhoto) to answer "which single face cluster is this
 * runner's, and which sample crop do we show for them?" — with two guarantees:
 *
 *   1. **No two runners share a face.** Each face cluster is assigned to
 *      exactly one bib: the bib it's linked to in the most photos. A cluster
 *      can't be claimed by two different runners.
 *
 *   2. **One face per runner.** Among the clusters a bib owns, the runner's
 *      face is the dominant one (most photos linked, ties broken by total
 *      confidence).
 *
 * Both the roster list and a single runner's profile read from here so their
 * answers never disagree.
 */
import "server-only";
import { db } from "./db";

export type RunnerFace = {
  faceClusterId: string;
  /** A representative face crop for this runner — the highest-confidence face
   *  in the assigned cluster. Feed to /api/photos/[photoId]/face/[faceId]. */
  sample: { photoId: string; faceId: string };
  /** Distinct photos where this cluster is linked to this bib. */
  photoCount: number;
  /** photoCount / total distinct photos tagged with this bib. ~1.0 = strong. */
  photoShare: number;
  /** Distinct face clusters geometrically linked to this bib (before the
   *  one-face-per-runner pick). >1 means we had to choose. */
  clusterCount: number;
};

type PerBib = {
  photoIds: Set<string>;
  confSum: number;
};

/**
 * Compute the assignment map for every runner in an event: bib → RunnerFace.
 * Bibs with no linked face are simply absent from the map.
 */
export async function computeFaceAssignments(
  eventId: string
): Promise<Map<number, RunnerFace>> {
  // Every face that geometry linked to a bib, plus its cluster + a crop ref.
  const faces = await db.photoFace.findMany({
    where: {
      eventId,
      bib: { not: null },
      faceClusterId: { not: null },
      photo: { hidden: false },
    },
    select: {
      id: true,
      photoId: true,
      bib: true,
      faceClusterId: true,
      confidence: true,
    },
  });

  if (faces.length === 0) return new Map();

  // cluster → bib → {distinct photos, confidence sum}
  const clusterBib = new Map<string, Map<number, PerBib>>();
  // cluster → best (highest-confidence) sample crop across the whole cluster
  const bestSample = new Map<
    string,
    { photoId: string; faceId: string; conf: number }
  >();

  for (const f of faces) {
    const cid = f.faceClusterId!;
    const bib = f.bib!;

    let byBib = clusterBib.get(cid);
    if (!byBib) {
      byBib = new Map();
      clusterBib.set(cid, byBib);
    }
    let slot = byBib.get(bib);
    if (!slot) {
      slot = { photoIds: new Set(), confSum: 0 };
      byBib.set(bib, slot);
    }
    slot.photoIds.add(f.photoId);
    slot.confSum += f.confidence;

    const best = bestSample.get(cid);
    if (!best || f.confidence > best.conf) {
      bestSample.set(cid, { photoId: f.photoId, faceId: f.id, conf: f.confidence });
    }
  }

  // Step 1 — assign each cluster to ONE bib (most photos, ties by confSum).
  // This is what enforces "no two runners share a face".
  const clusterOwner = new Map<string, number>();
  for (const [cid, byBib] of clusterBib) {
    let ownerBib = -1;
    let bestPhotos = -1;
    let bestConf = -1;
    for (const [bib, slot] of byBib) {
      const photos = slot.photoIds.size;
      if (photos > bestPhotos || (photos === bestPhotos && slot.confSum > bestConf)) {
        ownerBib = bib;
        bestPhotos = photos;
        bestConf = slot.confSum;
      }
    }
    if (ownerBib >= 0) clusterOwner.set(cid, ownerBib);
  }

  // Step 2 — per bib, gather the clusters it owns and pick the dominant one.
  type BibAgg = {
    clusters: string[];
    bestCluster: string;
    bestPhotos: number;
    bestConf: number;
  };
  const byBib = new Map<number, BibAgg>();
  for (const [cid, bib] of clusterOwner) {
    const slot = clusterBib.get(cid)!.get(bib)!;
    const photos = slot.photoIds.size;
    const agg = byBib.get(bib);
    if (!agg) {
      byBib.set(bib, {
        clusters: [cid],
        bestCluster: cid,
        bestPhotos: photos,
        bestConf: slot.confSum,
      });
    } else {
      agg.clusters.push(cid);
      if (
        photos > agg.bestPhotos ||
        (photos === agg.bestPhotos && slot.confSum > agg.bestConf)
      ) {
        agg.bestCluster = cid;
        agg.bestPhotos = photos;
        agg.bestConf = slot.confSum;
      }
    }
  }

  // Total distinct photos tagged with each bib (for photoShare). Only the bibs
  // we actually assigned need a denominator.
  const bibList = [...byBib.keys()];
  const bibRows = await db.photoBib.findMany({
    where: { bib: { in: bibList }, photo: { eventId, hidden: false } },
    select: { bib: true, photoId: true },
  });
  const totalPhotosByBib = new Map<number, Set<string>>();
  for (const r of bibRows) {
    const set = totalPhotosByBib.get(r.bib) ?? new Set<string>();
    set.add(r.photoId);
    totalPhotosByBib.set(r.bib, set);
  }

  const out = new Map<number, RunnerFace>();
  for (const [bib, agg] of byBib) {
    const sample = bestSample.get(agg.bestCluster)!;
    const total = totalPhotosByBib.get(bib)?.size ?? agg.bestPhotos;
    out.set(bib, {
      faceClusterId: agg.bestCluster,
      sample: { photoId: sample.photoId, faceId: sample.faceId },
      photoCount: agg.bestPhotos,
      photoShare: total > 0 ? agg.bestPhotos / total : 0,
      clusterCount: agg.clusters.length,
    });
  }
  return out;
}

/**
 * Decide whether a bib maps to ONE face confidently enough that we can skip
 * the "Is this you?" question and auto-expand by that cluster.
 *
 * Returns the cluster id only when we're confident there's a single runner
 * behind the bib: exactly one face cluster is geometrically linked to the bib
 * AND that cluster appears in at least `MIN_PHOTOS` distinct photos ("only ever
 * one person … multiple times"). Any ambiguity — multiple clusters linked to
 * the bib, a single-photo sighting, or no geometric links at all (no bib boxes
 * / un-indexed faces) — returns null so the UI falls back to asking.
 *
 * Scoped to one bib and deliberately strict; this is the safe side to err on,
 * since a wrong auto-confirm would silently hide a runner's real photos.
 */
const AUTO_CONFIRM_MIN_PHOTOS = 2;

export async function autoConfirmClusterForBib(
  eventId: string,
  bib: number
): Promise<string | null> {
  // Faces in THIS bib's photos that geometry linked to THIS bib, with a
  // cluster. Mirrors the filter in computeFaceAssignments but bib-scoped.
  const faces = await db.photoFace.findMany({
    where: {
      eventId,
      bib,
      faceClusterId: { not: null },
      photo: { hidden: false },
    },
    select: { photoId: true, faceClusterId: true },
  });
  if (faces.length === 0) return null;

  // cluster → distinct photo set
  const photosByCluster = new Map<string, Set<string>>();
  for (const f of faces) {
    const cid = f.faceClusterId!;
    const set = photosByCluster.get(cid) ?? new Set<string>();
    set.add(f.photoId);
    photosByCluster.set(cid, set);
  }

  // Ambiguous when more than one face cluster is linked to the bib — that's
  // exactly when we should ask rather than guess.
  if (photosByCluster.size !== 1) return null;

  const [[clusterId, photos]] = [...photosByCluster.entries()];
  if (photos.size < AUTO_CONFIRM_MIN_PHOTOS) return null;
  return clusterId;
}
