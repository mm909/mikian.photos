"use client";

import type { Snapshot, SnapshotEntry } from "@/lib/tracker/types";
import { fmtClockDay, fmtClockRange, fmtDateTime, fmtDist, fmtDuration, fmtPace, fmtPercent } from "@/lib/tracker/format";
import { EntryDot, LoadingBlock, driftS, entryById, entryElapsedS, fmtApprox, freshnessOf, type InitialEvent } from "./shared";

/**
 * LIVE (TRACKER_SPEC.md §11): under the map, one card per entry — who is
 * running now, the progress bar, race clock, average pace, finish ETA with
 * its window, and the position freshness line — plus the gap card when
 * there are two or more entries. Before the start, a countdown. The map
 * itself is rendered by TrackerApp so it survives tab switches.
 */
export function LiveTab({
  snap,
  initial,
  now,
  mounted,
  status,
}: {
  snap: Snapshot | null;
  initial: InitialEvent;
  now: number;
  mounted: boolean;
  status: "loading" | "error" | "ok";
}) {
  if (!snap) {
    return (
      <div className="cards">
        <LoadingBlock status={status} />
        {initial.entries.map((e) => (
          <section className="card" key={e.id} aria-label={e.name}>
            <div className="card-head">
              <EntryDot entry={e} />
              <h2 className="ename">{e.name}</h2>
            </div>
            <div className="fresh is-none">No position yet</div>
          </section>
        ))}
      </div>
    );
  }

  const { event } = snap;
  const multi = snap.entries.length > 1;
  const upcoming = event.status === "upcoming";

  return (
    <div className="cards">
      {upcoming && <Countdown startIso={event.start_time} timezone={event.timezone} now={now} mounted={mounted} />}

      {multi && snap.gaps.length > 0 && !upcoming && (
        <section className="card" aria-label="Gap between entries">
          <div className="eyebrow" style={{ marginTop: 0, marginBottom: 8 }}>
            Gap
          </div>
          {snap.gaps.map((g) => {
            const a = entryById(snap, g.ahead);
            const b = entryById(snap, g.behind);
            if (!a || !b) return null;
            return (
              <div className="gap" key={`${g.ahead}-${g.behind}`}>
                <EntryDot entry={a} />
                <strong>{a.name}</strong>
                <span className="muted">leads</span>
                <EntryDot entry={b} />
                <strong>{b.name}</strong>
                <span className="muted">by</span>
                <span className="num">{fmtDist(g.distance_m, event.units)}</span>
                {g.time_s !== null && <span className="muted">· {fmtApprox(g.time_s)}</span>}
              </div>
            );
          })}
        </section>
      )}

      {snap.entries.map((e) => (
        <EntryCard key={e.id} snap={snap} e={e} now={now} mounted={mounted} />
      ))}
    </div>
  );
}

/** "9:15:20", or "17d 4:05:10" when the start is days away. */
function fmtCountdown(s: number): string {
  const days = Math.floor(s / 86400);
  return days > 0 ? `${days}d ${fmtDuration(s - days * 86400)}` : fmtDuration(s);
}

function Countdown({ startIso, timezone, now, mounted }: { startIso: string; timezone: string; now: number; mounted: boolean }) {
  const start = Date.parse(startIso);
  const left = mounted && now ? (start - now) / 1000 : null;
  return (
    <section className="card countdown" aria-label="Countdown to the start">
      <div className="eyebrow" style={{ marginTop: 0 }}>
        {left !== null && left <= 0 ? "Starting" : "Starts in"}
      </div>
      <div className="v">{left === null ? "—" : left <= 0 ? "any moment" : fmtCountdown(left)}</div>
      <div className="d">{mounted ? fmtDateTime(startIso, timezone) : ""}</div>
    </section>
  );
}

function EntryCard({ snap, e, now, mounted }: { snap: Snapshot; e: SnapshotEntry; now: number; mounted: boolean }) {
  const { units, timezone: tz } = snap.event;
  const upcoming = snap.event.status === "upcoming";
  const drift = driftS(snap, now);
  const elapsed = entryElapsedS(snap, e, now);
  const delayS = snap.event.public_delay_s;
  const fresh = freshnessOf(e.position, drift, delayS);
  /* The race clock stays on as_of + drift — the figure the snapshot vouches
   * for — and says so while the delay holds it back; a finished entry's
   * clock is its result and is not behind anything. */
  const clockDelayed = delayS > 0 && !e.finished && snap.event.status === "live";
  const oc = e.on_course;
  const pct = Math.max(0, Math.min(100, e.percent));
  const etaOk = !e.finished && e.eta.finish;

  return (
    <section className="card" aria-label={e.name}>
      <div className="card-head">
        <EntryDot entry={e} />
        <h2 className="ename">{e.name}</h2>
        {e.finished ? (
          <span className="pill is-finished">Finished</span>
        ) : oc ? (
          <span className="pill is-live">
            <span className="live-dot" aria-hidden /> On course
          </span>
        ) : null}
      </div>

      <div className="eyebrow">{e.finished ? "Result" : "Running now"}</div>
      <div className="oncourse">
        {e.finished ? (
          <>
            Finished <strong>{mounted ? fmtClockDay(e.finished_at, tz, snap.as_of) : "—"}</strong>
            <span className="sep">·</span>
            {fmtDuration(elapsed)}
          </>
        ) : oc ? (
          <>
            <strong>{oc.name}</strong>
            <span className="sep">·</span>leg {oc.leg_no}
            <span className="sep">·</span>
            {fmtDist(oc.leg_distance_m, units)}
            <span className="sep">·</span>
            {fmtPace(oc.leg_pace_s_per_km, units)}
          </>
        ) : (
          <span className="muted">Nobody marked on course yet</span>
        )}
      </div>
      {e.next_up && !e.finished && <div className="nextup">Next up: {e.next_up.name}</div>}

      <div className="prog">
        <div className="prog-row">
          <span className="pct">{fmtPercent(e.percent)}</span>
          <span className="of">
            {fmtDist(e.progress_m, units)} / {fmtDist(snap.event.length_m, units)}
          </span>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${e.name} progress`}>
          <i style={{ width: `${pct}%`, background: e.color }} />
        </div>
      </div>

      {!upcoming && (
        <div className={`stats${clockDelayed ? " is-delayed" : ""}`}>
          <div className="stat">
            <div className="k">{clockDelayed ? "Race clock (delayed)" : "Race clock"}</div>
            <div className="v">{mounted ? fmtDuration(elapsed) : "—"}</div>
          </div>
          <div className="stat">
            <div className="k">Avg pace</div>
            <div className="v">{fmtPace(e.avg_pace_s_per_km, units)}</div>
          </div>
          <div className="stat">
            <div className="k">{e.finished ? "Finished" : "Finish ETA"}</div>
            <div className="v eta">
              {e.finished ? (mounted ? fmtClockDay(e.finished_at, tz, snap.as_of) : "—") : etaOk && mounted ? `~${fmtClockDay(e.eta.finish, tz, snap.as_of)}` : "—"}
            </div>
            {etaOk && mounted && <div className="w">{fmtClockRange(e.eta.earliest, e.eta.latest, tz)}</div>}
          </div>
        </div>
      )}

      <div className={`fresh is-${fresh.tone}`}>
        {fresh.tone === "fresh" && !fresh.delayed && <span className="live-dot" aria-hidden />}
        <span>{mounted ? fresh.parts.join(" · ") : "—"}</span>
        {fresh.offRoute && (
          <>
            <span className="sep">·</span>
            <span className="off">off route</span>
          </>
        )}
      </div>
    </section>
  );
}
