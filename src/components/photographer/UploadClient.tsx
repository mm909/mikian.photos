"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headline } from "@/components/runner/Headline";
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
}: {
  events: EventLite[];
  defaultEventId?: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(
    defaultEventId && events.some((e) => e.id === defaultEventId)
      ? defaultEventId
      : events[0].id
  );
  const selected = events.find((e) => e.id === selectedId) ?? events[0];

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
          onDone={() => router.push("/photographer")}
        />
      </div>
    </main>
  );
}
