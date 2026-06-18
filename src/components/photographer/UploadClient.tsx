"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Headline } from "@/components/runner/Headline";
import { EventPhotographers } from "@/components/admin/EventsAdminClient";
import { UploadPanel, type EventLite } from "./UploadPanel";

/**
 * Standalone upload screen (/photographer/upload). Page chrome only — the
 * actual upload engine + progress lives in <UploadPanel>, shared with the
 * inline row-expand upload on the dashboard.
 *
 * Multi-event: when the photographer can upload to more than one event, a
 * picker selects which event the dropzone attaches uploads to. Switching events
 * remounts the panel (keyed on event id) so the queue resets.
 */
export function UploadClient({
  events,
  defaultEventId,
  canManagePhotographers = false,
}: {
  events: EventLite[];
  defaultEventId?: string;
  /** Show the "add photographers" panel for the selected event (owner/admin). */
  canManagePhotographers?: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(
    defaultEventId && events.some((e) => e.id === defaultEventId)
      ? defaultEventId
      : events[0].id
  );
  const selected = events.find((e) => e.id === selectedId) ?? events[0];

  // Absolute upload link to share with other photographers. Built from the live
  // origin after mount (so the value matches SSR's relative path on first paint,
  // then upgrades — no hydration mismatch).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const uploadShareUrl = `${origin}/e/${selected.id}/upload`;
  const [copied, setCopied] = useState(false);
  async function copyShareLink() {
    try {
      await navigator.clipboard?.writeText(uploadShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 8,
            }}
          >
            {selected.name} · {selected.city}
          </div>
          <Headline
            as="h1"
            text="Upload your photos."
            accent="your photos."
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 40,
              letterSpacing: "-.015em",
              lineHeight: 1.05,
            }}
          />
        </div>

        {events.length > 1 && (
          <div style={{ marginBottom: 24, maxWidth: 360 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 6,
              }}
            >
              Uploading to
            </div>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--line)",
                borderRadius: 6,
                fontSize: 14,
                color: "var(--ink)",
              }}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <UploadPanel
          key={selected.id}
          event={selected}
          onDone={() => router.push("/")}
        />

        {/* Owner/admin: share the upload link + manage who else can upload.
            Scoped to the selected event; the photographers API enforces access. */}
        {canManagePhotographers && (
          <div style={{ marginTop: 36, display: "grid", gap: 28 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                Upload link
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Share this with other photographers so they can upload to{" "}
                <strong style={{ color: "var(--ink)" }}>{selected.name}</strong>. They sign in and
                request access; approve them below before they can upload (or add them directly).
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  readOnly
                  value={uploadShareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    flex: 1,
                    minWidth: 240,
                    padding: "8px 10px",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    fontSize: 13,
                    background: "var(--paper, #fff)",
                    color: "var(--ink)",
                  }}
                />
                <button className="btn btn--ghost" onClick={() => void copyShareLink()}>
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
            </div>
            <EventPhotographers eventId={selected.id} />
          </div>
        )}
      </div>
    </main>
  );
}
