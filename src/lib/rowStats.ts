/* Pure statistics for the Rowtember numbers page (/row100k/analysis).
 *
 * Arrays of numbers in, numbers out — no clock, no formatting, no I/O — so
 * every figure on the page can be unit-checked from a script and the same
 * maths can serve any later surface. Population SD throughout: the field IS
 * the population we care about, not a sample of some bigger one. Empty input
 * returns NaN rather than 0 so a missing dataset can never be mistaken for a
 * zero; callers guard on n before drawing anything. */

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: number[]): number {
  return xs.length ? sum(xs) / xs.length : NaN;
}

export function variance(xs: number[]): number {
  if (!xs.length) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return s / xs.length;
}

export function sd(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

/* Coefficient of variation — the consistency number on the ladder. */
export function cv(xs: number[]): number {
  const m = mean(xs);
  return m > 0 ? sd(xs) / m : NaN;
}

export function sortAsc(xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

/* Linear-interpolated quantile of an ASCENDING array (R type 7 — what numpy
 * and spreadsheets default to, so a reader checking a number elsewhere gets
 * the same one). p in [0, 1]. */
export function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  if (n === 1) return sorted[0];
  const h = Math.min(Math.max(p, 0), 1) * (n - 1);
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

export function median(xs: number[]): number {
  return quantile(sortAsc(xs), 0.5);
}

export function iqr(sorted: number[]): number {
  return quantile(sorted, 0.75) - quantile(sorted, 0.25);
}

/* Where v sits in a field, 0..100: the share of values below it, ties
 * counted half. The caller passes the OTHER rowers when v belongs to one of
 * the field's own members, so nobody is ranked against themselves — that is
 * the rank/(n-1) definition the page promises. */
export function percentileRank(sorted: number[], v: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
    else break;
  }
  return ((below + equal / 2) / n) * 100;
}

/* Freedman–Diaconis bin width, falling back to Sturges when the IQR is
 * degenerate (a comb of identical values has an IQR of zero). */
export function fdBinWidth(sorted: number[]): number {
  const n = sorted.length;
  if (n < 2) return 1;
  const w = (2 * iqr(sorted)) / Math.cbrt(n);
  return w > 0 ? w : sturgesBinWidth(sorted);
}

export function sturgesBinWidth(sorted: number[]): number {
  const n = sorted.length;
  if (n < 2) return 1;
  const range = sorted[n - 1] - sorted[0];
  const k = Math.ceil(Math.log2(n) + 1);
  return range > 0 ? range / k : 1;
}

/* Snap a computed width to the smallest human-friendly step at or above it
 * (the last step when none is): 371 m becomes 500 m so the axis reads. */
export function snapBinWidth(w: number, steps: number[]): number {
  for (const s of steps) if (s >= w) return s;
  return steps[steps.length - 1];
}

export type Bin = { x0: number; x1: number; n: number };

/* Equal-width bins from x0 (default: the bin holding min) up to x1
 * (default: just past max). Values outside [x0, x1) are not binned; the
 * caller counts them itself when it wants a BEYOND note. */
export function histogram(xs: number[], width: number, x0?: number, x1?: number): Bin[] {
  if (!xs.length || !(width > 0)) return [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of xs) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  const start = x0 ?? Math.floor(lo / width) * width;
  const end = x1 ?? (Math.floor(hi / width) + 1) * width;
  const k = Math.max(0, Math.round((end - start) / width));
  const bins: Bin[] = Array.from({ length: k }, (_, i) => ({
    x0: start + i * width,
    x1: start + (i + 1) * width,
    n: 0,
  }));
  for (const x of xs) {
    if (x < start || x >= end) continue;
    const i = Math.min(k - 1, Math.floor((x - start) / width));
    bins[i].n++;
  }
  return bins;
}

/* Silverman's rule of thumb for a gaussian kernel. A degenerate spread
 * (every value identical) still gets a positive width so the curve draws. */
export function silverman(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 1;
  const sorted = sortAsc(xs);
  const s = sd(xs);
  const robust = iqr(sorted) / 1.34;
  const a = robust > 0 ? Math.min(s, robust) : s;
  const h = 0.9 * a * Math.pow(n, -0.2);
  return h > 0 ? h : 1;
}

export function linspace(a: number, b: number, n: number): number[] {
  if (n <= 1) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

/* Gaussian KDE on a grid; integrates to 1 over the line. */
export function kde(xs: number[], h: number, grid: number[]): number[] {
  const n = xs.length;
  if (!n || !(h > 0)) return grid.map(() => 0);
  const c = 1 / (n * h * Math.sqrt(2 * Math.PI));
  return grid.map((g) => {
    let s = 0;
    for (const x of xs) {
      const z = (g - x) / h;
      s += Math.exp(-0.5 * z * z);
    }
    return s * c;
  });
}

export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy);
  return d > 0 ? sxy / d : NaN;
}

/* 1-based ranks, ties averaged — the input to Spearman. */
export function ranks(xs: number[]): number[] {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const r = new Array<number>(xs.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

export function spearman(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  return pearson(ranks(xs.slice(0, n)), ranks(ys.slice(0, n)));
}

export type Fit = {
  n: number;
  /* y = a + b x */
  a: number;
  b: number;
  r: number;
  /* population SD of the residuals — the ±band drawn round the line */
  resSd: number;
  /* standard error of the slope, so a drift can be stated with its error */
  seB: number;
};

/* Ordinary least squares, one predictor. */
export function linfit(xs: number[], ys: number[]): Fit {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { n, a: NaN, b: NaN, r: NaN, resSd: NaN, seB: NaN };
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = my - b * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const e = ys[i] - (a + b * xs[i]);
    sse += e * e;
  }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
  const resSd = Math.sqrt(sse / n);
  const seB = n > 2 && sxx > 0 ? Math.sqrt(sse / (n - 2) / sxx) : NaN;
  return { n, a, b, r, resSd, seB };
}

export function zscore(v: number, m: number, s: number): number {
  return s > 0 ? (v - m) / s : NaN;
}

/* Gini of non-negative values: 0 = everyone rowed the same, 1 = one rower
 * rowed everything. */
export function gini(xs: number[]): number {
  const s = sortAsc(xs).filter((x) => x >= 0);
  const n = s.length;
  const total = sum(s);
  if (n < 2 || total <= 0) return NaN;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (i + 1) * s[i];
  return (2 * acc) / (n * total) - (n + 1) / n;
}

/* Share of the total held by the top `frac` of values (0.1 = top 10 %). */
export function topShare(xs: number[], frac: number): number {
  const s = sortAsc(xs);
  const n = s.length;
  const total = sum(s);
  if (!n || total <= 0) return NaN;
  const k = Math.max(1, Math.round(n * frac));
  return sum(s.slice(n - k)) / total;
}

/* Fisher skewness — the sign tells which tail a takeaway should name. */
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const m = mean(xs);
  const s = sd(xs);
  if (!(s > 0)) return NaN;
  let acc = 0;
  for (const x of xs) acc += Math.pow((x - m) / s, 3);
  return acc / n;
}

/* Indices of local maxima that stand at least `prominence` (a fraction of
 * the tallest peak) above the dip between them and the tallest peak — the
 * test behind the two-lobes takeaway, deliberately blunt so noise in a
 * small field cannot conjure a second mode. */
export function peaks(ys: number[], prominence = 0.15): number[] {
  const n = ys.length;
  if (n < 3) return [];
  const top = Math.max(...ys);
  if (!(top > 0)) return [];
  const maxima: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (ys[i] > ys[i - 1] && ys[i] >= ys[i + 1]) maxima.push(i);
  }
  if (!maxima.length) return [];
  const tallest = maxima.reduce((a, b) => (ys[b] > ys[a] ? b : a));
  const kept = [tallest];
  for (const m of maxima) {
    if (m === tallest) continue;
    const lo = Math.min(m, tallest);
    const hi = Math.max(m, tallest);
    let dip = Infinity;
    for (let i = lo; i <= hi; i++) if (ys[i] < dip) dip = ys[i];
    if (ys[m] - dip >= prominence * top) kept.push(m);
  }
  return kept.sort((a, b) => a - b);
}

/* Trailing rolling mean; the first windows are partial rather than blank so
 * a line starts on day 1 instead of appearing a week in. */
export function rollingMean(xs: number[], win: number): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < xs.length; i++) {
    acc += xs[i];
    if (i >= win) acc -= xs[i - win];
    out.push(acc / Math.min(i + 1, win));
  }
  return out;
}

/* Empirical CDF as [value, percentile] steps, percentile = i/(n-1) — the
 * same rank-among-others definition percentileRank uses, so a rower's dot
 * lands exactly on the curve. */
export function ecdf(sorted: number[]): [number, number][] {
  const n = sorted.length;
  if (!n) return [];
  if (n === 1) return [[sorted[0], 0]];
  return sorted.map((x, i) => [x, (100 * i) / (n - 1)]);
}

/* ------------------------------------------------------ circular (hours) */

/* Mean hour of a set of clock times, 0 ≤ h < 24, so 23:30 and 00:30 average
 * to midnight rather than noon. */
export function circularMean(hours: number[]): number {
  if (!hours.length) return NaN;
  let c = 0;
  let s = 0;
  for (const h of hours) {
    const t = (h / 24) * 2 * Math.PI;
    c += Math.cos(t);
    s += Math.sin(t);
  }
  const ang = Math.atan2(s, c);
  return (((ang / (2 * Math.PI)) * 24 + 24) % 24 + 24) % 24;
}

/* Circular standard deviation in hours (sqrt(-2 ln R) scaled to the clock). */
export function circularSd(hours: number[]): number {
  const n = hours.length;
  if (!n) return NaN;
  let c = 0;
  let s = 0;
  for (const h of hours) {
    const t = (h / 24) * 2 * Math.PI;
    c += Math.cos(t);
    s += Math.sin(t);
  }
  const R = Math.sqrt(c * c + s * s) / n;
  if (R >= 1) return 0;
  if (R <= 0) return 12;
  return (Math.sqrt(-2 * Math.log(R)) / (2 * Math.PI)) * 24;
}

/* Modified Bessel function of the first kind, order 0 — the von Mises
 * normaliser. Series form; fine for the κ ≤ 50 the KDE ever asks for. */
export function besselI0(x: number): number {
  const q = (x * x) / 4;
  let term = 1;
  let s = 1;
  for (let k = 1; k < 200; k++) {
    term *= q / (k * k);
    s += term;
    if (term < s * 1e-12) break;
  }
  return s;
}

/* Wrapped (von Mises) KDE over the 24-hour clock. Returns density PER HOUR
 * at each grid hour (grid values past 24 read mod 24, so an axis that
 * starts at 03:00 can run to 27), integrating to 1 across a day. Bandwidth
 * by Silverman on the circular SD, turned into a concentration κ = 1/h² in
 * radians and capped so the curve never gets spikier than the bars. */
export function vonMisesKde(hours: number[], grid: number[], kappa?: number): number[] {
  const n = hours.length;
  if (!n) return grid.map(() => 0);
  let k = kappa ?? 0;
  if (!(k > 0)) {
    const s = circularSd(hours);
    const h = 0.9 * (s > 0 ? s : 1) * Math.pow(n, -0.2);
    const hr = (h / 24) * 2 * Math.PI;
    k = Math.min(50, Math.max(0.5, 1 / (hr * hr)));
  }
  const norm = 1 / (2 * Math.PI * besselI0(k));
  const thetas = hours.map((h) => (h / 24) * 2 * Math.PI);
  const perHour = (2 * Math.PI) / 24;
  return grid.map((g) => {
    const t = (g / 24) * 2 * Math.PI;
    let s = 0;
    for (const th of thetas) s += Math.exp(k * Math.cos(t - th));
    return ((s * norm) / n) * perHour;
  });
}
