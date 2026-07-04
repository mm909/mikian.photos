import type { Metadata } from "next";
import Link from "next/link";
import { getRelayData } from "@/lib/relay";
import { isOwnerActor } from "@/lib/permissions";
import { RelayLive } from "@/components/relay/RelayLive";

/**
 * /tsp — the public DowntownKruz (DTK) France live tracker.
 *
 * Map-forward: the route map fills the screen and the stats float over it
 * (see RelayLive). Updates whenever the crew uploads a finished segment from
 * the road (/tsp/manage) — force-dynamic so every load reads fresh data.
 */
export const dynamic = "force-dynamic";

const TSP_EVENT_ID = "tsp-france-2026";

export const metadata: Metadata = {
  title: "DowntownKruz — TSP France Live — Mikian.Photos",
  description: "Eight runners, relay-style across France. Live route, stats, and ETAs.",
};

export default async function TspTrackerPage() {
  const [data, isOwner] = await Promise.all([getRelayData(TSP_EVENT_ID), isOwnerActor()]);

  // Map-forward layout once there's at least one segment to draw.
  if (data.ready && data.segments.length > 0) {
    return <RelayLive data={data} isOwner={isOwner} />;
  }

  // Empty / not-set-up state (padded, ordinary page).
  return (
    <main className="screen" style={{ padding: "80px 24px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
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
          DowntownKruz (DTK) · TSP France
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: "clamp(30px, 4vw, 48px)",
            letterSpacing: "-.018em",
            color: "var(--ink)",
          }}
        >
          Across France, on foot.
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 18, lineHeight: 1.6 }}>
          {data.ready
            ? "The live route appears here once the first segment is uploaded from the road."
            : "The tracker isn't set up yet."}
        </p>
        {isOwner && (
          <div style={{ marginTop: 24 }}>
            <Link href="/tsp/manage" className="btn btn--primary" style={{ textDecoration: "none" }}>
              Set up the tracker →
            </Link>
            {!data.ready && (
              <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                First run <code>npm run prisma:push</code> to create the relay tables.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
