import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Two ways to get photographer-level access:
 *
 *   1. NextAuth Google sign-in — production-grade. Sets session.photographerId.
 *   2. Unlock-key bypass — Mikian-only. Visit `/api/photographer/unlock?key=…`,
 *      which sets a cookie, upserts a designated admin Photographer row, and
 *      ensures the Lighthouse event row exists. Lets Mikian use the upload
 *      flow without going through the OAuth round-trip (useful when Google
 *      OAuth credentials aren't set up yet on a fresh deploy).
 *
 * Both paths converge on a Photographer id — server routes call
 * `getEffectivePhotographerId()` instead of reaching into the session directly.
 */
export const PHOTOGRAPHER_UNLOCK_COOKIE = "mikian_photog_unlock";
export const ADMIN_PHOTOGRAPHER_EMAIL = "mikian@mikian.photos";
export const ADMIN_PHOTOGRAPHER_NAME = "Mikian";

export function isPhotographerUnlocked(): boolean {
  try {
    return cookies().get(PHOTOGRAPHER_UNLOCK_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}

/**
 * Resolve the current photographer id, trying NextAuth first then the unlock
 * cookie. Returns null when neither path applies — caller decides whether to
 * 401, redirect, or render a "request access" message.
 *
 * **Role-gated**: only returns an id when the actor has the "photographer"
 * (or "owner") role. A signed-in runner gets null here, so every API route
 * that calls this is automatically denied to runners. Routes that don't
 * need the photographer role should use `getEffectiveActor()` directly from
 * `permissions.ts` and check roles themselves.
 *
 * Google sign-in only — the legacy unlock-cookie bypass was removed (it let an
 * apparently-signed-out visitor act as owner). Sign in with Google instead.
 */
export async function getEffectivePhotographerId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.photographerId) {
      const roles = session.roles ?? [];
      if (roles.includes("photographer") || roles.includes("owner")) {
        return session.photographerId;
      }
      return null;
    }
  } catch {
    /* NextAuth misconfigured / no session — treat as signed out. */
  }

  return null;
}
