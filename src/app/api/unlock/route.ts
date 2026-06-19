import { NextResponse } from "next/server";
import { UNLOCK_COOKIE, unlockKey } from "@/lib/paymentLock";

/**
 * Owner payment-lock bypass.
 *
 *   /api/unlock?key=<MIKIAN_UNLOCK_KEY>[&next=/somewhere]
 *
 * Drops the `mikian_unlock` cookie so `/checkout` shows the real PayPal buttons
 * while the payment lock is on. This is NOT an identity/owner bypass — it only
 * affects the payment lock. The legacy photographer-identity unlock (which made
 * an apparently-signed-out visitor act as owner) was removed; owner/admin and
 * upload access now require a real Google sign-in as the owner.
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

  // Sanitize the redirect target — fall back to "/" for anything off-site/odd.
  const next = nextRaw && ALLOWED_NEXT_PATTERN.test(nextRaw) ? nextRaw : "/";
  const res = NextResponse.redirect(new URL(next, url));
  res.cookies.set(UNLOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
