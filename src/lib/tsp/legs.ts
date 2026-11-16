/**
 * WHO RUNS WHAT (owner, 2026-11-16: "I would like to be able to assign
 * sections to runners … in mile chunks … we default it to a mile, but if I'm
 * running mile 34 through 36, maybe I could drag … from 36 to halfway to 37
 * … that person should be able to filter through all the sections that
 * they're running … how long it is, the mileage, what the elevation is, how
 * long until they're running this segment").
 *
 * A LEG is a stretch of the course and the member down to run it. Distances
 * are HUNDREDTHS OF A MILE (cm: 3650 = mile 36.5), whole numbers so two
 * phones never disagree by a float. The plan is a list of legs that do not
 * overlap; gaps are allowed (nobody is down for those miles yet).
 *
 * It is a PLAN, said as one (owner: "sometimes the runners who are assigned
 * routes won't be the ones running them … we're gonna have to call an
 * audible"): anyone on the team can change it from the van, and the times
 * hang off where the team actually is, not off the plan.
 *
 * Pure and isomorphic — the page computes on the client, the API checks the
 * same rules on the server.
 */

export type Leg = { startCm: number; endCm: number; memberId: string | null };

/** A course is never longer than this (400 miles), and a plan never has more legs. */
export const MAX_CM = 40_000;
export const MAX_LEGS = 800;

export const cmToMi = (cm: number) => cm / 100;
export const miText = (cm: number) => (cm % 100 === 0 ? String(cm / 100) : (cm / 100).toFixed(cm % 10 === 0 ? 1 : 2));

/** Sorted by start. */
export const sortLegs = <T extends Leg>(legs: T[]): T[] => [...legs].sort((a, b) => a.startCm - b.startCm || a.endCm - b.endCm);

/** The rules: whole numbers inside the course, start before end, no overlaps. Returns the message, or null. */
export function checkLegs(legs: Leg[], lengthCm: number = MAX_CM): string | null {
  if (legs.length > MAX_LEGS) return `A plan holds at most ${MAX_LEGS} legs.`;
  const sorted = sortLegs(legs);
  for (let i = 0; i < sorted.length; i++) {
    const l = sorted[i];
    if (!Number.isInteger(l.startCm) || !Number.isInteger(l.endCm)) return "Miles go to two decimals at most.";
    if (l.startCm < 0 || l.endCm > Math.min(MAX_CM, lengthCm)) return `Mile ${miText(l.startCm)}–${miText(l.endCm)} runs off the course.`;
    if (l.endCm <= l.startCm) return `A leg ends after it starts (mile ${miText(l.startCm)}).`;
    if (i > 0 && l.startCm < sorted[i - 1].endCm) return `Two legs overlap around mile ${miText(l.startCm)}.`;
  }
  return null;
}

/**
 * THE ROTATION: from one mile to another in equal chunks, the runners taking
 * turns in the order given — how a relay is actually planned (nobody types
 * 340 rows). The last chunk is whatever is left.
 */
export function rotation(args: { fromCm: number; toCm: number; legCm: number; order: string[] }): Leg[] {
  const out: Leg[] = [];
  const { fromCm, toCm, legCm, order } = args;
  if (legCm < 10 || toCm <= fromCm) return out;
  let k = 0;
  for (let s = fromCm; s < toCm && out.length < MAX_LEGS; s += legCm, k++) {
    out.push({ startCm: s, endCm: Math.min(toCm, s + legCm), memberId: order.length ? order[k % order.length] : null });
  }
  return out;
}

/** Lay `fresh` over `legs`: anything it covers is cut away (a leg it splits keeps both ends). */
export function overlay(legs: Leg[], fresh: Leg[]): Leg[] {
  let out = [...legs];
  for (const f of fresh) {
    const next: Leg[] = [];
    for (const l of out) {
      if (l.endCm <= f.startCm || l.startCm >= f.endCm) {
        next.push(l);
        continue;
      }
      if (l.startCm < f.startCm) next.push({ ...l, endCm: f.startCm });
      if (l.endCm > f.endCm) next.push({ ...l, startCm: f.endCm });
    }
    next.push(f);
    out = next;
  }
  return sortLegs(out);
}

/**
 * Move one end of a leg (the "drag": owner, "drag … from 36 to halfway to
 * 37"). A neighbour that touched that end moves with it, so the handoff
 * stays one point; nothing is pushed past its own other end.
 */
export function moveEdge(legs: Leg[], index: number, edge: "start" | "end", toCm: number, lengthCm: number): Leg[] {
  const out = sortLegs(legs).map((l) => ({ ...l }));
  const l = out[index];
  if (!l) return out;
  if (edge === "end") {
    const next = out[index + 1];
    const touching = next && next.startCm === l.endCm;
    const max = touching ? next.endCm - 10 : next ? next.startCm : lengthCm;
    const v = Math.max(l.startCm + 10, Math.min(max, toCm));
    l.endCm = v;
    if (touching) next.startCm = v;
  } else {
    const prev = out[index - 1];
    const touching = prev && prev.endCm === l.startCm;
    const min = touching ? prev.startCm + 10 : prev ? prev.endCm : 0;
    const v = Math.min(l.endCm - 10, Math.max(min, toCm));
    l.startCm = v;
    if (touching) prev.endCm = v;
  }
  return out;
}

/* ─── The clock ──────────────────────────────────────────────────────────── */

/** A pace outside this window is a bad fix or a van ride, not a pace. */
export const PACE_MIN_SEC = 4 * 60;
export const PACE_MAX_SEC = 25 * 60;

export type Progress = {
  /** Where the team is, hundredths of a mile, or null when nobody has shared a position on the course. */
  atCm: number | null;
  /** When that position was taken (ms). */
  atMs: number | null;
  /** Seconds a mile the times run on. */
  paceSec: number;
  /** "moving": worked out from the start and the position. "planned": the team's planned pace. */
  source: "moving" | "planned";
};

/**
 * The pace the times run on. NO PACE IS TYPED during the race (the lasd26
 * rule): once the team has a start time and a position past mile 1, the
 * pace is the clock since the start over the miles covered; until then, and
 * whenever that reads as nonsense, it is the planned pace.
 */
export function progressOf(args: { startMs: number | null; planPaceSec: number; atCm: number | null; atMs: number | null }): Progress {
  const { startMs, planPaceSec, atCm, atMs } = args;
  if (startMs !== null && atCm !== null && atMs !== null && atCm >= 100 && atMs > startMs) {
    const pace = (atMs - startMs) / 1000 / (atCm / 100);
    if (pace >= PACE_MIN_SEC && pace <= PACE_MAX_SEC) return { atCm, atMs, paceSec: pace, source: "moving" };
  }
  return { atCm, atMs, paceSec: planPaceSec, source: "planned" };
}

/**
 * When the team reaches a point on the course (ms), or null when there is
 * nothing to hang a clock on (no position and no start time). Behind the
 * team's position it is null too — that mile is done.
 */
export function etaMs(p: Progress, startMs: number | null, cm: number): number | null {
  if (p.atCm !== null && p.atMs !== null) {
    if (cm < p.atCm) return null;
    return p.atMs + ((cm - p.atCm) / 100) * p.paceSec * 1000;
  }
  if (startMs !== null) return startMs + (cm / 100) * p.paceSec * 1000;
  return null;
}

/** "in 1 h 20 min", "in 8 min", "now". */
export function inText(ms: number, nowMs: number): string {
  const min = Math.round((ms - nowMs) / 60000);
  if (min <= 0) return "now";
  if (min < 60) return `in ${min} min`;
  return `in ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** "3:40 AM" Pacific, with the weekday once it is not today. */
export function clockText(ms: number, nowMs: number): string {
  const tz = "America/Los_Angeles";
  const t = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(ms));
  const day = (x: number) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(x));
  return day(ms) === day(nowMs) ? t : `${t} ${day(ms).toUpperCase()}`;
}

export const durText = (sec: number) => {
  const min = Math.round(sec / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
};
export const paceText = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
