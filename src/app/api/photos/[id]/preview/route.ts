import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { resolveEventAccess, secretLinkCookieName } from "@/lib/eventAccess";
import { verifyDownloadToken } from "@/lib/downloadToken";
import { Readable } from "node:stream";

// Serve the (resized, un-watermarked) preview from R2.
//
// ACCESS CONTROL: a preview must be authorized the same way the event is — a
// secure-link / private / account-only event must NOT leak its photos through
// this image route. We allow a request when EITHER:
//   • the event grants access via src/lib/eventAccess (public, or the viewer
//     holds the secure-link cookie / is the owner), OR
//   • a valid order download token (?key=) covers this photo — so the buyer's
//     order/delivery page keeps working even without the secure-link cookie
//     (e.g. a magic-link buyer).
// Public events still serve from the CDN (zero egress); locked events stream
// the bytes through this route so the public R2 URL is never exposed for them.
//
// Two serving modes:
//   • public event + R2_PUBLIC_URL set → 302 to the CDN (zero-egress).
//   • otherwise                        → stream the bytes through this route.
//
// Previews are immutable per photo ID, so the URL never has to bust.
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }
  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { hidden: true, r2PreviewKey: true, eventId: true },
  });
  if (!photo || photo.hidden) return new NextResponse("Not found", { status: 404 });

  // --- Authorize -------------------------------------------------------
  const url = new URL(req.url);
  // Event-access path: ?k= token (first secure-link load) or the remembered cookie.
  const accessToken =
    url.searchParams.get("k") ||
    cookies().get(secretLinkCookieName(photo.eventId))?.value ||
    null;
  const access = await resolveEventAccess(photo.eventId, { token: accessToken });
  let allowed = access.ok;

  // Order-token path: the delivery page loads previews with ?key=<downloadToken>.
  if (!allowed) {
    const key = url.searchParams.get("key");
    if (key) {
      const claims = await verifyDownloadToken(key);
      if (claims) {
        const order = await db.order.findUnique({
          where: { id: claims.orderId },
          select: { photoIds: true, refundedAt: true },
        });
        // A refunded order's entitlement is revoked — don't serve its previews.
        if (order && !order.refundedAt && order.photoIds.includes(params.id)) {
          allowed = true;
        }
      }
    }
  }
  // 404 (not 403) so a locked event never confirms a photo exists to outsiders.
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const previewKey =
    photo.r2PreviewKey && photo.r2PreviewKey !== "pending"
      ? photo.r2PreviewKey
      : r2Keys.preview(params.id);

  // Option-A path — only PUBLIC events may redirect to the public CDN domain.
  // Locked events must stream the bytes so their public R2 URL stays unexposed.
  const publicBase = process.env.R2_PUBLIC_URL;
  if (publicBase && access.ok && access.via === "public") {
    const cdn = `${publicBase.replace(/\/$/, "")}/${previewKey}`;
    return NextResponse.redirect(cdn, 302);
  }

  // Fallback / locked-event path: stream from R2 through this route.
  try {
    const { body, contentType, contentLength } = await r2GetStream(previewKey);
    return new NextResponse(Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        "Content-Type": contentType ?? "image/jpeg",
        ...(contentLength ? { "Content-Length": String(contentLength) } : {}),
        // Photos are immutable per ID — aggressive cache is safe.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
