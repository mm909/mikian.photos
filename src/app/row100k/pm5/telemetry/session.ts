import type { AdditionalSplitData, AdditionalSummary1, AdditionalSummary2, SplitData, WorkoutSummary } from "../pm5";

/* THE SAVED SESSION (owner, 2026-09-17: the option to save the live
 * telemetry of a row). The document a SAVE writes into RowTelemetry.data,
 * built from the console's in-memory model, checked on the way into the
 * route, and turned back into the scalar columns the list prints. NO DOM,
 * NO REACT, NO DATABASE: the scratchpad check imports this file straight.
 *
 * UNITS ARE INTEGERS, the way the monitor sends them: hundredths of a
 * second, tenths of a metre, centimetres of drive, tenths of a pound of
 * force, tenths of a joule. The console keeps floats for its charts; the
 * builder rounds on the way out and the loader divides on the way back.
 *
 * SIZE. A 45-minute piece at 250 ms is about 0.8 MB, an hour about 1.1 MB.
 * A 100 K row is some 200,000 status ticks and 9,000 strokes; the document
 * keeps one tick a second and thins each list evenly to its cap, and at
 * the caps it is still some 2.6 MB — past the 2 MB the route will take.
 * So fitTelemetryDoc thins a long piece before the upload (ticks every
 * two seconds, every other force curve, every other stroke, again until
 * it fits) and says so in notes.thinned; nothing is refused after a full
 * upload for size alone. */

export const TELEMETRY_SCHEMA = "pm5-telemetry/1";

export const CAPS = {
  strokes: 5_000,
  samples: 7_200,
  splits: 500,
  curves: 2_000,
  curvePoints: 64,
  jsonBytes: 2_000_000,
  title: 80,
} as const;

export type TelemetryDevice = {
  name: string;
  serial: string;
  simulated: boolean;
  model?: string;
  firmware?: string;
  hardware?: string;
};

export type TelemetryStroke = {
  n: number;
  elapsedHundredths: number;
  distanceTenths: number;
  watts: number;
  spm: number;
  hr: number | null;
  driveLengthCm: number;
  driveTimeHundredths: number;
  recoveryTimeHundredths: number;
  peakForceTenthsLbf: number;
  avgForceTenthsLbf: number;
  workTenthsJ: number;
  /* Hundredths of a second per 500 m, from the status packet under the stroke. */
  pace?: number;
};

export type TelemetrySample = {
  elapsedHundredths: number;
  distanceTenths: number;
  paceHundredths: number;
  avgPaceHundredths: number;
  spm: number;
  hr: number | null;
  watts: number | null;
  drag: number;
};

export type TelemetrySplit = { n: number; a: SplitData | null; b: AdditionalSplitData | null };

export type TelemetryCurve = { n: number; points: number[] };

export type TelemetryTotals = {
  meters: number;
  tenths: number;
  strokes: number;
  avgPaceTenths: number | null;
  avgWatts: number | null;
  avgSpm: number | null;
  avgHr: number | null;
  dragFactor: number | null;
  calories: number | null;
};

export type TelemetryDoc = {
  schema: typeof TELEMETRY_SCHEMA;
  device: TelemetryDevice;
  startedAt: string;
  endedAt: string | null;
  workout: { type: number; target: number; durationType: number };
  totals: TelemetryTotals;
  strokes: TelemetryStroke[];
  samples: TelemetrySample[];
  splits: TelemetrySplit[];
  forceCurves: TelemetryCurve[];
  summary: { s39: WorkoutSummary | null; s3a: AdditionalSummary1 | null; s3c: AdditionalSummary2 | null };
  /* thinned: what fitTelemetryDoc took out to get under the byte cap,
   * absent when nothing was. */
  notes: { packetsRecorded: number; packetsDropped: number; thinned?: string };
};

/* One row of SAVED ROWS: the scalar columns plus who rowed it. Dates are
 * ISO strings so the page can hand the list to the client as it is. */
export type TelemetrySavedRow = {
  id: string;
  device: string;
  simulated: boolean;
  startedAt: string;
  endedAt: string | null;
  meters: number;
  tenths: number;
  strokes: number;
  avgPaceTenths: number | null;
  avgWatts: number | null;
  avgSpm: number | null;
  avgHr: number | null;
  dragFactor: number | null;
  title: string;
  entryId: string | null;
  createdAt: string;
  rowerNumber: number;
  displayName: string;
};

/* What the page tells the console about who is looking, so SAVE can say
 * why it is off before a click. */
export type TelemetryViewer = { signedIn: boolean; joined: boolean; isAdmin: boolean; rowerNumber: number | null };

/* ---- the console model, as much of it as the builder reads ------------ */

/* Structural: Telemetry.tsx's Model satisfies this without importing it. */
export type TelemetryModel = {
  device: { name: string; serial: string; simulated: boolean; model: string | null; firmware: string | null; hardware: string | null } | null;
  general: { elapsedHundredths: number; distanceM: number; workoutType: number; workoutDuration: number; workoutDurationType: number; dragFactor: number } | null;
  a1: { averagePaceS: number; averagePowerW: number | null } | null;
  a2: { averagePowerW: number | null; totalCalories: number } | null;
  summary: WorkoutSummary | null;
  summary1: AdditionalSummary1 | null;
  summary2: AdditionalSummary2 | null;
  strokes: {
    n: number;
    elapsedS: number | null;
    distanceM: number | null;
    driveLengthM: number | null;
    driveTimeS: number | null;
    recoveryTimeS: number | null;
    peakLbf: number | null;
    avgLbf: number | null;
    workJ: number | null;
    watts: number | null;
    paceS: number | null;
    spm: number | null;
    hr: number | null;
  }[];
  samples: { t: number; dist: number; pace: number; avgPace: number; spm: number; hr: number | null; watts: number | null; drag: number }[];
  splits: TelemetrySplit[];
  forces: TelemetryCurve[];
  /* pieceStartedAt: the seam of the latest piece on the same erg, when
   * the console saw one; the document starts there, not at the first
   * packet of the recording, so each piece is its own row. */
  rec: { startedAt: string | null; pieceStartedAt?: string | null; packets: ArrayLike<{ t: number }>; dropped: number };
};

const r = (v: number | null | undefined, scale = 1): number => (v === null || v === undefined || !Number.isFinite(v) ? 0 : Math.round(v * scale));
const orNull = (v: number | null | undefined): number | null => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v));

function mean(values: (number | null)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (v === null || !Number.isFinite(v) || v <= 0) continue;
    sum += v;
    n++;
  }
  return n ? Math.round(sum / n) : null;
}

/* Every k-th element counting back from the last, so the last one stays
 * and the whole piece is still there at a coarser step; k of 1 returns the
 * list untouched. */
export function thinBy<T>(items: T[], k: number): T[] {
  if (k <= 1) return items;
  const out: T[] = [];
  for (let i = items.length - 1; i >= 0; i -= k) out.push(items[i]);
  return out.reverse();
}

/* Under the cap by thinning evenly, never by cutting the head off: a 100 K
 * row keeps its first hour as well as its last. */
export function thinTo<T>(items: T[], cap: number): T[] {
  return items.length <= cap ? items : thinBy(items, Math.ceil(items.length / cap));
}

/* At most one tick a second: the LAST tick of each elapsed second wins,
 * so a loaded chart ends where the piece did. Order is kept; past the cap
 * the seconds thin evenly. */
export function downsample(samples: TelemetrySample[], cap = CAPS.samples): TelemetrySample[] {
  const out: TelemetrySample[] = [];
  let lastSec = -1;
  for (const s of samples) {
    const sec = Math.floor(s.elapsedHundredths / 100);
    if (sec === lastSec && out.length) out[out.length - 1] = s;
    else {
      out.push(s);
      lastSec = sec;
    }
  }
  return thinTo(out, cap);
}

/* Tenths of a second per 500 m from a distance and a time; null when
 * there is nothing to divide. */
export function derivePaceTenths(meters: number, tenths: number): number | null {
  if (!(meters > 0) || !(tenths > 0)) return null;
  return Math.round((tenths / meters) * 500);
}

/* The summary's pace is 0x39's when the direct packet carried it, else
 * 0x3C's (the multiplexed 0x39 leaves it out). */
function summaryPaceTenths(summary: TelemetryDoc["summary"]): number | null {
  if (summary.s39?.avgPaceS) return Math.round(summary.s39.avgPaceS * 10);
  if (summary.s3c?.avgPaceS) return Math.round(summary.s3c.avgPaceS * 10);
  return null;
}

export function buildTelemetryDoc(model: TelemetryModel, now = new Date()): TelemetryDoc {
  const dev = model.device;
  const device: TelemetryDevice = {
    name: dev?.name ?? "NO ERG",
    serial: dev?.serial ?? "",
    simulated: dev?.simulated ?? false,
  };
  if (dev?.model) device.model = dev.model;
  if (dev?.firmware) device.firmware = dev.firmware;
  if (dev?.hardware) device.hardware = dev.hardware;

  const packets = model.rec.packets;
  const last = packets.length ? packets[packets.length - 1] : null;
  const startedAt = model.rec.pieceStartedAt ?? model.rec.startedAt ?? now.toISOString();
  const endedAt = last ? new Date(last.t).toISOString() : null;

  const strokes: TelemetryStroke[] = thinTo(model.strokes, CAPS.strokes).map((s) => {
    const row: TelemetryStroke = {
      n: s.n,
      elapsedHundredths: r(s.elapsedS, 100),
      distanceTenths: r(s.distanceM, 10),
      watts: r(s.watts),
      spm: r(s.spm),
      hr: orNull(s.hr),
      driveLengthCm: r(s.driveLengthM, 100),
      driveTimeHundredths: r(s.driveTimeS, 100),
      recoveryTimeHundredths: r(s.recoveryTimeS, 100),
      peakForceTenthsLbf: r(s.peakLbf, 10),
      avgForceTenthsLbf: r(s.avgLbf, 10),
      workTenthsJ: r(s.workJ, 10),
    };
    if (s.paceS !== null && s.paceS > 0) row.pace = Math.round(s.paceS * 100);
    return row;
  });

  const samples = downsample(
    model.samples.map((s) => ({
      elapsedHundredths: r(s.t, 100),
      distanceTenths: r(s.dist, 10),
      paceHundredths: r(s.pace, 100),
      avgPaceHundredths: r(s.avgPace, 100),
      spm: r(s.spm),
      hr: orNull(s.hr),
      watts: orNull(s.watts),
      drag: r(s.drag),
    })),
  );

  const splits = model.splits.slice(-CAPS.splits).map((s) => ({ n: s.n, a: s.a, b: s.b }));
  const forceCurves = thinTo(model.forces, CAPS.curves).map((c) => ({ n: c.n, points: c.points.slice(0, CAPS.curvePoints).map((p) => r(p)) }));

  const summary = { s39: model.summary, s3a: model.summary1, s3c: model.summary2 };
  const g = model.general;
  const lastStroke = model.strokes.length ? model.strokes[model.strokes.length - 1] : null;

  const meters = Math.floor(summary.s39?.distanceM ?? g?.distanceM ?? lastStroke?.distanceM ?? 0);
  const tenths = Math.round((summary.s39?.elapsedHundredths ?? g?.elapsedHundredths ?? r(lastStroke?.elapsedS, 100)) / 10);
  const totals: TelemetryTotals = {
    meters,
    tenths,
    strokes: lastStroke?.n ?? 0,
    avgPaceTenths: summaryPaceTenths(summary) ?? (model.a1?.averagePaceS ? Math.round(model.a1.averagePaceS * 10) : null) ?? derivePaceTenths(meters, tenths),
    avgWatts: orNull(summary.s3a?.watts) ?? orNull(model.a2?.averagePowerW) ?? orNull(model.a1?.averagePowerW) ?? mean(model.strokes.map((s) => s.watts)),
    avgSpm: orNull(summary.s39?.avgStrokeRate) ?? mean(model.strokes.map((s) => s.spm)),
    avgHr: orNull(summary.s39?.avgHeartRate) ?? mean(model.strokes.map((s) => s.hr)),
    dragFactor: orNull(summary.s39?.dragFactorAvg) ?? orNull(g?.dragFactor),
    calories: orNull(summary.s3a?.totalCalories) ?? orNull(model.a2?.totalCalories),
  };

  return {
    schema: TELEMETRY_SCHEMA,
    device,
    startedAt,
    endedAt,
    workout: { type: g?.workoutType ?? 0, target: g?.workoutDuration ?? 0, durationType: g?.workoutDurationType ?? 0 },
    totals,
    strokes,
    samples,
    splits,
    forceCurves,
    summary,
    notes: { packetsRecorded: packets.length, packetsDropped: model.rec.dropped },
  };
}

/* ---- validation: a clean copy or one printable line -------------------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const intOrNull = (v: unknown): number | null | undefined => (v === null ? null : isInt(v) ? v : undefined);
const numOrNull = (v: unknown): number | null | undefined => (v === null ? null : isNum(v) ? v : undefined);

class Bad extends Error {}
const bad = (line: string): never => {
  throw new Bad(line);
};

const str = (v: unknown, what: string, max = 200): string => {
  if (typeof v !== "string") bad(`${what} must be a string`);
  return (v as string).slice(0, max);
};
const int = (v: unknown, what: string): number => {
  if (!isInt(v)) bad(`${what} must be an integer`);
  return v as number;
};
const num = (v: unknown, what: string): number => {
  if (!isNum(v)) bad(`${what} must be a number`);
  return v as number;
};
const intN = (v: unknown, what: string): number | null => {
  const x = intOrNull(v);
  if (x === undefined) bad(`${what} must be an integer or null`);
  return x as number | null;
};
const numN = (v: unknown, what: string): number | null => {
  const x = numOrNull(v);
  if (x === undefined) bad(`${what} must be a number or null`);
  return x as number | null;
};
const iso = (v: unknown, what: string): string => {
  const s = str(v, what, 40);
  if (Number.isNaN(Date.parse(s))) bad(`${what} is not a date`);
  return s;
};
const list = (v: unknown, what: string, cap: number): unknown[] => {
  if (!Array.isArray(v)) bad(`${what} must be a list`);
  if ((v as unknown[]).length > cap) bad(`${what}: ${(v as unknown[]).length.toLocaleString("en-US")} is over the cap of ${cap.toLocaleString("en-US")}`);
  return v as unknown[];
};
const obj = (v: unknown, what: string): Record<string, unknown> => {
  if (!isObj(v)) bad(`${what} must be an object`);
  return v as Record<string, unknown>;
};
/* A decoded packet copied field by field: every value a finite number or
 * null, nothing else rides along. */
const packet = <T>(v: unknown, what: string, keys: (keyof T & string)[], nullable: (keyof T & string)[] = []): T | null => {
  if (v === null || v === undefined) return null;
  const o = obj(v, what);
  const out: Record<string, number | null> = {};
  for (const k of keys) out[k] = nullable.includes(k) ? numN(o[k], `${what}.${k}`) : num(o[k], `${what}.${k}`);
  return out as unknown as T;
};

const SPLIT_A: (keyof SplitData & string)[] = ["elapsedS", "distanceM", "splitTimeS", "splitDistanceM", "intervalRestTimeS", "intervalRestDistanceM", "splitType", "splitNumber"];
const SPLIT_B: (keyof AdditionalSplitData & string)[] = ["elapsedS", "avgStrokeRate", "workHeartRate", "restHeartRate", "avgPaceS", "totalCalories", "avgCalories", "speedMps", "powerW", "avgDragFactor", "splitNumber", "ergMachineType"];
const S39: (keyof WorkoutSummary & string)[] = ["logDate", "logTime", "elapsedHundredths", "elapsedS", "distanceM", "avgStrokeRate", "endingHeartRate", "avgHeartRate", "minHeartRate", "maxHeartRate", "dragFactorAvg", "recoveryHeartRate", "workoutType", "avgPaceS"];
const S3A: (keyof AdditionalSummary1 & string)[] = ["logDate", "logTime", "splitType", "splitSize", "splitCount", "totalCalories", "watts", "totalRestDistanceM", "intervalRestTimeS", "avgCalories"];
const S3C: (keyof AdditionalSummary2 & string)[] = ["logDate", "logTime", "avgPaceS", "gameId", "workoutVerified", "gameScore", "ergMachineType"];

export function validateTelemetryDoc(input: unknown): TelemetryDoc | string {
  try {
    const d = obj(input, "doc");
    if (d.schema !== TELEMETRY_SCHEMA) bad(`doc.schema must be ${TELEMETRY_SCHEMA}`);

    const dv = obj(d.device, "device");
    const device: TelemetryDevice = { name: str(dv.name, "device.name", 80), serial: str(dv.serial, "device.serial", 40), simulated: dv.simulated === true };
    if (typeof dv.model === "string") device.model = dv.model.slice(0, 80);
    if (typeof dv.firmware === "string") device.firmware = dv.firmware.slice(0, 80);
    if (typeof dv.hardware === "string") device.hardware = dv.hardware.slice(0, 80);

    const startedAt = iso(d.startedAt, "startedAt");
    const endedAt = d.endedAt === null || d.endedAt === undefined ? null : iso(d.endedAt, "endedAt");

    const w = obj(d.workout, "workout");
    const workout = { type: int(w.type, "workout.type"), target: int(w.target, "workout.target"), durationType: int(w.durationType, "workout.durationType") };

    const t = obj(d.totals, "totals");
    const totals: TelemetryTotals = {
      meters: int(t.meters, "totals.meters"),
      tenths: int(t.tenths, "totals.tenths"),
      strokes: int(t.strokes, "totals.strokes"),
      avgPaceTenths: intN(t.avgPaceTenths, "totals.avgPaceTenths"),
      avgWatts: intN(t.avgWatts, "totals.avgWatts"),
      avgSpm: intN(t.avgSpm, "totals.avgSpm"),
      avgHr: intN(t.avgHr, "totals.avgHr"),
      dragFactor: intN(t.dragFactor, "totals.dragFactor"),
      calories: intN(t.calories, "totals.calories"),
    };
    if (totals.meters < 0 || totals.tenths < 0 || totals.strokes < 0) bad("totals cannot be negative");

    const strokes = list(d.strokes, "strokes", CAPS.strokes).map((v, i) => {
      const s = obj(v, `strokes[${i}]`);
      const row: TelemetryStroke = {
        n: int(s.n, "stroke.n"),
        elapsedHundredths: int(s.elapsedHundredths, "stroke.elapsedHundredths"),
        distanceTenths: int(s.distanceTenths, "stroke.distanceTenths"),
        watts: int(s.watts, "stroke.watts"),
        spm: int(s.spm, "stroke.spm"),
        hr: intN(s.hr, "stroke.hr"),
        driveLengthCm: int(s.driveLengthCm, "stroke.driveLengthCm"),
        driveTimeHundredths: int(s.driveTimeHundredths, "stroke.driveTimeHundredths"),
        recoveryTimeHundredths: int(s.recoveryTimeHundredths, "stroke.recoveryTimeHundredths"),
        peakForceTenthsLbf: int(s.peakForceTenthsLbf, "stroke.peakForceTenthsLbf"),
        avgForceTenthsLbf: int(s.avgForceTenthsLbf, "stroke.avgForceTenthsLbf"),
        workTenthsJ: int(s.workTenthsJ, "stroke.workTenthsJ"),
      };
      if (s.pace !== undefined && s.pace !== null) row.pace = int(s.pace, "stroke.pace");
      return row;
    });

    const samples = list(d.samples, "samples", CAPS.samples).map((v, i) => {
      const s = obj(v, `samples[${i}]`);
      return {
        elapsedHundredths: int(s.elapsedHundredths, "sample.elapsedHundredths"),
        distanceTenths: int(s.distanceTenths, "sample.distanceTenths"),
        paceHundredths: int(s.paceHundredths, "sample.paceHundredths"),
        avgPaceHundredths: int(s.avgPaceHundredths, "sample.avgPaceHundredths"),
        spm: int(s.spm, "sample.spm"),
        hr: intN(s.hr, "sample.hr"),
        watts: intN(s.watts, "sample.watts"),
        drag: int(s.drag, "sample.drag"),
      };
    });

    const splits = list(d.splits, "splits", CAPS.splits).map((v, i) => {
      const s = obj(v, `splits[${i}]`);
      return {
        n: int(s.n, "split.n"),
        a: packet<SplitData>(s.a, "split.a", SPLIT_A),
        b: packet<AdditionalSplitData>(s.b, "split.b", SPLIT_B, ["workHeartRate", "restHeartRate", "ergMachineType"]),
      };
    });

    const forceCurves = list(d.forceCurves, "forceCurves", CAPS.curves).map((v, i) => {
      const c = obj(v, `forceCurves[${i}]`);
      const points = list(c.points, `forceCurves[${i}].points`, CAPS.curvePoints).map((p, j) => int(p, `forceCurves[${i}].points[${j}]`));
      return { n: int(c.n, "curve.n"), points };
    });

    const sm = obj(d.summary ?? {}, "summary");
    const summary = {
      s39: packet<WorkoutSummary>(sm.s39, "summary.s39", S39, ["endingHeartRate", "avgHeartRate", "minHeartRate", "maxHeartRate", "avgPaceS"]),
      s3a: packet<AdditionalSummary1>(sm.s3a, "summary.s3a", S3A, ["splitType"]),
      s3c: packet<AdditionalSummary2>(sm.s3c, "summary.s3c", S3C),
    };

    const n = obj(d.notes ?? {}, "notes");
    const notes = { packetsRecorded: isInt(n.packetsRecorded) ? n.packetsRecorded : 0, packetsDropped: isInt(n.packetsDropped) ? n.packetsDropped : 0 };

    const doc: TelemetryDoc = { schema: TELEMETRY_SCHEMA, device, startedAt, endedAt, workout, totals, strokes, samples, splits, forceCurves, summary, notes };
    const bytes = JSON.stringify(doc).length;
    if (bytes > CAPS.jsonBytes) bad(`the session is ${(bytes / 1_000_000).toFixed(1)} MB — the cap is ${CAPS.jsonBytes / 1_000_000} MB`);
    return doc;
  } catch (e) {
    if (e instanceof Bad) return e.message;
    return `the document could not be read (${e instanceof Error ? e.message : String(e)})`;
  }
}

/* ---- the scalar columns --------------------------------------------- */

export type TelemetryColumns = {
  device: string;
  simulated: boolean;
  startedAt: Date;
  endedAt: Date | null;
  meters: number;
  tenths: number;
  strokes: number;
  avgPaceTenths: number | null;
  avgWatts: number | null;
  avgSpm: number | null;
  avgHr: number | null;
  dragFactor: number | null;
};

/* The summary is the monitor's own arithmetic and wins; the totals the
 * builder worked out come next; the stroke means are the last resort. */
export function columnsFrom(doc: TelemetryDoc): TelemetryColumns {
  const { summary, totals, strokes } = doc;
  const s39 = summary.s39;
  return {
    device: doc.device.name,
    simulated: doc.device.simulated,
    startedAt: new Date(doc.startedAt),
    endedAt: doc.endedAt ? new Date(doc.endedAt) : null,
    meters: totals.meters,
    tenths: totals.tenths,
    strokes: totals.strokes,
    avgPaceTenths: summaryPaceTenths(summary) ?? totals.avgPaceTenths ?? derivePaceTenths(totals.meters, totals.tenths),
    avgWatts: orNull(summary.s3a?.watts) ?? totals.avgWatts ?? mean(strokes.map((s) => s.watts)),
    avgSpm: orNull(s39?.avgStrokeRate) ?? totals.avgSpm ?? mean(strokes.map((s) => s.spm)),
    avgHr: orNull(s39?.avgHeartRate) ?? totals.avgHr ?? mean(strokes.map((s) => s.hr)),
    dragFactor: orNull(s39?.dragFactorAvg) ?? totals.dragFactor,
  };
}

/* "SIMULATED PM5 · 2,000 m · 7:52.3": what the title box starts with. */
export function defaultTitle(doc: Pick<TelemetryDoc, "device" | "totals">): string {
  return `${doc.device.name} · ${doc.totals.meters.toLocaleString("en-US")} m · ${fmtTenthsClock(doc.totals.tenths)}`;
}

/* The same title straight off the model, without building the arrays —
 * the console reads this on every paint. */
export function quickTitle(model: Pick<TelemetryModel, "device" | "general" | "summary" | "strokes">): string {
  const last = model.strokes.length ? model.strokes[model.strokes.length - 1] : null;
  const meters = Math.floor(model.summary?.distanceM ?? model.general?.distanceM ?? last?.distanceM ?? 0);
  const tenths = Math.round((model.summary?.elapsedHundredths ?? model.general?.elapsedHundredths ?? r(last?.elapsedS, 100)) / 10);
  return defaultTitle({ device: { name: model.device?.name ?? "NO ERG", serial: "", simulated: false }, totals: { meters, tenths } as TelemetryTotals });
}

/* 47523 tenths -> "1:19:12.3"; short pieces without the hour. */
export function fmtTenthsClock(tenths: number): string {
  const t = Math.max(0, Math.round(tenths));
  const h = Math.floor(t / 36000);
  const m = Math.floor((t % 36000) / 600);
  const s = Math.floor((t % 600) / 10);
  const ms = `${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}.${t % 10}`;
  return h ? `${h}:${ms}` : ms;
}

export function cleanTitle(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, CAPS.title) : "";
  return s || fallback;
}
