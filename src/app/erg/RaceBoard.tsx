"use client";

import { useState } from "react";
import { fmtMeters } from "@/lib/pm5/pm5";
import { fmtTime, type Block } from "@/lib/pm5/predict";
import { thinPoints, type XY } from "./chartGeom";
import { blocksFor, pieceEnded, predictForErg, readFinish, typedErgName, type FinishRead } from "./ErgGoal";
import { boardHideCss } from "./boardHideCss";
import { DEFAULT_GOAL_M, type Erg, type ErgLink, LINK_WORD, boardErgs, boardRowersOnly, setBoardRowersOnly, setErgHidden } from "./hub";

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
 * on time, and says so with a minus.
 *
 * AND THE ORDER IS THE EXPECTED FINISH (owner, 2026-09-23, after a
 * morning on the equal-clock gap: "instead of the main stat being leader
 * and then number of seconds behind we show the expected finish time
 * rounded to the second … that way it should always be in order"). The
 * lanes still rowing are ranked by the finish the predictor expects, the
 * big number on the wall IS that finish, and the seconds behind are the
 * difference between expected finishes — one number that orders the
 * field and explains itself. A lane the predictor cannot yet read sorts
 * last. The equal-clock metres are still carried, for the small line.
 *
 * FINISHED AND ROWING SHARE ONE ORDER (owner, 2026-09-23: "in the case
 * where one person has finished and others are still going, still put
 * them in order of expected finish — those faster than 19:10 should be
 * higher than the finished, and it should not be labelled winner"). A
 * rowed time and an expected one sort together; nobody is the WINNER
 * until everybody is in; a rowing lane above every finished lane is
 * SECONDS AHEAD of the best finished time rather than behind anyone.
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

/* PACE TO THE WHOLE SECOND on the boards (owner, 2026-09-23: "floor all
 * pace values so 1:55.6 goes to 1:55"). */
export function fmtPaceWhole(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const r = t % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

/* A finish to the nearest second — the expected one is a prediction and
 * tenths would be a claim (owner, 2026-09-23: "expected finish time can
 * also be rounded, probably to the nearest second"). */
export function fmtTimeRound(s: number): string {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const r = t % 60;
  const ms = `${h ? String(m).padStart(2, "0") : m}:${r < 10 ? "0" : ""}${r}`;
  return h ? `${h}:${ms}` : ms;
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
  /* The finish the predictor expects, seconds, while rowing; null before
   * it can say. */
  expectS: number | null;
  /* The finish as the boards print it: the rowed time to the tenth once
   * done, the expected one to the second while rowing, — before that. */
  expWord: string;
  /* Every lane on the board is in. Only then is the first the WINNER. */
  allDone: boolean;
  /* Seconds this rowing lane is expected to beat the best finished time
   * by; null when it is not above every finished lane, or nobody is in. */
  aheadS: number | null;
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

export function laneRows(all: Erg[], goal: number = DEFAULT_GOAL_M): Lane[] {
  /* Hidden ergs and, under ROWERS ONLY, ergs with nobody on them are not
   * lanes (hub.ts boardErgs). */
  const ergs = boardErgs(all);
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
  /* The yardstick: the lane with the most metres among those still
   * rowing, whose track every rowing lane is measured along. */
  const lead = sorted.find((r) => r.finishS === null) ?? sorted[0] ?? null;
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
  /* The gap on equal clocks, per rowing lane, then the rowing lanes in
   * that order under the finished ones, and the gaps re-based on the new
   * first. */
  const gapOf = new Map<Erg, { m: number; expect: number | null }>();
  for (const r of sorted) {
    if (r.finishS !== null) continue;
    const g = r.e.model.general;
    const dm = r === lead ? 0 : leaderAt(g ? g.elapsedS : 0) - r.m;
    gapOf.set(r.e, { m: dm, expect: r.p.ready && r.p.finishS !== null ? r.p.finishS : null });
  }
  /* ONE ORDER: a rowed time and an expected one sort together. */
  const keyOf = (r: (typeof sorted)[number]) => r.finishS ?? gapOf.get(r.e)?.expect ?? Number.POSITIVE_INFINITY;
  const ordered = [...sorted].sort((a, b) => keyOf(a) - keyOf(b) || (a.finishS !== null ? -1 : b.finishS !== null ? 1 : 0) || b.m - a.m);
  const topKey = ordered[0] ? keyOf(ordered[0]) : Number.POSITIVE_INFINITY;
  const doneTimes = sorted.filter((r) => r.finishS !== null).map((r) => r.finishS as number);
  const bestDone = doneTimes.length ? Math.min(...doneTimes) : null;
  const allDone = sorted.length > 0 && doneTimes.length === sorted.length;
  return ordered.map((r, i) => {
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
    const gap = gapOf.get(e) ?? { m: 0, expect: null };
    const behindM = finishS !== null ? 0 : gap.m;
    const key = keyOf(r);
    const behindS = Number.isFinite(key) && Number.isFinite(topKey) ? Math.max(0, key - topKey) : 0;
    const aheadS = finishS === null && gap.expect !== null && bestDone !== null && gap.expect < bestDone ? bestDone - gap.expect : null;
    const expWord = finishS !== null ? fmtTime(finishS) : gap.expect !== null ? `~${fmtTimeRound(gap.expect)}` : "—";
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
      expectS: gap.expect,
      expWord,
      allDone,
      aheadS,
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
  if (l.rank === 0) return l.done ? (l.allDone ? "WINNER" : "FINISHED") : "LEADER";
  if (l.done) return `+${l.behindS.toFixed(1)}`;
  if (l.expectS === null) return "—";
  return `+${Math.round(l.behindS)}`;
}

/* THE LINE UNDER THE FINISH, as the boards say it: what the gap is a gap
 * on. One place, so the wall, the standings and the desk agree. */
export function gapLine(l: Lane): string {
  /* A finished lane just says so (owner, 2026-09-23: no "+x on the first",
   * no "+x on the winner" once everyone is in — the time above it is the
   * whole story). */
  if (l.done) return l.rank === 0 && l.allDone ? "winner" : "finished";
  if (l.expectS === null) return "no read yet";
  if (l.aheadS !== null) return `${Math.round(l.aheadS)} s ahead`;
  if (l.rank === 0) return "expected";
  return `+${Math.round(l.behindS)} s behind`;
}

/* THE NAME A HIDDEN ERG GOES BY in the list that brings it back — the
 * same name its lane wore. */
export function laneName(e: Erg): string {
  return typedErgName(e) ?? shortErgName(e.name);
}

/* THE LIST OF HIDDEN ERGS, with a SHOW word on each and SHOW ALL under
 * them. Opened from the head of the desk board; the wall has its own line
 * in the control strip (RaceBoardTv.tsx). Everything goes through the hub,
 * so the monitors page, the board and the wall agree. */
export function HiddenList({ hidden }: { hidden: Erg[] }) {
  return (
    <div className="eg-hidden-list" role="region" aria-label="Hidden ergs">
      <span className="eg-eyebrow">
        {hidden.length} {hidden.length === 1 ? "ERG" : "ERGS"} HIDDEN FROM THE BOARD
      </span>
      {hidden.map((e) => (
        <div className="eg-hidden-row" key={e.id}>
          <span className="nm">{laneName(e)}</span>
          <span className="sub">{LINK_WORD[e.link]}</span>
          <button type="button" className="eg-word" onClick={() => setErgHidden(e.id, false)}>
            Show
          </button>
        </div>
      ))}
      {hidden.length > 1 ? (
        <div className="eg-hidden-all">
          <button type="button" className="eg-word" onClick={() => hidden.forEach((e) => setErgHidden(e.id, false))}>
            Show all
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RaceBoard({ ergs, onBack, onOpen, onTv }: { ergs: Erg[]; onBack: () => void; onOpen: (id: string) => void; onTv: () => void }) {
  const goal = DEFAULT_GOAL_M;
  const lanes = laneRows(ergs, goal);
  /* HIDDEN LIVE (owner, 2026-09-24: "give me the ability to hide ergs live
   * on the race board if they are not being used"). The x beside each lane
   * hides it through the hub; the head counts the hidden and opens the
   * list that brings any of them back. ROWERS ONLY is a different thing —
   * an erg with nobody on it is OFF THE BOARD, not hidden — and the eyebrow
   * counts those separately. */
  const hidden = ergs.filter((e) => e.hidden);
  const [showHidden, setShowHidden] = useState(false);
  const listOpen = showHidden && hidden.length > 0;
  const offBoard = ergs.length - lanes.length - hidden.length;

  return (
    <div className="eg-board">
      <style>{boardHideCss}</style>
      <div className="eg-board-head">
        <button type="button" className="eg-btn eg-btn-quiet" onClick={onBack}>
          Monitors
        </button>
        <h1>Race board</h1>
        {/* THE WALL: the same lanes, full screen, for the television. */}
        <button type="button" className="eg-btn" onClick={onTv} disabled={lanes.length === 0}>
          On the TV
        </button>
        {/* ROWERS ONLY (owner, 2026-09-24): ergs with nobody assigned this
          * round drop off the board and the wall. */}
        <button type="button" className={boardRowersOnly() ? "eg-btn on" : "eg-btn eg-btn-quiet"} aria-pressed={boardRowersOnly()} onClick={() => setBoardRowersOnly(!boardRowersOnly())}>
          Rowers only
        </button>
        {hidden.length > 0 ? (
          <button type="button" className="eg-word" aria-expanded={listOpen} onClick={() => setShowHidden((v) => !v)}>
            {listOpen ? "Close" : "Show"} {hidden.length} hidden
          </button>
        ) : null}
        <span className="eg-eyebrow">
          {lanes.length} {lanes.length === 1 ? "LANE" : "LANES"}
          {offBoard > 0 ? ` · ${offBoard} OFF THE BOARD` : ""}
          {hidden.length > 0 ? ` · ${hidden.length} HIDDEN` : ""} · {fmtMeters(goal)} · LIVE
        </span>
      </div>

      {listOpen ? <HiddenList hidden={hidden} /> : null}

      {lanes.length === 0 ? (
        <div className="eg-empty">
          {ergs.length === 0
            ? "No ergs paired yet — ADD AN ERG on the monitors page and they appear here as lanes."
            : hidden.length === ergs.length
              ? "Every erg is hidden — SHOW one above and it is a lane again."
              : "No lanes — every paired erg is hidden or has no rower (ROWERS ONLY)."}
        </div>
      ) : (
        <div className="eg-lanes">
          {lanes.map((l) => (
            /* The lane is a button that opens the console; the x beside it
             * is ITS OWN button, so hiding never opens. */
            <div className="eg-lane-row" key={l.id}>
              <button type="button" className={l.rank === 0 ? "eg-lane eg-lane-lead" : "eg-lane"} onClick={() => onOpen(l.id)}>
                <span className="eg-lane-place">{place(l.rank)}</span>
                <span className="eg-lane-who">
                  <span className="eg-lane-name">{l.name}</span>
                  <span className="eg-lane-sub">
                    {l.link === "live" ? "" : `${LINK_WORD[l.link]} · `}
                    {l.done ? gapLine(l).toUpperCase() : l.rank === 0 ? "LEADER" : l.behindM >= 0 ? `${fmtMeters(Math.round(l.behindM))} BACK ON THE CLOCK` : `${fmtMeters(Math.round(-l.behindM))} UP ON THE CLOCK`}
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
                  <span className="v">{l.pace ? fmtPaceWhole(l.pace) : "—"}</span>
                  <span className="s">{l.avgPace ? `AVG ${fmtPaceWhole(l.avgPace)}` : ""}</span>
                </span>
                <span className="eg-lane-n">
                  <span className="k">{l.done ? "Finish" : "Expected"}</span>
                  <span className="v">{l.expWord}</span>
                  <span className="s">{l.done ? "FINISH" : l.expectS !== null ? "TO THE SECOND" : l.fin.under}</span>
                </span>
                <span className="eg-lane-n eg-lane-gap">
                  <span className="k">Behind</span>
                  <span className="v">{l.aheadS !== null ? `${Math.round(l.aheadS)} s` : l.done || l.rank === 0 || gapWord(l) === "—" ? "—" : `${gapWord(l)} s`}</span>
                  <span className="s">{l.aheadS !== null ? "AHEAD" : l.done || l.rank === 0 ? "" : "ON EXPECTED FINISH"}</span>
                </span>
              </button>
              <button type="button" className="eg-lane-hide" onClick={() => setErgHidden(l.id, true)} aria-label={`Hide ${l.name} from the race board`} title="Hide from the race board">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
