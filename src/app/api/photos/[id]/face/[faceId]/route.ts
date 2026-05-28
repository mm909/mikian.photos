import { NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream } from "@/lib/r2";

/**
 * Server-side face crop.
 *
 *   GET /api/photos/[id]/face/[faceId]
 *
 * Pulls the photo's preview from R2, crops the face's bounding box (with
 * a small padding so we get a little forehead/chin context), and returns
 * a square-ish JPEG suitable for a 64–128px avatar tile.
 *
 * `faceId` is the PhotoFace row id, NOT the Rekognition FaceId — internal
 * cuid keeps URLs short and lets us join via a primary-key lookup.
 *
 * Faces are immutable per (photoId, faceId), so we send the same
 * long-lived cache headers the preview route uses. A new run-faces pass
 * deletes + re-creates rows, generating new ids; the old URLs naturally
 * drop out of the cache.
 *
 * The output is always a 256x256 JPEG with face centered. We don't expose
 * the raw bbox crop because crops vary wildly in aspect ratio and we want
 * the candidate strip to look like uniform tiles.
 */
export const runtime = "nodejs";

/** Output size of the cropped face thumbnail (square). */
const THUMB_SIZE = 256;

/** Padding around the bbox before cropping, as a fraction of the bbox's
 *  longer edge. Rekognition's bbox tightly hugs the face — without padding
 *  the crops feel claustrophobic and identification gets harder. */
const PAD_RATIO = 0.35;

export async function GET(
  _req: Request,
  { params }: { params: { id: string; faceId: string } }
) {
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  // Join PhotoFace → Photo so we can verify hidden state + get the R2 key.
  const face = await db.photoFace.findUnique({
    where: { id: params.faceId },
    select: {
      photoId: true,
      x0: true,
      y0: true,
      x1: true,
      y1: true,
      photo: { select: { hidden: true, r2PreviewKey: true } },
    },
  });

  if (!face) return new NextResponse("Not found", { status: 404 });
  // The face must belong to the photo in the URL — defends against
  // someone trying to scrape faces across photos via id manipulation.
  if (face.photoId !== params.id) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!face.photo || face.photo.hidden) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Pull preview bytes.
  let previewBytes: Buffer;
  try {
    const { body } = await r2GetStream(face.photo.r2PreviewKey);
    const chunks: Buffer[] = [];
    for await (const c of body) chunks.push(Buffer.from(c));
    previewBytes = Buffer.concat(chunks);
  } catch (e) {
    return NextResponse.json(
      { error: `preview missing in R2: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }

  // Sharp pipeline: read dimensions, compute padded square crop in pixel
  // space, then extract + resize to THUMB_SIZE.
  let img = sharp(previewBytes, { failOn: "none" }).rotate(); // honor EXIF
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) {
    return NextResponse.json({ error: "preview missing dimensions" }, { status: 500 });
  }

  // Bbox is normalized 0-1 (Rekognition's native space). Convert.
  const bx0 = face.x0 * W;
  const by0 = face.y0 * H;
  const bx1 = face.x1 * W;
  const by1 = face.y1 * H;
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  const longEdge = Math.max(bw, bh);
  const pad = longEdge * PAD_RATIO;

  // Square crop centered on the bbox's center, side = longEdge + 2*pad.
  const cx = bx0 + bw / 2;
  const cy = by0 + bh / 2;
  const side = longEdge + pad * 2;

  // Clamp to image bounds. When the bbox is near an edge we may end up
  // with a non-square crop — sharp's resize with "cover" handles that.
  const left = Math.max(0, Math.round(cx - side / 2));
  const top = Math.max(0, Math.round(cy - side / 2));
  const right = Math.min(W, Math.round(cx + side / 2));
  const bottom = Math.min(H, Math.round(cy + side / 2));
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return NextResponse.json({ error: "invalid bbox" }, { status: 500 });
  }

  let jpeg: Buffer;
  try {
    jpeg = await img
      .extract({ left, top, width, height })
      .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (e) {
    return NextResponse.json(
      { error: `crop failed: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }

  // NextResponse's BodyInit doesn't accept a Buffer directly in newer
  // Next.js typings; wrap in Uint8Array (zero-copy view of the same bytes).
  return new NextResponse(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      // Immutable per face row id; the user can refresh forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(jpeg.length),
    },
  });
}
