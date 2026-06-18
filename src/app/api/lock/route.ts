import { NextResponse } from "next/server";
import { UNLOCK_COOKIE } from "@/lib/paymentLock";
import { PHOTOGRAPHER_UNLOCK_COOKIE } from "@/lib/photographerLock";

/**
 * Clear the owner-bypass cookies — both the payment unlock AND the photographer
 * unlock (the latter is what makes getEffectiveActor treat you as owner without
 * a Google sign-in). Lets the owner drop bypass access to test the site as a
 * normal/anonymous visitor.
 */
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url));
  const expire = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  };
  res.cookies.set(UNLOCK_COOKIE, "", expire);
  res.cookies.set(PHOTOGRAPHER_UNLOCK_COOKIE, "", expire);
  return res;
}
