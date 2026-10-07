"use client";

import type { Snapshot, SnapshotEntry, SnapshotLeg } from "@/lib/tracker/types";
import { distUnit, distValue, fmtClock, fmtDuration, fmtPace } from "@/lib/tracker/format";
import { LoadingBlock, TeamFilter, driftS, participantName } from "./shared";

/**
 * LEGS (TRACKER_SPEC.md §11): newest first across entries, the open leg
 * marked LIVE, every row tagged with its entry — here the leading chip IS
 * the entry's short name on its colour, because rows from different
 * entries interleave. Team filter when there is more than one entry.
 */
export function LegsTab({
  snap,
  filter,
  setFilter,
  now,
  mounted,
  status,
}: {
  snap: Snapshot | null;
  filter: string | null;
  setFilter: (id: string | null) => void;
  now: number;
  mounted: boolean;
  status: "loading" | "error" | "ok";
}) {
  if (!snap) return <LoadingBlock status={status} />;
  const { units, timezone: tz } = snap.event;
  const drift = driftS(snap, now);
  const shown = filter ? snap.entries.filter((e) => e.id === filter) : snap.entries;
  const rows = shown
    .flatMap((e) => e.legs.map((l) => ({ e, l })))
    .sort((a, b) => Number(b.l.live) - Number(a.l.live) || Date.parse(b.l.start) - Date.parse(a.l.start));

  return (
    <div className="list">
      <TeamFilter entries={snap.entries} value={filter} onChange={setFilter} />
      <section className="group" aria-label="Legs">
        {rows.length === 0 && <div className="empty">No legs yet — the first handoff starts the clock.</div>}
        {rows.map(({ e, l }) => (
          <LegRow key={`${e.id}:${l.no}`} e={e} l={l} units={units} tz={tz} drift={drift} mounted={mounted} />
        ))}
      </section>
    </div>
  );
}

function LegRow({ e, l, units, tz, drift, mounted }: { e: SnapshotEntry; l: SnapshotLeg; units: Snapshot["event"]["units"]; tz: string; drift: number; mounted: boolean }) {
  const pace = fmtPace(l.pace_s_per_km, units);
  const i = pace.indexOf(" /");
  return (
    <div className={`row${l.live ? " is-live" : ""}`}>
      <span className="chip" style={{ background: e.color }} title={e.name} aria-label={e.name}>
        {e.short_name}
      </span>
      <div className="who">
        <div className="n">
          <span className="nm">{participantName(e, l.participant_id)}</span>
          {l.live ? (
            <span className="live-badge">
              <span className="live-dot" aria-hidden /> Live
            </span>
          ) : null}
        </div>
        <div className="s">
          <span className="legno">LEG {l.no}</span>
          <span>{mounted ? `${fmtClock(l.start, tz)} → ${l.end ? fmtClock(l.end, tz) : "now"}` : "—"}</span>
        </div>
      </div>
      <div className="cols">
        <div className="c">
          <div className="v">{distValue(l.distance_m, units)}</div>
          <div className="k">{distUnit(units)}</div>
        </div>
        <div className="c">
          <div className="v">{mounted ? fmtDuration(l.live ? l.time_s + drift : l.time_s) : "—"}</div>
          <div className="k">time</div>
        </div>
        <div className="c">
          <div className="v">{i < 0 ? pace : pace.slice(0, i)}</div>
          <div className="k">{i < 0 ? `/${distUnit(units)}` : pace.slice(i + 1)}</div>
        </div>
      </div>
    </div>
  );
}
