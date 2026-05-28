import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import archiver from "archiver";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { formatOrderNumber } from "@/lib/orderId";
import { getOrderForViewer } from "@/lib/orderAccess";

/**
 * Bulk ZIP download for an entire order.
 *
 *   GET /api/orders/[orderNumber]/zip?key=<jwt>
 *
 * Streams every entitled photo from R2 through `archiver` into the
 * response body. The buyer's browser sees one continuous Content-
 * Disposition'd zip download — no temp files on the server.
 *
 * Access mirrors the order page (`getOrderForViewer`):
 *   - signed-in user whose email matches Order.email
 *   - owner (cross-customer support)
 *   - anyone holding the magic-link `?key=` token
 *
 * Vercel ceiling: maxDuration tops out at 60s on the Pro plan. A few
 * hundred photos at ~3–5MB each fits comfortably; very large orders
 * would need a background job pattern (S3 → R2 transfer + a "your zip
 * is ready" email), but we're nowhere near that scale yet.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/** Hard cap on photos per ZIP — keeps the response within Vercel's
 *  function-duration budget and prevents an accidental massive bundle
 *  from running away. */
const MAX_PHOTOS_PER_ZIP = 500;

export async function GET(
  req: Request,
  { params }: { params: { orderNumber: string } }
) {
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("key");
  const access = await getOrderForViewer(params.orderNumber, token);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason === "forbidden" ? "Sign in required" : "Not found" },
      { status: access.reason === "forbidden" ? 401 : 404 }
    );
  }

  const order = access.order;
  if (order.photoIds.length === 0) {
    return NextResponse.json({ error: "Order has no photos" }, { status: 404 });
  }
  if (order.photoIds.length > MAX_PHOTOS_PER_ZIP) {
    return NextResponse.json(
      {
        error: `Order too large for one ZIP (${order.photoIds.length} photos, cap ${MAX_PHOTOS_PER_ZIP}). Use the per-photo downloads or contact support for a split delivery.`,
      },
      { status: 413 }
    );
  }

  // Pre-resolve photo rows so we can skip hidden ones + warn on missing.
  // One round-trip keeps the streaming loop tight.
  const photos = await db.photo.findMany({
    where: { id: { in: order.photoIds }, hidden: false },
    select: { id: true, r2OriginalKey: true },
  });

  if (photos.length === 0) {
    return NextResponse.json(
      { error: "No accessible photos in this order" },
      { status: 404 }
    );
  }

  const orderTag = formatOrderNumber(order.orderNumber);

  // archiver pipes into a Node Readable; we hand that off to NextResponse
  // as a web ReadableStream. Errors during streaming abort the response
  // but Next won't retry — the client must hit the endpoint again.
  const archive = archiver("zip", {
    // store mode — JPEGs are already compressed; deflate adds CPU for ~0%
    // gain. Saves serverless CPU seconds.
    store: true,
  });

  // Wire errors so a broken R2 read doesn't silently truncate the zip.
  archive.on("error", (err) => {
    console.error(`zip stream error for order ${orderTag}:`, err);
  });
  archive.on("warning", (err) => {
    // ENOENT and similar warnings are non-fatal but worth knowing about.
    console.warn(`zip stream warning for order ${orderTag}:`, err);
  });

  // Kick off the per-photo R2 reads in parallel-ish. We don't await each
  // append; archiver buffers them in order. To bound memory we still walk
  // them serially — pulling each R2 object's bytes only when we're ready
  // to append.
  void (async () => {
    try {
      for (const p of photos) {
        const key =
          p.r2OriginalKey && p.r2OriginalKey !== "pending"
            ? p.r2OriginalKey
            : r2Keys.original(p.id);
        try {
          const { body } = await r2GetStream(key);
          archive.append(body, { name: `${orderTag}-${p.id}.jpg` });
        } catch (e) {
          // Skip a single failed photo rather than aborting the whole zip —
          // the buyer at least gets the rest. Log so we can chase it up.
          console.warn(`zip skip ${p.id}: ${e instanceof Error ? e.message : e}`);
        }
      }
      await archive.finalize();
    } catch (e) {
      console.error("zip pipeline failed:", e);
      archive.abort();
    }
  })();

  // Cast Node Readable → web ReadableStream so Next's NextResponse accepts it.
  const stream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${orderTag}-photos.zip"`,
      // Don't cache zips — the entitlement may change (refund, revocation).
      "Cache-Control": "no-store",
    },
  });
}

