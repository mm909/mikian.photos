/* Digit helpers for the landing counter. */

export type Token = { ch: string; sep: boolean; lead: boolean };

/* Digit string for the counter: floored, zero-padded to minDigits, grouped
 * in threes. metersText(1234567, 8) → "01,234,567". */
export function metersText(n: number, minDigits = 0): string {
  const s = String(Math.max(0, Math.floor(n))).padStart(minDigits, "0");
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/* Break a number string into cells. Leading zeros (and the separators
 * between them) are flagged so the display can dim them — 0,012,345 reads
 * as a board waiting for its digits, not as a number that starts with zero. */
export function tokensFor(text: string): Token[] {
  const out: Token[] = [];
  let lead = /^[0,]/.test(text);
  for (const ch of text) {
    if (lead && ch !== "0" && ch !== ",") lead = false;
    out.push({ ch, sep: ch === ",", lead });
  }
  // A lone zero is the number zero, not a leading zero.
  if (out.length && out.every((t) => t.lead)) out[out.length - 1].lead = false;
  return out;
}
