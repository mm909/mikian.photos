import { NextResponse } from "next/server";
import { UNLOCK_COOKIE, unlockKey } from "@/lib/paymentLock";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expected = unlockKey();
  if (!expected) {
    return NextResponse.json(
      { error: "Unlock not configured: set MIKIAN_UNLOCK_KEY in .env.local" },
      { status: 503 }
    );
  }
  if (key !== expected) {
    return NextResponse.json({ error: "Bad key" }, { status: 401 });
  }
  const res = NextResponse.redirect(new URL("/", url));
  res.cookies.set(UNLOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
