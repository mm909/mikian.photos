import { prng } from "./rng";
import { rollChest, type Chest } from "./skins";

/* "159", THE FIRST GAME (owner, 2026-11-24). It is named for his pace, 1:59
 * a 500, and it is about HOLDING A PACE: a 250 m single-player game the
 * director drops into a row, about a minute at 1:59.
 *
 * ONE GAME, start to end:
 *   TITLE   about five seconds of the wall: the briefcase with the 159 on
 *           it, and the flip dots showing 1:59 and then turning into the
 *           rower's own pace, LOCK IN YOUR PACE. Whatever pace they hold as
 *           it ends is the LOCKED pace. Nothing is asked of them: the pace
 *           is the one they were already rowing (the research's safety
 *           rule, ARCADE-RESEARCH.md E: never cue an all-out effort).
 *   PLAY    four stretches of 50 m of the row's own water. The boat sits in
 *           the middle and the rocks go round it; it aims by itself. At the
 *           end of each 50 m it fires. The shot HITS when the pace sat in
 *           the band for HIT_SHARE of that 50 m: the big rock breaks in two,
 *           the halves and the little one break up. Four hits clear the
 *           field: a WIN. A stretch that missed still fires, and now and
 *           then hits anyway, LUCKY ("you just got lucky" still counts).
 *           Nothing is steered: the only control is holding the pace.
 *   RESULT  a couple of seconds: FIELD CLEAR, or whatever rocks are left
 *           come in on the boat and it blows up.
 *   REWARD  about five seconds: the chest drops and opens (skins.ts).
 *
 * THE BAND is the rower's own steadiness: plus or minus one standard
 * deviation of their stroke-to-stroke pace over the strokes before the game
 * (the owner's "1 SD of their pace"), kept to between 1.5 and 4 seconds a
 * 500, and 3 when there were too few strokes to say. THE LOCK is the mean
 * of the last six strokes as the card ends; THE NEEDLE the mean of the last
 * three: one stroke a second off does not throw a stretch, a pace that has
 * moved does. While the needle is off the boat
 * WOBBLES, more the further off it is.
 *
 * THE ROW'S METERS for the stretches, THE WALL'S SECONDS for the cards: a
 * demo row covers the water ten times as fast as a clock, and eyes do not.
 * Only the title card is cut short by the water too (TITLE_MAX_M), so a demo
 * at forty times a clock still gets to the rocks.
 *
 * Pure: fed ticks, it answers the view. No React and no clock of its own,
 * so scripts/arcade-check.ts rows whole games through it. */

export type GTick = { now: number; m: number; pace: number; spm: number; strokes: number; ended?: boolean };

export type Phase = "title" | "play" | "result" | "reward" | "done" | "gone";

/* A rock going round the boat: how far out (r, a share of half the field),
 * where round it started (a0, radians) and how fast (w, radians a second of
 * the wall), from `born`. `dies` is the moment a shot reaches it. Size 3 is
 * the big one, 2 its halves, 1 the little one. */
export type Rock = { id: string; size: 1 | 2 | 3; born: number; dies: number | null; r: number; a0: number; w: number; spin: number; seed: number };
export type Shot = { n: number; at: number; hit: boolean; lucky: boolean; target: string | null; share: number };

export type View159 = {
  id: string;
  startM: number;
  phase: Phase;
  /* When this phase began, by the wall. */
  since: number;
  /* Plus or minus, seconds a 500, and how many strokes it was read off. */
  band: number;
  bandN: number;
  /* The mean of the last three strokes, seconds a 500; 0 before there is one. */
  needle: number;
  /* The pace locked as the title ended; 0 until then. */
  locked: number;
  /* How far the needle is from the locked pace (over nothing: slower). */
  off: number;
  inBand: boolean;
  /* 0 still, 1 shaking as much as it will. */
  wobble: number;
  /* Where play started, which stretch is up, how far into it, and how much
   * of it so far sat in the band. */
  playFrom: number;
  seg: number;
  segM: number;
  segShare: number;
  shots: Shot[];
  rocks: Rock[];
  won: boolean | null;
  chest: Chest | null;
};

export const SEG_M = 50;
export const SHOTS = 4;
export const PLAY_M = SEG_M * SHOTS;
/* Of a stretch's meters, the share in the band that makes a hit. */
export const HIT_SHARE = 0.6;
/* The chance a stretch that missed hits anyway. */
export const LUCK = 0.15;
export const BAND_MIN = 1.5;
export const BAND_MAX = 4;
export const BAND_NONE = 3;
/* Strokes the band is read off, and the fewest it is believed from. */
export const BAND_STROKES = 30;
const BAND_LEAST = 8;
const NEEDLE_N = 3;
/* The lock is the mean of a few more: what they have been holding, not the
 * one stroke the card happened to end on. */
const LOCK_N = 6;
/* Seconds of the wall. */
export const TITLE_S = 5;
/* The flip dots show 1:59 this long before they turn into the rower's pace. */
export const TITLE_159_S = 1.6;
export const TITLE_MAX_M = 150;
export const RESULT_S = 2.4;
export const REWARD_S = 5.5;
export const FLIGHT_S = 0.35;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const okPace = (p: number) => p > 40 && p < 600;

/* The band out of the strokes before the game. */
export function bandOf(paces: number[]): { band: number; n: number } {
  const v = paces.filter(okPace).slice(-BAND_STROKES);
  if (v.length < BAND_LEAST) return { band: BAND_NONE, n: v.length };
  /* A stroke ten seconds off the middle is a stop or a start, not
   * steadiness: it is held to the edge of that. */
  const mid = [...v].sort((a, b) => a - b)[v.length >> 1];
  const w = v.map((p) => clamp(p, mid - 10, mid + 10));
  const mean = w.reduce((s, p) => s + p, 0) / w.length;
  const sd = Math.sqrt(w.reduce((s, p) => s + (p - mean) * (p - mean), 0) / (w.length - 1));
  return { band: clamp(sd, BAND_MIN, BAND_MAX), n: v.length };
}

export type Game159 = { step(t: GTick): View159; view(): View159 };

/* `recent`: the pace of each of the strokes before the game, oldest first.
 * `seed`: the game's luck, the rocks and the chest. */
export function createGame159({ id, startM, now, recent, seed }: { id: string; startM: number; now: number; recent: number[]; seed: number }): Game159 {
  const rnd = prng(seed);
  const { band, n: bandN } = bandOf(recent);
  const strokes: number[] = recent.filter(okPace).slice(-LOCK_N);
  let lastStrokes = -1;
  let lastM = startM;
  let inM = 0;
  let segDone = 0;

  const a0 = rnd() * Math.PI * 2;
  const rocks: Rock[] = [
    { id: "big", size: 3, born: now, dies: null, r: 0.74, a0, w: 0.32, spin: 0.4, seed: Math.floor(rnd() * 1e6) },
    { id: "small", size: 1, born: now, dies: null, r: 0.86, a0: a0 + Math.PI * 0.9, w: -0.46, spin: -0.9, seed: Math.floor(rnd() * 1e6) },
  ];
  let v: View159 = { id, startM, phase: "title", since: now, band, bandN, needle: 0, locked: 0, off: 0, inBand: false, wobble: 0, playFrom: 0, seg: 0, segM: 0, segShare: 0, shots: [], rocks: [...rocks], won: null, chest: null };

  const meanOf = (n: number) => {
    const v = strokes.slice(-n);
    return v.length ? v.reduce((s, p) => s + p, 0) / v.length : 0;
  };
  const needle = () => meanOf(NEEDLE_N);
  const angleAt = (k: Rock, t: number) => k.a0 + k.w * (t - k.born);
  const alive = (t: number) => rocks.filter((k) => k.dies === null && k.born <= t + FLIGHT_S + 0.01);

  /* The end of a stretch: the shot, and what it does. */
  const fire = (now: number, share: number) => {
    const hit = share >= HIT_SHARE;
    const lucky = !hit && rnd() < LUCK;
    /* It aims at the biggest rock there is, the first of two the same. */
    const target = alive(now).sort((a, b) => b.size - a.size)[0] ?? null;
    if ((hit || lucky) && target) {
      const at = now + FLIGHT_S;
      target.dies = at;
      if (target.size === 3) {
        const a = angleAt(target, at);
        for (const side of [-1, 1]) {
          rocks.push({ id: `${target.id}${side < 0 ? "a" : "b"}`, size: 2, born: at, dies: null, r: clamp(target.r + side * 0.08, 0.64, 0.92), a0: a + side * 0.18, w: side * (0.55 + rnd() * 0.25), spin: side * 1.3, seed: Math.floor(rnd() * 1e6) });
        }
      }
    }
    v.shots = [...v.shots, { n: v.shots.length + 1, at: now, hit, lucky, target: target?.id ?? null, share }];
  };

  return {
    view: () => v,
    step(t) {
      const { now, m } = t;
      v = { ...v };
      /* A stroke: its pace goes on the needle. */
      if (t.strokes !== lastStrokes) {
        if (lastStrokes >= 0 && t.strokes > lastStrokes && okPace(t.pace)) {
          strokes.push(t.pace);
          while (strokes.length > LOCK_N) strokes.shift();
        }
        lastStrokes = t.strokes;
      }
      const dm = Math.max(0, m - lastM);
      lastM = Math.max(lastM, m);
      v.needle = needle();

      /* The row ended under the game: it goes, and gives nothing; a game
       * that was over already plays its cards out. */
      if (t.ended && (v.phase === "title" || v.phase === "play")) {
        v.phase = "gone";
        v.since = now;
        return v;
      }

      if (v.phase === "title") {
        if (now - v.since >= TITLE_S || m - startM >= TITLE_MAX_M) {
          const lock = meanOf(LOCK_N) || (okPace(t.pace) ? t.pace : 0);
          if (!lock) return v;
          v.locked = lock;
          v.phase = "play";
          v.since = now;
          v.playFrom = m;
          lastM = m;
        }
        return v;
      }

      if (v.phase === "play") {
        v.off = v.needle ? v.needle - v.locked : v.band * 3;
        const x = Math.abs(v.off) / v.band;
        v.inBand = !!v.needle && x <= 1;
        v.wobble = clamp((x - 0.6) / 1.4, 0, 1);
        /* The meters of this tick, a stretch at a time: one tick can cross
         * the end of a stretch (a demo row at forty times a clock covers
         * fifteen meters in one). */
        let left = dm;
        while (left > 0 && segDone < SHOTS) {
          const room = SEG_M - v.segM;
          const take = Math.min(left, room);
          if (v.inBand) inM += take;
          v.segM += take;
          left -= take;
          if (v.segM >= SEG_M - 1e-6) {
            fire(now, inM / SEG_M);
            segDone++;
            inM = 0;
            v.segM = 0;
          }
        }
        v.seg = segDone;
        v.segShare = v.segM > 0 ? inM / v.segM : 0;
        v.rocks = rocks.map((k) => ({ ...k }));
        if (segDone >= SHOTS) {
          v.won = rocks.every((k) => k.dies !== null);
          v.phase = "result";
          v.since = now;
          v.wobble = v.won ? 0 : v.wobble;
        }
        return v;
      }

      if (v.phase === "result" && now - v.since >= RESULT_S) {
        v.phase = "reward";
        v.since = now;
        v.chest = rollChest(rnd, !!v.won);
        return v;
      }
      if (v.phase === "reward" && now - v.since >= REWARD_S) {
        v.phase = "done";
        v.since = now;
      }
      return v;
    },
  };
}

/* Where a rock is at `t`: its angle round the boat. */
export function rockAngle(k: Rock, t: number): number {
  return k.a0 + k.w * (t - k.born);
}
