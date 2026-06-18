"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EventEditor,
  EventPhotographers,
  ColorGroupsReview,
  RerunDetection,
  DeleteEvent,
  type AdminEvent,
} from "./EventsAdminClient";

/**
 * Per-event settings (v2.1) — the event owner manages pricing, access, detection
 * toggles, the secure link, and the photographer access list, all scoped to ONE
 * event. Reuses the editor pieces from EventsAdminClient. Reached from the
 * in-event nav ("Settings"); server-gated by canManageEvent.
 */
export function EventSettingsClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [ev, setEv] = useState<AdminEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${slug}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `HTTP ${res.status}`);
      }
      const d = (await res.json()) as { event: AdminEvent };
      setEv(d.event);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="screen" style={{ padding: "40px 24px 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 32,
              color: "var(--ink)",
            }}
          >
            Event settings
          </h1>
          <Link
            href={`/e/${slug}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            ← Back to event
          </Link>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 16, color: "var(--accent)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {ev ? (
          <div
            style={{
              marginTop: 24,
              padding: 24,
              border: "1px solid var(--line)",
              borderRadius: 12,
              display: "grid",
              gap: 22,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                color: "var(--ink)",
              }}
            >
              {ev.name}
            </div>
            <EventEditor ev={ev} onChanged={load} />
            <EventPhotographers eventId={slug} />
            <ColorGroupsReview ev={ev} />
            <RerunDetection ev={ev} />
            <DeleteEvent ev={ev} onDeleted={() => router.push("/admin/events")} />
          </div>
        ) : !error ? (
          <div style={{ marginTop: 24, color: "var(--muted)", fontSize: 14 }}>Loading…</div>
        ) : null}
      </div>
    </main>
  );
}
