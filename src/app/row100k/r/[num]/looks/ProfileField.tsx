"use client";

import { fmtClock, fmtInt, fmtK } from "../../../analysis/fmt";
import { KdeScrub } from "../../../stats/KdeScrub";
import type { FieldModel, FieldYou } from "../../../stats/field";

/* THE FIELD on the profile (owner ask, 2026-09-08): the two densities the
 * stats page draws — length of a row, split per 500 m — with EVERYONE as
 * the grey ground and this rower laid over it in blue, and a percentile for
 * each. The stats page has a switch for this; here it is always on, since
 * the page is already about one rower. Same pieces (KdeScrub, the .st-tile
 * voice), so the two pages agree to the pixel. */
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

function Tile({ k, n, l }: { k: string; n: React.ReactNode; l: string }) {
  return (
    <div className="st-tile you">
      <div className="k mono">{k}</div>
      <div className="n">{n}</div>
      <div className="l mono">{l}</div>
    </div>
  );
}

export function ProfileField({ field, you }: { field: FieldModel; you: FieldYou }) {
  const sessions = `${you.sessions} ${you.sessions === 1 ? "SESSION" : "SESSIONS"}`;
  return (
    <div>
      <div className="st-tiles">
        <Tile
          k="Average row"
          n={M(you.avgLen)}
          l={you.lenPct === null ? `NOBODY ELSE TO COMPARE YET · ${sessions}` : `LONGER THAN ${you.lenPct}% OF ROWERS · ${sessions}`}
        />
        <Tile
          k="Average pace"
          n={you.avgPace !== null ? SPLIT(you.avgPace) : "—"}
          l={
            you.avgPace === null
              ? "NO TIMED ROW YET"
              : you.pacePct === null
                ? "NOBODY ELSE TO COMPARE YET"
                : `FASTER THAN ${you.pacePct}% OF ROWERS`
          }
        />
      </div>

      {field.lengthKde && (
        <div className="st-kde">
          <div className="t">Length of every row · everyone in grey, you in blue</div>
          <KdeScrub
            c={field.lengthKde}
            you={you.lengthYou}
            kind="length"
            fmt={fmtK}
            ends={["← SHORTER", "LONGER →"]}
            label="Kernel density of meters per row across every session, with this rower's rows over it"
          />
        </div>
      )}

      {field.paceKde && (
        <div className="st-kde">
          <div className="t">Split per 500 m · everyone in grey, you in blue</div>
          <KdeScrub c={field.paceKde} you={you.paceYou} kind="split" />
        </div>
      )}
    </div>
  );
}
