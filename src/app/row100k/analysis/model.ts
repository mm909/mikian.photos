/* The plain-JSON contract between compute.ts (server) and AnalysisView
 * (client). Everything in here is either an anonymised field aggregate —
 * bins, curves, identity-free dots — or, when the viewer has joined, THEIR
 * OWN marks. No other rower's name, number or individual value ever crosses
 * this boundary: the browser gets exactly what the signed-out page shows,
 * plus the viewer's own overlay. */

export type Tile = {
  /* the bold field number */
  n: string;
  /* the lighter descriptor line */
  d: string;
  /* the blue third line, only when the viewer has rows (null = nothing to say) */
  you?: string | null;
};

export type Section = { title: string; eyebrow: string; tiles: Tile[] };

export type Bin = { x0: number; x1: number; n: number };

/* Chart 1 — session distance histogram with the ±1 SD band. */
export type HistChart = {
  bins: Bin[];
  xMin: number;
  xMax: number;
  ticks: number[];
  /* sessions past xMax, printed as +n BEYOND rather than stretching the axis */
  beyond: number;
  mean: number;
  sd: number;
  median: number;
  yMax: number;
  take: string;
};
export type HistYou = { rug: number[]; line: number; tag: string };

/* Chart 2 — split KDE. */
export type KdeChart = {
  xs: number[];
  ys: number[];
  xMin: number;
  xMax: number;
  ticks: number[];
  mean: number;
  sd: number;
  median: number;
  /* a thinned sample of field splits for the grey rug — never the full set */
  rug: number[];
  take: string;
};
export type KdeYou = { rug: number[]; median: number; best: number; tag: string; bestTag: string };

export type FitLine = { a: number; b: number };

/* Chart 3a — meters vs seconds, the one correlation the owner named. */
export type DurChart = {
  /* [meters, seconds] per session */
  pts: [number, number][];
  xMax: number;
  xTicks: number[];
  yMax: number;
  /* sessions past either axis top, printed as +n BEYOND */
  beyond: number;
  /* seconds = a + b · meters */
  fit: FitLine;
  r: number;
  corner: string;
  take: string;
};
export type DurYou = { pts: [number, number][]; tag: string };

/* Chart 3 — split vs log2 distance. */
export type PaceChart = {
  /* [log2 meters, split s] per session */
  pts: [number, number][];
  xMin: number;
  xMax: number;
  xTicks: number[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  fit: FitLine;
  resSd: number;
  corner: string;
  take: string;
};
export type PaceYou = { pts: [number, number][]; fit: FitLine | null; tag: string };

/* Chart 4 — residual histogram with a thin KDE. */
export type ResidChart = {
  bins: Bin[];
  xMin: number;
  xMax: number;
  ticks: number[];
  sd: number;
  kdeXs: number[];
  kdeYs: number[];
  yMax: number;
  take: string;
};
export type ResidYou = { rug: number[]; mean: number; tag: string };

/* Chart 5 — ECDF of totals on a log axis. */
export type EcdfChart = {
  /* [total m, percentile], already cut below the hidden top (three, or the
   * elite fifteen while a blackout is on — Model.hideTop) */
  steps: [number, number][];
  xMin: number;
  xMax: number;
  ticks: number[];
  beyond: number;
  goal: number;
  /* mean ± 1 SD on the log axis, as a pair of meters */
  bracket: [number, number] | null;
  take: string;
};
export type EcdfYou = { x: number; p: number; tag: string; sub: string | null };

/* Chart 6 — sessions × mean session length. */
export type GrindChart = {
  pts: [number, number][];
  xMax: number;
  xTicks: number[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  iso: number[];
  corner: string;
  take: string;
};
export type GrindYou = { pt: [number, number]; tag: string };

/* Chart 7 — hour of the day the row was logged. */
export type HourChart = {
  counts: number[];
  kdeGrid: number[];
  kdeYs: number[];
  start: number;
  yMax: number;
  take: string;
};
export type HourYou = { rug: number[]; mean: number; tag: string };

/* Chart 8 — sessions per day. */
export type DayChart = {
  counts: number[];
  rolling: number[];
  weekend: boolean[];
  yMax: number;
  take: string;
};
export type DayYou = { dots: { day: number; meters: number }[] };

/* Chart 9 — within-rower effort drift. */
export type DriftChart = {
  pts: [number, number][];
  weekly: { x: number; med: number; sd: number }[];
  yr: number;
  days: number;
  corner: string;
  take: string;
};
export type DriftYou = { pts: [number, number][]; fit: FitLine | null; tag: string };

/* Chart 10 — the percentile ladder. `dens` is the field's density sampled
 * at even percentiles (0..100, normalised to 1): tall where the values are
 * packed, so the reader sees a percentile step is not a fixed distance. */
export type LadderRow = { key: string; label: string; ticks: { p: number; label: string }[]; dens: number[] };
export type LadderChart = { rows: LadderRow[]; take: string };
export type LadderYou = { p: (number | null)[]; note: string | null };

/* Chart 11 — cumulative meters fan. */
export type FanChart = {
  days: number;
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  goal: number;
  take: string;
};
export type FanYou = { cum: number[]; proj: [number, number][] | null; label: string };

export type Model = {
  sessions: number;
  rowers: number;
  day: number;
  /* the viewer's own headline, or null when signed out / not joined */
  you: { rowerNumber: number; sessions: number } | null;
  /* how many of the highest totals are kept off the per-rower charts: three
   * normally, the elite fifteen while a blackout window is open */
  hideTop: number;

  s1: Section;
  hist: HistChart | null;
  histYou: HistYou | null;
  kde: KdeChart | null;
  kdeYou: KdeYou | null;

  s2: Section;
  dur: DurChart | null;
  durYou: DurYou | null;
  pace: PaceChart | null;
  paceYou: PaceYou | null;
  resid: ResidChart | null;
  residYou: ResidYou | null;

  s3: Section;
  ecdf: EcdfChart | null;
  ecdfYou: EcdfYou | null;
  grind: GrindChart | null;
  grindYou: GrindYou | null;

  s4: Section;
  hour: HourChart | null;
  hourYou: HourYou | null;
  dayc: DayChart | null;
  daycYou: DayYou | null;

  s5: Section;
  drift: DriftChart | null;
  driftYou: DriftYou | null;

  s6: Section;
  /* section 6 swaps its tiles when YOU is on: the you-value is the headline there */
  s6You: Tile[] | null;
  ladder: LadderChart | null;
  ladderYou: LadderYou | null;
  fan: FanChart | null;
  fanYou: FanYou | null;
};
