/**
 * Best-effort bib detection on a JPEG/PNG buffer.
 *
 * Pluggable provider — currently runs Tesseract.js (open-source OCR, no API
 * key, ~5MB WASM bundle on first run). The whole point of `bibOcr.ts` is to
 * isolate the provider so we can swap in AWS Rekognition / Google Vision /
 * a custom race-bib model later without touching `/finalize` or the rerun
 * route.
 *
 * Caveats:
 *   - Tesseract isn't tuned for race bibs. Expect best results on clean
 *     chest-bibs with sharp digits; expect misses on motion-blurred,
 *     partially obscured, or tiny-in-frame numbers.
 *   - Returns 0 detections silently on failure — never throws, so the upload
 *     pipeline can't be broken by an OCR edge case.
 */
import sharp from "sharp";

export type BibDetection = {
  bib: number;
  confidence: number; // 0..1
};

const MIN_DIGITS = 2;
const MAX_DIGITS = 5; // race bibs are typically 1-5 digits; we drop 1-digit as too noisy
const MIN_PAGE_CONFIDENCE = 0.3; // skip pages that are mostly noise

/**
 * Pre-process an image to give Tesseract its best shot at the numbers:
 *   - downscale (Tesseract is slow on huge images; ~2000px hits a good
 *     balance — bibs stay readable, runtime stays sane)
 *   - grayscale
 *   - boost contrast a bit
 */
async function prepareForOcr(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: 2000, withoutEnlargement: true, fit: "inside" })
    .grayscale()
    .normalize()
    .toFormat("png")
    .toBuffer();
}

/**
 * Extract bib detections from a photo. Always resolves (never throws); on
 * any error returns [].
 */
export async function extractBibsFromImage(input: Buffer): Promise<BibDetection[]> {
  // Tesseract.js v7 ships CommonJS; under Node's ESM interop only `default`
  // carries the full namespace including `recognize`, so we reach through it.
  type RecognizeFn = (
    image: Buffer | string,
    langs?: string,
    options?: unknown
  ) => Promise<{ data?: { text?: string; confidence?: number } }>;
  let recognize: RecognizeFn;
  try {
    const tesseract = (await import("tesseract.js")) as unknown as {
      recognize?: RecognizeFn;
      default?: { recognize: RecognizeFn };
    };
    const fn = tesseract.recognize ?? tesseract.default?.recognize;
    if (!fn) return [];
    recognize = fn;
  } catch {
    return [];
  }

  let prepared: Buffer;
  try {
    prepared = await prepareForOcr(input);
  } catch {
    return [];
  }

  try {
    const { data } = await recognize(prepared, "eng");
    const text = data?.text ?? "";
    const pageConf = (data?.confidence ?? 0) / 100;
    if (pageConf < MIN_PAGE_CONFIDENCE) return [];

    // Scan all whitespace-bounded digit runs. \b is unreliable around
    // non-ASCII Tesseract noise; whitespace splitting is more predictable.
    const tokens = text.split(/[\s,;:|/\\]+/);
    const seen = new Map<number, number>(); // bib -> best per-token score
    for (const tok of tokens) {
      const digits = tok.replace(/[^0-9]/g, "");
      if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) continue;
      const n = Number(digits);
      if (!Number.isFinite(n) || n <= 0) continue;

      // Score = page confidence × (1 − noise ratio). Tokens that are mostly
      // digits (e.g. "3498") score higher than tokens with stray junk
      // (e.g. "u8|3498e"). Keeps OCR-noisy hits at a lower confidence.
      const noiseRatio = (tok.length - digits.length) / Math.max(tok.length, 1);
      const score = pageConf * (1 - 0.4 * noiseRatio);
      const prev = seen.get(n);
      if (prev === undefined || score > prev) seen.set(n, score);
    }

    return Array.from(seen.entries())
      .map(([bib, confidence]) => ({ bib, confidence }))
      .sort((a, b) => b.confidence - a.confidence);
  } catch {
    return [];
  }
}
