import { MONTH } from "@/lib/row100k";

/* THE WORDS ON THE RAIL, in one place both halves of the bar can read: the
 * rail itself (BarNav.tsx, a client component) and the bar that hands the
 * overflow to the account menu (RowBar.tsx, a server component — it cannot
 * call into a client module, which is why this is a file of its own). PURE:
 * no database, no cookies.
 *
 * BOARD and RANKINGS since 2026-10-01 (owner: "we have the board, which is
 * what's currently in dev, and then we have rankings, which is what the
 * current board is going to be renamed to"): BOARD is the month's 100K at
 * /board, RANKINGS the total-meters records view it used to open (owner,
 * 2026-09-25), lit on every records page. The word is BOARD, not THE
 * BOARD (owner, the same day: "look at the header. We need to condense it
 * into one line") — the article was three characters a phone did not
 * have. */
export type NavKey = "home" | "raceday" | "board" | "m2d" | "rankings" | "stats" | "feed" | "gallery" | "partners";

export type NavItem = { key: NavKey; href: string; label: string };

export const ITEMS: NavItem[] = [
  /* M2D IS THE STAMP (owner, 2026-11-25: "instead of race day up in the top
   * left, let's make that M2D ... bold ... that black background, white
   * lettering"): first on the rail, white on black, while the app is not
   * live. RACE DAY leaves the rail for the account menu. */
  { key: "m2d", href: "/m2d", label: "M2D" },
  { key: "raceday", href: "/raceday", label: "RACE DAY" },
  /* BOARD is the month's 100K, the rowers who opted in (owner, 2026-10-01:
   * "we have the board, which is what's currently in dev, and then we have
   * rankings, which is what the current board is going to be renamed to").
   * RANKINGS is the full rankings, opened on total meters; no ?m= and no
   * ?d=, so the records page reads the plain URL as this month, All. */
  { key: "board", href: "/board", label: "BOARD" },
  { key: "rankings", href: "/records/total", label: "RANKINGS" },
  { key: "stats", href: "/stats", label: "STATS" },
  { key: "feed", href: "/feed", label: "FEED" },
  { key: "partners", href: "/partners", label: "PARTNERS" },
];

/* The one item the pill may not address. It stays in ITEMS whether or not it
 * renders, so isKey keeps accepting the key and `active` stays typed. */
export const STAMP: NavKey = "m2d";

/* PARTNERS and FEED are September's (owner, 2026-09-24: "on October 1st
 * we're going to hide the partner page"; "hide the feed on October 1st,
 * same as the partner page"). Both pages stay at their addresses. */
const SEPTEMBER_ONLY: NavKey[] = ["partners", "feed"];

/* THE WORDS THAT ARE ONLY SOMETIMES THERE: the stamp while a race is
 * announced or just run, and September's two. BOARD, RANKINGS and STATS
 * are the rail a phone always holds in one line beside the wordmark and the
 * chips (theme.ts, the 440 and 360 cuts); these are the ones that leave it
 * under 900px (theme.ts .rail-x) for the account menu, or for the word MORE
 * when there is no account. */
/* M2D too: a phone holds three words beside the wordmark, so on a narrow
 * screen it is in the account menu (and the front page links it). */
const SOMETIMES: NavKey[] = [STAMP, "raceday", ...SEPTEMBER_ONLY];

/* What the rail carries right now. `raceOpen` is raceOpenFor(isAdmin) AND
 * (raceAnnounced() OR the race has been run), resolved by RowBar: the gate
 * the race wears, and whether there is a race or its results to lead to.
 * Otherwise the stamp is not in the markup at all. */
export function railItems(raceOpen: boolean): NavItem[] {
  void raceOpen;
  return ITEMS.filter((it) => it.key !== "raceday" && (MONTH.month === 9 || !SEPTEMBER_ONLY.includes(it.key)));
}

export function isSometimes(key: NavKey): boolean {
  return SOMETIMES.includes(key);
}

/* The same words for a narrow screen, in rail order, title-cased by the
 * account menu the way its own items are. */
export function overflowItems(raceOpen: boolean): NavItem[] {
  /* RACE DAY lives here now, while a race is open or just run. */
  return ITEMS.filter((it) => isSometimes(it.key) && (it.key !== "raceday" || raceOpen) && (MONTH.month === 9 || !SEPTEMBER_ONLY.includes(it.key)));
}
