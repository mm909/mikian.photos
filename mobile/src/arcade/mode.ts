import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/* WHICH GAME A ROW PLAYS: single player, the island (pve.ts), the default
 * since 2026-11-24 ("the new default arcade mode"), or the match against
 * rowers' saved rows (match.ts). Picked on the arcade tab of the rower's
 * own profile; kept on the phone. */

export type Mode = "solo" | "match";
const KEY = "arcade/mode/1";
let cache: Mode | null = null;
const subs = new Set<(m: Mode) => void>();

export async function loadMode(): Promise<Mode> {
  if (cache) return cache;
  try {
    cache = (await AsyncStorage.getItem(KEY)) === "match" ? "match" : "solo";
  } catch {
    cache = "solo";
  }
  return cache;
}

export async function setMode(m: Mode): Promise<void> {
  cache = m;
  subs.forEach((f) => f(m));
  await AsyncStorage.setItem(KEY, m).catch(() => null);
}

export function useMode(): Mode {
  const [m, setM] = useState<Mode>(cache ?? "solo");
  useEffect(() => {
    let on = true;
    loadMode().then((v) => on && setM(v));
    const f = (v: Mode) => on && setM(v);
    subs.add(f);
    return () => {
      on = false;
      subs.delete(f);
    };
  }, []);
  return m;
}
