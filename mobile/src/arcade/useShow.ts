import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { api } from "../api";
import type { Ghost, Ghosts } from "../erg/ghosts";
import type { Erg } from "../erg/useErg";
import { addCoins, loadBoat } from "./boat";
import { saveGame } from "./games";
import { loadMode } from "./mode";
import { grant } from "./locker";
import { addXp, loadXp } from "./progress";
import { loadRating, rate } from "./rating";
import { createShow, type Show, type ShowCtx, type ShowPhase, type ShowView } from "./show";

/* THE SHOW, held by the monitor (RowScreen.tsx) beside the director, so it
 * has watched the whole row whichever page is up. Told where the row is ten
 * times a second; the show is arcade/show.ts, how it looks
 * screens/Show.tsx.
 *
 * What it loads as the row starts, once:
 *   THE PACE GIVEN: the rower's median 5K pace (owner, 2026-11-24: "Your
 *     pace is set for you, not picked: your median 5K pace, so a match is
 *     honest"), off their logged 5Ks (the profile's rows), or failing those
 *     their own 5K rows the race knows; with neither, the show uses the
 *     pace of the row so far.
 *   Their lifetime meters, the rating and the XP the phone keeps.
 *   THE SAVED ROWS the bots are made of: the race's field for the piece's
 *     distance (a plain row: for 5,000 m).
 * And what it keeps as the show goes: a match's XP, the rating and the
 * chest's items as its celebration starts; the last chest's items as it
 * drops.
 *
 * The view moves every tick, so it is handed over in a ref the drawing
 * reads on every frame; the monitor is drawn again only when the phase (or
 * the search) changes. OWNER ONLY (`on`): the App Store build has no
 * games. */

export type Showed = {
  view: MutableRefObject<ShowView | null>;
  show: MutableRefObject<Show | null>;
  ctx: MutableRefObject<ShowCtx>;
  phase: ShowPhase | null;
  /* Changes whenever something the monitor itself shows has changed. */
  key: string;
};

const median = (v: number[]): number => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : 0);

/* The spread of a rower's 5K paces, one standard deviation in seconds
 * (the profile's "Spread"), once there are five; clamped to 1-8 s. */
export function spread5k(rows: { meters?: number; seconds?: number; masked?: boolean }[]): number | null {
  const p = rows.filter((r) => !r.masked && (r.meters ?? 0) >= 4950 && (r.meters ?? 0) <= 5050 && (r.seconds ?? 0) > 600).map((r) => ((r.seconds as number) / (r.meters as number)) * 500);
  if (p.length < 5) return null;
  const mean = p.reduce((a, b) => a + b, 0) / p.length;
  const sd = Math.sqrt(p.reduce((a, b) => a + (b - mean) ** 2, 0) / (p.length - 1));
  return Math.max(1, Math.min(8, sd));
}

/* The median 5K pace, whole seconds, of a rower's logged rows. */
export function median5k(rows: { meters?: number; seconds?: number; masked?: boolean }[]): number | null {
  const p = rows.filter((r) => !r.masked && (r.meters ?? 0) >= 4990 && (r.meters ?? 0) <= 5010 && (r.seconds ?? 0) > 600).map((r) => ((r.seconds as number) / (r.meters as number)) * 500);
  return p.length ? Math.round(median(p)) : null;
}

export function useShow(erg: Erg, on: boolean): Showed {
  const show = useRef<Show | null>(null);
  if (!show.current) show.current = createShow(Date.now() % 1_000_000);
  const view = useRef<ShowView | null>(null);
  const ctx = useRef<ShowCtx>({ solo: true, boat: { dmg: 0, hull: 0, quick: 0, ease: 0 }, assigned: null, elo: 1200, xp: 0, lifetime: 0, ghosts: null, ghostM: 5000, loaded: false });
  const [at, setAt] = useState<{ phase: ShowPhase | null; key: string }>({ phase: null, key: "" });
  const now = useRef(erg);
  now.current = erg;
  const done = useRef(new Set<string>());
  /* The row's XP banked so far (a match's as its celebration starts); the
   * rest goes in with the last chest. */
  const banked = useRef(0);
  const live = on && erg.phase === "live";
  const target = erg.live.targetM;

  /* What is known of the rower: once a row. */
  useEffect(() => {
    if (!live) return;
    let alive = true;
    const c = ctx.current;
    Promise.all([loadRating(), loadXp(), loadMode(), loadBoat()]).then(([r, xp, mode, boat]) => {
      if (!alive) return;
      c.boat = { dmg: boat.dmg, hull: boat.hull, quick: boat.quick, ease: boat.ease };
      /* PVE FIRST (owner, 2026-11-24: "I really want to focus on PvE first
       * and then do PvP"): every row plays the course; the match is kept in
       * the code, and the switch is off the profile. */
      void mode;
      c.solo = true;
      c.elo = r.elo;
      c.xp = xp;
      c.loaded = true;
    });
    api<{ profile?: { lifetime: { meters: number } | null; logRows: { meters?: number; seconds?: number; masked: boolean }[] } }>("/api/row100k/app/profile?m=all")
      .then((d) => {
        if (!alive || !d.profile) return;
        c.lifetime = d.profile.lifetime?.meters ?? 0;
        c.assigned = median5k(d.profile.logRows ?? []) ?? c.assigned;
        c.sigma = spread5k(d.profile.logRows ?? []) ?? c.sigma ?? null;
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [live]);

  /* The saved rows, for the distance being rowed. */
  useEffect(() => {
    if (!live) return;
    let alive = true;
    const meters = target > 0 ? Math.round(target) : 5000;
    const c = ctx.current;
    c.ghosts = null;
    c.ghostM = meters;
    api<Ghosts>(`/api/row100k/app/ghosts?meters=${meters}`)
      .then((r) => {
        if (!alive) return;
        c.ghosts = r.ghosts;
        /* The rower's own 5Ks, when the profile gave none. */
        if (c.assigned === null && meters === 5000) {
          const mine = r.ghosts.filter((g: Ghost) => g.kind === "me").map((g) => (g.seconds / 5000) * 500);
          if (mine.length) c.assigned = Math.round(median(mine));
        }
      })
      .catch(() => alive && (c.ghosts = []));
    return () => {
      alive = false;
    };
  }, [live, target]);

  useEffect(() => {
    if (!live) {
      view.current = null;
      setAt({ phase: null, key: "" });
      return;
    }
    banked.current = 0;
    let lastTick: { wall: number; t: number; m: number; pace: number; target: number } | null = null;
    /* What a view leaves the rower, once each: a match's XP and rating as
     * its celebration starts; the last chest, the XP, the coins and the
     * game's record the moment the chest is rolled. */
    const bank = (v: ShowView, demo: boolean) => {
      const r = v.result;
      if (v.phase === "celebrate" && r && !done.current.has(r.id)) {
        done.current.add(r.id);
        if (!demo) {
          ctx.current.elo = r.eloAfter;
          rate(r.eloAfter, r.result).catch(() => null);
        }
        banked.current += r.xp;
        addXp(r.xp).catch(() => null);
      }
      if (v.final && !done.current.has(v.final.id)) {
        done.current.add(v.final.id);
        const rest = Math.max(0, v.xpRow - banked.current);
        banked.current = v.xpRow;
        if (rest) addXp(rest).catch(() => null);
        grant(v.final.chest.items, true).catch(() => null);
        /* ONE SCREEN PAYS (owner, 2026-11-24: "you only get rewards for the
         * stuff that's on your screen"): the course's coins (the game's
         * meters), or a match's rating, never both. */
        const b = v.battle;
        const sw = v.swarmTot;
        if (b) addCoins(v.coins).catch(() => null);
        saveGame({ id: `${Date.now()}`, at: Date.now(), demo, mode: b ? "solo" : "match", xp: v.xpRow, xpBefore: Math.max(0, v.xpStart), kills: b?.kills ?? 0, matches: v.matches, items: v.final.chest.items, coins: b ? v.coins : 0, fish: sw.kills, bosses: b?.bosses ?? 0, best: b?.best ?? 0, wrecks: b?.wrecks ?? 0, meters: Math.round(v.m) }).catch(() => null);
      }
    };
    const tick = () => {
      const l = now.current.live;
      /* A DEMO ROW NEVER MOVES THE RATING (owner, 2026-11-24): its XP and
       * its items still count, so the demo shows what a row gives. */
      const demo = now.current.demo;
      const s = show.current;
      if (!s) return;
      lastTick = { wall: Date.now() / 1000, t: l.elapsedS, m: l.meters, pace: l.pace, target: l.targetM };
      const v = s.step({ ...lastTick, ended: l.ended }, ctx.current);
      view.current = v;
      bank(v, demo);
      const key = `${v.phase}/${v.search}/${v.matches}/${v.ready ? "ready" : ""}`;
      setAt((was) => (was.key === key ? was : { phase: v.phase, key }));
    };
    tick();
    const id = setInterval(tick, 100);
    const demoNow = now.current.demo;
    return () => {
      clearInterval(id);
      /* Left before the chest (DONE, or a demo's analytics): the row is
       * over where it stood, and what it gave is banked all the same. */
      const s = show.current;
      if (s && lastTick && view.current && !["intro", "done"].includes(view.current.phase)) bank(s.step({ ...lastTick, wall: Date.now() / 1000, ended: true }, ctx.current), demoNow);
    };
  }, [live]);
  return { view, show, ctx, phase: at.phase, key: at.key };
}
