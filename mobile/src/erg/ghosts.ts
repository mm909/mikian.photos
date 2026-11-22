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

export type GhostKind = "me" | "follow" | "race";

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
};

export type Ghosts = {
  meters: number;
  ghosts: Ghost[];
};

const STEP = 100;

/* HOW FAR A GHOST HAD GOT, t seconds into its row. Even between the lines
 * it has marks for; even from start to finish when it has none. It stops
 * on the finish line and waits there. */
export function ghostMeters(g: Ghost, meters: number, t: number): number {
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
export const rowerKey = (g: Ghost): string => (g.kind === "me" ? "me" : `r:${g.numStr || g.name}`);

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
 * so there is somebody to chase and somebody to hold off; and one row a
 * rower, the rower's own past rows counted as one rower, which a field of
 * nothing but the rower's own rows is let off. `skip` holds the
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
      if (out.includes(g) || (used.has(key) && (strict || key !== "me"))) continue;
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
