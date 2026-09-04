"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RelayData } from "@/lib/relay";
import { RelayMap } from "./RelayMap";
import { TEAM_NAME, TEAM_TAG, SOCIALS } from "@/lib/dtk";
import { fmtAgo, fmtDuration, fmtEta, fmtFeet, fmtMiles, fmtPace } from "./format";
import { useMounted } from "./hooks";

/**
 * The DTK live page: a full-screen dark map with ONE floating panel — tracker
 * numbers (covered/elevation/live race clock/pace), the expected-finish hero,
 * speedrun-style checkpoint splits, the crew (hover highlights their legs on
 * the map; names link to their Instagram when set), and the team socials as
 * the panel footer. Leg-by-leg detail and all sharing live on /tsp/stats.
 */
export function RelayLive({ data, isOwner }: { data: RelayData; isOwner: boolean }) {
  const [highlightRunner, setHighlightRunner] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Gate for relative/locale time strings ("46m ago", "Fri 03:13 PM") — they
  // differ between server render and client hydration, so render them only
  // after mount (this was the recurring hydration error).
  const mounted = useMounted();

  const t = data.totals;
  const remainingM = t.plannedDistanceM > 0 ? Math.max(0, t.plannedDistanceM - t.distanceM) : null;
  const timeLeftSec =
    remainingM !== null && t.paceSecPerKm !== null ? (remainingM / 1000) * t.paceSecPerKm : null;
  const finishAt = timeLeftSec !== null ? new Date(Date.now() + timeLeftSec * 1000) : null;

  // Race clock — counts up live from the FIRST leg's start.
  const raceStartMs = useMemo(() => {
    const starts = data.segments
      .filter((s) => s.kind === "completed" && s.startedAt)
      .map((s) => Date.parse(s.startedAt!))
      .filter(Number.isFinite);
    return starts.length ? Math.min(...starts) : null;
  }, [data.segments]);
  const raceClockSec = useTicker(raceStartMs);

  const anim = useCountUp(1400);

  return (
    <div className="relay-page">
      <div className="relay-live">
        <RelayMap data={data} height="100%" bare highlightRunnerId={highlightRunner} />

        <div className="relay-live__overlays">
          {/* THE panel — tracker numbers, checkpoint splits, crew, socials. */}
          <div className="relay-live__panel relay-live__panel--primary">
            <div
              className="relay-live__eyebrow"
              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
            >
              <span className="live-dot" />
              {TEAM_NAME} <span style={{ opacity: 0.6 }}>({TEAM_TAG})</span>
              {mounted && t.lastUpdatedAt ? (
                <span style={{ opacity: 0.6 }}> · {fmtAgo(t.lastUpdatedAt)}</span>
              ) : null}
            </div>

            <div className="relay-live__statrow" style={{ marginTop: 12 }}>
              <Stat label="Covered" value={fmtMiles(t.distanceM * anim)} big />
              <Stat label="Elevation" value={fmtFeet(t.gainM * anim)} big />
              <Stat
                label="Race time"
                value={raceClockSec !== null ? fmtClock(raceClockSec) : fmtDuration(t.movingTimeSec)}
                big
              />
              <Stat label="Pace" value={fmtPace(t.paceSecPerKm)} big />
            </div>

            {/* Expected finish — the hero block: big time-left, date under. */}
            {timeLeftSec !== null && finishAt && (
              <div className="relay-live__finish">
                <div className="relay-live__finish-left">{fmtDuration(timeLeftSec)} left</div>
                <div className="relay-live__finish-when">
                  {/* Locale/timezone-dependent — render post-mount only. */}
                  finish ~{" "}
                  {mounted
                    ? finishAt.toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "…"}
                </div>
              </div>
            )}

            {/* Checkpoint splits — speedrun style: passed count, then the next
                few with ETAs. Replaces the old floating strip that crowded the
                bottom of the map. */}
            <CheckpointSplits waypoints={data.waypoints} />

            {/* Runners — hover highlights their legs; names link out when set. */}
            {data.runners.length > 0 && (
              <div className="relay-live__crew" onMouseLeave={() => setHighlightRunner(null)}>
                {data.runners.map((r) => (
                  <div
                    key={r.id}
                    className="relay-live__runner"
                    onMouseEnter={() => setHighlightRunner(r.id)}
                    title={`${fmtMiles(r.distanceM)} · ${fmtPace(r.paceSecPerKm)}`}
                    style={
                      highlightRunner === r.id
                        ? { opacity: 1 }
                        : highlightRunner
                          ? { opacity: 0.5 }
                          : undefined
                    }
                  >
                    <span
                      className="relay-live__dot"
                      style={{ background: r.color, color: r.color }}
                    />
                    {r.url ? (
                      <a
                        className="relay-live__runner-name"
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "inherit", textDecoration: "none", borderBottom: "1px dotted rgba(245,242,236,.4)" }}
                      >
                        {r.name}
                      </a>
                    ) : (
                      <span className="relay-live__runner-name">{r.name}</span>
                    )}
                    <span className="relay-live__runner-mi">{fmtMiles(r.distanceM, 0)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Socials — the panel's footer. */}
            <div className="relay-live__socials relay-live__socials--footer">
              {SOCIALS.map((s) => (
                <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Floating menu (replaces the hidden nav). */}
          <div className="relay-live__menu">
            <button
              type="button"
              className="relay-live__menu-btn"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
            {menuOpen && (
              <div className="relay-live__menu-pop" onMouseLeave={() => setMenuOpen(false)}>
                <Link className="relay-live__menu-link" href="/tsp/stats">
                  Full stats →
                </Link>
                {isOwner && (
                  <>
                    <Link className="relay-live__menu-link" href="/tsp/plan">
                      Plan the route
                    </Link>
                    <Link className="relay-live__menu-link" href="/tsp/manage">
                      Manage tracker
                    </Link>
                  </>
                )}
                <Link className="relay-live__menu-link" href="/photos">
                  ← Mikian.Photos
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Speedrun-timer-style checkpoint splits inside the main panel: a compact
 * "n/m passed" header, the most recent split ✓, then the next three with
 * ETAs. Full list lives on the plan/stats pages.
 */
function CheckpointSplits({ waypoints }: { waypoints: RelayData["waypoints"] }) {
  // ETAs are locale strings — render post-mount only (hydration safety).
  const mounted = useMounted();
  if (waypoints.length === 0) return null;
  const ordered = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
  const passed = ordered.filter((w) => w.passed);
  const upcoming = ordered.filter((w) => !w.passed).slice(0, 3);
  const lastPassed = passed[passed.length - 1] ?? null;
  return (
    <div className="relay-live__splits">
      <div className="relay-live__splits-head">
        Checkpoints · {passed.length}/{ordered.length}
      </div>
      {lastPassed && (
        <div className="relay-live__split is-passed">
          <span className="relay-live__split-name">✓ {lastPassed.name}</span>
          <span className="relay-live__split-eta">passed</span>
        </div>
      )}
      {upcoming.map((w, i) => (
        <div key={w.id} className={`relay-live__split${i === 0 ? " is-next" : ""}`}>
          <span className="relay-live__split-name">{w.name}</span>
          <span className="relay-live__split-eta">{mounted ? `~ ${fmtEta(w.etaAt)}` : "…"}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div className="relay-live__stat-label">{label}</div>
      <div className={`relay-live__stat-value${big ? " is-big" : ""}`}>{value}</div>
    </div>
  );
}

/** Seconds since `startMs`, ticking every second. Returns null until MOUNTED —
 *  the server-rendered HTML and the client's first paint must match (rendering
 *  Date.now() during SSR caused a hydration "36:39:20 vs 36:39:21" error), so
 *  the clock only starts after hydration; callers show a static fallback. */
function useTicker(startMs: number | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (startMs === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startMs]);
  if (startMs === null || now === null) return null;
  return Math.max(0, Math.floor((now - startMs) / 1000));
}

function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Ease a 0→1 value over `ms` on mount, driving the headline count-up. Must
 *  ALWAYS reach 1 (stats are multiplied by it) — a setTimeout safety net
 *  guarantees the end state even where rAF never fires (headless/background). */
function useCountUp(ms: number): number {
  const [v, setV] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setV(1);
    };
    const hasRaf = typeof requestAnimationFrame === "function" && typeof performance !== "undefined";
    if (hasRaf) {
      const step = (now: number) => {
        if (settled) return;
        if (startRef.current === null) startRef.current = now;
        const p = Math.min(1, (now - startRef.current) / ms);
        setV(1 - Math.pow(1 - p, 3)); // easeOutCubic
        if (p < 1) raf = requestAnimationFrame(step);
        else settled = true;
      };
      raf = requestAnimationFrame(step);
    }
    const t = setTimeout(finish, ms + 60);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [ms]);
  return v;
}
