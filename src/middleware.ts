import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  isSiteGateOn,
  isAllowedGateEmail,
  SITE_BYPASS_COOKIE,
} from "@/lib/siteGate";

/**
 * Whole-site sign-in gate (see `src/lib/siteGate.ts`).
 *
 * While the gate is on, every request must come from the one allowed Google
 * account. Unauthenticated visitors are bounced to the sign-in page; a
 * signed-in-but-wrong account lands on /no-access.
 *
 * Set SITE_PUBLIC=true to disable and serve a normal public site.
 */

// Paths that must stay reachable WITHOUT passing the gate, or sign-in itself
// would be impossible (chicken-and-egg) and the owner could get locked out.
const OPEN_PATHS = [
  "/photographer/sign-in", // the sign-in screen the gate redirects to
  "/no-access", // the wrong-account landing page
  "/api/auth", // NextAuth endpoints (signin / callback / session / csrf / signout)
  "/api/unlock", // owner unlock-key bypass (drops the bypass cookie)
  "/api/lock", // clears the bypass cookie
  "/api/photographer/unlock", // legacy alias that forwards to /api/unlock
];

function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(req: NextRequest) {
  // Gate disabled → behave as a normal public site.
  if (!isSiteGateOn()) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always let the sign-in / bypass plumbing through.
  if (isOpenPath(pathname)) return NextResponse.next();

  // Owner unlock-cookie bypass — same cookie `/api/unlock?key=…` drops.
  if (req.cookies.get(SITE_BYPASS_COOKIE)?.value === "1") {
    return NextResponse.next();
  }

  // Require a valid NextAuth token for the one allowed account.
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (isAllowedGateEmail(token?.email)) {
    return NextResponse.next();
  }

  // Not signed in → send to sign-in, remembering where they were headed.
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/photographer/sign-in";
    url.search = "";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in with the wrong account → friendly "not you" page.
  const url = req.nextUrl.clone();
  url.pathname = "/no-access";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  /*
   * Run on every request EXCEPT:
   *   - Next.js internals (_next/static, _next/image)
   *   - the favicon
   *   - anything ending in a file extension (/public assets: images, fonts,
   *     css, js, robots.txt, …) so static files are served without the gate.
   *
   * API routes are intentionally still matched — the in-code OPEN_PATHS
   * allow-list exempts only the auth/unlock plumbing; everything else is gated.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
