"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Headline } from "@/components/runner/Headline";

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
};

/**
 * Photographer dashboard — landing page for everyone with a photographer role.
 *
 * Re-scoped (May 2026) from a per-photographer photo grid into a per-event
 * rollup table. The reasoning:
 *   - The grid here was a near-duplicate of /photographer/photos, which
 *     confused the "where do I go to manage my photos" path.
 *   - At MVP scale (10s of events at most), an event table gives the
 *     photographer the right mental model: "here are the races I've shot;
 *     click into one to browse its library."
 *
 * The owner sees every event in the system here (cross-photographer
 * overview); non-owner sees only events they've personally uploaded to.
 *
 * Clicking a row deep-links to /photographer/photos?eventId=<id> which
 * filters the library page to that event.
 */
export function PhotographerDashboardClient({ name, email }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/photographer/events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`events ${r.status}`))))
      .then((d: { events: EventRow[]; totalPhotos: number; isAdmin: boolean }) => {
        if (cancelled) return;
        setEvents(d.events);
        setTotalPhotos(d.totalPhotos);
        setIsAdmin(d.isAdmin);
      })
      .catch((e) => {
        console.warn("dashboard events fetch failed:", e);
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = name.split(" ")[0] || name;

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Header — center-aligned so the Ingest button sits middle-aligned
            with the headline block. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          <div>
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
          <Link href="/photographer/upload" className="btn btn--primary">
            Ingest photos →
          </Link>
        </div>

        {/* Section heading + total. Single line replaces the old pill stats
            row. Admins see "all events"; non-admins see their own work. */}
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
            No events yet. Drop your first batch via the Ingest button above.
          </div>
        ) : (
          <EventTable rows={events} />
        )}
      </div>
    </main>
  );
}

/**
 * Per-event rollup table. Each row links to the library page scoped to
 * that event so the photographer can browse + manage individual photos.
 *
 * Mobile: the columns collapse via grid-template gracefully — we don't
 * try to be clever, just keep the row clickable as a whole.
 */
function EventTable({ rows }: { rows: EventRow[] }) {
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
          gridTemplateColumns: "1.6fr 100px 120px 140px",
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
        <span style={{ textAlign: "right" }}>Browse</span>
      </div>
      {rows.map((r) => (
        <Link
          key={r.eventId}
          href={`/photographer/photos?eventId=${encodeURIComponent(r.eventId)}`}
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 100px 120px 140px",
            gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            textDecoration: "none",
            color: "var(--ink)",
            fontSize: 14,
            alignItems: "center",
            transition: "background 0.12s",
          }}
        >
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
              {[
                r.eventDate ? fmtDate(r.eventDate) : null,
                r.eventCity,
              ]
                .filter(Boolean)
                .join(" · ")}
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
          <span
            style={{
              textAlign: "right",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--ink)",
            }}
          >
            View library →
          </span>
        </Link>
      ))}
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
