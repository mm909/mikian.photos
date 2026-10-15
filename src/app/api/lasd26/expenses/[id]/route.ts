import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canEdit, getExpense, parseExpenseInput, toView } from "@/lib/lasd26/expenses";
import { badJson, notFound, notYours, readJson, requireTeamWrite } from "../guard";

/**
 * PATCH  /api/lasd26/expenses/[id] — change title / amount / note /
 *        estimate (only the fields sent). Owner or whoever added it.
 * DELETE /api/lasd26/expenses/[id] — soft delete (deletedAt); the receipts
 *        stay in R2 with the row's history.
 */
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireTeamWrite();
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id);
  if (!expense) return notFound();
  if (!canEdit(gate.viewer, expense)) return notYours();
  const body = await readJson(req);
  if (!body) return badJson();
  const parsed = parseExpenseInput(body, { partial: true });
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  await db.teamExpense.update({ where: { id: expense.id }, data: parsed.data });
  const fresh = await getExpense(expense.id);
  if (!fresh) return notFound();
  return NextResponse.json({ ok: true, expense: toView(fresh, gate.viewer) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireTeamWrite();
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id);
  if (!expense) return notFound();
  if (!canEdit(gate.viewer, expense)) return notYours();
  await db.teamExpense.update({ where: { id: expense.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
