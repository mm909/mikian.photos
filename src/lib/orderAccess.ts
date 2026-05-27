import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { verifyDownloadToken } from "@/lib/downloadToken";
import { parseOrderNumber } from "@/lib/orderId";

/**
 * Decide whether the current viewer should be allowed to see an Order.
 *
 * Three valid paths:
 *   1. Signed-in user whose email (case-insensitive) matches Order.email —
 *      this is the path linked accounts take from /runner.
 *   2. Owner — sees every order for support purposes.
 *   3. Anyone with a valid download token whose claimed orderId matches —
 *      this is how the magic link from the receipt email works for guest
 *      buyers who never created an account.
 *
 * `order.userId` isn't required for path #1 because guest checkouts leave it
 * null even if the buyer is signed-in to a different account later; matching
 * on `email` is the durable check.
 */
export type OrderAccess =
  | { ok: true; order: NonNullable<Awaited<ReturnType<typeof loadOrderRaw>>>; via: "session" | "owner" | "token" }
  | { ok: false; reason: "not-found" | "forbidden" };

async function loadOrderRaw(orderNumber: number) {
  return db.order.findUnique({ where: { orderNumber } });
}

export async function getOrderForViewer(
  orderNumberInput: string,
  token: string | null
): Promise<OrderAccess> {
  const n = parseOrderNumber(orderNumberInput);
  if (n === null) return { ok: false, reason: "not-found" };

  const order = await loadOrderRaw(n);
  if (!order) return { ok: false, reason: "not-found" };

  // Path 3: token. Verify signature + match orderId. Done first because it
  // works without any session lookup, which is the cheap path.
  if (token) {
    const claims = await verifyDownloadToken(token);
    if (claims && claims.orderId === order.id) {
      return { ok: true, order, via: "token" };
    }
  }

  // Path 1 + 2: session.
  const actor = await getEffectiveActor();
  if (actor) {
    if (actor.roles.includes("owner")) {
      return { ok: true, order, via: "owner" };
    }
    if (actor.email.toLowerCase() === order.email.toLowerCase()) {
      return { ok: true, order, via: "session" };
    }
  }

  return { ok: false, reason: "forbidden" };
}
