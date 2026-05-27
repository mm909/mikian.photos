import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2PresignGet } from "@/lib/r2";
import { verifyDownloadToken } from "@/lib/downloadToken";

// Gated download: requires a valid JWT (minted at order capture). On success
// we 302 to a presigned R2 URL for the original.
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 401 });

  const claims = await verifyDownloadToken(token);
  if (!claims) return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });

  // Token must cover this photo
  if (!claims.photoIds.includes(params.id)) {
    return NextResponse.json({ error: "token does not cover this photo" }, { status: 403 });
  }

  // Sanity: order must still exist (could have been refunded / revoked)
  const order = await db.order.findUnique({ where: { id: claims.orderId }, select: { id: true } });
  if (!order) return NextResponse.json({ error: "order revoked" }, { status: 403 });

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { r2OriginalKey: true, hidden: true },
  });
  if (!photo || photo.hidden) return new NextResponse("Not found", { status: 404 });

  const signed = await r2PresignGet(photo.r2OriginalKey, 900); // 15 min
  return NextResponse.redirect(signed, 302);
}
