import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { getEffectiveActor } from "@/lib/permissions";
import { orderTotalUsd } from "@/lib/pricing";
import {
  resolveEventAccess,
  secretLinkCookieName,
  galleryPasswordCookieName,
} from "@/lib/eventAccess";
import {
  createPaidOrder,
  buildOrderPayload,
  resolveBaseUrl,
} from "@/lib/createOrder";

/**
 * POST /api/orders/free-claim — mint an order for a FREE event without PayPal.
 *
 * Body: { eventId, kind?, photoIds?, email?, k? }
 *
 * Security-critical, twice over:
 *   1. The event must actually cost $0. We re-compute the total through the
 *      same pricing path the paid flow uses and reject anything > 0, so a paid
 *      event can never be claimed for free.
 *   2. The claimer must pass the event's ACCESS MODE (same gate as /api/photos
 *      — body `k` / remembered mk_evk_ / mk_gpw_ cookies). A free event is
 *      often also a LOCKED one (secure-link camp gallery); without this gate,
 *      anyone holding the slug + a leaked photo id could mint themselves a
 *      full-resolution download entitlement for a private gallery.
 *
 * Reuses createPaidOrder (the same entitlement-snapshot + token-mint + receipt
 * path as PayPal) with amount 0 and a synthetic FREE- capture id (mirrors the
 * DEV-FAKE- pattern).
 */
export const runtime = "nodejs";

type Body = {
  eventId?: string;
  kind?: "bundle" | "multi";
  photoIds?: string[];
  email?: string;
  /** Optional secure-link token (parallels ?k= on the event routes). */
  k?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  const kind: "bundle" | "multi" = body.kind === "multi" ? "multi" : "bundle";
  const clientPhotoIds = Array.isArray(body.photoIds)
    ? body.photoIds.filter((x): x is string => typeof x === "string")
    : undefined;

  // Enforce the event's access mode — a locked (secure-link/password/private)
  // free event must not be claimable by someone who never had gallery access.
  // Legit buyers pass automatically: browsing the event set the mk_evk_ /
  // mk_gpw_ cookie, which rides this same-origin POST.
  const accessToken =
    (typeof body.k === "string" && body.k) ||
    cookies().get(secretLinkCookieName(eventId))?.value ||
    null;
  const passwordToken = cookies().get(galleryPasswordCookieName(eventId))?.value || null;
  const access = await resolveEventAccess(eventId, {
    token: accessToken,
    passwordToken,
  });
  if (!access.ok) {
    const unauthorized =
      access.reason === "needs-auth" || access.reason === "needs-password";
    return NextResponse.json(
      { error: unauthorized ? "locked" : "not found" },
      { status: unauthorized ? 401 : 404 }
    );
  }

  // Guard: only mint for events that genuinely cost nothing.
  const total = await orderTotalUsd(kind, clientPhotoIds?.length ?? 0, eventId);
  if (total !== 0) {
    return NextResponse.json(
      { error: "This event is not free." },
      { status: 403 }
    );
  }

  // Buyer email: prefer the signed-in actor, else an email supplied in the body
  // (public free events). createPaidOrder needs an email to send the receipt.
  const actor = await getEffectiveActor();
  const email = (actor?.email || (typeof body.email === "string" ? body.email : ""))
    .toLowerCase()
    .trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "An email is required to claim your photos." },
      { status: 400 }
    );
  }

  // Deterministic capture id so a duplicate claim (e.g. a mid-flight remount or
  // refresh re-firing the checkout auto-claim) collides on the paypalCaptureId
  // unique index and createPaidOrder returns the SAME order instead of minting a
  // second one + a second receipt email. Keyed on the buyer + the exact photo
  // set so two genuinely different selections by the same buyer at the same free
  // event don't wrongly collapse into one order.
  const sortedIds = (clientPhotoIds ?? []).slice().sort().join(",");
  const dedupeHash = createHash("sha256")
    .update(`${email}|${kind}|${sortedIds}`)
    .digest("hex")
    .slice(0, 16);
  const result = await createPaidOrder({
    email,
    userId: actor?.photographerId ?? null,
    kind,
    eventId,
    clientPhotoIds,
    amountUsd: 0,
    paypalCaptureId: `FREE-${eventId}-${kind}-${dedupeHash}`,
    baseUrl: resolveBaseUrl(req),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, missing: result.missing },
      { status: result.status }
    );
  }
  return NextResponse.json(buildOrderPayload(result.order));
}
