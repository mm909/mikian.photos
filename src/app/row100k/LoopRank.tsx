"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { LOGGED_EVENT, LOOP_RANK_AT_MS, reducedMotion, type LoggedDetail, type LoopData } from "./loop";

/* THE PLACE, under the big number (the loop mock's rank line and two-row
 * board): "#8 OF 41 MEN · 1,200 M BEHIND #7", then the rower just above
 * and the viewer as two rows. When a saved row carries the viewer past
 * someone, the rows swap — the viewer's row slides up, theirs slides down
 * — and the numbers tick to the new place; with nobody passed, only the
 * gap line changes. The rows come off the PUBLIC board the page read, the
 * viewer's own division, unmasked; while the elite are hidden the page
 * hands no rows and this prints nothing. */

const DIV_WORD = { M: "men", F: "women", X: "rowers" } as const;

function placeOf(rows: LoopData["rows"], me: number, meters: number): number {
  return 1 + rows.filter((r) => r.rowerNumber !== me && r.meters > meters).length;
}

function aboveOf(rows: LoopData["rows"], me: number, meters: number) {
  let best: LoopData["rows"][number] | null = null;
  for (const r of rows) {
    if (r.rowerNumber === me || r.meters <= meters) continue;
    if (!best || r.meters < best.meters) best = r;
  }
  return best;
}

export function LoopRank({ loop, me, meters, name }: { loop: LoopData; me: number; meters: number; name: string }) {
  const [mine, setMine] = useState(meters);
  const [swapping, setSwapping] = useState(false);
  /* The row shown above, held through a swap so the old neighbour is the
   * one that slides down. */
  const [shownAbove, setShownAbove] = useState(() => aboveOf(loop.rows, me, meters));
  const mineRef = useRef(mine);
  mineRef.current = mine;

  // The server's number after a refresh wins over the folded-in one.
  useEffect(() => {
    setMine(meters);
    setShownAbove(aboveOf(loop.rows, me, meters));
  }, [meters, loop.rows, me]);

  useEffect(() => {
    let t1 = 0;
    let t2 = 0;
    const on = (e: Event) => {
      const add = (e as CustomEvent<LoggedDetail>).detail?.meters ?? 0;
      if (!(add > 0)) return;
      const was = mineRef.current;
      const now = was + add;
      const passed = loop.rows.some((r) => r.rowerNumber !== me && r.meters > was && r.meters < now);
      const run = () => {
        if (!passed || reducedMotion()) {
          setMine(now);
          setShownAbove(aboveOf(loop.rows, me, now));
          return;
        }
        setMine(now);
        setSwapping(true);
        t2 = window.setTimeout(() => {
          setSwapping(false);
          setShownAbove(aboveOf(loop.rows, me, now));
        }, 600);
      };
      t1 = window.setTimeout(run, reducedMotion() ? 0 : LOOP_RANK_AT_MS);
    };
    window.addEventListener(LOGGED_EVENT, on);
    return () => {
      window.removeEventListener(LOGGED_EVENT, on);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loop.rows, me]);

  // Everyone in the division with a meter, the viewer counted once —
  // their first row puts them on the board before the refresh says so.
  const of = useMemo(() => loop.rows.filter((r) => r.rowerNumber !== me && r.meters > 0).length + 1, [loop.rows, me]);
  if (loop.rows.length === 0 || loop.division === "X") return null;

  const place = placeOf(loop.rows, me, mine);
  const above = shownAbove;
  const word = DIV_WORD[loop.division];
  const gap = above ? `${fmtMeters(above.meters - mine)} behind #${placeOf(loop.rows, me, above.meters)}` : `leading the ${word}`;

  return (
    <div className="lp-rank" aria-live="polite">
      <p className="lp-line mono">
        <b>
          <span className="lp-tick" key={place}>#{place}</span> of {of} {word}
        </b>
        <span className="lp-gap">{gap}</span>
      </p>
      <div className={`lp-mini${swapping ? " swap" : ""}`}>
        {above && (
          <div className="lp-row them">
            <span className="rk">{swapping ? placeOf(loop.rows, me, above.meters) + 1 : placeOf(loop.rows, me, above.meters)}</span>
            <span className="who">
              <span className="n">{fmtRowerNumber(above.rowerNumber)} · </span>
              {above.name}
            </span>
            <span className="m">{fmtMeters(above.meters)}</span>
          </div>
        )}
        <div className={`lp-row me${above ? "" : " alone"}`}>
          <span className="rk">{place}</span>
          <span className="who">
            <span className="n">{fmtRowerNumber(me)} · </span>
            {name}
          </span>
          <span className="m">{fmtMeters(mine)}</span>
        </div>
      </div>
    </div>
  );
}
