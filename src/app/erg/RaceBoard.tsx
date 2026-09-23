"use client";

import { fmtMeters, fmtPace } from "@/lib/pm5/pm5";
import { fmtTime, type Block } from "@/lib/pm5/predict";
import { thinPoints, type XY } from "./chartGeom";
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
 * to the winner's time.
 *
 * FOR A LANE STILL ROWING THE GAP IS ON EQUAL CLOCKS (owner, 2026-09-23:
 * "I do not like presenting the second rower as 32 seconds behind — it is
 * only that far behind because the rower started thirty seconds later.
 * What if they are actually ahead of where the first place rower was at
 * that same time"). Lanes do not all start together in a gym, so a gap in
 * metres on the wall is a gap in start times as much as anything. So the
 * gap is read against WHERE THE LEADER WAS AT THIS LANE'S ELAPSED — the
 * leader's own track, interpolated at this lane's clock — in metres, and
 * in the seconds that gap is at this lane's own pace. It is SIGNED: a lane
 * that has rowed further than the leader had at the same clock is ahead
 * on time, and says so with a minus. The running order stays by metres,
 * which is what is on the water; the gap is what the race would say.
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
  /* THE PACE OVER THE LAST 500 METRES (owner, 2026-09-22: "on the tower
   * view I want the pace to be avg pace over the last 500 meters") — the
   * clock between the sample 500 m back and now, per 500. Null until at
   * least half a block is behind them. */
  pace500: number | null;
  /* THE WALL'S SERIES: pace per 500 over METRES, thinned, the first five
   * seconds left off as on the console; the wall draws a rolling window
   * off the end of it. */
  series: { pace: XY[] };
  spm: number | null;
  elapsedS: number;
  fin: FinishRead;
  /* The rowed time, seconds, once the distance is done; null while rowing. */
  finishS: number | null;
  /* Metres behind where the leader was at this lane's clock — SIGNED,
   * negative when this lane is ahead on time. 0 for a finished lane. */
  behindM: number;
  /* Seconds behind, signed: a finished lane's gap to the winner; a rowing
   * lane's equal-clock gap in metres at ITS OWN pace, so a slower lane is
   * told the truth about how long the gap is for them. Zero for the
   * leader and for anyone without a pace yet. */
  behindS: number;
  /* Metres over elapsed seconds, thinned — the track another lane's gap is
   * read against. */
  track: XY[];
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
    const track = thinPoints(
      e.model.samples.filter((x) => x.t > 0).map((x) => ({ x: x.t, y: x.dist })),
      600,
    );
    return { e, m, ended, p, finishS, track };
  });
  const sorted = [...read].sort((a, b) => {
    if (a.finishS !== null && b.finishS !== null) return a.finishS - b.finishS;
    if (a.finishS !== null) return -1;
    if (b.finishS !== null) return 1;
    return b.m - a.m;
  });
  const lead = sorted[0] ?? null;
  const winnerS = lead?.finishS ?? null;
  /* Where the leader was at a given clock, off their track; their metres
   * now once the clock runs past their last sample. */
  const leaderAt = (t: number): number => {
    if (!lead) return 0;
    const tr = lead.track;
    if (tr.length === 0) return lead.m;
    if (t >= tr[tr.length - 1].x) return Math.max(lead.m, tr[tr.length - 1].y);
    if (t <= tr[0].x) return 0;
    let lo = 0;
    let hi = tr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tr[mid].x <= t) lo = mid;
      else hi = mid;
    }
    const a = tr[lo];
    const b = tr[hi];
    const f = b.x > a.x ? (t - a.x) / (b.x - a.x) : 0;
    return a.y + (b.y - a.y) * f;
  };
  return sorted.map((r, i) => {
    const { e, m, ended, p, finishS, track } = r;
    const a1 = e.model.a1;
    const g = e.model.general;
    const pace = a1 && a1.currentPaceS > 0 ? a1.currentPaceS : null;
    const ss = e.model.samples;
    let pace500: number | null = null;
    if (ss.length > 1) {
      const last = ss[ss.length - 1];
      let j = ss.length - 2;
      while (j > 0 && last.dist - ss[j].dist < 500) j--;
      const back = ss[j];
      const dm = last.dist - back.dist;
      const dt = last.t - back.t;
      if (dm >= 250 && dt > 0) pace500 = (dt / dm) * 500;
    }
    const series = {
      pace: thinPoints(
        ss.filter((x) => x.t >= 5 && x.pace > 0 && x.pace < 600).map((x) => ({ x: x.dist, y: x.pace })),
        600,
      ),
    };
    const behindM = finishS !== null || i === 0 ? 0 : leaderAt(g ? g.elapsedS : 0) - m;
    const behindS = finishS !== null && winnerS !== null ? Math.max(0, finishS - winnerS) : pace && behindM !== 0 ? (behindM / 500) * pace : 0;
    return {
      id: e.id,
      name: typedErgName(e) ?? shortErgName(e.name),
      rank: i,
      m,
      pace,
      /* THE AVERAGE FOR THE WHOLE ROW once it is rowed (owner, 2026-09-22:
       * "fill in their avg 500 with the avg pace for the whole row") — the
       * PM5 drops its status once the piece ends, so it is the finish
       * clock over the distance, not the monitor's last word. */
      avgPace: finishS !== null && m > 0 ? (finishS / m) * 500 : a1 && a1.averagePaceS > 0 ? a1.averagePaceS : null,
      pace500,
      series,
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
      track,
      blocks: blocksFor(e).blocks,
    };
  });
}

/* The gap, as a board says it: the leader has none, a finished lane is
 * +seconds on the winner, a rowing lane is +seconds at its own pace. */
export function gapWord(l: Lane): string {
  if (l.rank === 0) return l.done ? "WINNER" : "LEADER";
  if (Math.abs(l.behindS) < 0.05) return l.done ? "+0.0" : "LEVEL";
  return l.behindS > 0 ? `+${l.behindS.toFixed(1)}` : `−${Math.abs(l.behindS).toFixed(1)}`;
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
                  {l.done
                    ? "FINISHED"
                    : l.rank === 0
                      ? "LEADER"
                      : l.behindM >= 0
                        ? `${fmtMeters(Math.round(l.behindM))} BACK ON THE CLOCK`
                        : `${fmtMeters(Math.round(-l.behindM))} UP ON THE CLOCK`}
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
                <span className="v">{l.rank === 0 ? "—" : gapWord(l) === "LEVEL" ? "LEVEL" : `${gapWord(l)} s`}</span>
                <span className="s">{l.rank === 0 ? "" : l.done ? "ON THE WINNER" : "AT THE SAME CLOCK"}</span>
              </span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
