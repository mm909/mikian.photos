import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2PresignGet, r2Keys } from "@/lib/r2";
import { verifyDownloadToken } from "@/lib/downloadToken";
import { formatOrderNumber } from "@/lib/orderId";

/**
 * Gated download: requires a valid JWT (minted at order capture).
 *
 * Entitlement check chain:
 *   1. JWT signature must verify (catches tampering / forged tokens).
 *   2. Order row referenced by claims must still exist (handles refund /
 *      revocation later — delete the order, all tokens for it die).
 *   3. Order.photoIds must include the requested photo id. The token used
 *      to carry photoIds directly, but that blew past Postgres btree size
 *      limits for the @unique index — so we keep entitlement on the row.
 *   4. The photo itself must exist and not be hidden (photographer
 *      moderation can pull a photo even after sale; buyer sees a 404).
 *
 * On success we 302 to a 15-minute presigned R2 URL for the hi-res original.
 */
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }
  const reqUrl = new URL(req.url);
  const token = reqUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 401 });

  const claims = await verifyDownloadToken(token);
  if (!claims) return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });

  // Load the order — both confirms the token still references a real order
  // and gives us the entitlement list to check.
  const order = await db.order.findUnique({
    where: { id: claims.orderId },
    select: { id: true, photoIds: true, orderNumber: true },
  });
  if (!order) return NextResponse.json({ error: "order revoked" }, { status: 403 });

  if (!order.photoIds.includes(params.id)) {
    return NextResponse.json({ error: "token does not cover this photo" }, { status: 403 });
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { id: true, r2OriginalKey: true, hidden: true },
  });
  if (!photo || photo.hidden) return new NextResponse("Not found", { status: 404 });

  // Older rows can carry r2OriginalKey="pending" while the upload pipeline is
  // still finalizing. Fall back to the deterministic key derived from the
  // photo id so the presign still hits the right object.
  const key =
    photo.r2OriginalKey && photo.r2OriginalKey !== "pending"
      ? photo.r2OriginalKey
      : r2Keys.original(photo.id);

  const signed = await r2PresignGet(key, 900); // 15 min

  // R2 honors response-content-disposition as a query-string override on
  // presigned URLs. We append one so the file lands as
  // "MK-000123-<photoId>.jpg" instead of the raw R2 key (which would be
  // something like "originals/clxyz.jpg" → a useless filename for the buyer).
  const signedUrl = new URL(signed);
  const orderTag = formatOrderNumber(order.orderNumber);
  const filename = `${orderTag}-${photo.id}.jpg`;
  signedUrl.searchParams.set(
    "response-content-disposition",
    `attachment; filename="${filename}"`
  );

  return NextResponse.redirect(signedUrl.toString(), 302);
}
