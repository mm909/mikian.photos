"use client";

import type { ReactNode } from "react";
import { fmtClock, fmtInt, fmtK, fmtM } from "../analysis/fmt";
import { HoursSvg } from "../analysis/charts";
import type { HourChart } from "../analysis/model";
import { KdeScrub } from "./KdeScrub";
import type { FieldModel } from "./field";

/* THE FIELD: the stat tiles, the two densities and the hour of the day,
 * all precomputed on the server (field.ts). The split-vs-distance scatter
 * went back to the numbers page (owner call, 2026-09-05, second look: just
 * the two KDEs, set at the bottom without a box around them). Everyone,
 * only: the EVERYONE | YOU chip and the two YOU tiles went on 2026-09-08
 * (owner: "remove the YOU option on the field on the stats page") — the
 * profile carries a rower's own overlay now. No state left in here. Labels
 * and numbers only, nothing explained (owner call, 2026-09-05: they either
 * know what an SD is or they do not). */

function Tile({ k, n, l }: { k: string; n: ReactNode; l: string }) {
  return (
    <div className="st-tile">
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
export function FieldSection({ field, hours = null }: { field: FieldModel | null; hours?: HourChart | null }) {
  if (!field || field.sessions === 0) {
    return <p className="board-empty">NOTHING LOGGED YET — THE FIELD DRAWS ITSELF AS ROWS LAND.</p>;
  }
  const { length, pace } = field;

  return (
    <div>
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
      </div>

      {/* The two densities sit under the tiles with a small mono title and
          a dashed hairline each — no 2px box (.st-kde, not .curve). Each
          is a scrub (KdeScrub): a finger, the mouse or the arrow keys read
          a value and its share of the field off the curve. */}
      {field.lengthKde && (
        <div className="st-kde">
          <div className="t">Length of every row</div>
          <KdeScrub
            c={field.lengthKde}
            you={null}
            kind="length"
            fmt={fmtK}
            ends={["← SHORTER", "LONGER →"]}
            label="Kernel density of meters per row across every session"
          />
        </div>
      )}

      {field.paceKde && (
        <div className="st-kde">
          <div className="t">Split per 500 m</div>
          <KdeScrub c={field.paceKde} you={null} kind="split" />
        </div>
      )}

      {/* The hour of the day, right under the split (owner, 2026-09-08):
          the numbers page's chart in the same quiet frame, every bar filled
          — the under-five dashing is the numbers page's — and no foot line,
          no takeaway, no time zone said. */}
      {hours && (
        <div className="st-kde">
          <div className="t">Hour of the day</div>
          <HoursSvg c={hours} you={null} fillSmall />
        </div>
      )}
    </div>
  );
}
