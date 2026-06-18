/**
 * Camp color groups. Server-only.
 *
 * Camps split kids into "color groups" — usually a team T-shirt color (blue,
 * green, lavender, …). We detect a person's group automatically: sample the
 * shirt color from the torso region directly below their detected face, then
 * snap it to the nearest anchor in DEFAULT_CAMP_PALETTE. No manual setup — the
 * palette lives in code (the owner can rename the resulting groups later via
 * Event.colorGroupLabels; an editor is deferred).
 *
 * Pipeline (one photo):
 *   detection pass → indexFacesForPhoto writes PhotoFace boxes
 *     → detectColorGroupsForPhoto()
 *        → for each face: sampleTorsoColor() → classifyColor() → PhotoFace.colorGroup
 *        → roll the distinct groups up into PhotoColorGroup rows (the per-photo
 *          "color groups in this photo" list the camp face search expands by)
 *
 * The classification is a deliberate, informed *guess*: solid camp tees in good
 * daylight cluster tightly in Lab space, but a face cluster's authoritative
 * group is the statistical MODE of this per-face value across all their photos
 * (see clusterColorGroup), which averages out a few bad samples (shadow, a
 * jacket, a logo). That mode is what we expand the search by.
 */
import "server-only";
import sharp from "sharp";
import { db } from "./db";

export type Rgb = { r: number; g: number; b: number };

export type PaletteColor = {
  /** Stable key stored on rows + used in URLs (lowercase, no spaces). */
  key: string;
  /** Default human label. Overridable per-event via Event.colorGroupLabels. */
  label: string;
  rgb: Rgb;
};

/**
 * Built-in anchor palette for camp shirts. Chosen to span the colors camps
 * actually use; near-neutral anchors (white/gray/black) catch staff/plain tees
 * so they don't get mis-snapped onto a vivid team color. Tuned in sRGB for
 * mid-tone fabric under daylight.
 */
export const DEFAULT_CAMP_PALETTE: PaletteColor[] = [
  { key: "red", label: "Red", rgb: { r: 196, g: 48, b: 48 } },
  { key: "orange", label: "Orange", rgb: { r: 226, g: 120, b: 38 } },
  { key: "yellow", label: "Yellow", rgb: { r: 232, g: 200, b: 60 } },
  { key: "green", label: "Green", rgb: { r: 64, g: 150, b: 78 } },
  { key: "teal", label: "Teal", rgb: { r: 38, g: 150, b: 148 } },
  { key: "blue", label: "Blue", rgb: { r: 58, g: 110, b: 198 } },
  { key: "lavender", label: "Lavender", rgb: { r: 156, g: 142, b: 210 } },
  { key: "purple", label: "Purple", rgb: { r: 112, g: 64, b: 160 } },
  { key: "pink", label: "Pink", rgb: { r: 224, g: 122, b: 168 } },
  { key: "white", label: "White", rgb: { r: 234, g: 234, b: 232 } },
  { key: "gray", label: "Gray", rgb: { r: 132, g: 132, b: 134 } },
  { key: "black", label: "Black", rgb: { r: 38, g: 38, b: 40 } },
  { key: "brown", label: "Brown", rgb: { r: 122, g: 84, b: 52 } },
];

/**
 * Max Lab ΔE (CIE76) between a sample and its nearest anchor for the match to
 * count. Solid tees land well under this; samples beyond it (busy background
 * bleed, deep shade) are dropped as inconclusive (colorGroup = null) rather
 * than forced onto a wrong anchor.
 */
const MAX_MATCH_DELTA_E = 55;

/* --- Color space ----------------------------------------------------------
 * sRGB → linear → XYZ (D65) → Lab. CIE76 ΔE is plenty here — we're snapping to
 * a dozen well-separated anchors, not doing perceptual fine-grading. */

type Lab = { L: number; a: number; b: number };

function srgbChannelToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function rgbToLab({ r, g, b }: Rgb): Lab {
  const rl = srgbChannelToLinear(r);
  const gl = srgbChannelToLinear(g);
  const bl = srgbChannelToLinear(b);
  // Linear sRGB → XYZ (D65)
  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function deltaE(p: Lab, q: Lab): number {
  return Math.sqrt((p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2);
}

// Anchor Labs precomputed once.
const PALETTE_LAB: { color: PaletteColor; lab: Lab }[] = DEFAULT_CAMP_PALETTE.map(
  (color) => ({ color, lab: rgbToLab(color.rgb) })
);

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Snap a sampled color to the nearest palette anchor. Returns null when nothing
 * is close enough (ΔE > MAX_MATCH_DELTA_E) — better an unknown than a wrong team.
 */
export function classifyColor(rgb: Rgb): { key: string; label: string; distance: number } | null {
  const lab = rgbToLab(rgb);
  let best: { color: PaletteColor; distance: number } | null = null;
  for (const { color, lab: anchor } of PALETTE_LAB) {
    const d = deltaE(lab, anchor);
    if (!best || d < best.distance) best = { color, distance: d };
  }
  if (!best || best.distance > MAX_MATCH_DELTA_E) return null;
  return { key: best.color.key, label: best.color.label, distance: best.distance };
}

/** Resolve a group key to its display label, honoring a per-event rename map. */
export function colorGroupLabel(key: string, labels?: Record<string, string> | null): string {
  const override = labels && typeof labels[key] === "string" ? labels[key] : null;
  if (override) return override;
  const anchor = DEFAULT_CAMP_PALETTE.find((c) => c.key === key);
  return anchor?.label ?? key;
}

/* --- Torso sampling -------------------------------------------------------- */

type FaceBox = { x0: number; y0: number; x1: number; y1: number };

/**
 * Compute the torso sampling rectangle (chest area) from a normalized face box.
 * The shirt sits below the chin, horizontally centered on the face. Returns a
 * pixel rect clamped to the image, or null when there's no room below the face
 * (face at the very bottom of the frame).
 */
function torsoRect(
  box: FaceBox,
  imgW: number,
  imgH: number
): { left: number; top: number; width: number; height: number } | null {
  const faceW = (box.x1 - box.x0) * imgW;
  const faceH = (box.y1 - box.y0) * imgH;
  if (faceW < 4 || faceH < 4) return null;
  const fcx = ((box.x0 + box.x1) / 2) * imgW;
  const faceBottom = box.y1 * imgH;

  // Chest band: just below the chin (0.25 face-heights) down to ~2.0 below it.
  const top = faceBottom + faceH * 0.25;
  const bottom = faceBottom + faceH * 2.0;
  const halfW = faceW * 0.6; // torso ~1.2× face width, centered on the face
  let left = Math.round(fcx - halfW);
  let right = Math.round(fcx + halfW);
  let t = Math.round(top);
  let bot = Math.round(bottom);

  left = Math.max(0, Math.min(left, imgW - 1));
  right = Math.max(0, Math.min(right, imgW));
  t = Math.max(0, Math.min(t, imgH - 1));
  bot = Math.max(0, Math.min(bot, imgH));

  const width = right - left;
  const height = bot - t;
  if (width < 4 || height < 4) return null;
  return { left, top: t, width, height };
}

/**
 * Robust dominant color of an RGB patch: drop the brightest and darkest ~25%
 * of pixels by luma (specular highlights, deep shadow, dark logo text) and
 * average the middle. Returns null if too few pixels survive.
 */
function robustAverage(raw: Buffer, channels: number): Rgb | null {
  const px: { r: number; g: number; b: number; luma: number }[] = [];
  for (let i = 0; i + channels - 1 < raw.length; i += channels) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    px.push({ r, g, b, luma: 0.299 * r + 0.587 * g + 0.114 * b });
  }
  if (px.length < 4) return null;
  px.sort((a, b) => a.luma - b.luma);
  const lo = Math.floor(px.length * 0.25);
  const hi = Math.ceil(px.length * 0.75);
  const mid = px.slice(lo, hi);
  const use = mid.length > 0 ? mid : px;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of use) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  return { r: r / use.length, g: g / use.length, b: b / use.length };
}

/**
 * Sample the shirt color for one face from a decoded image. `rotatedBuf` must
 * already be EXIF-rotated (so its pixel space matches the normalized face boxes
 * Rekognition produced — IndexFaces sees the .rotate()'d bytes). Resizes the
 * torso patch down to smooth out fabric texture/print before averaging.
 */
async function sampleTorsoColor(
  rotatedBuf: Buffer,
  imgW: number,
  imgH: number,
  box: FaceBox
): Promise<Rgb | null> {
  const rect = torsoRect(box, imgW, imgH);
  if (!rect) return null;
  try {
    const { data, info } = await sharp(rotatedBuf)
      .extract(rect)
      .resize(16, 16, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return robustAverage(data, info.channels);
  } catch {
    return null;
  }
}

/* --- Orchestration --------------------------------------------------------- */

/**
 * Detect + persist color groups for one photo. Idempotent: recomputes every
 * face's PhotoFace.colorGroup and rebuilds the photo's PhotoColorGroup rows
 * from scratch, so it's safe to re-run after a re-index. No-op when the photo
 * has no faces. Best-effort — never throws (callers run it inside a try/catch
 * anyway); returns the distinct groups found.
 */
export async function detectColorGroupsForPhoto(opts: {
  photoId: string;
  eventId: string;
  previewBytes: Buffer;
}): Promise<{ groups: string[] }> {
  const { photoId, eventId, previewBytes } = opts;

  const faces = await db.photoFace.findMany({
    where: { photoId },
    select: { id: true, x0: true, y0: true, x1: true, y1: true },
  });
  if (faces.length === 0) {
    // No faces → no groups. Clear any stale rows from a prior pass.
    await db.photoColorGroup.deleteMany({ where: { photoId } }).catch(() => {});
    return { groups: [] };
  }

  // Decode + EXIF-rotate once so the pixel space matches the normalized boxes.
  let rotated: { data: Buffer; width: number; height: number };
  try {
    const out = await sharp(previewBytes).rotate().toBuffer({ resolveWithObject: true });
    rotated = { data: out.data, width: out.info.width, height: out.info.height };
  } catch {
    return { groups: [] };
  }

  // Sample + classify each face.
  const perFace = await Promise.all(
    faces.map(async (f) => {
      const rgb = await sampleTorsoColor(rotated.data, rotated.width, rotated.height, {
        x0: f.x0,
        y0: f.y0,
        x1: f.x1,
        y1: f.y1,
      });
      const match = rgb ? classifyColor(rgb) : null;
      return {
        faceId: f.id,
        colorGroup: match?.key ?? null,
        colorHex: rgb ? rgbToHex(rgb) : null,
      };
    })
  );

  // Persist per-face colors.
  await Promise.all(
    perFace.map((p) =>
      db.photoFace
        .update({
          where: { id: p.faceId },
          data: { colorGroup: p.colorGroup, colorHex: p.colorHex },
        })
        .catch(() => {})
    )
  );

  // Roll up the distinct groups (with per-group people count) into the
  // per-photo list, replacing whatever was there before.
  const counts = new Map<string, number>();
  for (const p of perFace) {
    if (p.colorGroup) counts.set(p.colorGroup, (counts.get(p.colorGroup) ?? 0) + 1);
  }
  await db.photoColorGroup.deleteMany({ where: { photoId } }).catch(() => {});
  if (counts.size > 0) {
    await db.photoColorGroup
      .createMany({
        data: [...counts.entries()].map(([colorGroup, count]) => ({
          photoId,
          eventId,
          colorGroup,
          count,
          source: "auto",
        })),
        skipDuplicates: true,
      })
      .catch(() => {});
  }

  return { groups: [...counts.keys()] };
}

/**
 * The statistical-mode color group for a set of face clusters in an event —
 * the "informed guess" at a person's team. Looks at every PhotoFace in the
 * given clusters with a non-null colorGroup and returns the most common one
 * (ties broken by total count). Null when the clusters have no color samples.
 */
export async function clusterColorGroup(
  eventId: string,
  faceClusterIds: string[]
): Promise<string | null> {
  const ids = faceClusterIds.filter(Boolean);
  if (ids.length === 0) return null;
  const rows = await db.photoFace.groupBy({
    by: ["colorGroup"],
    where: { eventId, faceClusterId: { in: ids }, colorGroup: { not: null } },
    _count: { colorGroup: true },
  });
  if (rows.length === 0) return null;
  let best: { group: string; count: number } | null = null;
  for (const r of rows) {
    if (!r.colorGroup) continue;
    const count = r._count.colorGroup;
    if (!best || count > best.count) best = { group: r.colorGroup, count };
  }
  return best?.group ?? null;
}
