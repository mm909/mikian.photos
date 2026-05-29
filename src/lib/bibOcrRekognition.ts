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
  if (digits <= 0) return 1;
  if (digits === 1) return s.floor1;
  if (digits === 2) return s.floor2;
  if (digits === 3) return s.floor3;
  return s.floor4plus;
}

/** Convert a pixel-space word box into normalized [0,1] coordinates (same
 *  space as PhotoFace boxes). Returns undefined for degenerate dimensions. */
function normalizeBox(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number
): { x0: number; y0: number; x1: number; y1: number } | undefined {
  if (!(width > 0) || !(height > 0)) return undefined;
  return {
    x0: bbox.x0 / width,
    y0: bbox.y0 / height,
    x1: bbox.x1 / width,
    y1: bbox.y1 / height,
  };
}

/**
 * Minimal prep for Rekognition: orient via EXIF + downscale enough to fit
 * under the 5MB byte cap. **No grayscale, sharpen, contrast, threshold, or
 * negate** — Rekognition is trained on real-world colour photos and
 * preprocessing generally hurts accuracy rather than helps. The lab UI
 * hides those toggles when this provider is selected.
 *
 * Only `prepWidth` from settings applies (caps the long edge for byte
 * size); all other prep knobs are deliberately ignored.
 */
async function prepare(
  input: Buffer,
  s: OcrSettings
): Promise<{ jpeg: Buffer; png: Buffer; width: number; height: number }> {
  const pipe = sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: s.prepWidth, withoutEnlargement: true, fit: "inside" });

  // JPEG for the API (smaller bytes-on-wire). Drop quality if we're near
  // Rekognition's 5MB cap.
  let jpeg = await pipe.clone().jpeg({ quality: 92 }).toBuffer();
  let quality = 92;
  while (jpeg.length > MAX_REKOG_BYTES && quality > 50) {
    quality -= 10;
    jpeg = await pipe.clone().jpeg({ quality }).toBuffer();
  }

  // PNG for the debug overlay (visualisation). Same pipe, just lossless so
  // the bbox renderer doesn't compound JPEG artefacts.
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
  const seen = new Map<number, BibDetection>();

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
    // Keep the highest-confidence detection per bib, carrying its box
    // (normalized against the prepared image, same space as face boxes).
    if (prev === undefined || score > prev.confidence) {
      seen.set(n, { bib: n, confidence: score, bbox: normalizeBox(w.bbox, prep.width, prep.height) });
    }
  }
  for (const det of seen.values()) bibs.push(det);
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
