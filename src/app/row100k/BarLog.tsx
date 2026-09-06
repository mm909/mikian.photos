"use client";

import Link from "next/link";

/* LOG A ROW, on the bar, for a joined rower (owner call, 2026-09-05, on a
 * phone: "a little more obvious so they can always click it"). The same
 * destination as the account menu's "Log a row" item (BarAccount): #log
 * lands on the front page with the form open (LogInPlace listens for the
 * hash). On a page that already carries the in-place form — the front page,
 * the rower's own profile — there is no hop at all: the event tells the
 * form directly and it opens under its own heading. A modifier click (new
 * tab) is left to the browser and opens nothing here.
 *
 * One element in the DOM; theme.ts moves it with flex order: beside the
 * account chip on desktop, far right of the section-link row on phones,
 * directly under the chip. RowBar decides whether to render it at all
 * (signed out, not joined, or the log window closed: nothing — the join CTA
 * is on the front page). */
export function BarLog() {
  return (
    <Link
      className="bar-log"
      href="/row100k#log"
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        // LogInPlace's root is .front-act#log; LogPanel's plain #log section
        // (dev preview) has no listener, so it still gets the navigation.
        if (document.getElementById("log")?.classList.contains("front-act")) {
          e.preventDefault();
          window.dispatchEvent(new Event("row100k:log"));
        }
      }}
    >
      Log a row
    </Link>
  );
}
