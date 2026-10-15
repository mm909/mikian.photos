import "server-only";
import { db } from "@/lib/db";
import { TEAM, getSettings, type Member } from "./team";
import { perPersonCents, totalCents } from "./money";

/**
 * Settling up (owner, 2026-10-15: "each person's share payable on the site
 * by card after the race"). What the crew owes as a whole, and what one
 * member still owes, both from the live cost sheet — the TeamExpense rows
 * the expenses page keeps — divided by TeamSettings.splitCount (18 on the
 * sheet; the member count is NOT what divides, see money.ts).
 *
 * Nothing here decides who may SEE the number: the page and the API do
 * that from getTeamViewer + settleOpen. The pay button is the owner's
 * alone until he flips settleOpen (Team → settings).
 */

export type Due = {
  /** Every live cost on the sheet, cents. */
  totalCents: number;
  /** The part of it that is still a round-number estimate (Gas, Race day food). */
  estimatedCents: number;
  /** How many ways it splits (TeamSettings.splitCount). */
  splitCount: number;
  /** Each person's share, rounded up to the cent. */
  perPersonCents: number;
  /** The owner has opened settling up to the team. */
  settleOpen: boolean;
};

/** The crew's bill today. Never throws: a db hiccup reads as an empty sheet. */
export async function dueFor(team: string = TEAM): Promise<Due> {
  let lines: { amountCents: number; estimate: boolean; deletedAt: Date | null }[] = [];
  try {
    lines = await db.teamExpense.findMany({
      where: { team, deletedAt: null },
      select: { amountCents: true, estimate: true, deletedAt: true },
    });
  } catch (err) {
    console.error("lasd26/settle: expense sum failed (table pushed?)", err);
  }
  const settings = await getSettings(team);
  const { total, estimated } = totalCents(lines);
  return {
    totalCents: total,
    estimatedCents: estimated,
    splitCount: settings.splitCount,
    perPersonCents: perPersonCents(total, settings.splitCount),
    settleOpen: settings.settleOpen,
  };
}

export type MemberDue = {
  /** The share this member carries (= Due.perPersonCents). */
  dueCents: number;
  /** What they have paid so far, cents (0 until they pay). */
  paidCents: number;
  paidAt: Date | null;
  /** 'paypal' | 'manual' | null. */
  paidVia: string | null;
  /** Marked paid (by PayPal or by the owner's hand). */
  paid: boolean;
  /** What is still owed. 0 once paid — a short manual mark counts as settled. */
  outstandingCents: number;
};

/**
 * One member against the bill. A row with paidAt set is settled whatever
 * the cents say: the owner marks Venmo/Zelle by hand and may round. Only
 * an unpaid member has an outstanding share, and it is the whole share.
 */
export function memberDue(member: Pick<Member, "paidAt" | "paidCents" | "paidVia">, due: Pick<Due, "perPersonCents">): MemberDue {
  const paid = member.paidAt !== null;
  const paidCents = paid ? Math.max(0, member.paidCents ?? 0) : 0;
  return {
    dueCents: due.perPersonCents,
    paidCents,
    paidAt: member.paidAt,
    paidVia: paid ? member.paidVia : null,
    paid,
    outstandingCents: paid ? 0 : due.perPersonCents,
  };
}

/** Both at once, for a page or route that already has the member. */
export async function memberDueFor(member: Pick<Member, "paidAt" | "paidCents" | "paidVia">, team: string = TEAM): Promise<{ due: Due; mine: MemberDue }> {
  const due = await dueFor(team);
  return { due, mine: memberDue(member, due) };
}

/** "Oct 26" in Pacific time, for the PAID line. */
export function paidStamp(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(d);
}

/** 'paypal' → "PayPal", 'manual' → "Venmo / Zelle / cash (marked by Mikian)". */
export function viaLabel(via: string | null): string {
  if (via === "paypal") return "PayPal";
  if (via === "manual") return "marked paid by Mikian";
  return "—";
}
