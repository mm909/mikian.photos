"use client";

import { isEnded } from "@/lib/pm5/pm5";
import { fmtBand, fmtTime, predictFinish, type Block, type PieceState, type Prediction } from "@/lib/pm5/predict";
import { DEFAULT_GOAL_M, type Erg, type ErgSample } from "./hub";

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
 * THE GOAL IS THE WORKOUT (owner, 2026-09-23: "remove the ability to
 * specify goal and target"). A fixed distance on the monitor is the goal;
 * anything else — a just row, a timed piece — is read as the five thousand.
 * Nothing on any screen sets it. The race board alone hands its own
 * distance in on a copy of the slot.
 *
 * The maths is src/lib/pm5/predict.ts and nothing here duplicates it. */

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
/* WHAT THIS ERG IS ROWING: the slot's own goal when one was handed in (the
 * race board), else the fixed distance the monitor is set to, else the five
 * thousand. */
export function goalOf(e: Erg): number {
  if (e.goalM > 0) return e.goalM;
  const g = e.model.general;
  return g && g.totalWorkDistanceM > 0 ? Math.round(g.totalWorkDistanceM) : DEFAULT_GOAL_M;
}

export function pieceStateFor(e: Erg): PieceState {
  const g = e.model.general;
  const a1 = e.model.a1;
  const { blocks, blockM } = blocksFor(e);
  return {
    targetMeters: goalOf(e),
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
