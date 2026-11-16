import { NextResponse } from "next/server";
import { canRemoveReceipt, getExpense } from "@/lib/lasd26/expenses";
import { deleteReceipt, getReceipt } from "@/lib/lasd26/receipts";
import { bad, requireTspWrite } from "@/lib/tsp/guard";
import { notFound, notYourReceipt } from "../../../shared";

/** DELETE /api/tsp/[team]/expenses/[id]/receipts/[receiptId] — a captain, or whoever attached this receipt. */
export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { team: string; id: string; receiptId: string } }) {
  const gate = await requireTspWrite(params.team, "receipt");
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id, params.team);
  if (!expense) return notFound();
  const receipt = await getReceipt(params.receiptId);
  if (!receipt || receipt.expenseId !== expense.id) return bad("No such receipt.", 404);
  if (!canRemoveReceipt(gate.viewer, receipt)) return notYourReceipt();
  await deleteReceipt(receipt);
  return NextResponse.json({ ok: true });
}
