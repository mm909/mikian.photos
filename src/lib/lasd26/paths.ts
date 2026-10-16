/**
 * WHERE THE TEAM SITE LIVES — one constant every link, redirect,
 * callbackUrl and invite link goes through, so the site moves in one edit.
 *
 * The site is LIVE at /lasd26 (owner, 2026-10-16: "we are going to make
 * some of this live now"). It was built one folder down as a dev copy
 * (owner, 2026-10-15: "make this live, but behind that slash dev, just
 * like we did with Hyrox") and moved up over the old crew-call page on
 * 2026-10-16: the landing, the-list, join, expenses, team and pay all sit
 * under this base, in src/app/lasd26. Each page keeps its own rule — the
 * list and the team console are owner-only, expenses and pay need
 * membership, join needs a live invite token.
 *
 * Isomorphic on purpose — no "server-only" — because the client pieces
 * (the account menu, the join form, the sign-in buttons) link too.
 */
export const LASD_BASE = "/lasd26";

/** A page of the team site: lasdPath("/expenses"), lasdPath("") for the landing. */
export const lasdPath = (p: string) => LASD_BASE + p;

/**
 * The static files — the photos and the brand marks in public/lasd26. Those
 * are files, not pages: they stay at /lasd26/... whatever LASD_BASE says.
 */
export const LASD_ASSETS = "/lasd26";
