"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { fmtRowerNumber } from "@/lib/row100k";
import { fmtClock, fmtTime, pickedWave, waveOf, type ResultBoard, type ResultRacer } from "../raceresults/types";
import {
  FINISH_MIN_M,
  PM5_REQUEST,
  PM5_UUID,
  SAMPLE_RATE,
  fmtElapsedHundredths,
  fmtMeters,
  fmtPace,
  isEnded,
  isFinish,
  isNewPiece,
  isPieceStart,
  parseAdditionalStatus1,
  parseAdditionalStatus2,
  parseGeneralStatus,
  parseMultiplexed,
  parseWorkoutSummary,
  serialFromName,
  workoutStateWord,
  type AdditionalStatus1,
  type AdditionalStatus2,
  type BleBluetooth,
  type BleCharacteristic,
  type BleDevice,
  type GeneralStatus,
  type WorkoutSummary,
} from "./pm5";

/* PM5 LIVE, the client half (owner, 2026-09-16: a barebones UI to try live
 * results in the gym). Three panels and a log:
 *
 *   THE ERGS — ADD AN ERG opens the browser's Bluetooth picker (it has to
 *   be a click: requestDevice needs a user gesture, so eight monitors is
 *   eight clicks). Each monitor becomes a card with its live numbers, a
 *   LANE picker, and — once the monitor says the piece is over — the
 *   finish time with SUBMIT and DNF.
 *   THE WAVE — the race board (GET /api/row100k/raceday/results, polled
 *   every 30 s), a wave picker, the lanes of that wave, START WAVE.
 *   THE LOG — the last 30 things that happened, with clock times. This is
 *   what the owner debugs from in the gym, so everything that matters is
 *   written to it.
 *
 * HOW THE MONITORS ARE READ. Every PM5 is a BLE peripheral; this page is
 * the central. After connect it subscribes to general status (0x31),
 * additional status 1 and 2 (0x32, 0x33) and the end-of-workout summary
 * (0x39) directly, and then ALWAYS to the multiplexed characteristic
 * (0x80) as well. The spec says 0x80 carries every ID whose own
 * notification is NOT enabled, so nothing arrives twice — and pm5-base's
 * field note is that on real hardware every rowing message turns up on
 * 0x80 anyway, so a monitor that takes the CCCD write on 0x31 and then
 * never notifies it still feeds the card instead of sitting at NO PACKET
 * YET with the link LIVE. The sample rate is set to 1 s to keep the radio
 * quiet with eight monitors on one adapter.
 *
 * THE ERGS LIVE IN A REF, NOT STATE. A notification every second from
 * eight monitors would be sixteen setState calls a second on an array of
 * objects; instead the cards are mutable records in a Map and a coalesced
 * repaint (one per animation frame) redraws them. The BluetoothDevice is
 * kept on the record so RECONNECT can re-open the same device without a
 * new picker. A reload loses the devices — getDevices() is still behind a
 * flag in Chrome, so that is the honest cost — but NOT the lanes: serial
 * to lane is kept in localStorage per race, and a re-added erg comes back
 * with its lane. Every listener checks that its record is still the live
 * one in the Map, so a removed-then-re-added erg cannot leave a ghost
 * that reconnects itself and posts under its old lane.
 *
 * WHAT GOES TO THE BOARD. A finish is the monitor's own end-of-workout
 * summary (elapsed time in hundredths, rounded to tenths) or, if the
 * summary is slow, the general status packet that carried an ended state
 * (WORKOUT END, TERMINATE or WORKOUT LOGGED — the last is where a
 * reconnect finds a monitor) — either way only when the distance is a
 * 5,000 m (FINISH_MIN_M). It is posted once per erg per piece. When the
 * monitor is armed again (WAITING TO BEGIN or RE-ARM) a POSTED finish is
 * cleared so one erg can row two waves; an UNPOSTED one is kept on the
 * card and flagged, because a racer pressing Menu before the owner gets
 * there must not erase it — the next real finish replaces it. The summary
 * is re-sent a minute later with a recovery heart rate, which is why
 * "once" is a flag and not a count. The automatic path never overwrites a
 * time already on the board and never posts onto a wave that is rowed:
 * both are what a stale wave pin or a mis-set lane look like, so they are
 * left to the button. */

const POLL_MS = 30_000;
const CONNECT_TIMEOUT_MS = 15_000;
const LOG_LINES = 30;

type Link = "connecting" | "live" | "dropped";

type Erg = {
  key: string;
  name: string;
  serial: string;
  device: BleDevice;
  link: Link;
  /* How the numbers arrive after the last connect: every one of the four
   * subscribed directly (0x80 carries only the rest), some, or none. */
  via: "direct" | "mixed" | "mux" | null;
  lane: number | null;
  /* One automatic reconnect per drop; after that it is the button. */
  autoReconnectTried: boolean;
  /* The gattserverdisconnected listener, so remove can take it off. */
  onDrop: ((ev: Event) => void) | null;
  /* Stable listeners, one per characteristic, so a reconnect can remove
   * and re-add them rather than stacking a second copy on a cached
   * characteristic object. */
  listeners: Map<string, (ev: Event) => void>;
  /* The live numbers. Null until the first packet. */
  elapsedHundredths: number | null;
  distanceM: number | null;
  currentPaceS: number | null;
  averagePaceS: number | null;
  strokeRate: number | null;
  heartRate: number | null;
  dragFactor: number | null;
  workoutState: number | null;
  /* The finish, once the monitor has one. `stale` means the monitor has
   * since been armed for a new piece and this one was never posted: it
   * stays on the card until it is posted, discarded, or replaced by the
   * next finish. */
  final: { elapsedHundredths: number; distanceM: number; source: "summary" | "status"; stale: boolean } | null;
  submitted: boolean;
  posting: boolean;
  /* A summary that landed while the status-sourced time was on its way to
   * the board; checked against the posted time when the POST answers. */
  pendingSummary: WorkoutSummary | null;
  note: { text: string; bad: boolean } | null;
};

type Final = NonNullable<Erg["final"]>;

/* ---- lane memory ------------------------------------------------------ */

/* serial -> lane in localStorage, so a reload mid-wave does not cost eight
 * picks and eight selects. Keyed to the race slug so one night's lanes
 * never leak into another. Every read and write is wrapped: a private
 * window or blocked storage just means nothing is remembered. */
const LANES_KEY = "row100k-pm5-lanes";
type LaneMemory = { slug: string; lanes: Record<string, number> };

function readLanes(slug: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(LANES_KEY);
    if (!raw) return {};
    const m = JSON.parse(raw) as Partial<LaneMemory> | null;
    return m && m.slug === slug && m.lanes && typeof m.lanes === "object" ? m.lanes : {};
  } catch {
    return {};
  }
}

function writeLane(slug: string, serial: string, lane: number | null) {
  try {
    const lanes = readLanes(slug);
    /* One lane per serial and one serial per lane. */
    for (const s of Object.keys(lanes)) if (lane !== null && lanes[s] === lane) delete lanes[s];
    if (lane === null) delete lanes[serial];
    else lanes[serial] = lane;
    const m: LaneMemory = { slug, lanes };
    window.localStorage.setItem(LANES_KEY, JSON.stringify(m));
  } catch {
    /* nothing remembered, nothing lost */
  }
}

type LogLine = { at: string; text: string };

type Answer = { ok?: boolean; error?: string; board?: ResultBoard };

const clock = () => new Date().toLocaleTimeString("en-US", { hour12: false });

const errText = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/* navigator.bluetooth through a cast — the DOM lib here has no Bluetooth
 * types (see the note at the foot of pm5.ts). */
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

const storedWord = (r: ResultRacer): string => {
  if (r.status === "finished" && r.seconds !== null) return fmtTime(r.seconds);
  if (r.status === "dnf") return "DNF";
  if (r.status === "rowing") return "ROWING";
  return "—";
};

const linkWord: Record<Link, string> = { connecting: "CONNECTING…", live: "LIVE", dropped: "DROPPED" };

export function Pm5Live() {
  /* ---- support ---- */
  const [support, setSupport] = useState<"unknown" | "yes" | "no">("unknown");
  /* The adapter itself, when the browser will say: a laptop with Bluetooth
   * switched off otherwise looks fine until the picker opens empty. */
  const [btOff, setBtOff] = useState(false);
  useEffect(() => {
    const bt = getBluetooth();
    setSupport(bt ? "yes" : "no");
    if (bt?.getAvailability) {
      bt.getAvailability().then((ok) => setBtOff(!ok), () => undefined);
    }
  }, []);

  /* ---- the ergs and the log, mutable, painted on a frame ---- */
  const ergsRef = useRef<Map<string, Erg>>(new Map());
  const logRef = useRef<LogLine[]>([]);
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
      logRef.current = [...logRef.current.slice(-(LOG_LINES - 1)), { at: clock(), text }];
      paint();
    },
    [paint],
  );

  /* ---- the board ---- */
  const [board, setBoard] = useState<ResultBoard | null>(null);
  const [boardErr, setBoardErr] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [autoStamp, setAutoStamp] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [waveBusy, setWaveBusy] = useState(false);
  const [waveNote, setWaveNote] = useState<{ text: string; bad: boolean } | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/row100k/raceday/results", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Answer;
      if (res.ok && data.ok && data.board) {
        setBoard(data.board);
        setBoardErr(null);
        setFetchedAt(clock());
      } else setBoardErr(data.error ?? `The board answered ${res.status}.`);
    } catch (e) {
      setBoardErr(`Could not fetch the board: ${errText(e)}`);
    }
  }, []);

  useEffect(() => {
    if (support !== "yes") return;
    void loadBoard();
    const t = setInterval(() => void loadBoard(), POLL_MS);
    return () => clearInterval(t);
  }, [support, loadBoard]);

  const wave = board ? pickedWave(board, pick) : null;

  /* The notification handlers are closures made at connect time; they
   * read the CURRENT board, wave and switches through this ref. */
  const ctx = useRef({ board, wave, autoStamp, autoSubmit });
  useEffect(() => {
    ctx.current = { board, wave, autoStamp, autoSubmit };
  }, [board, wave, autoStamp, autoSubmit]);

  /* A PIN IS RELEASED WHEN ITS WAVE IS ROWED. The lanes are fixed all
   * night, so a panel left pinned to wave 1 would map wave 2's finishes
   * onto wave 1's racers; when the pinned wave goes rowed the panel goes
   * back to following the room. It is a TRANSITION, not a state, so a
   * rowed wave can still be pinned on purpose to fix a time. */
  const pinSeen = useRef<{ pick: number | null; state: string | null }>({ pick: null, state: null });
  useEffect(() => {
    const state = pick !== null && board ? (waveOf(board, pick)?.state ?? null) : null;
    const seen = pinSeen.current;
    if (pick !== null && seen.pick === pick && seen.state !== "rowed" && state === "rowed") {
      setPick(null);
      log(`wave ${pick} is rowed — following the room again`);
    }
    pinSeen.current = { pick, state };
  }, [board, pick, log]);
  /* One wave stamp in flight at a time, across all eight ergs. */
  const stamping = useRef(false);

  /* ---- one write to the board ---- */
  const post = useCallback(
    async (body: Record<string, unknown>): Promise<{ ok: true; board: ResultBoard } | { ok: false; error: string }> => {
      try {
        const res = await fetch("/api/row100k/raceday/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as Answer;
        if (res.ok && data.ok && data.board) {
          setBoard(data.board);
          setFetchedAt(clock());
          return { ok: true, board: data.board };
        }
        return { ok: false, error: data.error ?? `The route answered ${res.status}.` };
      } catch (e) {
        return { ok: false, error: `Could not reach the route: ${errText(e)}` };
      }
    },
    [],
  );

  /* The racer on an erg's lane in the picked wave. DNFs included, so the
   * card can still say who it was. */
  const racerFor = useCallback((erg: Erg): ResultRacer | null => {
    const { board: b, wave: w } = ctx.current;
    if (!b || w === null || erg.lane === null) return null;
    return b.racers.find((r) => r.wave === w && r.lane === erg.lane) ?? null;
  }, []);

  /* ---- the wave stamp ---- */
  const stampWave = useCallback(
    async (w: number, started: boolean, why: string) => {
      if (stamping.current) return;
      stamping.current = true;
      setWaveBusy(true);
      log(`wave ${w}: ${started ? "START" : "UNDO START"} (${why})`);
      const out = await post({ action: "wave", wave: w, started });
      if (out.ok) {
        const st = out.board.waves.find((x) => x.wave === w)?.startedAtMs ?? null;
        const text = started ? `WAVE ${w} STARTED · ${st !== null ? fmtClock(st) : "STAMPED"}` : `WAVE ${w} START UNDONE`;
        setWaveNote({ text, bad: false });
        log(`wave ${w}: ${text}`);
      } else {
        setWaveNote({ text: out.error, bad: true });
        log(`wave ${w}: refused — ${out.error}`);
      }
      setWaveBusy(false);
      stamping.current = false;
    },
    [log, post],
  );

  const maybeAutoStamp = useCallback(
    (erg: Erg) => {
      const { board: b, wave: w, autoStamp: on } = ctx.current;
      if (!on || !b || w === null || erg.lane === null) return;
      const wv = waveOf(b, w);
      if (!wv) return;
      if (wv.startedAtMs !== null) {
        /* The other ergs of the same wave start within seconds of the
         * stamp and need no line; a start minutes later is the NEXT wave
         * on a panel still pointed at the last one, and must say so. */
        if (Date.now() - wv.startedAtMs > 60_000) {
          log(
            `erg ${erg.serial}: started rowing but wave ${w} was stamped ${fmtClock(wv.startedAtMs)} — press START WAVE on the next one, or FOLLOW THE ROOM`,
          );
        }
        return;
      }
      void stampWave(w, true, `erg ${erg.serial} on lane ${erg.lane} started rowing`);
    },
    [log, stampWave],
  );

  /* ---- the finish ---- */
  /* `manual` is the SUBMIT button. The automatic path refuses to overwrite
   * a different time already on the board and refuses a wave that is
   * rowed — a stale pin or a mis-set lane look exactly like that — and
   * says so on the card; the button asks first, unless this erg is the
   * one that posted the time it is now correcting. */
  const submit = useCallback(
    async (erg: Erg, why: string, manual: boolean) => {
      if (!erg.final || erg.posting) return;
      const racer = racerFor(erg);
      if (!racer) {
        erg.note = { text: "NO LANE MAPPED — pick the lane to send this time to the board.", bad: true };
        paint();
        return;
      }
      const posted = erg.final.elapsedHundredths;
      const time = fmtElapsedHundredths(posted);
      const held = racer.status === "finished" && racer.seconds !== null ? fmtTime(racer.seconds) : null;
      if (held !== null && held !== time) {
        if (!manual) {
          erg.note = {
            text: `W${racer.wave} L${racer.lane} ${racer.name} ALREADY HAS ${held} ON THE BOARD — press SUBMIT AGAIN to overwrite it with ${time}.`,
            bad: true,
          };
          log(`erg ${erg.serial}: not posting ${time} on its own — ${racer.name} already has ${held} on the board`);
          paint();
          return;
        }
        if (
          !erg.submitted &&
          !window.confirm(`${racer.name} (wave ${racer.wave}, lane ${racer.lane}) already has ${held} on the board. Replace it with ${time}?`)
        ) {
          return;
        }
      } else if (!manual) {
        const { board: b, wave: w } = ctx.current;
        const wv = b && w !== null ? waveOf(b, w) : null;
        if (wv?.state === "rowed") {
          erg.note = { text: `WAVE ${wv.wave} IS ROWED — is the panel on the right wave? SUBMIT to post ${time} to ${racer.name} anyway.`, bad: true };
          log(`erg ${erg.serial}: not posting ${time} on its own — wave ${wv.wave} is already rowed`);
          paint();
          return;
        }
      }
      erg.posting = true;
      erg.note = { text: `POSTING ${time} → ${racer.name}…`, bad: false };
      paint();
      log(`erg ${erg.serial}: posting ${time} for W${racer.wave} L${racer.lane} ${racer.name} (${why})`);
      const out = await post({ action: "set", id: racer.id, time });
      erg.posting = false;
      /* A summary that arrived mid-flight is the finish record; it is
       * held back in onSummary and reconciled here, once, whichever way
       * the POST went. */
      const pend = erg.pendingSummary;
      erg.pendingSummary = null;
      const fromSummary = (s: WorkoutSummary): Final => ({ elapsedHundredths: s.elapsedHundredths, distanceM: s.distanceM, source: "summary", stale: false });
      if (out.ok) {
        erg.submitted = true;
        const stored = out.board.racers.find((r) => r.id === racer.id);
        erg.note = { text: `POSTED ${time} → ${racer.name} · board says ${stored ? storedWord(stored) : "?"}`, bad: false };
        log(`erg ${erg.serial}: board took ${time} for ${racer.name}`);
        if (pend) {
          const st = fmtElapsedHundredths(pend.elapsedHundredths);
          if (pend.elapsedHundredths !== posted) {
            erg.final = fromSummary(pend);
            erg.note = { text: `SUMMARY SAYS ${st} — ${time} was posted. SUBMIT again to correct the board.`, bad: true };
            log(`erg ${erg.serial}: summary ${st} differs from the posted ${time} — needs a hand`);
          } else {
            log(`erg ${erg.serial}: summary ${st} agrees with the posted time`);
          }
        }
      } else {
        erg.note = { text: `REFUSED: ${out.error}`, bad: true };
        log(`erg ${erg.serial}: board refused ${time} — ${out.error}`);
        /* Nothing went out, so the summary is what the button sends next. */
        if (pend) erg.final = fromSummary(pend);
      }
      paint();
    },
    [log, paint, post, racerFor],
  );

  const maybeAutoSubmit = useCallback(
    (erg: Erg) => {
      if (!ctx.current.autoSubmit || erg.submitted || erg.posting || !erg.final) return;
      void submit(erg, "auto-submit", false);
    },
    [submit],
  );

  const dnf = useCallback(
    async (erg: Erg) => {
      const racer = racerFor(erg);
      if (!racer || erg.posting) return;
      if (!window.confirm(`Mark ${racer.name} (lane ${erg.lane}) DNF on the board?`)) return;
      erg.posting = true;
      paint();
      log(`erg ${erg.serial}: DNF for lane ${erg.lane} ${racer.name}`);
      const out = await post({ action: "set", id: racer.id, status: "dnf" });
      erg.posting = false;
      erg.note = out.ok ? { text: `DNF POSTED → ${racer.name}`, bad: false } : { text: `REFUSED: ${out.error}`, bad: true };
      log(`erg ${erg.serial}: ${out.ok ? "board took the DNF" : `board refused the DNF — ${out.error}`}`);
      paint();
    },
    [log, paint, post, racerFor],
  );

  /* ---- packets ---- */
  const onGeneral = useCallback(
    (erg: Erg, g: GeneralStatus) => {
      const prev = erg.workoutState;
      erg.elapsedHundredths = g.elapsedHundredths;
      erg.distanceM = g.distanceM;
      erg.dragFactor = g.dragFactor;
      erg.workoutState = g.workoutState;
      if (prev !== g.workoutState) {
        log(`erg ${erg.serial}: ${workoutStateWord(g.workoutState)} at ${fmtElapsedHundredths(g.elapsedHundredths)} · ${fmtMeters(g.distanceM)}`);
        if (isNewPiece(prev, g.workoutState)) {
          if (erg.submitted || !erg.final) {
            erg.final = null;
            erg.submitted = false;
            erg.pendingSummary = null;
            erg.note = null;
            log(`erg ${erg.serial}: new piece armed — the finish guard is reset`);
          } else {
            /* A finish nobody posted stays on the card: a racer pressing
             * Menu before the owner gets there must not erase it. */
            const t = fmtElapsedHundredths(erg.final.elapsedHundredths);
            erg.final = { ...erg.final, stale: true };
            erg.note = { text: `PREVIOUS PIECE ${t} NOT POSTED — SUBMIT it or DISCARD it; the next finish replaces it.`, bad: true };
            log(`erg ${erg.serial}: new piece armed but ${t} was never posted — kept on the card`);
          }
        }
        if (isPieceStart(prev, g.workoutState)) maybeAutoStamp(erg);
        if (isFinish(g.workoutState, g.distanceM) && (!erg.final || erg.final.stale)) {
          erg.final = { elapsedHundredths: g.elapsedHundredths, distanceM: g.distanceM, source: "status", stale: false };
          erg.note = null;
          log(`erg ${erg.serial}: FINISH ${fmtElapsedHundredths(g.elapsedHundredths)} (from status; summary to follow)`);
          maybeAutoSubmit(erg);
        } else if (isEnded(g.workoutState) && g.distanceM < FINISH_MIN_M && (prev === null || !isEnded(prev))) {
          log(`erg ${erg.serial}: workout ended at ${fmtMeters(g.distanceM)} — under ${FINISH_MIN_M} m, not a finish`);
        }
      }
      paint();
    },
    [log, maybeAutoStamp, maybeAutoSubmit, paint],
  );

  const onAdditional1 = useCallback(
    (erg: Erg, a: AdditionalStatus1) => {
      erg.currentPaceS = a.currentPaceS;
      erg.averagePaceS = a.averagePaceS;
      erg.strokeRate = a.strokeRate;
      erg.heartRate = a.heartRate;
      paint();
    },
    [paint],
  );

  const onAdditional2 = useCallback(
    (_erg: Erg, _a: AdditionalStatus2) => {
      /* Nothing on the card reads it yet; subscribed so the log can show
       * it arriving if the owner ever needs the split numbers. */
    },
    [],
  );

  const onSummary = useCallback(
    (erg: Erg, s: WorkoutSummary) => {
      const time = fmtElapsedHundredths(s.elapsedHundredths);
      const again = s.recoveryHeartRate !== 0 ? " (re-sent with recovery HR)" : "";
      if (s.distanceM < FINISH_MIN_M) {
        log(`erg ${erg.serial}: summary ${time} at ${fmtMeters(s.distanceM)}${again} — under ${FINISH_MIN_M} m, ignored`);
        return;
      }
      if (erg.posting) {
        /* The status-sourced time is on its way to the board. Holding the
         * summary here and reconciling it in submit() is what keeps the
         * card from showing the summary time as POSTED when the status
         * time is what went out. */
        erg.pendingSummary = s;
        log(`erg ${erg.serial}: SUMMARY ${time}${again} while a time is posting — checked when the board answers`);
        paint();
        return;
      }
      const differs = erg.final !== null && erg.final.elapsedHundredths !== s.elapsedHundredths;
      if (erg.submitted && differs) {
        /* The status packet's time went out and the summary disagrees:
         * say so loudly and leave the button — never re-post on its own. */
        erg.final = { elapsedHundredths: s.elapsedHundredths, distanceM: s.distanceM, source: "summary", stale: false };
        erg.note = { text: `SUMMARY SAYS ${time} — a different time was posted. SUBMIT again to correct the board.`, bad: true };
        log(`erg ${erg.serial}: summary ${time} differs from the posted time — needs a hand`);
      } else if (!erg.submitted) {
        if (erg.final?.stale && !differs) {
          /* The previous piece's summary re-sent after the monitor was
           * re-armed: still the same unposted time, still flagged. */
          log(`erg ${erg.serial}: summary ${time}${again} — the previous piece again, still not posted`);
        } else {
          erg.final = { elapsedHundredths: s.elapsedHundredths, distanceM: s.distanceM, source: "summary", stale: false };
          erg.note = null;
          log(`erg ${erg.serial}: SUMMARY ${time} · ${fmtMeters(s.distanceM)}${again}`);
          maybeAutoSubmit(erg);
        }
      } else {
        log(`erg ${erg.serial}: summary ${time}${again} — already posted, nothing to do`);
      }
      paint();
    },
    [log, maybeAutoSubmit, paint],
  );

  /* ---- connecting ---- */
  const connect = useCallback(
    async (erg: Erg) => {
      /* Is this record still the live one for its device? A removed erg —
       * or one removed and re-added, which Chrome hands back under the
       * SAME device id — must not connect, listen or reconnect as a ghost. */
      const live = () => ergsRef.current.get(erg.key) === erg;
      if (!live()) return;
      const gatt = erg.device.gatt;
      if (!gatt) {
        erg.link = "dropped";
        log(`erg ${erg.serial}: the browser gave no GATT server for this device`);
        paint();
        return;
      }
      erg.link = "connecting";
      paint();
      log(`erg ${erg.serial}: connecting…`);

      /* A stable listener per characteristic. Remove-then-add is what makes
       * a reconnect safe on a browser that hands back the same object. */
      const listen = (ch: BleCharacteristic, uuid: string, handle: (dv: DataView) => void) => {
        const old = erg.listeners.get(uuid);
        if (old) ch.removeEventListener("characteristicvaluechanged", old);
        const fn = (ev: Event) => {
          if (!live()) return;
          const v = (ev.target as BleCharacteristic | null)?.value;
          if (v) handle(v);
        };
        erg.listeners.set(uuid, fn);
        ch.addEventListener("characteristicvaluechanged", fn);
      };
      const short = (what: string) => log(`erg ${erg.serial}: short ${what} packet, ignored`);

      try {
        const server = await withTimeout(gatt.connect(), CONNECT_TIMEOUT_MS, "connect");
        const svc = await withTimeout(server.getPrimaryService(PM5_UUID.rowingService), CONNECT_TIMEOUT_MS, "rowing service");

        /* The four direct characteristics first. */
        const wants: { uuid: string; tag: string; handle: (dv: DataView) => void }[] = [
          {
            uuid: PM5_UUID.generalStatus,
            tag: "0x31",
            handle: (dv) => {
              const g = parseGeneralStatus(dv);
              if (g) onGeneral(erg, g);
              else short("0x31");
            },
          },
          {
            uuid: PM5_UUID.additionalStatus1,
            tag: "0x32",
            handle: (dv) => {
              const a = parseAdditionalStatus1(dv);
              if (a) onAdditional1(erg, a);
              else short("0x32");
            },
          },
          {
            uuid: PM5_UUID.additionalStatus2,
            tag: "0x33",
            handle: (dv) => {
              const a = parseAdditionalStatus2(dv);
              if (a) onAdditional2(erg, a);
              else short("0x33");
            },
          },
          {
            uuid: PM5_UUID.workoutSummary,
            tag: "0x39",
            handle: (dv) => {
              const s = parseWorkoutSummary(dv);
              if (s) onSummary(erg, s);
              else short("0x39");
            },
          },
        ];
        const missing: string[] = [];
        let direct = 0;
        for (const w of wants) {
          try {
            const ch = await withTimeout(svc.getCharacteristic(w.uuid), CONNECT_TIMEOUT_MS, w.tag);
            listen(ch, w.uuid, w.handle);
            await withTimeout(ch.startNotifications(), CONNECT_TIMEOUT_MS, `${w.tag} notify`);
            direct++;
          } catch (e) {
            missing.push(w.tag);
            log(`erg ${erg.serial}: ${w.tag} would not notify — ${errText(e)}`);
          }
        }

        /* 0x80 ALWAYS, on top of whatever subscribed directly. The spec:
         * an ID whose own notification is enabled is NOT multiplexed, so
         * nothing arrives twice. And pm5-base's note that on real hardware
         * every rowing message turns up on 0x80 is why this is not only a
         * fallback: a monitor that takes the CCCD write on 0x31 and then
         * never notifies it would otherwise sit at NO PACKET YET with the
         * link LIVE and nothing to press. */
        try {
          log(`erg ${erg.serial}: subscribing 0x80 as well${missing.length ? ` — it carries ${missing.join(", ")}` : ""}`);
          const mux = await withTimeout(svc.getCharacteristic(PM5_UUID.multiplexed), CONNECT_TIMEOUT_MS, "0x80");
          listen(mux, PM5_UUID.multiplexed, (dv) => {
            const p = parseMultiplexed(dv);
            if (!p) return short("0x80");
            if (p.kind === "general") onGeneral(erg, p.data);
            else if (p.kind === "additional1") onAdditional1(erg, p.data);
            else if (p.kind === "additional2") onAdditional2(erg, p.data);
            else if (p.kind === "summary") onSummary(erg, p.data);
          });
          await withTimeout(mux.startNotifications(), CONNECT_TIMEOUT_MS, "0x80 notify");
        } catch (e) {
          /* With all four direct, 0x80 was belt and braces; with any of
           * them missing it was the only way those bytes arrive. */
          if (missing.length) throw e;
          log(`erg ${erg.serial}: 0x80 would not notify (${errText(e)}) — the four direct subscriptions stand`);
        }
        erg.via = direct === wants.length ? "direct" : direct ? "mixed" : "mux";

        /* 1 s status packets: plenty for a finish, kinder to eight radios. */
        try {
          const rate = await withTimeout(svc.getCharacteristic(PM5_UUID.sampleRate), CONNECT_TIMEOUT_MS, "0x34");
          await withTimeout(rate.writeValue(Uint8Array.from([SAMPLE_RATE.s1])), CONNECT_TIMEOUT_MS, "0x34 write");
          log(`erg ${erg.serial}: sample rate set to 1 s`);
        } catch (e) {
          log(`erg ${erg.serial}: sample rate not set (${errText(e)}) — the monitor's default 500 ms stands`);
        }

        erg.link = "live";
        erg.autoReconnectTried = false;
        log(`erg ${erg.serial}: LIVE (${erg.via})`);
      } catch (e) {
        erg.link = "dropped";
        log(`erg ${erg.serial}: connect failed — ${errText(e)}`);
        if (/timed out/.test(errText(e))) {
          log(`erg ${erg.serial}: if the PM5 shows in the laptop's own Bluetooth list, remove it there and try again`);
        }
      }
      paint();
    },
    [log, onAdditional1, onAdditional2, onGeneral, onSummary, paint],
  );

  const addErg = useCallback(async () => {
    const bt = getBluetooth();
    if (!bt) return;
    let device: BleDevice;
    try {
      device = await bt.requestDevice(PM5_REQUEST);
    } catch (e) {
      const t = errText(e);
      log(/NotFoundError/.test(t) ? "picker closed without a monitor" : `picker failed — ${t}`);
      return;
    }
    const had = ergsRef.current.get(device.id);
    if (had) {
      log(`erg ${had.serial}: already on the page${had.link === "dropped" ? " — reconnecting" : ""}`);
      if (had.link === "dropped") void connect(had);
      return;
    }
    const erg: Erg = {
      key: device.id,
      name: device.name ?? "PM5",
      serial: serialFromName(device.name),
      device,
      link: "connecting",
      via: null,
      lane: null,
      autoReconnectTried: false,
      onDrop: null,
      listeners: new Map(),
      elapsedHundredths: null,
      distanceM: null,
      currentPaceS: null,
      averagePaceS: null,
      strokeRate: null,
      heartRate: null,
      dragFactor: null,
      workoutState: null,
      final: null,
      submitted: false,
      posting: false,
      pendingSummary: null,
      note: null,
    };
    ergsRef.current.set(erg.key, erg);
    log(`picked ${erg.name}`);
    /* The lane it had before a reload, unless another erg on the page
     * holds that lane now. */
    const slug = ctx.current.board?.raceSlug ?? null;
    const remembered = slug && erg.serial !== "PM5" ? (readLanes(slug)[erg.serial] ?? null) : null;
    if (remembered !== null) {
      const holder = [...ergsRef.current.values()].find((e) => e !== erg && e.lane === remembered) ?? null;
      if (holder) log(`erg ${erg.serial}: lane ${remembered} remembered from before, but PM5 ${holder.serial} holds it now — pick it again`);
      else {
        erg.lane = remembered;
        log(`erg ${erg.serial}: lane ${remembered} remembered from before the reload`);
      }
    }
    /* Mark dropped, try once on our own, then it is the RECONNECT button.
     * The device object is kept on the card, so no second picker. The
     * identity check (not a key check) is what keeps a removed record's
     * listener from waking up when the same device is added again. */
    const onDrop = () => {
      if (ergsRef.current.get(erg.key) !== erg) return;
      erg.link = "dropped";
      log(`erg ${erg.serial}: DROPPED`);
      paint();
      if (!erg.autoReconnectTried) {
        erg.autoReconnectTried = true;
        log(`erg ${erg.serial}: one automatic reconnect in 2 s…`);
        setTimeout(() => {
          if (ergsRef.current.get(erg.key) === erg && erg.link === "dropped") void connect(erg);
        }, 2000);
      }
    };
    erg.onDrop = onDrop;
    device.addEventListener("gattserverdisconnected", onDrop);
    await connect(erg);
  }, [connect, log, paint]);

  const removeErg = useCallback(
    (erg: Erg) => {
      ergsRef.current.delete(erg.key);
      if (erg.onDrop) erg.device.removeEventListener("gattserverdisconnected", erg.onDrop);
      try {
        erg.device.gatt?.disconnect();
      } catch {
        /* already gone */
      }
      log(`erg ${erg.serial}: removed from the page`);
      paint();
    },
    [log, paint],
  );

  /* ---- render ---- */

  if (support === "unknown") return null;

  if (support === "no") {
    return (
      <div className="pm-nope">
        <b>This browser cannot talk to a monitor</b>
        Use Chrome or Edge on a laptop or an Android phone — not Safari on an iPhone (every iPhone browser is
        Safari underneath; the Bluefy app is the iPhone workaround) — and open this page over https or
        localhost. Firefox does not do Web Bluetooth at all.
      </div>
    );
  }

  const ergs = [...ergsRef.current.values()];
  const laneCount = board?.ergs ?? 8;
  const waves = board?.waves ?? [];
  const thisWave = board && wave !== null ? waveOf(board, wave) : null;
  const lanes = board && wave !== null ? board.racers.filter((r) => r.wave === wave).sort((a, b) => a.lane - b.lane) : [];
  /* Every erg on a lane, so two on one lane show up as the clash it is. */
  const ergsOnLane = (lane: number) => ergs.filter((e) => e.lane === lane);
  const rememberedLanes = ergs.length === 0 && board ? Object.entries(readLanes(board.raceSlug)) : [];

  return (
    <>
      {/* ------------------------------------------------------ the ergs */}
      <div className="pm-sec">
        <div className="pm-head">
          <h3>The ergs</h3>
          <span className="mono">
            {ergs.length === 0 ? "NONE YET" : `${ergs.filter((e) => e.link === "live").length} LIVE OF ${ergs.length}`}
          </span>
        </div>
        <div className="pm-act">
          <button type="button" className="send" onClick={() => void addErg()}>
            Add an erg
          </button>
          <label className="pm-check">
            <input type="checkbox" checked={autoStamp} onChange={(e) => setAutoStamp(e.target.checked)} />
            Auto-stamp start
          </label>
          <label className="pm-check">
            <input type="checkbox" checked={autoSubmit} onChange={(e) => setAutoSubmit(e.target.checked)} />
            Auto-submit
          </label>
        </div>
        {btOff && (
          <div className="pm-err">
            BLUETOOTH LOOKS OFF ON THIS DEVICE — turn it on in the system settings before ADD AN ERG.
          </div>
        )}
        {ergs.length === 0 ? (
          <p className="pm-empty">
            Put a monitor on its Connect Device screen, press ADD AN ERG, and pick PM5 followed by its serial
            in the browser&apos;s list. One click per monitor. Lanes set here are remembered on this device,
            so after a reload an erg comes back with its lane.
            {rememberedLanes.length > 0 && (
              <>
                <br />
                REMEMBERED: {rememberedLanes.map(([s, l]) => `${s} → lane ${l}`).join(" · ")}
              </>
            )}
          </p>
        ) : (
          <div className="pm-grid">
            {ergs.map((erg) => {
              const racer = racerFor(erg);
              const finishText = erg.final ? fmtElapsedHundredths(erg.final.elapsedHundredths) : null;
              return (
                <div key={erg.key} className={`pm-erg${erg.link === "dropped" ? " dropped" : ""}`}>
                  <div className="h">
                    <span>PM5 {erg.serial}</span>
                    <span className={`st${erg.link === "live" ? " live" : ""}`}>
                      {linkWord[erg.link]}
                      {erg.link === "live" && erg.via && erg.via !== "direct" ? ` · ${erg.via.toUpperCase()}` : ""}
                    </span>
                  </div>

                  <div className="big">
                    {erg.elapsedHundredths === null ? "—:——.—" : fmtElapsedHundredths(erg.elapsedHundredths)}
                  </div>
                  <div className="state">
                    {erg.workoutState === null ? "NO PACKET YET" : workoutStateWord(erg.workoutState)}
                  </div>
                  <dl>
                    <dt>Distance</dt>
                    <dd>{erg.distanceM === null ? "—" : fmtMeters(erg.distanceM)}</dd>
                    <dt>Pace</dt>
                    <dd>{erg.currentPaceS === null ? "—" : `${fmtPace(erg.currentPaceS)} /500`}</dd>
                    <dt>Avg pace</dt>
                    <dd>{erg.averagePaceS === null ? "—" : `${fmtPace(erg.averagePaceS)} /500`}</dd>
                    <dt>Rate</dt>
                    <dd>{erg.strokeRate === null ? "—" : `${erg.strokeRate} spm`}</dd>
                    <dt>Heart</dt>
                    <dd>{erg.heartRate === null ? "" : `${erg.heartRate} bpm`}</dd>
                    <dt>Drag</dt>
                    <dd>{erg.dragFactor === null ? "—" : erg.dragFactor}</dd>
                  </dl>

                  <label className="lane">
                    Lane
                    <select
                      value={erg.lane ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const lane = v === "" ? null : Number(v);
                        /* One erg per lane: the other one loses it, out loud. */
                        const other =
                          lane === null ? null : ([...ergsRef.current.values()].find((x) => x !== erg && x.lane === lane) ?? null);
                        if (other) {
                          other.lane = null;
                          other.note = { text: `LOST LANE ${lane} TO PM5 ${erg.serial} — pick its lane again.`, bad: true };
                          log(`erg ${other.serial}: lost lane ${lane} to erg ${erg.serial}`);
                        }
                        erg.lane = lane;
                        log(`erg ${erg.serial}: lane ${lane ?? "none"}`);
                        if (board && erg.serial !== "PM5") writeLane(board.raceSlug, erg.serial, lane);
                        paint();
                      }}
                    >
                      <option value="">none</option>
                      {Array.from({ length: laneCount }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          lane {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  {erg.lane !== null && (
                    <div className="who">
                      {racer ? (
                        <>
                          <span className="n">
                            W{racer.wave} L{racer.lane} · {fmtRowerNumber(racer.rowerNumber)}
                          </span>
                          {racer.name}
                          <span className="n"> · {storedWord(racer)}</span>
                        </>
                      ) : (
                        <span className="n">NOBODY ON LANE {erg.lane} IN WAVE {wave ?? "?"}</span>
                      )}
                    </div>
                  )}

                  {erg.final && finishText && (
                    <div className="final">
                      <div className="state">
                        FINAL · {fmtMeters(erg.final.distanceM)} · from {erg.final.source}
                        {erg.final.stale ? " · PREVIOUS PIECE" : ""}
                        {erg.submitted ? " · POSTED" : ""}
                      </div>
                      <div className="t">{finishText}</div>
                      <div className="btns">
                        <button
                          type="button"
                          className="send"
                          disabled={erg.posting || !racer}
                          onClick={() => void submit(erg, "button", true)}
                        >
                          {erg.submitted || (racer?.status === "finished" && racer.seconds !== null) ? "Submit again" : "Submit"}
                        </button>
                        {!erg.submitted && (
                          <button
                            type="button"
                            className="quiet-btn"
                            disabled={erg.posting}
                            onClick={() => {
                              log(`erg ${erg.serial}: ${finishText} discarded, never posted`);
                              erg.final = null;
                              erg.note = null;
                              paint();
                            }}
                          >
                            discard
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {erg.link === "dropped" && (
                    <div className="note bad">
                      If the monitor went dark: wake it, get it back on the Connect Device screen, set the piece
                      up again, then RECONNECT — the lane stays.
                    </div>
                  )}

                  <div className="btns">
                    {erg.link === "dropped" && (
                      <button type="button" className="outline-btn" onClick={() => void connect(erg)}>
                        Reconnect
                      </button>
                    )}
                    {racer && (
                      <button type="button" className="outline-btn" disabled={erg.posting} onClick={() => void dnf(erg)}>
                        DNF
                      </button>
                    )}
                    <button type="button" className="quiet-btn" onClick={() => removeErg(erg)}>
                      remove
                    </button>
                  </div>

                  {erg.note && <div className={`note${erg.note.bad ? " bad" : ""}`}>{erg.note.text}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ the wave */}
      <div className="pm-sec pm-wave">
        <div className="pm-head">
          <h3>The wave</h3>
          <span className="mono">
            {boardErr ? `BOARD: ${boardErr}` : fetchedAt ? `BOARD FETCHED ${fetchedAt}${board?.sample ? " · SAMPLE" : ""}` : "FETCHING THE BOARD…"}
            {board ? (pick === null ? " · FOLLOWING THE ROOM" : ` · PINNED TO WAVE ${pick}`) : ""}
          </span>
        </div>
        {board && (
          <>
            <div className="tabs">
              <button
                type="button"
                className={pick === null ? "on" : undefined}
                onClick={() => {
                  setPick(null);
                  log("following the room — the live wave, or the next one");
                }}
              >
                Follow the room
              </button>
              {waves.map((w) => (
                <button
                  key={w.wave}
                  type="button"
                  className={w.wave === wave ? "on" : undefined}
                  onClick={() => setPick(w.wave)}
                >
                  Wave {w.wave}
                  {w.state === "on_the_ergs" ? " · on" : w.state === "rowed" ? " · rowed" : ""}
                </button>
              ))}
            </div>
            {thisWave && (
              <div className="pm-act">
                {thisWave.startedAtMs === null ? (
                  <button
                    type="button"
                    className="send"
                    disabled={waveBusy}
                    onClick={() => void stampWave(thisWave.wave, true, "button")}
                  >
                    Start wave {thisWave.wave}
                  </button>
                ) : (
                  <>
                    <span className="mono">STARTED · {fmtClock(thisWave.startedAtMs)}</span>
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={waveBusy}
                      onClick={() => void stampWave(thisWave.wave, false, "button")}
                    >
                      Undo
                    </button>
                  </>
                )}
                <span className="mono">SCHEDULED {fmtClock(thisWave.scheduledAtMs)}</span>
              </div>
            )}
            {waveNote && <div className={waveNote.bad ? "pm-err" : "pm-ok"}>{waveNote.text}</div>}
            <div className="pm-scroll">
              <table className="board pm-t">
                <thead>
                  <tr>
                    <th>Lane</th>
                    <th>No.</th>
                    <th>Name</th>
                    <th>Board</th>
                    <th>Erg</th>
                  </tr>
                </thead>
                <tbody>
                  {lanes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="board-empty">
                        Nobody is assigned to this wave.
                      </td>
                    </tr>
                  ) : (
                    lanes.map((r) => {
                      const es = ergsOnLane(r.lane);
                      return (
                        <tr key={r.id}>
                          <td className="rk">{r.lane}</td>
                          <td className="num">{fmtRowerNumber(r.rowerNumber)}</td>
                          <td className="who">{r.name}</td>
                          <td className="num">{storedWord(r)}</td>
                          <td className="num">
                            {es.length === 0
                              ? "—"
                              : es.map((e) => `PM5 ${e.serial} · ${linkWord[e.link]}`).join(" + ") + (es.length > 1 ? " · SHARED" : "")}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------- the log */}
      <div className="pm-sec">
        <div className="pm-head">
          <h3>The log</h3>
          <span className="mono">LAST {LOG_LINES}</span>
        </div>
        <div className="pm-log">
          {logRef.current.length === 0
            ? "nothing yet"
            : logRef.current.map((l, i) => (
                <div key={i}>
                  <span className="ts">{l.at}</span>
                  {l.text}
                </div>
              ))}
        </div>
      </div>
    </>
  );
}
