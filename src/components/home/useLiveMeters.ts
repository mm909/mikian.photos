"use client";

import { useEffect, useRef, useState } from "react";
import type { MeterSnapshot } from "@/lib/homeStats";

/* The erg-monitor engine behind the landing counter.
 *
 * The number on screen counts up the way a Concept2 monitor does: one meter
 * at a time, at a split. The resting split is fixed: FIXED_SPLIT_S, 1:59.9
 * per 500 m, one meter every 239.8 ms — no random draw, no re-sample, no
 * drift (owner, 2026-09-16: the wheels used to draw a split from the
 * field's pace distribution, splitMean/splitSd from the server, and draw
 * again every 500 m, so the rhythm wandered; the owner wants exactly
 * 1:59.9). splitMean/splitSd still arrive in the snapshot but no longer
 * touch the tempo. Every tick is a whole meter (a couple at most): the ones
 * wheel turns one glyph, the tens wheel every tenth tick (owner's call,
 * 2026-09-05 — the old debt-clock model advanced by the challenge rate and
 * jumped 3–5 m a tick).
 *
 * The display starts from the server-rendered snapshot, so the first paint
 * and hydration agree, and begins ticking once mounted.
 *
 * Every `pollMs` (and whenever the tab comes back into view) it re-reads
 * GET /api/home/meters and reconciles against the board. While the month
 * is open the number never jumps and never stops; it changes tempo:
 *   - board ahead of the display: rows landed while you watched. The wheels
 *     do not snap — they roll faster, a meter (a couple, on a long gap)
 *     every CATCH_FLOOR_MS at the fastest, easing back to the split as the
 *     gap closes. A whole field rows faster than one rower, so by day the
 *     display is always a little behind and every landed row is a short
 *     sprint, not a jump (owner's words: it must not go from number to
 *     number).
 *   - board quiet, display ahead: rows land in lumps and the ticking
 *     averages them, so the display may run ahead of the last board read —
 *     but only so far. As it nears the lead cap the interval stretches,
 *     smoothly, to EASE_MAX times the split; at the cap it crawls at one
 *     meter every CRAWL_MS. Bounded drift, ~450 m/h, instead of the dead
 *     stop a quiet night used to show within ten minutes. A poll that
 *     lifts the board releases it.
 *   - board went DOWN since the last read and the display is above it: a
 *     row was fixed or deleted → snap down to it, honesty over smoothness.
 *     The only snap that rolls backwards. A board lowered while the display
 *     is still sprinting up to it has nothing to take back — the sprint
 *     simply ends at the new total instead of leaping there.
 *   - the pace is now 0 (nothing has ever been rowed — since 2026-09-25
 *     the total is all time and the rate is this month's recent one, so a
 *     month boundary no longer freezes it): the counter is frozen, so it
 *     shows the real total, static.
 *   - the board is further ahead than SNAP_GAP_M: that is a tab that was
 *     hidden or asleep for hours, not a row that landed while you watched.
 *     Ten minutes of blurred wheels would be a stunt, so it snaps once.
 *
 * The lead cap is an hour of challenge pace above the last board total,
 * never less than LEAD_FLOOR_M and never more than LEAD_MAX_M, so a tab
 * left open through a lull, or hidden overnight, can only ever be a
 * bounded crawl ahead of the truth. The ceiling is the one that bites: the
 * rate the server sends is the month's average (every meter since Sep 1
 * over the seconds since), as high at 3 a.m. as at noon, so an hour of it
 * is ~17 km. Without the ceiling a quiet night ran the display that far
 * past the board and the wheels crawled and eased for the best part of
 * half an hour every morning while the board caught up (review,
 * 2026-09-05).
 *
 * A failed poll (offline, 503 from the feed, malformed body) is never
 * adopted as truth — the wheels keep ticking on the last good read.
 *
 * All elapsed-time math uses the browser clock only, so server-client clock
 * skew cannot bend the pace. Only `meters` and the tempo change on a tick —
 * everything else updates on resync. */

/* How far ahead of the last board total the display may run before it
 * crawls: this many hours of challenge pace, never less than LEAD_FLOOR_M,
 * never more than LEAD_MAX_M. With the month-average rate the server sends
 * the ceiling is the cap from the first morning on; the hour of pace only
 * matters to a thin early field (under ~2.2 m/s). The ceiling is a trade
 * between night and day, chosen off a simulation (2026-09-05): the wheels
 * run ahead of a quiet board at ~3.9 m/s, so 8 km is about half an hour of
 * lull — the longest a busy afternoon has — and by day the counter never
 * eases or crawls between landed rows, while a quiet night ends ~11 km
 * ahead of the board (not ~19) and the morning's first rows take that back
 * in ~16 min (not ~24). The reviewer's 3 km halves the dawn lead again but
 * a quiet daytime half-hour then ends in a crawl and every landed session
 * becomes a two-minute sprint instead of one — a slower counter exactly
 * when people are rowing and looking. */
const LEAD_HOURS = 1;
const LEAD_FLOOR_M = 2000;
export const LEAD_MAX_M = 8000;

/* The resting split, seconds per 500 m: 1:59.9, so one meter every
 * 119.9 / 500 * 1000 = 239.8 ms (owner, 2026-09-16). Not drawn, not
 * re-sampled, never drifts. */
export const FIXED_SPLIT_S = 119.9;

/* Meters in a split. Until 2026-09-16 also how much displayed advance a
 * drawn split governed before the next draw; now only the denominator in
 * stepMs. */
export const SAMPLE_EVERY_M = 500;

/* Bounds a drawn split used to be clamped to. Kept for importers; the
 * fixed split sits inside them. The floor still documents the wheels:
 * 85 s /500 m is 170 ms a meter, the one-glyph roll in Home.tsx, so at
 * 239.8 ms a tick the roll settles with ~70 ms to spare. */
export const SPLIT_MIN_S = 85;
export const SPLIT_MAX_S = 240;

/* The timer fires this often; a tick is emitted only once its whole
 * interval has elapsed, so the cadence is the tempo, not the timer. 20 ms
 * because the fastest tempo is CATCH_FLOOR_MS: a coarser timer quantises a
 * 70 ms cadence into a 60/60/60/120 stutter the eye picks up. */
export const FIRE_MS = 20;

/* Catch-up tempo, for when the board is ahead of the display.
 * Within CATCH_DONE_M the gap is left to the ordinary split (the display
 * passes the board in a few seconds anyway). Beyond it the interval shrinks
 * with the square of the gap from the split down to CATCH_FLOOR_MS a step,
 * so the sprint eases back into the row instead of changing gear. A step is
 * one meter; a couple at a time (the owner allowed it) only above STEP2_M,
 * where one meter per CATCH_FLOOR_MS would need more than CATCH_SINGLE_S to
 * close the gap — so the last seconds of every sprint are single meters
 * again before the ease-out. Top speed is therefore 2 m / 70 ms ≈ 29 m/s:
 * a landed session by day (~1,500 m behind, because a whole field rows
 * faster than the one split the wheels tick at) rolls through in about a
 * minute. Any faster would mean bigger steps or a shorter interval than
 * the wheels can roll, which is the jump the owner does not want.
 *
 * The brief had the second meter kick in only above a 3,000 m gap. At one
 * meter per CATCH_FLOOR_MS (14 m/s) the ~1,500 m a landed session leaves
 * the display behind by day takes 100-125 s to roll through, so that
 * reading fails its own check that a landing clears in about a minute; the
 * threshold here (43 m) is the smaller of the two departures. Raise
 * CATCH_SINGLE_S to make more of every sprint single meters (30 s puts the
 * threshold at ~430 m), or set STEP2_M = 3000 for the literal brief and
 * accept two-minute sprints. */
export const CATCH_DONE_M = 20;
export const CATCH_FLOOR_MS = 70;
const CATCH_SINGLE_S = 3;
export const STEP2_M = Math.round(CATCH_SINGLE_S * (1000 / CATCH_FLOOR_MS));
/* A gap the top speed would take more than SNAP_AFTER_S to roll through is
 * not something that happened while you watched: snap it. */
const SNAP_AFTER_S = 600;
export const SNAP_GAP_M = Math.round(SNAP_AFTER_S * 2 * (1000 / CATCH_FLOOR_MS));

/* Easing into the lead cap: over the last EASE_ZONE of the cap the interval
 * stretches (smoothstep) to EASE_MAX times the split; at the cap and beyond
 * it is one meter every CRAWL_MS. */
export const EASE_ZONE = 0.25;
export const EASE_MAX = 4;
export const CRAWL_MS = 8000;

/* Standard normal via Box-Muller. 1 - u keeps the log away from zero.
 * No longer behind the tempo; kept for importers. */
export function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Once a draw from the field's pace, clamped to the bounds above; since
 * 2026-09-16 every split is the fixed one. Signature kept for callers. */
export function sampleSplit(_mean: number, _sd: number, _rnd: () => number = gaussian): number {
  return FIXED_SPLIT_S;
}

/* Milliseconds per meter at a split. */
export const stepMs = (split: number) => (split / SAMPLE_EVERY_M) * 1000;

export type TickerInput = Pick<MeterSnapshot, "meters" | "rate" | "splitMean" | "splitSd">;

export type Ticker = ReturnType<typeof createTicker>;

/* The pure engine: no React, no timers, no wall clock of its own — every
 * call is handed `now`, so it runs the same under a 20 ms interval and
 * under a simulation with virtual time. `rnd` once seeded the split draw;
 * the split is fixed now and it is ignored (signature kept). */
export function createTicker(init: TickerInput, now: number, _rnd: () => number = gaussian) {
  let display = init.meters;
  let truth = init.meters;
  let rate = init.rate;
  // The one tempo the wheels rest at; init.splitMean/splitSd are ignored.
  const split = FIXED_SPLIT_S;
  // When the next step is owed. Absolute, so timer jitter never accumulates.
  let due = now + stepMs(split);

  const capLead = () => Math.min(LEAD_MAX_M, Math.max(LEAD_FLOOR_M, rate * 3600 * LEAD_HOURS));

  /* Milliseconds until the next step is owed, read off where the display
   * stands against the board right now. This is the whole tempo model. */
  const interval = (): number => {
    const base = stepMs(split);
    const gap = truth - display;
    if (gap > CATCH_DONE_M) {
      return Math.max(CATCH_FLOOR_MS, base * (CATCH_DONE_M / gap) ** 2);
    }
    const lead = -gap;
    const cap = capLead();
    if (lead >= cap) return CRAWL_MS;
    const from = cap * (1 - EASE_ZONE);
    if (lead <= from) return base;
    const s = (lead - from) / (cap - from);
    return base * (1 + (EASE_MAX - 1) * s * s * (3 - 2 * s));
  };

  /* Emit every step owed since the last call. Returns the display. */
  const advance = (at: number): number => {
    if (rate <= 0) {
      // Frozen counter: park the clock so a later thaw owes no backlog.
      due = at + stepMs(split);
      return display;
    }
    while (due <= at) {
      const size = truth - display > STEP2_M ? 2 : 1;
      display += size;
      // Timed from where the step left the display, so the step that
      // reaches the cap is the one that starts the crawl.
      due += interval();
    }
    return display;
  };

  /* A fresh board read. Returns the display after the rules above. */
  const reconcile = (d: TickerInput, at: number): number => {
    const t = d.meters;
    const snap =
      d.rate <= 0 || // frozen counter shows the real total
      (t < truth && t < display) || // a row was fixed or deleted out from under the display
      t - display > SNAP_GAP_M; // a tab that was away, not a row that landed
    if (snap) {
      display = t;
      // A snap is not ticking: the next step is owed a full split from now.
      due = at + stepMs(split);
    }
    truth = t;
    rate = d.rate;
    // d.splitMean / d.splitSd are ignored: the split is fixed (2026-09-16).
    // A lifted board shortens the interval (a sprint to catch up, or a cap
    // that just released a crawl): the next step is owed no later than
    // that, never sooner than it already was.
    if (rate > 0) due = Math.min(due, at + interval());
    return display;
  };

  return {
    advance,
    reconcile,
    get value() {
      return display;
    },
    get split() {
      return split;
    },
    /* Milliseconds between steps at the current tempo. */
    get tempo() {
      return rate <= 0 ? stepMs(split) : interval();
    },
    /* Where the crawl begins: the last board total plus the lead cap. */
    get cap() {
      return truth + capLead();
    },
  };
}

export function useLiveMeters(
  initial: MeterSnapshot,
  opts: { tickMs?: number; pollMs?: number } = {},
) {
  const tickMs = opts.tickMs ?? FIRE_MS;
  const pollMs = opts.pollMs ?? 30_000;

  const [snap, setSnap] = useState(initial);
  const [shown, setShown] = useState(initial.meters);
  // False until the client clock is running — server render and first
  // client render both show the static snapshot number.
  const [ticking, setTicking] = useState(false);
  // The split the wheels are ticking at right now; 0 until mounted.
  const [split, setSplit] = useState(0);
  // Milliseconds between steps right now; 0 until mounted. The wheels time
  // their roll off it so a sprint never leaves them trailing the number.
  const [tempo, setTempo] = useState(0);

  // Built on mount, never during render: it reads the clock, which the
  // server render may not depend on.
  const ticker = useRef<Ticker | null>(null);
  const engine = () => (ticker.current ??= createTicker(initial, Date.now()));

  // Mirror the engine into React, touching state only when it changed so a
  // resting counter renders nothing.
  const sync = (t: Ticker) => {
    const v = t.value;
    const s = t.split;
    const ms = Math.round(t.tempo);
    setShown((x) => (x === v ? x : v));
    setSplit((x) => (x === s ? x : s));
    setTempo((x) => (x === ms ? x : ms));
  };

  useEffect(() => {
    const t = engine();
    setTicking(true);
    sync(t);
    const fire = () => {
      t.advance(Date.now());
      sync(t);
    };
    const id = window.setInterval(fire, tickMs);
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
        const t = engine();
        t.reconcile(d, Date.now());
        setSnap(d);
        sync(t);
      } catch {
        /* offline — keep ticking on the last good read */
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
    seconds: snap.seconds ?? 0,
    finished: snap.finished,
    phase: snap.phase,
    day: snap.day,
    rate: snap.rate,
    /* True once the client is ticking a moving number. */
    live: ticking && snap.rate > 0,
    /* Seconds per 500 m the wheels are ticking at (0 before mount). */
    split,
    /* Milliseconds between steps at the current tempo (0 before mount). */
    tempoMs: tempo,
  };
}
