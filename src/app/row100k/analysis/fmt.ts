/* Number-to-words for the numbers page. Pure, so both the server model and
 * the client charts can print the same figure the same way. The real minus
 * sign is used for signed seconds — a hyphen reads as a dash in mono. */

const pad = (n: number) => String(n).padStart(2, "0");

/* Every formatter turns a non-finite number into a dash: the model builder
 * computes NaN wherever a field is too thin, and a tile must read — there,
 * never NaN m. */
export const fmtInt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "—");

export const fmtM = (n: number) => (Number.isFinite(n) ? `${fmtInt(n)} m` : "—");

/* Axis-scale meters: 2.5 k / 12 k / 250 (the k only from a thousand up). */
export function fmtK(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 1000) return `${Math.round(n)}`;
  const k = n / 1000;
  return `${Number.isInteger(k) || Math.abs(k) >= 10 ? Math.round(k) : +k.toFixed(1)} k`;
}

/* m:ss of a seconds value (a split, a duration) — no tenths; this page is
 * about the shape of the field, not the record board. */
export function fmtClock(s: number): string {
  if (!Number.isFinite(s)) return "—";
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
}

export function signed(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const v = Math.abs(n).toFixed(digits);
  return (n < 0 && Number(v) !== 0 ? "−" : "+") + v;
}

export const fmtP = (p: number) => (Number.isFinite(p) ? `P${Math.round(p)}` : "P—");

export const fmtPct = (f: number) => (Number.isFinite(f) ? `${Math.round(f * 100)} %` : "—");

export function fmtR(r: number): string {
  return Number.isFinite(r) ? r.toFixed(2) : "—";
}

/* 06:40 from 6.67 — hours on the Pacific clock. */
export function fmtHour(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const t = ((h % 24) + 24) % 24;
  let hh = Math.floor(t);
  let mm = Math.round((t - hh) * 60);
  if (mm === 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${pad(hh)}:${pad(mm)}`;
}

export const fmtMin = (s: number) => (Number.isFinite(s) ? `${Math.round(s / 60)} min` : "—");

export const fmtDayN = (d: number) => `Sept ${d}`;

/* Case-preserving: the eyebrows are set in mono caps with no CSS transform
 * to rescue a lowercase s, so SESSION pluralises to SESSIONS, not SESSIONs. */
export const plural = (n: number, one: string, many = one === one.toUpperCase() ? `${one}S` : `${one}s`) =>
  n === 1 ? one : many;
