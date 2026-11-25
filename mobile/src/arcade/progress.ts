import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { levelOf } from "./score";

/* THE XP AND THE LEVEL (owner, 2026-11-24: the celebration is "XP and the
 * bar going up ... A level, if you made one"; "4,500 m: the level up, with
 * the XP from the games"). Every match banks its XP here as its
 * celebration starts; the level is worked out of the XP (score.ts). Kept on
 * the phone, as the locker is. */

export type Progress = { xp: number; level: number };

const KEY = "arcade/xp/1";
let cache: number | null = null;
const subs = new Set<(xp: number) => void>();

export async function loadXp(): Promise<number> {
  if (cache !== null) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? Number(JSON.parse(raw)?.xp) : 0;
    cache = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    cache = 0;
  }
  return cache;
}

let chain: Promise<unknown> = Promise.resolve();
export function addXp(xp: number): Promise<number> {
  const job = async () => {
    const next = (await loadXp()) + Math.max(0, Math.round(xp));
    cache = next;
    subs.forEach((f) => f(next));
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify({ xp: next }));
    } catch {
      /* Kept until the app closes. */
    }
    return next;
  };
  const p = chain.then(job, job);
  chain = p.catch(() => null);
  return p;
}

/* THE OWNER'S DEVELOPER RESET (Settings, DEVELOPER): the XP set outright,
 * 0 for level 1. Never touches a row. */
export function setXp(xp: number): Promise<number> {
  const job = async () => {
    await loadXp();
    const next = Math.max(0, Math.round(xp));
    cache = next;
    subs.forEach((f) => f(next));
    await AsyncStorage.setItem(KEY, JSON.stringify({ xp: next })).catch(() => null);
    return next;
  };
  const p = chain.then(job, job);
  chain = p.catch(() => null);
  return p;
}

export function useProgress(): Progress {
  const [xp, setXp] = useState<number>(cache ?? 0);
  useEffect(() => {
    let on = true;
    loadXp().then((v) => on && setXp(v));
    const f = (v: number) => on && setXp(v);
    subs.add(f);
    return () => {
      on = false;
      subs.delete(f);
    };
  }, []);
  return { xp, level: levelOf(xp).level };
}
