import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { db } from "./db";

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
 * The NextAuth try/catch is deliberate: if the deploy is missing OAuth env
 * vars (NEXTAUTH_SECRET, GOOGLE_*), getServerSession can throw. We still want
 * the unlock path to work in that case.
 */
export async function getEffectivePhotographerId(): Promise<string | null> {
  // Path 1: real Google sign-in
  try {
    const session = await getServerSession(authOptions);
    if (session?.photographerId) return session.photographerId;
  } catch {
    /* NextAuth misconfigured — fall through */
  }

  // Path 2: unlock cookie. Idempotently upsert the admin row so we have
  // something to attribute uploads to.
  if (isPhotographerUnlocked()) {
    const admin = await db.photographer.upsert({
      where: { email: ADMIN_PHOTOGRAPHER_EMAIL },
      update: { isAdmin: true },
      create: {
        email: ADMIN_PHOTOGRAPHER_EMAIL,
        name: ADMIN_PHOTOGRAPHER_NAME,
        isAdmin: true,
      },
      select: { id: true },
    });
    return admin.id;
  }

  return null;
}
