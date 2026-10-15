import { NextResponse } from "next/server";
import { getExpense } from "@/lib/lasd26/expenses";
import { mintReceiptUpload } from "@/lib/lasd26/receipts";
import { badJson, notFound, readJson, requireTeamWrite } from "../../../guard";

/**
 * POST /api/lasd26/expenses/[id]/receipts/sign — mint a presigned PUT for
 * one receipt: { contentType, contentLength } → { ok, uploadUrl, key,
 * headers }. Any team member may attach a receipt to any line. The
 * browser PUTs the file to uploadUrl with those headers, then POSTs
 * /[id]/receipts with the key to register it. Both calls count against
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
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const contentLength = typeof body.contentLength === "number" ? Math.round(body.contentLength) : NaN;

  const minted = await mintReceiptUpload(expense.id, contentType, contentLength);
  if (!minted.ok) return NextResponse.json({ ok: false, error: minted.error }, { status: minted.status });
  return NextResponse.json({ ok: true, ...minted.mint });
}
