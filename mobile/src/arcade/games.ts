import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/* WHAT EACH ROW'S GAME GAVE (owner, 2026-11-24: "Game summary on the row
 * page: after the stickers/reels and before the analytics. It shows the XP
 * he got, the items he just got, and lets him equip them"). Kept on the
 * phone, as the locker and the XP are; the last thirty.
 *
 * The show knows the game before the site has numbered the row, so a game
 * is saved first and given its row's id when the row is logged (`bindRow`,
 * from the monitor, RowScreen.tsx); a row logged before its game ended
 * leaves its id waiting for the next game, for two minutes. A demo row's
 * id is "demo": its page shows the newest demo game. */

/* coins, bosses (stages beaten), best (the furthest stage), wrecks and
 * meters: the island's, from 2026-11-24 evening; older games have none. */
export type Game = { id: string; at: number; rowId: string | null; demo: boolean; mode: "solo" | "match"; xp: number; xpBefore: number; kills: number; matches: number; items: string[]; coins?: number; bosses?: number; best?: number; wrecks?: number; meters?: number; fish?: number };

const KEY = "arcade/games/1";
const KEEP = 30;
const WAIT_MS = 120_000;
let cache: Game[] | null = null;
let waiting: { rowId: string; at: number } | null = null;
const subs = new Set<(g: Game[]) => void>();

async function load(): Promise<Game[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(v) ? v.filter((g) => g && typeof g.id === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

let chain: Promise<unknown> = Promise.resolve();
function change(f: (g: Game[]) => Game[]): Promise<Game[]> {
  const job = async () => {
    const next = f(await load()).slice(0, KEEP);
    cache = next;
    subs.forEach((s) => s(next));
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* Kept until the app closes. */
    }
    return next;
  };
  const p = chain.then(job, job);
  chain = p.catch(() => null);
  return p;
}

/* A game is over (its last chest dropped). */
export function saveGame(g: Omit<Game, "rowId">): Promise<Game[]> {
  const w = waiting && Date.now() - waiting.at < WAIT_MS && !g.demo === (waiting.rowId !== "demo") ? waiting.rowId : null;
  if (w) waiting = null;
  return change((list) => [{ ...g, rowId: w }, ...list.filter((x) => x.id !== g.id)]);
}

/* The row the monitor just logged: the newest game without a row, played in
 * the last ten minutes, is that row's. */
export function bindRow(rowId: string, demo: boolean): Promise<Game[]> {
  return change((list) => {
    const i = list.findIndex((g) => g.rowId === null && g.demo === demo && Date.now() - g.at < 600_000);
    if (i < 0) {
      if (!list.some((g) => g.rowId === rowId)) waiting = { rowId, at: Date.now() };
      return list;
    }
    return list.map((g, k) => (k === i ? { ...g, rowId } : g));
  });
}

/* The game of a row, or null; again whenever the games change. */
export function useGame(rowId: string | null | undefined): Game | null {
  const pick = (l: Game[] | null) => (rowId && l ? (l.find((g) => g.rowId === rowId) ?? null) : null);
  const [g, setG] = useState<Game | null>(pick(cache));
  useEffect(() => {
    let on = true;
    load().then((l) => on && setG(pick(l)));
    const f = (l: Game[]) => on && setG(pick(l));
    subs.add(f);
    return () => {
      on = false;
      subs.delete(f);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId]);
  return g;
}

/* THE GAME OF A DEMO ROW READ ON ITS OWN (owner, 2026-11-24: "When I click
 * to see its analytics, I don't get a summary"): a demo's analytics have no
 * row, so they show the newest demo game of the last half hour. */
export function useLastDemoGame(): Game | null {
  const pick = (l: Game[] | null) => (l ? (l.find((g) => g.demo && Date.now() - g.at < 30 * 60_000) ?? null) : null);
  const [g, setG] = useState<Game | null>(pick(cache));
  useEffect(() => {
    let on = true;
    load().then((l) => on && setG(pick(l)));
    const f = (l: Game[]) => on && setG(pick(l));
    subs.add(f);
    return () => {
      on = false;
      subs.delete(f);
    };
  }, []);
  return g;
}
