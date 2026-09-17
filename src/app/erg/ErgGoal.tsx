"use client";

import { useEffect, useState } from "react";
import { fmtBand, fmtTime, predictFinish, type Block, type Prediction } from "@/lib/pm5/predict";
import { DEFAULT_GOAL_M, GOAL_MAX_M, GOAL_MIN_M, setErgGoal, type Erg, type ErgSample } from "./hub";

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
  let mark = blockM;
  let prevT = 0;
  let prev: ErgSample | null = null;
  for (const s of samples) {
    if (!Number.isFinite(s.t) || !Number.isFinite(s.dist)) continue;
    while (s.dist >= mark && out.length < MAX_BLOCKS) {
      const t = prev && s.dist > prev.dist ? prev.t + ((mark - prev.dist) * (s.t - prev.t)) / (s.dist - prev.dist) : s.t;
      const seconds = t - prevT;
      if (seconds > 0) out.push({ n: out.length + 1, meters: blockM, seconds });
      prevT = t;
      mark += blockM;
    }
    prev = s;
  }
  return out;
}

/* The length most of the monitor's splits are cut at. The commonest value
 * rather than the first or the mean, so the short last split of a piece
 * cannot set the unit for all of them; ties go to the longer. */
function modalMeters(blocks: Block[]): number {
  const seen = new Map<number, number>();
  let best = BLOCK_M;
  let bestN = 0;
  for (const b of blocks) {
    const m = Math.round(b.meters);
    if (!(m > 0)) continue;
    const n = (seen.get(m) ?? 0) + 1;
    seen.set(m, n);
    if (n > bestN || (n === bestN && m > best)) {
      best = m;
      bestN = n;
    }
  }
  return bestN > 0 ? best : BLOCK_M;
}

/* THE BLOCKS AND THE UNIT THEY ARE COUNTED IN. The two travel together
 * (review, 2026-09-17): predict.ts counts how many blocks are done and how
 * many are left in `blockM`, and measures their spread in the same unit, so
 * handing it blocks of one length and a unit of another makes the band
 * dishonest. A monitor cutting 1,000 m splits gets blockM 1,000; the
 * derived path cuts its own and is always BLOCK_M. */
export type BlockSet = { blocks: Block[]; blockM: number };

export function blocksFor(e: Erg): BlockSet {
  const fromMonitor: Block[] = e.model.splits.flatMap((s) => {
    const a = s.a;
    if (!a) return [];
    return a.splitDistanceM > 0 && a.splitTimeS > 0 ? [{ n: s.n, meters: a.splitDistanceM, seconds: a.splitTimeS }] : [];
  });
  if (fromMonitor.length) return { blocks: fromMonitor, blockM: modalMeters(fromMonitor) };
  return { blocks: derivedBlocks(e.model.samples), blockM: BLOCK_M };
}

/* Where this erg finishes the goal, and how sure. Safe on an empty slot:
 * predictFinish is handed zeroes and answers with a reason rather than a
 * number. */
export function predictForErg(e: Erg): Prediction {
  const g = e.model.general;
  const a1 = e.model.a1;
  const { blocks, blockM } = blocksFor(e);
  return predictFinish({
    targetMeters: e.goalM > 0 ? e.goalM : DEFAULT_GOAL_M,
    distanceM: g ? g.distanceM : 0,
    elapsedS: g ? g.elapsedHundredths / 100 : 0,
    blocks,
    blockM,
    currentPaceS: a1 && a1.currentPaceS > 0 ? a1.currentPaceS : null,
  });
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
export function expectedFinish(e: Erg): FinishRead {
  const p = predictForErg(e);
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
