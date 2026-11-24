import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Erg } from "../erg/useErg";
import { createArcade, type Arcade } from "./arcade";
import type { Phase, View159 } from "./game159";
import { grant } from "./locker";

/* THE ARCADE, held by the monitor beside the director (RowScreen.tsx), so
 * it has watched the whole row whichever page is up: the band of the next
 * game is read off the strokes before it. Told where the row is ten times a
 * second.
 *
 * The game moves every tick, and the monitor is a big tree of pages, so the
 * view is handed over in a ref that the game's own drawing reads on every
 * frame; the monitor is drawn again only when a game starts, changes phase
 * or ends. The chest's items go into the locker as the chest drops.
 *
 * OWNER ONLY for now (`on`): the App Store build has no games. */
export type Arcaded = { view: MutableRefObject<View159 | null>; id: string | null; phase: Phase | null };

export function useArcade(erg: Erg, on: boolean): Arcaded {
  const a = useRef<Arcade | null>(null);
  if (!a.current) a.current = createArcade(Date.now() % 1_000_000);
  const view = useRef<View159 | null>(null);
  const [at, setAt] = useState<{ id: string | null; phase: Phase | null }>({ id: null, phase: null });
  const now = useRef(erg);
  now.current = erg;
  const granted = useRef(new Set<string>());
  const live = on && erg.phase === "live";
  useEffect(() => {
    if (!live) {
      view.current = null;
      setAt({ id: null, phase: null });
      return;
    }
    const tick = () => {
      const l = now.current.live;
      if (!a.current) return;
      const v = a.current.step({ now: Date.now() / 1000, m: l.meters, pace: l.pace, spm: l.spm, strokes: l.strokes, target: l.targetM, ended: l.ended });
      view.current = v;
      if (v && v.phase === "reward" && v.chest && !granted.current.has(v.id)) {
        granted.current.add(v.id);
        grant(v.chest.items, !!v.won).catch(() => null);
      }
      const id = v?.id ?? null;
      const phase = v?.phase ?? null;
      setAt((was) => (was.id === id && was.phase === phase ? was : { id, phase }));
    };
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [live]);
  return { view, id: at.id, phase: at.phase };
}
