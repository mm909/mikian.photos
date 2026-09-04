"use client";

import { useEffect, useRef, useState } from "react";
import type { MeterSnapshot } from "@/lib/homeStats";

/* The debt-clock engine behind the landing counter.
 *
 * The number on screen is a MODEL that runs continuously at the challenge
 * pace (meters per second, from the server), anchored to the last board
 * total the browser saw. It starts from the server-rendered snapshot, so the
 * first paint and hydration agree, and begins moving once mounted.
 *
 * Every `pollMs` (and whenever the tab comes back into view) it re-reads
 * GET /api/home/meters and reconciles:
 *   - board ahead of the display: rows landed while you watched → jump to
 *     the board (the wheels make the moment);
 *   - board went DOWN since the last read: a row was fixed or deleted →
 *     follow it down, honesty over smoothness;
 *   - the pace is now 0 (before Sep 1, after the month): the counter is
 *     frozen, so it shows the real total;
 *   - otherwise the display is a little ahead of the last board read (rows
 *     land in lumps, the model averages them) → keep rolling from where it
 *     is, at the fresh pace. It never rolls back just because the board is
 *     quiet — a debt clock does not run backwards.
 *
 * The lead the model may build over the last board total is bounded: once
 * it is an hour of pace ahead (never less than LEAD_FLOOR_M) it HOLDS until
 * the board catches up, so a tab left open through a lull, or hidden
 * overnight, can never inflate the number without limit.
 *
 * A failed poll (offline, 503 from the feed, malformed body) is never
 * adopted as truth — the model keeps rolling on the last good anchor.
 *
 * All elapsed-time math uses the browser clock only (anchored at mount / at
 * each poll response), so server-client clock skew cannot bend the pace.
 *
 * Only `meters` changes every tick — everything else updates on resync. */

/* How far ahead of the last board total the model may run before holding:
 * this many hours of pace, never less than LEAD_FLOOR_M. */
const LEAD_HOURS = 1;
const LEAD_FLOOR_M = 2000;

export function useLiveMeters(
  initial: MeterSnapshot,
  opts: { tickMs?: number; pollMs?: number } = {},
) {
  const tickMs = opts.tickMs ?? 500;
  const pollMs = opts.pollMs ?? 30_000;

  const [snap, setSnap] = useState(initial);
  const [shown, setShown] = useState(initial.meters);
  // False until the client clock is running — server render and first
  // client render both show the static snapshot number.
  const [ticking, setTicking] = useState(false);

  // at === 0 means "not mounted yet": the value is exactly the anchor.
  const anchor = useRef({ meters: initial.meters, at: 0, rate: initial.rate });
  const lastTruth = useRef(initial.meters);

  const maxLead = (rate: number) => Math.max(LEAD_FLOOR_M, rate * 3600 * LEAD_HOURS);

  const valueNow = () => {
    const a = anchor.current;
    if (!a.at) return a.meters;
    const model = Math.floor(a.meters + a.rate * Math.max(0, (Date.now() - a.at) / 1000));
    // Hold at the lead cap above the last board total — but never below the
    // anchor, so a fresh (lower) pace can only pause the wheels, not rewind.
    return Math.max(a.meters, Math.min(model, lastTruth.current + maxLead(a.rate)));
  };

  useEffect(() => {
    anchor.current = { ...anchor.current, at: Date.now() };
    setTicking(true);
    const step = () => {
      const v = valueNow();
      setShown((s) => (v === s ? s : v));
    };
    step();
    const id = window.setInterval(step, tickMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickMs]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/home/meters", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as MeterSnapshot;
        if (cancelled || d?.ok === false || typeof d?.meters !== "number" || typeof d?.rate !== "number") {
          return;
        }
        const now = Date.now();
        const display = valueNow();
        const truth = d.meters;
        const toTruth =
          d.rate <= 0 || // frozen counter shows the real total
          truth < lastTruth.current || // a row was fixed or deleted
          truth > display; // rows landed: jump up
        anchor.current = { meters: toTruth ? truth : display, at: now, rate: d.rate };
        lastTruth.current = truth;
        setSnap(d);
        const v = valueNow();
        setShown((s) => (v === s ? s : v));
      } catch {
        /* offline — keep rolling on the last anchor */
      }
    };
    const id = window.setInterval(load, pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    // A first paint that could not read the board is not worth a 30s wait.
    if (!initial.ok) void load();
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  return {
    meters: shown,
    rowers: snap.rowers,
    sessions: snap.sessions,
    finished: snap.finished,
    phase: snap.phase,
    daysLeft: snap.daysLeft,
    day: snap.day,
    rate: snap.rate,
    /* True once the client is rolling a moving number. */
    live: ticking && snap.rate > 0,
  };
}
