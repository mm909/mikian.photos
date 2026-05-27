/**
 * Best-effort bib detection on a JPEG/PNG buffer.
 *
 * Pluggable provider — currently runs Tesseract.js (open-source OCR, no API
 * key, ~5MB WASM bundle, slow but free). The whole point of `bibOcr.ts` is to
 * isolate the provider so we can swap in AWS Rekognition / Google Vision /
 * a custom race-bib model later without touching `/finalize`.
 *
 * Caveats:
 *   - Tesseract isn't tuned for race bibs. Expect ~20-40% recall on clean
 *     shots, far less on motion-blurred or partially obscured numbers.
 *   - Returns 0 detections silently on failure — never throws, so the upload
 *     pipeline can't be broken by an OCR edge case.
 *
 * The contract: given image bytes, return zero or more `{ bib, confidence }`
 * detections. Confidence is 0-1. Caller writes PhotoBib rows for each result.
 */
import sharp from "sharp";

export type BibDetection = {
  bib: number;
  confidence: number; // 0..1
};

const MIN_DIGITS = 2;
const MAX_DIGITS = 5; // race bibs are typically 1-5 digits; we drop 1-digit as too noisy

/**
 * Pre-process an image to give Tesseract its best shot at the numbers:
 *   - downscale (Tesseract is slow on large images)
 *   - grayscale
 *   - boost contrast a bit
 */
async function prepareForOcr(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: 1400, withoutEnlargement: true, fit: "inside" })
    .grayscale()
    .normalize() // stretch the histogram for contrast
    .toFormat("png")
    .toBuffer();
}

/**
 * Extract bib detections from a photo. Always resolves (never throws); on
 * any error returns [].
 */
export async function extractBibsFromImage(input: Buffer): Promise<BibDetection[]> {
  let tesseract: typeof import("tesseract.js");
  try {
    tesseract = await import("tesseract.js");
  } catch {
    // tesseract.js not installed — return no detections
    return [];
  }

  let prepared: Buffer;
  try {
    prepared = await prepareForOcr(input);
  } catch {
    return [];
  }

  try {
    const { data } = await tesseract.recognize(prepared, "eng", {
      // Only let Tesseract emit digits, dashes, and spaces — speeds it up
      // and avoids confusing 0/O, 1/I, etc.
      // (tessedit_char_whitelist is recognized in legacy mode; harmless in v5.)
      // @ts-expect-error TesseractJob options aren't typed exhaustively
      tessedit_char_whitelist: "0123456789 -",
    });

    // Tesseract.js v7 nests words inside blocks → paragraphs → lines → words.
    const seen = new Map<number, number>(); // bib -> best confidence
    const blocks = data?.blocks ?? [];
    for (const block of blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const w of line.words ?? []) {
            if (!w?.text || typeof w.confidence !== "number") continue;
            const clean = w.text.replace(/[^0-9]/g, "");
            if (clean.length < MIN_DIGITS || clean.length > MAX_DIGITS) continue;
            const n = Number(clean);
            if (!Number.isFinite(n) || n <= 0) continue;
            const conf = w.confidence / 100;
            // require a minimum confidence — Tesseract is noisy with low-conf hits
            if (conf < 0.55) continue;
            const prev = seen.get(n);
            if (prev === undefined || conf > prev) seen.set(n, conf);
          }
        }
      }
    }

    return Array.from(seen.entries()).map(([bib, confidence]) => ({ bib, confidence }));
  } catch {
    return [];
  }
}
