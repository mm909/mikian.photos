import type { Metadata } from "next";
import Link from "next/link";
import { getRelayData } from "@/lib/relay";
import { isOwnerActor } from "@/lib/permissions";
import { RelayStats } from "@/components/relay/RelayStats";

/**
 * /tsp/stats — the immersive, dark-themed "full stats" companion to the live
 * map at /tsp. Map-first ("where are we right now", zoomed to the latest
 * legs), an elevation profile hover-synced with that map, team totals, the
 * eight (click to filter), and the every-line poster. force-dynamic so each
 * load reads fresh relay data.
 */
export const dynamic = "force-dynamic";

const TSP_EVENT_ID = "tsp-france-2026";

export const metadata: Metadata = {
  title: "DowntownKruz — Full stats — Mikian.Photos",
  description:
    "Where the team is right now, the climb ahead, and every line the eight ran across France.",
};

export default async function TspStatsPage() {
  const [data, isOwner] = await Promise.all([
    getRelayData(TSP_EVENT_ID),
    isOwnerActor(),
  ]);

  if (!data.ready || data.segments.length === 0) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14120f",
          color: "#f5f2ec",
          padding: "80px 24px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "#9a9186",
              marginBottom: 14,
            }}
          >
            DowntownKruz (DTK)
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: "clamp(26px, 4vw, 40px)",
              color: "#f5f2ec",
            }}
          >
            No route data yet
          </h1>
          <p style={{ color: "#9a9186", fontSize: 15, marginTop: 16, lineHeight: 1.6 }}>
            The full stats appear here once the first segment is uploaded from the road.
          </p>
          <div style={{ marginTop: 26 }}>
            <Link href="/tsp" className="btn btn--ghost" style={{ textDecoration: "none" }}>
              ← Back to the tracker
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <RelayStats data={data} isOwner={isOwner} />;
}
