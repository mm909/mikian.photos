import { NextResponse } from "next/server";

/* DEV ONLY — act as an account, by email, for walking a signed-in flow
 * without a Google sign-in (2026-09-21, for screenshotting the race day
 * sign-up as a stranger sees it). GET ?email=…&to=/where sets the
 * mk_dev_actor cookie that lib/permissions.ts reads IN DEVELOPMENT ONLY and
 * redirects; ?email= (empty) clears it. A production build answers 404 and
 * getEffectiveActor never reads the cookie there, so this is not a door. */
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const toRaw = url.searchParams.get("to") ?? "/row100k/raceday";
  const to = toRaw.startsWith("/") && !toRaw.startsWith("//") ? toRaw : "/row100k/raceday";
  const res = NextResponse.redirect(new URL(to, url.origin), { status: 303 });
  if (email) res.cookies.set("mk_dev_actor", email, { path: "/", httpOnly: false, sameSite: "lax", maxAge: 3600 });
  else res.cookies.set("mk_dev_actor", "", { path: "/", maxAge: 0 });
  return res;
}
