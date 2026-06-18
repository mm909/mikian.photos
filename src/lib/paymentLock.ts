import { cookies } from "next/headers";

export const UNLOCK_COOKIE = "mikian_unlock";

/**
 * Server-only: is the buy flow open right now?
 *
 * As of v0.8 (public launch) payments are OPEN by default — real PayPal charges
 * are live for everyone. The ONLY way to pause sales is to explicitly set
 * PAYMENTS_LOCKED=true.
 *
 * The pre-launch `PAYMENTS_OPEN` flag is intentionally NO LONGER consulted, so a
 * stale `PAYMENTS_OPEN=false` left on the host can't silently keep sales locked
 * after launch — the open default just wins.
 *
 * When locked, an unlock-cookie holder (the owner, via /api/unlock with the
 * right key) still gets through so test purchases keep working.
 */
export function isPaymentsOpen(): boolean {
  if (process.env.PAYMENTS_LOCKED !== "true") return true;
  // Locked — but the owner's unlock cookie still bypasses.
  try {
    return cookies().get(UNLOCK_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}

export function unlockKey(): string | null {
  return process.env.MIKIAN_UNLOCK_KEY?.trim() || null;
}
