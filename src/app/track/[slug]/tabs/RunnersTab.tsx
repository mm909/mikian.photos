"use client";

import type { Snapshot, SnapshotEntry, SnapshotParticipant } from "@/lib/tracker/types";
import { distUnit, distValue, fmtAgo, fmtPace } from "@/lib/tracker/format";
import { EntryDot, EntryTag, LoadingBlock, TeamFilter } from "./shared";

/**
 * RUNNERS (TRACKER_SPEC.md §11): per-participant rows — legs, distance,
 * pace — grouped by entry in the entry's sort order, with the team filter
 * when there is more than one entry. The row's chip is the participant's
 * initials on the entry colour; the entry SHORT NAME rides beside the name
 * so a row never relies on colour alone.
 *
 * Admin only: a dim "phone: 45 s ago · 72%" line from device_last_seen, the
 * same check /join shows each runner — kept subtle, it is not for spectators.
 */
export function RunnersTab({
  snap,
  filter,
  setFilter,
  admin,
  now,
  mounted,
  status,
}: {
  snap: Snapshot | null;
  filter: string | null;
  setFilter: (id: string | null) => void;
  admin: boolean;
  now: number;
  mounted: boolean;
  status: "loading" | "error" | "ok";
}) {
  if (!snap) return <LoadingBlock status={status} />;
  const multi = snap.entries.length > 1;
  const shown = filter ? snap.entries.filter((e) => e.id === filter) : snap.entries;
  const units = snap.event.units;

  return (
    <div className="list">
      <TeamFilter entries={snap.entries} value={filter} onChange={setFilter} />
      {shown.map((e) => (
        <section className="group" key={e.id} aria-label={e.name}>
          {multi && (
            <div className="group-head">
              <EntryDot entry={e} />
              <span className="gname">{e.name}</span>
              <span className="legno">
                {e.participants.length} {e.participants.length === 1 ? "runner" : "runners"}
              </span>
            </div>
          )}
          {e.participants.length === 0 && <div className="empty">No runners listed yet.</div>}
          {e.participants.map((p) => (
            <ParticipantRow key={p.id} e={e} p={p} units={units} multi={multi} admin={admin} now={now} mounted={mounted} />
          ))}
        </section>
      ))}
    </div>
  );
}

/** "7:05 /mi" → ["7:05", "/mi"] so the unit can sit in the small label. */
function splitPace(sPerKm: number | null, units: Snapshot["event"]["units"]): [string, string] {
  const s = fmtPace(sPerKm, units);
  const i = s.indexOf(" /");
  return i < 0 ? [s, `/${distUnit(units)}`] : [s.slice(0, i), s.slice(i + 1)];
}

function ParticipantRow({
  e,
  p,
  units,
  multi,
  admin,
  now,
  mounted,
}: {
  e: SnapshotEntry;
  p: SnapshotParticipant;
  units: Snapshot["event"]["units"];
  multi: boolean;
  admin: boolean;
  now: number;
  mounted: boolean;
}) {
  const [pace, paceUnit] = splitPace(p.avg_pace_s_per_km, units);
  const phoneAge = p.device_last_seen && now ? (now - Date.parse(p.device_last_seen)) / 1000 : null;
  return (
    <div className={`row${p.on_course ? " is-live" : ""}`}>
      <span className="chip" style={{ background: e.color }} aria-hidden>
        {p.initials}
      </span>
      <div className="who">
        <div className="n">
          {multi && <EntryTag entry={e} />}
          <span className="nm">{p.name}</span>
        </div>
        <div className={`s${p.on_course ? " is-on" : ""}`}>
          {p.on_course ? (
            <>
              <span className="live-dot" aria-hidden /> on course now
            </>
          ) : p.legs > 0 ? (
            `${p.legs} ${p.legs === 1 ? "leg" : "legs"} done`
          ) : (
            "not yet run"
          )}
        </div>
        {admin && (
          <div className="s dim">
            phone: {!mounted ? "—" : phoneAge === null ? "no fix yet" : fmtAgo(phoneAge)}
            {p.device_battery_pct !== null && ` · ${Math.round(p.device_battery_pct)}%`}
          </div>
        )}
      </div>
      <div className="cols">
        <div className="c">
          <div className="v">{p.legs}</div>
          <div className="k">legs</div>
        </div>
        <div className="c">
          <div className="v">{distValue(p.distance_m, units)}</div>
          <div className="k">{distUnit(units)}</div>
        </div>
        <div className="c">
          <div className="v">{pace}</div>
          <div className="k">{paceUnit}</div>
        </div>
      </div>
    </div>
  );
}
