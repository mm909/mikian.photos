/* WHAT THE ROWER WANTS TO KNOW MID-PIECE (owner, 2026-09-17): where this
 * row is going to finish, how sure that is, what each split did, and
 * whether he is on the pace he asked for.
 *
 * Pure. No React, no db, no clock of its own — every function is handed
 * the piece as it stands and answers from that, so the whole thing can be
 * checked against a synthetic row.
 *
 * THE PREDICTION IS NOT AN EXTRAPOLATION. Multiplying the current average
 * out to the finish gives a number with no honesty attached: it says
 * 20:00 at 200 m in the same voice it says 20:00 with 200 m to go. What
 * the owner asked for is a band that starts wide and closes — "twenty
 * minutes plus or minus a minute" early, and nearly exact on the last
 * five hundred — and that falls out of the arithmetic rather than being
 * faked with a shrinking fudge factor.
 *
 * THE MODEL. Work in BLOCKS of `blockM` metres (the monitor's own split
 * length, 500 m unless the piece says otherwise). Of the piece, `nDone`
 * blocks are rowed and `nLeft` remain.
 *
 *   The point estimate. Future pace is a blend of the RECENT block and the
 *   whole-piece average — recent carries more weight, because the last
 *   five hundred predicts the next five hundred better than the first one
 *   does — with any drift carried forward, damped and clamped. A rower who
 *   has faded two seconds a block is likely to keep fading, but not
 *   forever, and a fade measured over three blocks is not a promise.
 *
 *   The band. Two errors, and they behave differently:
 *     · BLOCK NOISE — the blocks vary around their own mean. Over nLeft
 *       more of them that is sigma * sqrt(nLeft): it grows, but slowly.
 *     · MEAN ERROR — my estimate of the future pace is itself off by about
 *       sigma / sqrt(nDone), and THAT error lands on every remaining block,
 *       so it scales with nLeft, not its root.
 *   Added in quadrature:
 *
 *       sigma_remaining = sigma_block * sqrt( nLeft + nLeft^2 / nDone )
 *
 *   One block into a 5,000 m piece with six seconds of block variation:
 *   6 * sqrt(9 + 81) = 57 s, which is the plus-or-minus-a-minute the owner
 *   described. With one block to go: 6 * sqrt(1 + 1/9) = 6 s. The band
 *   closes because the arithmetic closes it.
 *
 * WHAT IS DELIBERATELY NOT HERE: anything that needs a history. "Your rate
 * is high for you" wants a baseline across sessions, and the owner said to
 * leave that until there is data. The anomalies below are measured against
 * THIS piece only, which is honest on the first row anybody ever saves. */

/* ------------------------------------------------------------- inputs */

/* One finished block of the piece, as the monitor reported it or as the
 * caller cut it out of the samples. `seconds` is that block alone. */
export type Block = { n: number; meters: number; seconds: number };

export type PieceState = {
  /* The whole piece, when it is a fixed distance. Null for a just-row or
   * a timed piece: there is no finish to predict, and predictFinish says
   * so rather than inventing one. */
  targetMeters: number | null;
  /* Where the piece stands. */
  distanceM: number;
  elapsedS: number;
  /* Finished blocks, oldest first. */
  blocks: Block[];
  /* The block length the monitor is cutting (metres). */
  blockM: number;
  /* The last pace the monitor reported, seconds per 500 m. Used for the
   * recent half of the blend before a block has finished. */
  currentPaceS: number | null;
};

/* ------------------------------------------------------------ the maths */

/* Before a single block is in there is nothing to measure variation with,
 * so the band starts from a prior: four per cent of the block pace, which
 * is about five seconds on a two-minute five hundred. Wide enough to be
 * honest, narrow enough to be worth printing. */
export const PRIOR_SIGMA_FRACTION = 0.04;
/* The band can never close completely: a monitor rounds, a rower can still
 * stop. Half a second. */
export const SIGMA_FLOOR_S = 0.5;
/* How much of the recent block carries the point estimate. */
export const RECENT_WEIGHT = 0.6;
/* Fade is carried forward at this fraction, and never past this many
 * seconds a block, so three noisy blocks cannot predict a collapse. */
export const DRIFT_DAMP = 0.6;
export const DRIFT_CLAMP_S = 1.5;
/* Before this much of a block is done, nDone is held here so the mean
 * error term cannot divide by nearly nothing. */
export const MIN_BLOCKS_DONE = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finite = (v: number) => Number.isFinite(v);

/* Sample standard deviation of the block paces, normalised to one block so
 * a short last block cannot pass as a full one. Null under two blocks. */
export function blockSigma(blocks: Block[], blockM: number): number | null {
  const paces = blocks
    .filter((b) => b.meters > 0 && b.seconds > 0)
    .map((b) => (b.seconds * blockM) / b.meters);
  if (paces.length < 2) return null;
  const mean = paces.reduce((s, p) => s + p, 0) / paces.length;
  const varSum = paces.reduce((s, p) => s + (p - mean) * (p - mean), 0);
  return Math.sqrt(varSum / (paces.length - 1));
}

/* Seconds a block, gained or lost, per block — the fade. Least squares over
 * the last `window` blocks; null under three. */
export function blockDrift(blocks: Block[], blockM: number, window = 5): number | null {
  const use = blocks.slice(-window).filter((b) => b.meters > 0 && b.seconds > 0);
  if (use.length < 3) return null;
  const ys = use.map((b) => (b.seconds * blockM) / b.meters);
  const n = ys.length;
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  ys.forEach((y, i) => {
    num += (i - xMean) * (y - yMean);
    den += (i - xMean) * (i - xMean);
  });
  return den === 0 ? null : num / den;
}

export type Prediction = {
  /* Enough of the piece is done to say something. */
  ready: boolean;
  /* Why not, when it is not. */
  note: string | null;
  /* Total time for the whole piece, seconds. Null when there is no fixed
   * distance to finish at. */
  finishS: number | null;
  /* Plus and minus, one standard deviation, seconds. */
  bandS: number | null;
  /* The two ends, for printing a range. */
  lowS: number | null;
  highS: number | null;
  /* What the rest of the piece is predicted to take. */
  remainingS: number | null;
  /* The pace the estimate is built on, seconds per 500 m. */
  predictedPace500S: number | null;
  /* Blocks done and left, as the model counts them. */
  blocksDone: number;
  blocksLeft: number;
  /* The variation the band was built from, seconds a block, and whether it
   * came from the piece or from the prior. */
  sigmaBlockS: number;
  sigmaFromPrior: boolean;
  /* Seconds a block being gained or lost, when it could be measured. */
  driftPerBlockS: number | null;
};

const NOTHING: Prediction = {
  ready: false,
  note: null,
  finishS: null,
  bandS: null,
  lowS: null,
  highS: null,
  remainingS: null,
  predictedPace500S: null,
  blocksDone: 0,
  blocksLeft: 0,
  sigmaBlockS: 0,
  sigmaFromPrior: true,
  driftPerBlockS: null,
};

/* The finish, and how sure. */
export function predictFinish(p: PieceState): Prediction {
  const blockM = p.blockM > 0 ? p.blockM : 500;
  if (p.targetMeters === null || !finite(p.targetMeters) || p.targetMeters <= 0) {
    return { ...NOTHING, note: "No fixed distance — nothing to finish at." };
  }
  if (!finite(p.distanceM) || !finite(p.elapsedS) || p.elapsedS <= 0 || p.distanceM <= 0) {
    return { ...NOTHING, note: "Waiting for the first metres." };
  }
  if (p.distanceM >= p.targetMeters) {
    /* Rowed. The finish is not a prediction any more. */
    return {
      ...NOTHING,
      ready: true,
      finishS: p.elapsedS,
      bandS: 0,
      lowS: p.elapsedS,
      highS: p.elapsedS,
      remainingS: 0,
      predictedPace500S: (p.elapsedS * 500) / p.distanceM,
      blocksDone: p.distanceM / blockM,
      blocksLeft: 0,
      sigmaBlockS: 0,
      sigmaFromPrior: false,
    };
  }

  const nDoneRaw = p.distanceM / blockM;
  const nDone = Math.max(MIN_BLOCKS_DONE, nDoneRaw);
  const nLeft = (p.targetMeters - p.distanceM) / blockM;

  /* The pace so far, and the pace lately. */
  const paceAvg = (p.elapsedS * blockM) / p.distanceM;
  const lastBlock = p.blocks[p.blocks.length - 1];
  const paceRecent =
    p.currentPaceS !== null && finite(p.currentPaceS) && p.currentPaceS > 0
      ? (p.currentPaceS * blockM) / 500
      : lastBlock && lastBlock.meters > 0
        ? (lastBlock.seconds * blockM) / lastBlock.meters
        : paceAvg;

  /* Recent leads, the whole piece anchors. */
  const base = RECENT_WEIGHT * paceRecent + (1 - RECENT_WEIGHT) * paceAvg;

  /* Fade, damped and clamped: a rower who is losing a second a block will
   * probably keep losing some of it, but three blocks is not a promise. */
  const driftRaw = blockDrift(p.blocks, blockM);
  const drift = driftRaw === null ? 0 : clamp(driftRaw, -DRIFT_CLAMP_S, DRIFT_CLAMP_S) * DRIFT_DAMP;

  /* Walk the remaining blocks, carrying the fade, never letting it run
   * away from the pace it started at. */
  let remainingS = 0;
  let whole = Math.floor(nLeft);
  const tail = nLeft - whole;
  for (let i = 1; i <= whole; i++) {
    remainingS += clamp(base + drift * i, base * 0.85, base * 1.25);
  }
  if (tail > 0) {
    remainingS += clamp(base + drift * (whole + 1), base * 0.85, base * 1.25) * tail;
  }
  if (whole === 0 && tail === 0) remainingS = 0;

  /* The band. Block noise grows with the root of what is left; the error
   * in my estimate of the mean lands on every block that remains. */
  const measured = blockSigma(p.blocks, blockM);
  const sigmaFromPrior = measured === null;
  const sigmaBlock = measured ?? base * PRIOR_SIGMA_FRACTION;
  const variance = sigmaBlock * sigmaBlock * (nLeft + (nLeft * nLeft) / nDone);
  const band = Math.max(SIGMA_FLOOR_S, Math.sqrt(Math.max(0, variance)));

  const finishS = p.elapsedS + remainingS;
  return {
    ready: true,
    note: null,
    finishS,
    bandS: band,
    lowS: Math.max(p.elapsedS, finishS - band),
    highS: finishS + band,
    remainingS,
    predictedPace500S: (base * 500) / blockM,
    blocksDone: nDoneRaw,
    blocksLeft: nLeft,
    sigmaBlockS: sigmaBlock,
    sigmaFromPrior,
    driftPerBlockS: driftRaw,
  };
}

/* ------------------------------------------------------------- the goal */

export type Target = {
  /* What the rower said before they sat down: the whole piece in seconds. */
  finishS: number;
};

export type TargetRead = {
  /* Where they stand against it. */
  state: "ahead" | "on" | "behind" | "gone";
  /* Seconds in hand, negative when they are behind. */
  marginS: number;
  /* What the rest of the piece has to average to make it, seconds per
   * 500 m. Null once the target is out of reach. */
  needPace500S: number | null;
  /* That pace against the one they are rowing: negative means they have to
   * find time. */
  vsCurrentS: number | null;
  /* The line to print. */
  line: string;
};

/* How much slack counts as ON the target rather than off it: half the
 * prediction band, floored, so a wobble early does not shout. */
export function targetTolerance(pred: Prediction): number {
  return Math.max(1.5, (pred.bandS ?? 3) / 2);
}

export function readTarget(p: PieceState, target: Target, pred: Prediction): TargetRead | null {
  if (p.targetMeters === null || !pred.ready || pred.finishS === null) return null;
  const left = p.targetMeters - p.distanceM;
  const timeLeft = target.finishS - p.elapsedS;
  if (left <= 0) {
    const margin = target.finishS - p.elapsedS;
    return {
      state: margin >= 0 ? "ahead" : "behind",
      marginS: margin,
      needPace500S: null,
      vsCurrentS: null,
      line: margin >= 0 ? `Made it by ${fmtGap(margin)}` : `Missed it by ${fmtGap(-margin)}`,
    };
  }
  if (timeLeft <= 0) {
    return {
      state: "gone",
      marginS: timeLeft,
      needPace500S: null,
      vsCurrentS: null,
      line: "The target has gone — row it out",
    };
  }
  const needPace = (timeLeft / left) * 500;
  const cur = pred.predictedPace500S ?? needPace;
  const margin = target.finishS - pred.finishS;
  const tol = targetTolerance(pred);
  const state: TargetRead["state"] = margin > tol ? "ahead" : margin < -tol ? "behind" : "on";
  const vs = needPace - cur;
  const line =
    state === "on"
      ? `On for it — hold ${fmtPace(needPace)}`
      : state === "ahead"
        ? `${fmtGap(margin)} in hand — ${fmtPace(needPace)} is enough`
        : `${fmtGap(-margin)} down — you need ${fmtPace(needPace)}`;
  return { state, marginS: margin, needPace500S: needPace, vsCurrentS: vs, line };
}

/* ---------------------------------------------------------- the splits */

export type Milestone = {
  n: number;
  meters: number;
  /* The block alone. */
  seconds: number;
  pace500S: number;
  /* Against the block before it: negative is faster. Null on the first. */
  deltaS: number | null;
  /* What the finish looked like when this block landed. */
  finishAtS: number | null;
  bandAtS: number | null;
};

/* Every finished block with what it did and what it meant at the time.
 * `predictAt` is handed the piece as it stood at the end of each block, so
 * the milestone carries the prediction of that moment, not of now. */
export function milestones(p: PieceState): Milestone[] {
  const blockM = p.blockM > 0 ? p.blockM : 500;
  const out: Milestone[] = [];
  let cumM = 0;
  let cumS = 0;
  p.blocks.forEach((b, i) => {
    cumM += b.meters;
    cumS += b.seconds;
    const pace = b.meters > 0 ? (b.seconds * 500) / b.meters : 0;
    const prev = out[out.length - 1];
    const at = predictFinish({
      targetMeters: p.targetMeters,
      distanceM: cumM,
      elapsedS: cumS,
      blocks: p.blocks.slice(0, i + 1),
      blockM,
      currentPaceS: pace,
    });
    out.push({
      n: b.n,
      meters: cumM,
      seconds: b.seconds,
      pace500S: pace,
      deltaS: prev ? pace - prev.pace500S : null,
      finishAtS: at.finishS,
      bandAtS: at.bandS,
    });
  });
  return out;
}

/* ------------------------------------------------------- out of the normal */

/* WITHIN THIS PIECE ONLY. The owner asked to be told when something is off
 * — a rate or a power well away from normal — and said himself that it is
 * hard without enough data. So this measures against the piece's own
 * settled middle, never against a history that does not exist yet: it can
 * say "your rate is four up on your own average", which is true on the
 * first row anybody ever saves, and it stays quiet until there are enough
 * strokes to have an average worth the name. */
export const ANOMALY_MIN_STROKES = 15;
export const ANOMALY_WINDOW = 8;
export const ANOMALY_Z = 2;

export type StrokeLite = { n: number; spm: number | null; watts: number | null };

export type Anomaly = {
  what: "rate" | "power";
  /* Up or down against the piece's own average. */
  dir: "up" | "down";
  /* How far, in the metric's own unit. */
  byS: number;
  /* How far in standard deviations. */
  z: number;
  line: string;
};

function meanSd(xs: number[]): { mean: number; sd: number } | null {
  const use = xs.filter((x) => Number.isFinite(x));
  if (use.length < 2) return null;
  const mean = use.reduce((s, x) => s + x, 0) / use.length;
  const sd = Math.sqrt(use.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (use.length - 1));
  return { mean, sd };
}

export function anomalies(strokes: StrokeLite[]): Anomaly[] {
  if (strokes.length < ANOMALY_MIN_STROKES) return [];
  const out: Anomaly[] = [];
  const check = (what: Anomaly["what"], pick: (s: StrokeLite) => number | null, unit: string) => {
    const all = strokes.map(pick).filter((v): v is number => v !== null && Number.isFinite(v));
    if (all.length < ANOMALY_MIN_STROKES) return;
    /* The settled middle: everything but the window being judged. */
    const recent = all.slice(-ANOMALY_WINDOW);
    const base = all.slice(0, -ANOMALY_WINDOW);
    const b = meanSd(base);
    const r = meanSd(recent);
    if (!b || !r || b.sd <= 0) return;
    const z = (r.mean - b.mean) / b.sd;
    if (Math.abs(z) < ANOMALY_Z) return;
    const by = r.mean - b.mean;
    out.push({
      what,
      dir: by > 0 ? "up" : "down",
      byS: Math.abs(by),
      z,
      line: `${what === "rate" ? "Rate" : "Power"} is ${Math.abs(by) < 1 ? "off" : `${Math.round(Math.abs(by))} ${unit}`} ${by > 0 ? "above" : "below"} your own average`,
    });
  };
  check("rate", (s) => s.spm, "spm");
  check("power", (s) => s.watts, "W");
  return out;
}

/* ----------------------------------------------------------- printing */

/* "19:58.4" / "1:58.4" — a duration, tenths kept under an hour. */
export function fmtTime(seconds: number): string {
  if (!finite(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}`;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/* "1:58.4" — a pace, always to the tenth. */
export function fmtPace(seconds: number): string {
  if (!finite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/* "±57 s" / "±1:02" — the band, in the unit that reads. */
export function fmtBand(seconds: number): string {
  if (!finite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* "4.2 s" — a gap between two times. */
export function fmtGap(seconds: number): string {
  return fmtBand(Math.abs(seconds));
}
