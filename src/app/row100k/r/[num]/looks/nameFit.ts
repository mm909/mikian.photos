/* THE NAME ON ONE LINE (owner, 2026-09-24: "my name is currently split on
 * two lines (095 MIKIAN / MUSSER) — fit my name on one line"). The
 * nameplate is set in Archivo Black at a size that comes off the viewport,
 * and a name that is too long for its column at that size wrapped. Now the
 * size comes off the name as well: this file says how wide the headline
 * is in ems, the stylesheet (theme.ts .pf-name) divides the column width
 * by it, and the type shrinks until the line fits.
 *
 * Widths are Archivo Black's advance widths for the caps, digits and the
 * few marks a name carries, measured in the browser at 100px and rounded
 * to the hundredth (2026-09-24). A letter that is not in the table — an
 * accented cap after the accent is stripped, a mark nobody has yet — is
 * counted at the width of a wide letter, so an unknown glyph errs toward
 * a line that fits. The nameplate's letter-spacing (-.02em a glyph) is
 * folded in here, so the CSS needs only the one number. */

const EM: Record<string, number> = {
  A: 0.78,
  B: 0.78,
  C: 0.78,
  D: 0.78,
  E: 0.72,
  F: 0.67,
  G: 0.83,
  H: 0.83,
  I: 0.39,
  J: 0.67,
  K: 0.83,
  L: 0.67,
  M: 0.94,
  N: 0.83,
  O: 0.83,
  P: 0.72,
  Q: 0.83,
  R: 0.78,
  S: 0.72,
  T: 0.72,
  U: 0.83,
  V: 0.78,
  W: 1,
  X: 0.78,
  Y: 0.78,
  Z: 0.72,
  "0": 0.67,
  "1": 0.67,
  "2": 0.67,
  "3": 0.67,
  "4": 0.67,
  "5": 0.67,
  "6": 0.67,
  "7": 0.67,
  "8": 0.67,
  "9": 0.67,
  " ": 0.33,
  ".": 0.33,
  "-": 0.33,
  "'": 0.28,
  "’": 0.28,
};

const UNKNOWN = 0.9;
const LETTER_SPACING = -0.02;
/* A hair of slack for subpixel rounding and the fallback face, so a name
 * measured to the pixel does not still tip onto a second line. */
const SLACK = 1.02;

/* How wide `text` is in ems when set in the nameplate face, uppercase,
 * with its letter-spacing. Never below one em, so a division by it in the
 * stylesheet is always sane. */
export function nameplateEm(text: string): number {
  const up = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  let w = 0;
  for (const ch of up) w += (EM[ch] ?? UNKNOWN) + LETTER_SPACING;
  return Math.max(1, Math.round(w * SLACK * 100) / 100);
}
