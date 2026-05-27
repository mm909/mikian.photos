/**
 * Pure types + constants for the bib-OCR pipeline.
 *
 * Lives in its own file (separate from `bibOcr.ts`) because `bibOcr.ts`
 * pulls `sharp` (Node-only) and `tesseract.js`. Client components (the
 * OCR Lab page) want the settings shape + default values without dragging
 * Node-only deps into the browser bundle. Anything in here must be safe to
 * import from both server and client code.
 */

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
  pageConfidence: number;
  rawText: string;
  words: OcrWord[];
  bibs: BibDetection[];
  rejected: { word: OcrWord; reason: string }[];
  settings: OcrSettings;
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

/** Which OCR backend to use. Tesseract = local, free. Rekognition = AWS
 *  DetectText (does text-region detection + OCR in one call, much better on
 *  race photos but requires AWS credentials). */
export const PROVIDER_OPTIONS = {
  tesseract: "Tesseract (local, free)",
  rekognition: "AWS Rekognition (DetectText, ~$1/1k)",
} as const;
export type ProviderKey = keyof typeof PROVIDER_OPTIONS;

export type OcrSettings = {
  /** Which backend runs OCR. Tesseract for local/free; Rekognition for prod
   *  accuracy. Tesseract is the default so nothing breaks if AWS isn't set
   *  up. Provider-specific knobs (psm/oem/whitelistDigits) only apply when
   *  `provider === "tesseract"`. */
  provider: ProviderKey;
  // ---- Tesseract-only ----
  psm: PsmKey;
  oem: OemKey;
  whitelistDigits: boolean;
  // ---- Preprocessing (applies to either provider) ----
  prepWidth: number;
  sharpen: boolean;
  contrastA: number;
  contrastB: number;
  normalize: boolean;
  threshold: number | null;
  invert: boolean;
  // ---- Bib filter (applies to either provider's word output) ----
  floor2: number;
  floor3: number;
  floor4plus: number;
  minDigits: number;
  maxDigits: number;
};

export const DEFAULT_OCR_SETTINGS: OcrSettings = {
  // Production default. Tesseract stays available behind the lab dropdown
  // (and the dispatcher falls back to it if AWS_* env vars are missing).
  provider: "rekognition",
  psm: "11",
  oem: "1",
  whitelistDigits: true,
  prepWidth: 3000,
  sharpen: true,
  contrastA: 1.15,
  contrastB: -10,
  normalize: false,
  threshold: null,
  invert: false,
  floor2: 0.55,
  floor3: 0.25,
  floor4plus: 0.15,
  minDigits: 2,
  maxDigits: 5,
};

/** Merge partial settings into the defaults. Pure; safe on client + server. */
export function withDefaults(partial: Partial<OcrSettings> | undefined): OcrSettings {
  return { ...DEFAULT_OCR_SETTINGS, ...(partial ?? {}) };
}
