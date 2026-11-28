import { useEffect, useRef, useSyncExternalStore } from "react";
import { api } from "../api";
import { clubRowing, useClub } from "../club";
import type { Ghost } from "./ghosts";
import type { Erg } from "./useErg";

/* THE ROWERS ON THE WATER THIS MINUTE (owner, 2026-11-22: "you should work
 * on supporting this live. We don't have to turn it on right now ... if me
 * and someone else are across the world and someone's rowing a 5K, and I'm
 * also rowing a 5K, I should be able to see them, and they should be
 * noted").
 *
 * NOT ON. The site answers `on: false` until the owner turns it on there
 * (api/row100k/app/live, ROW_LIVE_RACE), and at that word this file stops
 * asking until the next piece. Nothing in the app has to change to turn it
 * on: no update, no build.
 *
 * HOW IT WORKS WHEN IT IS. While the monitor is set to a distance, the app
 * says where the rower is every three seconds: the seconds on the monitor,
 * the meters, and the second each 100 m line was crossed. The answer is
 * everybody else doing the same over the same distance.
 *
 * EACH OF THEM IS WHERE THEY ARE THIS SECOND, not where they were at this
 * second of their own row (owner, the same day, of the first cut, which
 * drew every boat from its own start: "say there are 4 people who are on
 * their last 1,000 meters, and I'm just starting. There's no reason I would
 * see them, because I'm not going to pass them"; "if someone is live and
 * we're catching up to them, then show them like in someone's lane"). A
 * rower who pulled first is that far up the course; two who pull together,
 * side by side or across the world, are level. The site says how many
 * seconds each has been rowing and how old that word is, the app knows its
 * own rower's seconds, and the difference is how far ahead that rower's
 * clock is (Ghost.ahead): no two phones' clocks are compared. Up to where
 * they have rowed the boat is their row; past it, it is carried on at the
 * split of their last 100 m. The race page marks them LIVE and gives one a
 * lane while it is on the water, as it does anybody.
 *
 * A demo row listens and is never told to anybody: nobody is rowing it.
 *
 * AND A DEMO ROW HAS A SAMPLE ROWER ON THE WATER WITH IT, whatever the site
 * says (owner, 2026-11-22: "in the demo, can we show what a live rower would
 * look like? Can we simulate a live rower, us rowing past them or us rowing
 * with us"). Nobody: it is made here, on the phone, and told to nobody. It
 * pulled six seconds before the demo row and is about 26 m up the course
 * at the start; the demo row comes up on it, is level a little before half
 * way and rows through it; it is some 18 m back at three quarters and
 * closes to a boat's length by the line. It is made the way a real one
 * arrives: the second it crossed each 100 m line so far, a word of it twice
 * a second, and the lines it has not reached carried on at its last split,
 * so the lane, the LIVE mark, the seconds and the color of its water are
 * what a real rower's would be. It is named SAMPLE ROWER. */

type Said = { on: boolean; rowers?: { id: string; name: string; numStr: string; t: number; m: number; spm: number; marks: number[]; ended: boolean; /* How many seconds old that word is. */ age?: number }[] };

const EVERY_MS = 3000;
/* ROW CLUB (club.ts): while the club row is on and this phone is in it,
 * the word goes to the club, once a second, and the boats are the club's
 * rowers (and the host's pretend rowers), not whoever else is out there. */
const CLUB_MS = 1000;
const STEP = 100;

let rowers: Ghost[] = [];
const subs = new Set<() => void>();
function put(next: Ghost[]): void {
  if (!next.length && !rowers.length) return;
  rowers = next;
  subs.forEach((f) => f());
}
const listen = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
const read = () => rowers;

/* For the race page: who is on the water now, as boats. */
export const useLiveRowers = (): Ghost[] => useSyncExternalStore(listen, read, read);

/* How far ahead each rower's clock is, kept from word to word: the same
 * figure every time but for the network, so it is eased, and taken afresh
 * only when it has moved by more than two seconds (another piece). */
const aheads = new Map<string, number>();

/* One of them as a boat over `meters`, `mine` being the seconds on this
 * rower's own monitor as the word arrived. A finished one is its row; one
 * still rowing has the lines it has not reached at the split of its last
 * 100 m, and those move with every word of it. */
function boatOf(r: NonNullable<Said["rowers"]>[number], meters: number, mine: number): Ghost | null {
  if (!(r.m >= 20) || !(r.t > 0)) return null;
  const lines = r.marks.filter((v) => v > 0);
  const n = lines.length;
  const per = n >= 2 ? (lines[n - 1] - lines[n - 2]) / STEP : r.t / r.m;
  const seconds = r.ended ? r.t : r.t + (meters - r.m) * per;
  const marks = [...lines];
  if (!r.ended) {
    const after = (v: number) => Math.max(v, (marks[marks.length - 1] ?? 0) + 0.1);
    for (let line = (n + 1) * STEP; line < meters; line += STEP) marks.push(after(r.t + (line - r.m) * per));
    marks.push(after(seconds));
  }
  const id = `live:${r.id}`;
  const said = r.t + (r.age ?? 0) - mine;
  const kept = aheads.get(id);
  const ahead = kept === undefined || Math.abs(said - kept) > 2 ? said : kept + (said - kept) * 0.3;
  aheads.set(id, ahead);
  return { id, kind: "live", name: r.name, numStr: r.numStr, day: "", seconds: marks.length >= 2 ? marks[marks.length - 1] : seconds, spm: r.spm, marks: marks.length >= 2 ? marks : [], ahead };
}

/* THE DEMO ROW'S SAMPLE ROWER. How many meters it is ahead of the demo row
 * (behind, under nothing), by how far through the piece the demo row is. */
const SAMPLE_AHEAD_S = 6;
const SAMPLE_MS = 500;
const smooth = (x: number): number => {
  const v = Math.max(0, Math.min(1, x));
  return v * v * (3 - 2 * v);
};
export const sampleGap = (through: number): number => (through <= 0.75 ? 26 - 44 * smooth(through / 0.75) : -18 + 12 * smooth((through - 0.75) / 0.25));

/* Held at the app's root beside the row in progress (App.tsx), so the word
 * keeps going out while the rower is looking at another screen. */
export function useLiveRaceFeed(erg: Erg): void {
  const now = useRef(erg);
  now.current = erg;

  /* The second each 100 m line was crossed, as the monitor's words pass. */
  const lines = useRef({ marks: [] as number[], m: 0, t: 0 });
  const l = erg.live;
  if (l.meters + 5 < lines.current.m) lines.current = { marks: [], m: 0, t: 0 };
  const k = lines.current;
  if (l.targetM > 0 && l.meters > k.m) {
    for (let line = (k.marks.length + 1) * STEP; line <= l.meters && line <= l.targetM; line += STEP) k.marks.push(Math.round((k.t + ((line - k.m) / (l.meters - k.m)) * (l.elapsedS - k.t)) * 10) / 10);
    k.m = l.meters;
    k.t = l.elapsedS;
  }

  const target = erg.phase === "live" ? l.targetM : 0;
  const inClub = clubRowing(useClub());
  useEffect(() => {
    if (!(target > 0)) return;
    let alive = true;
    let off = false;
    let busy = false;
    let last = false;
    /* Who the site last said is on the water. */
    let told: Ghost[] = [];
    const tell = () => put(now.current.demo && sample.boat && !inClub ? [...told, sample.boat] : told);
    const say = async () => {
      if (off || busy || last || !alive) return;
      const e = now.current;
      const v = e.live;
      /* A distance that is not a round hundred ends past its last line. */
      const marks = v.ended && lines.current.marks.length < Math.ceil(target / STEP) ? [...lines.current.marks, v.elapsedS] : lines.current.marks;
      busy = true;
      try {
        const r = inClub
          ? await api<Said>("/api/row100k/app/club/position", { body: { t: v.elapsedS, m: v.meters, spm: v.spm, marks, ended: v.ended, demo: e.demo } })
          : await api<Said>("/api/row100k/app/live", { body: { meters: target, t: v.elapsedS, m: v.meters, spm: v.spm, marks, ended: v.ended, demo: e.demo } });
        if (!alive) return;
        /* The club row not started yet, or over: nobody, and ask again. */
        if (!r.on && inClub) {
          told = [];
          tell();
          return;
        }
        if (!r.on) {
          off = true;
          told = [];
          tell();
          return;
        }
        const mine = now.current.live.elapsedS;
        told = (r.rowers ?? []).map((x) => boatOf(x, target, mine)).filter((g): g is Ghost => g !== null);
        tell();
        /* The finish was told: the picture stands still from here. */
        if (v.ended) last = true;
      } catch {
        /* The next word tries again. */
      } finally {
        busy = false;
      }
    };
    /* The sample rower of a demo row: where it is now, and the second it
     * crossed each line it has crossed. */
    const sample = { marks: [] as number[], m: 0, t: 0, boat: null as Ghost | null };
    const row = () => {
      const e = now.current;
      if (!alive || !e.demo || inClub) return;
      const v = e.live;
      if (v.meters + 5 < sample.m - 40) {
        sample.marks = [];
        sample.m = 0;
        sample.t = 0;
      }
      const m = Math.min(target, Math.max(sample.m, v.meters + sampleGap(v.meters / target)));
      const t = v.elapsedS + SAMPLE_AHEAD_S;
      for (let line = (sample.marks.length + 1) * STEP; line <= m && line <= target; line += STEP) sample.marks.push(Math.round((sample.t + ((line - sample.m) / Math.max(0.01, m - sample.m)) * (t - sample.t)) * 10) / 10);
      const ended = m >= target;
      if (ended && sample.marks.length < Math.ceil(target / STEP)) sample.marks.push(t);
      sample.m = m;
      sample.t = t;
      sample.boat = boatOf({ id: "sample", name: "Sample Rower", numStr: "", t, m, spm: 24, marks: sample.marks, ended, age: 0 }, target, v.elapsedS);
      put([...told, ...(sample.boat ? [sample.boat] : [])]);
    };
    say();
    const timer = setInterval(say, inClub ? CLUB_MS : EVERY_MS);
    const sampler = setInterval(row, SAMPLE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(sampler);
      aheads.clear();
      put([]);
    };
  }, [target, inClub]);
}
