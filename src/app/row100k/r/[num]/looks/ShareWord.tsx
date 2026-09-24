"use client";

/* SHARE at the far right of the dateline, on the rower's own page (owner,
 * 2026-09-25: "move the SHARE button onto the same line as the DECEMBER
 * 2026 date selection (right side); best on mobile"). The quiet face it
 * already had — mono caps, a dotted rule — now on the month word's line
 * instead of LOG A ROW's, which stays where it is with nothing beside it.
 *
 * The dialog itself lives in LogInPlace (it carries the freshly logged row
 * and the folded-in meters), so this word only asks for it, by the
 * row100k:share event LogInPlace already listens for. It is a button and
 * not a link, so the tap line (NavProgress.tsx) never starts for it. */
export function ShareWord() {
  return (
    <button type="button" className="pf-share" onClick={() => window.dispatchEvent(new Event("row100k:share"))}>
      Share
    </button>
  );
}
