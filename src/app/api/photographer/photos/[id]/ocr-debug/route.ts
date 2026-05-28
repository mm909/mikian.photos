import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { extractBibsDebug, withDefaults, type OcrSettings } from "@/lib/bibOcr";
import { getEffectiveActor, hasRole, isOwner } from "@/lib/permissions";

/**
 * Debug OCR for one photo — returns the preprocessed image (as a base64 PNG)
 * plus every word Tesseract saw with its bbox + confidence, plus which words
 * passed our bib filter and which got rejected (with reason).
 *
 *   POST /api/photographer/photos/[id]/ocr-debug
 *   body: { settings?: Partial<OcrSettings> }
 *
 * If `settings` is omitted, runs with DEFAULT_OCR_SETTINGS. Any subset of
 * fields can be passed — they merge over the defaults. Used by both the
 * detail-modal "Show OCR intermediates" button (no body) and the OCR Lab
 * page (settings body).
 *
 * Read-only — never writes to the DB.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await getEffectiveActor();
  if (!actor || !hasRole(actor, "photographer")) {
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
  if (photo.photographerId !== actor.photographerId && !isOwner(actor)) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  let body: { settings?: Partial<OcrSettings> } = {};
  try {
    body = (await req.json()) as { settings?: Partial<OcrSettings> };
  } catch {
    /* no body is fine — fall through to defaults */
  }
  const settings = withDefaults(body.settings);

  let bytes: Buffer;
  try {
    const { body: stream } = await r2GetStream(r2Keys.preview(photo.id));
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    bytes = Buffer.concat(chunks);
  } catch (e) {
    return NextResponse.json(
      { error: `preview missing in R2: ${e instanceof Error ? e.message : e}` },
      { status: 400 }
    );
  }

  const debug = await extractBibsDebug(bytes, settings);
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
    settings: debug.settings,
    durationMs: debug.durationMs,
  });
}
