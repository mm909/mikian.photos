/**
 * Shared "turn a completed payment into an Order" logic. Server-only.
 *
 * Extracted from the PayPal capture-order route so the owner-only fake-order
 * route can create a real, downloadable Order + send the receipt email without
 * going through PayPal — one source of truth for entitlement snapshotting,
 * token minting, and the receipt.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { mintDownloadToken } from "./downloadToken";
import { sendReceiptEmail } from "./email";
import type { ReceiptInput } from "./receiptHtml";
import { formatOrderNumber } from "./orderId";
import { prices } from "./data";

type OrderRowLite = {
  id: string;
  orderNumber: number;
  amount: number;
  downloadToken: string | null;
};

/** The redirect/return payload the checkout client expects after a purchase. */
export function buildOrderPayload(o: OrderRowLite) {
  const orderNumberStr = formatOrderNumber(o.orderNumber);
  return {
    orderId: o.id,
    orderNumber: o.orderNumber,
    orderNumberDisplay: orderNumberStr,
    amountUsd: o.amount,
    orderUrl: `/orders/${orderNumberStr}${o.downloadToken ? `?key=${encodeURIComponent(o.downloadToken)}` : ""}`,
  };
}

/** Absolute base URL for emailed links — explicit env wins, else the request host. */
export function resolveBaseUrl(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://mikianmusser.com";
  }
}

export type CreatePaidOrderInput = {
  /** Buyer email (already lowercased/trimmed). */
  email: string;
  /** Linked user id when the buyer was signed in, else null. */
  userId: string | null;
  kind: "bundle" | "multi";
  eventId: string;
  /** For kind=multi: the photo ids the buyer is claiming (validated here). */
  clientPhotoIds?: string[];
  amountUsd: number;
  /** Real PayPal capture id, or a synthetic id for a simulated order. */
  paypalCaptureId: string;
  /** Absolute base URL for the emailed links. */
  baseUrl: string;
};

export type CreatePaidOrderResult =
  | { ok: true; order: OrderRowLite & { paidAt: Date } }
  | { ok: false; status: number; error: string; missing?: string[] };

/**
 * Resolve the event, snapshot the covered photoIds, create the Order, mint +
 * persist its download token, and fire the receipt email (best-effort).
 */
export async function createPaidOrder(
  input: CreatePaidOrderInput
): Promise<CreatePaidOrderResult> {
  const { email, userId, kind, eventId, clientPhotoIds, amountUsd, paypalCaptureId, baseUrl } =
    input;

  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!ev) return { ok: false, status: 400, error: "Unknown eventId" };
  const eventName = ev.name;

  let photoIds: string[];
  if (kind === "bundle") {
    // A bundle covers the buyer's matched set — the photos they were looking
    // at (their bib + confirmed-face photos) — NOT the whole event. The client
    // sends those ids; snapshot the valid, non-hidden intersection. Fall back
    // to the whole event only when no ids came through (e.g. a browse with no
    // search) so a buyer is never left with an empty order.
    if (clientPhotoIds && clientPhotoIds.length > 0) {
      const requested = Array.from(new Set(clientPhotoIds));
      const found = await db.photo.findMany({
        where: { id: { in: requested }, eventId: ev.id, hidden: false },
        select: { id: true },
      });
      photoIds = found.map((p) => p.id);
    } else {
      photoIds = [];
    }
    if (photoIds.length === 0) {
      const all = await db.photo.findMany({
        where: { eventId: ev.id, hidden: false },
        select: { id: true },
      });
      photoIds = all.map((p) => p.id);
    }
  } else {
    // Validate every client-supplied id belongs to the event AND isn't hidden.
    // Reject the whole order if even one is invalid — no partial entitlements.
    const requested = Array.from(new Set(clientPhotoIds ?? []));
    if (requested.length === 0) {
      return { ok: false, status: 400, error: "kind=multi requires non-empty photoIds" };
    }
    const found = await db.photo.findMany({
      where: { id: { in: requested }, eventId: ev.id, hidden: false },
      select: { id: true },
    });
    if (found.length !== requested.length) {
      const validIds = new Set(found.map((p) => p.id));
      const missing = requested.filter((id) => !validIds.has(id));
      return {
        ok: false,
        status: 400,
        error: "Some photos are not available for this event",
        missing,
      };
    }
    photoIds = found.map((p) => p.id);
  }

  let order: { id: string; orderNumber: number; amount: number; downloadToken: string | null; paidAt: Date };
  try {
    order = await db.order.create({
      data: {
        email,
        userId,
        kind,
        amount: amountUsd,
        eventIdCovered: eventId,
        photoIds,
        paypalCaptureId,
      },
      select: { id: true, orderNumber: true, amount: true, downloadToken: true, paidAt: true },
    });
  } catch (e) {
    // Idempotency: a repeat carrying the SAME paypalCaptureId (a PayPal
    // re-capture, or a free-claim retry that reuses its deterministic id)
    // collides on the unique index. Return the already-created order rather than
    // inserting a duplicate (+ a second token + a second receipt email).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await db.order.findUnique({
        where: { paypalCaptureId },
        select: { id: true, orderNumber: true, amount: true, downloadToken: true, paidAt: true },
      });
      if (existing) return { ok: true, order: existing };
    }
    throw e;
  }

  const token = await mintDownloadToken({ orderId: order.id });
  const orderWithToken = await db.order.update({
    where: { id: order.id },
    data: { downloadToken: token },
  });

  // Receipt email — awaited so it actually completes (a non-awaited promise
  // can be frozen by the serverless runtime before it sends), but it never
  // throws into the caller: payment must not roll back because email is
  // flaky. We record the outcome on the row so the Orders admin can see
  // whether the buyer got their receipt — and why not when it failed.
  const receipt = buildReceiptInput({
    orderNumber: orderWithToken.orderNumber,
    paidAt: orderWithToken.paidAt,
    email,
    amountUsd,
    eventName,
    kind,
    photoCount: photoIds.length,
    token,
    baseUrl,
  });
  try {
    const sent = await sendReceiptEmail(email, receipt);
    await db.order
      .update({
        where: { id: order.id },
        data: sent.ok
          ? { emailSentAt: new Date(), emailError: null }
          : { emailError: sent.error.slice(0, 500) },
      })
      .catch(() => {});
  } catch {
    /* never block the caller on receipt delivery */
  }

  return { ok: true, order: orderWithToken };
}

/**
 * Build the ReceiptInput for an order. Shared by createPaidOrder (the initial
 * send) and the owner "resend receipt" action so both render identically. The
 * order-page + ZIP links carry the magic ?key=token so the buyer needs no
 * account to open them.
 */
export function buildReceiptInput(args: {
  orderNumber: number;
  paidAt: Date;
  email: string;
  amountUsd: number;
  eventName: string;
  kind: string;
  photoCount: number;
  token: string;
  baseUrl: string;
}): ReceiptInput {
  const orderTag = formatOrderNumber(args.orderNumber);
  const base = args.baseUrl.replace(/\/$/, "");
  const orderUrl = `${base}/orders/${orderTag}?key=${encodeURIComponent(args.token)}`;
  const zipUrl = `${base}/api/orders/${orderTag}/zip?key=${encodeURIComponent(args.token)}`;
  const subtotal =
    args.amountUsd - +(args.amountUsd * prices.stripeRate + prices.stripeFlat).toFixed(2);
  const itemLabel =
    args.kind === "bundle"
      ? `All photos bundle · ${args.eventName}`
      : `${args.photoCount} photo${args.photoCount === 1 ? "" : "s"} · ${args.eventName}`;
  return {
    orderNumber: args.orderNumber,
    paidAt: args.paidAt,
    email: args.email,
    amountUsd: args.amountUsd,
    eventName: args.eventName,
    photoCount: args.photoCount,
    lineItems: [
      { label: itemLabel, amountUsd: Math.max(subtotal, 0) },
      { label: "Processing fee", amountUsd: Math.max(args.amountUsd - Math.max(subtotal, 0), 0) },
    ],
    orderUrl,
    zipUrl,
  };
}
