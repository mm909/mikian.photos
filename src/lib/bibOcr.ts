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
 * Settings are tunable via the optional `OcrSettings` arg so the
 * /photographer/ocr-lab page can experiment live without code changes.
 * The defaults are what `extractBibsFromImage` uses in production.
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
  /** Preprocessed PNG bytes (as fed to Tesseract). */
  preparedPng: Buffer;
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
  /** Echo of the settings used for this run (so the UI can show what fired). */
  settings: OcrSettings;
  /** Wall-clock milliseconds the recognize() call took. */
  durationMs: number;
};

/** Tesseract page-segmentation mode. Only the values that make sense for
 *  full-frame photo OCR are exposed in the lab UI. */
export const PSM_OPTIONS = {
  "3": "Auto (default — assumes paragraph layout)",
  "6": "Single uniform block",
  "7": "Single text line",
  "8": "Single word",
  "11": "Sparse text (recommended for race photos)",
  "12": "Sparse text with OSD",
} as const;
export type PsmKey = keyof typeof PSM_OPTIONS;

/** Tesseract OCR engine mode. 1 = LSTM (modern), 3 = LSTM + legacy. */
export const OEM_OPTIONS = {
  "1": "LSTM only (recommended)",
  "3": "LSTM + legacy",
} as const;
export type OemKey = keyof typeof OEM_OPTIONS;

export type OcrSettings = {
  /** Tesseract page-seg mode. */
  psm: PsmKey;
  /** Tesseract engine mode. */
  oem: OemKey;
  /** Long-edge pixel width for the prep resize. 1500-4000 is the useful range. */
  prepWidth: number;
  /** Run sharp.sharpen() after grayscale. */
  sharpen: boolean;
  /** sharp.linear(a, b) — `a` is multiplier, `b` is offset. (1, 0) = passthrough. */
  contrastA: number;
  contrastB: number;
  /** Normalize the histogram (stretches contrast across the image). Off by
   *  default — on race photos it amplifies asphalt as much as the bibs. */
  normalize: boolean;
  /** Binarize the image — pixels above this 0–255 value become white, below
   *  become black. `null` = no thresholding. */
  threshold: number | null;
  /** Invert grayscale before OCR (sometimes helps light-on-dark bibs). */
  invert: boolean;
  /** Restrict Tesseract to digits only. Eliminates letter false positives. */
  whitelistDigits: boolean;
  /** Per-digit-length confidence floors (0..1). */
  floor2: number;
  floor3: number;
  floor4plus: number;
  /** Min/max digit length for a token to be considered a bib candidate. */
  minDigits: number;
  maxDigits: number;
};

export const DEFAULT_OCR_SETTINGS: OcrSettings = {
  psm: "11",
  oem: "1",
  prepWidth: 3000,
  sharpen: true,
  contrastA: 1.15,
  contrastB: -10,
  normalize: false,
  threshold: null,
  invert: false,
  whitelistDigits: true,
  floor2: 0.55,
  floor3: 0.25,
  floor4plus: 0.15,
  minDigits: 2,
  maxDigits: 5,
};

const OCR_TIMEOUT_MS = 45_000;

function confidenceFloor(digits: number, s: OcrSettings): number {
  if (digits <= 1) return 1; // never accept singletons
  if (digits === 2) return s.floor2;
  if (digits === 3) return s.floor3;
  return s.floor4plus;
}

/**
 * Pre-process an image to give Tesseract its best shot at the numbers.
 * Settings are exposed so the lab UI can iterate live.
 */
async function prepareForOcr(
  input: Buffer,
  s: OcrSettings
): Promise<{ png: Buffer; width: number; height: number }> {
  let pipe = sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: s.prepWidth, withoutEnlargement: true, fit: "inside" })
    .grayscale();
  if (s.sharpen) pipe = pipe.sharpen();
  if (s.normalize) pipe = pipe.normalize();
  if (s.contrastA !== 1 || s.contrastB !== 0) pipe = pipe.linear(s.contrastA, s.contrastB);
  if (s.invert) pipe = pipe.negate();
  if (s.threshold != null) pipe = pipe.threshold(s.threshold);
  const png = await pipe.toFormat("png").toBuffer();
  const meta = await sharp(png).metadata();
  return { png, width: meta.width ?? s.prepWidth, height: meta.height ?? 0 };
}

function flattenWords(data: unknown): OcrWord[] {
  const d = data as {
    blocks?: {
      paragraphs?: {
        lines?: {
          words?: {
            text?: string;
            confidence?: number;
            bbox?: { x0: number; y0: number; x1: number; y1: number };
          }[];
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

async function getWorker(s: OcrSettings): Promise<null | {
  recognize: (image: Buffer) => Promise<RecognizeResult>;
  terminate: () => Promise<void>;
}> {
  try {
    const mod = (await import("tesseract.js")) as unknown as {
      createWorker?: (lang?: string, oem?: number) => Promise<unknown>;
      default?: { createWorker: (lang?: string, oem?: number) => Promise<unknown> };
    };
    const create = mod.createWorker ?? mod.default?.createWorker;
    if (!create) return null;
    const oemNum = Number(s.oem);
    const worker = (await create("eng", Number.isFinite(oemNum) ? oemNum : 1)) as {
      recognize: (image: Buffer, options?: unknown, output?: unknown) => Promise<RecognizeResult>;
      terminate: () => Promise<void>;
      setParameters: (params: Record<string, string>) => Promise<unknown>;
    };
    if (typeof worker.setParameters === "function") {
      const params: Record<string, string> = {
        tessedit_pageseg_mode: s.psm,
      };
      if (s.whitelistDigits) params.tessedit_char_whitelist = "0123456789";
      await worker.setParameters(params);
    }
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
async function runOcr(input: Buffer, settings: OcrSettings): Promise<OcrDebug | null> {
  let prep: { png: Buffer; width: number; height: number };
  try {
    prep = await prepareForOcr(input, settings);
  } catch {
    return null;
  }

  const worker = await getWorker(settings);
  if (!worker) return null;

  const t0 = Date.now();
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
  const durationMs = Date.now() - t0;
  if (!result) return null;

  const pageConfidence = (result.data?.confidence ?? 0) / 100;
  const rawText = result.data?.text ?? "";
  const words = flattenWords(result.data);

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
    settings,
    durationMs,
  };
}

/**
 * Production entry point — returns just the detected bibs. Used by the
 * upload finalize step and the rerun-ocr admin endpoint.
 */
export async function extractBibsFromImage(
  input: Buffer,
  settings: OcrSettings = DEFAULT_OCR_SETTINGS
): Promise<BibDetection[]> {
  const debug = await runOcr(input, settings);
  return debug?.bibs ?? [];
}

/**
 * Debug entry point — returns the full inspection payload. Used by the
 * /ocr-debug admin endpoint to power the visualization modal and the lab.
 */
export async function extractBibsDebug(
  input: Buffer,
  settings: OcrSettings = DEFAULT_OCR_SETTINGS
): Promise<OcrDebug | null> {
  return runOcr(input, settings);
}

/**
 * Merge partial settings into the defaults — used by API routes that accept
 * a (possibly partial) settings object from the lab UI.
 */
export function withDefaults(partial: Partial<OcrSettings> | undefined): OcrSettings {
  return { ...DEFAULT_OCR_SETTINGS, ...(partial ?? {}) };
}
