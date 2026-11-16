import { NextResponse } from "next/server";
import { getReceipt, receiptUrl } from "@/lib/lasd26/receipts";
import { bad, requireTsp } from "@/lib/tsp/guard";

/**
 * GET /api/tsp/[team]/expenses/receipt/[receiptId] — open a receipt: on the
 * team, and the receipt's expense is THIS team's, then a 302 to a 15-minute
 * presigned GET (?thumb=1 for the small jpeg).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { team: string; receiptId: string } }) {
  const gate = await requireTsp(params.team);
  if (gate.res) return gate.res;
  const receipt = await getReceipt(params.receiptId);
  if (!receipt || receipt.expense.team !== params.team) return bad("No such receipt.", 404);
  const thumb = new URL(req.url).searchParams.get("thumb") === "1";
  let url: string;
  try {
    url = await receiptUrl(receipt, thumb);
  } catch (err) {
    console.error("tsp/receipts: presign failed", err instanceof Error ? err.message : err);
    return bad("Receipt storage isn't configured on this server.", 503);
  }
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
