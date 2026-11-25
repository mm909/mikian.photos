import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/* THE RUN AND THE BOXES, kept on the phone (owner, 2026-11-24: "continue
 * from where you left off"; "one box per enemy killed, a rarer box per
 * boss"). The floor the last row reached and the run it was in, the runs
 * finished (each a permanent star, pve.ts STAR_DMG), and the boxes not yet
 * opened. A lost run starts the next row at floor 1. Arcade only: never a
 * row or the meters. */

export type Boxes = { box: number; boss: number };
export type RunState = { at: number; run: number; stars: number; boxes: Boxes };

const KEY = "arcade/run/1";
const BLANK = (): RunState => ({ at: 0, run: 0, stars: 0, boxes: { box: 0, boss: 0 } });
let cache: RunState | null = null;
const subs = new Set<(r: RunState) => void>();
const n = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.floor(Number(x)) : 0);

export async function loadRun(): Promise<RunState> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    cache = v ? { at: n(v.at), run: n(v.run), stars: n(v.stars), boxes: { box: n(v.boxes?.box), boss: n(v.boxes?.boss) } } : BLANK();
  } catch {
    cache = BLANK();
  }
  return cache;
}

let chain: Promise<unknown> = Promise.resolve();
function change(f: (r: RunState) => RunState): Promise<RunState> {
  const job = async () => {
    const next = f(await loadRun());
    cache = next;
    subs.forEach((s) => s(next));
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => null);
    return next;
  };
  const p = chain.then(job, job);
  chain = p.catch(() => null);
  return p;
}

/* The row is over: where the run stands, the stars won, the boxes earned. */
export const endRow = (r: { at: number; run: number; lost: boolean; stars: number; box: number; boss: number }) =>
  change((s) => ({
    at: r.lost ? 0 : r.at,
    run: r.run,
    stars: s.stars + r.stars,
    boxes: { box: s.boxes.box + r.box, boss: s.boxes.boss + r.boss },
  }));
/* A box opened. */
export const takeBox = (kind: keyof Boxes) => change((s) => ({ ...s, boxes: { ...s.boxes, [kind]: Math.max(0, s.boxes[kind] - 1) } }));

/* THE OWNER'S DEVELOPER BUTTONS (Settings, DEVELOPER). */
export const addBoxes = (box: number, boss: number) => change((s) => ({ ...s, boxes: { box: s.boxes.box + box, boss: s.boxes.boss + boss } }));
export const resetRun = () => change((s) => ({ ...s, at: 0, run: 0, stars: 0 }));
export const resetBoxes = () => change((s) => ({ ...s, boxes: { box: 0, boss: 0 } }));

export function useRun(): RunState {
  const [r, setR] = useState<RunState>(cache ?? BLANK());
  useEffect(() => {
    let on = true;
    loadRun().then((v) => on && setR(v));
    const f = (v: RunState) => on && setR(v);
    subs.add(f);
    return () => {
      on = false;
      subs.delete(f);
    };
  }, []);
  return r;
}
