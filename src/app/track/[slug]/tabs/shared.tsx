"use client";

import { useEffect, useState } from "react";
import type { EventKind, Snapshot, SnapshotEntry, SnapshotPosition, Units } from "@/lib/tracker/types";
import { fmtAgo } from "@/lib/tracker/format";

/**
 * What the server page hands the client before the first snapshot arrives:
 * enough to draw the header, the tab bar and one quiet card per entry, so
 * the page is never blank while the snapshot is fetched.
 */
export type InitialEvent = {
  slug: string;
  name: string;
  kind: EventKind;
  units: Units;
  timezone: string;
  /** UTC ISO. */
  start_time: string;
  public_delay_s: number;
  entries: { id: string; name: string; short_name: string; color: string }[];
};

/* ─── Hooks ──────────────────────────────────────────────────────────────── */

/**
 * True only after hydration. Every relative or locale time string ("20 s
 * ago", "3:42 PM") is gated on this: the server renders at another moment
 * and in UTC, so the strings differ and React reports a hydration mismatch
 * (the exact error the owner hit on RelayLive — see components/relay/hooks).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * The client clock, ticking once a second while the tab is visible, so the
 * race clock, "updated N s ago" and the position ages move between polls.
 * Zero until mounted (see useMounted) so the server and the first client
 * render agree.
 */
export function useNow(periodMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      setNow(Date.now());
      if (id) clearInterval(id);
      id = setInterval(() => setNow(Date.now()), periodMs);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [periodMs]);
  return now;
}

/* ─── Snapshot arithmetic ────────────────────────────────────────────────── */

/**
 * Seconds the client clock has moved since the snapshot was generated;
 * added to the snapshot's ages and clocks so they tick. Clamped at 0 — a
 * phone clock behind the server must not show "-4 s ago".
 */
export function driftS(snap: Snapshot | null, now: number): number {
  if (!snap || !now) return 0;
  const g = Date.parse(snap.generated_at);
  if (!Number.isFinite(g)) return 0;
  return Math.max(0, (now - g) / 1000);
}

/** The race clock for an entry: frozen at the finish, ticking while live. */
export function entryElapsedS(snap: Snapshot, e: SnapshotEntry, now: number): number {
  if (e.finished && e.finished_at) {
    const s = (Date.parse(e.finished_at) - Date.parse(snap.event.start_time)) / 1000;
    if (Number.isFinite(s)) return Math.max(0, s);
  }
  if (snap.event.status !== "live") return Math.max(0, e.elapsed_s);
  return Math.max(0, e.elapsed_s + driftS(snap, now));
}

/** The leader: greatest progress; null with no entries. */
export function leaderOf(snap: Snapshot | null): SnapshotEntry | null {
  if (!snap || snap.entries.length === 0) return null;
  return snap.entries.reduce((a, b) => (b.progress_m > a.progress_m ? b : a));
}

export function entryById(snap: Snapshot | null, id: string | null | undefined): SnapshotEntry | null {
  if (!snap || !id) return null;
  return snap.entries.find((e) => e.id === id) ?? null;
}

export function participantName(e: SnapshotEntry, participantId: string): string {
  return e.participants.find((p) => p.id === participantId)?.name ?? "—";
}

/** "the last 10 miles" / "the last 16 km" — the ETA estimator's window (§9). */
export function etaWindowLabel(units: Units): string {
  return units === "imperial" ? "the last 10 miles" : "the last 16 km";
}

/* ─── Elevation ──────────────────────────────────────────────────────────── */

const FT_PER_M = 3.28084;

/**
 * Metres of climb as the event's unit, whole numbers with a thousands
 * separator: "1,240" (feet when imperial, m × 3.28084) / "378" (metres).
 * The unit is set beside it as a label (elevUnit) or joined by fmtElev.
 * Hand-rolled separator rather than toLocaleString so the server and the
 * client print the same string whatever locale the phone runs.
 */
export function elevValue(m: number | null | undefined, units: Units): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "—";
  const v = Math.max(0, Math.round(units === "imperial" ? m * FT_PER_M : m));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function elevUnit(units: Units): string {
  return units === "imperial" ? "ft" : "m";
}

/** "1,240 ft" / "378 m". */
export function fmtElev(m: number | null | undefined, units: Units): string {
  const v = elevValue(m, units);
  return v === "—" ? v : `${v} ${elevUnit(units)}`;
}

/* ─── Slots (pairs) ──────────────────────────────────────────────────────── */

/**
 * The label of a 1-based slot: the event file's slot_names ("A", "B") or
 * the number. LASD26 runs in pairs (owner, 2026-10-15: "we are running two
 * by two … it should say … this is the runner for team A"), so the label
 * rides on every on-course line, leg row and runner row.
 */
export function slotLabel(e: Pick<SnapshotEntry, "slot_names">, slot: number): string {
  return e.slot_names[slot - 1] ?? String(slot);
}

/** The 1-based slot numbers of an entry: [1] for a classic relay, [1, 2] for pairs. */
export function slotNos(e: Pick<SnapshotEntry, "slots">): number[] {
  return Array.from({ length: Math.max(1, e.slots) }, (_, i) => i + 1);
}

/** A rough span for the gap card: "~40 s", "~5 min", "~1 h 12 min". */
export function fmtApprox(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return "";
  const t = Math.max(0, Math.round(s));
  if (t < 60) return `~${t} s`;
  const m = Math.round(t / 60);
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `~${h} h ${rm} min` : `~${h} h`;
}

/**
 * The public delay (§9 "build the snapshot as of now minus the delay") as
 * a label: "5 min", "45 s", "1 h 30 min". Minutes when there are any,
 * seconds under a minute. Only rendered when the delay is > 0.
 */
export function fmtDelay(s: number): string {
  const t = Math.max(0, Math.round(s));
  if (t < 60) return `${t} s`;
  const m = Math.floor(t / 60);
  const rs = t % 60;
  if (m < 60) return rs ? `${m} min ${rs} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} h ${rm} min` : `${h} h`;
}

/**
 * The same delay as the adjective in the footer sentence ("a 5-minute
 * delay", "a 45-second delay", "a 1-hour delay"); a span that is not a
 * whole number of one unit falls back to fmtDelay ("a 1 h 30 min delay").
 */
export function fmtDelayProse(s: number): string {
  const t = Math.max(0, Math.round(s));
  if (t < 60) return `${t}-second`;
  if (t % 3600 === 0) return `${t / 3600}-hour`;
  if (t % 60 === 0) return `${t / 60}-minute`;
  return fmtDelay(t);
}

/** The muted "loading / waiting" block the tabs share before the first snapshot. */
export function LoadingBlock({ status }: { status: "loading" | "error" | "ok" }) {
  return (
    <div className="loading" role="status">
      {status === "error" ? "Waiting for the first update · retrying" : "Loading live data…"}
    </div>
  );
}

/**
 * The position freshness line (§3 "never show an old position as current",
 * §11). One of:
 *   fresh    → "live · 20 s ago"
 *   stale    → "last seen 12 min ago"                 (warn)
 *   vehicle  → "showing support van · 40 s ago"       (+ "last seen" when stale)
 *   baton    → "baton phone · 20 s ago"
 * plus " · off route" when the fix is > 300 m from the route.
 *
 * With a public delay (event.public_delay_s > 0) the line never says
 * "live": the whole feed is behind by design, so a fresh position reads
 * "5 min ago · delayed" and the caller hides the pulsing dot (`delayed`).
 * A stale one keeps "last seen …" — once the delay is in the age that is
 * already the truth, and the warn tone says what matters.
 */
export type Freshness = {
  tone: "fresh" | "stale" | "none";
  parts: string[];
  offRoute: boolean;
  /** True when the event has a public delay: the position is as of then, not live. */
  delayed: boolean;
};

export function freshnessOf(pos: SnapshotPosition | null, drift: number, delayS = 0): Freshness {
  const delayed = delayS > 0;
  if (!pos) return { tone: "none", parts: ["No position yet"], offRoute: false, delayed };
  /* age_s is measured against as_of, which sits public_delay_s behind
   * generated_at, and drift only covers the time since generated_at — so
   * without the delay added here every delayed position would read `delay`
   * seconds fresher than it is (review: "live · 12 s ago" for a five-minute-old fix). */
  const age = fmtAgo(pos.age_s + drift + (delayed ? delayS : 0));
  const parts: string[] = [];
  if (pos.source === "vehicle") parts.push("showing support van");
  else if (pos.source === "baton") parts.push("baton phone");
  if (pos.stale) parts.push(`last seen ${age}`);
  else if (delayed) parts.push(age, "delayed");
  else parts.push(pos.source === "runner" ? `live · ${age}` : age);
  return { tone: pos.stale ? "stale" : "fresh", parts, offRoute: pos.off_route, delayed };
}

/* ─── Small components ───────────────────────────────────────────────────── */

type EntryLike = { short_name: string; color: string; name?: string };

/** The entry's dot: its colour with its short name inside — never colour alone. */
export function EntryDot({ entry, title }: { entry: EntryLike; title?: string }) {
  return (
    <span className="dot" style={{ background: entry.color }} title={title ?? entry.name} aria-label={entry.name ?? entry.short_name}>
      {entry.short_name}
    </span>
  );
}

/** A smaller inline tag for rows: short name on the entry colour. */
export function EntryTag({ entry }: { entry: EntryLike }) {
  return (
    <span className="etag" style={{ background: entry.color }} title={entry.name} aria-label={entry.name ?? entry.short_name}>
      {entry.short_name}
    </span>
  );
}

/**
 * The slot chip: the slot's label ("A" / "B") on the entry colour, the same
 * size as EntryTag so the two sit on one line. Only rendered when the entry
 * has more than one slot — a classic relay never shows a "1".
 */
export function SlotChip({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span className="slot" style={{ background: color }} title={title ?? `Runner ${label}`}>
      {label}
    </span>
  );
}

/**
 * The team filter (§11: "a team filter when there is more than one
 * entry"). Renders nothing with one entry — the caller does not have to
 * check. `value` null = all.
 */
export function TeamFilter({
  entries,
  value,
  onChange,
}: {
  entries: Pick<SnapshotEntry, "id" | "name" | "short_name" | "color">[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (entries.length < 2) return null;
  return (
    <div className="filter">
      <div className="seg" role="group" aria-label="Filter by team">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}>
          All
        </button>
        {entries.map((e) => (
          <button key={e.id} type="button" aria-pressed={value === e.id} onClick={() => onChange(e.id)}>
            <EntryDot entry={e} />
            <span className="sname">{e.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The status pill in the header. */
export function StatusPill({ status }: { status: Snapshot["event"]["status"] | null }) {
  if (!status) return <span className="pill">—</span>;
  if (status === "live")
    return (
      <span className="pill is-live">
        <span className="live-dot" aria-hidden /> Live
      </span>
    );
  if (status === "upcoming") return <span className="pill">Upcoming</span>;
  return <span className="pill is-finished">Finished</span>;
}
