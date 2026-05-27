import { NextResponse } from "next/server";
import { unlockKey } from "@/lib/paymentLock";
import {
  ADMIN_PHOTOGRAPHER_EMAIL,
  ADMIN_PHOTOGRAPHER_NAME,
  PHOTOGRAPHER_UNLOCK_COOKIE,
} from "@/lib/photographerLock";
import { db } from "@/lib/db";

/**
 * Bypass NextAuth for photographer privileges. Visit:
 *   /api/photographer/unlock?key=<MIKIAN_UNLOCK_KEY>
 *
 * On success:
 *   - upserts the admin Photographer row (Mikian)
 *   - ensures the Lighthouse Half event row exists
 *   - drops a long-lived HttpOnly cookie that getEffectivePhotographerId() honors
 *   - 302-redirects to /photographer/upload
 *
 * Mirrors /api/unlock (the payment-flow bypass). Same MIKIAN_UNLOCK_KEY env
 * controls both — Mikian holds a single key, two separate cookies.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expected = unlockKey();
  if (!expected) {
    return NextResponse.json(
      { error: "Unlock not configured: set MIKIAN_UNLOCK_KEY on the server" },
      { status: 503 }
    );
  }
  if (key !== expected) {
    return NextResponse.json({ error: "Bad key" }, { status: 401 });
  }

  // Bootstrap the rows the upload page expects. Idempotent.
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
    await db.photographer.upsert({
      where: { email: ADMIN_PHOTOGRAPHER_EMAIL },
      update: { isAdmin: true },
      create: {
        email: ADMIN_PHOTOGRAPHER_EMAIL,
        name: ADMIN_PHOTOGRAPHER_NAME,
        isAdmin: true,
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

  const res = NextResponse.redirect(new URL("/photographer/upload", url));
  res.cookies.set(PHOTOGRAPHER_UNLOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
