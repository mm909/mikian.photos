import { nowMs } from "@/lib/row100k";

/* THE RAFFLES (owner, 2026-09-08). A partner puts something up; a rower
 * enters by logging a row inside the window; the owner draws a winner on
 * /row100k/raffles and the partners page names them.
 *
 * The raffle itself lives HERE, in code — prize, sponsor, the window, the
 * copy — the way the Grizzly block on the partners page does: every one
 * of them needs its own words and links anyway. What CHANGES lives in the
 * RowRaffle table (raffleData.ts): the winner once drawn, and whether the
 * partner's second-chance link is live. Add a raffle by adding an entry
 * below; the admin page, the banner and the partners page pick it up.
 *
 * ENTRY RULE. One ticket per rower — not per row — for a row DATED inside
 * [entryFrom, entryTo] (challenge days, Pacific, the same YYYY-MM-DD the
 * rower picks in the log form) and LOGGED before closesAt. Dated, so a
 * Wednesday row logged Thursday counts; logged before the close, so a
 * back-dated row logged after the draw does not. Admin accounts are never
 * in the hat (raffleData.ts).
 *
 * Instants are Pacific, the fixed UTC-7 the whole challenge runs on
 * (blackoutRules.PACIFIC_SHIFT_MS): Wed 00:00 PT is 07:00Z. */

export type RaffleDef = {
  /* URL-safe key; the RowRaffle row and the dismiss cookie hang off it. */
  slug: string;
  /* "Fairway to Heaven" — the headline. */
  title: string;
  /* "Music + Wellness Festival" — the line under it. */
  sub: string;
  /* "One ticket" / 45 — what is on the line. */
  prize: string;
  valueUsd: number;
  /* Where and when the prize happens — the ticket stub lines. */
  when: string;
  where: string;
  /* A sentence about the thing, for the partners page. */
  blurb: string;
  /* The event page (tickets + info) and how to name it. */
  eventUrl: string;
  eventHost: string;
  /* Who gave it, and where that link goes. */
  sponsor: string;
  sponsorUrl: string;
  /* The entry window in challenge days (inclusive) and the two instants
   * that bracket it: the banner shows and rows count from opensAt; the hat
   * closes at closesAt. */
  entryFrom: string;
  entryTo: string;
  opensAt: number;
  closesAt: number;
  /* Plain words for the window and the draw, printed everywhere. */
  windowLine: string;
  closesLine: string;
  drawLine: string;
  /* The partner's second chance — hidden until the owner flips it live on
   * /row100k/raffles (RowRaffle.ctaLive). */
  cta: { label: string; url: string };
  /* The flyer, under /public, or null until the owner drops one in. */
  poster: { src: string; alt: string; width: number; height: number } | null;
};

export const RAFFLES: RaffleDef[] = [
  {
    slug: "fairway-to-heaven",
    title: "Fairway to Heaven",
    sub: "Music + Wellness Festival",
    prize: "One ticket",
    valueUsd: 45,
    when: "Sunday, Sep 13 · 8 AM – 8 PM",
    where: "Red Rock Country Club, Las Vegas",
    blurb:
      "A full day of movement, music and community at Red Rock: the Fairway Fit Club in the morning, the Sunday Social on the driving range, Sunset Sessions as the light goes.",
    eventUrl: "https://www.ritualsocialclub.com/event-details/fairway-to-heaven-music-wellness-festival",
    eventHost: "ritualsocialclub.com",
    sponsor: "Grizzly Health",
    sponsorUrl: "https://grizzlyhealth.org/fairway",
    entryFrom: "2026-09-09",
    entryTo: "2026-09-11",
    /* Wed Sep 9, 00:00 PT → Sat Sep 12, 00:00 PT (owner: "closes Saturday
     * at midnight", drawn Saturday morning). */
    opensAt: Date.UTC(2026, 8, 9, 7, 0, 0),
    closesAt: Date.UTC(2026, 8, 12, 7, 0, 0),
    windowLine: "Wednesday, Thursday or Friday — Sep 9, 10 or 11",
    closesLine: "Entries close Friday, Sep 11 at 11:59 PM Pacific",
    drawLine: "Drawn Saturday morning",
    cta: { label: "Get another chance → play the Gauntlet", url: "https://grizzlyhealth.org/fairway" },
    /* The flyer from the event page (Wix crop, resized to 104 KB). */
    poster: {
      src: "/row100k/partners/fairway-poster.jpg",
      alt: "Fairway to Heaven flyer: Ritual Collective and drvn Social Club present a music and wellness festival at Red Rock Country Club, Sunday September 13",
      width: 1080,
      height: 1037,
    },
  },
];

export function raffleBySlug(slug: string): RaffleDef | null {
  return RAFFLES.find((r) => r.slug === slug) ?? null;
}

/* Where a raffle stands on the clock: not yet, taking entries, or shut. */
export type RafflePhase = "before" | "open" | "closed";

export function rafflePhase(r: RaffleDef, at: number = nowMs()): RafflePhase {
  if (at < r.opensAt) return "before";
  if (at < r.closesAt) return "open";
  return "closed";
}

/* The raffle the bar should be shouting about right now: the first one
 * taking entries. Null outside every window. */
export function openRaffle(at: number = nowMs()): RaffleDef | null {
  return RAFFLES.find((r) => rafflePhase(r, at) === "open") ?? null;
}

/* The dismiss cookie for the bar banner: set by the × on the client, read
 * by RowBar on the server so a dismissed banner never renders again — not
 * even for a frame. A year, path / (owner: "once the user closes it it
 * should not reopen"). */
export function raffleDismissCookie(slug: string): string {
  return `row100k_raffle_${slug.replace(/[^a-z0-9-]/gi, "")}`;
}

/* "SEP 9–11" — the window as a stub line. */
export function fmtWindowShort(r: RaffleDef): string {
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mo = MONTHS[Number(r.entryFrom.slice(5, 7)) - 1] ?? "";
  const a = Number(r.entryFrom.slice(8, 10));
  const b = Number(r.entryTo.slice(8, 10));
  return a === b ? `${mo} ${a}` : `${mo} ${a}–${b}`;
}
