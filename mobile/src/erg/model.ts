import type { Pm5Packet } from "../pm5/encode";
import {
  DurationType,
  PM5_UUID,
  StrokeState,
  createForceCurveAssembler,
  isEnded,
  isNewPiece,
  parseAdditionalSplitData,
  parseAdditionalStatus1,
  parseAdditionalStatus2,
  parseAdditionalStrokeData,
  parseAdditionalSummary1,
  parseForceCurve,
  parseGeneralStatus,
  parseMultiplexed,
  parseSplitData,
  parseStrokeData,
  parseWorkoutSummary,
  type AdditionalSplitData,
  type AdditionalStatus1,
  type AdditionalStatus2,
  type AdditionalStrokeData,
  type AdditionalSummary1,
  type AdditionalSummary2,
  type GeneralStatus,
  type SplitData,
  type StrokeData,
  type WorkoutSummary,
} from "../pm5/pm5";
import { buildTelemetryDoc, fitTelemetryDoc, type TelemetryCurve, type TelemetryDoc, type TelemetryModel, type TelemetrySplit } from "../pm5/session";

/* WHAT THE MONITOR IS SAYING, AND EVERYTHING IT SAID. Every packet off a
 * PM5 (a real one over Bluetooth or the built-in simulator) goes through
 * feed(), which runs the same parsers the Rowtember web console runs
 * (src/pm5 is a copy of the site's src/lib/pm5).
 *
 * Two things come out. `get()` is the handful of numbers the live screen
 * shows. `toDoc()` is the whole piece — every stroke, tick, split and force
 * curve — as the same saved document the website writes, so the same
 * analysis reads it afterwards. */

export type Live = {
  /* Any packet seen yet. */
  awake: boolean;
  workoutState: number;
  ended: boolean;
  elapsedS: number;
  meters: number;
  /* Seconds per 500 m; 0 = none yet. */
  pace: number;
  avgPace: number;
  spm: number;
  watts: number;
  strokes: number;
  drag: number;
  calories: number;
  /* The distance the monitor is set to, when the workout is a fixed distance; 0 otherwise. */
  targetM: number;
  /* The time the monitor is set to, seconds, when the workout is a fixed time; 0 otherwise. */
  targetS: number;
  /* Heart rate off a paired belt; null without one. */
  hr: number | null;
  /* The last whole force curve, pounds of force. */
  curve: number[];
  peakLbf: number;
  /* Sum and count of stroke watts, for the average at the end. */
  wattSum: number;
  wattN: number;
  /* THE STROKE AS IT IS BEING PULLED, for a picture that rows with the
   * rower (owner, 2026-11-22: "if the boats have oars, the oars need to
   * match my stroke"): whether the handle is on the drive right now, as the
   * monitor's status says, and how long the last stroke's drive and its
   * way back took. */
  driving: boolean;
  driveS: number;
  recoveryS: number;
};

export const EMPTY_LIVE: Live = {
  awake: false,
  workoutState: 0,
  ended: false,
  elapsedS: 0,
  meters: 0,
  pace: 0,
  avgPace: 0,
  spm: 0,
  watts: 0,
  strokes: 0,
  drag: 0,
  calories: 0,
  targetM: 0,
  targetS: 0,
  hr: null,
  curve: [],
  peakLbf: 0,
  wattSum: 0,
  wattN: 0,
  driving: false,
  driveS: 0,
  recoveryS: 0,
};

/* A phone holds a long row; past these the oldest detail is not the worry,
 * memory is, and the document is thinned again on the way to storage. */
const MAX_SAMPLES = 30_000;
const MAX_STROKES = 12_000;
const MAX_CURVES = 4_000;

export function createLive() {
  let live: Live = { ...EMPTY_LIVE };
  let prevState: number | null = null;
  const curves = createForceCurveAssembler();

  /* The recording. */
  let gen: GeneralStatus | null = null;
  let la1: AdditionalStatus1 | null = null;
  let la2: AdditionalStatus2 | null = null;
  let sum: WorkoutSummary | null = null;
  let sum1: AdditionalSummary1 | null = null;
  let sum2: AdditionalSummary2 | null = null;
  let strokes: TelemetryModel["strokes"] = [];
  let samples: TelemetryModel["samples"] = [];
  let splits: TelemetrySplit[] = [];
  let forces: TelemetryCurve[] = [];
  let startedAt: string | null = null;
  let packets = 0;
  let lastAt = 0;

  const wipe = () => {
    live = { ...EMPTY_LIVE };
    gen = la1 = la2 = null;
    sum = sum1 = sum2 = null;
    strokes = [];
    samples = [];
    splits = [];
    forces = [];
    startedAt = null;
    packets = 0;
  };

  const general = (g: GeneralStatus) => {
    /* The monitor re-armed: a new piece starts from nothing. */
    if (isNewPiece(prevState, g.workoutState)) wipe();
    prevState = g.workoutState;
    gen = g;
    live.awake = true;
    live.workoutState = g.workoutState;
    live.elapsedS = g.elapsedS;
    live.meters = g.distanceM;
    live.drag = g.dragFactor;
    live.driving = g.strokeState === StrokeState.DRIVING;
    live.targetM = g.workoutDurationType === DurationType.DISTANCE && g.workoutDuration > 0 ? g.workoutDuration : 0;
    live.targetS = g.workoutDurationType === DurationType.TIME && g.workoutDuration > 0 ? g.workoutDuration / 100 : 0;
    live.ended = isEnded(g.workoutState) && g.distanceM > 0;
    if (g.elapsedS > 0 && g.distanceM > 0 && !isEnded(g.workoutState) && samples.length < MAX_SAMPLES) {
      samples.push({ t: g.elapsedS, dist: g.distanceM, pace: la1?.currentPaceS ?? 0, avgPace: la1?.averagePaceS ?? 0, spm: la1?.strokeRate ?? 0, hr: la1?.heartRate ?? null, watts: live.watts > 0 ? live.watts : null, drag: g.dragFactor });
    }
  };
  const a1 = (a: AdditionalStatus1) => {
    la1 = a;
    live.spm = a.strokeRate;
    live.hr = a.heartRate ?? null;
    if (a.currentPaceS > 0) live.pace = a.currentPaceS;
    if (a.averagePaceS > 0) live.avgPace = a.averagePaceS;
  };
  const a2 = (a: AdditionalStatus2) => {
    la2 = a;
    live.calories = a.totalCalories;
  };
  const stroke = (s: StrokeData) => {
    live.strokes = s.strokeCount;
    if (s.driveTimeS > 0) live.driveS = s.driveTimeS;
    if (s.recoveryTimeS > 0) live.recoveryS = s.recoveryTimeS;
    const row = {
      n: s.strokeCount,
      elapsedS: s.elapsedS,
      distanceM: s.distanceM,
      driveLengthM: s.driveLengthM,
      driveTimeS: s.driveTimeS,
      recoveryTimeS: s.recoveryTimeS,
      peakLbf: s.peakDriveForceLbf,
      avgLbf: s.avgDriveForceLbf,
      workJ: s.workPerStrokeJ,
      watts: null as number | null,
      paceS: la1 && la1.currentPaceS > 0 ? la1.currentPaceS : null,
      spm: la1 ? la1.strokeRate : null,
      hr: la1?.heartRate ?? null,
    };
    const last = strokes[strokes.length - 1];
    if (last && last.n === row.n) strokes[strokes.length - 1] = { ...row, watts: last.watts };
    else if (strokes.length < MAX_STROKES) strokes.push(row);
  };
  const stroke2 = (s: AdditionalStrokeData) => {
    live.watts = s.strokePowerW;
    if (s.strokePowerW > 0) {
      live.wattSum += s.strokePowerW;
      live.wattN += 1;
    }
    for (let i = strokes.length - 1; i >= 0 && i >= strokes.length - 3; i--) {
      if (strokes[i].n === s.strokeCount) {
        strokes[i].watts = s.strokePowerW;
        if (strokes[i].workJ === null && s.workPerStrokeJ !== null) strokes[i].workJ = s.workPerStrokeJ;
        break;
      }
    }
  };
  const split = (a: SplitData | null, b: AdditionalSplitData | null) => {
    const n = (a ?? b)?.splitNumber;
    if (n === undefined) return;
    const at = splits.findIndex((x) => x.n === n);
    if (at >= 0) splits[at] = { n, a: a ?? splits[at].a, b: b ?? splits[at].b };
    else splits.push({ n, a, b });
  };
  const summary = (s: WorkoutSummary) => {
    sum = s;
    live.elapsedS = s.elapsedS;
    live.meters = s.distanceM;
    if (s.avgPaceS) live.avgPace = s.avgPaceS;
    live.ended = s.distanceM > 0;
  };

  return {
    get: (): Live => live,
    reset() {
      wipe();
      prevState = null;
      curves.reset();
    },
    /* The piece so far as a saved document, small enough to store. */
    toDoc(deviceName: string, simulated: boolean): TelemetryDoc {
      const model: TelemetryModel = {
        device: { name: deviceName, serial: "", simulated, model: null, firmware: null, hardware: null },
        general: gen,
        a1: la1,
        a2: la2,
        summary: sum,
        summary1: sum1,
        summary2: sum2,
        strokes,
        samples,
        splits,
        forces,
        rec: { startedAt, packets: { length: packets, [Math.max(0, packets - 1)]: { t: lastAt } }, dropped: 0 },
      };
      return fitTelemetryDoc(buildTelemetryDoc(model));
    },
    feed({ uuid, dv }: Pm5Packet) {
      const u = uuid.toLowerCase();
      packets++;
      lastAt = Date.now();
      if (!startedAt) startedAt = new Date(lastAt).toISOString();
      /* A new object every packet, so React sees the change. */
      live = { ...live };
      if (u === PM5_UUID.generalStatus) {
        const g = parseGeneralStatus(dv);
        if (g) general(g);
      } else if (u === PM5_UUID.additionalStatus1) {
        const a = parseAdditionalStatus1(dv);
        if (a) a1(a);
      } else if (u === PM5_UUID.additionalStatus2) {
        const a = parseAdditionalStatus2(dv);
        if (a) a2(a);
      } else if (u === PM5_UUID.strokeData) {
        const s = parseStrokeData(dv);
        if (s) stroke(s);
      } else if (u === PM5_UUID.additionalStrokeData) {
        const s = parseAdditionalStrokeData(dv);
        if (s) stroke2(s);
      } else if (u === PM5_UUID.splitData) {
        split(parseSplitData(dv), null);
      } else if (u === PM5_UUID.additionalSplitData) {
        split(null, parseAdditionalSplitData(dv));
      } else if (u === PM5_UUID.workoutSummary) {
        const s = parseWorkoutSummary(dv);
        if (s) summary(s);
      } else if (u === PM5_UUID.additionalWorkoutSummary1) {
        sum1 = parseAdditionalSummary1(dv) ?? sum1;
      } else if (u === PM5_UUID.forceCurve) {
        const chunk = parseForceCurve(dv);
        const whole = chunk ? curves.push(chunk) : null;
        if (whole) {
          live.curve = whole.pointsLbf;
          live.peakLbf = whole.peakLbf;
          if (forces.length < MAX_CURVES) forces.push({ n: Math.max(1, live.strokes), points: whole.pointsLbf });
        }
      } else if (u === PM5_UUID.multiplexed) {
        const m = parseMultiplexed(dv);
        if (!m) return;
        if (m.kind === "general") general(m.data);
        else if (m.kind === "additional1") a1(m.data);
        else if (m.kind === "additional2") a2(m.data);
        else if (m.kind === "stroke") stroke(m.data);
        else if (m.kind === "additionalStroke") stroke2(m.data);
        else if (m.kind === "split") split(m.data, null);
        else if (m.kind === "additionalSplit") split(null, m.data);
        else if (m.kind === "summary") summary(m.data);
        else if (m.kind === "additionalSummary1") sum1 = m.data;
        else if (m.kind === "additionalSummary2") sum2 = m.data;
      }
    },
  };
}
