import { NextResponse } from "next/server";
import { APP_RETURN, c2Config, connect, readState, redirectUri } from "@/lib/concept2";

/* CONNECT, STEP TWO: where Concept2 sends the phone's browser after the
 * rower presses Allow (the redirect address registered with Concept2:
 * https://www.rowtember.com/api/row100k/app/concept2/callback). The code is
 * swapped for the rower's tokens with the client secret, here on the
 * server, and the sheet goes back to the app:
 *
 *   rowtember://concept2?ok=1      or      rowtember://concept2?error=...
 *
 * The app then asks the site to send the rows (./sync). Whose link it is
 * comes from the signed state alone, which only ./start makes, behind the
 * development gate. The destination is fixed in this file. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (q: string) => new NextResponse(null, { status: 302, headers: { Location: `${APP_RETURN}?${q}`, "Cache-Control": "no-store" } });
const fail = (msg: string) => back(`error=${encodeURIComponent(msg)}`);

export async function GET(req: Request) {
  const cfg = c2Config();
  if (!cfg) return fail("The Concept2 Logbook is not set up on ROW yet.");
  const u = new URL(req.url);
  if (u.searchParams.get("error")) return fail("Concept2 was not connected.");
  const code = u.searchParams.get("code") ?? "";
  const state = readState(cfg, u.searchParams.get("state") ?? "");
  if (!state) return fail("That took too long. Press Connect again.");
  if (!code) return fail("Concept2 did not finish. Press Connect again.");
  try {
    await connect(cfg, state.userId, code, redirectUri(cfg, req.url), state.tz);
    return back("ok=1");
  } catch (err) {
    console.error("concept2: connect failed", err);
    return fail("Concept2 could not be connected just now. Try again.");
  }
}
