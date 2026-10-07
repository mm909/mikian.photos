"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RouteFile, Snapshot } from "@/lib/tracker/types";
import { fmtAgo } from "@/lib/tracker/format";
import { usePoll } from "./usePoll";
import type { MapEntry } from "./TrackerMap";
import { LiveTab } from "./tabs/LiveTab";
import { RunnersTab } from "./tabs/RunnersTab";
import { LegsTab } from "./tabs/LegsTab";
import { MeetUsTab } from "./tabs/MeetUsTab";
import { StatusPill, driftS, fmtDelay, fmtDelayProse, leaderOf, useMounted, useNow, type InitialEvent } from "./tabs/shared";

/**
 * The public spectator page, client side (TRACKER_SPEC.md §11 "Public").
 *
 * Reads exactly two things (§3 "spectators read one cached file"): the
 * route file once, and the snapshot every 15 s (usePoll: paused while the
 * tab is hidden, refetched on return, backing off on errors while keeping
 * the last good snapshot and showing an "offline · retrying" pill). Never
 * the database, never Traccar.
 *
 * Four tabs — LIVE / RUNNERS / LEGS / MEET US — in a bottom tab bar on
 * phones (top on wide screens), the active one in the URL hash so a link
 * to #runners opens there. The map is rendered here, not inside LiveTab,
 * and only hidden on the other tabs, so MapLibre is created once.
 */

const TrackerMap = dynamic(() => import("./TrackerMap"), {
  ssr: false,
  loading: () => <div className="loading">Loading map…</div>,
});

const TABS = [
  ["live", "Live"],
  ["runners", "Runners"],
  ["legs", "Legs"],
  ["meet", "Meet us"],
] as const;
type Tab = (typeof TABS)[number][0];

function tabFromHash(hash: string): Tab {
  const k = hash.replace(/^#/, "");
  return TABS.some((t) => t[0] === k) ? (k as Tab) : "live";
}

export function TrackerApp({ slug, initial, admin, dev }: { slug: string; initial: InitialEvent; admin: boolean; dev: boolean }) {
  const mounted = useMounted();
  const now = useNow(1000);
  const [tab, setTab] = useState<Tab>("live");
  const [filter, setFilter] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);

  /* The tab lives in the hash: deep links work, back/forward too. */
  useEffect(() => {
    const apply = () => setTab(tabFromHash(window.location.hash));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const go = useCallback((t: Tab) => {
    setTab(t);
    const url = t === "live" ? window.location.pathname + window.location.search : `#${t}`;
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  const route = usePoll<RouteFile>(`/api/track/${slug}/route`, { intervalMs: 300_000, once: true });
  const poll = usePoll<Snapshot>(`/api/track/${slug}/snapshot`, { intervalMs: 15_000 });
  const snap = poll.data;
  const status: "loading" | "error" | "ok" = poll.loading ? "loading" : snap ? "ok" : "error";

  /* With one entry there is nothing to filter; drop a stale filter too. */
  const entryCount = snap?.entries.length ?? initial.entries.length;
  useEffect(() => {
    if (entryCount < 2 && filter !== null) setFilter(null);
  }, [entryCount, filter]);

  const leader = leaderOf(snap);
  const leaderId = leader?.id ?? null;
  const mapEntries = useMemo<MapEntry[]>(
    () =>
      snap
        ? snap.entries.map((e) => ({
            id: e.id,
            name: e.name,
            short_name: e.short_name,
            color: e.color,
            progress_m: e.progress_m,
            position: e.position ? { lat: e.position.lat, lon: e.position.lon, stale: e.position.stale, off_route: e.position.off_route, source: e.position.source } : null,
          }))
        : initial.entries.map((e) => ({ ...e, progress_m: 0, position: null })),
    [snap, initial.entries],
  );
  const stopFollow = useCallback(() => setFollow(false), []);

  /* "updated N s ago", ticking from generated_at on the client clock. */
  const updated = snap && mounted ? `updated ${fmtAgo(driftS(snap, now))}` : "—";
  const retryIn = poll.nextAt && now ? Math.max(0, Math.round((poll.nextAt - now) / 1000)) : null;
  const offline = poll.failures > 0;

  /* The public delay (§9) is event config, so the shell already knows it:
   * the DELAYED pill and the footer line are there from the first paint.
   * The review found nothing on the page said positions were held back;
   * with a delay of 0 none of this renders and the page is as before. */
  const delayS = snap?.event.public_delay_s ?? initial.public_delay_s;

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-in">
          <h1>{initial.name}</h1>
          <div className="hdr-right">
            <span style={{ display: "inline-flex", gap: 6 }}>
              {dev && <span className="pill is-dev">dev</span>}
              {delayS > 0 && <span className="pill is-delayed">Delayed {fmtDelay(delayS)}</span>}
              {offline ? (
                <span className="pill is-off" role="status">
                  offline{retryIn !== null ? ` · retry ${retryIn}s` : " · retrying"}
                </span>
              ) : (
                <StatusPill status={snap?.event.status ?? null} />
              )}
            </span>
            <span className={`upd${offline ? " is-off" : ""}`} aria-live="off">
              {updated}
            </span>
          </div>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => go(k)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="main">
        <div className={`map-wrap${tab === "live" ? "" : " is-hidden"}`}>
          <TrackerMap route={route.data} entries={mapEntries} follow={follow} leaderId={leaderId} onUserInteract={stopFollow} />
          {!route.data && route.failures > 0 && <div className="map-note is-right">Route unavailable · retrying</div>}
          <button type="button" className="map-follow" aria-pressed={follow} onClick={() => setFollow((f) => !f)} disabled={!leader?.position}>
            {follow ? "Following" : "Follow"}
          </button>
        </div>

        {tab === "live" && <LiveTab snap={snap} initial={initial} now={now} mounted={mounted} status={status} />}
        {tab === "runners" && <RunnersTab snap={snap} filter={filter} setFilter={setFilter} admin={admin} now={now} mounted={mounted} status={status} />}
        {tab === "legs" && <LegsTab snap={snap} filter={filter} setFilter={setFilter} now={now} mounted={mounted} status={status} />}
        {tab === "meet" && <MeetUsTab snap={snap} mounted={mounted} status={status} />}
      </main>

      <footer className="foot">
        Positions come from runners&rsquo; phones; times are estimates.
        {delayS > 0 && <> Positions are shown with a {fmtDelayProse(delayS)} delay.</>}
      </footer>
    </div>
  );
}
