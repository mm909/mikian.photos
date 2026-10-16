import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canEdit, checkBucket, checkPayer, getExpense, liveChildCount, parseExpenseInput, viewWithChildren } from "@/lib/lasd26/expenses";
import { badJson, notFound, notYours, readJson, requireTeamWrite } from "../guard";

/**
 * PATCH  /api/lasd26/expenses/[id] — change title / amount / paidById /
 *        estimate / parentId / note (only the fields sent). Owner or
 *        whoever added it. paidById names who fronted the line (a member
 *        of this team, or null to clear it — 400 for anyone else).
 *        parentId moves a line into a bucket (a live, top-level estimate
 *        of this team) or, as null, back out — the page no longer offers
 *        the move (owner, 2026-10-16: the in-bucket button is the only
 *        way in), the API keeps it so the owner can detach by hand; the
 *        bucket rules (lib/lasd26/expenses checkBucket) answer 400: a
 *        child cannot be an estimate, a bucket with real costs inside
 *        cannot move into another bucket, and cannot stop being an
 *        estimate while it holds them. A line that becomes an estimate
 *        drops its payer (nobody fronts a round number).
 * DELETE /api/lasd26/expenses/[id] — soft delete (deletedAt); the receipts
 *        stay in R2 with the row's history. A bucket's live children are
 *        detached in the same transaction and carry on as their own lines
 *        (the schema's SetNull only fires on a hard delete, so the soft
 *        one does it by hand); the response says how many.
 */
export const runtime = "nodejs";

const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireTeamWrite();
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id);
  if (!expense) return notFound();
  if (!canEdit(gate.viewer, expense)) return notYours();
  const body = await readJson(req);
  if (!body) return badJson();
  const parsed = parseExpenseInput(body, { partial: true });
  if (!parsed.ok) return bad(parsed.error);
  const data = parsed.data;

  // The flags the line will carry after the write, whichever were sent.
  const nextEstimate = data.estimate ?? expense.estimate;
  const nextParent = data.parentId !== undefined ? data.parentId : expense.parentId;

  if (data.parentId !== undefined && data.parentId !== null) {
    const bucket = await checkBucket(data.parentId, { estimate: nextEstimate, self: expense });
    if (!bucket.ok) return bad(bucket.error);
  } else if (nextParent !== null && nextEstimate) {
    // Staying in its bucket but asking to become an estimate.
    return bad("A real cost filed under an estimate cannot itself be an estimate.");
  }
  if (data.estimate === false && expense.estimate && (await liveChildCount(expense.id)) > 0) {
    return bad("This line holds real costs, so it stays an estimate — move them out first.");
  }
  if (data.paidById !== undefined && data.paidById !== null && data.paidById !== expense.paidById) {
    const payer = await checkPayer(data.paidById);
    if (!payer.ok) return bad(payer.error);
  }
  if (nextEstimate) data.paidById = null;

  await db.teamExpense.update({ where: { id: expense.id }, data });
  const fresh = await getExpense(expense.id);
  if (!fresh) return notFound();
  return NextResponse.json({ ok: true, expense: await viewWithChildren(fresh, gate.viewer) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireTeamWrite();
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id);
  if (!expense) return notFound();
  if (!canEdit(gate.viewer, expense)) return notYours();
  const [, detached] = await db.$transaction([
    db.teamExpense.update({ where: { id: expense.id }, data: { deletedAt: new Date() } }),
    // Live children go top-level; a child deleted earlier keeps its parentId
    // as history, like the receipts stay.
    db.teamExpense.updateMany({ where: { parentId: expense.id, deletedAt: null }, data: { parentId: null } }),
  ]);
  return NextResponse.json({ ok: true, detached: detached.count });
}
