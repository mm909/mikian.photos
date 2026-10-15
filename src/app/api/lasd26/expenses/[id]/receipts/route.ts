import { NextResponse } from "next/server";
import { getExpense } from "@/lib/lasd26/expenses";
import { registerReceipt } from "@/lib/lasd26/receipts";
import { badJson, notFound, readJson, requireTeamWrite } from "../../guard";

/**
 * POST /api/lasd26/expenses/[id]/receipts — register an upload that
 * landed: { key, contentType, bytes } → { ok, receipt }. The server pulls
 * the object back (proof it exists, true byte count), makes the 640 px
 * thumb for an image, and writes the TeamReceipt row. `bytes` from the
 * client is advisory; the stored count is what R2 holds. Counts against
 * the receipt lid (400/hour), not the expense lid — see guard.ts.
 */
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireTeamWrite("receipt");
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id);
  if (!expense) return notFound();
  const body = await readJson(req);
  if (!body) return badJson();
  const key = typeof body.key === "string" ? body.key : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";

  const reg = await registerReceipt({ expenseId: expense.id, key, contentType, addedById: gate.viewer.member?.id ?? null });
  if (!reg.ok) return NextResponse.json({ ok: false, error: reg.error }, { status: reg.status });
  const r = reg.receipt;
  // The same shape as ReceiptView: it was just attached by this account, so
  // addedByMe is true whenever it got a member id (the owner without a row
  // registers it as nobody's, and removes it through canEdit anyway).
  return NextResponse.json({
    ok: true,
    receipt: { id: r.id, contentType: r.contentType, bytes: r.bytes, hasThumb: r.thumbKey !== null, createdAt: r.createdAt.toISOString(), addedByMe: gate.viewer.member !== null },
  });
}
