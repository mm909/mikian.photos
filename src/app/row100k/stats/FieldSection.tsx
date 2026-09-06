"use client";

import { useState, type ReactNode } from "react";
import { fmtClock, fmtInt, fmtK, fmtM } from "../analysis/fmt";
import { KdeSvg } from "../analysis/charts";
import type { FieldModel, FieldYou } from "./field";

/* THE FIELD: the stat tiles and the two densities, all precomputed on the
 * server (field.ts). The split-vs-distance scatter went back to the
 * numbers page (owner call, 2026-09-05, second look: just the two KDEs,
 * set at the bottom without a box around them). The only state is the
 * EVERYONE | YOU chip a joined rower with a session gets: YOU lays their
 * own rows over the same curves in blue and adds two tiles — their average
 * pace and their average row, each against every other rower's average.
 * Labels and numbers only, nothing explained (owner call, 2026-09-05: they
 * either know what an SD is or they do not). */

function Tile({ k, n, l, you }: { k: string; n: ReactNode; l: string; you?: boolean }) {
  return (
    <div className={you ? "st-tile you" : "st-tile"}>
      <div className="k mono">{k}</div>
      <div className="n">{n}</div>
      <div className="l mono">{l}</div>
    </div>
  );
}

const M = (v: number) => (
  <>
    {fmtInt(v)} <span className="u">m</span>
  </>
);
const SPLIT = (v: number) => (
  <>
    {fmtClock(v)} <span className="u">/500m</span>
  </>
);
const sessions = (n: number) => `${n} ${n === 1 ? "SESSION" : "SESSIONS"}`;

export function FieldSection({ field, you }: { field: FieldModel | null; you: FieldYou | null }) {
  const [mine, setMine] = useState(false);
  const on = mine && you !== null;

  if (!field || field.sessions === 0) {
    return <p className="board-empty">NOTHING LOGGED YET — THE FIELD DRAWS ITSELF AS ROWS LAND.</p>;
  }
  const { length, pace, mode } = field;

  return (
    <div>
      {you && (
        <div className="tabs" role="group" aria-label="Whose rows">
          <button type="button" className={on ? undefined : "on"} aria-pressed={!on} onClick={() => setMine(false)}>
            Everyone
          </button>
          <button type="button" className={on ? "on" : undefined} aria-pressed={on} onClick={() => setMine(true)}>
            You
          </button>
        </div>
      )}

      <div className="st-tiles">
        {length && (
          <Tile
            k="Length · median row"
            n={M(length.median)}
            l={`MEAN ${fmtM(length.mean)} · SD ${fmtM(length.sd)} · P10–P90 ${fmtInt(length.p10)}–${fmtM(length.p90)}`}
          />
        )}
        {pace && (
          <Tile
            k="Pace · median split"
            n={SPLIT(pace.median)}
            l={`MEAN ${fmtClock(pace.mean)} · SD ${fmtClock(pace.sd)} · P10–P90 ${fmtClock(pace.p10)}–${fmtClock(pace.p90)}`}
          />
        )}
        {mode && (
          <Tile
            k="Most common row"
            n={M(mode.meters)}
            l={`${sessions(mode.count)} · ${Math.round(mode.share * 100)}% OF EVERY ROW`}
          />
        )}
        {on && you && (
          <>
            <Tile
              k="Your average pace"
              n={you.avgPace !== null ? SPLIT(you.avgPace) : "—"}
              l={
                you.avgPace === null
                  ? "NO TIMED ROW YET"
                  : you.pacePct === null
                    ? "NOBODY ELSE TO COMPARE YET"
                    : `FASTER THAN ${you.pacePct}% OF ROWERS`
              }
              you
            />
            <Tile
              k="Your average row"
              n={M(you.avgLen)}
              l={
                you.lenPct === null
                  ? `NOBODY ELSE TO COMPARE YET · ${sessions(you.sessions)}`
                  : `LONGER THAN ${you.lenPct}% OF ROWERS · ${sessions(you.sessions)}`
              }
              you
            />
          </>
        )}
      </div>

      {/* The two densities sit under the tiles with a small mono title and
          a dashed hairline each — no 2px box (.st-kde, not .curve). */}
      {field.lengthKde && (
        <div className="st-kde">
          <div className="t">Length of every row</div>
          <KdeSvg
            c={field.lengthKde}
            you={on && you ? you.lengthYou : null}
            fmt={fmtK}
            ends={["← SHORTER", "LONGER →"]}
            label="Kernel density of meters per row across every session"
          />
        </div>
      )}

      {field.paceKde && (
        <div className="st-kde">
          <div className="t">Split per 500 m</div>
          <KdeSvg c={field.paceKde} you={on && you ? you.paceYou : null} />
        </div>
      )}
    </div>
  );
}
