import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canEdit, checkBucket, checkPayer, getExpense, liveChildCount, parseExpenseInput, viewWithChildren } from "@/lib/lasd26/expenses";
import { bad, badJson, readJson, requireTspWrite } from "@/lib/tsp/guard";
import { notFound, notYours } from "../shared";

/**
 * PATCH / DELETE /api/tsp/[team]/expenses/[id] — the lasd26 rules
 * (src/app/api/lasd26/expenses/[id]/route.ts) for one TSP team. PATCH with
 * parentId is how a cost is RE-FILED under a bucket, or taken back out with
 * null (owner, 2026-11-16: "you just need to be able to reassign or
 * rebucketize"): whoever added the line, or a captain for anyone's.
 */
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { team: string; id: string } }) {
  const team = params.team;
  const gate = await requireTspWrite(team, "expense");
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id, team);
  if (!expense) return notFound();
  if (!canEdit(gate.viewer, expense)) return notYours();
  const body = await readJson(req);
  if (!body) return badJson();
  const parsed = parseExpenseInput(body, { partial: true });
  if (!parsed.ok) return bad(parsed.error);
  const data = parsed.data;

  const nextEstimate = data.estimate ?? expense.estimate;
  const nextParent = data.parentId !== undefined ? data.parentId : expense.parentId;
  if (data.estimate === true && !expense.estimate && !gate.viewer.captain) return bad("Only a captain can make a line an estimate.", 403);

  if (data.parentId !== undefined && data.parentId !== null) {
    const bucket = await checkBucket(data.parentId, { estimate: nextEstimate, self: expense, team });
    if (!bucket.ok) return bad(bucket.error);
  } else if (nextParent !== null && nextEstimate) {
    return bad("A real cost filed under an estimate cannot itself be an estimate.");
  }
  if (data.estimate === false && expense.estimate && (await liveChildCount(expense.id)) > 0) {
    return bad("This line holds real costs, so it stays an estimate — move them out first.");
  }
  if (data.estimate === true && !expense.estimate && expense.receipts.length > 0) {
    return bad("This line has receipts on it, so it stays a real cost — receipts go on the real costs under a category.");
  }
  if (data.paidById !== undefined && data.paidById !== null && data.paidById !== expense.paidById) {
    const payer = await checkPayer(data.paidById, team);
    if (!payer.ok) return bad(payer.error);
  }
  if (nextEstimate) data.paidById = null;

  await db.teamExpense.update({ where: { id: expense.id }, data });
  const fresh = await getExpense(expense.id, team);
  if (!fresh) return notFound();
  return NextResponse.json({ ok: true, expense: await viewWithChildren(fresh, gate.viewer) });
}

export async function DELETE(_req: Request, { params }: { params: { team: string; id: string } }) {
  const gate = await requireTspWrite(params.team, "expense");
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id, params.team);
  if (!expense) return notFound();
  if (!canEdit(gate.viewer, expense)) return notYours();
  const [, detached] = await db.$transaction([
    db.teamExpense.update({ where: { id: expense.id }, data: { deletedAt: new Date() } }),
    db.teamExpense.updateMany({ where: { parentId: expense.id, deletedAt: null }, data: { parentId: null } }),
  ]);
  return NextResponse.json({ ok: true, detached: detached.count });
}
