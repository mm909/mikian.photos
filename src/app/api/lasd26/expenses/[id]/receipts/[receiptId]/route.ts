import { NextResponse } from "next/server";
import { canRemoveReceipt, getExpense } from "@/lib/lasd26/expenses";
import { deleteReceipt, getReceipt } from "@/lib/lasd26/receipts";
import { notFound, notYourReceipt, requireTeamWrite } from "../../../guard";

/**
 * DELETE /api/lasd26/expenses/[id]/receipts/[receiptId] — drop a receipt
 * (object + thumb from R2, then the row). The owner, or whoever attached
 * THIS receipt — nobody else, the line's author included (owner,
 * 2026-10-16: "make sure other people can't delete my receipts; it's okay
 * for them to delete their own but not other people's"). The member who
 * put a receipt on someone else's line — a seeded one included — may
 * still take it back (the review, 2026-10-15, finding #1). Counts against
 * the receipt lid, not the expense lid.
 */
export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string; receiptId: string } }) {
  const gate = await requireTeamWrite("receipt");
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id);
  if (!expense) return notFound();
  const receipt = await getReceipt(params.receiptId);
  if (!receipt || receipt.expenseId !== expense.id) return NextResponse.json({ ok: false, error: "No such receipt." }, { status: 404 });
  if (!canRemoveReceipt(gate.viewer, receipt)) return notYourReceipt();
  await deleteReceipt(receipt);
  return NextResponse.json({ ok: true });
}
