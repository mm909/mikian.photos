/**
 * WHERE THE TEAM SITE LIVES — one constant, so the new site moves in one
 * edit (owner, 2026-10-15: "make this live, but behind that slash dev,
 * just like we did with Hyrox. I just need to be able to view it").
 *
 * Today the rebuilt site (green, the bar, the account menu, join,
 * expenses, team, pay) is the DEV COPY at /lasd26/dev — the folder
 * src/app/lasd26/dev, admin-only in production (devGate.ts). The live
 * crew-call page at /lasd26 is untouched. Every link, redirect,
 * callbackUrl and invite link inside the dev tree goes through lasdPath,
 * so nothing leads back out to the old page.
 *
 * TO GO LIVE when the owner says so: flip LASD_BASE to "/lasd26", move
 * src/app/lasd26/dev/* up over src/app/lasd26/* (page, the-list, theme and
 * the sub-folders), drop the gateLasdDev() calls and the "(dev)" title
 * tags, and the DEV pill in LasdBar. The API routes (/api/lasd26/*) and
 * the files in public/lasd26 never move.
 *
 * Isomorphic on purpose — no "server-only" — because the client pieces
 * (the account menu, the join form, the sign-in buttons) link too.
 */
export const LASD_BASE = "/lasd26/dev";

/** A page of the team site: lasdPath("/expenses"), lasdPath("") for the landing. */
export const lasdPath = (p: string) => LASD_BASE + p;

/**
 * The static files — the photos and the brand marks in public/lasd26. Those
 * are files, not pages: they stay at /lasd26/... whatever LASD_BASE says.
 */
export const LASD_ASSETS = "/lasd26";
