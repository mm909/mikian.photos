"use client";

import { useCallback, useEffect, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import { UploadPanel, type UploadStatus } from "./UploadPanel";

type Props = {
  /** First name to greet with. Passed from the server actor lookup. */
  name: string;
  /** Email shown in the mono "Photographer · …" chip above the headline. */
  email: string;
};

type EventRow = {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  eventCity: string | null;
  photoCount: number;
  lastUploadAt: string | null;
  /** Number of orders covering this event. */
  orderCount: number;
  /** Finalized photos that never got bib/face detection ("dead photos"). */
  undetectedCount: number;
  /** Revenue (USD) earned from this event's orders. Optional — server only
   *  populates it for the owner; dimmed / em-dash when missing. */
  earnedUsd?: number;
};

/**
 * Photographer dashboard — landing page for everyone with a photographer role.
 *
 * Per-event rollup table. Clicking a row expands it in place to reveal a
 * drag-and-drop ingest panel (the same <UploadPanel> the standalone
 * /photographer/upload screen uses) so the photographer can drop a batch
 * without leaving the dashboard. Upload progress, ETA, bib + face detection,
 * and duplicate/fail handling all surface inline.
 *
 * The owner sees every event in the system here; non-owner sees only events
 * they've personally uploaded to.
 */
export function PhotographerDashboardClient({ name, email }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadEvents = useCallback(() => {
    return fetch("/api/photographer/events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`events ${r.status}`))))
      .then((d: { events: EventRow[]; totalPhotos: number; isAdmin: boolean }) => {
        setEvents(d.events);
        setTotalPhotos(d.totalPhotos);
        setIsAdmin(d.isAdmin);
      })
      .catch((e) => {
        console.warn("dashboard events fetch failed:", e);
        setEvents([]);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    loadEvents().finally(() => setLoading(false));
  }, [loadEvents]);

  const firstName = name.split(" ")[0] || name;

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 6,
            }}
          >
            Photographer · {email}
          </div>
          <Headline
            as="h1"
            text={`Hi, ${firstName}.`}
            accent={firstName}
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 44,
              letterSpacing: "-.018em",
            }}
          />
        </div>

        {/* Section heading + total. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 22,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            {isAdmin ? "All events" : "Your events"}
          </h2>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            {events.length} event{events.length === 1 ? "" : "s"} ·{" "}
            {totalPhotos.toLocaleString()} photo{totalPhotos === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : events.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--cream)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              color: "var(--muted)",
              fontSize: 15,
            }}
          >
            No events yet.
          </div>
        ) : (
          <EventTable rows={events} onChanged={loadEvents} />
        )}
      </div>
    </main>
  );
}

const GRID_COLS = "1.6fr 100px 120px 110px";

/**
 * Per-event rollup table. Clicking a row toggles an inline ingest panel below
 * it; you can also drag-drop photos straight onto a row to start uploading
 * without opening it first. Active uploads keep running when a row is collapsed
 * (the panel stays mounted, hidden) and the row shows a live status badge.
 */
function EventTable({ rows, onChanged }: { rows: EventRow[]; onChanged: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Events whose UploadPanel is mounted. We keep a panel mounted after collapse
  // (it just hides) so an in-flight upload isn't torn down — only Done unmounts.
  const [mountedIds, setMountedIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, UploadStatus>>({});
  // Files dropped onto a row, handed to that event's panel to ingest.
  const [pending, setPending] = useState<Record<string, File[]>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleStatus = useCallback((id: string, s: UploadStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: s }));
  }, []);

  function toggle(id: string) {
    if (expandedId === id) {
      setExpandedId(null); // collapse — keep the panel mounted so upload continues
    } else {
      setMountedIds((s) => new Set(s).add(id));
      setExpandedId(id);
    }
  }

  function dropFiles(id: string, fileList: FileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setPending((p) => ({ ...p, [id]: [...(p[id] ?? []), ...files] }));
    setMountedIds((s) => new Set(s).add(id));
    setExpandedId(id);
  }

  function consumePending(id: string) {
    setPending((p) => {
      if (!(id in p)) return p;
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  function done(id: string) {
    setExpandedId((curr) => (curr === id ? null : curr));
    // If detection is still backfilling in the background, keep the panel
    // mounted (just collapsed) so it keeps running — the row badge shows
    // progress. Only fully unmount once everything's idle.
    if (statuses[id]?.working) return;
    setMountedIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setStatuses((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID_COLS,
          gap: 12,
          padding: "12px 18px",
          background: "var(--cream)",
          borderBottom: "1px solid var(--line)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        <span>Event</span>
        <span style={{ textAlign: "right" }}>Photos</span>
        <span style={{ textAlign: "right" }}>Orders</span>
        <span style={{ textAlign: "right" }}>Earned</span>
      </div>
      {rows.map((r) => {
        const expanded = expandedId === r.eventId;
        const mounted = mountedIds.has(r.eventId);
        const st = statuses[r.eventId];
        const working = Boolean(st?.working);
        const dragOver = dragOverId === r.eventId;
        return (
          <div key={r.eventId}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              onClick={() => toggle(r.eventId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(r.eventId);
                }
              }}
              // Drag photos straight onto the row to upload — no need to open it.
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverId !== r.eventId) setDragOverId(r.eventId);
              }}
              onDragLeave={(e) => {
                // Only clear when the pointer actually leaves the row (not when
                // moving between child cells).
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOverId((cur) => (cur === r.eventId ? null : cur));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverId(null);
                dropFiles(r.eventId, e.dataTransfer.files);
              }}
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: GRID_COLS,
                gap: 12,
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                color: "var(--ink)",
                fontSize: 14,
                alignItems: "center",
                cursor: "pointer",
                background: expanded ? "var(--cream)" : "var(--surface)",
                transition: "background 0.12s",
              }}
              title="Click to open, or drop photos here to upload"
            >
              {/* Drag-over: show the dropzone prompt instead of an outline box.
                  Only on collapsed rows — the expanded panel owns its own prompt. */}
              <DropPrompt active={dragOver && !expanded} compact />
              <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-serif)",
                      fontWeight: 500,
                      fontSize: 16,
                      color: "var(--ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.eventName}
                  </span>
                  {/* While work is in flight, the meta line becomes a live status
                      badge; otherwise it shows the event date + city. */}
                  {working && st ? (
                    <UploadBadge st={st} />
                  ) : (
                    <span
                      style={{
                        display: "block",
                        marginTop: 2,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        letterSpacing: ".06em",
                        color: "var(--muted)",
                      }}
                    >
                      {[r.eventDate ? fmtDate(r.eventDate) : null, r.eventCity]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
              </span>
              <span
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-serif)",
                  fontWeight: 500,
                  fontSize: 20,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.photoCount.toLocaleString()}
              </span>
              <span
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-serif)",
                  fontWeight: 500,
                  fontSize: 18,
                  fontVariantNumeric: "tabular-nums",
                  color: r.orderCount > 0 ? "var(--ink)" : "var(--line)",
                }}
              >
                {r.orderCount.toLocaleString()}
              </span>
              {/* Earned (USD) — dim/em-dash until there's revenue to show. */}
              <span
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-serif)",
                  fontWeight: 500,
                  fontSize: 18,
                  fontVariantNumeric: "tabular-nums",
                  color: r.earnedUsd && r.earnedUsd > 0 ? "var(--ink)" : "var(--line)",
                }}
              >
                {r.earnedUsd == null ? "—" : `$${r.earnedUsd.toFixed(2)}`}
              </span>
            </div>

            {/* The panel stays mounted once opened/dropped-on (just hidden when
                collapsed) so an in-flight upload survives minimizing the row.
                The whole expanded area is a drop target too (the inner dropzone
                stops propagation, so drops there don't double-add). */}
            {mounted && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverId !== r.eventId) setDragOverId(r.eventId);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragOverId((cur) => (cur === r.eventId ? null : cur));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverId(null);
                  dropFiles(r.eventId, e.dataTransfer.files);
                }}
                style={{
                  position: "relative",
                  display: expanded ? "block" : "none",
                  padding: "18px 18px 24px",
                  background: "var(--cream)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                {/* Drag-over the open panel (even mid-upload) → show the drop
                    prompt instead of an outline box. */}
                <DropPrompt active={dragOver} />
                <FixDeadPhotos
                  eventId={r.eventId}
                  initialCount={r.undetectedCount}
                  onChanged={onChanged}
                />
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    marginBottom: 14,
                  }}
                >
                  Upload to {r.eventName}
                </div>
                <UploadPanel
                  event={{
                    id: r.eventId,
                    name: r.eventName,
                    date: r.eventDate ?? "",
                    city: r.eventCity ?? "",
                  }}
                  compact
                  autoStart
                  pendingFiles={pending[r.eventId]}
                  onPendingConsumed={() => consumePending(r.eventId)}
                  onStatus={(s) => handleStatus(r.eventId, s)}
                  onChanged={onChanged}
                  onDone={() => done(r.eventId)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * "Fix dead photos" — finalized photos that never got bib/face detection (e.g.
 * an upload tab closed mid-tagging). Loops the per-event backfill endpoint
 * (server-side detection, a batch at a time) until none remain. It's resumable:
 * each click processes whatever's still untagged.
 */
function FixDeadPhotos({
  eventId,
  initialCount,
  onChanged,
}: {
  eventId: string;
  initialCount: number;
  onChanged: () => void;
}) {
  const [remaining, setRemaining] = useState(initialCount);
  const [processed, setProcessed] = useState(0);
  const [fixing, setFixing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRemaining(initialCount);
  }, [initialCount]);

  async function fix() {
    setFixing(true);
    setErr(null);
    setProcessed(0);
    try {
      let done = 0;
      // Loop the bounded backfill until the server reports nothing left.
      for (let guard = 0; guard < 100000; guard++) {
        const res = await fetch(`/api/photographer/events/${eventId}/backfill`, {
          method: "POST",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const d = (await res.json()) as { processed: number; remaining: number };
        done += d.processed;
        setProcessed(done);
        setRemaining(d.remaining);
        if (d.remaining <= 0) break;
        if (d.processed === 0) {
          setErr("Some photos couldn't be tagged (they may be unreadable). Try again later.");
          break;
        }
      }
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setFixing(false);
    }
  }

  if (remaining <= 0 && !fixing) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 14px",
        marginBottom: 14,
        borderRadius: 8,
        border: "1px solid var(--accent)",
        background: "rgba(200,64,26,.05)",
      }}
    >
      <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, minWidth: 0 }}>
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{remaining}</strong> photo
        {remaining === 1 ? "" : "s"} still need tagging (bib + face) — detection didn&rsquo;t
        finish. Run it now (on the server, no need to re-upload).
        {err && (
          <div style={{ color: "var(--accent)", marginTop: 4, fontSize: 12 }}>{err}</div>
        )}
      </div>
      <button
        className="btn btn--primary btn--sm"
        style={{ flexShrink: 0 }}
        onClick={() => void fix()}
        disabled={fixing}
      >
        {fixing
          ? `Fixing… ${processed} done · ${remaining} left`
          : `Fix ${remaining} dead photo${remaining === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

/**
 * Drag-over affordance — an absolute dashed "drop here" prompt shown over a row
 * or the open panel while files are dragged across it (instead of an outline).
 * pointer-events:none so the drop still lands on the element underneath.
 */
function DropPrompt({ active, compact }: { active: boolean; compact?: boolean }) {
  if (!active) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: compact ? 0 : 8,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: "2px dashed var(--accent)",
        // Opaque so it fully covers whatever's behind (no see-through doubling
        // with the panel's own dropzone text, and no blur artifact).
        background: "var(--cream)",
        pointerEvents: "none",
        fontFamily: "var(--font-mono)",
        fontSize: compact ? 11 : 13,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: "var(--accent)",
      }}
    >
      Drop photos here
    </div>
  );
}

/**
 * Live status pill shown on a collapsed (or open) row while an upload is in
 * flight — so closing the panel clearly doesn't stop the work.
 */
function UploadBadge({ st }: { st: UploadStatus }) {
  const active = Math.max(st.total - st.skipped, 0);
  // Upload phase shows uploaded/active; once uploads are in, the badge flips to
  // the background detection phase (tagging) showing detected/active.
  let label: string;
  let count: string;
  let spinning = false;
  if (st.running) {
    label = "Uploading";
    count = `${st.uploaded}/${active}`;
    spinning = true;
  } else if (st.paused) {
    label = "Paused";
    count = `${st.uploaded}/${active}`;
  } else {
    label = "Tagging";
    count = `${st.done}/${active}`;
    spinning = st.detectingPhase;
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 3,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".06em",
        color: "var(--accent)",
      }}
    >
      {spinning ? (
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            border: "2px solid var(--line)",
            borderTopColor: "var(--accent)",
            animation: "spin .8s linear infinite",
            display: "inline-block",
          }}
        />
      ) : st.paused ? (
        <span aria-hidden>⏸</span>
      ) : null}
      <span>
        {label} {count}
        {st.failed > 0 ? ` · ${st.failed} failed` : ""}
      </span>
    </span>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
