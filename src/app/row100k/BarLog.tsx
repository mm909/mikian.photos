"use client";

import Link from "next/link";

/* LOG A ROW, on the bar, for a joined rower (owner call, 2026-09-05, on a
 * phone: "a little more obvious so they can always click it"). It goes to
 * the rower's own profile with the form open (owner, 2026-09-25: "have it
 * take you to your profile's log a row"): /row100k/r/[num] opens its log
 * form on #log. It used to point at the front page and, on a page that
 * already carried the in-place form, fire a row100k:log event instead of
 * navigating; that is gone — one address, one plain link, so the tap line
 * (NavProgress.tsx) runs while the profile loads, and on the profile
 * itself the hash alone opens the form with no page load at all.
 *
 * One element in the DOM; theme.ts moves it with flex order: beside the
 * account chip on desktop, far right of the section-link row on phones,
 * directly under the chip. RowBar decides whether to render it at all
 * (signed out, not joined, or the log window closed: nothing — the join CTA
 * is on the front page) and hands in the rower's number. */
export function BarLog({ rowerNumber }: { rowerNumber: number }) {
  return (
    <Link className="bar-log" href={`/row100k/r/${rowerNumber}#log`}>
      Log a row
    </Link>
  );
}
