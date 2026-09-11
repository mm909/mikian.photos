import { splitSeconds } from "@/lib/row100k";
import { linspace, mean, quantile, sd, silverman, sortAsc } from "@/lib/rowStats";
import { fmtClock, fmtInt } from "../analysis/fmt";
import type { KdeChart, KdeYou } from "../analysis/model";
import { DISTANCE_TOL } from "../logSort";
import { SPLIT_HI, SPLIT_LO, densityOn, thin, tickStep, ticksBetween, type FieldEntry } from "./field";

/* THE 5K AND THE 10K as distributions of TIME (owner ask, spoken
 * 2026-09-11): "a KDE for showing the distribution of five k times — anyone
 * that has finished the five k — and then another KDE, so two KDEs: one
 * with my five k attempts, one with their five k attempts. Also the same
 * thing for ten ks." Not a race-day surface: it belongs beside the two
 * densities the rower-facing stats already carry (field.ts), which is why
 * it is built here with the same machinery and drawn in the same frame.
 *
 * One chart per distance, two curves on one axis of time — THE FIELD
 * (everybody who has rowed that distance) and YOU (the viewer's own
 * attempts) — so a rower can see where their attempts sit inside the room.
 *
 * WHAT COUNTS AS AN ATTEMPT — a row within DISTANCE_TOL (50 m) of the
 * distance, the same tolerance the log's own 5k/10k filter uses (logSort.ts
 * — owner, 2026-09-10: "some tolerance, plus or minus fifty meters"). It is
 * deliberately NOT the record board's rule: boards.fastest pro-rates any
 * piece at or over the distance down to it (computeBoards, row100k.ts), so
 * a 40k lands on the 5k board as a 5k time. That is a fine way to rank a
 * best and a lie inside a distribution of 5k attempts — a 5k is a piece a
 * rower sat down to row, and the shape of the field is the shape of those.
 * The time is the time on the monitor, never scaled to exactly 5,000 m: the
 * tolerance the owner chose is what it is, and a rowed time is a rowed one.
 *
 * THE FIELD IS EVERYBODY, the viewer included. A distribution of the room
 * is the room; leaving the viewer out would give two rowers two different
 * field curves for the same room. The YOU curve sits on top of it.
 *
 * BLACKOUT — the AGGREGATES need no masking and get none. While a window is
 * open THE ELITE lose their METERS, not their clock: a fastest 5k or 10k is
 * public on the stats page and the record pages regardless (records/defs.ts
 * liteRecords, "their TIMES stay" — owner, 2026-09-08). So the curve, the
 * median, the SD and the counts are the whole room to everybody, and nothing
 * in this model carries meters.
 *
 * The individual MARKS are the other half of the rule, and field.ts already
 * decided it: "an unlabelled tick at a known distance is still that rower's
 * number." Here the distance is not just known, it is the chart's title, so
 * every grey rug tick is a (meters, time) pair for somebody — and a time
 * over a known distance is the meters by another route (blackoutRules.ts,
 * the owner's own words). The records carve-out is ONE record row per
 * distance, not every session a rower logged. So the rug leaves out a rower
 * this viewer's blackout is hiding, exactly as buildField's rugs do, and
 * every figure beside it still counts everyone. */

export const DISTANCE_KDES = [5000, 10000] as const;

export type DistanceKde = {
  /* the nominal distance — 5000 or 10000, never anybody's meters */
  meters: number;
  label: string;
  field: KdeChart;
  /* the viewer's own attempts; null when they have none (or nobody is
   * signed in / the surface is the field-only one) */
  you: KdeYou | null;
  fieldN: number;
  fieldRowers: number;
  youN: number;
  /* the one honest line under the chart: what counted as an attempt. The
   * surface may add one more clause, when a rower has too few attempts for
   * a curve of their own (DistanceKdes.tsx). */
  take: string;
};

const GRID = 120;
/* The grey rug is a thinned sample, never more than this many ticks. */
const RUG = 240;

/* HOW FEW IS TOO FEW.
 *
 * The field curve follows field.ts's MIN_KDE: five attempts is the floor a
 * density gets drawn at anywhere on this page. Five from ONE rower is not a
 * field, though — it is that rower's week with a stranger's name on it, and
 * the FIELD and YOU curves would be the same hill twice — so a second rower
 * is required as well.
 *
 * YOU gets a CURVE at three attempts. With one or two, the marks and the
 * count say it better: a bandwidth over two points is just the gap between
 * them, so the "density" is two bumps restating the rug and implying a shape
 * nobody rowed. Three is the fewest that carries anything the marks do not.
 * Under three the rug, the median and the best still draw, and the tag says
 * how many attempts they are.
 *
 * THE SAME OBJECTION DOES NOT STOP AT TWO, though (review, 2026-09-11), and
 * that is what YOU_SMOOTH is for. Silverman's rule is tuned for a sample big
 * enough to have a shape; over three or six attempts it picks a width near
 * the gaps between them and hands back a lobe per cluster — six rows inside
 * three minutes came out as THREE modes, which is the chart claiming a
 * training pattern out of noise while its own foot line says height is
 * shape. So a small YOU sample is deliberately OVER-smoothed: the bandwidth
 * is widened by sqrt(YOU_SMOOTH / n) — x2.0 at three attempts, x1.4 at six,
 * and nothing at all from twelve up, where the rule of thumb is doing what
 * it was built for. Over every curve this draws on today's field it takes
 * the multi-lobed ones from 8 in 20 to 3, and it leaves the one rower with
 * twenty-five attempts exactly as he was — his two humps are a real split
 * between his easy and his hard 5k, not an artefact.
 *
 * The floor under the bandwidth is one GRID STEP. The viewer's density is
 * sampled on the field's own 120-point grid (that is what puts both curves
 * on one axis), and a kernel narrower than a step draws a needle between two
 * samples: three attempts inside ten seconds would light a single grid point
 * and peak up to half a step away from the blue MED line drawn beside it. A
 * curve the grid cannot resolve is not an honest curve, so it is widened
 * until it can. */
const MIN_FIELD = 5;
const MIN_FIELD_ROWERS = 2;
const MIN_YOU_CURVE = 3;
const YOU_SMOOTH = 12;

/* THE FENCE on the axis, in two parts (the axis note in buildOne says why
 * one is needed at all).
 *
 * The outer part is TUKEY'S: past the quartiles give or take 1.5 IQRs is the
 * textbook definition of an outlier, and it does not tighten as the field
 * grows. A fence measured in BANDWIDTHS does — Silverman's h falls off as
 * n^-0.2 — so it closes in exactly as more rowers arrive: measured on the
 * live 5k field, four bandwidths threw 17 of 103 real attempts off the frame,
 * while Tukey's throws 4 and still holds the hill.
 *
 * The inner part is a FLOOR of three bandwidths either side of the median,
 * for the field whose middle half is a single second — five rowers at 20:00
 * and one beginner at 90:00 — where the IQR is zero and Tukey alone would
 * fence the axis down to nothing. Whichever of the two is wider wins.
 *
 * Measured (live rows, 2026-09-11), as half-height width of the field curve
 * in grid points of 120: live 5k 33 unfenced -> 42; live 10k with two
 * beginner rows added 24 -> 40; the five-at-20:00-plus-a-90:00 field 1 (a
 * literal spike) -> 26. */
const FENCE_IQR = 1.5;
const FENCE_BW = 3;

const r1 = (v: number) => Math.round(v * 10) / 10;

/* A row is an attempt at `target` when it lands inside the tolerance, was
 * timed, and its split is inside the field's own sanity band (field.ts: a
 * split outside 60–600 s is a typo, not a row). */
function attemptsAt(entries: FieldEntry[], target: number): FieldEntry[] {
  const out: FieldEntry[] = [];
  for (const e of entries) {
    if (Math.abs(e.meters - target) > DISTANCE_TOL) continue;
    if (!(e.meters > 0) || !(e.seconds > 0)) continue;
    const split = splitSeconds(e.meters, e.seconds);
    if (split < SPLIT_LO || split > SPLIT_HI) continue;
    out.push(e);
  }
  return out;
}

/* The bandwidth the viewer's own curve is drawn at: Silverman's, widened for
 * a small sample (YOU_SMOOTH) and never narrower than the grid it will be
 * sampled on. Both halves are there because the alternative draws lobes and
 * needles the attempts cannot support — see the note above. */
function youBandwidth(mine: number[], grid: number[]): number {
  const gridStep = (grid[grid.length - 1] - grid[0]) / (grid.length - 1);
  const widen = Math.max(1, Math.sqrt(YOU_SMOOTH / mine.length));
  return Math.max(silverman(mine) * widen, gridStep);
}

function buildOne(
  entries: FieldEntry[],
  target: number,
  meId: string | null,
  isHidden: (participantId: string) => boolean,
): DistanceKde | null {
  const attempts = attemptsAt(entries, target);
  const rowers = new Set(attempts.map((a) => a.participantId));
  if (attempts.length < MIN_FIELD || rowers.size < MIN_FIELD_ROWERS) return null;

  const times = attempts.map((a) => a.seconds);
  const sorted = sortAsc(times);
  const mine = meId ? attempts.filter((a) => a.participantId === meId).map((a) => a.seconds) : [];
  const mineSorted = sortAsc(mine);

  /* THE AXIS is time, faster on the left, and both curves share it.
   *
   * It opens on the field's middle 96 % with a bandwidth of air either side,
   * and is then FENCED (FENCE_IQR / FENCE_BW above). The fence is the half
   * that does the work: a quantile excludes nothing in a small field — under
   * fifty attempts the 98th percentile IS the slowest or second-slowest row
   * — so one legal 90-minute 5k would stretch the frame until the field was
   * a spike two samples wide. What the fence cuts is still inside every
   * figure — the curve, the median, the mean, the SD and the counts — it
   * simply has no tick on the rug. (The take used to say how many; the
   * owner took that clause off, 2026-09-11.)
   *
   * Then widened, when it has to be, to hold the viewer's own attempts: a
   * rower off the end of the axis would see no marks at all, and their
   * renormalised curve would peak against the frame edge reading as "you are
   * here". Widening never changes the field's shape — the same density is
   * simply sampled over more of the line.
   *
   * The last clamp is the sanity band the rows already passed, measured at
   * the TOLERANCE's edges (target ± DISTANCE_TOL) and not at the nominal
   * distance: a 5,050 m row at the slow edge of the band is a legal attempt
   * worth 6,060 s, and a clamp computed from 5,000 m would pull the frame
   * back in and put the attempt it was just widened to hold outside it.
   * Snapped out to whole ticks last. */
  const bw = silverman(times);
  const med = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iq = q3 - q1;
  const fenceLo = Math.min(q1 - FENCE_IQR * iq, med - FENCE_BW * bw);
  const fenceHi = Math.max(q3 + FENCE_IQR * iq, med + FENCE_BW * bw);
  let lo = Math.max(quantile(sorted, 0.02) - 1.5 * bw, fenceLo);
  let hi = Math.min(quantile(sorted, 0.98) + 1.5 * bw, fenceHi);
  if (mineSorted.length) {
    lo = Math.min(lo, mineSorted[0] - 0.5 * bw);
    hi = Math.max(hi, mineSorted[mineSorted.length - 1] + 0.5 * bw);
  }
  lo = Math.max(((target - DISTANCE_TOL) / 500) * SPLIT_LO, lo);
  hi = Math.min(((target + DISTANCE_TOL) / 500) * SPLIT_HI, hi);
  const step = tickStep(hi - lo, [10, 15, 30, 60, 120, 300, 600], 7);
  lo = Math.max(0, Math.floor(lo / step) * step);
  hi = Math.ceil(hi / step) * step;
  if (!(hi > lo)) return null;
  const grid = linspace(lo, hi, GRID);
  /* The rug is the one thing on this chart that is not everybody: field.ts's
   * rule, applied where the distance is the title (see the blackout note at
   * the top). Aggregates count the room; the ticks leave out a rower this
   * viewer's blackout is hiding. */
  const shown = sortAsc(attempts.filter((a) => !isHidden(a.participantId)).map((a) => a.seconds));
  const field: KdeChart = {
    xs: grid.map(r1),
    ys: densityOn(times, grid),
    xMin: lo,
    xMax: hi,
    ticks: ticksBetween(lo, hi, step),
    mean: mean(times),
    sd: sd(times),
    median: med,
    rug: thin(shown, RUG).map(r1),
    take: "",
  };

  /* YOU: the marks always, the curve only once there are enough attempts to
   * justify one. `best` is left NaN for a single attempt — the median line
   * is already standing on it, and KdeSvg draws neither a line nor a tag
   * for a best that is not a number. */
  let you: KdeYou | null = null;
  if (mineSorted.length) {
    const n = mineSorted.length;
    const myMed = quantile(mineSorted, 0.5);
    const best = n > 1 ? mineSorted[0] : NaN;
    const count = `${n} ${n === 1 ? "ATTEMPT" : "ATTEMPTS"}`;
    you = {
      rug: mine.map(r1),
      median: myMed,
      best,
      tag: n === 1 ? `YOU · ${fmtClock(myMed)} · ${count}` : `YOU · MED ${fmtClock(myMed)} · ${count}`,
      bestTag: n > 1 ? `BEST ${fmtClock(best)}` : "",
      ...(n >= MIN_YOU_CURVE ? { ys: densityOn(mine, grid, youBandwidth(mine, grid)) } : {}),
    };
  }

  const label = `${Math.round(target / 1000)}k`;
  return {
    meters: target,
    label,
    field,
    you,
    fieldN: attempts.length,
    fieldRowers: rowers.size,
    youN: mineSorted.length,
    /* TIMED rows, said out loud: an untimed 5,000 m row sits inside the
     * tolerance and shows up under the log's own 5K filter (logSort.ts tests
     * the meters and nothing else), but it has no clock, so it cannot be in
     * a distribution of times. Saying "rows" would put this count at odds
     * with the log tab next to it the first time somebody logs a 5k without
     * a time. */
    /* Trimmed to the two facts a reader needs to know what they are
     * looking at (owner, 2026-09-11: NOTHING SCALED DOWN FROM A LONGER
     * PIECE and the BEYOND THE FRAME count both came off). The rule itself
     * has not changed — a pro-rated long row is still not an attempt. */
    take:
      `${attempts.length} TIMED ROWS WITHIN ${DISTANCE_TOL} M OF ${fmtInt(target)} M · ` +
      `${rowers.size} ROWERS`,
  };
}

/* One entry per distance that clears the floor, in DISTANCE_KDES order.
 * `meId` is the rower the YOU curve belongs to — the page's rower on a
 * profile, null on the field-only stats page. `isHidden` is the viewer's
 * blackout, and it touches the rug alone (see the note at the top); both
 * callers already hold one for buildField. It defaults to nobody hidden so a
 * check script or a future caller with no board in hand still builds. */
export function buildDistanceKdes(
  entries: FieldEntry[],
  meId: string | null,
  isHidden: (participantId: string) => boolean = () => false,
): DistanceKde[] {
  const out: DistanceKde[] = [];
  for (const target of DISTANCE_KDES) {
    const one = buildOne(entries, target, meId, isHidden);
    if (one) out.push(one);
  }
  return out;
}
