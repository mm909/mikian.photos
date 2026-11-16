import { NextResponse } from "next/server";
import { getExpense, takesReceipts } from "@/lib/lasd26/expenses";
import { mintReceiptUpload } from "@/lib/lasd26/receipts";
import { bad, badJson, readJson, requireTspWrite } from "@/lib/tsp/guard";
import { notFound, notOnEstimate } from "../../../shared";

/** POST /api/tsp/[team]/expenses/[id]/receipts/sign — mint a presigned PUT for one receipt (the lasd26 route, per team). */
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { team: string; id: string } }) {
  const gate = await requireTspWrite(params.team, "receipt");
  if (gate.res) return gate.res;
  const expense = await getExpense(params.id, params.team);
  if (!expense) return notFound();
  if (!takesReceipts(expense)) return notOnEstimate();
  const body = await readJson(req);
  if (!body) return badJson();
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const contentLength = typeof body.contentLength === "number" ? Math.round(body.contentLength) : NaN;

  const minted = await mintReceiptUpload(expense.id, contentType, contentLength);
  if (!minted.ok) return bad(minted.error, minted.status);
  return NextResponse.json({ ok: true, ...minted.mint });
}
