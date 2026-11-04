/* THE LIVE NUMBERS (owner, 2026-11-03: "Those numbers should be live, the
 * fund raiser should be up to date and the 100k meters should be my live
 * meters (when the race starts)") — one place both pages read.
 *
 * Money: hand-updated constants until Candlelighters gives the row a
 * campaign link worth polling (SPEC.md, open questions). Edit RAISED and
 * MATCH_POOL here and redeploy; every page is force-dynamic.
 *
 * Meters: null until race day. When the satellite tracker goes live,
 * liveMeters() becomes the lookup against the ping store and the hero
 * line, the chart dot and WATCH LIVE all follow it with no other edits. */

export const GOAL = 100_000;
export const RAISED = 0;
export const MATCH_POOL = 0;

/** Flip on race morning. */
export const RACE_LIVE = false;

/** The boat's meters right now, or null before the race starts. */
export function liveMeters(): number | null {
  if (!RACE_LIVE) return null;
  return 0; // wired to the satellite ping store when the tracker is built
}

export const usd = (n: number) => "$" + n.toLocaleString("en-US");
