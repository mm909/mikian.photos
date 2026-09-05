import type { Metadata, Viewport } from "next";
import { meterSnapshot } from "@/lib/homeStats";
import { Landing } from "@/components/home/Landing";

/**
 * mikianmusser.com — the front door (2026-09-03).
 *
 * The Mikian.Photos storefront hub that used to live here is retired for
 * now (moved, unlinked, to /photos — the marketplace under /e/[slug] etc. is
 * untouched). The root is a Rowtember landing: one live counter of every
 * meter rowed this September, and one call to action — opt in.
 *
 * The counter is an erg monitor, not a debt clock (owner's call,
 * 2026-09-05): it ticks one meter at a time at a split drawn from the
 * field's own pace, polls the board every 30 s and never jumps or stops
 * while the month is open — it rolls faster to catch a board that got
 * ahead, stretches its tempo as it nears a few kilometres ahead of the last
 * board read (LEAD_MAX_M), and crawls there until a row lands. Only a board
 * that went down (a fixed or deleted row) snaps it. See useLiveMeters.ts.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mikian Musser",
  description:
    "Rowtember 2026 — every meter rowed this September, counted live. Opt in.",
  openGraph: {
    title: "Mikian Musser — Rowtember 2026",
    description: "Every meter rowed this September, counted live. Opt in.",
    images: [{ url: "/row100k/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mikian Musser — Rowtember 2026",
    description: "Every meter rowed this September, counted live. Opt in.",
    images: ["/row100k/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

export default async function HomePage() {
  const snapshot = await meterSnapshot();
  return <Landing snapshot={snapshot} />;
}
