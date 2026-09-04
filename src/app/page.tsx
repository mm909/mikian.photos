import type { Metadata, Viewport } from "next";
import { meterSnapshot } from "@/lib/homeStats";
import { Landing } from "@/components/home/Landing";

/**
 * mikianmusser.com — the front door (2026-09-03).
 *
 * The Mikian.Photos storefront hub that used to live here is retired for
 * now (moved, unlinked, to /photos — the marketplace under /e/[slug] etc. is
 * untouched). The root is a Rowtember landing: one live counter of every
 * meter rowed this September, rolling up between server syncs like a debt
 * clock, and one call to action — opt in.
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
