import type { SanityBand } from "@/lib/row100k";
import type { MyRow } from "../../../MyRows";
import type { ProfileLogRow } from "../../../ProfileLog";
import type { ShareData } from "../../../share/cards";
import type { FieldModel, FieldYou } from "../../../stats/field";
import type { PacePoint } from "./PaceCurve";

/* Everything the profile (Profile.tsx) renders, computed once by page.tsx.
 * The layout only lays it out — it runs no query and never decides who is
 * hidden. Raw numbers live in here on the SERVER; the page prints them
 * only through the guarded pieces (pieces.tsx), which draw blocks while
 * `masked`, and hands a client component nothing but what page.tsx already
 * blanked (logRows, the masked bests) or what only the rower themself gets
 * (shareData, rows, the log form). */

/* One of the four bests: a pace record (fastest 5k / 10k) or a distance
 * record (longest row / biggest day). */
export type ProfileBest = {
  /* The record-board key — "fastest5000", "longest", "bigday"... */
  key: string;
  label: string;
  /* The formatted figure; "—" when not yet rowed; "" while masked. */
  value: string;
  /* The line under the label: the day, and for a pace best the split. */
  sub: string;
  /* Division ranking (top 10 only), for the place chip. */
  place: number | null;
  /* Leaderboard for this stat, e.g. "/row100k/records/5000?d=m". */
  href: string;
  /* Blackout (blackoutRules.ts): the page blanked `value` and this is its
   * silhouette — "##:##.#" for a pace best — for the blocks drawn in its
   * place, and for the best card should one ever be made. */
  shape?: string;
  /* Blackout: how many digits a hidden meters best had — for the blocks. */
  digits?: number;
};

export type ProfilePhase = "before" | "open" | "closed";

/* One line of the roster the nameplate search reads (RowerSearch.tsx) —
 * every rower in the challenge, by the two things that are ALWAYS public
 * (blackoutRules.ts): the number and the name. Division rides along because
 * it is the board a rower is on, not a figure of theirs.
 *
 * This type is the guard: it has no meters, seconds, place, split or tier
 * field and must never grow one. The whole roster is handed to a CLIENT
 * component, so anything added here is published for all hundred rowers,
 * the blacked-out fifteen included — and a hidden rower publishes no
 * number of their own. Number, name and board are not numbers of theirs. */
export type RosterRower = {
  rowerNumber: number;
  displayName: string;
  /* "M" / "F" — which board they row on. Carried, not printed: the search
   * list is the board idiom, number then name, and a division tag beside a
   * name reads like a standing. Here for the day one is wanted. */
  division: string;
};

export type ProfileView = {
  rower: {
    id: string;
    rowerNumber: number;
    displayName: string;
    instagram: string;
    division: string;
  };
  /* Every rower, for the search that opens off the name in the nameplate
   * (owner ask, 2026-09-06: tap the name, find someone else). It lives on
   * the view rather than beside it because Profile.tsx takes exactly one
   * prop and hands it down; a second prop would have to be threaded through
   * the layout to reach one piece. Public by construction — see
   * RosterRower. */
  roster: RosterRower[];
  isMe: boolean;
  isAdmin: boolean;
  /* The rower's average split, "2:07", worked out on the server from
   * numbers that never ship. While a window hides them it is the ONE
   * figure of theirs still published — a ratio of two hidden numbers gives
   * neither away — and it is what the dog tag is built around (owner,
   * 2026-09-06). Absent before they have a timed row. */
  paceTag?: string;
  /* Blackout (blackoutRules.ts): this viewer sees blocks wherever one of
   * this rower's numbers would print. Never true for the rower or an admin. */
  masked: boolean;
  blackoutNote: string;
  /* The 100K CLUB tag — read off the tier floor for a masked row, the way
   * the board files it. */
  club: boolean;
  /* The challenge clock, for the dateline. */
  phase: ProfilePhase;
  /* September days elapsed (never below 1) — the calendar stops here, and
   * METERS A DAY in the ledger divides the total by it. */
  days: number;
  /* THE PACE (owner ask, 2026-09-08): the running average split after each
   * timed session, over the meters rowed so far — the line on the profile.
   * Empty for a rower with fewer than two timed rows. Never built for a
   * masked view (the dog tag replaces the page). */
  paceCurve: PacePoint[];
  /* THE FIELD on the profile (same ask): everyone's two densities and this
   * rower's overlay with percentiles, off stats/field.ts. Null when the
   * field could not be read, when the rower has no session yet, or on a
   * masked view. */
  field: { field: FieldModel; you: FieldYou } | null;
  totals: {
    meters: number;
    sessions: number;
    /* TIME ROWED — the sum of every session's seconds (owner ask,
     * 2026-09-05: how long they have spent rowing matters). */
    seconds: number;
    longest: number;
  };
  /* Standing on total meters within the division — cosmetic, off the
   * cached board; undefined when the board could not be read. Null for one
   * of the hidden fifteen (see `elite`), who does hold a place. */
  rank: { place: number; of: number } | null | undefined;
  /* Blackout, the PLACES half (blackoutRules.ts): this rower is one of the
   * hidden fifteen on the board as THIS viewer sees it — the rower themself
   * included, admins excepted, whose board is ranked — so `rank` is null
   * though they hold a place, and the ledger says ELITE 15 in its stead
   * rather than a dash (with the division dropped from the label: the
   * fifteen are cut off the combined board). False when the board cannot be
   * read at all: the page still masks the numbers, but it will not badge a
   * rower it cannot place, so the ledger dashes instead. */
  elite: boolean;
  bests: ProfileBest[];
  byDay: Record<string, number>;
  shareData: ShareData;
  /* The editable ledger's rows (the rower's own page and nothing else
   * prints these). */
  rows: MyRow[];
  /* The visitor's rows — display strings, blanked while masked. */
  logRows: ProfileLogRow[];
  /* The logging station, on the rower's own page only. `phase` here is the
   * admin-adjusted one (open before Sep 1 for test rows). */
  log: {
    phase: ProfilePhase;
    earlyAdmin: boolean;
    defaultDay: string;
    defaultTitle: string;
    sanity: SanityBand;
  } | null;
};
