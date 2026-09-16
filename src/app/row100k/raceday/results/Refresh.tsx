"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* THE POLL THE WALL ALWAYS WANTED (CastFrame: NOT AUTO-REFRESHING YET —
 * the real surface wants a poll so a wall board cannot silently freeze).
 * This is it, and it is the smallest thing that does the job: every thirty
 * seconds, while the sheet is not posted and the tab is actually being
 * looked at, ask the router for the page again. router.refresh() re-runs
 * the server render and keeps client state — the wave a gym clicked on the
 * wall (CastPicker) survives it, and so does a half-typed time in a box.
 *
 * NOT WHILE HIDDEN. A phone with the board in a background tab would poll
 * all evening for nobody; document.visibilityState is the switch, and the
 * visibilitychange listener catches the tab up the moment it comes back
 * rather than making it wait out the rest of a tick.
 *
 * SLOWER ONCE THE SHEET IS POSTED, never off (review, 2026-09-16: it used
 * to stop dead at final, and the console offers REOPEN THE SHEET and takes
 * a corrected time after final precisely so the sheet can still change —
 * the television would have shown the old one until somebody reloaded it).
 * `active` is the page's not-final; a final board asks every two minutes.
 * Renders nothing; it is dropped onto the page and the wall alike. */
export function Refresh({
  active,
  everyMs = 30_000,
  idleMs = 120_000,
}: {
  active: boolean;
  everyMs?: number;
  idleMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, active ? everyMs : idleMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, everyMs, idleMs, router]);
  return null;
}
