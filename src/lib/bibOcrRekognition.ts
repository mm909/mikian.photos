/**
 * AWS Rekognition `DetectText` provider for the bib-OCR pipeline. Server-only.
 *
 * Why Rekognition: two-stage internally (finds text regions first, then OCRs
 * each), and is significantly more accurate on stylised race-bib fonts than
 * generic Tesseract. ~$1 per 1,000 images at list price; free tier covers
 * 5,000/month for 12 months.
 *
 * Env vars expected:
 *   AWS_REGION                e.g. "us-west-2"
 *   AWS_ACCESS_KEY_ID         IAM user with AmazonRekognitionReadOnlyAccess
 *   AWS_SECRET_ACCESS_KEY
 *
 * If any of those are missing, `rekognitionConfigured()` returns false and
 * the dispatcher in bibOcr.ts falls back to Tesseract — so an unconfigured
 * deploy still works (slowly, with mediocre accuracy).
 *
 * The provider returns the same `OcrDebug` shape as the Tesseract path so the
 * lab visualisation works without changes.
 */
import "server-only";
import sharp from "sharp";
import {
  DetectTextCommand,
  RekognitionClient,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import type {
  BibDetection,
  OcrDebug,
  OcrSettings,
  OcrWord,
} from "./bibOcrTypes";

const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Rekognition caps image bytes at 5MB. Our previews are typically <500KB,
// but if a future preview is bigger we re-encode at lower quality before send.
const MAX_REKOG_BYTES = 5 * 1024 * 1024;

let _client: RekognitionClient | null = null;

export function rekognitionConfigured(): boolean {
  return Boolean(AWS_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY);
}

function client(): RekognitionClient {
  if (_client) return _client;
  if (!rekognitionConfigured()) {
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

function confidenceFloor(digits: number, s: OcrSettings): number {
  if (digits <= 1) return 1;
  if (digits === 2) return s.floor2;
  if (digits === 3) return s.floor3;
  return s.floor4plus;
}

/**
 * Apply the user's preprocessing settings + downscale to keep under
 * Rekognition's 5MB byte limit. Rekognition does its own detection, so the
 * prep here is much lighter than Tesseract's — usually it's enough to just
 * cap dimensions. The contrast/threshold knobs from the lab still apply so
 * the visualisation matches what we sent.
 */
async function prepare(
  input: Buffer,
  s: OcrSettings
): Promise<{ jpeg: Buffer; png: Buffer; width: number; height: number }> {
  let pipe = sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: s.prepWidth, withoutEnlargement: true, fit: "inside" });
  // Optional preprocessing (lab toggles). Defaults are passthrough.
  if (s.sharpen) pipe = pipe.sharpen();
  if (s.normalize) pipe = pipe.normalize();
  if (s.contrastA !== 1 || s.contrastB !== 0) pipe = pipe.linear(s.contrastA, s.contrastB);
  if (s.invert) pipe = pipe.negate();
  if (s.threshold != null) pipe = pipe.threshold(s.threshold);

  // We need two encodings: JPEG for the API (smaller bytes-on-wire) and
  // PNG for the debug overlay (visualisation).
  let jpeg = await pipe.clone().jpeg({ quality: 88 }).toBuffer();
  let quality = 88;
  while (jpeg.length > MAX_REKOG_BYTES && quality > 50) {
    quality -= 10;
    jpeg = await pipe.clone().jpeg({ quality }).toBuffer();
  }
  const png = await pipe.clone().toFormat("png").toBuffer();
  const meta = await sharp(png).metadata();
  return { jpeg, png, width: meta.width ?? s.prepWidth, height: meta.height ?? 0 };
}

/** Convert Rekognition's normalized (0–1) bbox into the prepared image's
 *  pixel coordinates so we can draw it on the overlay. */
function bboxFromGeometry(
  td: TextDetection,
  width: number,
  height: number
): { x0: number; y0: number; x1: number; y1: number } | null {
  const b = td.Geometry?.BoundingBox;
  if (!b || b.Left == null || b.Top == null || b.Width == null || b.Height == null) {
    return null;
  }
  return {
    x0: Math.round(b.Left * width),
    y0: Math.round(b.Top * height),
    x1: Math.round((b.Left + b.Width) * width),
    y1: Math.round((b.Top + b.Height) * height),
  };
}

/**
 * Run Rekognition `DetectText` and return the same OcrDebug shape as the
 * Tesseract path. Always resolves; on failure returns null.
 */
export async function extractBibsDebugRekognition(
  input: Buffer,
  settings: OcrSettings
): Promise<OcrDebug | null> {
  if (!rekognitionConfigured()) return null;

  let prep: { jpeg: Buffer; png: Buffer; width: number; height: number };
  try {
    prep = await prepare(input, settings);
  } catch {
    return null;
  }

  const t0 = Date.now();
  let detections: TextDetection[] = [];
  try {
    const out = await client().send(
      new DetectTextCommand({ Image: { Bytes: prep.jpeg } })
    );
    detections = out.TextDetections ?? [];
  } catch (e) {
    console.warn("Rekognition DetectText failed:", e instanceof Error ? e.message : e);
    return null;
  }
  const durationMs = Date.now() - t0;

  // Build the same word list shape Tesseract produces. Rekognition emits both
  // LINE and WORD detections — we keep WORDs so the bib filter operates on
  // individual numbers (a LINE might glue "3498 3429" into one). Rawtext gets
  // the LINE-level text concatenation for visibility.
  const wordDets = detections.filter((d) => d.Type === "WORD");
  const lineDets = detections.filter((d) => d.Type === "LINE");
  const rawText = lineDets.map((d) => d.DetectedText ?? "").filter(Boolean).join("\n");

  const words: OcrWord[] = [];
  for (const d of wordDets) {
    const text = d.DetectedText ?? "";
    const bbox = bboxFromGeometry(d, prep.width, prep.height);
    if (!text || !bbox || typeof d.Confidence !== "number") continue;
    words.push({ text, confidence: d.Confidence / 100, bbox });
  }

  // Page-confidence proxy: mean line confidence. Rekognition doesn't ship a
  // dedicated page-level number, but the average is a reasonable summary.
  const pageConfidence =
    lineDets.length > 0
      ? lineDets.reduce((s, d) => s + (d.Confidence ?? 0), 0) / lineDets.length / 100
      : 0;

  // Apply the bib filter — same logic as Tesseract. Rekognition often emits
  // tokens like "3498." or "3429,"; we strip non-digits before length-check.
  const bibs: BibDetection[] = [];
  const rejected: { word: OcrWord; reason: string }[] = [];
  const seen = new Map<number, number>();

  for (const w of words) {
    const digits = w.text.replace(/[^0-9]/g, "");
    if (digits.length === 0) continue;
    if (digits.length < settings.minDigits) {
      rejected.push({ word: w, reason: `too short (${digits.length}<${settings.minDigits})` });
      continue;
    }
    if (digits.length > settings.maxDigits) {
      rejected.push({ word: w, reason: `too long (${digits.length}>${settings.maxDigits})` });
      continue;
    }
    const n = Number(digits);
    if (!Number.isFinite(n) || n <= 0) {
      rejected.push({ word: w, reason: "not a positive integer" });
      continue;
    }
    const floor = confidenceFloor(digits.length, settings);
    if (w.confidence < floor) {
      rejected.push({
        word: w,
        reason: `confidence too low for ${digits.length}-digit (${(w.confidence * 100).toFixed(0)}%<${(floor * 100).toFixed(0)}%)`,
      });
      continue;
    }
    const score = w.confidence;
    const prev = seen.get(n);
    if (prev === undefined || score > prev) seen.set(n, score);
  }
  for (const [bib, confidence] of seen) bibs.push({ bib, confidence });
  bibs.sort((a, b) => b.confidence - a.confidence);

  return {
    preparedPng: prep.png,
    preparedWidth: prep.width,
    preparedHeight: prep.height,
    pageConfidence,
    rawText,
    words,
    bibs,
    rejected,
    settings,
    durationMs,
  };
}
