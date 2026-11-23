import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { TelemetryDoc } from "../pm5/session";
import * as ble from "./ble";
import { simulate, type ErgLink, type Found, type Handlers } from "./link";
import { EMPTY_LIVE, createLive, type Live } from "./model";
import { PENDING_MIN_M, dropPending, putPending } from "../store";

/* THE ROW IN PROGRESS, held above the screens (owner, 2026-11-20: "allow me
 * to go to another part of the app and have it not disrupt the logging of
 * my row"). The connection, the decoder and everything the monitor has said
 * live here, in the app's root, so opening the feed or a profile mid-piece
 * unmounts nothing that matters: the row keeps recording and the strip over
 * the tabs leads back to it.
 *
 * Three ways in: CONNECT (a real PM5; a list of monitors on a phone, the
 * browser's own chooser on a computer), DEMO (the site's simulator through
 * the same decoder), and by hand, which never touches this.
 *
 * AND IT IS WRITTEN TO THE PHONE AS IT GOES (owner, 2026-11-22, of a row
 * that was gone when he came back to the app: "is there a way to get that
 * data back?"; "how do we prevent this from happening again?"). Memory was
 * the only place a piece lived until LOG, so the app being closed behind
 * him, or the monitor going back to its menu, lost it. Now a real piece of
 * 100 m or more is kept as an unlogged row (store.ts) every fifteen
 * seconds, as the app is left, as the monitor says it is over, as the
 * connection drops, and whole as the monitor re-arms. It stays until it is
 * logged or deleted; the log screen lists them. A demo row is never kept. */

const KEEP_EVERY_MS = 15_000;

export type ErgPhase = "idle" | "scanning" | "connecting" | "live";
/* Where the rower was at each 500 m line, for the splits so far. */
export type Mark = { m: number; t: number };
/* The current split along the piece, for the pace page. */
export type Trail = { m: number; pace: number };

export type Erg = {
  phase: ErgPhase;
  found: Found[];
  live: Live;
  name: string;
  demo: boolean;
  error: string;
  marks: Mark[];
  trail: Trail[];
  bluetooth: boolean;
  connect: () => void;
  pick: (d: Found) => void;
  /* The simulator, as many times faster than a clock as `speed` says. */
  startDemo: (distanceM?: number, speed?: number) => void;
  /* Drop the connection and whatever was recorded, the copy kept on the
   * phone included: the rower logged it, or said to throw it away. */
  discard: () => void;
  /* The whole piece as a saved document, or undefined when it is too short
   * to analyse. Does not end the row. */
  doc: () => TelemetryDoc | undefined;
};

export function useErg(): Erg {
  const [phase, setPhase] = useState<ErgPhase>("idle");
  const [found, setFound] = useState<Found[]>([]);
  const [live, setLive] = useState<Live>(EMPTY_LIVE);
  const [name, setName] = useState("");
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");
  /* The piece being kept: its id among the unlogged rows, when it began,
   * and what was last written, so a monitor sitting on its result is not
   * written again and again. */
  const piece = useRef<{ id: string; at: number } | null>(null);
  const kept = useRef("");
  const keptAt = useRef(0);
  const isDemo = useRef(false);
  const who = useRef("PM5");
  const keepAs = (l: Live, doc: TelemetryDoc | undefined) => {
    const p = piece.current;
    if (!p || isDemo.current || l.meters < PENDING_MIN_M) return;
    const mark = `${p.id}/${Math.floor(l.meters)}/${l.strokes}/${l.ended}`;
    if (mark === kept.current) return;
    kept.current = mark;
    putPending({ id: p.id, at: p.at, savedAt: Date.now(), meters: Math.floor(l.meters), seconds: Math.max(1, Math.round(l.elapsedS)), strokes: l.strokes, avgWatts: l.wattN ? Math.round(l.wattSum / l.wattN) : 0, device: who.current, ended: l.ended, hasDoc: !!doc }, doc).catch(() => null);
  };
  const model = useRef(
    createLive((was, doc) => {
      /* The monitor re-armed: what was rowed is kept whole, and the next
       * piece is another row. */
      keepAs(was, doc);
      piece.current = null;
    }),
  ).current;
  const keep = () => {
    keptAt.current = Date.now();
    const l = model.get();
    if (!piece.current || isDemo.current || l.meters < PENDING_MIN_M) return;
    let doc: TelemetryDoc | undefined;
    try {
      doc = l.strokes >= 8 ? model.toDoc(who.current, false) : undefined;
    } catch {
      doc = undefined;
    }
    keepAs(l, doc);
  };
  const link = useRef<ErgLink | null>(null);
  const stopScan = useRef<(() => void) | null>(null);
  const marks = useRef<Mark[]>([]);
  const trail = useRef<Trail[]>([]);

  const handlers: Handlers = {
    onPacket: (p) => {
      const wasOver = model.get().ended;
      model.feed(p);
      const l = model.get();
      if (!piece.current && !isDemo.current && l.meters >= 1) piece.current = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() - Math.round(l.elapsedS * 1000) };
      /* By the packets' own clock as well as the timer below: a timer may
       * not run while the app is behind another, and packets still land. */
      if ((l.ended && !wasOver) || Date.now() - keptAt.current > KEEP_EVERY_MS) keep();
      /* A new piece on the monitor starts the splits and the trail again. */
      const lastM = trail.current.length ? trail.current[trail.current.length - 1].m : 0;
      if (l.meters + 5 < lastM) {
        marks.current = [];
        trail.current = [];
      }
      const nextMark = (marks.current.length + 1) * 500;
      if (l.meters >= nextMark) marks.current = [...marks.current, { m: nextMark, t: l.elapsedS }];
      if (l.pace > 0 && l.meters - (trail.current.length ? trail.current[trail.current.length - 1].m : -99) >= 10 && trail.current.length < 5000) trail.current = [...trail.current, { m: l.meters, pace: l.pace }];
      setLive(l);
    },
    onDrop: (reason) => {
      setError(reason);
      link.current = null;
      /* The numbers stay so a dropped piece can still be logged. */
      keep();
    },
  };

  const leave = () => {
    stopScan.current?.();
    stopScan.current = null;
    link.current?.stop();
    link.current = null;
  };
  useEffect(() => leave, []);

  /* Written every fifteen seconds while a monitor is up, and the moment the
   * app is left: the phone may close it behind the rower without a word. */
  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(keep, KEEP_EVERY_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") keep();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
    // `keep` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const fresh = () => {
    setError("");
    model.reset();
    piece.current = null;
    kept.current = "";
    marks.current = [];
    trail.current = [];
    setLive(EMPTY_LIVE);
  };
  const begin = (l: ErgLink, demoRow: boolean) => {
    link.current = l;
    isDemo.current = demoRow;
    who.current = l.name || "PM5";
    model.sign(who.current, demoRow);
    setName(l.name);
    setDemo(demoRow);
    setPhase("live");
  };

  const connect = async () => {
    fresh();
    if (!ble.available()) return setError("This browser has no Bluetooth. Use the phone app, or Chrome on a computer.");
    try {
      if (ble.hasScanList) {
        setFound([]);
        setPhase("scanning");
        stopScan.current = await ble.scan((d) => setFound((prev) => (prev.some((x) => x.id === d.id) ? prev : [...prev, d])));
      } else {
        setPhase("connecting");
        begin(await ble.connect(null, handlers), false);
      }
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Could not start Bluetooth.");
    }
  };

  const pick = async (d: Found) => {
    stopScan.current?.();
    stopScan.current = null;
    setPhase("connecting");
    try {
      begin(await ble.connect(d.id, handlers), false);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Could not connect to that monitor.");
    }
  };

  return {
    phase,
    found,
    live,
    name,
    demo,
    error,
    marks: marks.current,
    trail: trail.current,
    bluetooth: ble.available(),
    connect,
    pick,
    startDemo: (distanceM, speed) => {
      fresh();
      begin(simulate(handlers, { distanceM: distanceM ?? 5000, speed }), true);
    },
    discard: () => {
      const p = piece.current;
      leave();
      fresh();
      if (p) dropPending(p.id).catch(() => null);
      setPhase("idle");
    },
    doc: () => {
      try {
        return model.get().strokes >= 8 ? model.toDoc(name || "PM5", demo) : undefined;
      } catch {
        return undefined;
      }
    },
  };
}
