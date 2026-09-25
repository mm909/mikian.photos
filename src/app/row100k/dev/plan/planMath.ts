/* THE PLAN, as arithmetic (owner, 2026-09-25: "Simplify the calendar:
 * days are ON or OFF, plus what was actually done. Past days show what I
 * rowed. Going forward, clicking a day turns it off, clicking again turns
 * it on, and the remaining meters are redistributed automatically across
 * the on days. That's it." — which retired the 2026-09-24 model of
 * per-day numbers, pinned days, an UNALLOCATED line and AUTO DISTRIBUTE).
 *
 * Pure functions over plain data, no React and no clock, so the tool and a
 * unit run (planMath.test.ts, npx tsx) agree by construction. Days are the
 * challenge's "YYYY-MM-DD" strings, never Date objects.
 *
 * The one rule: nothing is stored per day but whether it is off. What a
 * day holds is always the need split evenly over the days that are on,
 * so every toggle, every row logged and every change of target
 * redistributes by itself. */

export const DEFAULT_TARGET = 100_000;
/* v2: the on/off model. A v1 blob (per-day cells) is read for its target,
 * pace and off days and nothing else. */
export const PLAN_VERSION = 2;

export type Plan = {
  v: number;
  /* "2026-12" — a plan belongs to one month. */
  monthKey: string;
  target: number;
  /* The pace goal as typed ("1:59.9"). NULL means the rower never touched
   * it and the field shows their current average split (owner,
   * 2026-09-25: "fill the pace goal in with their current average pace,
   * still optional"); "" means they cleared it, and no goal is drawn. */
  pace: string | null;
  /* The days turned off, "YYYY-MM-DD", any order. */
  off: string[];
};

export function dayKey(monthKey: string, n: number): string {
  return `${monthKey}-${String(n).padStart(2, "0")}`;
}

/* The days still to row, today included: day 15 of 31 leaves 17. */
export function remainingDays(monthKey: string, monthDays: number, today: number): string[] {
  const from = Math.min(monthDays, Math.max(1, today));
  const out: string[] = [];
  for (let n = from; n <= monthDays; n++) out.push(dayKey(monthKey, n));
  return out;
}

export function needOf(target: number, rowed: number): number {
  return Math.max(0, Math.round(target) - Math.round(rowed));
}

/* `total` split into `n` whole-meter parts that add back up to `total`,
 * the remainder going one meter each to the first days. */
export function evenSplit(total: number, n: number): number[] {
  if (n <= 0) return [];
  const t = Math.max(0, Math.round(total));
  const base = Math.floor(t / n);
  const extra = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export function isOff(plan: Plan, day: string): boolean {
  return plan.off.includes(day);
}

/* The remaining days that are on, in order. */
export function onDays(plan: Plan, remaining: string[]): string[] {
  return remaining.filter((d) => !isOff(plan, d));
}

/* What each on day holds: the need over the on days, even to the meter.
 * Off days are absent from the result. */
export function planned(plan: Plan, remaining: string[], need: number): Record<string, number> {
  const on = onDays(plan, remaining);
  const parts = evenSplit(need, on.length);
  const out: Record<string, number> = {};
  on.forEach((d, i) => {
    out[d] = parts[i];
  });
  return out;
}

/* Click a day: off, or on again. Days outside the month are ignored. */
export function toggleOff(plan: Plan, day: string): Plan {
  if (!day.startsWith(plan.monthKey + "-")) return plan;
  const off = isOff(plan, day) ? plan.off.filter((d) => d !== day) : [...plan.off, day].sort();
  return { ...plan, off };
}

/* A new target: remembered; the split follows it by construction. */
export function setTarget(plan: Plan, target: number): Plan {
  return { ...plan, target: target > 0 ? Math.round(target) : DEFAULT_TARGET };
}

export function setPace(plan: Plan, pace: string): Plan {
  return { ...plan, pace };
}

/* A plan nobody has touched: every day on, the pace following the
 * average. */
export function freshPlan(opts: { monthKey: string; target?: number; pace?: string | null }): Plan {
  const target = opts.target !== undefined && opts.target > 0 ? Math.round(opts.target) : DEFAULT_TARGET;
  return { v: PLAN_VERSION, monthKey: opts.monthKey, target, pace: opts.pace === undefined ? null : opts.pace, off: [] };
}

/* Storage: one JSON blob per rower per browser. A saved plan for another
 * month is not this month's plan, but its target and pace goal carry over
 * (they are the rower's, not the month's). Anything unreadable is a fresh
 * plan. Off days that have already passed are dropped, so the list does
 * not grow all month. */
export function revivePlan(raw: string | null | undefined, ctx: { monthKey: string; monthDays: number; today: number }): Plan {
  if (!raw) return freshPlan({ monthKey: ctx.monthKey });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return freshPlan({ monthKey: ctx.monthKey });
  }
  if (!parsed || typeof parsed !== "object") return freshPlan({ monthKey: ctx.monthKey });
  const p = parsed as { v?: unknown; monthKey?: unknown; target?: unknown; pace?: unknown; off?: unknown; days?: unknown };
  const target = typeof p.target === "number" && p.target > 0 ? Math.round(p.target) : DEFAULT_TARGET;
  /* A v1 plan never prefilled the pace, so its "" is untouched, not
   * cleared. */
  const pace = typeof p.pace === "string" ? (p.pace === "" && p.v !== PLAN_VERSION ? null : p.pace) : null;
  if (p.monthKey !== ctx.monthKey) return freshPlan({ monthKey: ctx.monthKey, target, pace });
  const remaining = new Set(remainingDays(ctx.monthKey, ctx.monthDays, ctx.today));
  let off: string[] = [];
  if (Array.isArray(p.off)) {
    off = p.off.filter((d): d is string => typeof d === "string" && remaining.has(d));
  } else if (p.days && typeof p.days === "object") {
    /* v1 kept a cell per day with an off flag. */
    for (const [d, c] of Object.entries(p.days as Record<string, { off?: unknown } | null>)) {
      if (c && c.off === true && remaining.has(d)) off.push(d);
    }
  }
  return { v: PLAN_VERSION, monthKey: ctx.monthKey, target, pace, off: off.sort() };
}

/* ------------------------------------------------------------- the pace */

/* "1:59.9" or "2:05" into seconds per 500 m; null for anything else. */
export function parseSplit(v: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?:\.(\d))?\s*$/.exec(v);
  if (!m) return null;
  const s = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 10 : 0);
  return s > 0 ? s : null;
}

export function clock(s: number): string {
  const t = Math.round(s * 10);
  return `${Math.floor(t / 600)}:${String(Math.floor((t % 600) / 10)).padStart(2, "0")}.${t % 10}`;
}

/* The split the REST of the meters must be rowed at for the whole target
 * to average the goal. Zero or negative means the time already rowed
 * passes the goal on its own; under 60 s is faster than any human. */
export function requiredSplit(target: number, goalSplit: number, rowedM: number, rowedS: number): number {
  const left = target - rowedM;
  if (left <= 0) return 0;
  const goalSeconds = (target / 500) * goalSplit;
  return (goalSeconds - rowedS) / (left / 500);
}

/* The running average split after rowing on from (rowedM, rowedS) to `m`
 * meters at `split` — the curve the chart draws from now to the target. */
export function projectedAvg(rowedM: number, rowedS: number, split: number, m: number): number {
  if (m <= 0) return split;
  return (rowedS + ((m - rowedM) / 500) * split) / (m / 500);
}

/* The rower's running average, one point per timed row, in the order the
 * rows were done. The last point is the month's average split — what the
 * pace goal is filled in with. */
export function runningAverage(rows: { day: string; meters: number; seconds: number }[]): { m: number; s: number; day: string }[] {
  let m = 0;
  let s = 0;
  const out: { m: number; s: number; day: string }[] = [];
  for (const r of rows) {
    if (!(r.meters > 0) || !(r.seconds > 0)) continue;
    m += r.meters;
    s += r.seconds;
    out.push({ m, s: s / (m / 500), day: r.day });
  }
  return out;
}

/* What a rower types for the target: "100000", "100,000", "100k",
 * "7.5k". Null for anything that is not a number of meters. */
export function parseMetersText(text: string): number | null {
  const t = text.trim().replace(/,/g, "").toLowerCase();
  if (t === "") return null;
  const k = /^(\d+(?:\.\d+)?)\s*k$/.exec(t);
  if (k) return Math.round(Number(k[1]) * 1000);
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

/* "10k", "3.5k", "800" — what fits in a calendar cell. */
export function fmtK(m: number): string {
  if (m < 1000) return String(Math.round(m));
  /* To the nearest hundred, so 6,950 reads 7k and not 7.0k. */
  const k = Math.round(m / 100) / 10;
  return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
}
