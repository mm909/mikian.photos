import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { NO_UPGRADES, type BoatLv } from "./pve";

/* THE BOAT: the coins and what they buy (owner, 2026-11-24: "coins for
 * defeating a monster is the amount of damage that you did to it ... Spend
 * it on boat upgrades: more damage, shorter cooldowns"). The coins a row
 * made go in with its last chest (useShow.ts); they are spent on the
 * arcade tab of the rower's own profile, never while rowing ("The user gets
 * no input on the screen while they're rowing"). Kept on the phone, as the
 * locker and the XP are.
 *
 * The coins are the meters of the game (show.ts), a 5K about four
 * thousand. Four upgrades: DAMAGE (every skill hits harder), HULL (more
 * time from boss to boss), QUICK (every skill fills faster) and EASE (every
 * floor's pace a half second slower: "purchases can make the modifiers
 * easier"). Each level costs more than the last, a clicker's curve. And A
 * CHEST for coins ("We definitely want to be able to buy a chest with
 * coins"), opened there and then (screens/Locker.tsx). Still to come, from
 * his notes: picking which skill a slot takes. */

export type Upgrade = keyof BoatLv;
export type Boat = BoatLv & { coins: number };
export const UPGRADES: { id: Upgrade; name: string; line: string; base: number; grow: number; max: number }[] = [
  { id: "dmg", name: "DAMAGE", line: "Every skill hits 12% harder", base: 1500, grow: 1.5, max: 30 },
  { id: "hull", name: "HULL", line: "15% more hull from boss to boss", base: 1200, grow: 1.5, max: 30 },
  { id: "quick", name: "QUICK", line: "Every skill fills 6% faster", base: 2000, grow: 1.6, max: 8 },
  { id: "ease", name: "EASE", line: "Every floor's pace half a second slower", base: 2500, grow: 1.7, max: 6 },
];
/* A chest, bought. */
export const CHEST_COST = 2000;
export const costOf = (u: Upgrade, lv: number): number => {
  const d = UPGRADES.find((x) => x.id === u);
  return d ? Math.round(d.base * d.grow ** lv) : Infinity;
};

const KEY = "arcade/boat/1";
let cache: Boat | null = null;
const subs = new Set<(b: Boat) => void>();
const blank = (): Boat => ({ ...NO_UPGRADES, coins: 0 });

export async function loadBoat(): Promise<Boat> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    const n = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.floor(Number(x)) : 0);
    cache = v ? { coins: n(v.coins), dmg: n(v.dmg), hull: n(v.hull), quick: n(v.quick), ease: n(v.ease) } : blank();
  } catch {
    cache = blank();
  }
  return cache;
}

let chain: Promise<unknown> = Promise.resolve();
function change(f: (b: Boat) => Boat): Promise<Boat> {
  const job = async () => {
    const next = f(await loadBoat());
    cache = next;
    subs.forEach((s) => s(next));
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => null);
    return next;
  };
  const p = chain.then(job, job);
  chain = p.catch(() => null);
  return p;
}

export const addCoins = (c: number) => change((b) => ({ ...b, coins: b.coins + Math.max(0, Math.round(c)) }));

/* Buys a level, if the coins are there. */
export const buy = (u: Upgrade) =>
  change((b) => {
    const cost = costOf(u, b[u]);
    const d = UPGRADES.find((x) => x.id === u);
    if (!d || b[u] >= d.max || b.coins < cost) return b;
    return { ...b, coins: b.coins - cost, [u]: b[u] + 1 };
  });

/* THE OWNER'S DEVELOPER RESETS (Settings, DEVELOPER): the boat (coins and
 * every upgrade), or the skills (the upgrades that act on them: DAMAGE,
 * QUICK, EASE; the skills themselves are rolled fresh every row). */
export const resetBoat = () => change(() => blank());
export const resetSkills = () => change((b) => ({ ...b, dmg: 0, quick: 0, ease: 0 }));

/* Spends a chest's coins: true when there were enough (the chest is rolled
 * and banked by the caller, at once). */
export async function buyChest(): Promise<boolean> {
  let paid = false;
  await change((b) => {
    if (b.coins < CHEST_COST) return b;
    paid = true;
    return { ...b, coins: b.coins - CHEST_COST };
  });
  return paid;
}

export function useBoat(): Boat {
  const [b, setB] = useState<Boat>(cache ?? blank());
  useEffect(() => {
    let on = true;
    loadBoat().then((v) => on && setB(v));
    const f = (v: Boat) => on && setB(v);
    subs.add(f);
    return () => {
      on = false;
      subs.delete(f);
    };
  }, []);
  return b;
}
