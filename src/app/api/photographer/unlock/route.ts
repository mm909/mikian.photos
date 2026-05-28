import { NextResponse } from "next/server";

/**
 * Back-compat alias for the unified `/api/unlock` route.
 *
 * Old bookmarks / docs reference this path. We now have one unlock that
 * drops both cookies (payment + photographer) in a single hit; this just
 * forwards the key + sets the landing to the upload page.
 *
 * Kept as a redirect rather than removed so:
 *  - existing bookmarks don't 404
 *  - the photographer flow still lands the user on /photographer/upload
 *    (the historical behavior), not on `/`.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const target = new URL("/api/unlock", url);
  target.searchParams.set("key", key);
  target.searchParams.set("next", "/photographer/upload");
  return NextResponse.redirect(target);
}
