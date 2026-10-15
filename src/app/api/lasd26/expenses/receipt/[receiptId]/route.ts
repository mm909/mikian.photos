import { NextResponse } from "next/server";
import { TEAM } from "@/lib/lasd26/team";
import { getReceipt, receiptUrl } from "@/lib/lasd26/receipts";
import { requireTeam } from "../../guard";

/**
 * GET /api/lasd26/expenses/receipt/[receiptId] — open a receipt. Checks
 * team membership, then 302s to a 15-minute presigned GET on R2 (the
 * bucket is private; nothing is ever served from a public URL). ?thumb=1
 * sends the 640 px jpeg when the receipt has one, otherwise the original.
 * The page's <img> tags and "open in a new tab" links both point here.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { receiptId: string } }) {
  const gate = await requireTeam();
  if (gate.res) return gate.res;
  const receipt = await getReceipt(params.receiptId);
  if (!receipt || receipt.expense.team !== TEAM) return NextResponse.json({ ok: false, error: "No such receipt." }, { status: 404 });
  const thumb = new URL(req.url).searchParams.get("thumb") === "1";
  let url: string;
  try {
    url = await receiptUrl(receipt, thumb);
  } catch (err) {
    console.error("lasd26/receipts: presign failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Receipt storage isn't configured on this server." }, { status: 503 });
  }
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
