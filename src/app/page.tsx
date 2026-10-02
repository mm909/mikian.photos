import type { Metadata, Viewport } from "next";
import { meterSnapshot } from "@/lib/homeStats";
import { Landing } from "@/components/home/Landing";

/**
 * mikianmusser.com — the front door (2026-09-03).
 *
 * The Mikian.Photos storefront hub that used to live here is retired for
 * now (moved, unlinked, to /photos — the marketplace under /e/[slug] etc. is
 * untouched). The root is a Rowtember landing: one live counter of every
 * meter rowed, and one call to action — opt in. Since 2026-09-25 the
 * counter is ALL TIME, every month (owner: "the CUMULATIVE count of
 * meters for everyone … still incrementing live"), with four figures
 * under it: rowers in, rows, time rowed, 100K finishers (homeStats.ts).
 *
 * The counter is an erg monitor, not a debt clock (owner's call,
 * 2026-09-05): it ticks one meter at a time at a split drawn from the
 * field's own pace, polls the board every 30 s and never jumps or stops
 * while the month is open — it rolls faster to catch a board that got
 * ahead, stretches its tempo as it nears a few kilometres ahead of the last
 * board read (LEAD_MAX_M), and crawls there until a row lands. Only a board
 * that went down (a fixed or deleted row) snaps it. See useLiveMeters.ts.
 *
 * ALWAYS LIGHT (owner, 2026-10-01: "keep the colors on the Mikian Musser
 * homepage the same — it should be light"). It wore Rowtember's
 * paper-or-ink switch from 2026-09-16 and went black the day Rowtember's
 * default did; it no longer reads that setting. Rowtember's colour is its
 * October orange here (components/home/theme.ts --water).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mikian Musser",
  description: "Rowtember — every meter everyone has ever rowed, counted live. Opt in.",
  openGraph: {
    title: "Mikian Musser — Rowtember",
    description: "Every meter everyone has ever rowed, counted live. Opt in.",
    images: [{ url: "/row100k/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mikian Musser — Rowtember",
    description: "Every meter everyone has ever rowed, counted live. Opt in.",
    images: ["/row100k/og.png"],
  },
};

/* The browser chrome tint: the cream of the page. */
export const viewport: Viewport = { themeColor: "#F4F3EE" };

export default async function HomePage() {
  const snapshot = await meterSnapshot();
  return <Landing snapshot={snapshot} />;
}
