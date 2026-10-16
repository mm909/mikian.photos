import "server-only";
import { db } from "@/lib/db";
import { TEAM, getSettings, listMembers, type Member, type TeamRole } from "./team";
import { TOTAL_SELECT, frontedLines, perPersonCents, settlement, type ExpenseLine } from "./money";

/**
 * Settling up (owner, 2026-10-15: "each person's share payable on the site
 * by card after the race"; 2026-10-16: "if someone pays for something like
 * gas and then has to settle up later there should be a way to deduct that
 * from their total … the math is right (everyone pays their fair share),
 * it's clear to everyone (I would have paid x but I already spent y so now
 * I owe z), and prevent me from having to reimburse someone for them to
 * just pay it back").
 *
 * The rule is in money.ts (settlement(), pure, checked by money.test.ts);
 * this file puts the db under it. For each member on the roster:
 *
 *   share    = the total ÷ splitCount (18 on the sheet; the member count is
 *              NOT what divides, see money.ts)
 *   fronted  = Σ live real lines with paidById = them (bucket children
 *              included, estimates never)
 *   net      = share − fronted
 *   net > 0  → they OWE net (card on the pay page, or the owner marks it)
 *   net < 0  → they are OWED −net: the owner pays them out of the pool
 *              after the race and marks it settled
 *   net = 0  → square
 *
 * Once settling up is open the total is the REAL costs only (owner: "When
 * I make settle up go live replace the estimate costs w/ the real cost"),
 * so what the crew pays in is exactly what was fronted — see the identity
 * in money.test.ts.
 *
 * Nothing here decides who may SEE the numbers: the page and the API do
 * that from getTeamViewer + settleOpen. The pay button is the owner's
 * alone until he flips settleOpen (Team → settings).
 */

export type MemberStatus = "owes" | "paid" | "owed" | "square";

export type FrontedLine = { id: string; title: string; amountCents: number };

export type MemberRow = {
  memberId: string;
  name: string;
  role: TeamRole;
  /** Their share of the total (= Due.perPersonCents). */
  shareCents: number;
  /** What they fronted (money.ts frontedCents). */
  frontedCents: number;
  /** The lines behind it, newest first — "YOU FRONTED" lists them. */
  fronted: FrontedLine[];
  /** share − fronted: > 0 they owe it, < 0 the pool owes them. */
  netCents: number;
  /** What they have paid in, cents (0 until they pay). */
  paidCents: number;
  paidAt: Date | null;
  /** 'card' | 'paypal' | 'manual' | null. */
  paidVia: string | null;
  /** The owner paid them out of the pool: when, how much. */
  settledAt: Date | null;
  settledCents: number | null;
  status: MemberStatus;
  /** Still to be paid in: net while they owe it, 0 once paid / owed / square. */
  outstandingCents: number;
  /** Still to be paid out: −net while they are owed, 0 once settled. */
  owedCents: number;
};

export type Due = {
  /** Every live cost on the sheet, cents (real costs only once settleOpen). */
  totalCents: number;
  /** The part of it that is still a round-number estimate (0 once settleOpen). */
  estimatedCents: number;
  confirmedCents: number;
  /** How many ways it splits (TeamSettings.splitCount). */
  splitCount: number;
  /** Each person's share. */
  perPersonCents: number;
  /** The owner has opened settling up to the team. */
  settleOpen: boolean;
  /** Every member against the bill, roster order. */
  members: MemberRow[];
  /** Σ fronted across the roster. */
  frontedCents: number;
  /** Σ outstanding — what is still to come in. */
  toCollectCents: number;
  /** Σ owed — what the owner still pays out. */
  toPayOutCents: number;
  /** Members whose status is "paid". */
  paidCount: number;
};

type SettleLine = ExpenseLine & { id: string; title: string; paidById: string | null };

/**
 * Where a member stands. A row with paidAt set is settled whatever the
 * cents say — the owner marks Venmo/Zelle by hand and may round, and a
 * share that moved a few cents after a card payment is not chased. A
 * member the pool owes is "paid" once the owner has marked the payout
 * (settledAt); net 0 is square either way.
 */
export function statusOf(m: Pick<Member, "paidAt" | "settledAt">, netCents: number): MemberStatus {
  if (m.paidAt !== null) return "paid";
  if (netCents > 0) return "owes";
  if (netCents < 0) return m.settledAt !== null ? "paid" : "owed";
  return "square";
}

function rowFor(m: Member, share: number, fronted: number, lines: FrontedLine[]): MemberRow {
  const net = share - fronted;
  const status = statusOf(m, net);
  const paid = m.paidAt !== null;
  return {
    memberId: m.id,
    name: m.name,
    role: m.role,
    shareCents: share,
    frontedCents: fronted,
    fronted: lines,
    netCents: net,
    paidCents: paid ? Math.max(0, m.paidCents ?? 0) : 0,
    paidAt: m.paidAt,
    paidVia: paid ? m.paidVia : null,
    settledAt: m.settledAt,
    settledCents: m.settledAt !== null ? m.settledCents : null,
    status,
    outstandingCents: status === "owes" ? net : 0,
    owedCents: status === "owed" ? -net : 0,
  };
}

/** The crew's bill today, member by member. Never throws: a db hiccup reads as an empty sheet / roster. */
export async function dueFor(team: string = TEAM): Promise<Due> {
  let lines: SettleLine[] = [];
  let members: Member[] = [];
  try {
    [lines, members] = await Promise.all([
      db.teamExpense.findMany({
        where: { team, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { ...TOTAL_SELECT, title: true },
      }),
      listMembers(team),
    ]);
  } catch (err) {
    console.error("lasd26/settle: sheet / roster read failed (tables pushed?)", err);
  }
  const settings = await getSettings(team);
  const s = settlement(lines, members.map((m) => m.id), settings.splitCount, { settleOpen: settings.settleOpen });
  const rows = members.map((m, i) => {
    const r = s.rows[i];
    const mine = frontedLines(lines, m.id).map((l) => ({ id: l.id, title: l.title, amountCents: l.amountCents }));
    return rowFor(m, r.shareCents, r.frontedCents, mine);
  });
  let toCollect = 0;
  let toPayOut = 0;
  let paidCount = 0;
  for (const r of rows) {
    toCollect += r.outstandingCents;
    toPayOut += r.owedCents;
    if (r.status === "paid") paidCount++;
  }
  return {
    totalCents: s.total,
    estimatedCents: s.estimated,
    confirmedCents: s.total - s.estimated,
    splitCount: settings.splitCount,
    perPersonCents: s.perPersonCents,
    settleOpen: settings.settleOpen,
    members: rows,
    frontedCents: s.frontedCents,
    toCollectCents: toCollect,
    toPayOutCents: toPayOut,
    paidCount,
  };
}

/**
 * One member's row out of the bill, for the pay page and the PayPal route.
 * A member who is not on the roster the bill was drawn from (a row made
 * between the two reads) carries the plain share with nothing fronted.
 */
export function memberDue(member: Member, due: Due): MemberRow {
  return due.members.find((r) => r.memberId === member.id) ?? rowFor(member, due.perPersonCents, 0, []);
}

/** Both at once, for a page or route that already has the member. */
export async function memberDueFor(member: Member, team: string = TEAM): Promise<{ due: Due; mine: MemberRow }> {
  const due = await dueFor(team);
  return { due, mine: memberDue(member, due) };
}

/** The share alone, for a caller that only needs the number. */
export function shareFor(totalCents: number, splitCount: number): number {
  return perPersonCents(totalCents, splitCount);
}

/** "Oct 26" in Pacific time, for the PAID line. */
export function paidStamp(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(d);
}

/** 'card' → "card", 'paypal' → "PayPal", 'manual' → "marked paid by Mikian". */
export function viaLabel(via: string | null): string {
  if (via === "card") return "card";
  if (via === "paypal") return "PayPal";
  if (via === "manual") return "marked paid by Mikian";
  return "—";
}
