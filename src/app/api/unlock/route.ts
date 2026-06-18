import { NextResponse } from "next/server";
import { UNLOCK_COOKIE, unlockKey } from "@/lib/paymentLock";
import {
  ADMIN_PHOTOGRAPHER_EMAIL,
  ADMIN_PHOTOGRAPHER_NAME,
  PHOTOGRAPHER_UNLOCK_COOKIE,
} from "@/lib/photographerLock";
import { db } from "@/lib/db";
import { OWNER_IMPLIED_ROLES } from "@/lib/permissions";

/**
 * One-stop unlock.
 *
 *   /api/unlock?key=<MIKIAN_UNLOCK_KEY>[&next=/somewhere]
 *
 * On success this single hit:
 *   1. Drops the `mikian_unlock` cookie — bypasses the payment lock so
 *      `/checkout` shows the real PayPal buttons.
 *   2. Drops the `mikian_photog_unlock` cookie — getEffectivePhotographerId()
 *      honors it for upload + library + admin access without a Google
 *      sign-in round-trip.
 *   3. Bootstraps the rows the photographer flow expects: the Lighthouse
 *      event and the admin Photographer row (with owner roles + isAdmin).
 *      Idempotent — safe to re-run.
 *   4. Redirects to `?next=…` if provided, otherwise to `/`.
 *
 * One key, two cookies, one URL. The legacy `/api/photographer/unlock`
 * route is now a thin alias that hits here with `?next=/photographer/upload`.
 */
export const runtime = "nodejs";

const ALLOWED_NEXT_PATTERN = /^\/[a-zA-Z0-9/_\-?=&%.]*$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const nextRaw = url.searchParams.get("next");
  const expected = unlockKey();

  if (!expected) {
    return NextResponse.json(
      { error: "Unlock not configured: set MIKIAN_UNLOCK_KEY in the server env" },
      { status: 503 }
    );
  }
  if (key !== expected) {
    return NextResponse.json({ error: "Bad key" }, { status: 401 });
  }

  // Bootstrap the rows the photographer flow expects. Idempotent — if the
  // user has already signed in via Google their row exists and we just
  // re-confirm the owner roles + admin flag.
  try {
    await db.event.upsert({
      where: { id: "lighthouse-half-2026" },
      update: {},
      create: {
        id: "lighthouse-half-2026",
        name: "Lighthouse Half Marathon",
        date: new Date("2026-05-24T14:00:00Z"),
        city: "Long Beach, CA",
        org: "Elite Sports California",
      },
    });
    const admin = await db.photographer.upsert({
      where: { email: ADMIN_PHOTOGRAPHER_EMAIL },
      update: { isAdmin: true, roles: OWNER_IMPLIED_ROLES },
      create: {
        email: ADMIN_PHOTOGRAPHER_EMAIL,
        name: ADMIN_PHOTOGRAPHER_NAME,
        isAdmin: true,
        roles: OWNER_IMPLIED_ROLES,
      },
      select: { id: true },
    });
    // v2 multi-event: grant the admin row upload access to the Lighthouse event
    // (owner bypasses enforcement anyway, but keep the bootstrap consistent).
    await db.eventPhotographer.upsert({
      where: {
        eventId_photographerId: {
          eventId: "lighthouse-half-2026",
          photographerId: admin.id,
        },
      },
      update: {},
      create: {
        eventId: "lighthouse-half-2026",
        photographerId: admin.id,
        addedBy: "unlock-bootstrap",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Bootstrap failed — is POSTGRES_URL set on this deploy?",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }

  // Sanitize the redirect target. Anything outside the site, or with weird
  // characters, falls back to "/". Prevents open-redirect even though the
  // route is gated by the unlock key.
  const next =
    nextRaw && ALLOWED_NEXT_PATTERN.test(nextRaw) ? nextRaw : "/";
  const res = NextResponse.redirect(new URL(next, url));

  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  };
  res.cookies.set(UNLOCK_COOKIE, "1", cookieOpts);
  res.cookies.set(PHOTOGRAPHER_UNLOCK_COOKIE, "1", cookieOpts);

  return res;
}
