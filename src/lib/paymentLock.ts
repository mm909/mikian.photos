import { cookies } from "next/headers";

export const UNLOCK_COOKIE = "mikian_unlock";

/**
 * Server-only: is the buy flow open right now?
 *
 * Rules:
 *  - If PAYMENTS_OPEN === "true", payments are open for everyone.
 *  - Otherwise, payments are locked, unless the request carries a valid
 *    `mikian_unlock` cookie (set by /api/unlock with the right key).
 */
export function isPaymentsOpen(): boolean {
  if (process.env.PAYMENTS_OPEN === "true") return true;
  try {
    const c = cookies().get(UNLOCK_COOKIE);
    return c?.value === "1";
  } catch {
    return false;
  }
}

export function unlockKey(): string | null {
  return process.env.MIKIAN_UNLOCK_KEY?.trim() || null;
}
