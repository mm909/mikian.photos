import { NextResponse } from "next/server";
import { getExpense, takesReceipts } from "@/lib/lasd26/expenses";
import { registerReceipt } from "@/lib/lasd26/receipts";
import { bad, badJson, readJson, requireTspWrite } from "@/lib/tsp/guard";
import { notFound, notOnEstimate } from "../../shared";

/** POST /api/tsp/[team]/expenses/[id]/receipts — register an upload that landed (the lasd26 route, per team). */
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { team: string; id: string } }) {
  const gate = await requireTspWrite(params.team, "receipt");
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id, params.team);
  if (!expense) return notFound();
  if (!takesReceipts(expense)) return notOnEstimate();
  const body = await readJson(req);
  if (!body) return badJson();
  const key = typeof body.key === "string" ? body.key : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";

  const reg = await registerReceipt({ expenseId: expense.id, key, contentType, addedById: gate.viewer.member?.id ?? null });
  if (!reg.ok) return bad(reg.error, reg.status);
  const r = reg.receipt;
  return NextResponse.json({
    ok: true,
    receipt: { id: r.id, contentType: r.contentType, bytes: r.bytes, hasThumb: r.thumbKey !== null, createdAt: r.createdAt.toISOString(), addedByMe: gate.viewer.member !== null },
  });
}
