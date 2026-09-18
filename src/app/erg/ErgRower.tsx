"use client";

import { useEffect, useRef, useState } from "react";
import { fmtClock, fmtElapsedHundredths, fmtMeters } from "@/lib/pm5/pm5";
import {
  anomalies,
  fmtBand,
  fmtPace,
  fmtTime,
  milestones,
  predictFinish,
  readTarget,
  targetTolerance,
  type Anomaly,
  type Milestone,
  type Prediction,
  type TargetRead,
} from "@/lib/pm5/predict";
import { Chart, type Series, type XY } from "./charts";
import { GoalControl, TargetControl, goalWord, pieceEnded, pieceStateFor, readFinish } from "./ErgGoal";
import { LINK_WORD, RATE_KEYS, RATE_WORD, setRate, type Erg } from "./hub";
import { PlaybackBar } from "./PlaybackBar";

/* THE ROWER VIEW (owner, 2026-09-17: "I do not see the rower view that I can
 * look at while I am rowing" — and, before that, in his own words:
 *
 *   "The phone is propped up in front of you on the erg. I want to see my
 *    predicted finish and my current meters. I want to be notified at every
 *    500 m milestone. I only want ONE graph at a time, and what it shows
 *    should depend on where I am in the piece."
 *
 *   "I want to know my expected finish time. But importantly it needs to be
 *    PREDICTED... at the beginning the predicted finish might be 20 minutes
 *    plus or minus one minute, and as it goes on the deviation should be a
 *    lot smaller. I want to see splits every five hundred and what my split
 *    time was, how much it was up or down from the last one, and what my
 *    expected finish time is. I want to be given a RECOMMENDED PACE if I go
 *    out of bounds."
 *
 * ONE COLUMN, read from about seventy centimetres by somebody at a hundred
 * and seventy five. Distance and the predicted finish are the two things the
 * PM5 forty centimetres away does NOT say in these words, so they are the
 * two things at the top, and everything else earns its place under them.
 *
 * NOTHING MOVES except the five hundred metre card, and that card takes the
 * chart box rather than pushing anything down — so the two numbers he is
 * looking at are never shoved under his eye mid-stroke.
 *
 * IT OWNS NO TELEMETRY AND NO CONNECTION, exactly like the console: every
 * number is read off the Erg record the hub keeps, and switching between
 * this and the console is a view swap on one page, not a route, so nothing
 * that holds a Bluetooth link ever remounts.
 *
 * WHERE THE NUMBERS COME FROM. predict.ts had four exports with no callers
 * at all — readTarget, milestones, anomalies, targetTolerance — and this
 * screen is the first thing to run any of them. The library was written for
 * exactly this and nothing here duplicates its maths.
 *
 * THE CHART IS INERT. On the console a chart opens full screen when you
 * click it; here a sweaty thumb brushing it must never drop a dialog over
 * the finish time of the piece you are in the middle of. Chart takes `still`
 * for that. */

export const ROWER_WINDOW_S = 90;
export const ROWER_POINTS = 180;
export const ROWER_SPLITS_SHOWN = 4;
/* Before this, a pace is the flywheel spinning up, and nothing built on it —
 * not a chart, not a scale — is worth drawing. */
export const ROWER_SETTLE_S = 30;
export const FLASH_MS = 12_000;
/* Below half a second a delta is not a delta: it is the smallest difference
 * predict.ts will treat as one anywhere (SIGMA_FLOOR_S). */
export const DELTA_FLOOR_S = 0.5;
/* The anomaly gates, on top of the library's own. */
export const FLAG_MIN_STROKES = 30;
export const FLAG_AFTER_S = 60;
export const FLAG_STROKE_WINDOW = 120;

export type RowerView = "rower" | "coach";

type Phase = "settle" | "pace" | "runin" | "done";

type BandAxis = { key: string; lo: number; hi: number };

/* The two doors between the two views. It is rendered on both screens, so a
 * rower who cannot find one can always find the other. */
export function ViewChips({ view, onView }: { view: RowerView; onView: (v: RowerView) => void }) {
  return (
    <span className="eg-rw-views">
      <button type="button" className={view === "rower" ? "eg-chip on" : "eg-chip"} aria-pressed={view === "rower"} onClick={() => onView("rower")}>
        Rower
      </button>
      <button type="button" className={view === "coach" ? "eg-chip on" : "eg-chip"} aria-pressed={view === "coach"} onClick={() => onView("coach")}>
        Coach
      </button>
    </span>
  );
}

/* THE BAND, DRAWN CLOSING (owner: "at the beginning the predicted finish
 * might be 20 minutes plus or minus one minute, and as it goes on the
 * deviation should be a lot smaller").
 *
 * THE AXIS IS ANCHORED ONCE. Drawing lowS and highS on a scale recomputed
 * every frame from lowS to highS would fill the strip for the whole piece
 * and the band would NEVER APPEAR TO CLOSE — the exact opposite of what the
 * arithmetic is doing. So the scale is fixed the first time there is a
 * prediction and kept, and the slab shrinks inside it.
 *
 * Whether the target rule falls inside the slab is the whole reading, and it
 * needs no words at all. */
function BandStrip({ pred, goalS, axis }: { pred: Prediction; goalS: number | null; axis: BandAxis }) {
  const W = 360;
  const H = 58;
  const L = 8;
  const R = 8;
  const pw = W - L - R;
  const x = (v: number) => Math.max(L, Math.min(W - R, L + ((v - axis.lo) / (axis.hi - axis.lo)) * pw));

  if (pred.finishS === null || pred.lowS === null || pred.highS === null) return null;
  const a = x(pred.lowS);
  const b = x(pred.highS);

  return (
    <div className="eg-rw-band">
      <svg className="eg-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Expected finish ${fmtTime(pred.finishS)}, plus or minus ${fmtBand(pred.bandS ?? 0)}`}>
        <line className="rwbase" x1={L} x2={W - R} y1={38} y2={38} />
        {/* Hollow and dotted until two blocks have landed: until then the
          * width is a prior and was never measured on this rower. */}
        <rect className={pred.sigmaFromPrior ? "rwseg-prior" : "rwseg"} x={Math.min(a, b)} y={18} width={Math.max(2, Math.abs(b - a))} height={16} />
        <line className="rwtick" x1={x(pred.finishS)} x2={x(pred.finishS)} y1={14} y2={38} />
        {goalS === null ? null : (
          <g>
            <line className="rwtgt" x1={x(goalS)} x2={x(goalS)} y1={10} y2={42} />
            <text className="rwlbl" x={x(goalS)} y={8} textAnchor="middle">
              TARGET {fmtTime(goalS)}
            </text>
          </g>
        )}
        {pred.sigmaFromPrior ? (
          <text className="rwlbl" x={W - R} y={8} textAnchor="end">
            PRIOR
          </text>
        ) : null}
        <text className="rwend" x={L} y={52} textAnchor="start">
          {fmtTime(axis.lo)}
        </text>
        <text className="rwend" x={W - R} y={52} textAnchor="end">
          {fmtTime(axis.hi)}
        </text>
      </svg>
    </div>
  );
}

/* What a split did against the one before it, as a WORD. An arrow beside a
 * TIME is ambiguous about which direction is the good one. */
function deltaWord(d: number | null): string {
  if (d === null) return "FIRST SPLIT";
  if (Math.abs(d) < DELTA_FLOOR_S) return "EVEN";
  return d < 0 ? "FASTER" : "SLOWER";
}

function deltaNumber(d: number | null): string {
  if (d === null || Math.abs(d) < DELTA_FLOOR_S) return "";
  return `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)} S`;
}

export function ErgRower({ erg, onBack, view, onView }: { erg: Erg; onBack: () => void; view: RowerView; onView: (v: RowerView) => void }) {
  const [setup, setSetup] = useState(false);
  const [allSplits, setAllSplits] = useState(false);
  const [flash, setFlash] = useState<Milestone | null>(null);

  /* The highest milestone announced, the anchored band scale, and two caches
   * that are load-bearing for CORRECTNESS and not only for cost — see the
   * flash effect. Every key is a string of scalars: the hub mutates its
   * arrays in place and blocksFor allocates a fresh one on every miss, so an
   * identity key is either a permanent hit that never updates or a permanent
   * miss. */
  const seen = useRef<number | null>(null);
  const axis = useRef<BandAxis | null>(null);
  const stones = useRef<{ key: string; list: Milestone[] } | null>(null);
  const flags = useRef<{ key: string; list: Anomaly[] } | null>(null);

  const m = erg.model;
  const g = m.general;
  const a1 = m.a1;
  const playback = erg.source === "playback";
  const ended = pieceEnded(erg);

  const piece = pieceStateFor(erg);
  const pred = predictFinish(piece);
  const fin = readFinish(pred);
  const read: TargetRead | null = ended || erg.goalS === null ? null : readTarget(piece, { finishS: erg.goalS }, pred);

  /* ---- the milestones, cached on exactly what the function reads ---- */

  const msKey = `${piece.blocks.length}|${piece.blockM}|${piece.targetMeters ?? 0}`;
  if (stones.current === null || stones.current.key !== msKey) stones.current = { key: msKey, list: milestones(piece) };
  const ms = stones.current.list;
  const last: Milestone | null = ms.length ? ms[ms.length - 1] : null;
  const lastN = last === null ? 0 : last.n;

  /* ---- THE FIVE HUNDRED ---- */

  useEffect(() => {
    /* FIRST RUN: adopt whatever the piece already had. Opening the screen
     * half way through a row is not an event, however many blocks are in —
     * and a NULL watermark is what tells never-run apart from a watermark
     * that happens to be zero (review, 2026-09-17: walking in on a row with
     * exactly ONE finished split announced it as if it had just landed,
     * because zero was doing both jobs). */
    if (seen.current === null) {
      seen.current = lastN;
      return;
    }
    /* A PLAYBACK SEEK REWINDS THE PIECE and blocks vanish with it, so the
     * watermark has to come back down or a seek back and forward would
     * announce a split that was already announced. */
    if (lastN < seen.current) {
      seen.current = lastN;
      setFlash(null);
      return;
    }
    if (lastN === seen.current) return;
    seen.current = lastN;
    if (last === null) return;
    setFlash(last);
    try {
      navigator.vibrate?.(120);
    } catch {
      /* Not Android, or blocked. The card is the notification either way. */
    }
    const t = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(t);
    /* The dep is a NUMBER. An array identity would either never fire or fire
     * twelve times a second, and firing every frame would re-arm the twelve
     * second timeout every frame so the card would never clear. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastN, ms.length]);

  /* ---- the screen stays awake ---- */

  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    let dead = false;
    let taking = false;
    const take = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (!wl || dead || taking) return;
        taking = true;
        const got = await wl.request("screen");
        taking = false;
        /* THE GUARD THAT MATTERS IS ON THE FAR SIDE OF THE AWAIT (review,
         * 2026-09-17): the cleanup can run while the request is still in
         * flight, find null, release nothing, and then this assignment hands
         * a live lock to a screen that is already gone. */
        if (dead) {
          void got.release().catch(() => {});
          return;
        }
        sentinel = got;
      } catch {
        /* Denied, hidden, or not Chrome. A propped phone that blanks is a
         * worse screen but not a broken one. */
      }
    };
    void take();
    const vis = () => {
      if (document.visibilityState === "visible") void take();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      dead = true;
      document.removeEventListener("visibilitychange", vis);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  /* ---- the band scale, anchored once ---- */

  const axisKey = `${erg.id}|${erg.goalM}|${erg.goalS ?? 0}`;
  /* THE SCALE IS TAKEN ONCE THE PACE HAS SETTLED, not on the first metre
   * (review, 2026-09-17: predictFinish is ready as soon as one packet has
   * moved the flywheel, and a finish extrapolated from two metres is an hour
   * out — so with no target the whole rest of the piece fell off the end of
   * the strip, clamped against an edge, and the band was never SEEN to
   * close, which is the one thing the strip exists to show).
   *
   * IT IS RE-TAKEN IF THE ROW WALKS OFF IT, because a scale nothing fits on
   * is worse than a scale that moved once. HALF NEVER SHRINKS on a re-anchor:
   * the slab has to be seen closing inside a fixed frame, and a frame that
   * closed with it would show nothing at all. */
  if (!ended && pred.ready && piece.elapsedS >= ROWER_SETTLE_S && pred.finishS !== null && pred.bandS !== null) {
    const a = axis.current;
    const off = a === null || a.key !== axisKey || pred.finishS < a.lo || pred.finishS > a.hi;
    if (off) {
      const centre = erg.goalS ?? pred.finishS;
      const want = Math.min(600, Math.max(20, pred.bandS));
      const held = a !== null && a.key === axisKey ? (a.hi - a.lo) / 2 : 0;
      const half = Math.max(want, held, Math.abs(pred.finishS - centre) * 1.2);
      axis.current = { key: axisKey, lo: centre - half, hi: centre + half };
    }
  }

  /* ---- something out of the normal ---- */

  const canFlag = m.strokes.length >= FLAG_MIN_STROKES && piece.elapsedS > FLAG_AFTER_S && pred.blocksLeft > 1 && !ended;
  const flagKey = `${erg.id}|${m.strokes.length}`;
  if (canFlag && (flags.current === null || flags.current.key !== flagKey)) {
    flags.current = { key: flagKey, list: anomalies(m.strokes.slice(-FLAG_STROKE_WINDOW)) };
  }
  const flag: Anomaly | null = canFlag
    ? ((flags.current?.list ?? []).filter((a) => a.byS >= 1).sort((x, y) => Math.abs(y.z) - Math.abs(x.z))[0] ?? null)
    : null;

  /* ---- where in the piece, and therefore which one chart ---- */

  /* WHICH ONE GRAPH, and it is a pure function of the prediction — distance
   * only goes up within a piece, so no hysteresis is needed and none is
   * added.
   *
   * SETTLE IS THIRTY SECONDS AND NOT FIVE HUNDRED METRES (review,
   * 2026-09-17: gating it on a finished block meant two minutes of no chart
   * at all on the screen whose whole point is one chart). Thirty seconds is
   * how long it takes a pace line to stop being the flywheel spinning up.
   * That the BAND is still a prior until two blocks land is a separate fact
   * and the strip already says so, in the word PRIOR. */
  const phase: Phase = ended ? "done" : !pred.ready || piece.elapsedS < ROWER_SETTLE_S ? "settle" : pred.blocksLeft <= 1 ? "runin" : "pace";

  const distance = g ? g.distanceM : 0;
  const toGo = Math.max(0, (piece.targetMeters ?? 0) - distance);
  const progress = piece.targetMeters ? Math.min(100, (distance / piece.targetMeters) * 100) : 0;
  const nowPace = a1 && a1.currentPaceS > 0 ? a1.currentPaceS : null;
  /* A REQUIREMENT ONLY WHEN THERE IS ONE (review, 2026-09-17: a ?? here
   * swallowed the library's deliberate null and printed the PREDICTED pace
   * under the word NEED — so a screen that had just said the target has gone
   * went on to instruct a pace that does not make it). readTarget nulls
   * needPace500S on purpose in exactly two states: the goal is already
   * rowed, and the target time has passed with metres still to row. Neither
   * has a pace that makes it, and a prediction is not a substitute.
   *
   * HOLD is the separate thing: the line the chart rules when there is no
   * target at all. It is labelled by what the rower is doing, never by what
   * anything requires. */
  const needPace = read === null ? null : read.needPace500S;
  const holdPace = needPace ?? (erg.goalS === null && !ended ? pred.predictedPace500S : null);

  /* THE ONE GRAPH: the last ninety seconds of pace, with the pace that makes
   * the target ruled across it. It is the only thing on this screen he can
   * act on within the next ten strokes; the splits are a list four inches
   * below and a chart of the same numbers would be a duplicate. */
  const tEnd = m.samples.length ? m.samples[m.samples.length - 1].t : 0;
  const win = m.samples.filter((s) => s.t >= tEnd - ROWER_WINDOW_S && s.t > 0 && s.pace > 0);
  const paceSeries: Series[] = [{ kind: "line", label: "PACE", points: thin(win.map((s) => ({ x: s.t, y: s.pace })), ROWER_POINTS) }];

  /* THE FINISHED PIECE gets the shape of the whole thing instead. A LINE and
   * never bars: computePlot drags a bar chart's floor to zero, and under an
   * inverted axis that hangs the bars off the top edge. */
  const donePaces = ms.map((x) => x.pace500S).filter((v) => Number.isFinite(v) && v > 0);
  const doneSeries: Series[] = [{ kind: "line", label: "SPLIT", points: ms.map((x) => ({ x: x.meters, y: x.pace500S })).filter((p) => Number.isFinite(p.y) && p.y > 0) }];

  const finText = ended ? (g ? fmtElapsedHundredths(g.elapsedHundredths) : "—") : fin.value;

  const shown = allSplits || ended ? [...ms].reverse() : [...ms].reverse().slice(0, ROWER_SPLITS_SHOWN);

  /* ---- the one line of coaching ---- */

  const cue = (() => {
    if (ended && piece.targetMeters !== null && distance >= piece.targetMeters && erg.goalS !== null) {
      const margin = erg.goalS - piece.elapsedS;
      return {
        cls: "",
        line: margin >= 0 ? `Made it by ${fmtBand(margin)}` : `Missed it by ${fmtBand(-margin)}`,
        sub: a1 && a1.averagePaceS > 0 ? `FINAL · ${fmtPace(a1.averagePaceS)} AVERAGE SPLIT` : "FINAL",
        tap: false,
      };
    }
    if (ended) return { cls: "", line: "Final", sub: `STOPPED AT ${fmtMeters(distance)}`, tap: false };
    if (erg.goalS === null) {
      return {
        cls: "none",
        line: nowPace ? `No target — holding ${fmtPace(nowPace)}` : "No target set",
        sub: "TAP TO SET ONE",
        tap: true,
      };
    }
    /* A TARGET IS SET, but the piece has not given the library enough to read
     * it against yet (review, 2026-09-17: this told a rower who had just set
     * a target that there was none, and offered to set one). */
    if (read === null) {
      return {
        cls: "",
        line: `Target ${fmtTime(erg.goalS)}`,
        sub: nowPace ? `WAITING FOR THE FIRST METRES · HOLDING ${fmtPace(nowPace)}` : "WAITING FOR THE FIRST METRES",
        tap: false,
      };
    }
    const sub =
      read.state === "on" || read.vsCurrentS === null || Math.abs(read.vsCurrentS) < DELTA_FLOOR_S
        ? ""
        : `THAT IS ${Math.abs(read.vsCurrentS).toFixed(1)} S ${read.vsCurrentS < 0 ? "FASTER" : "EASIER"} THAN YOU ARE PROJECTED TO HOLD`;
    return { cls: read.state, line: read.line, sub, tap: false };
  })();

  return (
    <div className={erg.link === "dropped" ? "eg-rw eg-rw-stale" : "eg-rw"}>
      <div className="eg-rw-bar">
        <button type="button" className="eg-btn eg-btn-quiet" onClick={onBack}>
          Monitors
        </button>
        <span className="eg-rw-name">{`${LINK_WORD[erg.link]} · ${erg.save.title?.trim() || erg.name}`}</span>
        <ViewChips view={view} onView={onView} />
      </div>

      {/* A frozen number that looks live is the one lie this screen must never
        * tell, so the warning takes a row of its own rather than being
        * squeezed into the bar and ellipsised to two words (review,
        * 2026-09-17). */}
      {erg.link === "dropped" ? <p className="eg-rw-drop">Link dropped — the monitor may still be rowing, this screen is not</p> : null}

      {playback ? <PlaybackBar erg={erg} /> : null}

      <div className="eg-rw-now">
        <span className="eg-rw-k">Distance</span>
        <span className={distance >= 100000 ? "eg-rw-v long" : "eg-rw-v"}>
          {Math.floor(distance).toLocaleString("en-US")}
          <span className="eg-rw-u">m</span>
        </span>
        <span className="eg-rw-prog" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
        <span className="eg-rw-s">
          <span>OF {goalWord(erg.goalM)}</span>
          <span>{toGo > 0 ? `${Math.round(toGo).toLocaleString("en-US")} TO GO` : "ROWED"}</span>
        </span>

        <span className="eg-rw-k">{ended ? "Final" : "Expected finish"}</span>
        {/* Sized and hinted from the string it actually prints: a measured
          * FINAL is not a prediction and must not carry the prediction's
          * disclaimer (review, 2026-09-17). */}
        <span className={finText.length >= 9 ? "eg-rw-fin long" : "eg-rw-fin"} title={ended ? undefined : (fin.hint ?? undefined)}>
          {finText}
        </span>
        <span className="eg-rw-s">
          <span>{ended ? (a1 && a1.averagePaceS > 0 ? `${fmtPace(a1.averagePaceS)} AVERAGE SPLIT` : "THE PIECE HAS ENDED") : fin.under}</span>
          {erg.goalS === null || ended ? null : <span>TARGET {fmtTime(erg.goalS)}</span>}
        </span>
      </div>

      {ended || !pred.ready || pred.remainingS === 0 || axis.current === null ? null : <BandStrip pred={pred} goalS={erg.goalS} axis={axis.current} />}

      {cue.tap ? (
        <button type="button" className="eg-rw-cue none" onClick={() => setSetup(true)}>
          {cue.line}
          <span className="eg-rw-cuek">{cue.sub}</span>
        </button>
      ) : (
        <p className={`eg-rw-cue ${cue.cls}`}>
          {cue.line}
          <span className="eg-rw-cuek">{cue.sub}</span>
        </p>
      )}

      {/* ONE SLOT, four things that can be in it, all the same height — so
        * the two numbers above never move while he is looking at them. */}
      {flash ? (
        <div className="eg-rw-flash" role="button" tabIndex={0} aria-live="polite" onClick={() => setFlash(null)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFlash(null)}>
          <span className="m">✓ {fmtMeters(flash.meters)}</span>
          <span className="sp">{fmtPace(flash.pace500S)}</span>
          <span className="two">
            <span>
              <b>{deltaNumber(flash.deltaS) || deltaWord(flash.deltaS)}</b>
              <span>{deltaNumber(flash.deltaS) ? deltaWord(flash.deltaS) : "AGAINST THE LAST"}</span>
            </span>
            <span>
              <b>{flash.finishAtS === null ? "—" : `~${fmtTime(flash.finishAtS)}`}</b>
              <span>{flash.bandAtS === null ? "FINISH AT THIS SPLIT" : `± ${fmtBand(flash.bandAtS)} AT THIS SPLIT`}</span>
            </span>
          </span>
        </div>
      ) : phase === "settle" ? (
        <div className="eg-rw-settle">
          <span className="m">{nowPace ? fmtPace(nowPace) : "—"}</span>
          <span className="k">SETTLING — THE FIRST FIVE HUNDRED SETS THE BAND</span>
          {needPace && erg.goalS !== null ? <span className="k">NEED {fmtPace(needPace)} FOR {fmtTime(erg.goalS)}</span> : null}
        </div>
      ) : phase === "runin" ? (
        <div className="eg-rw-last">
          <span className="m">{Math.round(toGo).toLocaleString("en-US")} m</span>
          <span className="k">
            {erg.goalS !== null && needPace ? `NEED ${fmtPace(needPace)} TO MAKE ${fmtTime(erg.goalS)}` : `FINISH ${fin.value} ${fin.under}`}
          </span>
        </div>
      ) : phase === "done" ? (
        <div className="eg-rw-chart">
          <Chart
            still
            stat
            padL={62}
            title="Split by split"
            unit="/500 M"
            series={doneSeries}
            xLabel="METRES"
            yLabel="FASTER UP"
            xFmt={(x) => Math.round(x).toLocaleString("en-US")}
            yFmt={(y) => fmtPace(y)}
            invertY
            yMin={donePaces.length ? Math.min(...donePaces) - 4 : undefined}
            yMax={donePaces.length ? Math.max(...donePaces) + 4 : undefined}
            empty="NO SPLITS ON THIS PIECE"
          />
        </div>
      ) : (
        <div className="eg-rw-chart">
          <Chart
            still
            padL={62}
            title="Pace"
            unit={`LAST ${ROWER_WINDOW_S} S`}
            series={paceSeries}
            xLabel="ELAPSED S"
            yLabel="FASTER UP"
            xFmt={(x) => fmtClock(x)}
            yFmt={(y) => fmtPace(y)}
            invertY
            refY={holdPace ?? undefined}
            refLabel={holdPace ? fmtPace(holdPace) : undefined}
          />
        </div>
      )}

      {/* THE LADDER (owner: "I want to see splits every five hundred and what
        * my split time was, how much it was up or down from the last one,
        * and what my expected finish time is"). The finish on each row is
        * what it looked like WHEN THAT SPLIT LANDED, not now — which is the
        * whole reason milestones re-predicts per block. */}
      {shown.length ? (
        <div className="eg-rw-splits">
          {shown.map((x) => (
            <div className="eg-rw-row" key={x.n}>
              <span className="t">✓</span>
              <span className="m">{fmtMeters(x.meters)}</span>
              <span className="v">{fmtPace(x.pace500S)}</span>
              <span className="d">{deltaNumber(x.deltaS) || deltaWord(x.deltaS)}</span>
              <span className="f">{x.finishAtS === null ? "" : `~${fmtTime(x.finishAtS)}`}</span>
            </div>
          ))}
          {!ended && ms.length > ROWER_SPLITS_SHOWN ? (
            <button type="button" className="eg-btn eg-btn-quiet" onClick={() => setAllSplits((v) => !v)}>
              {allSplits ? "Show the last four" : `Show all ${ms.length}`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* The quietest slot on the screen. It never takes the cue box, never
        * flashes and never buzzes: the owner said himself this is hard
        * without data, so it is a remark and not an alarm. */}
      <p className="eg-rw-note">{flag ? flag.line : ""}</p>

      <button type="button" className="eg-btn eg-btn-quiet eg-rw-setupbtn" aria-expanded={setup} onClick={() => setSetup((v) => !v)}>
        {setup ? "Close setup" : "Setup"}
      </button>

      {setup ? (
        <div className="eg-rw-setup">
          <GoalControl ergId={erg.id} goalM={erg.goalM} scope="rower" />
          <TargetControl ergId={erg.id} goalS={erg.goalS} goalM={erg.goalM} scope="rower" />
          <span className="eg-chips">
            <span className="eg-tgt-k">Status every</span>
            {RATE_KEYS.map((k) => (
              <button key={k} type="button" className={erg.rate === k ? "eg-chip on" : "eg-chip"} aria-pressed={erg.rate === k} onClick={() => setRate(erg.id, k)}>
                {RATE_WORD[k]}
              </button>
            ))}
          </span>
          {/* The quiet is visible rather than mysterious: this is why almost
            * everything reads ON in the first five hundred. */}
          <span className="eg-rw-foot">ANYTHING INSIDE ± {fmtBand(targetTolerance(pred))} IS CALLED ON · IT CLOSES AS THE PIECE DOES</span>
        </div>
      ) : null}

      <p className="eg-rw-foot">
        The expected finish is a prediction, not a measurement, and the ± under it is how far out it could be. It starts wide and closes as the piece does. Every other
        number here is measured. Switch to COACH for every chart, the splits table and the raw feed.
      </p>
    </div>
  );
}

/* The same thinning the charts use, kept local so this file does not reach
 * into chart internals for one array. */
function thin(points: XY[], cap: number): XY[] {
  if (points.length <= cap) return points;
  const k = Math.ceil(points.length / cap);
  const out: XY[] = [];
  for (let i = points.length - 1; i >= 0; i -= k) out.push(points[i]);
  return out.reverse();
}
