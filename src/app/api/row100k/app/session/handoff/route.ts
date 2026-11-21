import { NextResponse } from "next/server";
import { mintAppToken } from "@/lib/appToken";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";

/* SIGNING IN ON THE PHONE, THROUGH THE SITE (2026-11-22; owner: "build
 * what I need to log in").
 *
 * The phone app opens this address in the phone's own sign-in sheet (the
 * system browser, with Safari's cookies). The site signs the rower in with
 * Google the way it always has, and then this route hands the APP its
 * token by sending the sheet to the app's own address:
 *
 *   rowtember://auth?token=<app token>
 *
 * So the phone needs no Google client of its own and no new secret: the
 * account is whoever the site says is signed in on this phone.
 *
 * Not signed in yet: off to the site's sign-in page, which comes straight
 * back here. The destination is fixed in this file; nothing in the request
 * can point the token anywhere but the app. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP = "rowtember://auth";
const HERE = "/api/row100k/app/session/handoff";

export async function GET(req: Request) {
  const to = (location: string) => new NextResponse(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
  try {
    const actor = await getEffectiveActor();
    if (!actor) return to(new URL(`/sign-in?callbackUrl=${encodeURIComponent(HERE)}`, req.url).toString());
    const rl = await rateLimit({ key: `row-app-handoff:${actor.photographerId}`, limit: 30, windowSec: 600 }).catch(() => null);
    if (rl && !rl.ok) return to(`${APP}?error=${encodeURIComponent("Too many sign-ins. Try again in a few minutes.")}`);
    return to(`${APP}?token=${encodeURIComponent(await mintAppToken(actor.photographerId))}`);
  } catch (err) {
    console.error("row app: sign-in hand-off failed", err);
    return to(`${APP}?error=${encodeURIComponent("Sign-in could not be completed just now.")}`);
  }
}
