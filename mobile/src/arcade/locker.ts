import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { DROPPABLE, LAYERS, SKIN_BY_ID, STOCK, type Equipped, type Layer } from "./skins";

/* THE LOCKER: the skins this phone has won and the ones on the boat. Kept on
 * the phone for now, as the unlogged rows are (store.ts); a table on the
 * site, so the skins follow the rower to another phone and others see them
 * on the race, is the next step and is not built.
 *
 * `owned` counts each item (a second one out of a chest is a duplicate and
 * still counted); `fresh` are the ones not yet seen in the locker, for the
 * NEW on them. */

export type Locker = {
  owned: Record<string, number>;
  equipped: Equipped;
  fresh: string[];
  games: { played: number; won: number };
};

const KEY = "arcade/locker/1";
const EMPTY: Locker = { owned: {}, equipped: { ...STOCK }, fresh: [], games: { played: 0, won: 0 } };

let cache: Locker | null = null;
const subs = new Set<(l: Locker) => void>();
const tell = (l: Locker) => subs.forEach((f) => f(l));

/* What was read off the phone, with anything it no longer knows dropped. */
function clean(raw: unknown): Locker {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Locker>;
  const owned: Record<string, number> = {};
  for (const [id, n] of Object.entries(r.owned ?? {})) if (SKIN_BY_ID[id] && typeof n === "number" && n > 0) owned[id] = Math.floor(n);
  const equipped = { ...STOCK };
  for (const l of LAYERS) {
    const id = r.equipped?.[l];
    if (id && SKIN_BY_ID[id]?.layer === l && (owned[id] || id === STOCK[l])) equipped[l] = id;
  }
  const fresh = Array.isArray(r.fresh) ? r.fresh.filter((id) => typeof id === "string" && owned[id]) : [];
  const games = { played: Math.max(0, Number(r.games?.played) || 0), won: Math.max(0, Number(r.games?.won) || 0) };
  return { owned, equipped, fresh, games };
}

export async function loadLocker(): Promise<Locker> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = clean(raw ? JSON.parse(raw) : null);
  } catch {
    cache = { ...EMPTY, equipped: { ...STOCK } };
  }
  return cache;
}

/* One write at a time: a chest can open while the locker is equipping. */
let chain: Promise<unknown> = Promise.resolve();
function change(f: (l: Locker) => Locker): Promise<Locker> {
  const job = async () => {
    const next = f(await loadLocker());
    cache = next;
    tell(next);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* The phone would not keep it: the skins last until the app closes. */
    }
    return next;
  };
  const p = chain.then(job, job);
  chain = p.catch(() => null);
  return p;
}

/* What a chest gave, and how the game went. */
export function grant(items: string[], won: boolean): Promise<Locker> {
  return change((l) => {
    const owned = { ...l.owned };
    const fresh = [...l.fresh];
    for (const id of items) {
      if (!SKIN_BY_ID[id]) continue;
      if (!owned[id] && !fresh.includes(id)) fresh.push(id);
      owned[id] = (owned[id] ?? 0) + 1;
    }
    return { ...l, owned, fresh, games: { played: l.games.played + 1, won: l.games.won + (won ? 1 : 0) } };
  });
}

/* Put an item on the boat; the stock one of its layer takes it off. */
export function equip(layer: Layer, id: string): Promise<Locker> {
  return change((l) => (SKIN_BY_ID[id]?.layer === layer && (l.owned[id] || id === STOCK[layer]) ? { ...l, equipped: { ...l.equipped, [layer]: id } } : l));
}

/* The locker has been looked at: nothing is new any more. */
export function seen(): Promise<Locker> {
  return change((l) => (l.fresh.length ? { ...l, fresh: [] } : l));
}

/* THE OWNER'S DEVELOPER BUTTONS (Settings, DEVELOPER): the piece back to
 * stock; every item gone (and the piece back to stock); every item owned. */
export const resetLook = () => change((l) => ({ ...l, equipped: { ...STOCK } }));
export const resetUnlocks = () => change((l) => ({ ...l, owned: {}, fresh: [], equipped: { ...STOCK } }));
export const unlockAll = () =>
  change((l) => {
    const owned = { ...l.owned };
    for (const s of DROPPABLE) owned[s.id] = Math.max(1, owned[s.id] ?? 0);
    return { ...l, owned, fresh: [] };
  });

/* The locker as it is, and again whenever it changes. */
export function useLocker(): Locker {
  const [l, setL] = useState<Locker>(cache ?? EMPTY);
  useEffect(() => {
    let on = true;
    loadLocker().then((v) => on && setL(v));
    const f = (v: Locker) => on && setL(v);
    subs.add(f);
    return () => {
      on = false;
      subs.delete(f);
    };
  }, []);
  return l;
}
