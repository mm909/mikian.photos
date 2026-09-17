"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  PM5_REQUEST,
  PM5_UUID,
  SAMPLE_RATE,
  WorkoutState,
  WorkoutType,
  createForceCurveAssembler,
  ergMachineTypeWord,
  fmtClock,
  fmtElapsedHundredths,
  fmtForce,
  fmtMeters,
  fmtPace,
  fmtWatts,
  fmtWorkoutTarget,
  intervalTypeWord,
  isNewPiece,
  lbfToNewtons,
  parseAdditionalSplitData,
  parseAdditionalStatus1,
  parseAdditionalStatus2,
  parseAdditionalStrokeData,
  parseAdditionalSummary1,
  parseAdditionalSummary2,
  parseForceCurve,
  parseGeneralStatus,
  parseHeartRateBelt,
  parseMultiplexed,
  parseSplitData,
  parseStrokeData,
  parseWorkoutSummary,
  rowingStateWord,
  serialFromName,
  strokeStateWord,
  workoutStateWord,
  workoutTypeWord,
  type AdditionalSplitData,
  type AdditionalStatus1,
  type AdditionalStatus2,
  type AdditionalSummary1,
  type AdditionalSummary2,
  type BleBluetooth,
  type BleCharacteristic,
  type BleDevice,
  type BleService,
  type ForceCurve,
  type GeneralStatus,
  type HeartRateBelt,
  type MuxPacket,
  type SplitData,
  type WorkoutSummary,
} from "../pm5";
import { Chart, ForceCurveChart, type Series } from "./charts";
import { SIM_DEVICE_NAME, SIM_INFO, createPm5Sim, type Pm5Sim } from "./simulate";

/* THE TELEMETRY CONSOLE (owner, 2026-09-17: a live telemetry screen like a
 * rocket launch). One erg, every number its monitor broadcasts, decoded
 * and charted as it happens. Nothing here touches the race board: no
 * lanes, no POST, no board — that is Pm5Live.tsx, untouched.
 *
 * HOW IT READS THE MONITOR. After connect it subscribes to every rowing
 * characteristic directly (0x31, 32, 33, 35, 36, 37, 38, 39, 3A, 3B, 3D)
 * AND to 0x80. The spec: an ID whose own notification is enabled is not
 * multiplexed, so nothing arrives twice; and 0x3C only ever rides on 0x80.
 * Every notification goes through ONE function, ingest(), whether it came
 * from the radio or from the simulator in simulate.ts — the simulator
 * builds real byte packets, so the whole console can be seen with no
 * monitor in the room.
 *
 * THE MODEL LIVES IN A REF, NOT STATE. At 100 ms three status packets plus
 * strokes and force-curve chunks would be forty setState calls a second;
 * instead every packet mutates the model and asks for one paint on the
 * next animation frame. The recording is bounded: the raw feed keeps 60
 * lines with the hex, the session keeps the DECODED fields of the last
 * 60,000 packets (about 45 minutes at 250 ms, where the monitor sends
 * some 17 a second) and says how many it dropped past that; the head says
 * how long that holds at the rate it is seeing. */

type Link = "idle" | "connecting" | "live" | "dropped";
type Via = "direct" | "mixed" | "mux" | "sim";
type RateKey = keyof typeof SAMPLE_RATE;

const RATE_MS: Record<RateKey, number> = { s1: 1000, ms500: 500, ms250: 250, ms100: 100 };
const RATE_WORD: Record<RateKey, string> = { s1: "1 S", ms500: "500 MS", ms250: "250 MS", ms100: "100 MS" };
const RATE_KEYS: RateKey[] = ["s1", "ms500", "ms250", "ms100"];

const FEED_LINES = 60;
const LOG_LINES = 80;
const REC_CAP = 60_000;
/* When the recording is full the oldest thousand go at once. */
const REC_TRIM = 1_000;
const STROKE_CAP = 6_000;
const SAMPLE_CAP = 12_000;
/* Rolling windows on the charts. */
const WINDOW_S = 120;
const WINDOW_STROKES = 60;
const CONNECT_TIMEOUT_MS = 15_000;

type DeviceInfo = {
  name: string;
  serial: string;
  model: string | null;
  firmware: string | null;
  hardware: string | null;
  manufacturer: string | null;
  machineType: number | null;
  simulated: boolean;
};

type Stroke = {
  n: number;
  elapsedS: number | null;
  distanceM: number | null;
  driveLengthM: number | null;
  driveTimeS: number | null;
  recoveryTimeS: number | null;
  strokeDistanceM: number | null;
  peakLbf: number | null;
  avgLbf: number | null;
  workJ: number | null;
  watts: number | null;
  calPerHr: number | null;
  projTimeS: number | null;
  projDistM: number | null;
  /* From the latest status packet when the stroke landed. */
  paceS: number | null;
  spm: number | null;
  hr: number | null;
};

type Split = { n: number; a: SplitData | null; b: AdditionalSplitData | null };

type Sample = { t: number; pace: number; avgPace: number; spm: number; hr: number | null };

type FeedLine = { at: string; id: number; via: "direct" | "mux"; bytes: number; hex: string; kind: string; decoded: Record<string, unknown> | null };

/* Decoded fields only — the hex lives in the feed. "note" is the page's
 * own marker, at the seam between two pieces. */
type RecPacket = { t: number; id: number; via: "direct" | "mux" | "note"; kind: string; decoded: Record<string, unknown> | null };

type LogLine = { at: string; text: string };

type Model = {
  device: DeviceInfo | null;
  link: Link;
  via: Via | null;
  rate: RateKey;
  general: GeneralStatus | null;
  a1: AdditionalStatus1 | null;
  a2: AdditionalStatus2 | null;
  belt: HeartRateBelt | null;
  summary: WorkoutSummary | null;
  summary1: AdditionalSummary1 | null;
  summary2: AdditionalSummary2 | null;
  strokes: Stroke[];
  splits: Split[];
  samples: Sample[];
  force: ForceCurve | null;
  forceCount: number;
  /* null = not asked yet; false = the characteristic is not on this monitor. */
  forceChar: boolean | null;
  feed: FeedLine[];
  log: LogLine[];
  rec: { device: DeviceInfo | null; startedAt: string | null; packets: RecPacket[]; dropped: number; exported: boolean };
  ppsTimes: number[];
  simRunning: boolean;
};

const freshModel = (): Model => ({
  device: null,
  link: "idle",
  via: null,
  rate: "ms250",
  general: null,
  a1: null,
  a2: null,
  belt: null,
  summary: null,
  summary1: null,
  summary2: null,
  strokes: [],
  splits: [],
  samples: [],
  force: null,
  forceCount: 0,
  forceChar: null,
  feed: [],
  log: [],
  rec: { device: null, startedAt: null, packets: [], dropped: 0, exported: false },
  ppsTimes: [],
  simRunning: false,
});

const clock = () => new Date().toLocaleTimeString("en-US", { hour12: false });
const errText = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));
const hex = (dv: DataView) => {
  const out: string[] = [];
  for (let i = 0; i < dv.byteLength; i++) out.push(dv.getUint8(i).toString(16).padStart(2, "0"));
  return out.join(" ");
};
const idOf = (uuid: string): number => parseInt(uuid.slice(4, 8), 16);
const idWord = (id: number) => `0x${id.toString(16).toUpperCase().padStart(2, "0")}`;

function getBluetooth(): BleBluetooth | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { bluetooth?: BleBluetooth }).bluetooth ?? null;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/* A browser download of a text file: the same Blob-and-anchor the poster
 * studio uses. */
function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "" : String(Math.round(v * 1000) / 1000));

const linkWord: Record<Link, string> = { idle: "NOT CONNECTED", connecting: "CONNECTING…", live: "LIVE", dropped: "DROPPED" };

/* Interval workouts keep the rest tile and the interval count on screen
 * for the whole piece; these are the states where a rest is counting
 * down. */
const INTERVAL_TYPES = new Set<number>([
  WorkoutType.FIXEDTIME_INTERVAL,
  WorkoutType.FIXEDDIST_INTERVAL,
  WorkoutType.VARIABLE_INTERVAL,
  WorkoutType.VARIABLE_UNDEFINEDREST_INTERVAL,
  WorkoutType.FIXEDCALS_INTERVAL,
]);
const RESTING = new Set<number>([WorkoutState.INTERVALREST, WorkoutState.INTERVALRESTENDTOWORKTIME, WorkoutState.INTERVALRESTENDTOWORKDISTANCE]);

/* Into the recording. Full means the oldest thousand go in one splice,
 * not a shift per packet on a 60,000-long array. */
function record(mod: Model, p: RecPacket) {
  if (mod.rec.packets.length >= REC_CAP) {
    mod.rec.packets.splice(0, REC_TRIM);
    mod.rec.dropped += REC_TRIM;
  }
  mod.rec.packets.push(p);
  mod.rec.exported = false;
  if (!mod.rec.startedAt) mod.rec.startedAt = new Date(p.t).toISOString();
}

/* A real recording nobody has exported: what a reload, another erg, the
 * simulator or CLEAR would throw away. */
const unsaved = (mod: Model) => mod.rec.packets.length > 0 && !mod.rec.exported && !mod.rec.device?.simulated;

/* The one question before that happens. */
function confirmDiscard(mod: Model): boolean {
  if (!unsaved(mod)) return true;
  return window.confirm(`Discard ${mod.rec.packets.length.toLocaleString("en-US")} recorded packets from ${mod.rec.device?.name ?? "the erg"}? Export JSON first to keep them.`);
}

/* pm5-strokes-sim-000000000-2026-09-17-10-03-00.csv: the simulator says
 * so in the name. */
function exportName(rec: Model["rec"], what: string, ext: string): string {
  const who = `${rec.device?.simulated ? "sim-" : ""}${(rec.device?.serial ?? "erg").replace(/\W+/g, "")}`;
  const when = (rec.startedAt ?? new Date().toISOString()).slice(0, 19).replace(/[:T]/g, "-");
  return `pm5-${what}-${who}-${when}.${ext}`;
}

/* The rowing characteristics subscribed directly, with the parser each
 * one runs. 0x3C is not here: the spec has it on 0x80 only. */
const DIRECT: { uuid: string; kind: string; parse: (dv: DataView) => Record<string, unknown> | null }[] = [
  { uuid: PM5_UUID.generalStatus, kind: "general", parse: (dv) => parseGeneralStatus(dv) },
  { uuid: PM5_UUID.additionalStatus1, kind: "additional1", parse: (dv) => parseAdditionalStatus1(dv) },
  { uuid: PM5_UUID.additionalStatus2, kind: "additional2", parse: (dv) => parseAdditionalStatus2(dv) },
  { uuid: PM5_UUID.strokeData, kind: "stroke", parse: (dv) => parseStrokeData(dv) },
  { uuid: PM5_UUID.additionalStrokeData, kind: "additionalStroke", parse: (dv) => parseAdditionalStrokeData(dv) },
  { uuid: PM5_UUID.splitData, kind: "split", parse: (dv) => parseSplitData(dv) },
  { uuid: PM5_UUID.additionalSplitData, kind: "additionalSplit", parse: (dv) => parseAdditionalSplitData(dv) },
  { uuid: PM5_UUID.workoutSummary, kind: "summary", parse: (dv) => parseWorkoutSummary(dv) },
  { uuid: PM5_UUID.additionalWorkoutSummary1, kind: "additionalSummary1", parse: (dv) => parseAdditionalSummary1(dv) },
  { uuid: PM5_UUID.heartRateBelt, kind: "heartRateBelt", parse: (dv) => parseHeartRateBelt(dv) },
];

export function Telemetry() {
  const [support, setSupport] = useState<"unknown" | "yes" | "no">("unknown");
  const [btOff, setBtOff] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  useEffect(() => {
    const bt = getBluetooth();
    setSupport(bt ? "yes" : "no");
    if (bt?.getAvailability) bt.getAvailability().then((ok) => setBtOff(!ok), () => undefined);
  }, []);

  const m = useRef<Model>(freshModel());
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const frame = useRef(0);
  const paint = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      rerender();
    });
  }, []);
  const log = useCallback(
    (text: string) => {
      m.current.log = [...m.current.log.slice(-(LOG_LINES - 1)), { at: clock(), text }];
      paint();
    },
    [paint],
  );

  /* ---- the Bluetooth side, in refs ---- */
  const deviceRef = useRef<BleDevice | null>(null);
  const rowingRef = useRef<BleService | null>(null);
  const listeners = useRef<Map<string, (ev: Event) => void>>(new Map());
  const onDropRef = useRef<((ev: Event) => void) | null>(null);
  const autoReconnectTried = useRef(false);
  const assembler = useRef(createForceCurveAssembler());
  /* Short 0x3D packets are logged once, then every fiftieth; a lost chunk
   * is logged when the assembler's dropped count moves. */
  const shortForce = useRef(0);
  const forceDropped = useRef(0);

  /* ---- the simulator, in refs ---- */
  const simRef = useRef<Pm5Sim | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const simLast = useRef(0);

  /* ---- resets ---- */

  /* The live model back to nothing for a new piece on the same erg:
   * strokes, splits, samples, summaries, the force curve. The recording,
   * the feed and the log stay. */
  const resetPiece = useCallback(() => {
    const mod = m.current;
    mod.strokes = [];
    mod.splits = [];
    mod.samples = [];
    mod.summary = null;
    mod.summary1 = null;
    mod.summary2 = null;
    mod.force = null;
    mod.forceCount = 0;
    assembler.current.reset();
  }, []);

  /* Everything but the rate and the log, under a new device: a real erg
   * after the simulator (or after another erg) starts clean, so simulated
   * packets never sit under a real serial. */
  const resetSession = useCallback(
    (device: DeviceInfo) => {
      const mod = m.current;
      resetPiece();
      mod.general = null;
      mod.a1 = null;
      mod.a2 = null;
      mod.belt = null;
      mod.feed = [];
      mod.ppsTimes = [];
      mod.device = device;
      mod.rec = { device, startedAt: null, packets: [], dropped: 0, exported: false };
      shortForce.current = 0;
    },
    [resetPiece],
  );

  /* ---- decoded -> the model ---- */

  const upsertStroke = (n: number): Stroke => {
    const s = m.current.strokes;
    const last = s[s.length - 1];
    if (last && last.n === n) return last;
    const found = s.find((x) => x.n === n);
    if (found) return found;
    const fresh: Stroke = {
      n,
      elapsedS: null,
      distanceM: null,
      driveLengthM: null,
      driveTimeS: null,
      recoveryTimeS: null,
      strokeDistanceM: null,
      peakLbf: null,
      avgLbf: null,
      workJ: null,
      watts: null,
      calPerHr: null,
      projTimeS: null,
      projDistM: null,
      paceS: m.current.a1?.currentPaceS ?? null,
      spm: m.current.a1?.strokeRate ?? null,
      hr: m.current.a1?.heartRate ?? null,
    };
    s.push(fresh);
    if (s.length > STROKE_CAP) s.splice(0, s.length - STROKE_CAP);
    return fresh;
  };

  const upsertSplit = (n: number): Split => {
    const found = m.current.splits.find((x) => x.n === n);
    if (found) return found;
    const fresh: Split = { n, a: null, b: null };
    m.current.splits.push(fresh);
    m.current.splits.sort((p, q) => p.n - q.n);
    return fresh;
  };

  const apply = useCallback(
    (p: MuxPacket) => {
      const mod = m.current;
      /* A second piece on the same erg restarts the stroke count at 1 and
       * elapsed at 0 — a warm-up Just Row, then the real piece. The charts
       * start over; the recording carries on with a marker at the seam. */
      const newPiece = (why: string) => {
        resetPiece();
        /* ingest() recorded the packet that revealed it before applying it,
         * so the marker goes in front of that packet, right on the seam. */
        mod.rec.packets.splice(Math.max(0, mod.rec.packets.length - 1), 0, { t: Date.now(), id: 0, via: "note", kind: "piece", decoded: { why } });
        log(`new piece (${why}) — charts reset, recording continues`);
      };
      const lastN = mod.strokes.length ? mod.strokes[mod.strokes.length - 1].n : 0;
      switch (p.kind) {
        case "general": {
          const prev = mod.general?.workoutState ?? null;
          if (isNewPiece(prev, p.data.workoutState) && (mod.strokes.length || mod.summary)) newPiece("monitor re-armed");
          mod.general = p.data;
          if (prev !== null && prev !== p.data.workoutState) log(`workout state: ${workoutStateWord(prev)} → ${workoutStateWord(p.data.workoutState)}`);
          return;
        }
        case "additional1": {
          mod.a1 = p.data;
          mod.samples.push({ t: p.data.elapsedS, pace: p.data.currentPaceS, avgPace: p.data.averagePaceS, spm: p.data.strokeRate, hr: p.data.heartRate });
          if (mod.samples.length > SAMPLE_CAP) mod.samples.splice(0, mod.samples.length - SAMPLE_CAP);
          return;
        }
        case "additional2":
          mod.a2 = p.data;
          return;
        case "stroke": {
          if (p.data.strokeCount < lastN) newPiece("stroke count restarted");
          const s = upsertStroke(p.data.strokeCount);
          s.elapsedS = p.data.elapsedS;
          s.distanceM = p.data.distanceM;
          s.driveLengthM = p.data.driveLengthM;
          s.driveTimeS = p.data.driveTimeS;
          s.recoveryTimeS = p.data.recoveryTimeS;
          s.strokeDistanceM = p.data.strokeDistanceM;
          s.peakLbf = p.data.peakDriveForceLbf;
          s.avgLbf = p.data.avgDriveForceLbf;
          if (p.data.workPerStrokeJ !== null) s.workJ = p.data.workPerStrokeJ;
          return;
        }
        case "additionalStroke": {
          if (p.data.strokeCount < lastN) newPiece("stroke count restarted");
          const s = upsertStroke(p.data.strokeCount);
          s.watts = p.data.strokePowerW;
          s.calPerHr = p.data.strokeCalories;
          s.projTimeS = p.data.projectedWorkTimeS;
          s.projDistM = p.data.projectedWorkDistanceM;
          if (p.data.workPerStrokeJ !== null) s.workJ = p.data.workPerStrokeJ;
          if (s.elapsedS === null) s.elapsedS = p.data.elapsedS;
          return;
        }
        case "split":
          upsertSplit(p.data.splitNumber).a = p.data;
          log(`split ${p.data.splitNumber}: ${fmtTenthsS(p.data.splitTimeS)} · ${fmtMeters(p.data.splitDistanceM)}`);
          return;
        case "additionalSplit":
          upsertSplit(p.data.splitNumber).b = p.data;
          return;
        case "summary":
          mod.summary = p.data;
          log(`SUMMARY ${fmtElapsedHundredths(p.data.elapsedHundredths)} · ${fmtMeters(p.data.distanceM)}${p.data.recoveryHeartRate ? ` · recovery HR ${p.data.recoveryHeartRate}` : ""}`);
          return;
        case "additionalSummary1":
          mod.summary1 = p.data;
          return;
        case "additionalSummary2":
          mod.summary2 = p.data;
          return;
        case "heartRateBelt":
          mod.belt = p.data;
          log(`belt: manufacturer ${p.data.manufacturerId} · type ${p.data.deviceType} · id ${p.data.beltId}`);
          return;
        case "other":
          log(`0x80 carried an unknown id ${idWord(p.id)}`);
          return;
      }
    },
    [log, resetPiece],
  );

  /* THE ONE DOOR every notification comes through, radio or simulator:
   * decode, feed, record, apply, count, paint. */
  const ingest = useCallback(
    (uuid: string, dv: DataView) => {
      const mod = m.current;
      const now = Date.now();
      let id = idOf(uuid);
      let via: "direct" | "mux" = "direct";
      let kind = "?";
      let decoded: Record<string, unknown> | null = null;
      let packet: MuxPacket | null = null;

      if (uuid === PM5_UUID.multiplexed) {
        via = "mux";
        packet = parseMultiplexed(dv);
        id = dv.byteLength ? dv.getUint8(0) : 0x80;
        if (packet && packet.kind !== "other") {
          kind = packet.kind;
          decoded = packet.data as unknown as Record<string, unknown>;
        } else if (!packet) {
          kind = "short";
          log(`short 0x80 packet (${dv.byteLength} bytes), ignored`);
        } else kind = "other";
      } else if (uuid === PM5_UUID.forceCurve) {
        kind = "forceCurve";
        const chunk = parseForceCurve(dv);
        if (chunk) {
          decoded = chunk as unknown as Record<string, unknown>;
          const curve = assembler.current.push(chunk);
          if (curve) {
            mod.force = curve;
            mod.forceCount++;
          }
          const lost = assembler.current.dropped;
          if (lost !== forceDropped.current) {
            forceDropped.current = lost;
            log(`0x3D: a notification went missing — that stroke's curve dropped (${lost} so far)`);
          }
        } else {
          kind = "short";
          const n = ++shortForce.current;
          if (n === 1 || n % 50 === 0) log(`short 0x3D packet (${dv.byteLength} bytes), ignored${n > 1 ? ` — ${n} so far` : ""}`);
        }
      } else {
        const d = DIRECT.find((x) => x.uuid === uuid);
        if (d) {
          kind = d.kind;
          decoded = d.parse(dv);
          if (decoded) packet = { kind: d.kind, data: decoded } as unknown as MuxPacket;
          else {
            kind = "short";
            log(`short ${idWord(id)} packet (${dv.byteLength} bytes), ignored`);
          }
        }
      }

      mod.feed = [...mod.feed.slice(-(FEED_LINES - 1)), { at: clock(), id, via, bytes: dv.byteLength, hex: hex(dv), kind, decoded }];
      record(mod, { t: now, id, via, kind, decoded });

      mod.ppsTimes.push(now);
      while (mod.ppsTimes.length && mod.ppsTimes[0] < now - 1000) mod.ppsTimes.shift();

      if (packet && packet.kind !== "other") apply(packet);
      paint();
    },
    [apply, log, paint],
  );

  /* ---- the sample rate ---- */
  const writeRate = useCallback(
    async (key: RateKey) => {
      const svc = rowingRef.current;
      if (!svc) return;
      try {
        const ch = await withTimeout(svc.getCharacteristic(PM5_UUID.sampleRate), CONNECT_TIMEOUT_MS, "0x34");
        await withTimeout(ch.writeValue(Uint8Array.from([SAMPLE_RATE[key]])), CONNECT_TIMEOUT_MS, "0x34 write");
        log(`wrote 0x34 = ${SAMPLE_RATE[key]} (status every ${RATE_WORD[key]})`);
      } catch (e) {
        log(`0x34 write REFUSED (${errText(e)}) — the monitor keeps its own rate`);
      }
    },
    [log],
  );

  const pickRate = useCallback(
    (key: RateKey) => {
      m.current.rate = key;
      paint();
      if (simRef.current) {
        simRef.current.setStatusEvery(RATE_MS[key]);
        log(`simulator: status every ${RATE_WORD[key]}`);
        return;
      }
      if (m.current.link === "live") void writeRate(key);
    },
    [log, paint, writeRate],
  );

  /* ---- connecting ---- */

  const readInfo = useCallback(
    async (device: BleDevice, info: DeviceInfo) => {
      const gatt = device.gatt;
      if (!gatt) return;
      let svc: BleService;
      try {
        svc = await withTimeout(gatt.getPrimaryService(PM5_UUID.infoService), CONNECT_TIMEOUT_MS, "info service");
      } catch (e) {
        log(`information service not readable — ${errText(e)}`);
        return;
      }
      const dec = new TextDecoder();
      const str = async (uuid: string, what: string): Promise<string | null> => {
        try {
          const ch = await withTimeout(svc.getCharacteristic(uuid), CONNECT_TIMEOUT_MS, what);
          const v = await withTimeout(ch.readValue(), CONNECT_TIMEOUT_MS, `${what} read`);
          return dec.decode(v).replace(/\0+$/, "").trim() || null;
        } catch {
          return null;
        }
      };
      info.model = await str(PM5_UUID.modelNumber, "model");
      const serial = await str(PM5_UUID.serialNumber, "serial");
      if (serial) info.serial = serial;
      info.hardware = await str(PM5_UUID.hardwareRevision, "hardware");
      info.firmware = await str(PM5_UUID.firmwareRevision, "firmware");
      info.manufacturer = await str(PM5_UUID.manufacturer, "manufacturer");
      try {
        const ch = await withTimeout(svc.getCharacteristic(PM5_UUID.ergMachineType), CONNECT_TIMEOUT_MS, "machine type");
        const v = await withTimeout(ch.readValue(), CONNECT_TIMEOUT_MS, "machine type read");
        info.machineType = v.byteLength ? v.getUint8(0) : null;
      } catch {
        info.machineType = null;
      }
      log(`erg: ${info.model ?? "?"} · serial ${info.serial} · hw ${info.hardware ?? "?"} · fw ${info.firmware ?? "?"}`);
      paint();
    },
    [log, paint],
  );

  const connect = useCallback(async () => {
    const device = deviceRef.current;
    const mod = m.current;
    if (!device || !mod.device) return;
    const gatt = device.gatt;
    if (!gatt) {
      mod.link = "dropped";
      log("the browser gave no GATT server for this device");
      paint();
      return;
    }
    mod.link = "connecting";
    paint();
    log("connecting…");

    const listen = (ch: BleCharacteristic, uuid: string) => {
      const old = listeners.current.get(uuid);
      if (old) ch.removeEventListener("characteristicvaluechanged", old);
      const fn = (ev: Event) => {
        if (deviceRef.current !== device) return;
        const v = (ev.target as BleCharacteristic | null)?.value;
        if (v) ingest(uuid, v);
      };
      listeners.current.set(uuid, fn);
      ch.addEventListener("characteristicvaluechanged", fn);
    };

    try {
      const server = await withTimeout(gatt.connect(), CONNECT_TIMEOUT_MS, "connect");
      await readInfo(device, mod.device);
      const svc = await withTimeout(server.getPrimaryService(PM5_UUID.rowingService), CONNECT_TIMEOUT_MS, "rowing service");
      rowingRef.current = svc;

      let direct = 0;
      const missing: string[] = [];
      for (const d of DIRECT) {
        const tag = idWord(idOf(d.uuid));
        try {
          const ch = await withTimeout(svc.getCharacteristic(d.uuid), CONNECT_TIMEOUT_MS, tag);
          listen(ch, d.uuid);
          await withTimeout(ch.startNotifications(), CONNECT_TIMEOUT_MS, `${tag} notify`);
          direct++;
        } catch (e) {
          missing.push(tag);
          log(`${tag} would not notify — ${errText(e)}`);
        }
      }

      /* The force curve is its own case: not on PM5v1, and never on 0x80,
       * so a missing characteristic is a fact the page states, not a
       * fallback it can take. */
      try {
        const ch = await withTimeout(svc.getCharacteristic(PM5_UUID.forceCurve), CONNECT_TIMEOUT_MS, "0x3D");
        listen(ch, PM5_UUID.forceCurve);
        await withTimeout(ch.startNotifications(), CONNECT_TIMEOUT_MS, "0x3D notify");
        mod.forceChar = true;
        log("0x3D force curve: subscribed");
      } catch (e) {
        mod.forceChar = false;
        log(`0x3D force curve: not on this monitor (${errText(e)})`);
      }

      /* 0x80 always: it carries every ID not enabled directly (nothing
       * doubles) and it is the only road 0x3C comes down. */
      try {
        const mux = await withTimeout(svc.getCharacteristic(PM5_UUID.multiplexed), CONNECT_TIMEOUT_MS, "0x80");
        listen(mux, PM5_UUID.multiplexed);
        await withTimeout(mux.startNotifications(), CONNECT_TIMEOUT_MS, "0x80 notify");
        log(`0x80 subscribed${missing.length ? ` — it carries ${missing.join(", ")}` : ""}`);
      } catch (e) {
        if (missing.length) throw e;
        log(`0x80 would not notify (${errText(e)}) — the direct subscriptions stand`);
      }
      mod.via = direct === DIRECT.length ? "direct" : direct ? "mixed" : "mux";

      await writeRate(mod.rate);

      mod.link = "live";
      autoReconnectTried.current = false;
      log(`LIVE (${mod.via})`);
    } catch (e) {
      mod.link = "dropped";
      log(`connect failed — ${errText(e)}`);
      if (/timed out/.test(errText(e))) log("if the PM5 shows in the laptop's own Bluetooth list, remove it there and try again");
    }
    paint();
  }, [ingest, log, paint, readInfo, writeRate]);

  const stopSim = useCallback(
    (why: string) => {
      if (simTimer.current) clearInterval(simTimer.current);
      simTimer.current = null;
      simRef.current = null;
      m.current.simRunning = false;
      m.current.link = "idle";
      m.current.via = null;
      log(`simulator: ${why}`);
      paint();
    },
    [log, paint],
  );

  const disconnect = useCallback(() => {
    const device = deviceRef.current;
    if (!device) return;
    if (onDropRef.current) device.removeEventListener("gattserverdisconnected", onDropRef.current);
    onDropRef.current = null;
    deviceRef.current = null;
    rowingRef.current = null;
    listeners.current.clear();
    try {
      device.gatt?.disconnect();
    } catch {
      /* already gone */
    }
    m.current.link = "idle";
    m.current.via = null;
    log("disconnected");
    paint();
  }, [log, paint]);

  const pickDevice = useCallback(async () => {
    const bt = getBluetooth();
    if (!bt) return;
    if (!confirmDiscard(m.current)) return;
    if (simRef.current) stopSim("stopped — a real monitor is being connected");
    if (deviceRef.current) disconnect();
    let device: BleDevice;
    try {
      device = await bt.requestDevice(PM5_REQUEST);
    } catch (e) {
      const t = errText(e);
      log(/NotFoundError/.test(t) ? "picker closed without a monitor" : `picker failed — ${t}`);
      return;
    }
    const mod = m.current;
    deviceRef.current = device;
    const info: DeviceInfo = {
      name: device.name ?? "PM5",
      serial: serialFromName(device.name),
      model: null,
      firmware: null,
      hardware: null,
      manufacturer: null,
      machineType: null,
      simulated: false,
    };
    resetSession(info);
    mod.forceChar = null;
    log(`session cleared for the erg · picked ${info.name}`);

    /* Mark dropped, try once on our own, then it is the RECONNECT button. */
    const onDrop = () => {
      if (deviceRef.current !== device) return;
      mod.link = "dropped";
      rowingRef.current = null;
      log("DROPPED");
      paint();
      if (!autoReconnectTried.current) {
        autoReconnectTried.current = true;
        log("one automatic reconnect in 2 s…");
        setTimeout(() => {
          if (deviceRef.current === device && m.current.link === "dropped") void connect();
        }, 2000);
      }
    };
    onDropRef.current = onDrop;
    autoReconnectTried.current = false;
    device.addEventListener("gattserverdisconnected", onDrop);
    await connect();
  }, [connect, disconnect, log, paint, resetSession, stopSim]);

  /* ---- the simulator ---- */

  const startSim = useCallback(() => {
    if (!confirmDiscard(m.current)) return;
    if (deviceRef.current) disconnect();
    const mod = m.current;
    const sim = createPm5Sim({ statusEveryMs: RATE_MS[mod.rate] });
    simRef.current = sim;
    resetSession({
      name: SIM_DEVICE_NAME,
      serial: SIM_INFO.serial,
      model: SIM_INFO.model,
      firmware: SIM_INFO.firmware,
      hardware: SIM_INFO.hardware,
      manufacturer: SIM_INFO.manufacturer,
      machineType: SIM_INFO.machineType,
      simulated: true,
    });
    mod.simRunning = true;
    mod.link = "live";
    mod.via = "sim";
    mod.forceChar = true;
    simLast.current = Date.now();
    log("session cleared for the simulator: a 2,000 m piece, real byte packets through the same parsers");
    /* Real time drives virtual time; the timer runs at the chip's rate. */
    simTimer.current = setInterval(() => {
      const s = simRef.current;
      if (!s) return;
      const now = Date.now();
      const dt = Math.min(2000, now - simLast.current);
      simLast.current = now;
      for (const p of s.step(dt)) ingest(p.uuid, p.dv);
      if (s.done) stopSim("piece over — WORKOUT END sent");
    }, RATE_MS[mod.rate]);
    paint();
  }, [disconnect, ingest, log, paint, resetSession, stopSim]);

  /* Leaving the page takes the sim timer, the paint and the GATT link with
   * it. A link left open here keeps 0x35 to 0x3B off 0x80 for the race
   * board in the same tab, and its listeners keep feeding a model nobody
   * paints. Same teardown as disconnect(), without the log and the paint
   * a gone component has no use for. */
  useEffect(
    () => () => {
      if (simTimer.current) clearInterval(simTimer.current);
      simTimer.current = null;
      simRef.current = null;
      if (frame.current) cancelAnimationFrame(frame.current);
      const device = deviceRef.current;
      if (!device) return;
      if (onDropRef.current) device.removeEventListener("gattserverdisconnected", onDropRef.current);
      onDropRef.current = null;
      deviceRef.current = null;
      rowingRef.current = null;
      listeners.current.clear();
      try {
        device.gatt?.disconnect();
      } catch {
        /* already gone */
      }
    },
    [],
  );

  /* A reload or a swipe back would take the recording with it: while a
   * real one sits here unexported, the browser asks first. */
  useEffect(() => {
    const guard = (ev: BeforeUnloadEvent) => {
      if (!unsaved(m.current)) return;
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  /* ---- the session ---- */

  const clear = useCallback(() => {
    const mod = m.current;
    if (!confirmDiscard(mod)) return;
    resetPiece();
    mod.rec = { device: mod.device, startedAt: null, packets: [], dropped: 0, exported: false };
    mod.feed = [];
    log("session cleared");
  }, [log, resetPiece]);

  const exportJson = useCallback(() => {
    const { rec } = m.current;
    download(exportName(rec, "telemetry", "json"), JSON.stringify({ device: rec.device, startedAt: rec.startedAt, dropped: rec.dropped, packets: rec.packets }, null, 1), "application/json");
    rec.exported = true;
    log(`exported ${rec.packets.length} packets as JSON`);
  }, [log]);

  const exportCsv = useCallback(() => {
    const { rec, strokes } = m.current;
    const head = "stroke,elapsed_s,distance_m,pace_s_per_500m,spm,watts,hr,drive_length_m,drive_time_s,recovery_time_s,peak_force_lbf,avg_force_lbf,work_j";
    const rows = strokes.map((s) =>
      [s.n, s.elapsedS, s.distanceM, s.paceS, s.spm, s.watts, s.hr, s.driveLengthM, s.driveTimeS, s.recoveryTimeS, s.peakLbf, s.avgLbf, s.workJ].map(csvCell).join(","),
    );
    download(exportName(rec, "strokes", "csv"), [head, ...rows].join("\n"), "text/csv");
    log(`exported ${strokes.length} strokes as CSV`);
  }, [log]);

  /* ---- render ---- */

  if (support === "unknown") return null;

  const mod = m.current;
  const bt = support === "yes";
  const g = mod.general;
  const a1 = mod.a1;
  const a2 = mod.a2;
  const lastStroke = mod.strokes[mod.strokes.length - 1] ?? null;
  const pps = mod.ppsTimes.length;
  const busy = mod.link === "connecting";

  /* Chart windows. */
  const tEnd = mod.samples.length ? mod.samples[mod.samples.length - 1].t : 0;
  const win = mod.samples.filter((s) => s.t >= tEnd - WINDOW_S && s.t > 0);
  const strokesWin = mod.strokes.slice(-WINDOW_STROKES);
  let runSum = 0;
  let runN = 0;
  const runningAvg: { x: number; y: number }[] = [];
  for (const s of mod.strokes) {
    if (s.watts === null) continue;
    runSum += s.watts;
    runN++;
    if (s.n >= (strokesWin[0]?.n ?? 0)) runningAvg.push({ x: s.n, y: runSum / runN });
  }
  const per = (pick: (s: Stroke) => number | null): { x: number; y: number }[] =>
    strokesWin.flatMap((s) => {
      const y = pick(s);
      return y === null ? [] : [{ x: s.n, y }];
    });

  const paceSeries: Series[] = [
    { kind: "line", label: "CURRENT", points: win.filter((s) => s.pace > 0).map((s) => ({ x: s.t, y: s.pace })) },
    { kind: "dashed", label: "AVERAGE", points: win.filter((s) => s.avgPace > 0).map((s) => ({ x: s.t, y: s.avgPace })) },
  ];
  const wattsSeries: Series[] = [
    { kind: "bars", label: "PER STROKE", points: per((s) => s.watts) },
    { kind: "dashed", label: "RUNNING AVG", points: runningAvg },
  ];
  const spmSeries: Series[] = [{ kind: "line", label: "SPM", points: win.map((s) => ({ x: s.t, y: s.spm })) }];
  const hrSeries: Series[] = [{ kind: "line", label: "BPM", points: win.flatMap((s) => (s.hr === null ? [] : [{ x: s.t, y: s.hr }])) }];

  const avgPowerW = a2?.averagePowerW ?? a1?.averagePowerW ?? null;
  /* No 0x3D on the monitor, or one that took the subscription and then
   * sent no curve in three strokes. */
  const forceMissing = mod.forceChar === false || (mod.link === "live" && !mod.simRunning && mod.strokes.length >= 3 && mod.forceCount === 0);
  const interval = !!g && INTERVAL_TYPES.has(g.workoutType);
  const resting = !!g && RESTING.has(g.workoutState);
  const showRest = interval || resting || (!!a1 && (a1.restTimeS > 0 || a1.restDistanceM > 0));
  /* How long the recording holds at the packet rate it is seeing. */
  const holdsMin = pps ? Math.round(REC_CAP / pps / 60) : 0;

  return (
    <>
      {!bt && (
        <div className="tm-nope" style={{ marginBottom: 18 }}>
          <b>No Web Bluetooth here</b>
          This browser cannot talk to a PM5. Chrome or Edge on a laptop or Android, or Bluefy on an iPhone. SIMULATE still works.
        </div>
      )}
      {bt && btOff && <p className="tm-copy">The Bluetooth adapter looks switched off — the picker will open empty until it is on.</p>}

      {/* ---- a. THE HEAD ---- */}
      <div className="tm-head">
        <div className="tm-erg">
          <div className="nm">
            {mod.device ? mod.device.name : "NO ERG"}
            {mod.device?.simulated && <span className="tm-sim">SIMULATED</span>}
            <span className={`tm-link ${mod.link}`}>
              {linkWord[mod.link]}
              {mod.link === "live" && mod.via ? ` · ${mod.via.toUpperCase()}` : ""}
            </span>
          </div>
          <dl>
            <dt>Serial</dt>
            <dd className={mod.device ? "" : "q"}>{mod.device?.serial ?? "—"}</dd>
            <dt>Model</dt>
            <dd className={mod.device?.model ? "" : "q"}>
              {mod.device?.model ?? "—"}
              {mod.device?.machineType !== null && mod.device?.machineType !== undefined ? ` · ${ergMachineTypeWord(mod.device.machineType)}` : ""}
            </dd>
            <dt>Firmware</dt>
            <dd className={mod.device?.firmware ? "" : "q"}>{mod.device?.firmware ?? "—"}</dd>
            <dt>Hardware</dt>
            <dd className={mod.device?.hardware ? "" : "q"}>
              {mod.device?.hardware ?? "—"}
              {mod.device?.manufacturer ? ` · ${mod.device.manufacturer}` : ""}
            </dd>
            <dt>Packets</dt>
            <dd>
              {pps} / s · {mod.rec.packets.length.toLocaleString("en-US")} recorded{mod.rec.dropped ? ` · ${mod.rec.dropped.toLocaleString("en-US")} dropped` : ""}
              {holdsMin ? ` · holds ~${holdsMin} min at this rate` : ""}
            </dd>
          </dl>
          <div className="tm-state">
            {g ? workoutStateWord(g.workoutState) : "NO PACKET YET"}
            {g && (
              <span>
                {rowingStateWord(g.rowingState)} · {strokeStateWord(g.strokeState)} · {intervalTypeWord(g.intervalType)}
              </span>
            )}
          </div>
        </div>

        <div className="tm-ctl">
          <div className="tm-btns">
            {mod.link === "dropped" && deviceRef.current ? (
              <button type="button" className="outline-btn" onClick={() => void connect()}>
                Reconnect
              </button>
            ) : (
              <button type="button" className="outline-btn" disabled={!bt || busy || mod.simRunning} onClick={() => void pickDevice()}>
                {busy ? "Connecting…" : "Connect"}
              </button>
            )}
            <button type="button" className="outline-btn" disabled={!deviceRef.current} onClick={disconnect}>
              Disconnect
            </button>
            {mod.simRunning ? (
              <button type="button" className="outline-btn" onClick={() => stopSim("stopped")}>
                Stop
              </button>
            ) : (
              <button type="button" className="outline-btn" disabled={busy || !!deviceRef.current} onClick={startSim}>
                Simulate
              </button>
            )}
          </div>
          <div className="tm-rate">
            <span className="k">Status every</span>
            <div className="tabs" role="group" aria-label="Sample rate">
              {RATE_KEYS.map((k) => (
                <button key={k} type="button" className={mod.rate === k ? "on" : ""} onClick={() => pickRate(k)}>
                  {RATE_WORD[k]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- b. THE TILES ---- */}
      <div className="tm-tiles">
        <Tile
          label="Elapsed"
          value={g ? fmtElapsedHundredths(g.elapsedHundredths) : "—"}
          small={g ? `${workoutTypeWord(g.workoutType)} · ${fmtWorkoutTarget(g.workoutDuration, g.workoutDurationType)}${interval && a2 ? ` · INTERVAL ${a2.intervalCount}` : ""}` : ""}
        />
        <Tile label="Distance" value={g ? Math.floor(g.distanceM).toLocaleString("en-US") : "—"} unit="m" small={g && g.totalWorkDistanceM ? `OF ${fmtMeters(g.totalWorkDistanceM)}` : ""} />
        {showRest && <Tile label="Rest" value={a1 ? fmtClock(a1.restTimeS) : "—"} small={a1 ? `${fmtMeters(a1.restDistanceM)} REST DISTANCE${resting ? " · RESTING NOW" : ""}` : ""} />}
        <Tile label="Pace /500m" value={a1 ? fmtPace(a1.currentPaceS) : "—"} small={a2 ? `SPLIT AVG ${fmtPace(a2.splitAvgPaceS)}` : ""} />
        <Tile label="Avg pace" value={a1 ? fmtPace(a1.averagePaceS) : "—"} small={a2?.lastSplitTimeS ? `LAST SPLIT ${fmtTenthsS(a2.lastSplitTimeS)} · ${fmtMeters(a2.lastSplitDistanceM)}` : ""} />
        <Tile label="Stroke rate" value={a1 ? String(a1.strokeRate) : "—"} unit="spm" small={g ? strokeStateWord(g.strokeState) : ""} />
        <Tile label="Watts" value={lastStroke?.watts !== null && lastStroke?.watts !== undefined ? String(lastStroke.watts) : "—"} unit="W" small={avgPowerW !== null ? `AVG ${fmtWatts(avgPowerW)}${a2 ? ` · SPLIT ${fmtWatts(a2.splitAvgPowerW)}` : ""}` : ""} />
        <Tile label="Heart rate" value={a1?.heartRate !== null && a1?.heartRate !== undefined ? String(a1.heartRate) : ""} unit="bpm" small={mod.belt ? `BELT ${mod.belt.beltId} · MFR ${mod.belt.manufacturerId} · TYPE ${mod.belt.deviceType}` : a1 ? "NO BELT (255)" : ""} />
        <Tile label="Drag factor" value={g ? String(g.dragFactor) : "—"} small={mod.summary ? `PIECE AVG ${mod.summary.dragFactorAvg}` : ""} />
        <Tile label="Speed" value={a1 ? a1.speedMps.toFixed(2) : "—"} unit="m/s" small={a1 ? `${(a1.speedMps * 3.6).toFixed(1)} KM/H` : ""} />
        <Tile
          label="Calories"
          value={a2 ? String(a2.totalCalories) : "—"}
          unit="cal"
          small={[lastStroke?.calPerHr !== null && lastStroke?.calPerHr !== undefined ? `${lastStroke.calPerHr} CAL/HR` : "", a2 ? `SPLIT AVG ${a2.splitAvgCalories}` : ""].filter(Boolean).join(" · ")}
        />
        <Tile label="Stroke count" value={lastStroke ? String(lastStroke.n) : "—"} small={lastStroke?.strokeDistanceM !== null && lastStroke?.strokeDistanceM !== undefined ? `${lastStroke.strokeDistanceM.toFixed(2)} M PER STROKE` : ""} />
        <Tile label="Projected finish" value={lastStroke?.projTimeS !== null && lastStroke?.projTimeS !== undefined ? fmtClock(lastStroke.projTimeS) : "—"} small={lastStroke?.projDistM !== null && lastStroke?.projDistM !== undefined ? `PROJECTED ${fmtMeters(lastStroke.projDistM)}` : ""} />
      </div>

      {/* ---- c. THE CHARTS ---- */}
      <section>
        <div className="sec-head">
          <h2>Charts</h2>
          <span className="mono">LAST {WINDOW_S} S · LAST {WINDOW_STROKES} STROKES</span>
        </div>
        <div className="tm-charts">
          <Chart title="Pace" unit="/500 M" series={paceSeries} xLabel="ELAPSED S" yLabel="FASTER ↑" xFmt={(x) => fmtClock(x)} yFmt={(y) => fmtPace(y)} invertY refY={120} refLabel="2:00" />
          <Chart title="Watts" unit="PER STROKE" series={wattsSeries} xLabel="STROKE" yLabel="W" />
          <Chart title="Stroke rate" unit="SPM" series={spmSeries} xLabel="ELAPSED S" yLabel="SPM" xFmt={(x) => fmtClock(x)} yMin={0} />
          <Chart title="Heart rate" unit="BPM" series={hrSeries} xLabel="ELAPSED S" yLabel="BPM" xFmt={(x) => fmtClock(x)} empty="NO BELT" />
        </div>
        <div className="sec-head" style={{ marginTop: 26 }}>
          <h2>The stroke</h2>
          <span className="mono">0X35 · 0X36 · PER STROKE</span>
        </div>
        <div className="tm-charts four">
          <Chart small title="Drive length" unit="M" series={[{ kind: "line", label: "M", points: per((s) => s.driveLengthM) }]} xLabel="STROKE" yLabel="M" yFmt={(y) => y.toFixed(2)} />
          <Chart
            small
            title="Drive / recovery"
            unit="S"
            series={[
              { kind: "line", label: "DRIVE", points: per((s) => s.driveTimeS) },
              { kind: "dashed", label: "RECOVERY", points: per((s) => s.recoveryTimeS) },
            ]}
            xLabel="STROKE"
            yLabel="S"
            yFmt={(y) => y.toFixed(2)}
            yMin={0}
          />
          <Chart
            small
            title="Drive force"
            unit="LBF"
            series={[
              { kind: "line", label: "PEAK", points: per((s) => s.peakLbf) },
              { kind: "dashed", label: "AVERAGE", points: per((s) => s.avgLbf) },
            ]}
            xLabel="STROKE"
            yLabel="LBF"
            yMin={0}
          />
          <Chart small title="Work per stroke" unit="J" series={[{ kind: "line", label: "J", points: per((s) => s.workJ) }]} xLabel="STROKE" yLabel="J" yMin={0} />
        </div>
      </section>

      {/* ---- d. THE FORCE CURVE ---- */}
      <section>
        <div className="sec-head">
          <h2>Force curve</h2>
          <span className="mono">
            0X3D · LATEST STROKE{lastStroke?.peakLbf !== null && lastStroke?.peakLbf !== undefined ? ` · 0X35 PEAK ${fmtForce(lastStroke.peakLbf)}` : ""}
          </span>
        </div>
        {forceMissing ? (
          <div className="tm-none">
            <b>Force curve not sent by this monitor</b>
            PM5v1 or old firmware — characteristic 0x3D {mod.forceChar === false ? "is not there" : "never fired"}.
          </div>
        ) : (
          <div className="tm-charts">
            <ForceCurveChart curve={mod.force} newtons={lbfToNewtons} />
          </div>
        )}
      </section>

      {/* ---- e. THE SPLITS ---- */}
      <section>
        <div className="sec-head">
          <h2>Splits</h2>
          <span className="mono">0X37 · 0X38</span>
        </div>
        {mod.splits.length === 0 ? (
          <p className="tm-empty">No split yet — they land at each split or interval boundary.</p>
        ) : (
          <div className="tm-scroll">
            <table className="board tm-t">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Distance</th>
                  <th>Avg pace</th>
                  <th>Avg power</th>
                  <th>SPM</th>
                  <th>Avg HR</th>
                  <th>Cal</th>
                  <th>Cal/hr</th>
                  <th>Speed</th>
                  <th>Rest time</th>
                  <th>Rest dist</th>
                  <th>Rest HR</th>
                  <th>Drag</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {mod.splits.map((s) => (
                  <tr key={s.n}>
                    <td className="num">{s.n}</td>
                    <td className="num">{s.a ? fmtTenthsS(s.a.splitTimeS) : "—"}</td>
                    <td className="num">{s.a ? fmtMeters(s.a.splitDistanceM) : "—"}</td>
                    <td className="num">{s.b ? fmtPace(s.b.avgPaceS) : "—"}</td>
                    <td className="num">{s.b ? fmtWatts(s.b.powerW) : "—"}</td>
                    <td className="num">{s.b ? s.b.avgStrokeRate : "—"}</td>
                    <td className="num">{s.b ? (s.b.workHeartRate ?? "—") : "—"}</td>
                    <td className="num">{s.b ? s.b.totalCalories : "—"}</td>
                    <td className="num">{s.b ? s.b.avgCalories : "—"}</td>
                    <td className="num">{s.b ? `${s.b.speedMps.toFixed(2)} m/s` : "—"}</td>
                    <td className="num">{s.a ? fmtClock(s.a.intervalRestTimeS) : "—"}</td>
                    <td className="num">{s.a ? fmtMeters(s.a.intervalRestDistanceM) : "—"}</td>
                    <td className="num">{s.b ? (s.b.restHeartRate ?? "—") : "—"}</td>
                    <td className="num">{s.b ? s.b.avgDragFactor : "—"}</td>
                    <td>{s.a ? intervalTypeWord(s.a.splitType) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- f. THE SUMMARY ---- */}
      <section>
        <div className="sec-head">
          <h2>Summary</h2>
          <span className="mono">0X39 · 0X3A · 0X3C · AT THE LINE, AGAIN AFTER A MINUTE OF REST</span>
        </div>
        {!mod.summary && !mod.summary1 && !mod.summary2 ? (
          <p className="tm-empty">No summary yet — the monitor sends it when the piece ends.</p>
        ) : (
          <div className="tm-sum">
            {mod.summary && (
              <>
                <Kv k="Elapsed" v={fmtElapsedHundredths(mod.summary.elapsedHundredths)} />
                <Kv k="Distance" v={fmtMeters(mod.summary.distanceM)} />
                <Kv k="Avg pace" v={mod.summary.avgPaceS !== null ? fmtPace(mod.summary.avgPaceS) : mod.summary2 ? fmtPace(mod.summary2.avgPaceS) : "—"} />
                <Kv k="Avg SPM" v={String(mod.summary.avgStrokeRate)} />
                <Kv k="HR ending" v={mod.summary.endingHeartRate ?? "—"} />
                <Kv k="HR avg" v={mod.summary.avgHeartRate ?? "—"} />
                <Kv k="HR min" v={mod.summary.minHeartRate ?? "—"} />
                <Kv k="HR max" v={mod.summary.maxHeartRate ?? "—"} />
                <Kv k="Recovery HR" v={mod.summary.recoveryHeartRate || "NOT YET"} />
                <Kv k="Drag avg" v={String(mod.summary.dragFactorAvg)} />
                <Kv k="Workout type" v={workoutTypeWord(mod.summary.workoutType)} />
                <Kv k="Log date / time" v={`${mod.summary.logDate} / ${mod.summary.logTime}`} />
              </>
            )}
            {mod.summary1 && (
              <>
                <Kv k="Avg power" v={fmtWatts(mod.summary1.watts)} />
                <Kv k="Total calories" v={String(mod.summary1.totalCalories)} />
                <Kv k="Avg cal/hr" v={String(mod.summary1.avgCalories)} />
                <Kv k="Split type" v={mod.summary1.splitType !== null ? intervalTypeWord(mod.summary1.splitType) : "—"} />
                <Kv k="Split size" v={String(mod.summary1.splitSize)} />
                <Kv k="Interval count" v={String(mod.summary1.splitCount)} />
                <Kv k="Rest distance" v={fmtMeters(mod.summary1.totalRestDistanceM)} />
                <Kv k="Rest time" v={fmtClock(mod.summary1.intervalRestTimeS)} />
              </>
            )}
            {mod.summary2 && (
              <>
                <Kv k="Avg pace (0x3C)" v={fmtPace(mod.summary2.avgPaceS)} />
                <Kv k="Verified" v={mod.summary2.workoutVerified ? "YES" : "NO"} />
                <Kv k="Game" v={mod.summary2.gameId ? `${mod.summary2.gameId} · SCORE ${mod.summary2.gameScore}` : "NONE"} />
                <Kv k="Machine" v={ergMachineTypeWord(mod.summary2.ergMachineType)} />
              </>
            )}
          </div>
        )}
      </section>

      {/* ---- g. THE FEED and THE LOG ---- */}
      <section>
        <div className="sec-head">
          <h2>Feed</h2>
          <span className="mono">
            <button type="button" className="quiet-btn" onClick={() => setShowFeed((v) => !v)}>
              {showFeed ? "hide raw packets" : "show raw packets"}
            </button>
          </span>
        </div>
        <div className="tm-two">
          {showFeed ? (
            <div className="tm-feed" aria-live="off">
              {mod.feed.length === 0
                ? "NO PACKETS YET"
                : mod.feed
                    .slice()
                    .reverse()
                    .map((f, i) => (
                      <div key={`${f.at}-${i}`}>
                        <span className="ts">{f.at}</span>
                        <span className="id">
                          {idWord(f.id)} {f.via === "mux" ? "via 0x80" : "direct"} · {f.bytes} B
                        </span>
                        <span className="hx">{f.hex}</span>
                        {f.decoded && (
                          <div className="dc">
                            {f.kind}: {Object.entries(f.decoded).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(",")}]` : String(v)}`).join(" · ")}
                          </div>
                        )}
                      </div>
                    ))}
            </div>
          ) : (
            <p className="tm-empty">
              {mod.feed.length ? `${mod.feed.length} packets in the raw feed · last ${idWord(mod.feed[mod.feed.length - 1].id)}` : "The raw feed is hidden."}
            </p>
          )}
          <div className="tm-log">
            {mod.log.length === 0
              ? "Nothing yet."
              : mod.log
                  .slice()
                  .reverse()
                  .map((l, i) => (
                    <div key={`${l.at}-${i}`}>
                      <span className="ts">{l.at}</span>
                      {l.text}
                    </div>
                  ))}
          </div>
        </div>
      </section>

      {/* ---- h. THE SESSION ---- */}
      <section>
        <div className="sec-head">
          <h2>Session</h2>
          <span className="mono">
            {mod.rec.startedAt ? `SINCE ${mod.rec.startedAt.slice(11, 19)} UTC` : "NOTHING RECORDED"} · {mod.rec.packets.length.toLocaleString("en-US")} PACKETS · {mod.strokes.length} STROKES
            {mod.rec.device?.simulated ? " · SIMULATED" : ""}
          </span>
        </div>
        <div className="tm-btns">
          <button type="button" className="outline-btn" disabled={!mod.rec.packets.length} onClick={exportJson}>
            Export JSON
          </button>
          <button type="button" className="outline-btn" disabled={!mod.strokes.length} onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" className="outline-btn" disabled={!mod.rec.packets.length && !mod.strokes.length} onClick={clear}>
            Clear
          </button>
        </div>
      </section>
    </>
  );
}

/* 0.1 s split times -> "1:58.4". */
function fmtTenthsS(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const t = Math.round(seconds * 10);
  const mm = Math.floor(t / 600);
  const ss = Math.floor((t % 600) / 10);
  return `${mm}:${String(ss).padStart(2, "0")}.${t % 10}`;
}

function Tile({ label, value, unit, small }: { label: string; value: string; unit?: string; small?: string }) {
  return (
    <div className="tm-tile">
      <div className="l">{label}</div>
      <div className="v">
        {value === "" ? " " : value}
        {unit && value !== "" && <span className="u">{unit}</span>}
      </div>
      <div className="s">{small || " "}</div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}
