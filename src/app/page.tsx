import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { meterSnapshot } from "@/lib/homeStats";
import { LOOK_COOKIE, parseLook, siteSettings, type Look } from "@/lib/rowSettings";
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
 * The look (owner, 2026-09-16): the landing wears the same paper-or-ink
 * switch as /row100k, read the same way the /row100k layout reads it —
 * the site setting, overridden by the admin's own-browser preview cookie.
 * siteSettings() never throws; the cookie read is guarded the same way.
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

async function currentLook(): Promise<Look> {
  const settings = await siteSettings();
  let look: Look = settings.look;
  try {
    const preview = parseLook(cookies().get(LOOK_COOKIE)?.value);
    if (preview) look = preview;
  } catch {
    /* cookies() outside a request scope — the site-wide look stands */
  }
  return look;
}

/* The browser chrome tint follows the ground: cream on paper, the black of
 * the ink look otherwise. */
export async function generateViewport(): Promise<Viewport> {
  const look = await currentLook();
  return { themeColor: look === "ink" ? "#0b0c0e" : "#F4F3EE" };
}

export default async function HomePage() {
  const [snapshot, look] = await Promise.all([meterSnapshot(), currentLook()]);
  return <Landing snapshot={snapshot} look={look} />;
}
