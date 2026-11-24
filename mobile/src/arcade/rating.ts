import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ELO_START } from "./score";

/* THE RATING (owner, 2026-11-24: "Elo as in chess, maybe with its own name
 * ... Casual and ranked: too far for now. All casual; the rating kept behind
 * the scenes, seen by you"). Kept on the phone for now, as the locker is
 * (locker.ts); the profile's third tab reads it with useRating() when that
 * tab is built. The arithmetic is score.ts. */

export type Rating = { elo: number; games: number; wins: number; draws: number };

const KEY = "arcade/rating/1";
const EMPTY: Rating = { elo: ELO_START, games: 0, wins: 0, draws: 0 };

let cache: Rating | null = null;
const subs = new Set<(r: Rating) => void>();

function clean(raw: unknown): Rating {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Rating>;
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : d);
  return { elo: n(r.elo, ELO_START) || ELO_START, games: n(r.games, 0), wins: n(r.wins, 0), draws: n(r.draws, 0) };
}

export async function loadRating(): Promise<Rating> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = clean(raw ? JSON.parse(raw) : null);
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

let chain: Promise<unknown> = Promise.resolve();
/* A match is over: the rating it ended on, and how it went. */
export function rate(elo: number, result: "win" | "draw" | "loss"): Promise<Rating> {
  const job = async () => {
    const was = await loadRating();
    const next: Rating = { elo: Math.round(elo), games: was.games + 1, wins: was.wins + (result === "win" ? 1 : 0), draws: was.draws + (result === "draw" ? 1 : 0) };
    cache = next;
    subs.forEach((f) => f(next));
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

/* The rating as it is, and again whenever a match moves it. */
export function useRating(): Rating {
  const [r, setR] = useState<Rating>(cache ?? EMPTY);
  useEffect(() => {
    let on = true;
    loadRating().then((v) => on && setR(v));
    const f = (v: Rating) => on && setR(v);
    subs.add(f);
    return () => {
      on = false;
      subs.delete(f);
    };
  }, []);
  return r;
}
