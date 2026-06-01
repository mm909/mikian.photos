import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { formatOrderNumber } from "@/lib/orderId";
import { getOrderForViewer } from "@/lib/orderAccess";

/**
 * Bulk ZIP download for an order (whole order, or a buyer-picked subset).
 *
 *   GET /api/orders/[orderNumber]/zip?key=<jwt>            → the whole order
 *   GET /api/orders/[orderNumber]/zip?key=<jwt>&ids=a,b,c  → just those photos
 *
 * Streams every entitled photo from R2 through `archiver` into the
 * response body. The buyer's browser sees one continuous Content-
 * Disposition'd zip download — no temp files on the server.
 *
 * The optional `ids` querystring (comma-separated photo ids) lets the order
 * page zip only the buyer's tap-selection. It is always intersected with the
 * order's own photoIds (see below), so it can never be used to reach a photo
 * the holder isn't entitled to — it can only ever *narrow* the set.
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

/**
 * Normalize whatever R2 hands back into a Node Readable archiver can append.
 * In the Node runtime the AWS SDK returns a Node stream (IncomingMessage), but
 * defend against a web ReadableStream / Buffer so a runtime quirk can't blow up
 * the whole download.
 */
function asNodeReadable(body: unknown): Readable {
  if (body instanceof Readable) return body;
  if (body && typeof (body as { getReader?: unknown }).getReader === "function") {
    // Web ReadableStream → Node Readable.
    return Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  }
  return Readable.from(body as Buffer);
}

export async function GET(
  req: Request,
  { params }: { params: { orderNumber: string } }
) {
  try {
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

    // Optional subset: `?ids=a,b,c` lets the order page zip just the buyer's
    // tap-selection. SECURITY — we intersect the requested ids with this
    // order's own photoIds, so any id not entitled to this order is silently
    // dropped; `ids` can only ever *narrow* the set, never widen it. If `ids`
    // is absent (or empty after filtering), we fall back to the full order.
    const orderIdSet = new Set(order.photoIds);
    const requestedIds = (url.searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const entitledRequested = requestedIds.filter((id) => orderIdSet.has(id));
    const effectiveIds = entitledRequested.length > 0 ? entitledRequested : order.photoIds;
    // True only when the buyer actually narrowed to a valid subset — drives the
    // count-tagged filename below.
    const isSubset = entitledRequested.length > 0 && entitledRequested.length < order.photoIds.length;

    if (effectiveIds.length > MAX_PHOTOS_PER_ZIP) {
      return NextResponse.json(
        {
          error: `Order too large for one ZIP (${effectiveIds.length} photos, cap ${MAX_PHOTOS_PER_ZIP}). Use the per-photo downloads or contact support for a split delivery.`,
        },
        { status: 413 }
      );
    }

    // Pre-resolve photo rows so we can skip hidden ones + warn on missing.
    // One round-trip keeps the streaming loop tight.
    const photos = await db.photo.findMany({
      where: { id: { in: effectiveIds }, hidden: false },
      select: { id: true, r2OriginalKey: true },
    });

    if (photos.length === 0) {
      return NextResponse.json(
        { error: "No accessible photos in this order" },
        { status: 404 }
      );
    }

    const orderTag = formatOrderNumber(order.orderNumber);
    // Subset zips get a count in the filename (e.g. "RACE-0042-5-photos.zip")
    // so a buyer who downloads "all" and later "5 selected" can tell the two
    // files apart in their Downloads folder.
    const zipFilename = isSubset
      ? `${orderTag}-${photos.length}-photos.zip`
      : `${orderTag}-photos.zip`;

    // archiver writes into a PassThrough; we hand that to NextResponse as a web
    // ReadableStream. Piping through the PassThrough (rather than reading the
    // Archiver directly) gives us one place to forward errors so a broken R2
    // read tears down the response instead of hanging the download.
    const archive = archiver("zip", {
      // store mode — JPEGs are already compressed; deflate adds CPU for ~0%
      // gain. Saves serverless CPU seconds.
      store: true,
    });
    const passthrough = new PassThrough();

    archive.on("error", (err) => {
      console.error(`zip stream error for order ${orderTag}:`, err);
      passthrough.destroy(err);
    });
    archive.on("warning", (err) => {
      // ENOENT and similar warnings are non-fatal but worth knowing about.
      console.warn(`zip stream warning for order ${orderTag}:`, err);
    });
    archive.pipe(passthrough);

    // Append each entitled photo. We walk serially and let archiver pull each
    // R2 stream lazily, so memory stays bounded even for a big bundle. A single
    // failed photo is skipped (logged) rather than aborting the whole zip.
    void (async () => {
      try {
        for (const p of photos) {
          const key =
            p.r2OriginalKey && p.r2OriginalKey !== "pending"
              ? p.r2OriginalKey
              : r2Keys.original(p.id);
          try {
            const { body } = await r2GetStream(key);
            archive.append(asNodeReadable(body), { name: `${orderTag}-${p.id}.jpg` });
          } catch (e) {
            console.warn(`zip skip ${p.id}: ${e instanceof Error ? e.message : e}`);
          }
        }
        await archive.finalize();
      } catch (e) {
        console.error(`zip pipeline failed for order ${orderTag}:`, e);
        // Tear down both ends so the client sees a failed download rather than
        // a silently truncated (but "successful") zip.
        archive.abort();
        passthrough.destroy(e instanceof Error ? e : new Error(String(e)));
      }
    })();

    // Cast Node Readable → web ReadableStream so Next's NextResponse accepts it.
    const stream = Readable.toWeb(passthrough) as unknown as ReadableStream<Uint8Array>;
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        // Don't cache zips — the entitlement may change (refund, revocation).
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // Anything thrown before the stream starts (DB hiccup, access lookup, etc.)
    // returns a real JSON error instead of an opaque 500 white-screen, so a
    // recurring failure is diagnosable from the client/network tab.
    console.error(`zip route fatal for order ${params.orderNumber}:`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not build ZIP" },
      { status: 500 }
    );
  }
}
