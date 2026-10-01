import { NextResponse, type NextRequest } from "next/server";
import { PALETTE_COOKIE, isPaletteId } from "@/lib/rowPalette";

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
  "/api/cron/row100k-daily",
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

/* THE PALETTE PREVIEW (owner, 2026-09-30: try the colours live). Any
 * /row100k URL carrying ?palette=<id> (rowPalette.ts) sets the preview
 * cookie for this browser and comes straight back to the same URL without
 * the query, so the page that then renders — the segment layout and the
 * landing both read the cookie (sitePalette.ts) — already wears it. Any
 * other value (?palette=off) clears the cookie and the site setting stands
 * again. A session cookie: closing the browser ends the preview. */
function paletteRedirect(req: NextRequest): NextResponse | null {
  const url = req.nextUrl;
  if (!url.pathname.startsWith("/row100k")) return null;
  const want = url.searchParams.get("palette");
  if (want === null) return null;
  const back = url.clone();
  back.searchParams.delete("palette");
  const res = NextResponse.redirect(back, 307);
  if (isPaletteId(want)) {
    res.cookies.set({
      name: PALETTE_COOKIE,
      value: want,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    res.cookies.set({ name: PALETTE_COOKIE, value: "", path: "/", maxAge: 0 });
  }
  return res;
}

/* ROWTEMBER.COM (owner, 2026-10-01: the domain is on the project and the
 * Google redirect URI is added). On that host the front door is Rowtember
 * itself: / is served by the /row100k page — a rewrite, so the address
 * stays the bare domain — instead of the Mikian Musser landing. Every other
 * path is as it is on the old host (/row100k/…), until the paths lose
 * their prefix. */
function onRowtember(req: NextRequest): boolean {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  return host === "rowtember.com" || host === "www.rowtember.com";
}

/* THE ADDRESSES WITHOUT /row100k (owner, 2026-10-01: "let's remove all of
 * the row100k references in the hyperlink"). The pages still live under
 * src/app/row100k; a request whose first segment is one of theirs —
 * /stats, /r/95, /records/5k, /sign-in — is served by the page at
 * /row100k/<the same path>, a rewrite, so the address a rower sees and
 * shares carries no prefix. The list is the folders under src/app/row100k
 * that hold a page; add a new page folder here when one is made. None of
 * them is also a top-level route of this app. */
const ROW_SEGMENTS = new Set([
  "analysis",
  "blackout",
  "board",
  "dev",
  "emails",
  "feed",
  "gallery",
  "join",
  "moderation",
  "partners",
  "plan",
  "pm5",
  "post",
  "posters",
  "preview",
  "r",
  "race-admin",
  "raceday",
  "raffles",
  "records",
  "settings",
  "shareables",
  "shirt",
  "shirts",
  "shop-admin",
  "sign-in",
  "signups",
  "stats",
]);

function rowRewrite(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (pathname === "/" && onRowtember(req)) {
    const front = req.nextUrl.clone();
    front.pathname = "/row100k";
    return NextResponse.rewrite(front);
  }
  const first = pathname.split("/")[1] ?? "";
  if (!ROW_SEGMENTS.has(first)) return null;
  const to = req.nextUrl.clone();
  to.pathname = `/row100k${pathname}`;
  return NextResponse.rewrite(to);
}

/* NO ROWTEMBER ON THE OLD HOST (owner, 2026-10-01: "no more hosting will
 * get done on mikianmusser.com for Rowtember"). On mikianmusser.com every
 * Rowtember address — /row100k and everything under it, the addresses
 * without the prefix, and the erg console — answers with a permanent
 * redirect to the same page on www.rowtember.com, query kept, the
 * /row100k prefix dropped. Printed links and old mail keep working; a
 * rower signs in once more there (a session belongs to its host). The
 * landing at /, the crew call, the relay, the media kit and every API
 * route stay where they are. Only the two production hostnames: a preview
 * deployment and localhost serve everything, as before. */
const ROWTEMBER_ORIGIN = "https://www.rowtember.com";

function onOldHost(req: NextRequest): boolean {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  return host === "mikianmusser.com" || host === "www.mikianmusser.com";
}

/* A Rowtember address as it reads on rowtember.com, or null for a path
 * that is not Rowtember's. */
function rowtemberPath(pathname: string): string | null {
  if (pathname === "/row100k") return "/";
  if (pathname.startsWith("/row100k/")) return pathname.slice("/row100k".length);
  if (pathname === "/erg" || pathname.startsWith("/erg/")) return pathname;
  if (ROW_SEGMENTS.has(pathname.split("/")[1] ?? "")) return pathname;
  return null;
}

function toRowtember(req: NextRequest): NextResponse | null {
  if (!onOldHost(req)) return null;
  const { pathname, search, searchParams } = req.nextUrl;
  const path = rowtemberPath(pathname);
  if (path === null) return null;
  /* The one sign-in page serves both hosts (src/lib/auth.ts pages.signIn):
   * asked for on the way to a page that stays here — the relay console,
   * the crew call — it must sign in HERE, so it is left alone. */
  if (path === "/sign-in") {
    const cb = searchParams.get("callbackUrl") ?? "";
    let cbPath = cb;
    try {
      cbPath = new URL(cb, req.url).pathname;
    } catch {
      cbPath = "";
    }
    if (cbPath && cbPath !== "/" && rowtemberPath(cbPath) === null) return null;
  }
  return NextResponse.redirect(`${ROWTEMBER_ORIGIN}${path}${search}`, 308);
}

export function middleware(req: NextRequest) {
  const moved = toRowtember(req);
  if (moved) return moved;
  const row = rowRewrite(req);
  if (row) return row;
  if (allowed(req.nextUrl.pathname)) return paletteRedirect(req) ?? NextResponse.next();
  return NextResponse.redirect(new URL("/", req.url), 307);
}

export const config = {
  /* Everything except Next internals, the favicon, robots, sitemap and any
   * path with a file extension (the public/ assets: /row100k/*.png,
   * /lasd26/*.jpg, /assets/*.svg, /gpx/*.gpx). */
  matcher: ["/((?!_next/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)"],
};
