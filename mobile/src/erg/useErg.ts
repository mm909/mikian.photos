import { useEffect, useRef, useState } from "react";
import type { TelemetryDoc } from "../pm5/session";
import * as ble from "./ble";
import { simulate, type ErgLink, type Found, type Handlers } from "./link";
import { EMPTY_LIVE, createLive, type Live } from "./model";

/* THE ROW IN PROGRESS, held above the screens (owner, 2026-11-20: "allow me
 * to go to another part of the app and have it not disrupt the logging of
 * my row"). The connection, the decoder and everything the monitor has said
 * live here, in the app's root, so opening the feed or a profile mid-piece
 * unmounts nothing that matters: the row keeps recording and the strip over
 * the tabs leads back to it.
 *
 * Three ways in: CONNECT (a real PM5; a list of monitors on a phone, the
 * browser's own chooser on a computer), DEMO (the site's simulator through
 * the same decoder), and by hand, which never touches this. */

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
  /* Drop the connection and whatever was recorded. */
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
  const model = useRef(createLive()).current;
  const link = useRef<ErgLink | null>(null);
  const stopScan = useRef<(() => void) | null>(null);
  const marks = useRef<Mark[]>([]);
  const trail = useRef<Trail[]>([]);

  const handlers: Handlers = {
    onPacket: (p) => {
      model.feed(p);
      const l = model.get();
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
    },
  };

  const leave = () => {
    stopScan.current?.();
    stopScan.current = null;
    link.current?.stop();
    link.current = null;
  };
  useEffect(() => leave, []);

  const fresh = () => {
    setError("");
    model.reset();
    marks.current = [];
    trail.current = [];
    setLive(EMPTY_LIVE);
  };
  const begin = (l: ErgLink, isDemo: boolean) => {
    link.current = l;
    setName(l.name);
    setDemo(isDemo);
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
      leave();
      fresh();
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
