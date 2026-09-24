"use client";

import Link from "next/link";

/* LOG A ROW, on the bar, for a joined rower (owner call, 2026-09-05, on a
 * phone: "a little more obvious so they can always click it"). It goes to
 * the rower's own profile with the form open (owner, 2026-09-25: "have it
 * take you to your profile's log a row"): /row100k/r/[num] opens its log
 * form on #log. It used to point at the front page and, on a page that
 * already carried the in-place form, fire a row100k:log event instead of
 * navigating; that is gone — one address, one plain link, so the tap line
 * (NavProgress.tsx) runs while the profile loads.
 *
 * ON THE PROFILE ITSELF the hash alone is not enough (owner, 2026-09-25:
 * "if I'm on the profile and click LOG A ROW it just moves my scroll and
 * doesn't open any menu"): next/link pushes the hash with pushState, which
 * fires no hashchange, so the form (LogInPlace) never heard it. The click
 * therefore also sends row100k:log when the link points at the page it is
 * on — the same event the account menu sends — which opens the seam and
 * scrolls the word under the bar. The link still goes through, so the
 * address carries #log and the back button behaves; NavProgress skips a
 * same-page link on its own.
 *
 * One element in the DOM; theme.ts moves it with flex order: beside the
 * account chip on desktop, far right of the section-link row on phones,
 * directly under the chip. RowBar decides whether to render it at all
 * (signed out, not joined, or the log window closed: nothing — the join CTA
 * is on the front page) and hands in the rower's number. */
export function BarLog({ rowerNumber }: { rowerNumber: number }) {
  const path = `/row100k/r/${rowerNumber}`;
  return (
    <Link
      className="bar-log"
      href={`${path}#log`}
      onClick={() => {
        if (window.location.pathname === path) window.dispatchEvent(new Event("row100k:log"));
      }}
    >
      Log a row
    </Link>
  );
}
