"use client";

import { useEffect, useState } from "react";
import { isEnded } from "@/lib/pm5/pm5";
import { fmtBand, fmtPace as fmtPaceS, fmtTime, predictFinish, type Block, type PieceState, type Prediction } from "@/lib/pm5/predict";
import { DEFAULT_GOAL_M, GOAL_MAX_M, GOAL_MIN_M, setErgGoal, setErgGoalTime, type Erg, type ErgSample } from "./hub";

/* THE GOAL, AND WHAT IT PREDICTS (owner, 2026-09-17: "infer the goal
 * distance to be a five K always. But allow us to change it" — and, on the
 * monitors screen, "expected five K finish time").
 *
 * One place for the three things every erg surface needs from the goal: the
 * control that changes it, the blocks the prediction is built from, and the
 * finish itself as two printable strings. The monitors row and the console
 * head both call these, so the two screens can never disagree about what
 * the five thousand is or what it is going to take.
 *
 * THE GOAL IS NOT THE WORKOUT. The monitor can be set to a just row, a
 * 6,000 or a timed twenty; the goal is the rower's question, and where the
 * two differ goalMismatch says so in one line rather than either one
 * quietly winning.
 *
 * The maths is src/lib/pm5/predict.ts and nothing here duplicates it. */

/* The three the owner actually rows, and then the box for everything
 * else. */
export const GOAL_CHOICES = [2000, 5000, 10000];

/* The block the prediction counts in when we are cutting them ourselves.
 * The monitor's own split may be any length, and when it is, THAT length is
 * the unit — see blocksFor (review, 2026-09-17: handing predict.ts a hard
 * 500 while feeding it 1,000 m splits counted the blocks in one unit and
 * measured their spread in another, and the printed band came out about a
 * third narrower than it should have been). */
export const BLOCK_M = 500;

/* Never more blocks than a very long row could honestly hold — a guard on
 * the walk below, not a limit anybody meets. */
const MAX_BLOCKS = 400;

/* "5,000 M" — the goal as a label says it. */
export function goalWord(meters: number): string {
  return `${Math.round(meters).toLocaleString("en-US")} M`;
}

/* THE BLOCKS. The monitor's own splits when it has sent any — they are its
 * figures, and they are exact. Otherwise cut them out of the tick stream
 * every 500 m, interpolating the crossing between the two samples either
 * side of it, so a piece with no split yet still has something to measure
 * variation with. */
export function derivedBlocks(samples: ErgSample[], blockM = BLOCK_M): Block[] {
  const out: Block[] = [];
  if (!(blockM > 0)) return out;

  /* THE WALK STARTS WHERE THE SAMPLES DO, not at zero (review, 2026-09-17:
   * the hub trims the head of a long piece in place, and seeding the first
   * mark at 500 with prevT at 0 then folded every trimmed metre into one
   * bogus opening block — a "500 m split" of twenty minutes that went
   * straight into the spread, the band and the ladder).
   *
   * A piece that still has its first sample starts at metre zero and nothing
   * changes. One that does not starts at the first WHOLE block boundary at
   * or after where the record now begins, and the partial block before it is
   * simply not there to be counted. Blocks are numbered by where they are in
   * the piece rather than by how many have been emitted, so a trimmed row
   * still says which five hundred each one was. */
  const first = samples.find((s) => Number.isFinite(s.t) && Number.isFinite(s.dist));
  if (!first) return out;

  /* A record that starts on a block boundary — including a whole piece,
   * which starts at metre zero — can measure the block that follows it. One
   * that starts in the middle of a block cannot: the metres before it were
   * never recorded. So the first crossing there only SEEDS the clock and is
   * thrown away, and the walk emits from the one after it. */
  const onBoundary = Math.abs(first.dist / blockM - Math.round(first.dist / blockM)) < 1e-9;
  let mark = onBoundary ? first.dist + blockM : Math.ceil(first.dist / blockM) * blockM;
  let skip = first.dist > 0 && !onBoundary;
  let n = Math.round(mark / blockM);
  let prevT = first.t;
  let prev: ErgSample | null = null;

  for (const s of samples) {
    if (!Number.isFinite(s.t) || !Number.isFinite(s.dist)) continue;
    while (s.dist >= mark && out.length < MAX_BLOCKS) {
      const t = prev && s.dist > prev.dist ? prev.t + ((mark - prev.dist) * (s.t - prev.t)) / (s.dist - prev.dist) : s.t;
      const seconds = t - prevT;
      if (skip) skip = false;
      else if (seconds > 0) out.push({ n, meters: blockM, seconds });
      prevT = t;
      mark += blockM;
      n++;
    }
    prev = s;
  }
  return out;
}

/* THE BLOCKS AND THE UNIT THEY ARE COUNTED IN. The two travel together
 * (review, 2026-09-17): predict.ts counts how many blocks are done and how
 * many are left in `blockM`, and measures their spread in the same unit, so
 * handing it blocks of one length and a unit of another makes the band
 * dishonest. A monitor cutting 1,000 m splits gets blockM 1,000; the
 * derived path cuts its own and is always BLOCK_M. */
export type BlockSet = { blocks: Block[]; blockM: number };

/* ALWAYS FIVE HUNDRED (owner, 2026-09-21: "split should be in 500 metres,
 * not kilometres"). The monitor cuts a 5,000 at whatever split it was set
 * to — a thousand, by default — and this used to take those when it had
 * them. It cuts its own five hundreds out of the tick stream now, every
 * time, so the band, the milestones and the console's own splits table all
 * count in the unit he reads. The monitor's splits are still shown as the
 * monitor's, in their own table. */
function computeBlocks(e: Erg): BlockSet {
  return { blocks: derivedBlocks(e.model.samples), blockM: BLOCK_M };
}

/* THE ONE CACHE THAT PAYS FOR THE ROWING SCREEN (review, 2026-09-17).
 * derivedBlocks walks every sample a piece has — twelve thousand on a long
 * row — and blocksFor is called once per monitors row per paint AND again in
 * the console, twelve times a second. It was already the most expensive
 * thing on the list before anything new was added to it.
 *
 * THE KEY IS TWO LENGTHS AND NOTHING ELSE. The hub mutates its arrays IN
 * PLACE, so an identity key would be a permanent hit that never updates and
 * the prediction would freeze at the first block forever. Lengths are the
 * only honest signal that something arrived — and they go DOWN on a CLEAR or
 * a playback seek, which invalidates in that direction too. The goal is not
 * in the key because blocks do not depend on it; predictFinish is uncached
 * and reads it every time, so changing the goal still moves the number
 * within one paint. */
const blockCache = new Map<string, { key: string; set: BlockSet }>();

export function blocksFor(e: Erg): BlockSet {
  /* THE LAST SAMPLE'S CLOCK IS IN THE KEY, and it has to be (review,
   * 2026-09-17): the hub caps the sample array and then trims its HEAD in
   * place, so once a long piece hits the cap the LENGTH stops changing and a
   * lengths-only key becomes a permanent hit. The splits, the band and the
   * five hundred metre cards would all have frozen for the rest of the row.
   * Elapsed never repeats within a piece and goes back to zero when a new
   * one starts, so it invalidates in both directions. */
  const ss = e.model.samples;
  const key = `${e.model.splits.length}|${ss.length}|${ss.length ? ss[ss.length - 1].t : 0}`;
  const hit = blockCache.get(e.id);
  if (hit && hit.key === key) return hit.set;
  /* No hub hook to evict on: a handful of slots is all a tab ever holds, and
   * dropping the lot costs one walk each. */
  if (blockCache.size > 16) blockCache.clear();
  const set = computeBlocks(e);
  blockCache.set(e.id, { key, set });
  return set;
}

/* Where this erg finishes the goal, and how sure. Safe on an empty slot:
 * predictFinish is handed zeroes and answers with a reason rather than a
 * number. */
export function pieceStateFor(e: Erg): PieceState {
  const g = e.model.general;
  const a1 = e.model.a1;
  const { blocks, blockM } = blocksFor(e);
  return {
    targetMeters: e.goalM > 0 ? e.goalM : DEFAULT_GOAL_M,
    distanceM: g ? g.distanceM : 0,
    elapsedS: g ? g.elapsedHundredths / 100 : 0,
    blocks,
    blockM,
    currentPaceS: a1 && a1.currentPaceS > 0 ? a1.currentPaceS : null,
  };
}

export function predictForErg(e: Erg): Prediction {
  return predictFinish(pieceStateFor(e));
}

/* The monitor has stopped: WORKOUT END, TERMINATE or WORKOUT LOGGED. A piece
 * in one of those states is not advancing, so nothing may keep predicting
 * its finish. It lived in MonitorList and three screens need it now. */
/* WHAT THE OWNER CALLED THIS ERG, or null while it is still the name the
 * monitor advertises. Three PM5s in a gym all advertise PM5 4xxxxxxxx, so
 * every screen heads a lane with the typed name when there is one. The same
 * field is the title the piece is saved under: naming a lane and titling
 * its piece are one gesture. */
export function typedErgName(e: Erg): string | null {
  const t = e.save.title === null ? "" : e.save.title.trim();
  if (t) return t;
  return e.rower ? e.rower.name : null;
}

export function pieceEnded(e: Erg): boolean {
  const g = e.model.general;
  return g ? isEnded(g.workoutState) : false;
}

export type FinishRead = { value: string; under: string; ready: boolean; hint: string | null };

/* The two lines a screen prints: the finish, and the band under it.
 *
 * THE VALUE CARRIES ITS OWN TILDE (review, 2026-09-17: painted in the same
 * face and the same size as the three MEASURED numbers beside it, a
 * prediction read as a promise, and everything that made it a prediction
 * lived in a 9px line that was being clipped). A twiddle in front of the
 * clock says it is approximate before anything under it is read.
 *
 * THE BAND IS THE WHOLE OF THE SECOND LINE — just the plus-or-minus, short
 * enough to fit the column on a row. Where that band came from is the hint:
 * the long sentence, on the element rather than on the screen. Before there
 * is anything to predict the second line carries the reason instead,
 * because a dash on its own tells the rower nothing. */
/* THE SAME TWO STRINGS FROM A PREDICTION ALREADY IN HAND. The rower view
 * builds one PieceState, predicts once, and reads it with this — so it
 * prints the identical words the monitors row and the console do without a
 * second walk over every sample. The invariant that three screens cannot
 * disagree about the finish is preserved by construction. */
export function readFinish(p: Prediction): FinishRead {
  if (p.ready && p.finishS !== null) {
    if (p.remainingS === 0) return { value: fmtTime(p.finishS), under: "THE GOAL IS ROWED", ready: true, hint: null };
    const band = p.bandS !== null && p.bandS > 0 ? `± ${fmtBand(p.bandS)}` : "EXACT";
    return {
      value: `~${fmtTime(p.finishS)}`,
      under: band,
      ready: true,
      hint: p.sigmaFromPrior
        ? "A prediction, not a measurement. Two finished blocks are needed to measure how much this piece varies, so until then the band comes from a prior."
        : "A prediction, not a measurement. The band is one standard deviation, built from how much the finished blocks varied and how many are left.",
    };
  }
  return { value: "—", under: (p.note ?? "Waiting for the first metres.").toUpperCase(), ready: false, hint: null };
}

export function expectedFinish(e: Erg): FinishRead {
  return readFinish(predictForErg(e));
}

/* One quiet line when the monitor is set to a fixed distance that is not
 * the goal (owner, 2026-09-17: say so rather than overriding either — the
 * rower may be rowing a 6 k and still want the 5 k read). Null when the
 * monitor is on a just row, a timed piece, or the same distance. */
export function goalMismatch(e: Erg): string | null {
  const g = e.model.general;
  if (!g || !(g.totalWorkDistanceM > 0)) return null;
  const workout = Math.round(g.totalWorkDistanceM);
  if (workout === Math.round(e.goalM)) return null;
  return `MONITOR IS SET TO ${goalWord(workout)} · READING THE ${goalWord(e.goalM)}`;
}

/* THE CONTROL. Three chips for the distances he rows and a box for
 * anything between a hundred metres and a hundred thousand. The box commits
 * on ENTER and on leaving it; a number outside the range snaps back to what
 * the slot already holds rather than silently clamping to something nobody
 * typed.
 *
 * SCOPE is there because a monitors row carries this control twice — once
 * on the row for a wide screen and once inside the dot menu for a phone,
 * where only one of the two is ever displayed — and two labels cannot point
 * at the same id. It is part of the box id, nothing more. */
export function GoalControl({ ergId, goalM, scope = "row" }: { ergId: string; goalM: number; scope?: string }) {
  const [draft, setDraft] = useState(String(goalM));
  const boxId = `goal-${scope}-${ergId}`;

  /* The chips write straight to the hub, so the box has to follow the slot
   * rather than its own last keystroke. */
  useEffect(() => {
    setDraft(String(goalM));
  }, [goalM]);

  const commit = () => {
    const n = Math.round(Number(draft.replace(/[,\s]/g, "")));
    if (!Number.isFinite(n) || n < GOAL_MIN_M || n > GOAL_MAX_M) {
      setDraft(String(goalM));
      return;
    }
    setErgGoal(ergId, n);
  };

  return (
    <div className="eg-goal">
      <span className="eg-goal-k">Goal</span>
      {GOAL_CHOICES.map((m) => (
        <button
          key={m}
          type="button"
          className={Math.round(goalM) === m ? "eg-chip on" : "eg-chip"}
          aria-pressed={Math.round(goalM) === m}
          onClick={() => setErgGoal(ergId, m)}
        >
          {m.toLocaleString("en-US")}
        </button>
      ))}
      {/* The chips say what the box is for on screen; a reader that cannot
       * see them still gets the label. */}
      <label className="eg-away" htmlFor={boxId}>
        Goal distance in metres
      </label>
      <input
        id={boxId}
        className="eg-goal-box"
        type="number"
        inputMode="numeric"
        min={GOAL_MIN_M}
        max={GOAL_MAX_M}
        step={1}
        value={draft}
        placeholder="Metres"
        onChange={(ev) => setDraft(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            commit();
          }
        }}
      />
      <span className="eg-goal-k">m</span>
    </div>
  );
}

/* ---------------------------------------------------------- the target time */

/* THE OTHER HALF OF THE GOAL (owner, 2026-09-17: "if I start this session
 * and I say I want to do a 5K in 20 minutes and I'm rowing at not that pace,
 * I want to be notified, or if I can go a little slower I want to be
 * notified"). The goal above is HOW FAR. This is HOW FAST, and predict.ts
 * reads the two together through readTarget.
 *
 * NULL IS THE DEFAULT AND NULL IS FINE. Every screen is complete without a
 * target — the finish is still predicted, the band still closes — so nobody
 * is ever made to answer a question mid-piece. */

/* MM:SS, H:MM:SS, M:SS.T, or a bare number of MINUTES. Bare is minutes
 * because the box says MM:SS and because twenty SECONDS is under the floor
 * anyway, so the minutes reading is the only one that could ever be meant.
 * Anything else is null, and setErgGoalTime stores null for out of range
 * too — a typo leaves no target rather than one nobody chose. */
export function parseTargetTime(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{1,3}(\.\d+)?$/.test(t)) {
    const mins = Number(t);
    return Number.isFinite(mins) && mins > 0 ? mins * 60 : null;
  }
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2}(?:\.\d)?)$/.exec(t);
  if (!m) return null;
  const h = m[1] === undefined ? 0 : Number(m[1]);
  const mi = Number(m[2]);
  const sec = Number(m[3]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || !Number.isFinite(sec)) return null;
  if (mi > 59 || sec >= 60) return null;
  const total = h * 3600 + mi * 60 + sec;
  return total > 0 ? total : null;
}

/* "20:00" from 1200. The box shows what it would parse back to. */
export function targetWord(seconds: number): string {
  const whole = Math.round(seconds * 10) / 10;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const ss = Number.isInteger(s) ? String(s).padStart(2, "0") : s.toFixed(1).padStart(4, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/* THE CHIPS ARE PACES, NOT CLOCKS. A 5 k at 2:00 is 20:00 and a 10 k at 2:00
 * is 40:00, so three hardcoded times would be wrong the moment the distance
 * changed. These stay right. */
export const TARGET_PACES = [110, 120, 130];

export function TargetControl({ ergId, goalS, goalM, scope = "row" }: { ergId: string; goalS: number | null; goalM: number; scope?: string }) {
  const [draft, setDraft] = useState(goalS === null ? "" : targetWord(goalS));
  const boxId = `target-${scope}-${ergId}`;

  /* The chips write straight to the hub, so the box follows the slot rather
   * than its own last keystroke. */
  useEffect(() => {
    setDraft(goalS === null ? "" : targetWord(goalS));
  }, [goalS]);

  const commit = () => {
    const t = draft.trim();
    if (!t) {
      setErgGoalTime(ergId, null);
      return;
    }
    const secs = parseTargetTime(t);
    if (secs === null) {
      setDraft(goalS === null ? "" : targetWord(goalS));
      return;
    }
    setErgGoalTime(ergId, secs);
  };

  return (
    <div className="eg-tgt">
      <span className="eg-tgt-k">Target</span>
      <label className="eg-away" htmlFor={boxId}>
        Target time for the whole piece
      </label>
      <input
        id={boxId}
        className="eg-tgt-box"
        inputMode="numeric"
        value={draft}
        placeholder="MM:SS"
        onChange={(ev) => setDraft(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            commit();
          }
        }}
      />
      {TARGET_PACES.map((p) => {
        const secs = (goalM / 500) * p;
        const on = goalS !== null && Math.abs(goalS - secs) < 0.6;
        return (
          <button key={p} type="button" className={on ? "eg-chip on" : "eg-chip"} aria-pressed={on} onClick={() => setErgGoalTime(ergId, secs)}>
            {fmtPaceS(p).replace(/\.0$/, "")}
          </button>
        );
      })}
      {goalS === null ? null : (
        <button type="button" className="eg-chip" onClick={() => setErgGoalTime(ergId, null)}>
          Clear
        </button>
      )}
      {/* The two always travel together: a whole-piece time means nothing
        * without the distance it is over, and changing either silently
        * redefines the other. */}
      <span className="eg-tgt-k">{goalS === null ? `NO TARGET · ${goalWord(goalM)}` : `${targetWord(goalS)} OVER ${goalWord(goalM)}`}</span>
    </div>
  );
}
