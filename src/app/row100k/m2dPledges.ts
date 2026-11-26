import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { CHARITIES, M2D_FIRST, M2D_KEY, M2D_LAST, type CharityKey, type Shares } from "./m2d";

/* M2D PLEDGES (owner, 2026-11-26). A giver signs in with Google, picks a
 * rate a kilometer and a dollar cap ("$1 per kilometer for $500"; "we're
 * not going to cap the donations at $500": the cap is theirs), and the
 * owner approves it ("make sure it comes to me to review it"). An approved
 * pledge covers the kilometers logged AFTER its approval ("the next 500
 * kilometers that are submitted will get $1 each"), until its cap fills
 * or Dec 24, whichever is first.
 *
 * SIDE BY SIDE (the default; the owner may change it): every approved
 * pledge applies to every registered kilometer logged after its own
 * approval, until its own cap fills. Two pledges never queue for the same
 * kilometers.
 *
 * WHERE IT GOES: each kilometer's dollars go where the rower who rowed it
 * picked (RowMonthOptIn.choice, split evenly by default), so a filled
 * pledge knows its split per charity before the 24th.
 *
 * "Submitted" is the row's createdAt (when it was logged), and the row's
 * day must be in the window. A rower who took themselves out of M2D does
 * not fill a pledge, the same rule as ROWTEMBER's part.
 *
 * RECEIPTS (owner: proof a giver donated is "later"): nothing here records
 * that a giver paid. When that comes, it is a column on M2dPledge (paidAt,
 * a receipt per charity) and a line in the closing email. Not built.
 *
 * SERVER ONLY. */

/* THE GO-LIVE SWITCH (owner, 2026-11-26: "let's retire whatever current
 * give page we have"). False: the pledge page and its route are in
 * development (admin-only in production) and /m2d/give stays as it is.
 * True, once the owner says it goes live: the pledge page is public and
 * /m2d/give sends its visitors here. Also drop "(dev)" from the pledge
 * page's title and move its menu link out of DEVELOPMENT (CLAUDE.md). */
export const M2D_PLEDGE_LIVE = false;
export const pledgeGated = (isAdmin: boolean): boolean => !M2D_PLEDGE_LIVE && process.env.NODE_ENV === "production" && !isAdmin;

export const PLEDGE_RATES = [25, 50, 100] as const;
/* A custom rate: 1¢ to $10 a kilometer, to a hundredth of a cent. A cap:
 * whole dollars, $5 to $1,000,000. The owner reads every pledge before it
 * counts, so these bounds only keep typos out. */
export const PLEDGE_MIN_CENTS = 1;
export const PLEDGE_MAX_CENTS = 1000;
export const PLEDGE_MIN_CAP = 5;
export const PLEDGE_MAX_CAP = 1_000_000;

export type PledgeStatus = "pending" | "approved" | "declined";
export type PledgeRow = {
  id: string;
  accountId: string;
  email: string;
  name: string;
  centsPerKm: number;
  capDollars: number;
  note: string;
  anonymous: boolean;
  status: string;
  decidedAt: Date | null;
  decidedBy: string;
  welcomeSentAt: Date | null;
  claimedAt: Date | null;
  doneSentAt: Date | null;
  createdAt: Date;
};

/* What a pledge has done so far. km: the kilometers it has paid for;
 * capKm: the kilometers its cap buys; filled: its cap is met (claimed). */
export type PledgeFill = {
  km: number;
  capKm: number;
  dollars: number;
  filled: boolean;
  filledAt: Date | null;
  split: Record<CharityKey, number>;
};

const cents = (d: number) => Math.round(d * 100) / 100;
const zeroSplit = () => Object.fromEntries(CHARITIES.map((c) => [c.key, 0])) as Record<CharityKey, number>;

/* "$1", "50¢", "12.5¢". */
export const rateWord = (c: number): string => (c >= 100 ? `$${(c / 100).toFixed(c % 100 ? 2 : 0)}` : `${Math.round(c * 100) / 100}¢`);
export const capKmOf = (centsPerKm: number, capDollars: number): number => (centsPerKm > 0 ? (capDollars * 100) / centsPerKm : 0);
const kmWord = (km: number) => `${Math.round(km).toLocaleString("en-US")} km`;
/* THE NAME THE PUBLIC SEES: "Anonymous" unless the giver said otherwise. */
export const publicName = (p: { name: string; anonymous?: boolean }): string => (p.anonymous === false ? p.name : "Anonymous");
/* THE RECEIPT LINE (owner: "$1/km for 500 km · Name"). */
export const pledgeLine = (p: { name: string; anonymous?: boolean; centsPerKm: number; capDollars: number }): string =>
  `${rateWord(p.centsPerKm)}/km for ${kmWord(capKmOf(p.centsPerKm, p.capDollars))} · ${publicName(p)}`;
export const pledgeTerms = (p: { centsPerKm: number; capDollars: number }): string =>
  `${rateWord(p.centsPerKm)}/km for ${kmWord(capKmOf(p.centsPerKm, p.capDollars))}`;

const hundredths = (c: number) => Math.abs(Math.round(c * 100) - c * 100) < 1e-6;
/* The body the pledge route takes, read once: the pledge, or the words to
 * refuse with. */
export function readPledgeBody(body: unknown): { centsPerKm: number; capDollars: number; name: string; note: string; anonymous: boolean } | string {
  const b = (body ?? {}) as { cents?: unknown; cap?: unknown; name?: unknown; note?: unknown; anonymous?: unknown };
  const c = typeof b.cents === "string" ? Number(b.cents) : b.cents;
  const cap = typeof b.cap === "string" ? Number(b.cap) : b.cap;
  if (typeof c !== "number" || !Number.isFinite(c) || c < PLEDGE_MIN_CENTS || c > PLEDGE_MAX_CENTS || !hundredths(c))
    return "Pick a rate from 1¢ to $10 a kilometer.";
  if (typeof cap !== "number" || !Number.isInteger(cap) || cap < PLEDGE_MIN_CAP || cap > PLEDGE_MAX_CAP) return "Set a cap in whole dollars, $5 or more.";
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 40) return "Put the name the receipts should show (40 letters at most).";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";
  /* Anonymous unless the giver turned it off. */
  return { centsPerKm: c, capDollars: cap, name, note, anonymous: b.anonymous !== false };
}

const SELECT = {
  id: true,
  accountId: true,
  email: true,
  name: true,
  centsPerKm: true,
  capDollars: true,
  note: true,
  anonymous: true,
  status: true,
  decidedAt: true,
  decidedBy: true,
  welcomeSentAt: true,
  claimedAt: true,
  doneSentAt: true,
  createdAt: true,
} as const;

export async function pledgesWhere(where: { status?: PledgeStatus; accountId?: string }): Promise<PledgeRow[]> {
  return db.m2dPledge.findMany({ where: { challenge: CHALLENGE, window: M2D_KEY, ...where }, select: SELECT, orderBy: { createdAt: "asc" } });
}

/* Approved pledges, or none when the table cannot be read (before the
 * production build has pushed it, say): a pledge never takes the M2D page
 * down with it. */
export async function approvedPledges(): Promise<PledgeRow[]> {
  try {
    return await pledgesWhere({ status: "approved" });
  } catch (err) {
    console.error("M2D pledges: not read", err);
    return [];
  }
}

type Entry = { participantId: string; meters: number; createdAt: Date };
/* The registered rows that can fill a pledge approved at `since`, oldest
 * logged first. */
export async function pledgeEntries(since: Date | null): Promise<Entry[]> {
  if (!since) return [];
  return db.rowEntry.findMany({
    where: { challenge: CHALLENGE, day: { gte: M2D_FIRST, lte: M2D_LAST }, createdAt: { gte: since }, meters: { gt: 0 } },
    select: { participantId: true, meters: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/* THE FILL, for one pledge: walk the rows logged after its approval, pay
 * each kilometer at its rate until the cap, and send each row's dollars
 * where its rower picked. */
export function fillPledge(p: Pick<PledgeRow, "centsPerKm" | "capDollars" | "decidedAt">, entries: Entry[], ins: Map<string, Shares | null>): PledgeFill {
  const split = zeroSplit();
  const capKm = capKmOf(p.centsPerKm, p.capDollars);
  let left = p.capDollars;
  let filledAt: Date | null = null;
  if (p.decidedAt) {
    const from = p.decidedAt.getTime();
    for (const e of entries) {
      if (e.createdAt.getTime() < from || !ins.has(e.participantId)) continue;
      const d = Math.min(left, (e.meters / 1000) * (p.centsPerKm / 100));
      if (d <= 0) continue;
      left -= d;
      const shares = ins.get(e.participantId);
      for (const c of CHARITIES) split[c.key] += (d * ((shares?.[c.key] ?? 0) as number)) / 100;
      if (left <= 1e-9) {
        filledAt = e.createdAt;
        break;
      }
    }
  }
  const dollars = filledAt ? p.capDollars : cents(p.capDollars - left);
  for (const c of CHARITIES) split[c.key] = cents(split[c.key]);
  /* The lines must add up to the dollars: the cent left over by rounding
   * goes to the biggest. */
  const gap = cents(dollars - CHARITIES.reduce((a, c) => a + split[c.key], 0));
  if (gap !== 0 && dollars > 0) {
    const big = CHARITIES.reduce((a, c) => (split[c.key] > split[a.key] ? c : a), CHARITIES[0]);
    split[big.key] = cents(split[big.key] + gap);
  }
  const km = filledAt ? capKm : (p.centsPerKm > 0 ? (dollars * 100) / p.centsPerKm : 0);
  return { km, capKm, dollars, filled: !!filledAt, filledAt, split };
}

/* Every approved pledge with its fill. One read of the rows, from the
 * oldest approval. */
export async function filledPledges(ins: Map<string, Shares | null>, list?: PledgeRow[]): Promise<(PledgeRow & { fill: PledgeFill })[]> {
  const pledges = list ?? (await approvedPledges());
  if (pledges.length === 0) return [];
  const since = pledges.reduce<Date | null>((a, p) => (p.decidedAt && (!a || p.decidedAt < a) ? p.decidedAt : a), null);
  const entries = await pledgeEntries(since);
  return pledges.map((p) => ({ ...p, fill: fillPledge(p, entries, ins) }));
}
