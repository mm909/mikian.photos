import type { SanityBand } from "@/lib/row100k";
import type { MyRow } from "../../../MyRows";
import type { ProfileLogRow } from "../../../ProfileLog";
import type { ShareData } from "../../../share/cards";

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

export type ProfileView = {
  rower: {
    id: string;
    rowerNumber: number;
    displayName: string;
    instagram: string;
    division: string;
  };
  isMe: boolean;
  isAdmin: boolean;
  /* Blackout (blackoutRules.ts): this viewer sees blocks wherever one of
   * this rower's numbers would print. Never true for the rower or an admin. */
  masked: boolean;
  blackoutNote: string;
  /* The 100K CLUB tag — read off the tier floor for a masked row, the way
   * the board files it. */
  club: boolean;
  /* The challenge clock, for the dateline. */
  phase: ProfilePhase;
  /* September days elapsed — the calendar stops here. */
  days: number;
  totals: {
    meters: number;
    sessions: number;
    /* TIME ROWED — the sum of every session's seconds (owner ask,
     * 2026-09-05: how long they have spent rowing matters). */
    seconds: number;
    longest: number;
    daysRowed: number;
  };
  /* Standing on total meters within the division — cosmetic, off the
   * cached board; undefined when the board could not be read. */
  rank: { place: number; of: number } | null | undefined;
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
