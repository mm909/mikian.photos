import "server-only";
import { db } from "@/lib/db";
import { TEAM, getSettings, type TeamViewer } from "./team";
import { fmtUsd, parseUsd, perPersonCents, totalCents } from "./money";

/**
 * The crew's expenses (owner, 2026-10-15: "kind of like an invoice" — every
 * cost, where it came from, and each person's share). Server side only;
 * the page and the API both read through here so the shapes match.
 *
 * Who may change a line: the owner, or the member who added it (canEdit).
 * A line seeded from the cost sheet has no addedBy, so only the owner
 * touches it. Any member may ATTACH a receipt to any line ("attach
 * receipts to existing items") — the gas receipt is whoever filled up —
 * and may take their own receipt back off any line (canRemoveReceipt),
 * whether or not they may edit the line itself.
 *
 * Deleting is soft (deletedAt): the receipts stay in R2 and the row keeps
 * its history; totalCents() skips deleted lines.
 */

export const TITLE_MAX = 80;
export const NOTE_MAX = 400;
/** A sanity ceiling, not a budget: $100,000 in cents. */
export const AMOUNT_MAX_CENTS = 10_000_000;

/* ─── Shapes the client sees (JSON-safe) ─────────────────────────────────── */

export type ReceiptView = {
  id: string;
  contentType: string;
  bytes: number;
  /** An image got a 640 px jpeg beside it; a pdf did not. */
  hasThumb: boolean;
  createdAt: string;
  /** The viewer attached it, so the × shows even when they cannot edit the line. */
  addedByMe: boolean;
};

export type ExpenseView = {
  id: string;
  title: string;
  amountCents: number;
  /** fmtUsd(amountCents), so the client never re-formats money. */
  amount: string;
  note: string;
  estimate: boolean;
  /** The member's name, or null for a line seeded from the cost sheet. */
  addedBy: string | null;
  createdAt: string;
  receipts: ReceiptView[];
  /** Owner, or the member who added it. */
  canEdit: boolean;
};

export type ExpensesPayload = {
  expenses: ExpenseView[];
  totalCents: number;
  estimatedCents: number;
  confirmedCents: number;
  /** TeamSettings.splitCount — what divides (18 on the cost sheet). */
  splitCount: number;
  perPersonCents: number;
  /** TeamMember rows so far ("<m> of <n> joined"). */
  memberCount: number;
};

/* ─── Reading ─────────────────────────────────────────────────────────────── */

const EXPENSE_SELECT = {
  id: true,
  team: true,
  title: true,
  amountCents: true,
  note: true,
  estimate: true,
  addedById: true,
  createdAt: true,
  deletedAt: true,
  addedBy: { select: { name: true } },
  receipts: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, contentType: true, bytes: true, thumbKey: true, addedById: true, createdAt: true },
  },
} as const;

type ExpenseRow = {
  id: string;
  team: string;
  title: string;
  amountCents: number;
  note: string;
  estimate: boolean;
  addedById: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  addedBy: { name: string } | null;
  receipts: Array<{ id: string; contentType: string; bytes: number; thumbKey: string | null; addedById: string | null; createdAt: Date }>;
};

export type ExpenseList = {
  expenses: ExpenseRow[];
  totals: { total: number; estimated: number; confirmed: number };
  splitCount: number;
  perPerson: number;
  memberCount: number;
};

/** Live lines (not deleted), newest first, with the sums the summary block shows. */
export async function listExpenses(team: string = TEAM): Promise<ExpenseList> {
  const [rows, settings, memberCount] = await Promise.all([
    db.teamExpense.findMany({ where: { team, deletedAt: null }, orderBy: { createdAt: "desc" }, select: EXPENSE_SELECT }),
    getSettings(team),
    db.teamMember.count({ where: { team } }),
  ]);
  const expenses = rows as ExpenseRow[];
  const totals = totalCents(expenses);
  return { expenses, totals, splitCount: settings.splitCount, perPerson: perPersonCents(totals.total, settings.splitCount), memberCount };
}

/** One live line by id (team-scoped), or null. */
export async function getExpense(id: string, team: string = TEAM): Promise<ExpenseRow | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null;
  const row = await db.teamExpense.findFirst({ where: { id, team, deletedAt: null }, select: EXPENSE_SELECT });
  return (row as ExpenseRow | null) ?? null;
}

/** Owner, or the member who added it. A seeded line (addedById null) is the owner's. */
export function canEdit(viewer: TeamViewer, expense: { addedById: string | null }): boolean {
  if (viewer.owner) return true;
  return expense.addedById !== null && viewer.member !== null && expense.addedById === viewer.member.id;
}

/** The viewer attached this receipt themselves (a receipt the owner attached without a member row matches nobody). */
export function addedByMe(viewer: TeamViewer, receipt: { addedById: string | null }): boolean {
  return receipt.addedById !== null && viewer.member !== null && receipt.addedById === viewer.member.id;
}

/**
 * Who may take a receipt off a line: anyone who may edit the line, or
 * whoever attached that receipt. The review (2026-10-15, finding #1): a
 * member who attached a receipt to someone else's line — a seeded one
 * included, addedById null — could not remove it, since only canEdit was
 * asked.
 */
export function canRemoveReceipt(viewer: TeamViewer, expense: { addedById: string | null }, receipt: { addedById: string | null }): boolean {
  return canEdit(viewer, expense) || addedByMe(viewer, receipt);
}

export function toView(expense: ExpenseRow, viewer: TeamViewer): ExpenseView {
  return {
    id: expense.id,
    title: expense.title,
    amountCents: expense.amountCents,
    amount: fmtUsd(expense.amountCents),
    note: expense.note,
    estimate: expense.estimate,
    addedBy: expense.addedBy?.name ?? null,
    createdAt: expense.createdAt.toISOString(),
    receipts: expense.receipts.map((r) => ({
      id: r.id,
      contentType: r.contentType,
      bytes: r.bytes,
      hasThumb: r.thumbKey !== null,
      createdAt: r.createdAt.toISOString(),
      addedByMe: addedByMe(viewer, r),
    })),
    canEdit: canEdit(viewer, expense),
  };
}

/** Everything the page (and GET /api/lasd26/expenses) hands the client. */
export async function expensesPayload(viewer: TeamViewer, team: string = TEAM): Promise<ExpensesPayload> {
  const list = await listExpenses(team);
  return {
    expenses: list.expenses.map((e) => toView(e, viewer)),
    totalCents: list.totals.total,
    estimatedCents: list.totals.estimated,
    confirmedCents: list.totals.confirmed,
    splitCount: list.splitCount,
    perPersonCents: list.perPerson,
    memberCount: list.memberCount,
  };
}

/* ─── Input ───────────────────────────────────────────────────────────────── */

export type ExpenseInput = { title: string; amountCents: number; note: string; estimate: boolean };

/**
 * Check a POST (every field) or PATCH (`partial`: only the fields sent)
 * body. Amount goes through parseUsd so "1,415", "$505" and 600 all land
 * as cents; the message is what the form shows.
 */
export function parseExpenseInput(body: Record<string, unknown>, opts: { partial: true }): { ok: true; data: Partial<ExpenseInput> } | { ok: false; error: string };
export function parseExpenseInput(body: Record<string, unknown>, opts?: { partial?: false }): { ok: true; data: ExpenseInput } | { ok: false; error: string };
export function parseExpenseInput(body: Record<string, unknown>, opts: { partial?: boolean } = {}): { ok: true; data: Partial<ExpenseInput> } | { ok: false; error: string } {
  const data: Partial<ExpenseInput> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined;

  if (has("title") || !opts.partial) {
    const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
    if (!title) return { ok: false, error: "What was it for? Add a title." };
    if (title.length > TITLE_MAX) return { ok: false, error: `Keep the title under ${TITLE_MAX} characters.` };
    data.title = title;
  }
  if (has("amount") || !opts.partial) {
    const cents = parseUsd(body.amount);
    if (cents === null) return { ok: false, error: "Add the amount in dollars, like 283 or 371.25." };
    if (cents > AMOUNT_MAX_CENTS) return { ok: false, error: "That amount is too big to be right." };
    data.amountCents = cents;
  }
  if (has("note") || !opts.partial) {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > NOTE_MAX) return { ok: false, error: `Keep the note under ${NOTE_MAX} characters.` };
    data.note = note;
  }
  if (has("estimate") || !opts.partial) {
    data.estimate = body.estimate === true || body.estimate === "true" || body.estimate === 1;
  }
  if (opts.partial && Object.keys(data).length === 0) return { ok: false, error: "Nothing to change." };
  return { ok: true, data };
}
