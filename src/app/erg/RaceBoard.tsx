"use client";

import { fmtMeters, fmtPace } from "@/lib/pm5/pm5";
import { expectedFinish, pieceEnded, typedErgName, type FinishRead } from "./ErgGoal";
import { DEFAULT_GOAL_M, LINK_WORD, type Erg, type ErgLink } from "./hub";

/* THE RACE BOARD (owner, 2026-09-21: "a screen where it shows all the
 * rowers that are currently connected — a live race board. This would be
 * the view we are showing while people are actually racing. One row per
 * lane: the distance they are at, the pace they are rowing at, their
 * expected time, and who is in the lead — first, second, third").
 *
 * EVERY ERG ON THIS PAGE, AS A LANE, IN RACE ORDER. The order is metres
 * rowed, which is the only honest order mid-piece: a fast pace on a lane
 * that started late is not a lead. Beside each lane, how far behind the
 * leader it is — in metres, and in the seconds it would take at that lane's
 * own pace to close them, which is the number a spectator actually wants.
 *
 * IT IS THE SAME 5,000 FOR EVERYONE (owner, same day: "let us assume that
 * everyone is just going to be doing a 5K always"). The progress bar and the
 * expected finish are read against DEFAULT_GOAL_M on every lane whatever
 * that erg's own goal has been set to, so eight lanes are eight bars to the
 * same line.
 *
 * IT OWNS NOTHING. It is handed the list the monitors page already
 * subscribes to and paints it; a click on a lane opens that erg's console,
 * BACK goes to the list, and neither touches a link. Rows are keyed by erg
 * id, so a lane changing place is the same element moving and not a new
 * one.
 *
 * TWO SCREENS, ONE SET OF NUMBERS. This is the laptop board — a page with
 * the site bar, rows you can click. RaceBoardTv.tsx is the same lanes put
 * on a television (owner, same day: "this will be on a full screen
 * monitor, give me a view that would go on a TV"). Both read laneRows()
 * below, so the wall can never disagree with the desk. */

/* A lane that has not sent a status packet is on the board — it is paired —
 * but it has no metres and sorts to the bottom under the ones that do. */
function metres(e: Erg): number {
  return e.model.general ? e.model.general.distanceM : 0;
}

export function place(i: number): string {
  const n = i + 1;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "TH" : n % 10 === 1 ? "ST" : n % 10 === 2 ? "ND" : n % 10 === 3 ? "RD" : "TH";
  return `${n}${suffix}`;
}

export type Lane = {
  id: string;
  name: string;
  /* Zero-based race position. */
  rank: number;
  m: number;
  /* Seconds per 500 m, or null before the first stroke. */
  pace: number | null;
  avgPace: number | null;
  spm: number | null;
  elapsedS: number;
  fin: FinishRead;
  behindM: number;
  /* Seconds behind: the gap in metres at THIS lane's own pace, so a slower
   * lane is told the truth about how long the gap is for them, not for the
   * leader. Zero for the leader and for anyone without a pace yet. */
  behindS: number;
  /* Progress to the goal, 0..100. */
  pct: number;
  done: boolean;
  hasData: boolean;
  link: ErgLink;
};

export function laneRows(ergs: Erg[], goal: number = DEFAULT_GOAL_M): Lane[] {
  const sorted = [...ergs].sort((a, b) => metres(b) - metres(a));
  const leadM = sorted[0] ? metres(sorted[0]) : 0;
  return sorted.map((e, i) => {
    const g = e.model.general;
    const a1 = e.model.a1;
    const m = metres(e);
    const pace = a1 && a1.currentPaceS > 0 ? a1.currentPaceS : null;
    const behindM = Math.max(0, leadM - m);
    const behindS = pace && behindM > 0 ? (behindM / 500) * pace : 0;
    return {
      id: e.id,
      name: typedErgName(e) ?? e.name,
      rank: i,
      m,
      pace,
      avgPace: a1 && a1.averagePaceS > 0 ? a1.averagePaceS : null,
      spm: a1 && a1.strokeRate > 0 ? a1.strokeRate : null,
      elapsedS: g ? g.elapsedS : 0,
      fin: expectedFinish({ ...e, goalM: goal }),
      behindM,
      behindS,
      pct: Math.min(100, (m / goal) * 100),
      done: m >= goal || pieceEnded(e),
      hasData: g !== null,
      link: e.link,
    };
  });
}

export function RaceBoard({ ergs, onBack, onOpen, onTv }: { ergs: Erg[]; onBack: () => void; onOpen: (id: string) => void; onTv: () => void }) {
  const goal = DEFAULT_GOAL_M;
  const lanes = laneRows(ergs, goal);

  return (
    <div className="eg-board">
      <div className="eg-board-head">
        <button type="button" className="eg-btn eg-btn-quiet" onClick={onBack}>
          Monitors
        </button>
        <h1>Race board</h1>
        {/* THE WALL: the same lanes, full screen, for the television. */}
        <button type="button" className="eg-btn" onClick={onTv} disabled={lanes.length === 0}>
          On the TV
        </button>
        <span className="eg-eyebrow">
          {lanes.length} {lanes.length === 1 ? "LANE" : "LANES"} · {fmtMeters(goal)} · LIVE
        </span>
      </div>

      {lanes.length === 0 ? (
        <div className="eg-empty">No ergs paired yet — ADD AN ERG on the monitors page and they appear here as lanes.</div>
      ) : (
        <div className="eg-lanes">
          {lanes.map((l) => (
            <button type="button" className={l.rank === 0 ? "eg-lane eg-lane-lead" : "eg-lane"} key={l.id} onClick={() => onOpen(l.id)}>
              <span className="eg-lane-place">{place(l.rank)}</span>
              <span className="eg-lane-who">
                <span className="eg-lane-name">{l.name}</span>
                <span className="eg-lane-sub">
                  {l.link === "live" ? "" : `${LINK_WORD[l.link]} · `}
                  {l.done ? "FINISHED" : l.rank === 0 ? "LEADER" : `${fmtMeters(Math.round(l.behindM))} BACK`}
                </span>
                <span className="eg-lane-bar" aria-hidden="true">
                  <span style={{ width: `${l.pct}%` }} />
                </span>
              </span>
              <span className="eg-lane-n">
                <span className="k">Distance</span>
                <span className="v">{l.hasData ? Math.floor(l.m).toLocaleString("en-US") : "—"}</span>
                <span className="s">OF {Math.round(goal).toLocaleString("en-US")}</span>
              </span>
              <span className="eg-lane-n">
                <span className="k">Pace /500m</span>
                <span className="v">{l.pace ? fmtPace(l.pace) : "—"}</span>
                <span className="s">{l.avgPace ? `AVG ${fmtPace(l.avgPace)}` : ""}</span>
              </span>
              <span className="eg-lane-n">
                <span className="k">{l.done ? "Finish" : "Expected"}</span>
                <span className="v">{l.fin.value}</span>
                <span className="s">{l.fin.under}</span>
              </span>
              <span className="eg-lane-n eg-lane-gap">
                <span className="k">Behind</span>
                <span className="v">{l.rank === 0 || l.done ? "—" : l.behindS > 0 ? `${l.behindS.toFixed(1)} s` : "—"}</span>
                <span className="s">{l.rank === 0 ? "" : `${fmtMeters(Math.round(l.behindM))}`}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="eg-board-foot">
        In race order by metres rowed. BEHIND is how long the gap would take to close at that lane&apos;s own pace. Everyone is read against the
        same {fmtMeters(goal)}. Click a lane to open it; the link stays up. ON THE TV fills the screen with the same lanes — three looks, pick one
        with the keys 1, 2 and 3.
      </p>
    </div>
  );
}
