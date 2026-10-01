import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { INK, PAPER } from "@/lib/rowPalette";
import { RowSite } from "./RowSite";
import { siteLook, sitePalette, siteSettingsOnce } from "./sitePalette";

/* The one wrapper every /row100k page renders inside (owner, 2026-09-16).
 * It reads the site switches once per request (src/lib/rowSettings.ts,
 * fails open to the defaults) and hands three of them down through RowSite:
 * the look — the white-on-black ink, the default since 2026-10-01, or the
 * paper of September — the palette (rowPalette.ts: the accent every page
 * wears through --water, cut for that look), and the share cards that are
 * switched off.
 *
 * The look can be previewed on one browser through LOOK_COOKIE, which the
 * settings route sets for an admin; the palette through PALETTE_COOKIE,
 * which the middleware sets from ?palette=<id>. Both reads live in
 * sitePalette.ts, where the front page reads the same two for the
 * landing. Both are honoured for anyone who carries them because they are
 * cosmetic and nothing else on the site reads them: a look is not a
 * permission, and checking a session here would cost every page a lookup
 * for the sake of a colour.
 *
 * cookies() makes the segment dynamic, which every page under it already
 * is (force-dynamic, live numbers). No markup of its own beyond RowSite's
 * div and one style tag: the pages still render their own .row100k root,
 * their own style tag and their own bar, so nothing about them moves. */
export const dynamic = "force-dynamic";

/* A page under here that sets no title of its own is Rowtember, not the
 * photo site the root layout names. */
export const metadata: Metadata = {
  title: "Rowtember",
};

/* The browser chrome follows the ground (2026-10-01, with ink the default
 * look): the black of the ink look, the cream of paper, so a phone has no
 * cream address bar over a black page. A page may still name its own (the
 * front page does, for the landing ground). */
export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await siteLook()) === "ink" ? INK : PAPER };
}

export default async function Row100kLayout({ children }: { children: ReactNode }) {
  const [settings, look, palette] = await Promise.all([siteSettingsOnce(), siteLook(), sitePalette()]);
  return (
    <RowSite look={look} palette={palette} cardsOff={settings.cardsOff}>
      {children}
    </RowSite>
  );
}
