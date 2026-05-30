"use client";

import { useCallback, useEffect, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import { UploadPanel } from "./UploadPanel";

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
 * Per-event rollup table. Clicking a row toggles an inline ingest panel
 * below it — no navigation, no separate screen needed for the common case.
 */
function EventTable({ rows, onChanged }: { rows: EventRow[]; onChanged: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        <span style={{ textAlign: "right" }}>Last upload</span>
        <span style={{ textAlign: "right" }}>Earned</span>
      </div>
      {rows.map((r) => {
        const expanded = expandedId === r.eventId;
        return (
          <div key={r.eventId}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? null : r.eventId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedId(expanded ? null : r.eventId);
                }
              }}
              style={{
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
            >
              <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    color: "var(--muted)",
                    fontSize: 11,
                    transform: expanded ? "rotate(90deg)" : "none",
                    transition: "transform 0.15s",
                  }}
                >
                  ▸
                </span>
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
                  fontSize: 13,
                  color: "var(--muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.lastUploadAt ? fmtRelative(r.lastUploadAt) : "—"}
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

            {expanded && (
              <div
                style={{
                  padding: "18px 18px 24px",
                  background: "var(--cream)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
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
                  onChanged={onChanged}
                  onDone={() => setExpandedId(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
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

/**
 * "3 days ago" / "just now" — coarse buckets are enough for the dashboard.
 * Falls back to absolute date once we're past the week boundary.
 */
function fmtRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return fmtDate(iso);
  } catch {
    return iso;
  }
}
