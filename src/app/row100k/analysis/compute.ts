import { GOAL_METERS, WEEKS, splitSeconds } from "@/lib/row100k";
import {
  circularMean,
  cv,
  ecdf,
  fdBinWidth,
  gini,
  histogram,
  kde,
  linfit,
  linspace,
  mean,
  median,
  peaks,
  pearson,
  percentileRank,
  quantile,
  rollingMean,
  sd,
  silverman,
  skewness,
  snapBinWidth,
  sortAsc,
  spearman,
  sum,
  topShare,
  vonMisesKde,
} from "@/lib/rowStats";
import type { RawEntry, RawParticipant } from "./data";
import { fmtClock, fmtDayN, fmtHour, fmtInt, fmtK, fmtM, fmtMin, fmtP, fmtPct, fmtR, plural, signed } from "./fmt";
import type {
  DayChart,
  DayYou,
  DriftChart,
  DriftYou,
  DurChart,
  DurYou,
  EcdfChart,
  EcdfYou,
  FitLine,
  GrindChart,
  GrindYou,
  HistChart,
  HistYou,
  HourChart,
  HourYou,
  KdeChart,
  KdeYou,
  LadderChart,
  LadderRow,
  LadderYou,
  Model,
  PaceChart,
  PaceYou,
  ResidChart,
  ResidYou,
  Section,
  Tile,
  FanChart,
  FanYou,
} from "./model";

/* The whole numbers page, computed once per render on the server. The
 * field aggregates are identical for every visitor; the viewer's overlay is
 * computed against the OTHER rowers (never against themselves, never
 * exposing anyone else), and only their own values leave this function.
 *
 * Population rules (spec, 2026-09-05): per-rower metrics and percentiles
 * need ≥3 sessions, trends ≥4; a division figure is suppressed under 8
 * rowers or 30 sessions; residual charts clip at ±30 s so an outlier is not
 * identifiable; the highest totals are never drawn as individual dots
 * outside the leaderboard — the top three normally, THE ELITE FIFTEEN while
 * a blackout window is open (blackoutRules.ts, owner's call 2026-09-05: the
 * board still lists them by name with a session count, so a dot at that
 * session count would hand a reader the masked total). */

export type Viewer =
  | { kind: "anon" }
  | { kind: "unjoined" }
  | { kind: "joined"; id: string; rowerNumber: number; division: string; entries: RawEntry[] };

const MIN_DIV_ROWERS = 8;
const MIN_DIV_SESSIONS = 30;
const MIN_ROWER = 3;
const MIN_TREND = 4;
const RESID_CLIP = 30;
/* Outside a blackout only the podium stays off the per-rower charts. */
export const HIDE_TOP_DEFAULT = 3;
/* A per-rower chart needs this many dots left after the hidden top is
 * removed, or it does not draw. */
const MIN_SHOWN = 5;
/* Log times are read on the US-west wall clock, the repo's 7h shift. */
const PACIFIC_SHIFT_MS = 7 * 3_600_000;
const MONTH = "2026-09-";
const DASH = "—";

type Sess = {
  pid: string;
  day: number;
  meters: number;
  seconds: number;
  split: number;
  /* log2 meters — the pacing model's predictor */
  lg: number;
  /* hour of day the row was LOGGED, Pacific, fractional */
  hour: number;
  weekend: boolean;
};

type Rower = {
  pid: string;
  division: string;
  sess: Sess[];
  n: number;
  total: number;
  meanLen: number;
  medSplit: number;
  bestSplit: number;
  bestDay: number;
  meanResid: number;
  cv: number;
  /* distinct days rowed, ascending */
  days: number[];
};

/* September 2026 weekends, from the calendar rather than the clock. */
function weekendDay(d: number): boolean {
  const dow = new Date(Date.UTC(2026, 8, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

function dayNum(day: string): number {
  return Number(day.slice(8, 10));
}

function toSess(e: RawEntry): Sess | null {
  if (!(e.meters > 0) || !(e.seconds > 0)) return null;
  if (!e.day.startsWith(MONTH)) return null;
  const day = dayNum(e.day);
  if (!(day >= 1 && day <= 30)) return null;
  const shifted = new Date(e.createdAtMs - PACIFIC_SHIFT_MS);
  const hour = shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
  return {
    pid: e.participantId,
    day,
    meters: e.meters,
    seconds: e.seconds,
    split: splitSeconds(e.meters, e.seconds),
    lg: Math.log2(e.meters),
    hour,
    weekend: weekendDay(day),
  };
}

function makeRower(pid: string, division: string, sess: Sess[], resid: (s: Sess) => number): Rower {
  const meters = sess.map((s) => s.meters);
  const splits = sess.map((s) => s.split);
  let best = sess[0];
  for (const s of sess) if (s.split < best.split) best = s;
  return {
    pid,
    division,
    sess,
    n: sess.length,
    total: sum(meters),
    meanLen: mean(meters),
    medSplit: median(splits),
    bestSplit: best.split,
    bestDay: best.day,
    meanResid: mean(sess.map(resid)),
    cv: sess.length >= 2 ? cv(meters) : NaN,
    days: sortAsc([...new Set(sess.map((s) => s.day))]),
  };
}

/* Axis helpers — count axes want four integer gridlines, so the top is
 * four times a friendly step. */
function niceCount(max: number): number {
  if (!(max > 0)) return 4;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
  for (const s of steps) if (4 * s >= max) return 4 * s;
  return Math.ceil(max / 4) * 4;
}

function tickStep(range: number, steps: number[], maxTicks: number): number {
  for (const s of steps) if (range / s <= maxTicks) return s;
  return steps[steps.length - 1];
}

function ticksBetween(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/* Log-axis bounds: the widest pair of candidates that still contains the
 * data, plus every candidate between them as a tick. */
function logBounds(cands: number[], lo: number, hi: number): { lo: number; hi: number; ticks: number[] } {
  let a = cands[0];
  for (const c of cands) if (c <= lo) a = c;
  let b = cands[cands.length - 1];
  for (let i = cands.length - 1; i >= 0; i--) if (cands[i] >= hi) b = cands[i];
  if (b <= a) b = cands[Math.min(cands.length - 1, cands.indexOf(a) + 1)];
  let ticks = cands.filter((c) => c >= a && c <= b);
  if (ticks.length > 7) ticks = ticks.filter((_, i) => i % 2 === 0);
  return { lo: a, hi: b, ticks };
}

/* Evenly thinned sample of a sorted array — the grey rug shows the shape of
 * the field without shipping every value. */
function thin(sorted: number[], k: number): number[] {
  if (sorted.length <= k) return sorted;
  return Array.from({ length: k }, (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (k - 1))]);
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fin = (v: number, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : DASH);

export function buildModel(
  participants: RawParticipant[],
  entries: RawEntry[],
  viewer: Viewer,
  today: number,
  hideTop = HIDE_TOP_DEFAULT,
): Model {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const sess: Sess[] = [];
  for (const e of entries) {
    if (!byId.has(e.participantId)) continue;
    const s = toSess(e);
    if (s) sess.push(s);
  }
  const n = sess.length;
  const has = n > 0;

  /* The viewer's own rows come in fresh (not from the cache) so a row logged
   * a minute ago is already in the blue; the field they are measured
   * against is everyone else. */
  const me = viewer.kind === "joined" ? viewer : null;
  const meDiv = me?.division ?? "";
  const mine: Sess[] = me ? me.entries.map(toSess).filter((s): s is Sess => s !== null) : [];
  const isOther = (pid: string) => !me || pid !== me.id;

  /* The pacing model everything downstream reuses: split ~ log2 distance. */
  const fit = n >= 3 ? linfit(sess.map((s) => s.lg), sess.map((s) => s.split)) : null;
  const resid = (s: Sess) => (fit ? s.split - (fit.a + fit.b * s.lg) : NaN);

  const perPid = new Map<string, Sess[]>();
  for (const s of sess) {
    const l = perPid.get(s.pid);
    if (l) l.push(s);
    else perPid.set(s.pid, [s]);
  }
  const rowersAll: Rower[] = [...perPid].map(([pid, list]) =>
    makeRower(pid, byId.get(pid)?.division ?? "", list, resid),
  );
  const rowers3 = rowersAll.filter((r) => r.n >= MIN_ROWER);
  const rowers4 = rowersAll.filter((r) => r.n >= MIN_TREND);
  const others = rowersAll.filter((r) => isOther(r.pid));
  const others3 = rowers3.filter((r) => isOther(r.pid));
  const otherSess = sess.filter((s) => isOther(s.pid));

  const my = me && mine.length ? makeRower(me.id, meDiv, mine, resid) : null;
  const myOk = my !== null && my.n >= MIN_ROWER;

  /* The hidden top, by the board's own definition (blackoutRules.ts
   * eliteIndexes): the first hideTop of the standings with any meters at
   * all. Their totals never become a dot or a step; the viewer's own point
   * is still theirs to see. */
  const elite = new Set(
    [...rowersAll]
      .filter((r) => r.total > 0)
      .sort((a, c) => c.total - a.total)
      .slice(0, Math.max(0, hideTop))
      .map((r) => r.pid),
  );
  const shown3 = rowers3.filter((r) => !elite.has(r.pid));
  /* While a blackout hides the top, their individual SESSIONS leave the dot
   * charts too — the owner's rule is that not one of their numbers gets
   * published, and an unlabelled dot is still their number. The aggregates
   * (histograms, densities, the fit) keep them. */
  const publicSess = hideTop > HIDE_TOP_DEFAULT ? (s: Sess) => !elite.has(s.pid) : () => true;

  const divInfo = (div: string) => {
    const rs = rowersAll.filter((r) => r.division === div);
    return { rowers: rs, sessions: rs.reduce((a, r) => a + r.n, 0) };
  };
  const divOk = (div: string) => {
    if (div !== "M" && div !== "F") return false;
    const d = divInfo(div);
    return d.rowers.length >= MIN_DIV_ROWERS && d.sessions >= MIN_DIV_SESSIONS;
  };
  const myDivOk = me ? divOk(meDiv) : false;

  /* ------------------------------------------------ 1 · shape of a session */
  const meters = sess.map((s) => s.meters);
  const sortedM = sortAsc(meters);
  const splits = sess.map((s) => s.split);
  const sortedSp = sortAsc(splits);
  const secs = sess.map((s) => s.seconds);
  const mM = mean(meters);
  const sdM = sd(meters);
  const medM = median(meters);
  const roundShare = has ? sess.filter((s) => s.meters % 1000 === 0).length / n : NaN;
  const mSp = mean(splits);
  const sdSp = sd(splits);
  const medSp = median(splits);
  const medSec = median(secs);
  const rMS = pearson(meters, secs);

  const otherM = sortAsc(otherSess.map((s) => s.meters));
  const otherSp = sortAsc(otherSess.map((s) => s.split));
  const otherSpDiv = me
    ? sortAsc(otherSess.filter((s) => byId.get(s.pid)?.division === meDiv).map((s) => s.split))
    : [];
  const myMedM = mine.length ? median(mine.map((s) => s.meters)) : NaN;
  const myMedSp = mine.length ? median(mine.map((s) => s.split)) : NaN;
  const pMyMedM = percentileRank(otherM, myMedM);
  /* Split percentiles read ahead-of: the share of the field you are faster than. */
  const pMySpAll = 100 - percentileRank(otherSp, myMedSp);
  const pMySpDiv = myDivOk ? 100 - percentileRank(otherSpDiv, myMedSp) : NaN;
  const splitYouP = myDivOk ? `${fmtP(pMySpDiv)} ${meDiv} · ${fmtP(pMySpAll)} all` : `${fmtP(pMySpAll)} all`;

  const s1: Section = {
    title: "The shape of a session",
    eyebrow: `DISTRIBUTIONS · ${fmtInt(n)} ${plural(n, "SESSION")} · ${fmtInt(rowersAll.length)} ${plural(rowersAll.length, "ROWER")} · DAY ${today} OF 30`,
    tiles: [
      {
        n: has ? fmtM(medM) : DASH,
        d: has
          ? `median session · mean ${fmtM(mM)}, ${fmtInt(Math.abs(mM - medM))} m ${mM >= medM ? "right" : "left"} of the median — that is the ${mM >= medM ? "long" : "short"} tail`
          : "median session · nothing logged yet",
        you: mine.length ? `you: ${fmtM(myMedM)} · ${fmtP(pMyMedM)}` : null,
      },
      {
        n: has ? `± ${fmtM(sdM)}` : DASH,
        d: has ? `session SD · 68 % of rows fall ${fmtK(Math.max(0, mM - sdM))}–${fmtK(mM + sdM)}` : "session SD",
        you: mine.length >= 2 ? `you: ± ${fmtM(sd(mine.map((s) => s.meters)))}` : null,
      },
      {
        n: has ? fmtPct(roundShare) : DASH,
        d: "of sessions end on a round thousand — rowers row to numbers",
        you: mine.length ? `you: ${fmtPct(mine.filter((s) => s.meters % 1000 === 0).length / mine.length)}` : null,
      },
      {
        n: has ? `${fmtClock(medSp)} /500 m` : DASH,
        d: has
          ? `median split · SD ${fmtClock(sdSp)}; 68 % of rows sit ${fmtClock(mSp - sdSp)}–${fmtClock(mSp + sdSp)}`
          : "median split",
        you: mine.length ? `you: ${fmtClock(myMedSp)} · ${splitYouP}` : null,
      },
      {
        n: has ? fmtMin(medSec) : DASH,
        d: `median duration · r(meters, seconds) = ${fmtR(rMS)} — drawn below`,
        you: mine.length ? `you: ${fmtMin(median(mine.map((s) => s.seconds)))}` : null,
      },
    ],
  };

  let hist: HistChart | null = null;
  if (n >= 5) {
    /* Freedman–Diaconis picks the width, snapped to 250 m or capped at the
     * spec's 500 m: a wider bin would smear the 2 k / 5 k / 10 k comb that
     * is the whole point of this chart, and thin bins are dashed anyway. */
    const width = snapBinWidth(fdBinWidth(sortedM), [250, 500]);
    const xMax = Math.max(width, Math.ceil(quantile(sortedM, 0.99) / width) * width);
    const bins = histogram(meters, width, 0, xMax);
    const beyond = meters.filter((m) => m >= xMax).length;
    const step = tickStep(xMax, [500, 1000, 2000, 2500, 5000, 10000, 20000, 50000], 6);
    /* The comb: the round distances the field lands on most. */
    const spikes = new Map<number, number>();
    for (const s of sess) if (s.meters % 1000 === 0) spikes.set(s.meters, (spikes.get(s.meters) ?? 0) + 1);
    const top = [...spikes].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m).sort((a, b) => a - b);
    const shape = mM > medM * 1.05 ? "RIGHT-SKEWED" : mM < medM * 0.95 ? "LEFT-SKEWED" : "SYMMETRIC";
    const take =
      roundShare >= 0.35 && top.length
        ? `${shape} WITH A COMB — SPIKES AT ${top.map((m) => fmtInt(m)).join(" / ")} M`
        : `${shape} — MEDIAN ${fmtM(medM)}, MEAN ${fmtM(mM)}`;
    hist = {
      bins,
      xMin: 0,
      xMax,
      ticks: ticksBetween(0, xMax, step),
      beyond,
      mean: mM,
      sd: sdM,
      median: medM,
      yMax: niceCount(Math.max(...bins.map((b) => b.n))),
      take,
    };
  }
  const histYou: HistYou | null =
    hist && mine.length
      ? { rug: mine.map((s) => s.meters), line: myMedM, tag: `YOU · ${fmtM(myMedM)} · ${fmtP(pMyMedM)}` }
      : null;

  let kdeC: KdeChart | null = null;
  if (n >= 5) {
    const h = silverman(splits);
    const lo = Math.max(60, Math.min(100, Math.floor(quantile(sortedSp, 0.01) / 10) * 10));
    const hi = Math.min(900, Math.max(200, Math.ceil(quantile(sortedSp, 0.99) / 10) * 10));
    const xs = linspace(lo, hi, 120);
    const ys = kde(splits, h, xs);
    const step = tickStep(hi - lo, [10, 20, 30, 60, 120], 7);
    const sk = skewness(splits);
    const take =
      peaks(ys).length >= 2
        ? "TWO LOBES — THE FIELD ROWS AT TWO SPEEDS, NOT ONE"
        : Math.abs(sk) < 0.5
          ? "NEAR-NORMAL — THE ONE PLACE SD MEANS WHAT PEOPLE THINK IT MEANS"
          : `${sk > 0 ? "A SLOW TAIL" : "A FAST TAIL"} — TAKE THE SD BAND WITH A GRAIN OF SALT`;
    kdeC = {
      xs: xs.map(r1),
      ys: ys.map((v) => Math.round(v * 1e5) / 1e5),
      xMin: lo,
      xMax: hi,
      ticks: ticksBetween(lo, hi, step),
      mean: mSp,
      sd: sdSp,
      median: medSp,
      rug: thin(sortedSp, 240).map(r1),
      take,
    };
  }
  const kdeYou: KdeYou | null =
    kdeC && mine.length
      ? {
          rug: mine.map((s) => r1(s.split)),
          median: myMedSp,
          best: Math.min(...mine.map((s) => s.split)),
          tag: `YOU · ${fmtClock(myMedSp)} · ${splitYouP.toUpperCase()}`,
          bestTag: `BEST ${fmtClock(Math.min(...mine.map((s) => s.split)))}`,
        }
      : null;

  /* ------------------------------------------------ 2 · price of going long */
  const b = fit?.b ?? NaN;
  const rFit = fit?.r ?? NaN;
  const resSd = fit?.resSd ?? NaN;
  const resids = fit ? sess.map(resid) : [];
  const divFit = (div: string) => {
    if (!divOk(div)) return null;
    const ss = sess.filter((s) => byId.get(s.pid)?.division === div);
    return ss.length >= 3 ? linfit(ss.map((s) => s.lg), ss.map((s) => s.split)) : null;
  };
  const fM = divFit("M");
  const fF = divFit("F");
  const pred = (f: { a: number; b: number } | null, m: number) => (f ? f.a + f.b * Math.log2(m) : NaN);
  const myFit = fit && mine.length >= MIN_TREND ? linfit(mine.map((s) => s.lg), mine.map((s) => s.split)) : null;
  const myResids = fit ? mine.map(resid) : [];
  const myMeanResid = myResids.length ? mean(myResids) : NaN;
  const others3Eff = sortAsc(others3.map((r) => r.meanResid));
  const pMyEff = myOk ? 100 - percentileRank(others3Eff, myMeanResid) : NaN;
  const divN = (div: string, f: { n: number } | null) =>
    f ? `${fmtInt(divInfo(div).sessions)} ${div}` : `${div} too few`;

  const s2: Section = {
    title: "The price of going long",
    eyebrow: `PACING · SPLIT ~ LOG₂ DISTANCE · ${fmtInt(n)} ${plural(n, "SESSION")}`,
    tiles: [
      {
        n: fit ? `${signed(b)} s /500 m` : DASH,
        d: "per doubling of distance — the slope of the fit below (positive = slower the longer you go)",
        you: myFit ? `you: ${signed(myFit.b)} s per doubling` : mine.length ? "you: row 4 sessions for your own slope" : null,
      },
      {
        n: fit ? `r = ${fmtR(rFit)}` : DASH,
        d: "split × log distance — weak on purpose; the residual is the interesting part",
        you: myFit ? `you: r = ${fmtR(myFit.r)}` : null,
      },
      {
        n: fit ? `± ${fin(resSd)} s` : DASH,
        d: "residual SD · session-to-session intensity spread, comparable across a 2 k and a 10 k",
        you: myResids.length >= 2 ? `you: ± ${fin(sd(myResids))} s` : null,
      },
      {
        n: fM || fF ? `${fM ? fmtClock(pred(fM, 2000)) : DASH} / ${fF ? fmtClock(pred(fF, 2000)) : DASH}` : `${DASH} · too few in division`,
        d: `predicted split at 2,000 m, M / F · ${divN("M", fM)} · ${divN("F", fF)}`,
        you: fit && myResids.length ? `you: ${fmtClock(pred(fit, 2000) + myMeanResid)} at 2,000 m` : null,
      },
      {
        n: fM || fF ? `${fM ? signed(fM.b) : DASH} / ${fF ? signed(fF.b) : DASH} s` : `${DASH} · too few in division`,
        d: "decay per doubling, M / F — a flatter slope means the gap narrows with distance",
        you: null,
      },
    ],
  };

  /* Meters against seconds, plainly — the correlation the owner asked for by
   * name. It is nearly a straight line because a field rows at roughly one
   * pace, which is exactly why the split charts after it carry the story;
   * this one is here so the ask is answered, not declined. */
  let dur: DurChart | null = null;
  if (n >= 5) {
    const durFit = linfit(meters, secs);
    const sortedSec = sortAsc(secs);
    /* Both axes stop at the 99th percentile so one marathon row does not
     * fold the field into a corner; what is past them is the BEYOND note. */
    const xStep = tickStep(quantile(sortedM, 0.99), [500, 1000, 2000, 2500, 5000, 10000, 20000, 50000], 6);
    const xMax = Math.max(xStep, Math.ceil(quantile(sortedM, 0.99) / xStep) * xStep);
    const yMax = niceCount(quantile(sortedSec, 0.99) / 60) * 60;
    const inside = sess.filter((s) => s.meters <= xMax && s.seconds <= yMax);
    if (Number.isFinite(durFit.b) && xMax > 0 && yMax > 0) {
      const perFive = durFit.b * 500;
      dur = {
        pts: inside.filter(publicSess).map((s) => [s.meters, s.seconds]),
        xMax,
        xTicks: ticksBetween(0, xMax, xStep),
        yMax,
        beyond: n - inside.length,
        fit: { a: durFit.a, b: durFit.b },
        r: rMS,
        corner: `r = ${fmtR(rMS)} · SLOPE ${fmtClock(perFive)} /500 M`,
        take:
          rMS >= 0.9
            ? "A STRAIGHT LINE BECAUSE PEOPLE ROW AT ONE PACE — THE RESIDUAL IS SPLIT, NEXT CHART"
            : "LOOSER THAN ONE LINE — THE FIELD ROWS AT MORE THAN ONE PACE; THE SPLIT CHARTS BELOW SAY WHICH",
      };
    }
  }
  const durYou: DurYou | null =
    dur && mine.length
      ? {
          pts: mine.map((s) => [s.meters, s.seconds]),
          tag: `YOU · ${fmtInt(mine.length)} ${plural(mine.length, "SESSION")} · MEDIAN ${fmtMin(median(mine.map((s) => s.seconds)))} FOR ${fmtM(myMedM)}`,
        }
      : null;

  let pace: PaceChart | null = null;
  if (fit && n >= 5) {
    const lb = logBounds([250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000], sortedM[0], sortedM[n - 1]);
    const yMin = Math.max(60, Math.floor(quantile(sortedSp, 0.005) / 10) * 10);
    let yMax = Math.min(900, Math.ceil(quantile(sortedSp, 0.995) / 10) * 10);
    if (yMax <= yMin) yMax = yMin + 20;
    const ystep = tickStep(yMax - yMin, [10, 20, 30, 60, 120, 300], 6);
    const mag = Math.abs(b);
    pace = {
      pts: sess
        .filter((s) => publicSess(s) && s.split >= yMin && s.split <= yMax)
        .map((s) => [r3(s.lg), r1(s.split)]),
      xMin: Math.log2(lb.lo),
      xMax: Math.log2(lb.hi),
      xTicks: lb.ticks,
      yMin,
      yMax,
      yTicks: ticksBetween(yMin, yMax, ystep),
      fit: { a: fit.a, b: fit.b },
      resSd,
      corner: `r = ${fmtR(rFit)} · ${signed(b)} s /DOUBLING`,
      take: `LONGER IS ${b >= 0 ? "SLOWER" : "FASTER"}, BUT ONLY BY ~${mag < 2 ? mag.toFixed(1) : mag.toFixed(0)} S PER DOUBLING — THE SPREAD AT ANY DISTANCE IS FITNESS`,
    };
  }
  const paceYou: PaceYou | null =
    pace && mine.length
      ? {
          pts: mine.map((s) => [r3(s.lg), r1(s.split)]),
          fit: myFit ? { a: myFit.a, b: myFit.b } : null,
          tag: myFit
            ? `YOU ${myFit.b >= 0 ? "LOSE" : "GAIN"} ${Math.abs(myFit.b).toFixed(1)} s PER DOUBLING · FIELD ${signed(b)}`
            : `YOU · ${mine.length} ${plural(mine.length, "SESSION")} · ROW 4 FOR YOUR OWN LINE`,
        }
      : null;

  let residC: ResidChart | null = null;
  if (fit && n >= 5) {
    /* Clipped just inside the edge so a 30-second outlier lands in the last
     * bin instead of past it. */
    const clipped = resids.map((v) => clamp(v, -RESID_CLIP, RESID_CLIP - 0.001));
    const bins = histogram(clipped, 1, -RESID_CLIP, RESID_CLIP);
    const kxs = linspace(-RESID_CLIP, RESID_CLIP, 121);
    const kys = kde(clipped, silverman(clipped), kxs).map((d) => d * n);
    const sk = skewness(resids);
    const take =
      peaks(kys).length >= 2
        ? "TWO LOBES — TWO KINDS OF SESSION HIDING IN ONE FIELD"
        : sk < -0.4
          ? "LEFT-TAILED — A FEW SESSIONS FAR FASTER THAN THEIR DISTANCE PREDICTS"
          : sk > 0.4
            ? "RIGHT-TAILED — A FEW SESSIONS FAR SLOWER THAN THEIR DISTANCE PREDICTS"
            : `BELL-SHAPED — ±${resSd.toFixed(0)} S HOLDS 68 % OF EVERY SESSION`;
    residC = {
      bins,
      xMin: -RESID_CLIP,
      xMax: RESID_CLIP,
      ticks: [-20, -10, 0, 10, 20],
      sd: resSd,
      kdeXs: kxs.map(r1),
      kdeYs: kys.map(r2),
      yMax: niceCount(Math.max(...bins.map((x) => x.n), ...kys)),
      take,
    };
  }
  const residYou: ResidYou | null =
    residC && mine.length
      ? {
          rug: myResids.map((v) => r1(clamp(v, -RESID_CLIP, RESID_CLIP))),
          mean: myMeanResid,
          tag: myOk
            ? `YOU · ${signed(myMeanResid)} s · ${fmtP(pMyEff)}`
            : `YOU · ${signed(myMeanResid)} s · ROW 3 SESSIONS FOR A PERCENTILE`,
        }
      : null;

  /* ------------------------------------------------ 3 · how a total gets made */
  const totalsAll = rowersAll.map((r) => r.total);
  const totals3 = rowers3.map((r) => r.total);
  const sorted3 = sortAsc(totals3);
  const others3Totals = sortAsc(others3.map((r) => r.total));
  const sumAll = sum(totalsAll);
  const past100 = rowersAll.filter((r) => r.total >= GOAL_METERS).length;
  const past50 = rowersAll.filter((r) => r.total >= 50_000).length;
  const once = rowersAll.filter((r) => r.n === 1).length;
  const medSessions = median(rowersAll.map((r) => r.n));
  const rho = rowers3.length >= 3 ? spearman(rowers3.map((r) => r.n), rowers3.map((r) => r.meanLen)) : NaN;
  const logT = totals3.filter((t) => t > 0).map((t) => Math.log10(t));
  const lm = mean(logT);
  const ls = sd(logT);
  const has3 = rowers3.length > 0;
  const pMyTotal = myOk && my ? percentileRank(others3Totals, my.total) : NaN;
  const pMySessions = myOk && my ? percentileRank(sortAsc(others3.map((r) => r.n)), my.n) : NaN;
  const pMyLen = myOk && my ? percentileRank(sortAsc(others3.map((r) => r.meanLen)), my.meanLen) : NaN;
  const rowP = (p: number) => (myOk ? fmtP(p) : "row 3 sessions for a percentile");
  const gin = gini(totalsAll);

  const s3: Section = {
    title: "How a total gets made",
    eyebrow: `PER ROWER · SESSIONS × LENGTH · ${fmtInt(rowers3.length)} ${plural(rowers3.length, "ROWER")} WITH ≥3 SESSIONS`,
    tiles: [
      {
        n: has3 ? fmtM(median(totals3)) : DASH,
        d: has3
          ? `median total · mean ${fmtM(mean(totals3))} · SD ${fmtM(sd(totals3))}, drawn on the log axis below`
          : "median total · nobody has three sessions yet",
        you: my ? `you: ${fmtM(my.total)} · ${rowP(pMyTotal)}` : null,
      },
      {
        n: rowersAll.length ? fmtPct(topShare(totalsAll, 0.1)) : DASH,
        d: `of all meters rowed by the top 10 % of rowers · Gini ${fin(gin, 2)}`,
        you: my && sumAll > 0 ? `you: ${fmtPct(my.total / sumAll)} of all meters` : null,
      },
      {
        n: Number.isFinite(rho) ? `ρ = ${fmtR(rho)}` : DASH,
        d: `sessions × mean session length — ${
          rho < -0.1
            ? "people who go long go a little less often"
            : rho > 0.1
              ? "people who go long also go more often"
              : "how long you go says nothing about how often"
        }`,
        you: my ? `you: ${my.n} × ${fmtK(my.meanLen)}` : null,
      },
      {
        n: `${past100}`,
        d: `${plural(past100, "rower")} already past 100 K · ${past50} past 50 K`,
        you: my ? `you: ${fmtPct(my.total / GOAL_METERS)} of the way` : null,
      },
      {
        n: rowersAll.length ? `${+medSessions.toFixed(1)}` : DASH,
        d: `median sessions per rower · ${once} tried it once`,
        you: my ? `you: ${my.n} ${plural(my.n, "session")} · ${rowP(pMySessions)}` : null,
      },
    ],
  };

  let ecdfC: EcdfChart | null = null;
  if (rowers3.length >= 8 && shown3.length >= MIN_SHOWN) {
    const all = ecdf(sorted3);
    /* The hidden top are on the leaderboard by name, so the curve stops at
     * the highest total that is not theirs; the steps above it are the
     * +n BEYOND note. Percentiles stay measured against the whole field. */
    const cut = Math.max(...shown3.map((r) => r.total));
    const steps = all.filter(([x]) => x <= cut);
    const lb = logBounds(
      [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
      Math.max(1, sorted3[0]),
      Math.max(cut, GOAL_METERS, myOk && my ? my.total : 0),
    );
    const q25 = quantile(sorted3, 0.25);
    const q75 = quantile(sorted3, 0.75);
    ecdfC = {
      steps: steps.map(([x, p]) => [x, r1(p)]),
      xMin: lb.lo,
      xMax: lb.hi,
      ticks: lb.ticks,
      beyond: sorted3.length - steps.length,
      goal: GOAL_METERS,
      bracket: Number.isFinite(lm) && ls > 0 ? [Math.pow(10, lm - ls), Math.pow(10, lm + ls)] : null,
      take: `LOG-NORMAL-ISH — HALF THE FIELD IS INSIDE ${fmtK(q25)}–${fmtK(q75)}; READ YOUR RANK OFF THE CURVE`,
    };
  }
  let ecdfYou: EcdfYou | null = null;
  if (ecdfC && myOk && my) {
    const p = pMyTotal;
    let sub: string | null = null;
    if (p >= 90) sub = "YOU ARE IN THE TOP 10 %";
    else {
      const target = Math.min(90, Math.ceil((p + 1e-9) / 10) * 10);
      const need = quantile(others3Totals, target / 100) - my.total;
      if (need > 0) sub = `+${fmtM(need)} TO P${target}`;
    }
    ecdfYou = { x: my.total, p, tag: `YOU · ${fmtP(p)}`, sub };
  }

  let grind: GrindChart | null = null;
  if (rowers3.length >= 5 && shown3.length >= MIN_SHOWN) {
    /* Axes are sized to the dots that are drawn (plus the viewer's own), so
     * a hidden rower's position is not readable off an empty corner either. */
    const maxN = Math.max(...shown3.map((r) => r.n), myOk && my ? my.n : 0);
    const xstep = maxN <= 10 ? 2 : maxN <= 30 ? 5 : maxN <= 60 ? 10 : 20;
    const xMax = Math.ceil((maxN + 1) / xstep) * xstep;
    const lens = shown3.map((r) => r.meanLen);
    const lb = logBounds(
      [250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000],
      Math.min(...lens, myOk && my ? my.meanLen : Infinity),
      Math.max(...lens, myOk && my ? my.meanLen : 0),
    );
    const medLen = median(rowers3.map((r) => r.meanLen));
    grind = {
      pts: shown3.map((r) => [r.n, Math.round(r.meanLen)]),
      xMax,
      xTicks: ticksBetween(xstep, xMax, xstep),
      yMin: lb.lo,
      yMax: lb.hi,
      yTicks: lb.ticks,
      iso: [25_000, 50_000, 100_000],
      corner: `ρ = ${fmtR(rho)}`,
      take: `TWO ROUTES TO 100 K — 10 × 10 K OR 40 × 2.5 K — AND THE FIELD MOSTLY ${medLen >= 6000 ? "GOES LONG" : "GRINDS"}`,
    };
  }
  const between = (t: number) =>
    t >= 100_000 ? "PAST 100 K" : t >= 50_000 ? "BETWEEN 50 K AND 100 K" : t >= 25_000 ? "BETWEEN 25 K AND 50 K" : "UNDER 25 K";
  const grindYou: GrindYou | null =
    grind && myOk && my
      ? { pt: [my.n, Math.round(my.meanLen)], tag: `YOU · ${my.n} × ${fmtK(my.meanLen)} · ${between(my.total)}` }
      : null;

  /* ------------------------------------------------ 4 · when Rowtember rows */
  const hourCounts = Array<number>(24).fill(0);
  for (const s of sess) hourCounts[Math.floor(s.hour) % 24]++;
  let peakHour = 0;
  for (let h = 1; h < 24; h++) if (hourCounts[h] > hourCounts[peakHour]) peakHour = h;
  const before8 = has ? sess.filter((s) => s.hour < 8).length / n : NaN;
  const dayCounts = Array<number>(today).fill(0);
  for (const s of sess) if (s.day <= today) dayCounts[s.day - 1]++;
  let busiestIdx = 0;
  for (let i = 1; i < today; i++) if (dayCounts[i] > dayCounts[busiestIdx]) busiestIdx = i;
  const weekendShare = has ? sess.filter((s) => s.weekend).length / n : NaN;
  const wkMed = median(sess.filter((s) => s.weekend).map((s) => s.meters));
  const wdMed = median(sess.filter((s) => !s.weekend).map((s) => s.meters));
  const gapsOf = (days: number[]) => days.slice(1).map((d, i) => d - days[i]);
  const gaps = rowersAll.flatMap((r) => gapsOf(r.days));
  const medGap = median(gaps);
  const p90Gap = quantile(sortAsc(gaps), 0.9);
  /* A streak is counted back from today, or from yesterday when today's row
   * simply has not been logged yet — nobody loses a streak at breakfast. */
  const streakOf = (days: number[]) => {
    const set = new Set(days);
    const last = set.has(today) ? today : today - 1;
    let k = 0;
    while (last - k >= 1 && set.has(last - k)) k++;
    return k;
  };
  const streaks = rowersAll.map((r) => streakOf(r.days));
  const longest = Math.max(0, ...streaks);
  const noMiss = rowersAll.filter((r) => streakOf(r.days) >= Math.max(1, today - 1)).length;

  const myHours = mine.map((s) => s.hour);
  const myCirc = circularMean(myHours);
  const pos = (h: number) => (((h - 3) % 24) + 24) % 24;
  const earlierThan = has && mine.length ? sess.filter((s) => pos(s.hour) > pos(myCirc)).length / n : NaN;
  const myByDay = new Map<number, number>();
  for (const s of mine) myByDay.set(s.day, (myByDay.get(s.day) ?? 0) + s.meters);
  const myBusiest = [...myByDay].sort((a, c) => c[1] - a[1])[0] ?? null;
  const myGaps = my ? gapsOf(my.days) : [];

  const s4: Section = {
    title: "When Rowtember rows",
    eyebrow: "RHYTHM · LOGGED-AT TIMES, NOT ROW TIMES · PACIFIC",
    tiles: [
      {
        n: has ? `${fmtHour(peakHour)}–${fmtHour(peakHour + 1)}` : DASH,
        d: `peak logging hour · ${fmtPct(before8)} of sessions logged before 08:00`,
        you: mine.length ? `you: ${fmtHour(myCirc)} · earlier than ${fmtPct(earlierThan)}` : null,
      },
      {
        n: has ? fmtDayN(busiestIdx + 1) : DASH,
        d: has
          ? `busiest day · ${dayCounts[busiestIdx]} ${plural(dayCounts[busiestIdx], "session")}; days average ${fin(mean(dayCounts), 0)} ± ${fin(sd(dayCounts), 0)}`
          : "busiest day",
        you: myBusiest ? `you: busiest ${fmtDayN(myBusiest[0])} · ${fmtM(myBusiest[1])}` : null,
      },
      {
        n: has ? fmtPct(weekendShare) : DASH,
        d: `of sessions on a weekend · weekend median session ${fmtM(wkMed)} vs weekday ${fmtM(wdMed)}`,
        you: mine.length ? `you: ${fmtPct(mine.filter((s) => s.weekend).length / mine.length)} on weekends` : null,
      },
      {
        n: gaps.length ? `${+medGap.toFixed(1)} ${plural(medGap, "day")}` : DASH,
        d: gaps.length
          ? `median gap between a rower’s sessions · P90 gap ${+p90Gap.toFixed(1)} days`
          : "median gap between a rower’s sessions · nobody has two days yet",
        you: myGaps.length ? `you: median gap ${+median(myGaps).toFixed(1)} ${plural(median(myGaps), "day")}` : null,
      },
      {
        n: rowersAll.length ? `${longest} ${plural(longest, "day")}` : DASH,
        d: `longest current streak · ${noMiss} ${plural(noMiss, "rower")} ${noMiss === 1 ? "has" : "have"} not missed a day`,
        you: my ? `you: ${streakOf(my.days)}-day streak` : null,
      },
    ],
  };

  let hour: HourChart | null = null;
  if (n >= 5) {
    const grid = linspace(3, 27, 145);
    const kys = vonMisesKde(
      sess.map((s) => s.hour),
      grid,
    ).map((d) => d * n);
    hour = {
      counts: hourCounts,
      kdeGrid: grid.map(r2),
      kdeYs: kys.map(r2),
      start: 3,
      yMax: niceCount(Math.max(...hourCounts, ...kys)),
      take:
        peaks(kys).length >= 2
          ? "A DAWN CLUB AND AN AFTER-WORK CLUB — TWO LOBES, NOT ONE"
          : `ONE LOBE — THE FIELD LOGS AROUND ${fmtHour(peakHour)}`,
    };
  }
  const hourYou: HourYou | null =
    hour && mine.length
      ? { rug: myHours.map(r2), mean: myCirc, tag: `YOU · ${fmtHour(myCirc)} · EARLIER THAN ${Math.round(earlierThan * 100)} %` }
      : null;

  let dayc: DayChart | null = null;
  if (dayCounts.some((c) => c > 0)) {
    const roll = rollingMean(dayCounts, 7);
    const trend = today >= 8 ? roll[today - 1] - roll[today - 8] : NaN;
    const maxDay = Math.max(...dayCounts);
    const wkDays = dayCounts.filter((_, i) => weekendDay(i + 1));
    const wdDays = dayCounts.filter((_, i) => !weekendDay(i + 1));
    const bump = wkDays.length && wdDays.length && mean(wkDays) > mean(wdDays) * 1.1;
    const holding = Number.isFinite(trend)
      ? trend > 0.5
        ? "THE ROLLING MEAN IS CLIMBING"
        : trend < -0.5
          ? "THE ROLLING MEAN IS FADING"
          : "THE ROLLING MEAN IS HOLDING"
      : "TOO EARLY TO CALL THE ROLLING MEAN";
    dayc = {
      counts: dayCounts,
      rolling: roll.map(r2),
      weekend: dayCounts.map((_, i) => weekendDay(i + 1)),
      yMax: niceCount(maxDay),
      take: `${dayCounts[0] === maxDay && today > 1 ? "DAY-1 SPIKE, " : ""}${bump ? "WEEKEND BUMPS, " : ""}${holding}`,
    };
  }
  const daycYou: DayYou | null = mine.length
    ? { dots: mine.filter((s) => s.day <= today).map((s) => ({ day: s.day, meters: s.meters })) }
    : null;

  /* ------------------------------------------------ 5 · faster or slower */
  const centred: { day: number; c: number }[] = [];
  const rowerSlopes: number[] = [];
  for (const r of rowers4) {
    const rs = r.sess.map(resid);
    const m = mean(rs);
    r.sess.forEach((s, i) => centred.push({ day: s.day, c: rs[i] - m }));
    const f = linfit(
      r.sess.map((s) => s.day),
      rs,
    );
    if (Number.isFinite(f.b)) rowerSlopes.push(f.b);
  }
  const driftFit =
    fit && centred.length >= 8
      ? linfit(
          centred.map((p) => (p.day - 1) / 7),
          centred.map((p) => p.c),
        )
      : null;
  const faster = rowerSlopes.filter((v) => v < 0).length;
  const slower = rowerSlopes.filter((v) => v > 0).length;
  const weekFirst = (wi: number) => dayNum(WEEKS[wi].first);
  const weekLast = (wi: number) => dayNum(WEEKS[wi].last);
  let thisWeek = WEEKS.findIndex((w) => dayNum(w.first) <= today && today <= dayNum(w.last));
  if (thisWeek < 0) thisWeek = WEEKS.length - 1;
  const inWeek = (wi: number, s: Sess) => s.day >= weekFirst(wi) && s.day <= weekLast(wi) && s.day <= today;
  const thisWeekMed = median(sess.filter((s) => inWeek(thisWeek, s)).map((s) => s.meters));
  const w1Med = median(sess.filter((s) => inWeek(0, s)).map((s) => s.meters));
  const bestRecent = rowers4.filter((r) => r.bestDay >= today - 6).length;
  const myCentred: [number, number][] = (() => {
    if (!fit || mine.length < MIN_TREND) return [];
    const rs = mine.map(resid);
    const m = mean(rs);
    return mine.map((s, i) => [s.day, r1(clamp(rs[i] - m, -RESID_CLIP, RESID_CLIP))]);
  })();
  const myDrift =
    myCentred.length >= MIN_TREND
      ? linfit(
          myCentred.map((p) => p[0]),
          myCentred.map((p) => p[1]),
        )
      : null;
  const myThisWeek = median(mine.filter((s) => inWeek(thisWeek, s)).map((s) => s.meters));
  const myW1 = median(mine.filter((s) => inWeek(0, s)).map((s) => s.meters));

  const s5: Section = {
    title: "Faster or slower as the month goes on",
    eyebrow: `TREND · WITHIN-ROWER CHANGE · ${fmtInt(rowers4.length)} ${plural(rowers4.length, "ROWER")} WITH ≥4 SESSIONS`,
    tiles: [
      {
        n: driftFit ? `${signed(driftFit.b)} s /500 m per week` : DASH,
        d: driftFit
          ? `field drift · SE ${fin(driftFit.seB)} — ${Math.abs(driftFit.b) < 2 * driftFit.seB ? "small, and inside its own error" : "and it clears its error"}`
          : "field drift · needs more rowers with four sessions",
        you: myDrift ? `you: ${signed(myDrift.b * 7)} s /week` : mine.length ? "you: row 4 sessions to see your trend" : null,
      },
      {
        n: rowerSlopes.length ? `${faster} vs ${slower}` : DASH,
        d: `rowers getting faster vs slower · among ${rowers4.length} with ≥4 sessions`,
        you: myDrift ? `you: getting ${myDrift.b < 0 ? "faster" : myDrift.b > 0 ? "slower" : "neither"}` : null,
      },
      {
        n: Number.isFinite(thisWeekMed) && Number.isFinite(w1Med) ? `${fmtM(thisWeekMed)} vs ${fmtM(w1Med)}` : DASH,
        d: `this week’s median session vs week 1 — sessions are ${
          thisWeekMed > w1Med * 1.05 ? "stretching, not shrinking" : thisWeekMed < w1Med * 0.95 ? "shrinking" : "holding"
        }`,
        you: Number.isFinite(myThisWeek) && Number.isFinite(myW1) ? `you: ${fmtM(myThisWeek)} vs ${fmtM(myW1)}` : null,
      },
      {
        /* Until Sept 8 the last seven days are the whole month, so the share
         * is 100 % by construction and says nothing. */
        n: today >= 8 && rowers4.length ? fmtPct(bestRecent / rowers4.length) : DASH,
        d:
          today >= 8
            ? `of rowers set their best split in the last 7 days · ${bestRecent} ${plural(bestRecent, "rower")}`
            : "of rowers set their best split in the last 7 days · from Sept 8",
        you: my ? `you: best ${fmtClock(my.bestSplit)} on ${fmtDayN(my.bestDay)}` : null,
      },
    ],
  };

  let drift: DriftChart | null = null;
  if (driftFit) {
    const absC = sortAsc(centred.map((p) => Math.abs(p.c)));
    const yr = Math.max(10, Math.min(30, Math.ceil(quantile(absC, 0.975) / 5) * 5));
    const weekly: DriftChart["weekly"] = [];
    WEEKS.forEach((_, wi) => {
      const first = weekFirst(wi);
      const last = Math.min(weekLast(wi), today);
      if (first > today) return;
      const vals = centred.filter((p) => p.day >= first && p.day <= last).map((p) => p.c);
      if (vals.length < 3) return;
      weekly.push({ x: (first + last) / 2, med: r2(median(vals)), sd: r2(sd(vals)) });
    });
    drift = {
      pts: centred.map((p) => [p.day, r1(clamp(p.c, -RESID_CLIP, RESID_CLIP))]),
      weekly,
      yr,
      days: today,
      corner: `SLOPE ${signed(driftFit.b)} ± ${fin(driftFit.seB)} s /WEEK`,
      take: `DISTANCE AND FITNESS REMOVED — WHAT IS LEFT IS THE FIELD ${
        driftFit.b < -driftFit.seB ? "GETTING FASTER" : driftFit.b > driftFit.seB ? "GETTING SLOWER" : "HOLDING STEADY"
      }`,
    };
  }
  const driftYou: DriftYou | null =
    drift && mine.length
      ? myDrift
        ? { pts: myCentred, fit: { a: myDrift.a, b: myDrift.b }, tag: `YOU · ${signed(myDrift.b * 7)} s /WEEK` }
        : { pts: [], fit: null, tag: "ROW 4 SESSIONS TO SEE YOUR TREND" }
      : null;

  /* ------------------------------------------------ 6 · your place in the field */
  const proj = (t: number) => (t / today) * 30;
  const s6: Section = {
    title: "Your place in the field",
    eyebrow: me
      ? `PERCENTILES · YOU vs ${fmtInt(others3.length)}`
      : viewer.kind === "unjoined"
        ? "PERCENTILES · JOIN TO OVERLAY YOURS"
        : "PERCENTILES · SIGN IN TO OVERLAY YOURS",
    tiles: [
      { n: has3 ? fmtM(median(totals3)) : DASH, d: "median total meters" },
      { n: has3 ? `${+median(rowers3.map((r) => r.n)).toFixed(1)}` : DASH, d: "median sessions per rower" },
      { n: has3 ? `${signed(median(rowers3.map((r) => r.meanResid)))} s` : DASH, d: "median efficiency — s /500 m vs predicted" },
      { n: has3 ? fmtClock(median(rowers3.map((r) => r.medSplit))) : DASH, d: "median rower split" },
      { n: has3 ? fmtM(median(totals3.map(proj))) : DASH, d: "median projected total at current rate" },
    ],
  };

  let s6You: Tile[] | null = null;
  if (my) {
    const left = 30 - today;
    const rate = my.total / today;
    const daysTo = my.total >= GOAL_METERS ? 0 : rate > 0 ? Math.ceil((GOAL_METERS - my.total) / rate) : Infinity;
    const pTotalDiv =
      myOk && myDivOk
        ? percentileRank(
            sortAsc(others3.filter((r) => r.division === meDiv).map((r) => r.total)),
            my.total,
          )
        : NaN;
    const need3 = "row 3 sessions for a percentile";
    s6You = [
      {
        n: myOk ? fmtP(pMyTotal) : DASH,
        d: `total meters · ${fmtM(my.total)}${myOk ? (myDivOk ? ` · ${fmtP(pTotalDiv)} ${meDiv}` : "") : ` · ${need3}`}`,
      },
      { n: myOk ? fmtP(pMySessions) : DASH, d: `sessions · ${my.n} logged${myOk ? "" : ` · ${need3}`}` },
      {
        n: myOk ? fmtP(pMyEff) : DASH,
        d: `efficiency · ${signed(my.meanResid)} s /500 m vs predicted${myOk ? "" : ` · ${need3}`}`,
      },
      {
        n: myDivOk ? `${fmtP(pMySpDiv)} ${meDiv} · ${fmtP(pMySpAll)} all` : `${fmtP(pMySpAll)} all`,
        d: `median split ${fmtClock(my.medSplit)} · best ${fmtClock(my.bestSplit)} on ${fmtDayN(my.bestDay)}`,
      },
      {
        n: fmtM(proj(my.total)),
        d: `projected total at current rate · ${
          my.total >= GOAL_METERS
            ? "past 100 K already"
            : Number.isFinite(daysTo)
              ? `${daysTo} ${plural(daysTo, "day")} to 100 K at this pace`
              : "no pace yet"
        }, ${left} left in the month`,
      },
    ];
  }

  let ladder: LadderChart | null = null;
  if (rowers3.length >= 8) {
    const strip = (
      key: string,
      label: string,
      vals: number[],
      cands: number[],
      fmt: (v: number) => string,
      lowerBetter = false,
    ): LadderRow => {
      const sorted = sortAsc(vals.filter(Number.isFinite));
      let ticks = cands
        .filter((c) => sorted.length && c > sorted[0] && c < sorted[sorted.length - 1])
        .map((c) => ({
          p: r1(lowerBetter ? 100 - percentileRank(sorted, c) : percentileRank(sorted, c)),
          label: fmt(c),
        }));
      while (ticks.length > 5) ticks = ticks.filter((_, i) => i % 2 === 0);
      /* Density read along the percentile axis: at P(i) the field's KDE at
       * that quantile, tallest where values are packed. A strip with no
       * spread (or too few values for a bandwidth) gets no band. */
      const DENS_N = 40;
      let dens: number[] = [];
      if (sorted.length >= 8 && sorted[sorted.length - 1] > sorted[0]) {
        const h = silverman(sorted);
        const qs = Array.from({ length: DENS_N + 1 }, (_, i) => quantile(sorted, i / DENS_N));
        const raw = kde(sorted, h, qs);
        const top = Math.max(...raw);
        if (top > 0) {
          const along = raw.map((d) => r2(d / top));
          dens = lowerBetter ? along.reverse() : along;
        }
      }
      return { key, label, ticks, dens };
    };
    const splitPop = myDivOk ? rowers3.filter((r) => r.division === meDiv) : rowers3;
    const q = (p: number) => quantile(sorted3, p);
    ladder = {
      rows: [
        strip("total", "TOTAL METERS", totals3, [5000, 10000, 25000, 50000, 100000, 250000], fmtK),
        strip("sessions", "SESSIONS", rowers3.map((r) => r.n), [3, 5, 10, 20, 30, 50], String),
        strip("len", "MEAN SESSION", rowers3.map((r) => r.meanLen), [1000, 2000, 5000, 10000, 20000], fmtK),
        strip(
          "split",
          myDivOk ? `MEDIAN SPLIT · ${meDiv}` : "MEDIAN SPLIT",
          splitPop.map((r) => r.medSplit),
          [90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 240, 300],
          fmtClock,
          true,
        ),
        strip("eff", "EFFICIENCY", rowers3.map((r) => r.meanResid), [-20, -10, -5, 0, 5, 10, 20], (v) => `${signed(v, 0)} s`, true),
        strip("cv", "CONSISTENCY", rowers3.map((r) => r.cv), [0.1, 0.25, 0.5, 1], (v) => `CV ${v}`, true),
      ],
      take: `ONE GLANCE, SIX RANKS — P50→P60 IS ${fmtM(q(0.6) - q(0.5))} IN THE MIDDLE AND P80→P90 IS ${fmtM(q(0.9) - q(0.8))} NEAR THE TOP`,
    };
  }
  let ladderYou: LadderYou | null = null;
  if (ladder && my) {
    if (myOk) {
      const splitOthers = sortAsc((myDivOk ? others3.filter((r) => r.division === meDiv) : others3).map((r) => r.medSplit));
      const cvOthers = sortAsc(others3.map((r) => r.cv).filter(Number.isFinite));
      ladderYou = {
        p: [
          pMyTotal,
          pMySessions,
          pMyLen,
          100 - percentileRank(splitOthers, my.medSplit),
          pMyEff,
          Number.isFinite(my.cv) ? 100 - percentileRank(cvOthers, my.cv) : null,
        ].map((v) => (v !== null && Number.isFinite(v) ? r1(v) : null)),
        note: null,
      };
    } else {
      ladderYou = { p: [null, null, null, null, null, null], note: "ROW 3 SESSIONS FOR A PERCENTILE" };
    }
  }

  let fan: FanChart | null = null;
  let fanYou: FanYou | null = null;
  if (rowersAll.length >= 5 && today >= 2) {
    const cumOf = (list: Sess[]) => {
      const c = Array<number>(today).fill(0);
      for (const s of list) if (s.day <= today) c[s.day - 1] += s.meters;
      for (let i = 1; i < today; i++) c[i] += c[i - 1];
      return c;
    };
    const cums = rowersAll.map((r) => cumOf(r.sess));
    const q = (p: number) => Array.from({ length: today }, (_, i) => Math.round(quantile(sortAsc(cums.map((c) => c[i])), p)));
    fan = {
      days: today,
      p10: q(0.1),
      p25: q(0.25),
      p50: q(0.5),
      p75: q(0.75),
      p90: q(0.9),
      goal: GOAL_METERS,
      take: "AM I AHEAD OF A TYPICAL ROWER ON THIS DATE — BETTER THAN A RANK",
    };
    if (my) {
      const myCum = cumOf(mine);
      const now = myCum[today - 1];
      const otherNow = sortAsc(others.map((r) => cumOf(r.sess)[today - 1]));
      const p = percentileRank(otherNow, now);
      const rate = now / today;
      fanYou = {
        cum: myCum,
        proj: today < 30 ? [[today, now], [30, Math.round(now + rate * (30 - today))]] : null,
        label: `YOU · ${fmtP(p)} ON DAY ${today}`,
      };
    }
  }

  return {
    sessions: n,
    rowers: rowersAll.length,
    day: today,
    you: me ? { rowerNumber: me.rowerNumber, sessions: mine.length } : null,
    hideTop: Math.max(0, hideTop),
    s1,
    hist,
    histYou,
    kde: kdeC,
    kdeYou,
    s2,
    dur,
    durYou,
    pace,
    paceYou,
    resid: residC,
    residYou,
    s3,
    ecdf: ecdfC,
    ecdfYou,
    grind,
    grindYou,
    s4,
    hour,
    hourYou,
    dayc,
    daycYou,
    s5,
    drift,
    driftYou,
    s6,
    s6You,
    ladder,
    ladderYou,
    fan,
    fanYou,
  };
}

export type { FitLine };
