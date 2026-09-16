import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { LOOK_COOKIE, parseLook, siteSettings, type Look } from "@/lib/rowSettings";
import { RowSite } from "./RowSite";

/* The one wrapper every /row100k page renders inside (owner, 2026-09-16).
 * It reads the site switches once per request (src/lib/rowSettings.ts,
 * fails open to the defaults) and hands two of them down through RowSite:
 * the look — paper, or the white-on-black ink for race week — and the
 * share cards that are switched off.
 *
 * The look can be previewed on one browser through LOOK_COOKIE, which the
 * settings route sets for an admin. It is honoured for anyone who carries
 * it because it is cosmetic and nothing else on the site reads it: a look
 * is not a permission, and checking a session here would cost every page a
 * lookup for the sake of a colour.
 *
 * cookies() makes the segment dynamic, which every page under it already
 * is (force-dynamic, live numbers). No markup of its own beyond RowSite's
 * div: the pages still render their own .row100k root, their own style tag
 * and their own bar, so nothing about them moves. */
export const dynamic = "force-dynamic";

export default async function Row100kLayout({ children }: { children: ReactNode }) {
  const settings = await siteSettings();
  let look: Look = settings.look;
  try {
    const preview = parseLook(cookies().get(LOOK_COOKIE)?.value);
    if (preview) look = preview;
  } catch {
    /* cookies() outside a request scope — the site-wide look stands */
  }
  return (
    <RowSite look={look} cardsOff={settings.cardsOff}>
      {children}
    </RowSite>
  );
}
