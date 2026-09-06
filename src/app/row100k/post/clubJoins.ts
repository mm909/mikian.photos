import { TIERS, type Tier } from "@/lib/row100k";
import type { PostClubJoin, PostRow } from "./slides";

/* Who joined a club in the last day — the post pack's welcome slide.
 *
 * The owner's ask (2026-09-05 late): "welcoming people new into the club
 * (over the last 24 hours). If you just hit 50k I want a picture that is
 * shareable to tag you in."
 *
 * A club is a TIER (lib/row100k.ts) at or above 50,000 m — the labels and the
 * thresholds are read off TIERS, never spelled out here, so a rung added
 * later (500K) arrives with its own label and needs no edit.
 *
 * The crossing rule is firstToGoal.ts's, generalised: rows are walked in one
 * stable order, a running total is kept per rower, and the crossing is the row
 * that carries that total over the line (before < threshold <= after). Whether
 * a rower has crossed is therefore the same answer both files give — it is
 * only their total against the threshold.
 *
 * What is NOT reused is firstToGoal's ORDER. It walks rows by the day they
 * were rowed, because a prize claim belongs to the day it happened, and it
 * answers with a single earliest winner over one threshold. This walks by
 * createdAt — when the row LANDED, which is what the feed and the rest of the
 * post pack mean by today — because "who joined in the last 24 hours" is news
 * about the site, not about the calendar: a rower who backfills three days of
 * rows this morning and goes over 50,000 m has joined the club this morning.
 * The two orders can pick different crossing ROWS for the same rower when
 * rows are backdated; they can never disagree about whether the rower crossed.
 */

/** The welcome window: 24 hours back from the render moment. */
export const CLUB_WINDOW_MS = 24 * 3_600_000;

/** Clubs start at 50,000 m — the 10K tier is the participation rung, not a
 * club anybody gets welcomed into. */
export const CLUB_FLOOR_METERS = 50_000;

/** The clubs, lowest first — TIERS filtered, so the labels stay the owner's
 * ("50K", "100K", ".25M"). */
export function clubTiers(): Tier[] {
  return TIERS.filter((t) => t.meters >= CLUB_FLOOR_METERS);
}

/** One logged row, as much of it as a crossing needs. */
export type ClubEntry = { participantId: string; meters: number; createdAt: Date };

export type ClubCrossing = {
  participantId: string;
  /** The HIGHEST club they crossed inside the window. */
  tier: Tier;
  /** When the crossing row landed. */
  atMs: number;
};

/* Every rower who crossed a club inside [sinceMs, untilMs], one crossing each
 * — the highest club, when a rower cleared two of them in the same window
 * (a 60k day on top of 45k lands them in the 100K club, and that is the news).
 * Rows outside the window still count toward the running total; they just
 * cannot BE the crossing. Chronological, earliest first. */
export function clubCrossings(
  entries: ClubEntry[],
  sinceMs: number,
  untilMs: number,
): ClubCrossing[] {
  const clubs = clubTiers();
  if (clubs.length === 0) return [];
  const ordered = entries
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const cum = new Map<string, number>();
  const best = new Map<string, ClubCrossing>();
  for (const e of ordered) {
    const before = cum.get(e.participantId) ?? 0;
    const after = before + e.meters;
    cum.set(e.participantId, after);
    const atMs = e.createdAt.getTime();
    if (!Number.isFinite(atMs) || atMs < sinceMs || atMs > untilMs) continue;
    for (const tier of clubs) {
      if (before >= tier.meters || after < tier.meters) continue;
      const held = best.get(e.participantId);
      if (!held || tier.meters > held.tier.meters) {
        best.set(e.participantId, { participantId: e.participantId, tier, atMs });
      }
    }
  }
  return [...best.values()].sort(
    (a, b) => a.atMs - b.atMs || a.participantId.localeCompare(b.participantId),
  );
}

/* THE ORDER THE SLIDE READS IN: biggest total first (owner, 2026-09-06:
 * "also sort it in order of meters rowed"), not the order they crossed.
 *
 * The sort runs on `meters` AS THE PUBLIC BOARD HAS IT — a hidden rower
 * carries their tier floor here, never their real total — which is the same
 * number the slide prints. Inside one club every hidden member holds the same
 * floor, so they tie with each other and fall back to the name: their order
 * says nothing a reader could not already work out from the club they just
 * joined, which is what the blackout is protecting. Never sort these on a
 * real total. */
function byMetersDesc(rowers: PostRow[]): PostRow[] {
  return rowers
    .slice()
    .sort((a, b) => b.meters - a.meters || a.name.localeCompare(b.name) || a.num - b.num);
}

/* The slide's data: one entry per club somebody joined, highest club first,
 * each carrying its new members biggest total first.
 *
 * `rowFor` hands back the rower's row AS THE PUBLIC BOARD HAS IT — masked,
 * during a blackout window, with a tier floor for meters and a digit count.
 * That is the only shape allowed to leave here: the crossing itself is
 * computed from real meters, but a hidden rower's total must not reach the
 * page (blackout rule, 2026-09-05 — a club welcome for one of the fifteen
 * names the club, not the number). A rower with no board row at all is
 * dropped rather than guessed at, the same fail-closed line the 100k claim
 * holds on this page. */
export function clubJoinsFor(
  entries: ClubEntry[],
  rowFor: (participantId: string) => PostRow | undefined,
  nowAtMs: number,
): PostClubJoin[] {
  const crossings = clubCrossings(entries, nowAtMs - CLUB_WINDOW_MS, nowAtMs);
  if (crossings.length === 0) return [];
  const byClub = new Map<number, PostRow[]>();
  for (const c of crossings) {
    const row = rowFor(c.participantId);
    if (!row) continue;
    // The crossing is computed off a live read of the rows; the total printed
    // beside the name comes off the cached board. If those two ever skew — a
    // revalidation that missed, a cache entry read a moment before the write
    // landed — the slide would say WELCOME TO THE 50K CLUB over "48,000 m",
    // a public post that contradicts itself. So the board has to agree that
    // the rower is in. This can never cost a real welcome: a masked row's
    // meters is its TIER FLOOR, which for a rower who cleared this club is
    // the club's own threshold or higher (review, 2026-09-05).
    if (row.meters < c.tier.meters) continue;
    const list = byClub.get(c.tier.meters);
    if (list) list.push(row);
    else byClub.set(c.tier.meters, [row]);
  }
  return clubTiers()
    .slice()
    .sort((a, b) => b.meters - a.meters)
    .map((tier) => ({
      label: tier.label,
      meters: tier.meters,
      rowers: byMetersDesc(byClub.get(tier.meters) ?? []),
    }))
    .filter((club) => club.rowers.length > 0);
}
