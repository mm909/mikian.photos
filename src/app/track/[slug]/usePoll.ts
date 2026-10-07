"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Poll one JSON URL the way the spec wants the public page to read the
 * snapshot (§3 "spectators read one cached file", §11 "polls every 15 s"):
 *
 * - a fixed interval while the tab is visible; nothing while it is hidden
 *   (a phone in a pocket should not burn its battery on a 15 s timer), and
 *   an immediate refetch when it comes back (visibilitychange / focus);
 * - the LAST GOOD payload is kept through errors, so the page degrades to
 *   "offline · retrying" instead of going blank (§3 "degrade visibly");
 * - exponential backoff on errors: interval × 2^failures, capped, so a
 *   dead server is not hammered by a stadium of spectators;
 * - `once: true` for the route file, which is fetched once and retried
 *   only until it arrives.
 */
export type PollState<T> = {
  data: T | null;
  /** Short reason for the latest failure, null while healthy. */
  error: string | null;
  /** Consecutive failures since the last success. */
  failures: number;
  /** Client-clock ms of the last successful fetch. */
  fetchedAt: number | null;
  /** Client-clock ms when the next attempt is due (for a "retrying in N s" line). */
  nextAt: number | null;
  /** True before the first answer (good or bad). */
  loading: boolean;
  refetch: () => void;
};

type Opts = {
  intervalMs: number;
  once?: boolean;
  maxBackoffMs?: number;
};

export function usePoll<T>(url: string | null, opts: Opts): PollState<T> {
  const { intervalMs, once = false, maxBackoffMs = 120_000 } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [nextAt, setNextAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const failuresRef = useRef(0);
  const doneRef = useRef(false); // `once` satisfied
  const lastStartRef = useRef(0);
  const mountedRef = useRef(true);
  // Trigger for a manual/visibility refetch without re-creating the effect.
  const [kick, setKick] = useState(0);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const refetch = useCallback(() => setKick((k) => k + 1), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!url) return;
    // A new URL starts over.
    failuresRef.current = 0;
    doneRef.current = false;

    const schedule = (ms: number) => {
      clearTimer();
      if (typeof document !== "undefined" && document.hidden) {
        setNextAt(null);
        return; // resumed by visibilitychange
      }
      setNextAt(Date.now() + ms);
      timer.current = setTimeout(run, ms);
    };

    const run = async () => {
      clearTimer();
      if (doneRef.current) return;
      inflight.current?.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;
      lastStartRef.current = Date.now();
      try {
        const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(res.status === 404 ? "not found" : `HTTP ${res.status}`);
        const json = (await res.json()) as T;
        if (!mountedRef.current || ctrl.signal.aborted) return;
        failuresRef.current = 0;
        setData(json);
        setError(null);
        setFailures(0);
        setFetchedAt(Date.now());
        setLoading(false);
        if (once) {
          doneRef.current = true;
          setNextAt(null);
          return;
        }
        schedule(intervalMs);
      } catch (err) {
        if (!mountedRef.current || ctrl.signal.aborted) return;
        failuresRef.current += 1;
        const n = failuresRef.current;
        setFailures(n);
        setError(err instanceof Error ? err.message : "failed");
        setLoading(false);
        // 15 s → 30 s → 60 s → 120 s (cap). For the once-only route file the
        // first retry comes sooner: nothing draws without it.
        const base = once ? Math.min(intervalMs, 4000) : intervalMs;
        schedule(Math.min(maxBackoffMs, base * 2 ** Math.min(n - 1, 6)));
      }
    };

    const onVisible = () => {
      if (document.hidden) {
        clearTimer();
        setNextAt(null);
        return;
      }
      // Back from the pocket: fetch now unless one just happened.
      if (doneRef.current) return;
      if (Date.now() - lastStartRef.current > 3000) void run();
      else schedule(intervalMs);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    void run();

    return () => {
      clearTimer();
      inflight.current?.abort();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // `kick` is a deliberate dependency: refetch() restarts the loop now.
  }, [url, intervalMs, once, maxBackoffMs, kick]);

  return { data, error, failures, fetchedAt, nextAt, loading, refetch };
}
