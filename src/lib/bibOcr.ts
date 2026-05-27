/**
 * Best-effort bib detection on a JPEG/PNG buffer.
 *
 * Pluggable provider — currently runs Tesseract.js (open-source OCR, no API
 * key, ~5MB WASM bundle on first run). The whole point of `bibOcr.ts` is to
 * isolate the provider so we can swap in AWS Rekognition / Google Vision /
 * a custom race-bib model later without touching `/finalize` or the rerun
 * route.
 *
 * Uses createWorker + blocks output so we get per-word bounding boxes +
 * per-word confidence — the top-level recognize() in v7 doesn't populate
 * blocks, which caused every detection to be silently rejected.
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

export type OcrWord = {
  text: string;
  confidence: number; // 0..1
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type OcrDebug = {
  /** Preprocessed PNG bytes (grayscale + normalize + resize, as fed to Tesseract). */
  preparedPng: Buffer;
  /** Final dimensions of the prepared image — useful for drawing overlays. */
  preparedWidth: number;
  preparedHeight: number;
  /** Page-level confidence Tesseract assigned the whole image (0..1). */
  pageConfidence: number;
  /** Raw concatenated text Tesseract produced. */
  rawText: string;
  /** Every word Tesseract emitted, with its bbox + confidence. */
  words: OcrWord[];
  /** Bib detections we'd keep (after digit-length + confidence filtering). */
  bibs: BibDetection[];
  /** Words that LOOK like bibs but got rejected — and why. */
  rejected: { word: OcrWord; reason: string }[];
};

const MIN_DIGITS = 2;
const MAX_DIGITS = 5; // race bibs are typically 1-5 digits; we drop 1-digit as too noisy
const MIN_WORD_CONFIDENCE = 0.4; // Tesseract per-word — conservative on stylized fonts
const PREP_WIDTH = 2000;
const OCR_TIMEOUT_MS = 25_000; // never block finalize longer than this

/**
 * Pre-process an image to give Tesseract its best shot at the numbers:
 *   - downscale to 2000px long-edge (Tesseract is slow on huge images; this
 *     hits a good balance — bibs stay readable, runtime stays sane)
 *   - grayscale
 *   - boost contrast a bit (normalize stretches the histogram)
 */
async function prepareForOcr(input: Buffer): Promise<{ png: Buffer; width: number; height: number }> {
  const png = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: PREP_WIDTH, withoutEnlargement: true, fit: "inside" })
    .grayscale()
    .normalize()
    .toFormat("png")
    .toBuffer();
  const meta = await sharp(png).metadata();
  return { png, width: meta.width ?? PREP_WIDTH, height: meta.height ?? 0 };
}

/** Walk Tesseract's blocks tree → flat list of words with bbox + confidence. */
function flattenWords(data: unknown): OcrWord[] {
  const d = data as {
    blocks?: {
      paragraphs?: {
        lines?: {
          words?: { text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }[];
        }[];
      }[];
    }[];
  };
  const out: OcrWord[] = [];
  for (const b of d.blocks ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) {
        for (const w of l.words ?? []) {
          if (!w?.text || typeof w.confidence !== "number" || !w.bbox) continue;
          out.push({
            text: w.text,
            confidence: w.confidence / 100,
            bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
          });
        }
      }
    }
  }
  return out;
}

type RecognizeResult = { data?: { text?: string; confidence?: number; blocks?: unknown } };

/**
 * Acquire a Tesseract Worker (the only way to get blocks output in v7).
 * Cold-start is ~1s; we tear down after each call to keep memory flat in
 * serverless. Returns null on any setup failure.
 */
async function getWorker(): Promise<null | {
  recognize: (image: Buffer) => Promise<RecognizeResult>;
  terminate: () => Promise<void>;
}> {
  try {
    const mod = (await import("tesseract.js")) as unknown as {
      createWorker?: (lang?: string) => Promise<unknown>;
      default?: { createWorker: (lang?: string) => Promise<unknown> };
    };
    const create = mod.createWorker ?? mod.default?.createWorker;
    if (!create) return null;
    const worker = (await create("eng")) as {
      recognize: (image: Buffer, options?: unknown, output?: unknown) => Promise<RecognizeResult>;
      terminate: () => Promise<void>;
    };
    return {
      recognize: (image: Buffer) =>
        worker.recognize(image, undefined, { blocks: true, text: true }),
      terminate: () => worker.terminate(),
    };
  } catch {
    return null;
  }
}

/**
 * Internal: run OCR end-to-end and return rich debug data. Both
 * `extractBibsFromImage` and the /ocr-debug endpoint go through this.
 */
async function runOcr(input: Buffer): Promise<OcrDebug | null> {
  let prep: { png: Buffer; width: number; height: number };
  try {
    prep = await prepareForOcr(input);
  } catch {
    return null;
  }

  const worker = await getWorker();
  if (!worker) return null;

  // Hard timeout — tesseract.js workers can hang on edge cases.
  let result: RecognizeResult | null = null;
  try {
    result = await Promise.race([
      worker.recognize(prep.png),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ocr-timeout")), OCR_TIMEOUT_MS)
      ),
    ]);
  } catch (e) {
    if (e instanceof Error && e.message === "ocr-timeout") {
      console.warn(`bib OCR timed out after ${OCR_TIMEOUT_MS}ms`);
    }
  } finally {
    try {
      await worker.terminate();
    } catch {
      /* best-effort */
    }
  }
  if (!result) return null;

  const pageConfidence = (result.data?.confidence ?? 0) / 100;
  const rawText = result.data?.text ?? "";
  const words = flattenWords(result.data);

  const bibs: BibDetection[] = [];
  const rejected: { word: OcrWord; reason: string }[] = [];
  const seen = new Map<number, number>();

  for (const w of words) {
    const digits = w.text.replace(/[^0-9]/g, "");
    if (digits.length === 0) continue; // not even a candidate; skip silently

    if (digits.length < MIN_DIGITS) {
      rejected.push({ word: w, reason: `too short (${digits.length}<${MIN_DIGITS})` });
      continue;
    }
    if (digits.length > MAX_DIGITS) {
      rejected.push({ word: w, reason: `too long (${digits.length}>${MAX_DIGITS})` });
      continue;
    }
    const n = Number(digits);
    if (!Number.isFinite(n) || n <= 0) {
      rejected.push({ word: w, reason: "not a positive integer" });
      continue;
    }
    if (w.confidence < MIN_WORD_CONFIDENCE) {
      rejected.push({
        word: w,
        reason: `confidence too low (${(w.confidence * 100).toFixed(0)}%<${MIN_WORD_CONFIDENCE * 100}%)`,
      });
      continue;
    }
    // Penalise tokens that are mostly junk surrounding a few digits
    const noiseRatio = (w.text.length - digits.length) / Math.max(w.text.length, 1);
    const score = w.confidence * (1 - 0.4 * noiseRatio);
    const prev = seen.get(n);
    if (prev === undefined || score > prev) seen.set(n, score);
  }

  for (const [bib, confidence] of seen) {
    bibs.push({ bib, confidence });
  }
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
  };
}

/**
 * Production entry point — returns just the detected bibs. Used by the
 * upload finalize step and the rerun-ocr admin endpoint.
 */
export async function extractBibsFromImage(input: Buffer): Promise<BibDetection[]> {
  const debug = await runOcr(input);
  return debug?.bibs ?? [];
}

/**
 * Debug entry point — returns the full inspection payload. Used by the
 * /ocr-debug admin endpoint to power the visualization modal.
 */
export async function extractBibsDebug(input: Buffer): Promise<OcrDebug | null> {
  return runOcr(input);
}
