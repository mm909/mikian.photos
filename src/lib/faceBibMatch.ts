/**
 * Geometric face ↔ bib matching. Server-only.
 *
 * A runner's bib number sits on the torso, directly below their face. So the
 * face that belongs to a detected bib is the one whose box is (a) horizontally
 * over the bib and (b) a short vertical hop above it. Faces that are far away —
 * a different runner in the same frame, a spectator off to the side — should
 * NOT be linked to that bib.
 *
 * This replaces the old "any face cluster appearing in a photo this bib appears
 * in is a candidate" heuristic, which mis-assigned faces in multi-runner shots.
 *
 * Both face and bib boxes must be in the SAME normalized [0,1] coordinate
 * space (origin top-left). PhotoFace stores boxes that way natively; bib boxes
 * are normalized at OCR time (see bibOcr.ts / bibOcrRekognition.ts).
 */
import "server-only";
import { db } from "./db";

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type FaceInput = { id: string; box: Box };
export type BibInput = { bib: number; box: Box };

/** Max horizontal offset between face center and bib center, measured in face
 *  widths. A bib roughly under the face stays well within ~1.5× the face width
 *  even with arm-swing / camera angle; beyond that it's a different runner. */
const MAX_H_OFFSET = 1.6;

/** The bib must be BELOW the face center by at least this many face heights
 *  (rules out a bib at/above the face — not a torso number) and at most this
 *  many (rules out a bib far down the frame belonging to someone else). A
 *  chest bib typically lands ~1–5 face-heights below the face center. */
const MIN_V_GAP = 0.3;
const MAX_V_GAP = 8.0;

/**
 * Match each face to at most one bib (and each bib to at most one face) using
 * the "face directly above bib" rule. Greedy global nearest-first assignment:
 * the closest valid (face, bib) pair is locked in first, then the next closest
 * among the remaining, and so on. Returns Map<faceId, bib>.
 */
export function matchFacesToBibs(
  faces: FaceInput[],
  bibs: BibInput[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (faces.length === 0 || bibs.length === 0) return result;

  type Cand = { faceId: string; bib: number; cost: number };
  const cands: Cand[] = [];

  for (const f of faces) {
    const fw = Math.max(1e-6, f.box.x1 - f.box.x0);
    const fh = Math.max(1e-6, f.box.y1 - f.box.y0);
    const fcx = (f.box.x0 + f.box.x1) / 2;
    const fcy = (f.box.y0 + f.box.y1) / 2;
    for (const b of bibs) {
      const bcx = (b.box.x0 + b.box.x1) / 2;
      const bcy = (b.box.y0 + b.box.y1) / 2;
      const hoff = Math.abs(fcx - bcx) / fw; // horizontal alignment, in face widths
      const vgap = (bcy - fcy) / fh; // +ve => bib is below the face, in face heights
      if (vgap < MIN_V_GAP || vgap > MAX_V_GAP) continue; // not directly below within range
      if (hoff > MAX_H_OFFSET) continue; // not under the face
      // Prefer well-aligned + closer bibs. Vertical distance is expected to be
      // larger than horizontal, so it's weighted down to avoid dominating.
      const cost = hoff + vgap * 0.25;
      cands.push({ faceId: f.id, bib: b.bib, cost });
    }
  }

  cands.sort((a, b) => a.cost - b.cost);
  const usedFaces = new Set<string>();
  const usedBibs = new Set<number>();
  for (const c of cands) {
    if (usedFaces.has(c.faceId) || usedBibs.has(c.bib)) continue;
    result.set(c.faceId, c.bib);
    usedFaces.add(c.faceId);
    usedBibs.add(c.bib);
  }
  return result;
}

/**
 * Recompute PhotoFace.bib for every face in a photo from the current face +
 * bib boxes, persisting the geometric links. Idempotent — safe to call after
 * any change to the photo's faces or bibs (finalize, rerun-ocr, rerun-faces).
 *
 * Faces with no bib box close enough below them get bib = null. Bibs without a
 * stored box (manual tags, legacy OCR rows) simply don't participate.
 */
export async function linkFacesToBibsForPhoto(photoId: string): Promise<void> {
  const [faces, bibs] = await Promise.all([
    db.photoFace.findMany({
      where: { photoId },
      select: { id: true, x0: true, y0: true, x1: true, y1: true, bib: true },
    }),
    db.photoBib.findMany({
      where: { photoId },
      select: { bib: true, x0: true, y0: true, x1: true, y1: true },
    }),
  ]);
  if (faces.length === 0) return;

  const bibInputs: BibInput[] = bibs
    .filter((b) => b.x0 != null && b.y0 != null && b.x1 != null && b.y1 != null)
    .map((b) => ({
      bib: b.bib,
      box: { x0: b.x0!, y0: b.y0!, x1: b.x1!, y1: b.y1! },
    }));

  const faceInputs: FaceInput[] = faces.map((f) => ({
    id: f.id,
    box: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 },
  }));

  const matches = matchFacesToBibs(faceInputs, bibInputs);

  // Only write rows whose link actually changed — keeps the update set small.
  await Promise.all(
    faces.map((f) => {
      const next = matches.get(f.id) ?? null;
      if (next === f.bib) return Promise.resolve();
      return db.photoFace.update({ where: { id: f.id }, data: { bib: next } });
    })
  );
}
