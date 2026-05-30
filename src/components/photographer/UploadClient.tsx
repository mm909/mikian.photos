"use client";

import { useRouter } from "next/navigation";
import { Headline } from "@/components/runner/Headline";
import { UploadPanel, type EventLite } from "./UploadPanel";

/**
 * Standalone upload screen (/photographer/upload). Page chrome only — the
 * actual upload engine + progress lives in <UploadPanel>, shared with the
 * inline row-expand upload on the dashboard.
 */
export function UploadClient({ event }: { event: EventLite }) {
  const router = useRouter();
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
            {event.name} · {event.city}
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

        <UploadPanel event={event} onDone={() => router.push("/photographer")} />
      </div>
    </main>
  );
}
