/* THE GHOSTS: rows already rowed, replayed from their own start beside the
 * row in progress (owner, 2026-11-22: "race yourself or different versions
 * of your past ... race ghosts"; "even better, I like the idea of racing
 * the people that you follow ... not racing their PRs ... just a row that
 * person had"; "start us at the same time").
 *
 * A ghost is one finished row over the distance the monitor is set to. The
 * site answers them (api/row100k/app/ghosts); this file is the arithmetic
 * the screen draws from, and nothing in it touches React or the network,
 * so it can be checked by a script (mobile/scripts/ghosts-check.ts). */

/* Whose row it is: the rower's own, a rower they follow, a race day
 * recording, anybody else on record ("field"), a pace boat (no row at all:
 * an even pace to a round finish, drawn when there is nobody real to put in
 * a lane), or a rower on the water this minute ("live"). */
export type GhostKind = "me" | "follow" | "race" | "field" | "pace" | "live";

export type Ghost = {
  /* The logged row, or the recording, it is. */
  id: string;
  kind: GhostKind;
  /* Whose: "You" is never sent; the screen says it for kind "me". */
  name: string;
  numStr: string;
  /* "AUG 12", and the year when it is not this one: "AUG 12 2025". */
  day: string;
  /* What it finished the distance in. */
  seconds: number;
  /* Its average stroke rate, for the oars; 0 when nobody knows. */
  spm: number;
  /* The seconds at which it crossed each 100 m line, the last being the
   * finish. Empty for a row logged by hand: that one is replayed at an even
   * pace, which is all anyone knows of it. */
  marks: number[];
  /* A rower on the water this minute only: how many seconds their clock is
   * ahead of the rower's own (they pulled first), or behind it under
   * nothing. Every other boat left the start with the rower. */
  ahead?: number;
};

export type Ghosts = {
  meters: number;
  ghosts: Ghost[];
};

const STEP = 100;

/* HOW FAR A GHOST HAD GOT, t seconds into its row. Even between the lines
 * it has marks for; even from start to finish when it has none. It stops
 * on the finish line and waits there. */
export function ghostMeters(g: Ghost, meters: number, at: number): number {
  const t = at + (g.ahead ?? 0);
  if (!(t > 0)) return 0;
  if (t >= g.seconds) return meters;
  const n = g.marks.length;
  if (n < 2) return (t / g.seconds) * meters;
  /* The lines are STEP apart but for the last, which is the finish. */
  let lo = 0;
  let hi = n - 1;
  if (t <= g.marks[0]) return (t / g.marks[0]) * Math.min(STEP, meters);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.marks[mid] <= t) lo = mid;
    else hi = mid;
  }
  const m0 = (lo + 1) * STEP;
  const m1 = hi === n - 1 ? meters : (hi + 1) * STEP;
  const span = g.marks[hi] - g.marks[lo];
  return span > 0 ? m0 + ((t - g.marks[lo]) / span) * (m1 - m0) : m1;
}

/* WHEN A GHOST CROSSED A LINE: the other way round of ghostMeters, the
 * second of its row at which it was `m` meters in. What the seconds between
 * two boats are read from (owner, 2026-11-22: "I don't think I care about
 * the number of meters behind me they are, but probably the number of
 * seconds that they are behind me"). */
export function ghostSeconds(g: Ghost, meters: number, m: number): number {
  return ownSeconds(g, meters, m) - (g.ahead ?? 0);
}

/* The same on the ghost's own clock, from its own start. */
function ownSeconds(g: Ghost, meters: number, m: number): number {
  if (!(m > 0)) return 0;
  if (m >= meters) return g.seconds;
  const n = g.marks.length;
  if (n < 2) return (m / meters) * g.seconds;
  const i = Math.min(Math.floor(m / STEP), n - 1);
  const m0 = i * STEP;
  const t0 = i === 0 ? 0 : g.marks[i - 1];
  const m1 = i === n - 1 ? meters : (i + 1) * STEP;
  return m1 > m0 ? t0 + ((m - m0) / (m1 - m0)) * (g.marks[i] - t0) : g.marks[i];
}

/* WHETHER A GHOST HAS FINISHED, t seconds into the rower's row, and how
 * long it has been rowing by then. */
export const ghostClock = (g: Ghost, t: number): number => Math.max(0, t + (g.ahead ?? 0));
export const ghostDone = (g: Ghost, t: number): boolean => t + (g.ahead ?? 0) >= g.seconds;

/* SPEEDING UP OR SLOWING DOWN (owner, 2026-11-22: "is there something we
 * can do to note whether or not a rower is speeding up or slowing down ...
 * can we tint the water behind them ... red when you're slowing down ...
 * green ... when you're speeding up"; "the coloring ... can be based off of
 * ... what are they doing over the last 100 meters or so"). The last 100 m
 * against the 100 m before it: from -1, slowing hard, to 1, speeding up
 * hard, and 0 while the two are within half a percent of each other (about
 * half a second on a 2:00 split). All of it at two and a half percent. */
export function trendOf(before: number, last: number): number {
  if (!(before > 0) || !(last > 0)) return 0;
  const r = (before - last) / before;
  const a = Math.min(1, Math.max(0, (Math.abs(r) - 0.005) / 0.02));
  return r > 0 ? a : -a;
}

/* The same for a ghost, t seconds in. A row of which only the time is
 * known is steady, and so is one that has finished or is not 200 m in. */
export function ghostTrend(g: Ghost, meters: number, t: number): number {
  if (g.marks.length < 2 || ghostDone(g, t)) return 0;
  const m = ghostMeters(g, meters, t);
  if (m < 2 * STEP) return 0;
  const a = ownSeconds(g, meters, m);
  const b = ownSeconds(g, meters, m - STEP);
  return trendOf(b - ownSeconds(g, meters, m - 2 * STEP), a - b);
}

/* HOW MANY SECONDS A GHOST IS AHEAD OF THE ROWER, t seconds in with the
 * rower at `mine`: the time since the ghost was where the rower is now.
 * Under nothing, it is behind, and that many seconds from getting there. */
export const leadSeconds = (g: Ghost, meters: number, t: number, mine: number): number => t - ghostSeconds(g, meters, mine);

/* A PACE BOAT: an even pace from the start to a round finish. Nobody rowed
 * it; it is what goes in a lane when no real row is near enough to be on
 * the water (owner, 2026-11-22: "we need to make sure we have rowers in
 * every lane"). The screen names it by its finish. */
export const paceBoat = (seconds: number): Ghost => ({ id: `pace:${seconds}`, kind: "pace", name: "", numStr: "", day: "", seconds, spm: 0, marks: [] });

/* WHICH LANE EACH GHOST ROWS IN. The rower has the middle one. The ghosts
 * are dealt out from it by how close their finish is to `near` (the finish
 * the rower is on pace for, or their usual one before there is a pace):
 * the closest above, the next below, the next two lanes out, and round
 * again. Rows that will be side by side in the water are then never in the
 * same lane, and a ghost keeps its lane for the whole row. Lanes count
 * from 0 at the top; `lanes` is odd. */
export function dealLanes(ghosts: Ghost[], lanes: number, near: number): Map<string, number> {
  const mid = (lanes - 1) / 2;
  const order: number[] = [];
  for (let k = 1; k <= mid; k++) order.push(mid - k, mid + k);
  const out = new Map<string, number>();
  if (!order.length) return out;
  const byGap = [...ghosts].sort((a, b) => Math.abs(a.seconds - near) - Math.abs(b.seconds - near) || a.id.localeCompare(b.id));
  byGap.forEach((g, i) => out.set(g.id, order[i % order.length]));
  return out;
}

/* A steady number in [0, 1) off an id: where a ghost is in its stroke when
 * the row starts, so a field of them does not row in step. */
export function phaseOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/* THE OAR, through one stroke. `p` is the place in the stroke, 0 at the
 * catch. The drive is the first 36 hundredths: the blade goes from ahead
 * of the pin to behind it, in the water. The rest is the way back, slower,
 * out of it. The angle is from square off the boat, positive toward the
 * bow. */
export const DRIVE = 0.36;
const CATCH = 0.96;
const FINISH = -0.62;
export function oarAngle(p: number): { angle: number; wet: boolean } {
  const q = p - Math.floor(p);
  if (q < DRIVE) {
    const u = q / DRIVE;
    /* Hard off the catch, easing to the finish. */
    return { angle: CATCH + (FINISH - CATCH) * (1 - (1 - u) * (1 - u)), wet: true };
  }
  const u = (q - DRIVE) / (1 - DRIVE);
  /* Hands away quick, then slow up the slide. */
  const e = u * u * (3 - 2 * u);
  return { angle: FINISH + (CATCH - FINISH) * e, wet: false };
}

/* HOW MANY ARE AHEAD AND BEHIND, t seconds in, of everything in the field. */
export function standing(ghosts: Ghost[], meters: number, t: number, mine: number): { ahead: number; behind: number } {
  let ahead = 0;
  let behind = 0;
  for (const g of ghosts) {
    const d = ghostMeters(g, meters, t) - mine;
    if (d > 0.5) ahead++;
    else if (d < -0.5) behind++;
  }
  return { ahead, behind };
}

/* ---- who to race ------------------------------------------------------ */

/* TWO ROWS OF ONE ROWER ARE NOT RACED AT ONCE, the rower's own past rows
 * among them (owner, 2026-11-22, of a race with two lanes that both said
 * You: "let's really try to not have multiple copies of the same person in
 * the race"). */
export const rowerKey = (g: Ghost): string => (g.kind === "me" ? "me" : g.kind === "pace" ? g.id : `r:${g.numStr || g.name}`);

/* HOW OFTEN A GHOST AND THE ROWER WOULD CHANGE PLACES, if the rower held
 * an even pace to `near`: the lead changing hands is what makes a race of
 * it (owner, 2026-11-22: "racers that are like intertwining with each
 * other ... one's going faster, one's going slower. That way, it's like a
 * close race"). Only a recorded row can do it; an even one never does. */
export function crossings(g: Ghost, meters: number, near: number): number {
  if (g.marks.length < 2 || !(near > 0)) return 0;
  let n = 0;
  let was = 0;
  for (let t = 30; t < Math.min(near, g.seconds); t += 20) {
    const d = ghostMeters(g, meters, t) - (t / near) * meters;
    const now = d > 2 ? 1 : d < -2 ? -1 : 0;
    if (now && was && now !== was) n++;
    if (now) was = now;
  }
  return n;
}

/* HOW GOOD A RIVAL A GHOST IS, in seconds, the lower the better: how far
 * its finish is from the finish the rower is headed for; less eight for a
 * recorded row, which is raced stroke for stroke and not as a line ("we
 * should prioritize people with telemetry data"); less two for each time
 * it would trade places with the rower, three at most. */
export function rivalCost(g: Ghost, meters: number, near: number): number {
  return Math.abs(g.seconds - near) - (g.marks.length >= 2 ? 8 : 0) - 2 * Math.min(3, crossings(g, meters, near));
}

/* THE FOUR TO RACE (owner, 2026-11-22: "these 4 other people need to give
 * me a close race"; "they've selected people that are going to be
 * relatively close to me by my finish time"). The best by rivalCost, with
 * two rules that a second pass lets go of when the field is too thin to
 * keep them: no more than two that finish ahead of `near` and two behind,
 * so there is somebody to chase and somebody to hold off. One row a rower
 * always, the rower's own past rows counted as one rower: a field too thin
 * to give four comes back short, and the screen fills the rest with pace
 * boats (it used to let a field of the rower's own rows off). `skip` holds the
 * rowers already on the water. `extra` adds to a ghost's cost (the screen
 * uses it to prefer a ghost that is near the rower right now when it
 * brings one in mid-row). */
export function pickRivals(ghosts: Ghost[], meters: number, near: number, n: number, skip: Set<string> = new Set(), extra?: (g: Ghost) => number): Ghost[] {
  const ranked = ghosts
    .filter((g) => !skip.has(rowerKey(g)))
    .map((g) => ({ g, c: rivalCost(g, meters, near) + (extra ? extra(g) : 0) }))
    .sort((a, b) => a.c - b.c || a.g.id.localeCompare(b.g.id));
  const out: Ghost[] = [];
  const used = new Set<string>();
  for (const strict of [true, false]) {
    for (const { g } of ranked) {
      if (out.length >= n) break;
      const key = rowerKey(g);
      if (g.kind === "pace" || out.includes(g) || used.has(key)) continue;
      if (strict) {
        const side = g.seconds < near ? 1 : -1;
        if (out.filter((o) => (o.seconds < near ? 1 : -1) === side).length >= Math.ceil(n / 2)) continue;
      }
      used.add(key);
      out.push(g);
    }
  }
  return out;
}

/* ---- who takes a lane that has come empty ------------------------------ */

/* The water in view: how many meters behind the rower and ahead of them a
 * boat can be and still be seen. */
export type Water = { back: number; front: number };
export type Next = { g: Ghost; on: boolean };

/* A boat is worth a lane when it is going to be on the water this long. */
const HOLD_S = 6;
/* A boat off the water is coming on when it will be there within this. */
const SOON_S = 8;

/* THE NEXT BOAT FOR AN EMPTY LANE (owner, 2026-11-22: "when the rowers went
 * off the screen, no one came to replace them"; "once a rower leaves, we
 * need a rower to fill in ... and we need rowers to fill from the back if
 * someone goes ahead of us"; "we need to make sure we have rowers in every
 * lane").
 *
 * Until that day a lane waited for a row that was off the water and coming
 * onto it at its own pace. Every boat leaves the start with the rower, so a
 * row far enough away to be off the water is nearly always one going
 * farther away, and the lane stayed empty. Now it is given at once to:
 *
 *  1. A real row, one a rower, that is on the water now (it was a dot in
 *     it) or will be within eight seconds, and will stay six or more. Of
 *     those: one on the side the old boat did not leave by (`want`: ahead
 *     when a boat was dropped, behind when one went away up the course),
 *     one that is about to pass or be passed, a recorded row, and the one
 *     that will be on the water longest.
 *     Never a second row of a rower who is racing already. For a few
 *     hours of 2026-11-22 it was, before a pace boat, and the owner's
 *     first row with it had four lanes in his own name: "4 of these rowers
 *     are me. Fix it".
 *  2. Failing any, a pace boat: an even pace to the nearest round finish
 *     on that side of the finish the rower is headed for (`near`), every
 *     five seconds, and every second when none of those is on the water.
 *
 * `on` says the boat is on the water already, so the screen brings it up
 * out of the water where it is, and does not slide it in from an edge. */
export function nextBoat(o: { ghosts: Ghost[]; meters: number; t: number; mine: number; speed: number; near: number; water: Water; racing: Ghost[]; want: -1 | 0 | 1 }): Next | null {
  const { ghosts, meters, t, mine, speed, near, water, racing, want } = o;
  const keys = new Set(racing.map(rowerKey));
  const ids = new Set(racing.map((g) => g.id));
  const gap = (g: Ghost, at: number, m: number) => ghostMeters(g, meters, at) - m;
  /* Where a boat is, which way it is going against the rower (meters a
   * second, over the next ten at the rower's average), and how long it has
   * on the water. Null when it is not worth the lane. */
  const look = (g: Ghost) => {
    const d = gap(g, t, mine);
    const v = (gap(g, t + 10, mine + 10 * speed) - d) / 10;
    const on = d >= -water.back && d <= water.front;
    if (!on) {
      const wait = d > water.front && v < -0.02 ? (d - water.front) / -v : d < -water.back && v > 0.02 ? (-water.back - d) / v : Infinity;
      if (wait > SOON_S) return null;
    }
    const from = Math.max(-water.back, Math.min(water.front, d));
    const stay = Math.abs(v) < 0.02 ? 600 : v > 0 ? (water.front - from) / v : (from + water.back) / -v;
    if (stay < HOLD_S) return null;
    return { d, on, stay, side: (d >= 0 ? 1 : -1) as -1 | 1, pass: (d > 1 && v < -0.02) || (d < -1 && v > 0.02) };
  };

  let best: Next | null = null;
  let least = Infinity;
  /* ONE ROW A ROWER, ALWAYS: nobody is in two lanes. */
  for (const g of ghosts) {
    if (g.kind === "pace" || ids.has(g.id) || keys.has(rowerKey(g)) || ghostDone(g, t)) continue;
    const s = look(g);
    if (!s) continue;
    const cost = -Math.min(s.stay, 120) * 0.4 - (s.pass ? 40 : 0) - (want && s.side === want ? 30 : 0) - (g.marks.length >= 2 ? 15 : 0) - (g.kind === "live" ? 1000 : 0) + Math.abs(s.d) * 0.3;
    if (cost < least) {
      least = cost;
      best = { g, on: s.on };
    }
  }
  if (best || !(near > 0)) return best;

  for (const step of [5, 1]) {
    const base = Math.round(near / step) * step;
    for (let k = -30; k <= 30; k++) {
      const g = paceBoat(base + k * step);
      if (!(g.seconds > 0) || ids.has(g.id)) continue;
      const s = look(g);
      if (!s) continue;
      const side = g.seconds <= near ? 1 : -1;
      const cost = Math.abs(g.seconds - near) + (want && side !== want ? 1000 : 0);
      if (cost < least) {
        least = cost;
        best = { g, on: s.on };
      }
    }
    if (best) break;
  }
  return best;
}
