import { MONTH } from "@/lib/row100k";

/* THE WORDS ON THE RAIL, in one place both halves of the bar can read: the
 * rail itself (BarNav.tsx, a client component) and the bar that hands the
 * overflow to the account menu (RowBar.tsx, a server component — it cannot
 * call into a client module, which is why this is a file of its own). PURE:
 * no database, no cookies.
 *
 * THE BOARD is back on the rail (owner, 2026-09-25: "add a link in the
 * header for the board — it goes to the records page with total meters and
 * ALL selected for the current month"). It went off on 2026-09-24 when the
 * board page was folded into the full rankings; the key now points at that
 * total-meters view, plain URL, and lights on every records page. The word
 * is BOARD, not THE BOARD, since 2026-10-01 (owner: "look at the header. We
 * need to condense it into one line") — the article was three characters a
 * phone did not have. */
export type NavKey = "home" | "raceday" | "board" | "stats" | "feed" | "gallery" | "partners";

export type NavItem = { key: NavKey; href: string; label: string };

export const ITEMS: NavItem[] = [
  /* Ahead of every section link: the rail reads race, then sections. */
  { key: "raceday", href: "/row100k/raceday", label: "RACE DAY" },
  /* No ?m= and no ?d=: the records page reads the plain URL as this month,
   * All (records/[record]/page.tsx hrefFor). */
  { key: "board", href: "/row100k/records/total", label: "BOARD" },
  { key: "stats", href: "/row100k/stats", label: "STATS" },
  { key: "feed", href: "/row100k/feed", label: "FEED" },
  { key: "partners", href: "/row100k/partners", label: "PARTNERS" },
];

/* The one item the pill may not address. It stays in ITEMS whether or not it
 * renders, so isKey keeps accepting the key and `active` stays typed. */
export const STAMP: NavKey = "raceday";

/* PARTNERS and FEED are September's (owner, 2026-09-24: "on October 1st
 * we're going to hide the partner page"; "hide the feed on October 1st,
 * same as the partner page"). Both pages stay at their addresses. */
const SEPTEMBER_ONLY: NavKey[] = ["partners", "feed"];

/* THE WORDS THAT ARE ONLY SOMETIMES THERE: the stamp while a race is
 * announced, and September's two. BOARD and STATS are the rail a phone can
 * always hold in one line beside the wordmark and the chips; these are the
 * ones that leave it under 900px (theme.ts .rail-x) for the account menu,
 * or for the word MORE when there is no account. */
const SOMETIMES: NavKey[] = [STAMP, ...SEPTEMBER_ONLY];

/* What the rail carries right now. `raceOpen` is raceOpenFor(isAdmin) AND
 * raceAnnounced(), resolved by RowBar: the gate the race wears, and whether
 * a race is in its window at all. Shut, or no race announced, and the stamp
 * is not in the markup at all. */
export function railItems(raceOpen: boolean): NavItem[] {
  return ITEMS.filter(
    (it) => (raceOpen || it.key !== STAMP) && (MONTH.month === 9 || !SEPTEMBER_ONLY.includes(it.key)),
  );
}

export function isSometimes(key: NavKey): boolean {
  return SOMETIMES.includes(key);
}

/* The same words for a narrow screen, in rail order, title-cased by the
 * account menu the way its own items are. */
export function overflowItems(raceOpen: boolean): NavItem[] {
  return railItems(raceOpen).filter((it) => isSometimes(it.key));
}
