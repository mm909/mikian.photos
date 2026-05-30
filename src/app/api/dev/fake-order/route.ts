/**
 * POST /api/dev/fake-order — owner-only.
 *
 * Creates a REAL Order (downloadable + receipt-emailed) without going through
 * PayPal, so the owner can walk the whole post-purchase flow — order page,
 * downloads, receipt email — without paying. Mirrors capture-order's order
 * creation via the shared createPaidOrder() helper, with a synthetic capture
 * id and the buyer set to the signed-in owner.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { orderTotalUsd } from "@/lib/pricing";
import { buildOrderPayload, createPaidOrder, resolveBaseUrl } from "@/lib/createOrder";

export const runtime = "nodejs";

type Body = {
  eventId?: string;
  kind?: "bundle" | "multi";
  photoIds?: string[];
};

export async function POST(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const kind = body.kind === "multi" ? "multi" : "bundle";
  const photoIds = Array.isArray(body.photoIds) ? body.photoIds : undefined;
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const count = kind === "multi" ? photoIds?.length ?? 0 : 0;
  const amountUsd = await orderTotalUsd(kind, count, eventId);
  const captureId = `DEV-FAKE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await createPaidOrder({
    email: actor.email.toLowerCase(),
    userId: actor.photographerId,
    kind,
    eventId,
    clientPhotoIds: photoIds,
    amountUsd,
    paypalCaptureId: captureId,
    baseUrl: resolveBaseUrl(req),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, missing: result.missing },
      { status: result.status }
    );
  }

  return NextResponse.json({ ...buildOrderPayload(result.order), simulated: true });
}
