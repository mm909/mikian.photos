/**
 * AWS Rekognition face-matching wrapper. Server-only.
 *
 * Flow:
 *   Upload finalize → indexFacesForPhoto()
 *      → IndexFaces against an event-scoped collection
 *      → for each detected FaceRecord, insert a PhotoFace row carrying
 *        the Rekognition FaceId (so we can SearchFacesByImage later) plus
 *        the bbox + confidence (so the coverage screen + future overlay
 *        can render).
 *
 *   Runner face search → searchFacesByImage()
 *      → SearchFacesByImage against the event collection with the buyer's
 *        selfie → returns matched FaceIds + similarity
 *      → join PhotoFace by rekognitionFaceId → photoIds
 *
 *   Photo delete → deleteFacesForPhoto()
 *      → DeleteFaces with the photo's FaceIds, then PhotoFace cascade
 *        removes the DB rows when Photo itself is deleted.
 *
 * Cost guardrail: IndexFaces is billed per face detected (up to MaxFaces).
 * We cap at MAX_FACES_PER_PHOTO so a packed crowd shot doesn't dump 60
 * faces into the collection at $0.001 each — still cheap, but unbounded
 * is a footgun.
 *
 * Env vars (shared with bibOcrRekognition):
 *   AWS_REGION
 *   AWS_ACCESS_KEY_ID            IAM user needs rekognition:* on this
 *                                account's collections (the Rekognition
 *                                read-only policy is NOT enough — it omits
 *                                IndexFaces / CreateCollection / DeleteFaces).
 *   AWS_SECRET_ACCESS_KEY
 *   REKOGNITION_COLLECTION_PREFIX  optional, defaults to "mikian-photos"
 *
 * If creds are missing, `faceRecConfigured()` returns false and callers
 * are expected to skip silently — same pattern as bibOcrRekognition.
 */
import "server-only";
import sharp from "sharp";
import {
  CreateCollectionCommand,
  DeleteCollectionCommand,
  DeleteFacesCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
  SearchFacesCommand,
  type FaceRecord,
  type FaceMatch,
} from "@aws-sdk/client-rekognition";
import { db } from "./db";

const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const COLLECTION_PREFIX =
  process.env.REKOGNITION_COLLECTION_PREFIX || "mikian-photos";

/** Cap on faces returned per IndexFaces call. Race photos rarely have more
 *  than ~10 visible faces; 15 leaves headroom without unbounded cost. */
const MAX_FACES_PER_PHOTO = 15;

/** Rekognition's per-image byte cap (Bytes-mode). */
const MAX_REKOG_BYTES = 5 * 1024 * 1024;

/** Similarity threshold (0–100) below which SearchFacesByImage matches are
 *  dropped. 80 is Rekognition's documented default; lower → more matches,
 *  more false positives. Tunable later if recall is too low. */
const FACE_MATCH_THRESHOLD = 80;

/** Tighter threshold for *clustering* (linking the same runner across
 *  multiple race photos). False positives here merge two different
 *  runners into one cluster — much worse than missing a link — so we
 *  err high: 92% similarity. */
const CLUSTER_MATCH_THRESHOLD = 92;

/** Max faces SearchFacesByImage returns per query. Race buyers usually
 *  appear in ≤ a few dozen photos; cap keeps response sizes sane. */
const SEARCH_MAX_FACES = 100;

/** Max related faces returned per per-face SearchFaces during clustering.
 *  Higher → more transitive cluster merging in one pass; we cap at 50 to
 *  bound the API cost per upload (15 faces × 50 matches → 750 records). */
const CLUSTER_MAX_NEIGHBORS = 50;

let _client: RekognitionClient | null = null;
/** Cached per-process — once a collection exists we don't re-check. */
const ensuredCollections = new Set<string>();

export function faceRecConfigured(): boolean {
  return Boolean(AWS_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY);
}

function client(): RekognitionClient {
  if (_client) return _client;
  if (!faceRecConfigured()) {
    throw new Error(
      "Rekognition credentials missing — set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    );
  }
  _client = new RekognitionClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID!,
      secretAccessKey: AWS_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

/** One collection per event. Names must match `[a-zA-Z0-9_.\-]+`. */
export function collectionIdFor(eventId: string): string {
  const safe = eventId.replace(/[^a-zA-Z0-9_.\-]/g, "_");
  return `${COLLECTION_PREFIX}_${safe}`;
}

/** Create the per-event Rekognition collection if it doesn't exist yet.
 *  Swallows ResourceAlreadyExists — that's the happy path on rerun. */
export async function ensureCollection(eventId: string): Promise<void> {
  const id = collectionIdFor(eventId);
  if (ensuredCollections.has(id)) return;
  try {
    await client().send(new CreateCollectionCommand({ CollectionId: id }));
  } catch (e: unknown) {
    const name = (e as { name?: string }).name;
    // ResourceAlreadyExistsException — collection exists, that's fine.
    if (name !== "ResourceAlreadyExistsException") throw e;
  }
  ensuredCollections.add(id);
}

/**
 * Delete an event's entire Rekognition collection (all of its indexed faces in
 * one call) — used when an event is deleted. Swallows ResourceNotFoundException
 * (already gone / never created) and only warns on other failures so a
 * Rekognition hiccup can't strand the event delete. Clears the per-process
 * ensured-collection cache so a future event with the same id re-creates it.
 */
export async function deleteCollectionForEvent(eventId: string): Promise<void> {
  if (!faceRecConfigured()) return;
  const id = collectionIdFor(eventId);
  try {
    await client().send(new DeleteCollectionCommand({ CollectionId: id }));
  } catch (e: unknown) {
    const name = (e as { name?: string }).name;
    if (name !== "ResourceNotFoundException") {
      console.warn(
        `DeleteCollection failed for event ${eventId} (orphan collection may remain):`,
        e instanceof Error ? e.message : e
      );
    }
  }
  ensuredCollections.delete(id);
}

/** Resize + re-encode an image to fit Rekognition's byte cap. JPEG quality
 *  drops in steps until we're under 5MB. Returns the bytes ready to send. */
async function prepareImageBytes(input: Buffer): Promise<Buffer> {
  const pipe = sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true, fit: "inside" });
  let out = await pipe.clone().jpeg({ quality: 90 }).toBuffer();
  let q = 90;
  while (out.length > MAX_REKOG_BYTES && q > 50) {
    q -= 10;
    out = await pipe.clone().jpeg({ quality: q }).toBuffer();
  }
  return out;
}

export type IndexedFace = {
  rekognitionFaceId: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number }; // normalized 0-1
};

/**
 * For each new FaceId, run SearchFaces against the collection and decide
 * which cluster it joins. Returns a Map<rekognitionFaceId → faceClusterId>.
 *
 * Cluster rules:
 *   - When SearchFaces returns no neighbors → new face is its own cluster
 *     (clusterId = the FaceId itself).
 *   - When neighbors exist → canonical clusterId is the lexicographically
 *     smallest among the new FaceId AND every cluster id of the matched
 *     neighbors. Lexicographic is arbitrary but stable — UUIDv4 means we
 *     don't bias toward older/newer entries.
 *   - Any *existing* PhotoFace rows whose faceClusterId disagrees with
 *     the new canonical get updated to it (cluster merge across photos).
 *
 * If SearchFaces fails for a particular face (transient AWS hiccup, etc.)
 * we fall back to "own cluster" and move on — better than blocking the
 * whole upload over a non-critical refinement.
 */
async function assignClusters(opts: {
  eventId: string;
  newFaces: { rekognitionFaceId: string }[];
}): Promise<Map<string, string>> {
  const { eventId, newFaces } = opts;
  const out = new Map<string, string>();
  if (newFaces.length === 0) return out;

  const collectionId = collectionIdFor(eventId);

  for (const f of newFaces) {
    let matches: FaceMatch[] = [];
    try {
      const res = await client().send(
        new SearchFacesCommand({
          CollectionId: collectionId,
          FaceId: f.rekognitionFaceId,
          FaceMatchThreshold: CLUSTER_MATCH_THRESHOLD,
          MaxFaces: CLUSTER_MAX_NEIGHBORS,
        })
      );
      matches = res.FaceMatches ?? [];
    } catch (e) {
      // Don't fail the whole index over a clustering miss. The face still
      // gets stored as a singleton cluster; a future rerun-faces or
      // batch-recluster job can refine.
      console.warn(
        `SearchFaces failed during clustering for ${f.rekognitionFaceId}:`,
        e instanceof Error ? e.message : e
      );
      out.set(f.rekognitionFaceId, f.rekognitionFaceId);
      continue;
    }

    if (matches.length === 0) {
      out.set(f.rekognitionFaceId, f.rekognitionFaceId);
      continue;
    }

    const neighborFaceIds = matches
      .map((m) => m.Face?.FaceId)
      .filter((x): x is string => !!x);

    // Look up the *existing* cluster ids of the neighbors so we can pick a
    // canonical that's consistent with prior decisions.
    const existing =
      neighborFaceIds.length > 0
        ? await db.photoFace.findMany({
            where: { rekognitionFaceId: { in: neighborFaceIds }, eventId },
            select: { faceClusterId: true },
          })
        : [];
    const existingClusterIds = existing
      .map((r) => r.faceClusterId)
      .filter((x): x is string => !!x);

    const candidates = [f.rekognitionFaceId, ...existingClusterIds];
    candidates.sort();
    const canonical = candidates[0];
    out.set(f.rekognitionFaceId, canonical);

    // Merge any conflicting prior clusters into the canonical. This is
    // what makes clustering converge as more photos come in: two clusters
    // that turn out to be the same person get unified the first time a
    // new face crosses both.
    const conflicting = [...new Set(existingClusterIds)].filter(
      (c) => c !== canonical
    );
    if (conflicting.length > 0) {
      await db.photoFace.updateMany({
        where: { faceClusterId: { in: conflicting }, eventId },
        data: { faceClusterId: canonical },
      });
    }
  }

  return out;
}

/**
 * Index every face in `bytes` into the event's collection and write a
 * PhotoFace row per result. Sets Photo.facesIndexedAt on success.
 *
 * Idempotent-ish: if the photo already has PhotoFace rows we delete + re-
 * insert (and DeleteFaces the old Rekognition entries) so the runner-facing
 * collection doesn't accumulate duplicates across reruns.
 */
export async function indexFacesForPhoto(opts: {
  photoId: string;
  eventId: string;
  bytes: Buffer;
  /** Pass true to force a re-index even if facesIndexedAt is set. */
  force?: boolean;
}): Promise<IndexedFace[]> {
  if (!faceRecConfigured()) return [];

  const { photoId, eventId, bytes, force = false } = opts;

  // Skip if already indexed unless forced.
  if (!force) {
    const photo = await db.photo.findUnique({
      where: { id: photoId },
      select: { facesIndexedAt: true },
    });
    if (photo?.facesIndexedAt) return [];
  }

  await ensureCollection(eventId);

  // For a forced re-index, capture the prior Rekognition FaceIds but do NOT
  // delete them yet — we retire them only AFTER a successful IndexFaces below.
  // Deleting first and then failing (a transient Rekognition throttle/5xx)
  // would strand the photo with zero faces but a still-set facesIndexedAt,
  // which the dead-photo backfill skips — i.e. permanent, invisible face loss.
  let priorFaceIds: string[] = [];
  if (force) {
    const prior = await db.photoFace.findMany({
      where: { photoId, rekognitionFaceId: { not: null } },
      select: { rekognitionFaceId: true },
    });
    priorFaceIds = prior
      .map((r) => r.rekognitionFaceId)
      .filter((x): x is string => Boolean(x));
  }

  const collectionId = collectionIdFor(eventId);
  const prepared = await prepareImageBytes(bytes);

  let records: FaceRecord[] = [];
  try {
    const out = await client().send(
      new IndexFacesCommand({
        CollectionId: collectionId,
        Image: { Bytes: prepared },
        // Tag the indexed face with the photo id so we can recover it from
        // Rekognition console / list-faces without our DB if needed.
        ExternalImageId: photoId,
        MaxFaces: MAX_FACES_PER_PHOTO,
        // "AUTO" trims low-quality detections (blurry, off-angle, partially
        // occluded) — saves dollars and reduces false-positive matches.
        QualityFilter: "AUTO",
        DetectionAttributes: ["DEFAULT"],
      })
    );
    records = out.FaceRecords ?? [];
  } catch (e) {
    console.warn(
      `IndexFaces failed for photo ${photoId}:`,
      e instanceof Error ? e.message : e
    );
    // Non-destructive: we never touched the prior faces, so the existing data
    // remains valid. For a forced re-index, surface the failure so a bulk
    // re-run can count it rather than report the photo as silently "processed".
    if (force) throw e instanceof Error ? e : new Error(String(e));
    return [];
  }

  const indexed: IndexedFace[] = [];
  for (const r of records) {
    const faceId = r.Face?.FaceId;
    const confidence = r.Face?.Confidence;
    const b = r.Face?.BoundingBox;
    if (!faceId || confidence == null || !b) continue;
    if (b.Left == null || b.Top == null || b.Width == null || b.Height == null) continue;
    indexed.push({
      rekognitionFaceId: faceId,
      confidence: confidence / 100,
      bbox: {
        x0: b.Left,
        y0: b.Top,
        x1: b.Left + b.Width,
        y1: b.Top + b.Height,
      },
    });
  }

  // Cluster each new face into an existing group (same runner across
  // multiple photos) before writing rows, so the bib↔face cross-link
  // works in one pass without a separate clustering job. See
  // assignClusters below for the merging rules.
  const clusterAssignments = await assignClusters({
    eventId,
    newFaces: indexed.map((f) => ({ rekognitionFaceId: f.rekognitionFaceId })),
  });

  // IndexFaces succeeded — now it's safe to retire the prior faces (Rekognition
  // entries + DB rows) before writing the fresh ones. Clustering above ran with
  // the prior faces still present, which actually helps continuity (the new
  // face matches its own prior index). Only reached on success, so a failed
  // re-index can never destroy the existing faces.
  if (force) {
    if (priorFaceIds.length > 0) {
      try {
        await client().send(
          new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: priorFaceIds })
        );
      } catch (e) {
        console.warn(
          `DeleteFaces (prior) failed for photo ${photoId} (orphans may remain):`,
          e instanceof Error ? e.message : e
        );
      }
    }
    await db.photoFace.deleteMany({ where: { photoId } });
  }

  if (indexed.length > 0) {
    await db.photoFace.createMany({
      data: indexed.map((f) => ({
        photoId,
        eventId,
        rekognitionFaceId: f.rekognitionFaceId,
        faceClusterId:
          clusterAssignments.get(f.rekognitionFaceId) ?? f.rekognitionFaceId,
        confidence: f.confidence,
        x0: f.bbox.x0,
        y0: f.bbox.y0,
        x1: f.bbox.x1,
        y1: f.bbox.y1,
        source: "rekognition",
      })),
      skipDuplicates: true,
    });
  }

  await db.photo.update({
    where: { id: photoId },
    data: { facesIndexedAt: new Date() },
  });

  return indexed;
}

export type FaceSearchResult = {
  photoId: string;
  similarity: number; // 0-100
  rekognitionFaceId: string;
};

/**
 * Find photos in `eventId`'s collection that match a face in `selfieBytes`.
 * Picks the largest face in the selfie (Rekognition's default) and returns
 * matches above FACE_MATCH_THRESHOLD, joined back to our PhotoFace rows.
 *
 * Returns matches in descending similarity order, deduplicated by photoId
 * (the same photo may match multiple FaceIds — we keep the best similarity
 * per photo).
 */
export async function searchFacesByImage(opts: {
  eventId: string;
  selfieBytes: Buffer;
}): Promise<FaceSearchResult[]> {
  if (!faceRecConfigured()) return [];

  const { eventId, selfieBytes } = opts;
  await ensureCollection(eventId);

  const collectionId = collectionIdFor(eventId);
  const prepared = await prepareImageBytes(selfieBytes);

  let matches: FaceMatch[] = [];
  try {
    const out = await client().send(
      new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { Bytes: prepared },
        FaceMatchThreshold: FACE_MATCH_THRESHOLD,
        MaxFaces: SEARCH_MAX_FACES,
        QualityFilter: "AUTO",
      })
    );
    matches = out.FaceMatches ?? [];
  } catch (e) {
    const name = (e as { name?: string }).name;
    // "InvalidParameterException — no faces in the image" is the common
    // case when the buyer uploads a blurry selfie. Surface as empty
    // results rather than 500.
    if (name === "InvalidParameterException") return [];
    console.warn(
      `SearchFacesByImage failed for event ${eventId}:`,
      e instanceof Error ? e.message : e
    );
    return [];
  }

  if (matches.length === 0) return [];

  // Map Rekognition FaceIds → photoIds via our DB.
  const faceIds = matches
    .map((m) => m.Face?.FaceId)
    .filter((x): x is string => !!x);
  const rows = await db.photoFace.findMany({
    where: { rekognitionFaceId: { in: faceIds }, eventId },
    select: { photoId: true, rekognitionFaceId: true },
  });
  const photoIdByFaceId = new Map<string, string>();
  for (const r of rows) {
    if (r.rekognitionFaceId) photoIdByFaceId.set(r.rekognitionFaceId, r.photoId);
  }

  // Best similarity per photoId.
  const bestByPhoto = new Map<string, FaceSearchResult>();
  for (const m of matches) {
    const fid = m.Face?.FaceId;
    const sim = m.Similarity;
    if (!fid || sim == null) continue;
    const photoId = photoIdByFaceId.get(fid);
    if (!photoId) continue; // Face exists in Rekognition but we don't track it (orphan)
    const prev = bestByPhoto.get(photoId);
    if (!prev || sim > prev.similarity) {
      bestByPhoto.set(photoId, { photoId, similarity: sim, rekognitionFaceId: fid });
    }
  }

  return [...bestByPhoto.values()].sort((a, b) => b.similarity - a.similarity);
}

/**
 * Delete every face for `photoId` from Rekognition's collection. Safe to
 * call when the photo has no faces (no-op). Doesn't touch PhotoFace DB
 * rows — those go away via the `onDelete: Cascade` on Photo, or via the
 * deleteMany in the rerun-faces path.
 */
export async function deleteFacesForPhoto(opts: {
  photoId: string;
  eventId: string;
}): Promise<void> {
  if (!faceRecConfigured()) return;

  const { photoId, eventId } = opts;
  const rows = await db.photoFace.findMany({
    where: { photoId, rekognitionFaceId: { not: null } },
    select: { rekognitionFaceId: true },
  });
  const faceIds = rows
    .map((r) => r.rekognitionFaceId)
    .filter((x): x is string => !!x);
  if (faceIds.length === 0) return;

  try {
    await client().send(
      new DeleteFacesCommand({
        CollectionId: collectionIdFor(eventId),
        FaceIds: faceIds,
      })
    );
  } catch (e) {
    // Don't block deletion over a Rekognition hiccup — orphan FaceIds
    // are harmless (no PhotoFace row → no photoId lookup → no match).
    console.warn(
      `DeleteFaces failed for photo ${photoId} (orphans may remain):`,
      e instanceof Error ? e.message : e
    );
  }

  // Drop our DB rows too. (For the rerun-faces path; the cascade handles
  // the photo-delete path.)
  await db.photoFace.deleteMany({ where: { photoId } });
}
