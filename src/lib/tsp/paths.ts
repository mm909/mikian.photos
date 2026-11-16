/**
 * WHERE THE TSP TEAM SITES LIVE — the one constant every link, redirect,
 * callbackUrl and invite link goes through (the lasd26 way, lib/lasd26/paths.ts),
 * so the site moves in one edit.
 *
 * Owner, 2026-11-16: "a new page on the normal site, probably at /TSP … for
 * our teams to use during TSP … design it in a way that we can give this to
 * other TSP teams". /tsp itself is still the DowntownKruz France tracker, so
 * the team sites sit one folder down, by crossing: /tsp/lalv is Santa Monica
 * Pier → the Las Vegas sign. A team is /tsp/lalv/<slug>.
 *
 * Isomorphic on purpose (no "server-only"): client pieces link too.
 */
export const TSP_EVENT = "lalv";
export const TSP_BASE = "/tsp/lalv";

/** A page of the hub: tspPath("") is the hub, tspPath("/new") the make-a-team form. */
export const tspPath = (p: string) => TSP_BASE + p;

/** A page of one team's site: teamPath("dtk", "/expenses"); "" is the team's route page. */
export const teamPath = (slug: string, p: string) => `${TSP_BASE}/${slug}${p}`;

/** A team's API: tspApi("dtk", "/expenses") = /api/tsp/dtk/expenses. */
export const tspApi = (slug: string, p: string) => `/api/tsp/${slug}${p}`;

/** The static files (the course) — files, not pages. */
export const TSP_ASSETS = "/tsp/lalv-course";

/** Slugs a team cannot take: the hub's own pages, and the lasd26 crew's key on the shared tables. */
export const RESERVED_SLUGS = new Set(["new", "join", "route", "api", "team", "teams", "dev", "lasd26", "lalv", "tsp"]);

/** "Downtown Kruz!" → "downtown-kruz". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}
