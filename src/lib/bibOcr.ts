/**
 * Best-effort bib detection on a JPEG/PNG buffer. **Server-only** — pulls
 * `sharp` and `tesseract.js`, which can't be bundled for the browser.
 *
 * Pluggable provider — currently runs Tesseract.js (open-source OCR, no API
 * key, ~5MB WASM bundle on first run). The whole point of `bibOcr.ts` is to
 * isolate the provider so we can swap in AWS Rekognition / Google Vision /
 * a custom race-bib model later without touching `/finalize` or the rerun
 * route.
 *
 * Settings shape lives in `bibOcrTypes.ts` so the lab UI can import it
 * without dragging Node-only deps into the client bundle.
 */
import "server-only";
import sharp from "sharp";
import {
  DEFAULT_OCR_SETTINGS,
  type BibDetection,
  type OcrDebug,
  type OcrSettings,
  type OcrWord,
} from "./bibOcrTypes";
import {
  extractBibsDebugRekognition,
  rekognitionConfigured,
} from "./bibOcrRekognition";

export {
  DEFAULT_OCR_SETTINGS,
  withDefaults,
  PSM_OPTIONS,
  OEM_OPTIONS,
  PROVIDER_OPTIONS,
} from "./bibOcrTypes";
export type {
  BibDetection,
  OcrDebug,
  OcrSettings,
  OcrWord,
  PsmKey,
  OemKey,
  ProviderKey,
} from "./bibOcrTypes";
export { rekognitionConfigured } from "./bibOcrRekognition";

const OCR_TIMEOUT_MS = 45_000;

function confidenceFloor(digits: number, s: OcrSettings): number {
  if (digits <= 1) return 1;
  if (digits === 2) return s.floor2;
  if (digits === 3) return s.floor3;
  return s.floor4plus;
}

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
 * Dispatch to the requested OCR provider. If the caller asks for Rekognition
 * but it isn't configured, we fall back to Tesseract so a misconfigured deploy
 * still gives some answer (and surfaces it in the lab).
 */
async function dispatch(input: Buffer, settings: OcrSettings): Promise<OcrDebug | null> {
  if (settings.provider === "rekognition") {
    if (!rekognitionConfigured()) {
      console.warn(
        "Rekognition requested but AWS_* env vars are missing — falling back to Tesseract"
      );
      return runOcr(input, { ...settings, provider: "tesseract" });
    }
    return extractBibsDebugRekognition(input, settings);
  }
  return runOcr(input, settings);
}

export async function extractBibsFromImage(
  input: Buffer,
  settings: OcrSettings = DEFAULT_OCR_SETTINGS
): Promise<BibDetection[]> {
  const debug = await dispatch(input, settings);
  return debug?.bibs ?? [];
}

export async function extractBibsDebug(
  input: Buffer,
  settings: OcrSettings = DEFAULT_OCR_SETTINGS
): Promise<OcrDebug | null> {
  return dispatch(input, settings);
}
