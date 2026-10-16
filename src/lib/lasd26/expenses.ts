import "server-only";
import { db } from "@/lib/db";
import { TEAM, getSettings, listMembers, type TeamViewer } from "./team";
import { bucketSum, fmtUsd, parseUsd, perPersonCents, totalCents, type TotalOpts } from "./money";

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
 * PAID BY (owner, 2026-10-16: "Instead of having a note just make it a
 * 'paid by' and auto fill the name of the user logged in"). Every real
 * line carries paidById — the member who fronted it; the form defaults it
 * to the signed-in member and what a member fronted comes off their share
 * when they settle up (money.ts settlement, settle.ts). The note column
 * stays in the schema and the API takes it, but nothing shows or edits it
 * any more.
 *
 * BUCKETS (owner, 2026-10-16: "How do I let people add real expenses to
 * the food/gas estimates"). An ESTIMATE line is a bucket; a real cost is
 * filed under it with parentId ("Chevron $62" under "Gas $600"). The rules
 * the db cannot hold, checked in checkBucket(): only a live, top-level
 * estimate of the same team can be a parent; a child is never an estimate
 * and never a parent itself. The totals apply the bucket rule in money.ts:
 * the estimate stands until the real costs pass it, and once settling up
 * is open the estimate is dropped for the real costs (owner: "When I make
 * settle up go live replace the estimate costs w/ the real cost"). The
 * estimate itself is the owner's business (owner: "We don't need the
 * estimate line visible to the other users (keep that for me)"): the
 * payload says whether the viewer is the owner and the page shows the
 * chip, the standing line and the checkbox to him alone — a member sees a
 * bucket as a plain category card. The in-bucket "+ ADD A COST" door is
 * the only way into a bucket on the page (owner: "We also don't need the
 * part of line b/c we have the add a real cost button"); the API still
 * takes parentId on PATCH so the owner can detach by hand if ever needed.
 *
 * Deleting is soft (deletedAt): the receipts stay in R2 and the row keeps
 * its history; totalCents() skips deleted lines. Deleting a bucket
 * detaches its live children (they become top-level lines) — the soft
 * delete has to do by hand what the schema's SetNull would do on a hard
 * one.
 */

export const TITLE_MAX = 80;
export const NOTE_MAX = 400;
/** A sanity ceiling, not a budget: $100,000 in cents. */
export const AMOUNT_MAX_CENTS = 10_000_000;

const ID_RE = /^[a-z0-9]{10,40}$/i;

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

/** What an estimate line (a bucket) holds — null on a real cost. */
export type BucketView = {
  /** The live children added up ("$124.10 in real costs so far"). */
  realCents: number;
  real: string;
  /** What the bucket puts into the total: max(estimate, real), or real alone once settleOpen. */
  countedCents: number;
  counted: string;
  /** The part of the estimate the real costs have not covered yet (0 once settleOpen). */
  uncoveredCents: number;
};

/** The member who fronted a line, for the card and the PAID BY select. */
export type PayerView = { id: string; name: string };

export type ExpenseView = {
  id: string;
  title: string;
  amountCents: number;
  /** fmtUsd(amountCents), so the client never re-formats money. */
  amount: string;
  /** Kept in the API for old rows; no longer shown or edited. */
  note: string;
  estimate: boolean;
  /** The bucket this real cost is filed under, or null for a top-level line. */
  parentId: string | null;
  /** The member's name, or null for a line seeded from the cost sheet. */
  addedBy: string | null;
  /** Who fronted it; null on an estimate, or on a seeded line until the owner sets it. */
  paidBy: PayerView | null;
  createdAt: string;
  receipts: ReceiptView[];
  /** Owner, or the member who added it. */
  canEdit: boolean;
  /** Set on every estimate line, children or not; null on a real cost. */
  bucket: BucketView | null;
  /** The real costs filed under this bucket, newest first; empty on a real cost. */
  children: ExpenseView[];
};

export type ExpensesPayload = {
  /** The tree: top-level lines newest first, each bucket with its children inside. */
  expenses: ExpenseView[];
  /** Every live line, children included — the page's "N LINES". */
  lineCount: number;
  /** The roster (id + name), for the PAID BY select. */
  members: PayerView[];
  /** The viewer's own member id — what PAID BY defaults to; null for an outsider (never, past the gate). */
  meId: string | null;
  /** The viewer is the owner: the estimate chip / line / checkbox are his alone. */
  owner: boolean;
  /** Settling up is open: the sums are the real costs only. */
  settleOpen: boolean;
  totalCents: number;
  /** The part of the estimates the real costs have not covered yet (0 once settleOpen). */
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
  parentId: true,
  addedById: true,
  paidById: true,
  createdAt: true,
  deletedAt: true,
  addedBy: { select: { name: true } },
  paidBy: { select: { id: true, name: true } },
  receipts: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, contentType: true, bytes: true, thumbKey: true, addedById: true, createdAt: true },
  },
} as const;

export type ExpenseRow = {
  id: string;
  team: string;
  title: string;
  amountCents: number;
  note: string;
  estimate: boolean;
  parentId: string | null;
  addedById: string | null;
  paidById: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  addedBy: { name: string } | null;
  paidBy: { id: string; name: string } | null;
  receipts: Array<{ id: string; contentType: string; bytes: number; thumbKey: string | null; addedById: string | null; createdAt: Date }>;
};

export type ExpenseList = {
  /** Every live line, flat, newest first (children mixed in). */
  expenses: ExpenseRow[];
  totals: { total: number; estimated: number; confirmed: number };
  splitCount: number;
  settleOpen: boolean;
  perPerson: number;
  members: PayerView[];
};

/** Live lines (not deleted), newest first, with the sums the summary block shows. */
export async function listExpenses(team: string = TEAM): Promise<ExpenseList> {
  const [rows, settings, members] = await Promise.all([
    db.teamExpense.findMany({ where: { team, deletedAt: null }, orderBy: { createdAt: "desc" }, select: EXPENSE_SELECT }),
    getSettings(team),
    listMembers(team),
  ]);
  const expenses = rows as ExpenseRow[];
  const totals = totalCents(expenses, { settleOpen: settings.settleOpen });
  return {
    expenses,
    totals,
    splitCount: settings.splitCount,
    settleOpen: settings.settleOpen,
    perPerson: perPersonCents(totals.total, settings.splitCount),
    members: members.map((m) => ({ id: m.id, name: m.name })),
  };
}

/** One live line by id (team-scoped), or null. */
export async function getExpense(id: string, team: string = TEAM): Promise<ExpenseRow | null> {
  if (!ID_RE.test(id)) return null;
  const row = await db.teamExpense.findFirst({ where: { id, team, deletedAt: null }, select: EXPENSE_SELECT });
  return (row as ExpenseRow | null) ?? null;
}

/** The live real costs filed under a bucket, newest first. */
export async function listChildren(parentId: string, team: string = TEAM): Promise<ExpenseRow[]> {
  const rows = await db.teamExpense.findMany({ where: { team, parentId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: EXPENSE_SELECT });
  return rows as ExpenseRow[];
}

/** How many live lines sit in a bucket (0 for a real cost). */
export async function liveChildCount(id: string): Promise<number> {
  return db.teamExpense.count({ where: { parentId: id, deletedAt: null } });
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

/**
 * One line for the client. `children` are the live real costs under it
 * (already rows, newest first); an estimate line gets its bucket numbers
 * whether or not anything is filed under it yet, so the card can show the
 * "+ ADD A COST" door either way. `opts.settleOpen` picks the bucket rule
 * (the estimate stands / the real costs replace it).
 */
export function toView(expense: ExpenseRow, viewer: TeamViewer, children: ExpenseRow[] = [], opts: TotalOpts = {}): ExpenseView {
  const kids = children.map((c) => toView(c, viewer, [], opts));
  let bucket: BucketView | null = null;
  if (expense.estimate && expense.parentId === null) {
    const b = bucketSum(expense.amountCents, kids.map((k) => k.amountCents), opts);
    bucket = { realCents: b.realCents, real: fmtUsd(b.realCents), countedCents: b.countedCents, counted: fmtUsd(b.countedCents), uncoveredCents: b.uncoveredCents };
  }
  return {
    id: expense.id,
    title: expense.title,
    amountCents: expense.amountCents,
    amount: fmtUsd(expense.amountCents),
    note: expense.note,
    estimate: expense.estimate,
    parentId: expense.parentId,
    addedBy: expense.addedBy?.name ?? null,
    paidBy: expense.paidBy ? { id: expense.paidBy.id, name: expense.paidBy.name } : null,
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
    bucket,
    children: kids,
  };
}

/** A line with its live children fetched, under the current settle mode — what POST / PATCH hand back. */
export async function viewWithChildren(expense: ExpenseRow, viewer: TeamViewer): Promise<ExpenseView> {
  const [children, settings] = await Promise.all([
    expense.estimate && expense.parentId === null ? listChildren(expense.id, expense.team) : Promise.resolve([] as ExpenseRow[]),
    getSettings(expense.team),
  ]);
  return toView(expense, viewer, children, { settleOpen: settings.settleOpen });
}

/**
 * The flat list into the tree: top-level lines in their order, each
 * bucket with its children (the rows are already newest first). A child
 * whose bucket is not in the list (gone, or itself a child — neither can
 * happen through the API) is shown top-level, the same way totalCents()
 * counts it, so the page and the total never disagree.
 */
export function toTree(rows: ExpenseRow[], viewer: TeamViewer, opts: TotalOpts = {}): ExpenseView[] {
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  const isChild = (r: ExpenseRow) => r.parentId !== null && byId.has(r.parentId) && byId.get(r.parentId)?.parentId === null;
  const childrenOf = new Map<string, ExpenseRow[]>();
  for (const r of rows) {
    if (!isChild(r)) continue;
    const list = childrenOf.get(r.parentId as string);
    if (list) list.push(r);
    else childrenOf.set(r.parentId as string, [r]);
  }
  return rows.filter((r) => !isChild(r)).map((r) => toView(r, viewer, childrenOf.get(r.id) ?? [], opts));
}

/** Everything the page (and GET /api/lasd26/expenses) hands the client. */
export async function expensesPayload(viewer: TeamViewer, team: string = TEAM): Promise<ExpensesPayload> {
  const list = await listExpenses(team);
  const expenses = toTree(list.expenses, viewer, { settleOpen: list.settleOpen });
  return {
    expenses,
    lineCount: list.expenses.length,
    members: list.members,
    meId: viewer.member?.id ?? null,
    owner: viewer.owner,
    settleOpen: list.settleOpen,
    totalCents: list.totals.total,
    estimatedCents: list.totals.estimated,
    confirmedCents: list.totals.confirmed,
    splitCount: list.splitCount,
    perPersonCents: list.perPerson,
    memberCount: list.members.length,
  };
}

/* ─── Input ───────────────────────────────────────────────────────────────── */

export type ExpenseInput = { title: string; amountCents: number; note: string; estimate: boolean; parentId: string | null; paidById: string | null };

/** null / "" / "none" all mean nobody / top-level; anything else must look like an id. */
function parseIdOrNull(raw: unknown): string | null | undefined {
  if (raw === null || raw === "" || raw === "none" || raw === undefined) return null;
  if (typeof raw === "string" && ID_RE.test(raw)) return raw;
  return undefined;
}

/**
 * Check a POST (every field) or PATCH (`partial`: only the fields sent)
 * body. Amount goes through parseUsd so "1,415", "$505" and 600 all land
 * as cents; the message is what the form shows. parentId and paidById are
 * only checked for shape here — whether that bucket exists is
 * checkBucket()'s job and whether that payer is on the team is
 * checkPayer()'s, they need the db. A POST without paidById gets null
 * here and the route fills in the caller's member.
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
  if (has("parentId") || !opts.partial) {
    const id = parseIdOrNull(body.parentId);
    if (id === undefined) return { ok: false, error: "That bucket does not exist." };
    data.parentId = id;
  }
  if (has("paidById") || !opts.partial) {
    const id = parseIdOrNull(body.paidById);
    if (id === undefined) return { ok: false, error: "Pick who paid from the team." };
    data.paidById = id;
  }
  if (data.estimate === true && data.parentId) return { ok: false, error: "A real cost filed under an estimate cannot itself be an estimate." };
  if (opts.partial && Object.keys(data).length === 0) return { ok: false, error: "Nothing to change." };
  return { ok: true, data };
}

/** PAID BY must name a member of this team (any member — the gas receipt is whoever filled up). */
export async function checkPayer(paidById: string, team: string = TEAM): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await db.teamMember.findFirst({ where: { id: paidById, team }, select: { id: true } });
  return row ? { ok: true } : { ok: false, error: "Pick who paid from the team." };
}

/**
 * The bucket rules the db cannot hold, for a POST or a PATCH that files a
 * line under `parentId`: the parent is a live, TOP-LEVEL ESTIMATE of the
 * same team; the line going in is not an estimate (`estimate` is the flag
 * it will have after the write) and has no children of its own (`self`,
 * on a PATCH — a bucket cannot move into a bucket, and a line cannot be
 * its own parent). Returns the parent row, or the 400 message.
 */
export async function checkBucket(
  parentId: string,
  opts: { estimate: boolean; self?: ExpenseRow | null; team?: string },
): Promise<{ ok: true; parent: ExpenseRow } | { ok: false; error: string }> {
  const team = opts.team ?? TEAM;
  if (opts.estimate) return { ok: false, error: "A real cost filed under an estimate cannot itself be an estimate." };
  if (opts.self && opts.self.id === parentId) return { ok: false, error: "A line cannot be filed under itself." };
  const parent = await getExpense(parentId, team);
  if (!parent) return { ok: false, error: "That bucket is gone — pick another or leave it top-level." };
  if (!parent.estimate || parent.parentId !== null) return { ok: false, error: "Only an estimate line (Gas, Race day food) can hold real costs." };
  if (opts.self && (await liveChildCount(opts.self.id)) > 0) {
    return { ok: false, error: "This line has real costs filed under it; move them out before filing it under another." };
  }
  return { ok: true, parent };
}
