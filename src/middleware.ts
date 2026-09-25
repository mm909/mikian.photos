import { NextResponse, type NextRequest } from "next/server";

/* The photo marketplace is off the air. Owner, 2026-09-25: "Make those
 * pages unreachable. No mikian.photos page should still be accessible."
 * Every request whose path is not on this list is sent to / with a 307
 * before any page code runs. The photo code stays in the tree; only the
 * door is shut. The list is the rowing products (Rowtember, the erg
 * console, the LASD26 crew call, the TSP tracker), the privacy page, the
 * API routes those products call, next-auth, and the two Vercel cron
 * paths in vercel.json. Public files (anything with an extension), Next
 * internals, favicon, robots and sitemap never reach the middleware — see
 * the matcher below. */
const ALLOWED_PREFIXES = [
  "/row100k",
  "/erg",
  "/lasd26",
  "/tsp",
  "/moab240",
  "/privacy",
  "/api/auth",
  "/api/row100k",
  "/api/erg",
  "/api/home",
  "/api/lasd26",
  "/api/relay",
  "/api/cron/backfill-detection",
  "/api/cron/backup-db",
  /* public/ folders, in case a request for one slips past the extension
   * rule in the matcher */
  "/assets",
  "/gpx",
];

function allowed(pathname: string): boolean {
  if (pathname === "/") return true;
  for (const p of ALLOWED_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + "/")) return true;
  }
  return false;
}

export function middleware(req: NextRequest) {
  if (allowed(req.nextUrl.pathname)) return NextResponse.next();
  return NextResponse.redirect(new URL("/", req.url), 307);
}

export const config = {
  /* Everything except Next internals, the favicon, robots, sitemap and any
   * path with a file extension (the public/ assets: /row100k/*.png,
   * /lasd26/*.jpg, /assets/*.svg, /gpx/*.gpx). */
  matcher: ["/((?!_next/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)"],
};
