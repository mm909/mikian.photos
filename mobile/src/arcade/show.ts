import type { Ghost } from "../erg/ghosts";
import { pickBot, type Bot } from "./bots";
import { createPve, type Pve, type PveView } from "./pve";
import { HEALTH, createMatch, holds, paceOf, tenths, type Match, type MatchView } from "./match";
import { prng, seedOf } from "./rng";
import { botElo, eloAfter, matchXp } from "./score";
import { rollChest, type Chest } from "./skins";

/* THE 5K SHOW, BY THE CLOCK (owner, 2026-11-24, 3 AM: "the show runs by the
 * clock, not the meters: a 2:30 rower is 15 seconds a minute behind a 2:00
 * rower, still rowing, so a game timed in meters would end at different
 * moments for them. The end is the exception, fixed in meters"). Keyed off
 * the row's own seconds (live.elapsedS), so a demo at ten times a clock runs
 * the show ten times as fast.
 *
 * THE RUNNING ORDER, for a 5K (the wiki's "show" page):
 *   0:00-1:00   INTRO: the title card and the rower's own numbers.
 *               Matchmaking starts with the row.
 *   then        HOME, a minute at least: the piece wanders its board,
 *               LOOKING FOR A MATCH, then MATCH FOUND.
 *   next whole  LOBBY, a minute: both pieces on one board, roaming at the
 *   minute      pace each rows. Its last 12 seconds are the READY CHECK:
 *               the flip dots read 159 and flip to the pace given.
 *   then        THE MATCH (match.ts) until somebody's health is gone.
 *               12 seconds of CELEBRATION: XP, the level, lifetime meters,
 *               the rating, a chest. Then home again, and matchmaking
 *               looks again.
 *   80%         no match starts past 4,000 m: MATCH FOUND is only said for
 *               a match whose gun will go before it, at the pace rowed so
 *               far, and one whose gun comes after it anyway is called off.
 *   90%         4,500 m: LEVEL UP, with the XP of the row's matches. A
 *               match still on is called (the more health wins) and its
 *               celebration comes first.
 *   90-100%     THE FINISH LINE.
 *   100%        5,000 m: THE CHEST. A new item.
 * A plain row (no distance set) runs intro, home and matches, and no
 * finale.
 *
 * A SHORTER PIECE runs the same show cut down: every minute of it is the
 * piece's share of a 5K (a 1K's is 12 s, never less than a fifth), the
 * lobby is never under 18 s (the ready check and a little), and the match
 * starts with less health (a 1K's, about a third). The 80% and 90% marks
 * are the piece's own.
 *
 * WHAT IS ON THE WALL'S CLOCK, NOT THE ROW'S: a celebration and the level
 * up are held for a few seconds of the wall as well, so a demo at ten times
 * still lets the eye see the chest open; home waits for them.
 *
 * Pure: fed ticks, it answers the view; the hook (useShow.ts) keeps what it
 * says on the phone. No React, no clock, so scripts/arcade-check.ts rows
 * whole pieces through it. */

export type ShowPhase = "intro" | "battle" | "home" | "lobby" | "match" | "celebrate" | "levelup" | "finish" | "chest" | "done";

export type STick = { wall: number; t: number; m: number; pace: number; target: number; ended?: boolean };

/* What the phone knows of the rower, which the hook fills in as it loads:
 * the pace given (their median 5K, whole seconds; null to use the pace of
 * the row so far), the rating, the XP, lifetime meters before this row, and
 * the saved rows the bots come from (over `ghostM` meters). */
/* `solo`: the single player island (pve.ts) after the intro, the default
 * from 2026-11-24; off, matchmaking and the match against bots. */
export type ShowCtx = { solo: boolean; assigned: number | null; elo: number; xp: number; lifetime: number; ghosts: Ghost[] | null; ghostM: number; loaded: boolean };

export type Opp = { id: string; name: string; numStr: string; assigned: number; elo: number };

export type Result = {
  id: string;
  result: "win" | "draw" | "loss";
  called: boolean;
  opp: Opp;
  /* Meters the rower rowed in the match, and where it began. */
  rowed: number;
  fromM: number;
  xp: number;
  /* The rower's XP before this match (the row's start, and the matches of
   * this row before it). */
  xpBefore: number;
  eloBefore: number;
  eloAfter: number;
  chest: Chest;
  health: { me: number; opp: number; max: number };
};

export type ShowView = {
  phase: ShowPhase;
  /* When this phase began: the row's second, and the wall's. */
  since: number;
  sinceWall: number;
  t: number;
  wall: number;
  m: number;
  target: number;
  /* How many of the row's seconds pass in one of the wall's (1 on a real
   * monitor, 10 on a demo at ten times). */
  rate: number;
  /* The share of a 5K this show is cut to. */
  scale: number;
  search: "looking" | "found" | "closed";
  /* The row's seconds the lobby starts and the gun goes, once found. */
  lobbyAt: number;
  gunAt: number;
  /* The pace given to the rower for the match (whole seconds); 0 until the
   * ready check. */
  assigned: number;
  opp: Opp | null;
  /* The ready check: the 3-second pace now, and whether it holds. */
  ready: { pace: number; ok: boolean } | null;
  match: MatchView | null;
  result: Result | null;
  /* The island, in single player. */
  battle: PveView | null;
  /* The row's XP from its matches, and the XP the row started at. */
  xpRow: number;
  xpStart: number;
  /* The chest at the end of the piece. */
  final: { id: string; chest: Chest } | null;
  matches: number;
};

/* ---- the running order, for a 5K; a shorter piece is cut to its share --- */
export const INTRO_S = 60;
export const HOME_MIN_S = 60;
/* Into the least time home, MATCH FOUND. */
export const FOUND_AT = 0.7;
export const GRID_S = 60;
export const LOBBY_S = 60;
export const READY_S = 12;
const LOBBY_LEAST_S = READY_S + 6;
export const CELEBRATE_S = 12;
export const LEVELUP_S = 15;
/* Seconds of the wall a card is held at the least. */
export const CELEBRATE_WALL_S = 6;
export const LEVELUP_WALL_S = 6;
export const LAST_MATCH = 0.8;
export const FINALE = 0.9;
/* The least share of a 5K a show is cut to, and of its health. */
const SCALE_LEAST = 0.2;
const HEALTH_LEAST = 0.35;
/* How long matchmaking waits for the saved rows before it plays a pace bot. */
const WAIT_FOR_ROWS_S = 10;

export const scaleOf = (target: number): number => (target > 0 ? Math.max(SCALE_LEAST, Math.min(1, target / 5000)) : 1);
export const healthOf = (target: number): number => Math.round(HEALTH * Math.max(HEALTH_LEAST, scaleOf(target)));

export type Show = {
  step(tick: STick, ctx: ShowCtx): ShowView;
  view(): ShowView;
  /* How far a piece had rowed by the row's second `t`: "me", or a bot's id. */
  metersAt(id: string, t: number): number;
  /* Every phase as it began, and every match, for the check. */
  log: { phases: { phase: ShowPhase; t: number; m: number }[]; matches: { id: string; t0: number; m0: number; end: number; m1: number; result: Result | null; match: MatchView }[] };
};

export function createShow(seed = 1): Show {
  let target = -1;
  let v = null as unknown as ShowView;
  let samples: { t: number; m: number }[] = [];
  let last = { t: -1, m: -1, wall: 0 };
  let match: Match | null = null;
  let pve: Pve | null = null;
  let bot: Bot | null = null;
  let played = new Set<string>();
  let waitFrom = -1;
  /* What the celebration goes to when it is over. */
  let finaleDue = false;
  const log: Show["log"] = { phases: [], matches: [] };

  const blank = (tg: number, tick: STick): ShowView => ({ phase: "intro", since: 0, sinceWall: tick.wall, t: tick.t, wall: tick.wall, m: tick.m, target: tg, rate: 1, scale: scaleOf(tg), search: "looking", lobbyAt: 0, gunAt: 0, assigned: 0, opp: null, ready: null, match: null, result: null, battle: null, xpRow: 0, xpStart: -1, final: null, matches: 0 });

  const reset = (tick: STick) => {
    target = tick.target;
    samples = [];
    match = null;
    pve = null;
    bot = null;
    played = new Set();
    waitFrom = -1;
    finaleDue = false;
    v = blank(target, tick);
    log.phases.length = 0;
    log.matches.length = 0;
    log.phases.push({ phase: "intro", t: tick.t, m: tick.m });
  };

  /* The rower's meters at the row's second `t`, off the samples. */
  const mine = (t: number): number => {
    const n = samples.length;
    if (!n) return 0;
    if (t >= samples[n - 1].t) return samples[n - 1].m;
    if (t <= samples[0].t) return samples[0].m;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = samples[lo];
    const b = samples[hi];
    return b.t > a.t ? a.m + ((t - a.t) / (b.t - a.t)) * (b.m - a.m) : b.m;
  };
  const metersAt = (id: string, t: number): number => (id === "me" ? mine(t) : bot && id === bot.id ? bot.metersAt(t) : 0);

  const go = (phase: ShowPhase, tick: STick) => {
    v.phase = phase;
    v.since = tick.t;
    v.sinceWall = tick.wall;
    log.phases.push({ phase, t: tick.t, m: tick.m });
  };

  const scaled = (s: number) => s * v.scale;

  /* The match is over: what it gave. */
  const settle = (mv: MatchView, ctx: ShowCtx, tick: STick): Result => {
    const me = mv.players.find((p) => p.id === "me");
    const op = mv.players.find((p) => p.id !== "me");
    const result: Result["result"] = mv.winner === "me" ? "win" : mv.winner === "draw" ? "draw" : "loss";
    const rowed = me?.rowed ?? 0;
    const xp = matchXp(rowed, result);
    const opp = v.opp as Opp;
    const eloBefore = ctx.elo;
    const r: Result = {
      id: mv.id,
      result,
      called: mv.called,
      opp,
      rowed,
      fromM: me?.startM ?? tick.m,
      xp,
      xpBefore: Math.max(0, v.xpStart) + v.xpRow,
      eloBefore,
      eloAfter: eloAfter(eloBefore, opp.elo, result === "win" ? 1 : result === "draw" ? 0.5 : 0),
      chest: rollChest(prng(seedOf(`${seed}/${mv.id}/chest`)), result === "win"),
      health: { me: me?.health ?? 0, opp: op?.health ?? 0, max: me?.max ?? 0 },
    };
    v.xpRow += xp;
    const entry = log.matches.find((x) => x.id === mv.id);
    if (entry) {
      entry.end = mv.endAt;
      entry.m1 = tick.m;
      entry.result = r;
      entry.match = mv;
    }
    return r;
  };

  const endMatch = (mv: MatchView, ctx: ShowCtx, tick: STick) => {
    v.match = mv;
    v.result = settle(mv, ctx, tick);
    match = null;
    go("celebrate", tick);
  };

  /* Home again: matchmaking looks, unless the piece is too far on. */
  const home = (tick: STick) => {
    v.search = v.target > 0 && tick.m >= LAST_MATCH * v.target ? "closed" : "looking";
    v.opp = null;
    v.ready = null;
    v.lobbyAt = 0;
    v.gunAt = 0;
    waitFrom = -1;
    go("home", tick);
  };

  return {
    log,
    metersAt,
    view: () => v,
    step(tick, ctx) {
      if (tick.target !== target || !v || tick.m + 5 < last.m || tick.t + 5 < last.t) reset(tick);
      /* How fast the row's clock runs against the wall's. */
      if (last.t >= 0 && tick.wall > last.wall && tick.t > last.t) {
        const r = (tick.t - last.t) / (tick.wall - last.wall);
        v.rate = v.rate + (Math.max(0.2, Math.min(60, r)) - v.rate) * 0.3;
      }
      if (tick.t !== last.t || tick.m !== last.m) {
        samples.push({ t: tick.t, m: tick.m });
        if (samples.length > 400) samples = samples.slice(-300);
      }
      last = { t: tick.t, m: tick.m, wall: tick.wall };
      v = { ...v, t: tick.t, wall: tick.wall, m: tick.m };
      if (ctx.loaded && v.xpStart < 0) v.xpStart = ctx.xp;
      const t = tick.t;
      const T = v.target;
      const complete = T > 0 && tick.m >= T - 0.5;

      /* ---- the finale, fixed in meters ---- */
      if (T > 0 && tick.m >= FINALE * T && !finaleDue && !["levelup", "finish", "chest", "done"].includes(v.phase)) {
        finaleDue = true;
        v.search = "closed";
        if (v.phase === "match" && match) endMatch(match.call(t), ctx, tick);
        else if (v.phase !== "celebrate") {
          v.opp = null;
          v.ready = null;
          go("levelup", tick);
        }
      }
      /* The row stopped under a match: it is called. */
      if (tick.ended && v.phase === "match" && match) endMatch(match.call(t), ctx, tick);

      switch (v.phase) {
        case "intro":
          if (tick.ended) go("done", tick);
          else if (t >= scaled(INTRO_S) && ctx.solo) {
            pve = createPve({ t0: t, seed: seedOf(`${seed}/${T}/island`) });
            v.search = "closed";
            v.battle = pve.step(t, tick.pace);
            go("battle", tick);
          } else if (t >= scaled(INTRO_S)) home(tick);
          break;

        case "battle":
          if (tick.ended) {
            go("chest", tick);
            break;
          }
          if (pve) {
            /* The pace the bar reads: the last four seconds of the row's own
             * meters, steadier than one stroke's. */
            const p4 = t > 4 ? paceOf(tick.m - mine(t - 4), 4) : tick.pace;
            v.battle = pve.step(t, p4);
            v.xpRow = v.battle.xp;
          }
          break;

        case "home": {
          if (tick.ended) {
            go("chest", tick);
            break;
          }
          const least = v.since + scaled(HOME_MIN_S);
          if (v.search === "looking" && t >= v.since + FOUND_AT * scaled(HOME_MIN_S)) {
            const grid = scaled(GRID_S);
            const lobbyAt = Math.ceil((Math.max(t, least) - 1e-6) / grid) * grid;
            const gunAt = lobbyAt + Math.max(LOBBY_LEAST_S, scaled(LOBBY_S));
            /* No match whose gun would go past 80% at the pace rowed so far. */
            const speed = t > 5 ? tick.m / t : 0;
            if (T > 0 && (speed <= 0 || tick.m + (gunAt - t) * speed >= LAST_MATCH * T)) {
              v.search = "closed";
              break;
            }
            /* The rows to make a bot from: waited for a little, then a pace
             * bot. */
            if (!ctx.ghosts && waitFrom < 0) waitFrom = t;
            if (!ctx.ghosts && t - waitFrom < WAIT_FOR_ROWS_S * v.rate) break;
            const given = ctx.assigned ?? (tick.m > 50 ? Math.round(paceOf(tick.m, t)) : 120);
            const n = v.matches + 1;
            bot = pickBot(ctx.ghosts ?? [], ctx.ghostM || 5000, given, seedOf(`${seed}/${T}/bot${n}`), played, Math.max(600, t + 900));
            played.add(bot.id);
            v.opp = { id: bot.id, name: bot.name, numStr: bot.numStr, assigned: bot.assigned, elo: botElo(ctx.elo, given, bot.assigned) };
            v.search = "found";
            v.lobbyAt = lobbyAt;
            v.gunAt = gunAt;
          }
          if (v.search === "found" && t >= v.lobbyAt) {
            v.assigned = 0;
            go("lobby", tick);
          }
          break;
        }

        case "lobby": {
          const readyAt = v.gunAt - READY_S;
          if (t >= readyAt) {
            /* The pace given: fixed as the ready check starts. */
            if (!v.assigned) v.assigned = ctx.assigned ?? Math.round(paceOf(tick.m, t));
            const p = tenths(paceOf(tick.m - mine(t - 3), 3));
            v.ready = { pace: p, ok: holds(p, v.assigned) };
          }
          if (t >= v.gunAt) {
            if (T > 0 && tick.m >= LAST_MATCH * T) {
              /* Too far on for a match after all: home, and no more. */
              home(tick);
              v.search = "closed";
              break;
            }
            const n = ++v.matches;
            const id = `match${n}`;
            const opp = v.opp as Opp;
            match = createMatch({
              id,
              t0: v.gunAt,
              sides: [
                { id: "me", name: "You", kind: "me", assigned: v.assigned, elo: ctx.elo },
                { id: opp.id, name: opp.name, numStr: opp.numStr, kind: "bot", assigned: opp.assigned, elo: opp.elo },
              ],
              metersAt,
              health: healthOf(T),
              seed: seedOf(`${seed}/${T}/${id}`),
              late: v.ready && !v.ready.ok ? ["me"] : [],
            });
            log.matches.push({ id, t0: v.gunAt, m0: tick.m, end: 0, m1: 0, result: null, match: match.view() });
            v.match = match.step(t);
            go("match", { ...tick, t: v.gunAt });
            if (v.match.phase === "over") endMatch(v.match, ctx, tick);
          }
          break;
        }

        case "match":
          if (match) {
            const mv = match.step(t);
            v.match = mv;
            if (mv.phase === "over") endMatch(mv, ctx, tick);
          }
          break;

        case "celebrate":
          /* Once the row has stopped its clock stands still: the wall's
           * seconds alone say when a card is done. */
          if ((t >= v.since + CELEBRATE_S || tick.ended) && tick.wall >= v.sinceWall + CELEBRATE_WALL_S) {
            if (finaleDue) go("levelup", tick);
            else if (tick.ended) go("chest", tick);
            else home(tick);
          }
          break;

        case "levelup":
          if ((t >= v.since + scaled(LEVELUP_S) || tick.ended) && tick.wall >= v.sinceWall + LEVELUP_WALL_S) go(complete || tick.ended ? "chest" : "finish", tick);
          break;

        case "finish":
          if (complete || tick.ended) go("chest", tick);
          break;

        default:
          break;
      }
      if (v.phase === "chest" && !v.final) v.final = { id: `final@${T}`, chest: rollChest(prng(seedOf(`${seed}/${T}/final`)), true) };
      return v;
    },
  };
}
