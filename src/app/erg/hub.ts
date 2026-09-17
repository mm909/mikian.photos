import {
  PM5_REQUEST,
  PM5_UUID,
  SAMPLE_RATE,
  createForceCurveAssembler,
  fmtElapsedHundredths,
  fmtMeters,
  isNewPiece,
  parseAdditionalSplitData,
  parseAdditionalStatus1,
  parseAdditionalStatus2,
  parseAdditionalStrokeData,
  parseAdditionalSummary1,
  parseForceCurve,
  parseGeneralStatus,
  parseHeartRateBelt,
  parseMultiplexed,
  parseSplitData,
  parseStrokeData,
  parseWorkoutSummary,
  serialFromName,
  workoutStateWord,
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
  type WorkoutSummary,
} from "@/lib/pm5/pm5";
import { SIM_DEVICE_NAME, SIM_INFO, createPm5Sim } from "@/lib/pm5/simulate";
import {
  buildTelemetryDoc,
  fitTelemetryDoc,
  quickTitle,
  type TelemetryCurve,
  type TelemetryDoc,
  type TelemetryModel,
  type TelemetrySavedRow,
  type TelemetrySplit,
} from "@/lib/pm5/session";

/* THE HUB (owner, 2026-09-17: "a telemetry screen where I can connect
 * multiple ergs at the same time — add an erg, add it to a list, click on
 * that erg and see the telemetry for that person, go back and add another
 * one. Save them independently of each other").
 *
 * This is a MODULE-LEVEL SINGLETON, not React state, and that is the whole
 * point: a GATT link belongs to the tab, not to a component. The monitors
 * list and an erg page are two views of this one object, so walking from
 * the list into an erg and back drops nothing — no reconnect, no lost
 * strokes, no second pairing gesture. Only a full page load (or leaving
 * the site) tears the links down.
 *
 * ONE ERG = ONE SLOT. Each slot owns its own device, its own GATT link and
 * listeners, its own decoded model, its own recording and its own SAVE.
 * Nothing is shared between slots; two ergs mid-piece are two independent
 * recordings that save to two independent rows.
 *
 * THREE SOURCES, ONE DOOR. A slot is fed by the radio (live), by the
 * simulator, or by PLAYBACK of a saved row. All three hand the same thing
 * to ingest(): a characteristic uuid and the bytes the monitor would have
 * sent. So every chart, every tile and every saved document is built by
 * exactly the same code whether an erg is in the room or not. The playback
 * driver itself is not in this file — startSource() is the seam it plugs
 * into.
 *
 * PAINTING. At 100 ms a single erg sends about seventeen packets a second
 * and eight of them would be forty renders; instead every packet mutates
 * plain objects and asks for ONE notification on the next animation frame,
 * however many ergs moved.
 *
 * HEART RATE is decoded and recorded as it always was (0x3B, and the HR
 * byte on 0x32) but no surface shows it — the owner has no belt this
 * month. The numbers are in the saved document for the day one turns up. */

/* ---- the shapes a view reads ----------------------------------------- */

export type ErgLink = "idle" | "connecting" | "live" | "dropped";
/* How the numbers arrive: every characteristic subscribed directly, some,
 * none (0x80 carries the rest), or not a radio at all. */
export type ErgVia = "direct" | "mixed" | "mux" | "sim" | "playback";
export type ErgSource = "live" | "sim" | "playback";
export type RateKey = keyof typeof SAMPLE_RATE;

/* THE SEAM a non-radio source plugs into: hand the hub something that can
 * be asked for the packets due in a slice of time. The simulator is one;
 * a playback of a saved row is the other, and it is the next package that
 * writes it. */
export type SourceDriver = {
  /* The packets due in dtMs of its own time. */
  step(dtMs: number): { uuid: string; dv: DataView }[];
  /* True when there is nothing left to send. */
  done: boolean;
  /* What the card says it is doing: SIMULATED 2,000 M, or a saved title. */
  label: string;
};

export type ErgDevice = {
  name: string;
  serial: string;
  model: string | null;
  firmware: string | null;
  hardware: string | null;
  manufacturer: string | null;
  machineType: number | null;
  simulated: boolean;
};

export type ErgStroke = {
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

export type ErgSample = { t: number; dist: number; pace: number; avgPace: number; spm: number; hr: number | null; watts: number | null; drag: number };

export type ErgFeedLine = { at: string; id: number; via: "direct" | "mux"; bytes: number; hex: string; kind: string; decoded: Record<string, unknown> | null };

/* Decoded fields only — the hex lives in the feed. "note" is the hub's own
 * marker, at the seam between two pieces. */
export type ErgRecPacket = { t: number; id: number; via: "direct" | "mux" | "note"; kind: string; decoded: Record<string, unknown> | null };

export type ErgLogLine = { at: string; text: string };

export type ErgModel = {
  general: GeneralStatus | null;
  a1: AdditionalStatus1 | null;
  a2: AdditionalStatus2 | null;
  belt: HeartRateBelt | null;
  summary: WorkoutSummary | null;
  summary1: AdditionalSummary1 | null;
  summary2: AdditionalSummary2 | null;
  strokes: ErgStroke[];
  splits: TelemetrySplit[];
  samples: ErgSample[];
  force: ForceCurve | null;
  forceCount: number;
  forces: TelemetryCurve[];
  /* null = not asked yet; false = the characteristic is not on this
   * monitor (PM5v1). */
  forceChar: boolean | null;
  feed: ErgFeedLine[];
  log: ErgLogLine[];
};

export type ErgRec = {
  startedAt: string | null;
  /* The seam of the latest piece on this erg: where the saved document
   * starts, so a warm-up and the real piece are two rows. */
  pieceStartedAt: string | null;
  packets: ErgRecPacket[];
  dropped: number;
  /* The elapsed second the tick and stroke buffers now START at, once one
   * of them has filled and begun dropping its head — null while the whole
   * piece is still in memory. A long row does not silently save a
   * document that begins part-way in: the number travels into the saved
   * notes and the review prints it. */
  headTrimmedFromS: number | null;
  /* Per erg, and only per erg: one erg saving says nothing about another. */
  saved: boolean;
};

export type ErgSaveState = {
  busy: boolean;
  /* SAVED · 10:04, or the line the route refused with. */
  note: { ok: boolean; text: string } | null;
  savedId: string | null;
  /* What the title box on this card holds; null = the piece title. */
  title: string | null;
};

export type Erg = {
  /* The Bluetooth device id for a real erg, a made-up one otherwise.
   * Stable for the life of the tab: it is what an erg page is addressed
   * by. */
  id: string;
  name: string;
  serial: string;
  device: ErgDevice;
  source: ErgSource;
  link: ErgLink;
  via: ErgVia | null;
  rate: RateKey;
  /* Packets a second, over the last second. */
  pps: number;
  model: ErgModel;
  rec: ErgRec;
  save: ErgSaveState;
  /* What a non-radio source is playing, when one is. */
  sourceLabel: string | null;
  /* A saved row read back into this slot, or null while it is its own. */
  loaded: { id: string; title: string } | null;
  /* THE GOAL (owner, 2026-09-17: "infer the goal distance to be a five K
   * always, but allow us to change it"). What the expected finish is
   * measured against, whatever the monitor's own workout says. It starts
   * at five thousand on every slot and lives as long as the tab does. */
  goalM: number;
  addedAt: number;
};

/* ---- the numbers this file runs on ----------------------------------- */

export const RATE_MS: Record<RateKey, number> = { s1: 1000, ms500: 500, ms250: 250, ms100: 100 };
export const RATE_WORD: Record<RateKey, string> = { s1: "1 S", ms500: "500 MS", ms250: "250 MS", ms100: "100 MS" };
export const RATE_KEYS: RateKey[] = ["s1", "ms500", "ms250", "ms100"];

export const LINK_WORD: Record<ErgLink, string> = { idle: "NOT CONNECTED", connecting: "CONNECTING…", live: "LIVE", dropped: "DROPPED" };

/* THE GOAL every slot starts at (owner, 2026-09-17: he rows fives and
 * wants the number without setting anything up). The monitor may be set to
 * anything at all — a just row, a 6 k, a timed twenty — and the expected
 * finish is still read against this until somebody changes it. */
export const DEFAULT_GOAL_M = 5000;
export const GOAL_MIN_M = 100;
export const GOAL_MAX_M = 100_000;

const FEED_LINES = 60;
const LOG_LINES = 80;
const REC_CAP = 60_000;
/* When the recording is full the oldest thousand go at once, not one
 * shift per packet on a 60,000-long array. */
const REC_TRIM = 1_000;
const STROKE_CAP = 6_000;
const SAMPLE_CAP = 12_000;
/* Force curves kept for SAVE, one per stroke; a chart draws only the last. */
const FORCE_CAP = 2_000;
const CONNECT_TIMEOUT_MS = 15_000;
const SAVE_TIMEOUT_MS = 60_000;

export const ERG_API = "/api/erg/sessions";

/* ---- small helpers ---------------------------------------------------- */

const clock = () => new Date().toLocaleTimeString("en-US", { hour12: false });
const errText = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));
const idOf = (uuid: string): number => parseInt(uuid.slice(4, 8), 16);
const idWord = (id: number) => `0x${id.toString(16).toUpperCase().padStart(2, "0")}`;
const hex = (dv: DataView) => {
  const out: string[] = [];
  for (let i = 0; i < dv.byteLength; i++) out.push(dv.getUint8(i).toString(16).padStart(2, "0"));
  return out.join(" ");
};

/* navigator.bluetooth through a cast — the DOM lib here has no Bluetooth
 * types (see the note at the foot of pm5.ts). */
function getBluetooth(): BleBluetooth | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { bluetooth?: BleBluetooth }).bluetooth ?? null;
}

export function bluetoothSupported(): boolean {
  return getBluetooth() !== null;
}

/* Whether the adapter itself is on, when the browser will say. A laptop
 * with Bluetooth switched off otherwise looks fine until the picker opens
 * empty. */
export async function bluetoothAvailable(): Promise<boolean> {
  const bt = getBluetooth();
  if (!bt?.getAvailability) return true;
  try {
    return await bt.getAvailability();
  } catch {
    return true;
  }
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

/* The route's line, or the status when it sent none. */
async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: unknown };
    if (typeof j.error === "string" && j.error) return j.error;
  } catch {
    /* not JSON */
  }
  return res.status === 401 ? "Sign in with Google first." : `The server answered ${res.status}.`;
}

/* The rowing characteristics subscribed directly, with the parser each one
 * runs. 0x3C is not here: the spec has it on 0x80 only. */
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

/* The packets that make a saved recording stale again. A PM5 keeps sending
 * status ticks for as long as it is awake, so counting those would wipe the
 * SAVED word one tick after a save and nag for a duplicate. Something a
 * reader would miss — a stroke, a split, a summary, a new piece — is what
 * counts. */
const KEEPS_STALE = new Set(["stroke", "additionalStroke", "split", "additionalSplit", "summary", "additionalSummary1", "additionalSummary2", "piece"]);

/* ---- the private side of a slot -------------------------------------- */

type Wire = {
  ble: BleDevice | null;
  rowing: BleService | null;
  listeners: Map<string, (ev: Event) => void>;
  onDrop: ((ev: Event) => void) | null;
  autoReconnectTried: boolean;
  assembler: ReturnType<typeof createForceCurveAssembler>;
  shortForce: number;
  forceDropped: number;
  /* A non-radio source and the timer that steps it. */
  driver: SourceDriver | null;
  timer: ReturnType<typeof setInterval> | null;
  lastStep: number;
  ppsTimes: number[];
};

const ergs = new Map<string, Erg>();
const wires = new Map<string, Wire>();
const listeners = new Set<(list: Erg[]) => void>();
let pending = false;

const freshModel = (): ErgModel => ({
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
  forces: [],
  forceChar: null,
  feed: [],
  log: [],
});

const freshRec = (): ErgRec => ({ startedAt: null, pieceStartedAt: null, packets: [], dropped: 0, headTrimmedFromS: null, saved: false });

const freshWire = (): Wire => ({
  ble: null,
  rowing: null,
  listeners: new Map(),
  onDrop: null,
  autoReconnectTried: false,
  assembler: createForceCurveAssembler(),
  shortForce: 0,
  forceDropped: 0,
  driver: null,
  timer: null,
  lastStep: 0,
  ppsTimes: [],
});

/* ---- subscribing ------------------------------------------------------ */

/* Every view calls this and keeps what it is handed in state. The hub
 * notifies at most once an animation frame, however many ergs moved;
 * outside a browser (or between frames) it falls back to a timeout so a
 * notification is never simply lost. */
export function subscribe(fn: (list: Erg[]) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function listErgs(): Erg[] {
  return Array.from(ergs.values()).sort((a, b) => a.addedAt - b.addedAt);
}

export function getErg(id: string): Erg | null {
  return ergs.get(id) ?? null;
}

function emit() {
  const list = listErgs();
  for (const fn of Array.from(listeners)) {
    try {
      fn(list);
    } catch (err) {
      console.error("erg hub: a subscriber threw", err);
    }
  }
}

function paint() {
  if (pending) return;
  pending = true;
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      pending = false;
      emit();
    });
  } else {
    setTimeout(() => {
      pending = false;
      emit();
    }, 16);
  }
}

function log(e: Erg, text: string) {
  e.model.log = [...e.model.log.slice(-(LOG_LINES - 1)), { at: clock(), text }];
  paint();
}

/* ---- the recording ---------------------------------------------------- */

function record(e: Erg, p: ErgRecPacket) {
  const rec = e.rec;
  if (rec.packets.length >= REC_CAP) {
    rec.packets.splice(0, REC_TRIM);
    rec.dropped += REC_TRIM;
  }
  rec.packets.push(p);
  if (KEEPS_STALE.has(p.kind)) rec.saved = false;
  if (!rec.startedAt) rec.startedAt = new Date(p.t).toISOString();
}

/* THE HEAD OF THE PIECE IS GOING. The tick and stroke buffers have a
 * ceiling — past it the oldest go, which on a long row means the charts
 * and the saved document start part-way in. That is a fact about the
 * recording, so it is logged once and carried on the record rather than
 * happening quietly. */
function noteHeadTrim(e: Erg, firstKeptS: number | null, what: string) {
  const first = e.rec.headTrimmedFromS === null;
  e.rec.headTrimmedFromS = firstKeptS !== null && Number.isFinite(firstKeptS) ? firstKeptS : 0;
  if (first) log(e, `the ${what} buffer is full — the head of the piece is being dropped, so the charts and a save now start part-way in`);
}

/* A real recording nobody has saved: what a reload, a REMOVE or a CLEAR
 * would throw away. A PLAYBACK never counts — it is a row that is already
 * in the database, it has no SAVE button, and nagging about losing it
 * would be asking for something the screen refuses to do. */
export function ergUnsaved(e: Erg): boolean {
  if (e.source === "playback") return false;
  return e.rec.packets.length > 0 && !e.rec.saved && !e.device.simulated;
}

/* For the one beforeunload guard a view puts on the window: is anything in
 * the whole hub worth asking about. */
export function anyUnsaved(): boolean {
  for (const e of ergs.values()) if (ergUnsaved(e)) return true;
  return false;
}

/* ---- decoded -> the model --------------------------------------------- */

function upsertStroke(e: Erg, n: number): ErgStroke {
  const s = e.model.strokes;
  const last = s[s.length - 1];
  if (last && last.n === n) return last;
  const found = s.find((x) => x.n === n);
  if (found) return found;
  const fresh: ErgStroke = {
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
    paceS: e.model.a1?.currentPaceS ?? null,
    spm: e.model.a1?.strokeRate ?? null,
    hr: e.model.a1?.heartRate ?? null,
  };
  s.push(fresh);
  if (s.length > STROKE_CAP) {
    s.splice(0, s.length - STROKE_CAP);
    noteHeadTrim(e, s[0]?.elapsedS ?? null, "stroke");
  }
  return fresh;
}

function upsertSplit(e: Erg, n: number): TelemetrySplit {
  const found = e.model.splits.find((x) => x.n === n);
  if (found) return found;
  const fresh: TelemetrySplit = { n, a: null, b: null };
  e.model.splits.push(fresh);
  e.model.splits.sort((p, q) => p.n - q.n);
  return fresh;
}

/* The live model back to nothing for a NEW PIECE on the same erg: strokes,
 * splits, samples, summaries, the force curve. The recording, the feed and
 * the log carry on. */
function resetPiece(e: Erg) {
  const m = e.model;
  m.strokes = [];
  m.splits = [];
  m.samples = [];
  m.summary = null;
  m.summary1 = null;
  m.summary2 = null;
  m.force = null;
  m.forceCount = 0;
  m.forces = [];
  /* The buffers this just emptied are the ones the head-trim flag talks
   * about, so a second piece on the same erg starts whole again. */
  e.rec.headTrimmedFromS = null;
  wires.get(e.id)?.assembler.reset();
}

function apply(e: Erg, p: MuxPacket) {
  const m = e.model;
  /* A second piece on the same erg restarts the stroke count at 1 and
   * elapsed at 0 — a warm-up Just Row, then the real piece. The charts
   * start over; the recording carries on with a marker at the seam, and
   * the saved document starts there. */
  const newPiece = (why: string) => {
    resetPiece(e);
    /* ingest() recorded the packet that revealed it before applying it, so
     * the marker goes in front of that packet, right on the seam. */
    e.rec.packets.splice(Math.max(0, e.rec.packets.length - 1), 0, { t: Date.now(), id: 0, via: "note", kind: "piece", decoded: { why } });
    e.rec.pieceStartedAt = new Date().toISOString();
    e.rec.saved = false;
    e.save.savedId = null;
    e.save.title = null;
    log(e, `new piece (${why}) — charts reset, recording continues`);
  };
  const lastN = m.strokes.length ? m.strokes[m.strokes.length - 1].n : 0;

  switch (p.kind) {
    case "general": {
      const prev = m.general?.workoutState ?? null;
      if (isNewPiece(prev, p.data.workoutState) && (m.strokes.length || m.summary)) newPiece("monitor re-armed");
      m.general = p.data;
      if (prev !== null && prev !== p.data.workoutState) log(e, `workout state: ${workoutStateWord(prev)} → ${workoutStateWord(p.data.workoutState)}`);
      return;
    }
    case "additional1": {
      m.a1 = p.data;
      const ls = m.strokes[m.strokes.length - 1];
      m.samples.push({
        t: p.data.elapsedS,
        dist: m.general?.distanceM ?? 0,
        pace: p.data.currentPaceS,
        avgPace: p.data.averagePaceS,
        spm: p.data.strokeRate,
        hr: p.data.heartRate,
        watts: ls?.watts ?? null,
        drag: m.general?.dragFactor ?? 0,
      });
      if (m.samples.length > SAMPLE_CAP) {
        m.samples.splice(0, m.samples.length - SAMPLE_CAP);
        noteHeadTrim(e, m.samples[0]?.t ?? null, "tick");
      }
      return;
    }
    case "additional2":
      m.a2 = p.data;
      return;
    case "stroke": {
      if (p.data.strokeCount < lastN) newPiece("stroke count restarted");
      const s = upsertStroke(e, p.data.strokeCount);
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
      const s = upsertStroke(e, p.data.strokeCount);
      s.watts = p.data.strokePowerW;
      s.calPerHr = p.data.strokeCalories;
      s.projTimeS = p.data.projectedWorkTimeS;
      s.projDistM = p.data.projectedWorkDistanceM;
      if (p.data.workPerStrokeJ !== null) s.workJ = p.data.workPerStrokeJ;
      if (s.elapsedS === null) s.elapsedS = p.data.elapsedS;
      return;
    }
    case "split":
      upsertSplit(e, p.data.splitNumber).a = p.data;
      log(e, `split ${p.data.splitNumber}: ${fmtMeters(p.data.splitDistanceM)}`);
      return;
    case "additionalSplit":
      upsertSplit(e, p.data.splitNumber).b = p.data;
      return;
    case "summary":
      m.summary = p.data;
      log(e, `SUMMARY ${fmtElapsedHundredths(p.data.elapsedHundredths)} · ${fmtMeters(p.data.distanceM)}`);
      return;
    case "additionalSummary1":
      m.summary1 = p.data;
      return;
    case "additionalSummary2":
      m.summary2 = p.data;
      return;
    case "heartRateBelt":
      /* Recorded, never shown (owner, 2026-09-17: no belt this month). */
      m.belt = p.data;
      return;
    case "other":
      log(e, `0x80 carried an unknown id ${idWord(p.id)}`);
      return;
  }
}

/* THE ONE DOOR every packet comes through — radio, simulator or playback:
 * decode, feed, record, apply, count, paint. */
function ingest(e: Erg, uuid: string, dv: DataView) {
  const w = wires.get(e.id);
  if (!w) return;
  const m = e.model;
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
      log(e, `short 0x80 packet (${dv.byteLength} bytes), ignored`);
    } else kind = "other";
  } else if (uuid === PM5_UUID.forceCurve) {
    kind = "forceCurve";
    const chunk = parseForceCurve(dv);
    if (chunk) {
      decoded = chunk as unknown as Record<string, unknown>;
      const curve = w.assembler.push(chunk);
      if (curve) {
        m.force = curve;
        m.forceCount++;
        /* Tagged with the stroke count the hub had seen when the last chunk
         * landed: on the wire the curve follows its 0x35. */
        m.forces.push({ n: m.strokes.length ? m.strokes[m.strokes.length - 1].n : 0, points: curve.pointsLbf });
        if (m.forces.length > FORCE_CAP) m.forces.splice(0, m.forces.length - FORCE_CAP);
      }
      const lost = w.assembler.dropped;
      if (lost !== w.forceDropped) {
        w.forceDropped = lost;
        log(e, `0x3D: a notification went missing — that stroke curve dropped (${lost} so far)`);
      }
    } else {
      kind = "short";
      const n = ++w.shortForce;
      if (n === 1 || n % 50 === 0) log(e, `short 0x3D packet (${dv.byteLength} bytes), ignored${n > 1 ? ` — ${n} so far` : ""}`);
    }
  } else {
    const d = DIRECT.find((x) => x.uuid === uuid);
    if (d) {
      kind = d.kind;
      decoded = d.parse(dv);
      if (decoded) packet = { kind: d.kind, data: decoded } as unknown as MuxPacket;
      else {
        kind = "short";
        log(e, `short ${idWord(id)} packet (${dv.byteLength} bytes), ignored`);
      }
    }
  }

  m.feed = [...m.feed.slice(-(FEED_LINES - 1)), { at: clock(), id, via, bytes: dv.byteLength, hex: hex(dv), kind, decoded }];
  record(e, { t: now, id, via, kind, decoded });

  w.ppsTimes.push(now);
  while (w.ppsTimes.length && w.ppsTimes[0] < now - 1000) w.ppsTimes.shift();
  e.pps = w.ppsTimes.length;

  if (packet && packet.kind !== "other") apply(e, packet);
  paint();
}

/* ---- adding a slot ---------------------------------------------------- */

function makeErg(args: { id: string; device: ErgDevice; source: ErgSource; rate?: RateKey }): Erg {
  const e: Erg = {
    id: args.id,
    name: args.device.name,
    serial: args.device.serial,
    device: args.device,
    source: args.source,
    link: "idle",
    via: null,
    rate: args.rate ?? "ms250",
    pps: 0,
    model: freshModel(),
    rec: freshRec(),
    save: { busy: false, note: null, savedId: null, title: null },
    sourceLabel: null,
    loaded: null,
    goalM: DEFAULT_GOAL_M,
    addedAt: Date.now() + ergs.size,
  };
  ergs.set(e.id, e);
  wires.set(e.id, freshWire());
  return e;
}

/* ADD AN ERG: one pairing gesture, one slot. The browser insists the
 * picker opens from a click, so this is called straight off the button and
 * nothing else in the hub ever calls requestDevice.
 *
 * Returns the new slot id, or a line to print — a closed picker is not an
 * error worth a red box, so it comes back as { cancelled: true }. */
export async function addErg(): Promise<{ id: string } | { error: string } | { cancelled: true }> {
  const bt = getBluetooth();
  if (!bt) return { error: "This browser has no Web Bluetooth. Chrome or Edge on a laptop or Android, or Bluefy on an iPhone." };

  let ble: BleDevice;
  try {
    ble = await bt.requestDevice(PM5_REQUEST);
  } catch (err) {
    const t = errText(err);
    if (/NotFoundError/.test(t)) return { cancelled: true };
    return { error: `The picker failed — ${t}` };
  }

  /* The same monitor twice is the same slot: pick it again after a drop
   * and it reconnects rather than growing a duplicate card. */
  const existing = ergs.get(ble.id);
  if (existing) {
    const w = wires.get(ble.id);
    if (w) {
      w.ble = ble;
      w.autoReconnectTried = false;
    }
    await connect(existing);
    return { id: existing.id };
  }

  const device: ErgDevice = {
    name: ble.name ?? "PM5",
    serial: serialFromName(ble.name),
    model: null,
    firmware: null,
    hardware: null,
    manufacturer: null,
    machineType: null,
    simulated: false,
  };
  const e = makeErg({ id: ble.id, device, source: "live" });
  const w = wires.get(e.id);
  if (w) w.ble = ble;
  log(e, `picked ${device.name}`);
  paint();
  await connect(e);
  return { id: e.id };
}

/* A slot fed by something other than a radio. The simulator and playback
 * both come through here, so a simulated erg and a played-back one are
 * ordinary cards that click through to the same screens. */
export function addSourceErg(args: { source: "sim" | "playback"; driver: SourceDriver; device: Partial<ErgDevice> & { name: string }; rate?: RateKey }): string {
  const device: ErgDevice = {
    name: args.device.name,
    serial: args.device.serial ?? "",
    model: args.device.model ?? null,
    firmware: args.device.firmware ?? null,
    hardware: args.device.hardware ?? null,
    manufacturer: args.device.manufacturer ?? null,
    machineType: args.device.machineType ?? null,
    simulated: args.device.simulated ?? args.source === "sim",
  };
  const e = makeErg({ id: `${args.source}-${Math.random().toString(36).slice(2, 8)}`, device, source: args.source, rate: args.rate });
  startSource(e.id, args.driver);
  return e.id;
}

/* SIMULATE: a 2,000 m piece of real byte packets, so the whole product can
 * be seen with no monitor in the room. */
export function addSimErg(opts: { distanceM?: number; seed?: number } = {}): string {
  const rate: RateKey = "ms250";
  const sim = createPm5Sim({ ...opts, statusEveryMs: RATE_MS[rate] });
  const meters = opts.distanceM ?? 2000;
  const driver: SourceDriver = {
    step: (dtMs) => sim.step(dtMs),
    get done() {
      return sim.done;
    },
    label: `SIMULATED ${meters.toLocaleString("en-US")} M`,
  };
  return addSourceErg({
    source: "sim",
    driver,
    rate,
    device: {
      name: SIM_DEVICE_NAME,
      serial: SIM_INFO.serial,
      model: SIM_INFO.model,
      firmware: SIM_INFO.firmware,
      hardware: SIM_INFO.hardware,
      manufacturer: SIM_INFO.manufacturer,
      machineType: SIM_INFO.machineType,
      simulated: true,
    },
  });
}

/* THE SOURCE SEAM. Point an existing slot at a driver — the simulator, or
 * a playback of a saved row built by whatever page owns the picker. The
 * driver is stepped by real time at the slot rate; when it says it is
 * done the slot goes quiet and keeps everything it collected. */
export function startSource(id: string, driver: SourceDriver) {
  const e = ergs.get(id);
  const w = wires.get(id);
  if (!e || !w) return;
  stopSource(id, "replaced");
  w.driver = driver;
  w.lastStep = Date.now();
  e.source = e.source === "live" ? "sim" : e.source;
  e.link = "live";
  e.via = e.source === "playback" ? "playback" : "sim";
  e.sourceLabel = driver.label;
  e.model.forceChar = true;
  log(e, `source: ${driver.label}`);
  w.timer = setInterval(() => {
    const cur = wires.get(id);
    const erg = ergs.get(id);
    if (!cur?.driver || !erg) return;
    const now = Date.now();
    /* Real time drives the driver clock; a tab in the background that
     * comes back does not try to replay a minute in one tick. */
    const dt = Math.min(2000, now - cur.lastStep);
    cur.lastStep = now;
    for (const p of cur.driver.step(dt)) ingest(erg, p.uuid, p.dv);
    if (cur.driver.done) stopSource(id, "finished");
  }, RATE_MS[e.rate]);
  paint();
}

export function stopSource(id: string, why = "stopped") {
  const e = ergs.get(id);
  const w = wires.get(id);
  if (!w) return;
  if (w.timer) clearInterval(w.timer);
  w.timer = null;
  if (!w.driver) return;
  w.driver = null;
  if (e) {
    e.link = "idle";
    e.via = null;
    log(e, `source ${why}`);
  }
  paint();
}

/* ---- the radio -------------------------------------------------------- */

/* THE DROP HANDLER, re-attached on every connect. DISCONNECT takes it off
 * with the link, so a slot that was let go and then reconnected would
 * otherwise have no way to notice the radio going: the card would read
 * LIVE with a frozen elapsed while the rower is mid-piece, and RECONNECT
 * only shows when the link is down. Removing any previous listener first
 * makes this safe to call again — pairing, reconnecting and the one
 * automatic retry all come through here. */
function attachDrop(e: Erg, ble: BleDevice) {
  const w = wires.get(e.id);
  if (!w) return;
  if (w.onDrop) ble.removeEventListener("gattserverdisconnected", w.onDrop);
  /* Mark dropped, try once on our own, then it is the RECONNECT button. */
  const onDrop = () => {
    const cur = wires.get(e.id);
    if (!cur || cur.ble !== ble) return;
    e.link = "dropped";
    cur.rowing = null;
    log(e, "DROPPED");
    paint();
    if (!cur.autoReconnectTried) {
      cur.autoReconnectTried = true;
      log(e, "one automatic reconnect in 2 s…");
      setTimeout(() => {
        const again = wires.get(e.id);
        if (again?.ble === ble && e.link === "dropped") void connect(e);
      }, 2000);
    }
  };
  w.onDrop = onDrop;
  /* autoReconnectTried is NOT reset here: this runs inside the automatic
   * retry itself, and clearing it there would turn one retry into a loop.
   * The gestures that mean a fresh start — ADD AN ERG and RECONNECT — and
   * a connection that comes up clear it themselves. */
  ble.addEventListener("gattserverdisconnected", onDrop);
}

async function readInfo(e: Erg, ble: BleDevice) {
  const gatt = ble.gatt;
  if (!gatt) return;
  let svc: BleService;
  try {
    svc = await withTimeout(gatt.getPrimaryService(PM5_UUID.infoService), CONNECT_TIMEOUT_MS, "info service");
  } catch (err) {
    log(e, `information service not readable — ${errText(err)}`);
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
  const d = e.device;
  d.model = await str(PM5_UUID.modelNumber, "model");
  const serial = await str(PM5_UUID.serialNumber, "serial");
  if (serial) {
    d.serial = serial;
    e.serial = serial;
  }
  d.hardware = await str(PM5_UUID.hardwareRevision, "hardware");
  d.firmware = await str(PM5_UUID.firmwareRevision, "firmware");
  d.manufacturer = await str(PM5_UUID.manufacturer, "manufacturer");
  try {
    const ch = await withTimeout(svc.getCharacteristic(PM5_UUID.ergMachineType), CONNECT_TIMEOUT_MS, "machine type");
    const v = await withTimeout(ch.readValue(), CONNECT_TIMEOUT_MS, "machine type read");
    d.machineType = v.byteLength ? v.getUint8(0) : null;
  } catch {
    d.machineType = null;
  }
  log(e, `erg: ${d.model ?? "?"} · serial ${d.serial} · hw ${d.hardware ?? "?"} · fw ${d.firmware ?? "?"}`);
  paint();
}

/* Connect and subscribe: every rowing characteristic directly (0x31, 32,
 * 33, 35, 36, 37, 38, 39, 3A, 3B, 3D) AND 0x80. The spec: an ID whose own
 * notification is enabled is not multiplexed, so nothing arrives twice;
 * and 0x3C only ever rides on 0x80. */
async function connect(e: Erg) {
  const w = wires.get(e.id);
  const ble = w?.ble;
  if (!w || !ble) return;
  /* Every path into a link comes through here — pairing, RECONNECT, the
   * automatic retry — so this is the one place the drop handler has to be
   * on, however the slot got here. */
  attachDrop(e, ble);
  const gatt = ble.gatt;
  if (!gatt) {
    e.link = "dropped";
    log(e, "the browser gave no GATT server for this device");
    paint();
    return;
  }
  e.link = "connecting";
  paint();
  log(e, "connecting…");

  const listen = (ch: BleCharacteristic, uuid: string) => {
    const old = w.listeners.get(uuid);
    if (old) ch.removeEventListener("characteristicvaluechanged", old);
    const fn = (ev: Event) => {
      if (wires.get(e.id)?.ble !== ble) return;
      const v = (ev.target as BleCharacteristic | null)?.value;
      if (v) ingest(e, uuid, v);
    };
    w.listeners.set(uuid, fn);
    ch.addEventListener("characteristicvaluechanged", fn);
  };

  try {
    const server = await withTimeout(gatt.connect(), CONNECT_TIMEOUT_MS, "connect");
    await readInfo(e, ble);
    const svc = await withTimeout(server.getPrimaryService(PM5_UUID.rowingService), CONNECT_TIMEOUT_MS, "rowing service");
    w.rowing = svc;

    let direct = 0;
    const missing: string[] = [];
    for (const d of DIRECT) {
      const tag = idWord(idOf(d.uuid));
      try {
        const ch = await withTimeout(svc.getCharacteristic(d.uuid), CONNECT_TIMEOUT_MS, tag);
        listen(ch, d.uuid);
        await withTimeout(ch.startNotifications(), CONNECT_TIMEOUT_MS, `${tag} notify`);
        direct++;
      } catch (err) {
        missing.push(tag);
        log(e, `${tag} would not notify — ${errText(err)}`);
      }
    }

    /* The force curve is its own case: not on PM5v1, and never on 0x80, so
     * a missing characteristic is a fact the card states, not a fallback
     * it can take. */
    try {
      const ch = await withTimeout(svc.getCharacteristic(PM5_UUID.forceCurve), CONNECT_TIMEOUT_MS, "0x3D");
      listen(ch, PM5_UUID.forceCurve);
      await withTimeout(ch.startNotifications(), CONNECT_TIMEOUT_MS, "0x3D notify");
      e.model.forceChar = true;
      log(e, "0x3D force curve: subscribed");
    } catch (err) {
      e.model.forceChar = false;
      log(e, `0x3D force curve: not on this monitor (${errText(err)})`);
    }

    try {
      const mux = await withTimeout(svc.getCharacteristic(PM5_UUID.multiplexed), CONNECT_TIMEOUT_MS, "0x80");
      listen(mux, PM5_UUID.multiplexed);
      await withTimeout(mux.startNotifications(), CONNECT_TIMEOUT_MS, "0x80 notify");
      log(e, `0x80 subscribed${missing.length ? ` — it carries ${missing.join(", ")}` : ""}`);
    } catch (err) {
      if (missing.length) throw err;
      log(e, `0x80 would not notify (${errText(err)}) — the direct subscriptions stand`);
    }

    e.via = direct === DIRECT.length ? "direct" : direct ? "mixed" : "mux";
    await writeRate(e, e.rate);
    e.link = "live";
    w.autoReconnectTried = false;
    log(e, `LIVE (${e.via})`);
  } catch (err) {
    e.link = "dropped";
    log(e, `connect failed — ${errText(err)}`);
    if (/timed out/.test(errText(err))) log(e, "if the PM5 shows in the laptop Bluetooth list, remove it there and try again");
  }
  paint();
}

/* The RECONNECT button on a card: same link, same slot, same recording. */
export async function reconnect(id: string) {
  const e = ergs.get(id);
  const w = wires.get(id);
  if (!e || !w?.ble) return;
  w.autoReconnectTried = false;
  await connect(e);
}

/* Let the monitor go without losing the slot or what it collected. */
export function disconnect(id: string) {
  const e = ergs.get(id);
  const w = wires.get(id);
  if (!e || !w) return;
  const ble = w.ble;
  if (ble) {
    if (w.onDrop) ble.removeEventListener("gattserverdisconnected", w.onDrop);
    try {
      ble.gatt?.disconnect();
    } catch {
      /* already gone */
    }
  }
  w.onDrop = null;
  w.rowing = null;
  w.listeners.clear();
  e.link = "idle";
  e.via = null;
  log(e, "disconnected");
  paint();
}

/* 0x34, the status cadence. A simulator takes it directly; a real monitor
 * may refuse, and then it keeps its own. */
async function writeRate(e: Erg, key: RateKey) {
  const svc = wires.get(e.id)?.rowing;
  if (!svc) return;
  try {
    const ch = await withTimeout(svc.getCharacteristic(PM5_UUID.sampleRate), CONNECT_TIMEOUT_MS, "0x34");
    await withTimeout(ch.writeValue(Uint8Array.from([SAMPLE_RATE[key]])), CONNECT_TIMEOUT_MS, "0x34 write");
    log(e, `wrote 0x34 = ${SAMPLE_RATE[key]} (status every ${RATE_WORD[key]})`);
  } catch (err) {
    log(e, `0x34 write REFUSED (${errText(err)}) — the monitor keeps its own rate`);
  }
}

export function setRate(id: string, key: RateKey) {
  const e = ergs.get(id);
  const w = wires.get(id);
  if (!e || !w) return;
  e.rate = key;
  paint();
  if (w.driver) {
    /* The driver is stepped by a timer at the slot rate; restart it at the
     * new one. */
    if (w.timer) clearInterval(w.timer);
    const driver = w.driver;
    w.driver = null;
    startSource(id, driver);
    return;
  }
  if (e.link === "live") void writeRate(e, key);
}

/* ---- removing and clearing -------------------------------------------- */

/* REMOVE: the link goes, the timer goes, the card goes. The caller asks
 * first when ergUnsaved says there is something to lose. */
export function removeErg(id: string) {
  stopSource(id, "removed");
  disconnect(id);
  wires.delete(id);
  ergs.delete(id);
  paint();
}

/* CLEAR: keep the erg and the link, throw away the piece and the
 * recording.
 *
 * The status packets go too, which resetPiece on its own does not do: a
 * live NEW PIECE would rather hold the last reading for the tick it takes
 * the monitor to send another, but a CLEAR — and a playback scrubbed back
 * to the start, which is the same call — must not leave ELAPSED and
 * DISTANCE reading the end of a piece that is no longer on the screen.
 * Nothing re-emits at 0:00, so the tiles would stay wrong until PLAY. */
export function clearErg(id: string) {
  const e = ergs.get(id);
  if (!e) return;
  resetPiece(e);
  e.model.general = null;
  e.model.a1 = null;
  e.model.a2 = null;
  e.model.belt = null;
  e.rec = freshRec();
  e.model.feed = [];
  e.loaded = null;
  e.save = { busy: false, note: null, savedId: null, title: null };
  log(e, "session cleared");
  paint();
}

/* What a card puts in its title box before anyone types: the piece as it
 * stands. */
export function ergTitle(e: Erg): string {
  if (e.save.title !== null) return e.save.title;
  return quickTitle({ device: e.device, general: e.model.general, summary: e.model.summary, strokes: e.model.strokes });
}

export function setErgTitle(id: string, title: string) {
  const e = ergs.get(id);
  if (!e) return;
  e.save.title = title;
  paint();
}

/* THE GOAL, read and written (owner, 2026-09-17: "infer the goal distance
 * to be a five K always. But allow us to change it").
 *
 * It is the slot's own number, not the monitor's: a rower on a 6 k who
 * wants his 5 k read gets it, and the screens say the two differ rather
 * than either one overruling the other. A CLEAR does not touch it — the
 * goal belongs to the erg for the session, not to the piece. */
export function ergGoalMeters(id: string): number {
  return ergs.get(id)?.goalM ?? DEFAULT_GOAL_M;
}

export function setErgGoal(id: string, meters: number) {
  const e = ergs.get(id);
  if (!e) return;
  if (!Number.isFinite(meters)) return;
  const m = Math.round(meters);
  e.goalM = Math.min(GOAL_MAX_M, Math.max(GOAL_MIN_M, m));
  paint();
}

/* A saved row read back into a slot says so here, so every view can tell a
 * piece that is happening from one that already did. The screen that loads
 * a row owns the reading; the hub only remembers which one. */
export function markLoaded(id: string, loaded: { id: string; title: string } | null) {
  const e = ergs.get(id);
  if (!e) return;
  e.loaded = loaded;
  paint();
}

/* ---- the document and the save ---------------------------------------- */

/* The slot as the document builder wants to read it. Structural, so
 * session.ts stays free of anything in this file. */
export function ergModelFor(e: Erg): TelemetryModel {
  return {
    device: e.device,
    general: e.model.general,
    a1: e.model.a1,
    a2: e.model.a2,
    summary: e.model.summary,
    summary1: e.model.summary1,
    summary2: e.model.summary2,
    strokes: e.model.strokes,
    samples: e.model.samples,
    splits: e.model.splits,
    forces: e.model.forces,
    rec: e.rec,
  };
}

/* The document this slot would save. FIT IT FIRST: the route refuses a
 * body over the byte cap, and an hour and a half of ticks and strokes can
 * reach it — a refusal after the whole upload would leave the only copy of
 * the piece in this tab. fitTelemetryDoc thins a long row until it fits
 * and says in notes.thinned what it took. */
export function ergDoc(e: Erg): TelemetryDoc {
  return fitTelemetryDoc(buildTelemetryDoc(ergModelFor(e)));
}

/* SAVE, PER ERG. Each slot has its own button, its own title and its own
 * saved word: saving erg two says nothing about erg one, which is the
 * whole of what the owner asked for. The row lands under the account.
 *
 * Returns the saved row when the route took it, or a line to print. */
export async function saveErg(id: string, title?: string): Promise<{ saved: TelemetrySavedRow } | { error: string }> {
  const e = ergs.get(id);
  if (!e) return { error: "That erg is gone." };
  if (e.save.busy) return { error: "Still saving." };
  e.save.busy = true;
  e.save.note = null;
  paint();
  try {
    const doc = ergDoc(e);
    if (!doc.strokes.length && !doc.samples.length) {
      const error = "Nothing to save yet — row a stroke first.";
      e.save.note = { ok: false, text: error };
      return { error };
    }
    if (doc.notes.thinned) log(e, `too long to save whole — ${doc.notes.thinned}`);
    /* A gym network that swallows a megabyte must not leave SAVING… on the
     * card until the browser gives up minutes later. */
    const res = await fetch(ERG_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc, title: title ?? ergTitle(e) }),
      signal: AbortSignal.timeout(SAVE_TIMEOUT_MS),
    });
    if (!res.ok) {
      const error = await readError(res);
      e.save.note = { ok: false, text: error };
      log(e, `save refused — ${error}`);
      return { error };
    }
    const j = (await res.json()) as { ok?: boolean; saved?: TelemetrySavedRow };
    if (!j.ok || !j.saved) {
      const error = "The server answered without a row.";
      e.save.note = { ok: false, text: error };
      return { error };
    }
    e.rec.saved = true;
    e.save.savedId = j.saved.id;
    e.save.note = { ok: true, text: `SAVED · ${clock()}` };
    log(e, `saved as ${j.saved.title}`);
    return { saved: j.saved };
  } catch (err) {
    const error = `The save did not go through — ${errText(err)}`;
    e.save.note = { ok: false, text: error };
    return { error };
  } finally {
    e.save.busy = false;
    paint();
  }
}
