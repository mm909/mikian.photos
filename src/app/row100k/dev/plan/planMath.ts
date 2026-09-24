/* THE PLAN, as arithmetic (owner, 2026-09-24: "default the target to
 * 100,000 meters and remember whatever the user puts in … show how many
 * meters are needed and how many days are left … a calendar of the
 * remaining days with the meters split among them … let me change the
 * number for each day … click a day to turn it off … do NOT redistribute
 * the removed meters automatically: note that 3K is unallocated and needs
 * a home, and give me an AUTO DISTRIBUTE button").
 *
 * Pure functions over plain data, no React and no clock, so the tool and a
 * unit run (planMath.test.ts, npx tsx) agree by construction. Days are the
 * challenge's "YYYY-MM-DD" strings, never Date objects.
 *
 * The one rule that everything else follows from: a day holds the number
 * it has until somebody changes THAT day. Editing one day pins it and
 * moves nobody else; turning a day off keeps its number for when it comes
 * back and moves nobody else; what the plan then fails to cover is the
 * UNALLOCATED line, and AUTO DISTRIBUTE is the only thing that spreads it
 * — over the open days that were not set by hand. Changing the target is
 * the one exception (see setTarget), because a target moved by 400,000 m
 * with every day left where it was would be a plan for nothing. */

export const DEFAULT_TARGET = 100_000;
export const PLAN_VERSION = 1;

export type DayCell = {
  /* Planned meters for the day. Kept while the day is off. */
  m: number;
  /* True once the rower typed this day; AUTO DISTRIBUTE leaves it alone. */
  pinned: boolean;
  /* An off day counts for nothing and is drawn as such. */
  off: boolean;
};

export type Plan = {
  v: number;
  /* "2026-12" — a plan belongs to one month. */
  monthKey: string;
  target: number;
  /* The pace goal as typed ("1:59.9"); empty when none (owner: do not
   * prefill the average pace). */
  pace: string;
  days: Record<string, DayCell>;
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

/* A plan nobody has touched: the need spread evenly over every remaining
 * day, nothing pinned, nothing off. */
export function freshPlan(opts: {
  monthKey: string;
  monthDays: number;
  today: number;
  target: number;
  rowed: number;
  pace?: string;
}): Plan {
  const target = opts.target > 0 ? Math.round(opts.target) : DEFAULT_TARGET;
  const days = remainingDays(opts.monthKey, opts.monthDays, opts.today);
  const parts = evenSplit(needOf(target, opts.rowed), days.length);
  const cells: Record<string, DayCell> = {};
  days.forEach((d, i) => {
    cells[d] = { m: parts[i], pinned: false, off: false };
  });
  return { v: PLAN_VERSION, monthKey: opts.monthKey, target, pace: opts.pace ?? "", days: cells };
}

const cellOf = (plan: Plan, day: string): DayCell => plan.days[day] ?? { m: 0, pinned: false, off: false };

/* Meters the open remaining days add up to. */
export function plannedSum(plan: Plan, remaining: string[]): number {
  let s = 0;
  for (const d of remaining) {
    const c = cellOf(plan, d);
    if (!c.off) s += c.m;
  }
  return s;
}

/* Positive: meters the plan does not yet cover (needs a home). Negative:
 * the plan overshoots the need by that much. Zero: every meter placed. */
export function unallocated(plan: Plan, remaining: string[], need: number): number {
  return need - plannedSum(plan, remaining);
}

/* Days AUTO DISTRIBUTE may write: remaining, open, not set by hand. */
export function autoDays(plan: Plan, remaining: string[]): string[] {
  return remaining.filter((d) => {
    const c = cellOf(plan, d);
    return !c.off && !c.pinned;
  });
}

/* Spread what the pinned days do not cover evenly over the auto days. With
 * no auto day left there is nowhere to put it, and the plan is returned
 * as it was — the tool says so rather than moving a number the rower
 * typed. */
export function autoDistribute(plan: Plan, remaining: string[], need: number): Plan {
  const free = autoDays(plan, remaining);
  if (free.length === 0) return plan;
  let pinnedSum = 0;
  for (const d of remaining) {
    const c = cellOf(plan, d);
    if (!c.off && c.pinned) pinnedSum += c.m;
  }
  const parts = evenSplit(Math.max(0, need - pinnedSum), free.length);
  const days = { ...plan.days };
  free.forEach((d, i) => {
    days[d] = { ...cellOf(plan, d), m: parts[i] };
  });
  return { ...plan, days };
}

/* The rower typed a number for a day: it is pinned and on. Nobody else
 * moves (owner, 2026-09-24). */
export function setDay(plan: Plan, day: string, meters: number): Plan {
  const m = Math.max(0, Math.round(Number.isFinite(meters) ? meters : 0));
  return { ...plan, days: { ...plan.days, [day]: { m, pinned: true, off: false } } };
}

/* Off keeps its number (so on brings it back) and drops out of the sum. */
export function toggleOff(plan: Plan, day: string): Plan {
  const c = cellOf(plan, day);
  return { ...plan, days: { ...plan.days, [day]: { ...c, off: !c.off } } };
}

/* Hand a pinned day back to AUTO DISTRIBUTE. Its number stays until then. */
export function releaseDay(plan: Plan, day: string): Plan {
  const c = cellOf(plan, day);
  return { ...plan, days: { ...plan.days, [day]: { ...c, pinned: false } } };
}

/* A new target: remembered, and the auto days follow it. Pinned days and
 * off days stay exactly as typed. */
export function setTarget(plan: Plan, target: number, remaining: string[], rowed: number): Plan {
  const t = target > 0 ? Math.round(target) : DEFAULT_TARGET;
  const next = { ...plan, target: t };
  return autoDistribute(next, remaining, needOf(t, rowed));
}

/* Storage: one JSON blob per rower per browser. A saved plan for another
 * month is not this month's plan, but its target and pace goal carry over
 * (they are the rower's, not the month's). Anything unreadable is a fresh
 * plan. Remaining days a saved plan does not know about start at zero,
 * unpinned, so AUTO DISTRIBUTE can reach them. */
export function revivePlan(
  raw: string | null | undefined,
  ctx: { monthKey: string; monthDays: number; today: number; rowed: number },
): Plan {
  const fresh = (target: number, pace: string) =>
    freshPlan({ monthKey: ctx.monthKey, monthDays: ctx.monthDays, today: ctx.today, target, rowed: ctx.rowed, pace });
  if (!raw) return fresh(DEFAULT_TARGET, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fresh(DEFAULT_TARGET, "");
  }
  if (!parsed || typeof parsed !== "object") return fresh(DEFAULT_TARGET, "");
  const p = parsed as Partial<Plan>;
  const target = typeof p.target === "number" && p.target > 0 ? Math.round(p.target) : DEFAULT_TARGET;
  const pace = typeof p.pace === "string" ? p.pace : "";
  if (p.monthKey !== ctx.monthKey || !p.days || typeof p.days !== "object") return fresh(target, pace);
  const days: Record<string, DayCell> = {};
  for (const d of remainingDays(ctx.monthKey, ctx.monthDays, ctx.today)) {
    const c = (p.days as Record<string, Partial<DayCell> | undefined>)[d];
    days[d] = {
      m: c && typeof c.m === "number" && c.m >= 0 ? Math.round(c.m) : 0,
      pinned: c?.pinned === true,
      off: c?.off === true,
    };
  }
  return { v: PLAN_VERSION, monthKey: ctx.monthKey, target, pace, days };
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
 * rows were done. */
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

/* What a rower types into a day: "5000", "5,000", "5k", "7.5k". Null for
 * anything that is not a number of meters. */
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
