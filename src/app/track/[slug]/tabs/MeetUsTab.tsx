"use client";

import type { Snapshot, SnapshotCheckpoint, SnapshotEntry } from "@/lib/tracker/types";
import { fmtClockDay, fmtClockRange, fmtDist } from "@/lib/tracker/format";
import { EntryDot, LoadingBlock, etaWindowLabel } from "./shared";

/**
 * MEET US (TRACKER_SPEC.md §11): the checkpoint list — towns, exchanges,
 * aid stations and the finish (the start is hidden; nobody drives to it
 * after the gun) — with, per entry, the time it passed or its ETA and
 * window. The finish row is emphasised. One entry → a plain two-column
 * list; several → one column per entry, headed by the entry's dot.
 *
 * Checkpoints come from each entry's own list (per-entry routes are phase
 * 6), unioned by id and ordered along the route, so a later event with
 * different routes per entry still renders one table.
 */
export function MeetUsTab({ snap, mounted, status }: { snap: Snapshot | null; mounted: boolean; status: "loading" | "error" | "ok" }) {
  if (!snap) return <LoadingBlock status={status} />;
  const { entries } = snap;
  const { units, timezone: tz } = snap.event;

  const byId = new Map<string, SnapshotCheckpoint>();
  for (const e of entries) for (const cp of e.checkpoints) if (cp.kind !== "start" && !byId.has(cp.id)) byId.set(cp.id, cp);
  const cps = Array.from(byId.values()).sort((a, b) => a.route_m - b.route_m);
  const hasFinish = cps.some((cp) => cp.kind === "finish");
  const multi = entries.length > 1;
  const cols = `minmax(0,1.3fr) repeat(${Math.max(1, entries.length)}, minmax(0,1fr))`;

  return (
    <div className="list">
      <section className="cp" aria-label="Checkpoints">
        {multi && (
          <div className="cp-head" style={{ gridTemplateColumns: cols }}>
            <div className="mono">Checkpoint</div>
            {entries.map((e) => (
              <div className="h" key={e.id}>
                <EntryDot entry={e} />
                <span className="hn">{e.name}</span>
              </div>
            ))}
          </div>
        )}
        {cps.length === 0 && !hasFinish && <div className="empty">No checkpoints listed for this event yet.</div>}
        {cps.map((cp) => (
          <div className={`cp-row${cp.kind === "finish" ? " is-finish" : ""}`} style={{ gridTemplateColumns: cols }} key={cp.id}>
            <div className="cp-name">
              <div className="n">{cp.name}</div>
              <div className="m">
                {cp.kind === "finish" ? "Finish · " : cp.kind === "exchange" ? "Exchange · " : cp.kind === "aid" ? "Aid · " : ""}
                {fmtDist(cp.route_m, units)}
              </div>
            </div>
            {entries.map((e) => (
              <Cell key={e.id} e={e} cp={e.checkpoints.find((c) => c.id === cp.id) ?? null} finish={cp.kind === "finish"} tz={tz} asOf={snap.as_of} mounted={mounted} />
            ))}
          </div>
        ))}
        {!hasFinish && (
          /* No finish checkpoint in the file: the entry's own finish ETA still gets a row. */
          <div className="cp-row is-finish" style={{ gridTemplateColumns: cols }}>
            <div className="cp-name">
              <div className="n">Finish</div>
              <div className="m">{fmtDist(snap.event.length_m, units)}</div>
            </div>
            {entries.map((e) => (
              <Cell key={e.id} e={e} cp={null} finish tz={tz} asOf={snap.as_of} mounted={mounted} />
            ))}
          </div>
        )}
      </section>
      <p className="cp-note">ETAs are estimates from {etaWindowLabel(units)} of pace.</p>
    </div>
  );
}

function Cell({ e, cp, finish, tz, asOf, mounted }: { e: SnapshotEntry; cp: SnapshotCheckpoint | null; finish: boolean; tz: string; asOf: string; mounted: boolean }) {
  // The finish row falls back to the entry's own result / ETA when the
  // checkpoint itself carries none (or does not exist in the file).
  const passedAt = cp?.passed_at ?? (finish && e.finished ? e.finished_at : null);
  const eta = cp?.eta ?? (finish ? e.eta.finish : null);
  const lo = cp?.eta_earliest ?? (finish ? e.eta.earliest : null);
  const hi = cp?.eta_latest ?? (finish ? e.eta.latest : null);

  if (!mounted) return <div className="cp-cell"><div className="t">—</div></div>;
  if (passedAt) {
    return (
      <div className="cp-cell">
        <div className="t is-passed">{fmtClockDay(passedAt, tz, asOf)}</div>
        <div className="k">{finish ? "finished" : "passed"}</div>
      </div>
    );
  }
  if (eta) {
    return (
      <div className="cp-cell">
        <div className="t">~{fmtClockDay(eta, tz, asOf)}</div>
        <div className="w">{fmtClockRange(lo, hi, tz)}</div>
      </div>
    );
  }
  return (
    <div className="cp-cell">
      <div className="t muted">—</div>
      <div className="k">eta soon</div>
    </div>
  );
}
