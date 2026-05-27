import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { extractBibsDebug } from "@/lib/bibOcr";
import { getEffectivePhotographerId, isPhotographerUnlocked } from "@/lib/photographerLock";

/**
 * Debug OCR for one photo — returns the preprocessed image (as a base64 PNG)
 * plus every word Tesseract saw with its bbox + confidence, plus which words
 * passed our bib filter and which got rejected (with reason).
 *
 *   POST /api/photographer/photos/[id]/ocr-debug
 *
 * Powers the "Debug OCR" modal in /photographer/photos. NOT for runner-facing
 * traffic — guarded by the photographer auth path (unlock cookie or session).
 *
 * Does NOT write to the DB. This is a read-only inspection tool.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { id: true, photographerId: true },
  });
  if (!photo) return NextResponse.json({ error: "unknown photo" }, { status: 404 });
  if (photo.photographerId !== photographerId && !isPhotographerUnlocked()) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  let bytes: Buffer;
  try {
    const { body } = await r2GetStream(r2Keys.preview(photo.id));
    const chunks: Buffer[] = [];
    for await (const c of body) chunks.push(Buffer.from(c));
    bytes = Buffer.concat(chunks);
  } catch (e) {
    return NextResponse.json(
      { error: `preview missing in R2: ${e instanceof Error ? e.message : e}` },
      { status: 400 }
    );
  }

  const debug = await extractBibsDebug(bytes);
  if (!debug) {
    return NextResponse.json({ error: "ocr failed" }, { status: 500 });
  }

  return NextResponse.json({
    preparedPngBase64: debug.preparedPng.toString("base64"),
    preparedWidth: debug.preparedWidth,
    preparedHeight: debug.preparedHeight,
    pageConfidence: debug.pageConfidence,
    rawText: debug.rawText,
    words: debug.words,
    bibs: debug.bibs,
    rejected: debug.rejected,
  });
}
