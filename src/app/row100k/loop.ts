/* THE LOOP (owner, 2026-10-01, the "Rowtember loop" mock): on a phone the
 * log form rises from the bottom as a sheet with the big number still in
 * view above it; when the row lands the sheet goes, the wheels count up to
 * the new total, and the rank line ticks to the new place — the rower you
 * just passed slides under you.
 *
 * IN DEVELOPMENT, the standing rule (CLAUDE.md): admin-only in production
 * until the owner has tested it on his phone ("I need to be able to test
 * it on my phone before it goes live"), open in local dev. Flip LOOP_LIVE
 * to put it in front of every rower. */
export const LOOP_LIVE = false;

export function loopOn(isAdmin: boolean): boolean {
  return LOOP_LIVE || isAdmin || process.env.NODE_ENV !== "production";
}

/* One rower of the viewer's division on the public board, unmasked —
 * what the rank module needs to say who is above and to animate a pass.
 * Nothing a stranger could not read off the board page. */
export type LoopRow = { rowerNumber: number; name: string; meters: number };

export type LoopData = {
  division: "M" | "F" | "X";
  /* The division's board, meters descending; empty while the elite are
   * hidden (a blackout) — the module then prints nothing. */
  rows: LoopRow[];
};

/* The event a saved row sends the page (LogInPlace → Wheels, LoopRank). */
export const LOGGED_EVENT = "row100k:logged";
export type LoggedDetail = { meters: number; day: string };

/* The choreography, in ms from the save: the sheet closes, a beat, the
 * wheels run, then the board moves. */
export const LOOP_SHEET_MS = 360;
export const LOOP_BEAT_MS = 380;
export const LOOP_COUNT_MS = 1500;
export const LOOP_RANK_AT_MS = LOOP_BEAT_MS + LOOP_COUNT_MS + 260;
export const LOOP_SHARE_AT_MS = LOOP_RANK_AT_MS + 1400;

/* ease-out cubic */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
