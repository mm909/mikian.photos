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

export type OcrSettings = {
  psm: PsmKey;
  oem: OemKey;
  prepWidth: number;
  sharpen: boolean;
  contrastA: number;
  contrastB: number;
  normalize: boolean;
  threshold: number | null;
  invert: boolean;
  whitelistDigits: boolean;
  floor2: number;
  floor3: number;
  floor4plus: number;
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

/** Merge partial settings into the defaults. Pure; safe on client + server. */
export function withDefaults(partial: Partial<OcrSettings> | undefined): OcrSettings {
  return { ...DEFAULT_OCR_SETTINGS, ...(partial ?? {}) };
}
