/**
 * Pre-launch site gate.
 *
 * While the gate is ON, the entire public site is private: every page and API
 * route requires a signed-in NextAuth session whose email matches the single
 * allowed Google account. This lets Mikian keep iterating on the live site at
 * mikianmusser.com without anyone stumbling in.
 *
 * The gate is enforced in two places that both import from here:
 *   - `src/middleware.ts` — blocks every request that isn't from the allowed
 *     account (runs at the edge, before any page renders).
 *   - `src/lib/auth.ts` `signIn` callback — refuses to mint a session for any
 *     other Google account in the first place.
 *
 * Escape hatches so you can't lock yourself out:
 *   - Sign in with the allowed account (the normal path).
 *   - The owner unlock cookie that `/api/unlock?key=…` drops (`mikian_unlock`)
 *     bypasses the gate too — the same key that opens the payment lock.
 *
 * Flip it back to a fully public site by setting `SITE_PUBLIC=true` on the host.
 *
 * IMPORTANT: keep this file edge-safe — it is imported by middleware, so it
 * must read `process.env` only. No `next/headers`, no Prisma, no Node APIs.
 */

// Mirror of OWNER_DEFAULT in permissions.ts. Duplicated (not imported) because
// permissions.ts pulls in Prisma, which can't run in the edge middleware.
const OWNER_DEFAULT = "mikian.photos@gmail.com";

/**
 * The single Google account allowed past the gate, lowercased + trimmed.
 * Defaults to the owner account; override with SITE_GATE_EMAIL if the gate
 * account should differ from OWNER_EMAIL.
 */
export function allowedGateEmail(): string {
  return (
    process.env.SITE_GATE_EMAIL ||
    process.env.OWNER_EMAIL ||
    OWNER_DEFAULT
  )
    .toLowerCase()
    .trim();
}

/**
 * Is the whole-site sign-in gate active?
 *
 * Default is ON (fail-closed): the live site stays private unless someone
 * explicitly sets SITE_PUBLIC=true. That way a missing/blank env var keeps
 * the site locked rather than accidentally exposing it.
 */
export function isSiteGateOn(): boolean {
  return process.env.SITE_PUBLIC !== "true";
}

/** Does this email belong to the one account allowed in? */
export function isAllowedGateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === allowedGateEmail();
}

/**
 * Owner bypass cookie. Same value `/api/unlock` drops (see
 * `paymentLock.ts` UNLOCK_COOKIE) — a request carrying it skips the gate, so
 * the unlock key remains a single master key for the whole locked site.
 * Hardcoded here (not imported) to keep this module edge-safe.
 */
export const SITE_BYPASS_COOKIE = "mikian_unlock";
