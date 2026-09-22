"use client";

import { fmtMeters, fmtPace } from "@/lib/pm5/pm5";
import { fmtTime, type Block } from "@/lib/pm5/predict";
import { blocksFor, pieceEnded, predictForErg, readFinish, typedErgName, type FinishRead } from "./ErgGoal";
import { DEFAULT_GOAL_M, LINK_WORD, type Erg, type ErgLink } from "./hub";

/* THE RACE BOARD (owner, 2026-09-21: "a screen where it shows all the
 * rowers that are currently connected — a live race board. This would be
 * the view we are showing while people are actually racing. One row per
 * lane: the distance they are at, the pace they are rowing at, their
 * expected time, and who is in the lead — first, second, third").
 *
 * EVERY ERG ON THIS PAGE, AS A LANE, IN RACE ORDER. Mid-piece the order is
 * metres rowed, which is the only honest order then: a fast pace on a lane
 * that started late is not a lead. FINISHED LANES COME FIRST, BY THEIR
 * TIME (owner, 2026-09-22: "think about what place every rower ends in —
 * they should be in order of finish time when done; it looked like all
 * the finished rowers got moved to the bottom"): a lane that has rowed the
 * whole distance holds a place nothing still on the water can take from
 * it, so the top of the board is the finish order and the rest of the
 * field sorts under it by metres. BEHIND, for a finished lane, is the gap
 * to the winner's time; for a lane still rowing, the gap in metres to the
 * leader and the seconds it would take to close at that lane's own pace.
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

/* THE NAME ON THE LANE. A typed name wins; otherwise the monitor's own,
 * which for a real PM5 is "PM5 530737731 Row Erg" — twelve of those in a
 * column are twelve identical rows with the digits that differ cut off
 * (owner's photo, 2026-09-22). So a PM5's advertised name is shortened to
 * its make and the last four of its serial, which is how the gym tells
 * them apart anyway. */
export function shortErgName(name: string): string {
  const m = /^PM5\s+(\d{4,})/i.exec(name.trim());
  if (m) return `PM5 ·${m[1].slice(-4)}`;
  return name.replace(/\s+Row\s*Erg$/i, "").trim() || name;
}

export type Lane = {
  id: string;
  name: string;
  /* Zero-based race position: finish order first, then by metres. */
  rank: number;
  m: number;
  /* Seconds per 500 m, or null before the first stroke. */
  pace: number | null;
  avgPace: number | null;
  spm: number | null;
  elapsedS: number;
  fin: FinishRead;
  /* The rowed time, seconds, once the distance is done; null while rowing. */
  finishS: number | null;
  /* Metres behind the leader (0 for a finished lane). */
  behindM: number;
  /* Seconds behind: a finished lane's gap to the winner; a rowing lane's
   * gap in metres at ITS OWN pace, so a slower lane is told the truth
   * about how long the gap is for them. Zero for the leader and for
   * anyone without a pace yet. */
  behindS: number;
  /* Progress to the goal, 0..100. */
  pct: number;
  done: boolean;
  hasData: boolean;
  link: ErgLink;
  /* The 500 m blocks rowed so far (ErgGoal blocksFor), for the splits wall. */
  blocks: Block[];
};

export function laneRows(ergs: Erg[], goal: number = DEFAULT_GOAL_M): Lane[] {
  const read = ergs.map((e) => {
    const g = e.model.general;
    const m = metres(e);
    const ended = m >= goal || pieceEnded(e);
    const p = predictForErg({ ...e, goalM: goal });
    /* The finish is the predictor's when the goal is rowed (remainingS 0
     * means the whole distance is in the samples), else the monitor's
     * clock — an erg the PM5 has ended short of the goal is done at the
     * time it shows. */
    const finishS = ended ? (p.ready && p.remainingS === 0 && p.finishS !== null ? p.finishS : g ? g.elapsedS : null) : null;
    return { e, m, ended, p, finishS };
  });
  const sorted = [...read].sort((a, b) => {
    if (a.finishS !== null && b.finishS !== null) return a.finishS - b.finishS;
    if (a.finishS !== null) return -1;
    if (b.finishS !== null) return 1;
    return b.m - a.m;
  });
  const leadM = sorted.reduce((best, r) => Math.max(best, r.m), 0);
  const winnerS = sorted[0]?.finishS ?? null;
  return sorted.map((r, i) => {
    const { e, m, ended, p, finishS } = r;
    const a1 = e.model.a1;
    const g = e.model.general;
    const pace = a1 && a1.currentPaceS > 0 ? a1.currentPaceS : null;
    const behindM = finishS !== null ? 0 : Math.max(0, leadM - m);
    const behindS =
      finishS !== null && winnerS !== null ? Math.max(0, finishS - winnerS) : pace && behindM > 0 ? (behindM / 500) * pace : 0;
    return {
      id: e.id,
      name: typedErgName(e) ?? shortErgName(e.name),
      rank: i,
      m,
      pace,
      avgPace: a1 && a1.averagePaceS > 0 ? a1.averagePaceS : null,
      spm: a1 && a1.strokeRate > 0 ? a1.strokeRate : null,
      elapsedS: g ? g.elapsedS : 0,
      fin: finishS !== null ? { value: fmtTime(finishS), under: "FINISH", ready: true, hint: null } : readFinish(p),
      finishS,
      behindM,
      behindS,
      pct: Math.min(100, (m / goal) * 100),
      done: ended,
      hasData: g !== null,
      link: e.link,
      blocks: blocksFor(e).blocks,
    };
  });
}

/* The gap, as a board says it: the leader has none, a finished lane is
 * +seconds on the winner, a rowing lane is +seconds at its own pace. */
export function gapWord(l: Lane): string {
  if (l.rank === 0) return l.done ? "WINNER" : "LEADER";
  return l.behindS > 0 ? `+${l.behindS.toFixed(1)}` : "—";
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
                <span className="v">{l.rank === 0 ? "—" : l.behindS > 0 ? `${l.behindS.toFixed(1)} s` : "—"}</span>
                <span className="s">{l.rank === 0 ? "" : l.done ? "ON THE WINNER" : `${fmtMeters(Math.round(l.behindM))}`}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="eg-board-foot">
        Finished lanes first, in the order they finished; the rest by metres rowed. BEHIND is a finished lane&apos;s gap on the winner, or how
        long a gap would take to close at that lane&apos;s own pace. Everyone is read against the same {fmtMeters(goal)}. Click a lane to open it;
        the link stays up. ON THE TV fills the screen with the same lanes — five looks that turn over on their own, or pick one with the keys 1
        to 5.
      </p>
    </div>
  );
}
