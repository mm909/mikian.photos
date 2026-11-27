import { NextResponse } from "next/server";
import { authorizeUrl, c2Config, cleanTz, makeState, redirectUri } from "@/lib/concept2";
import { rateLimit } from "@/lib/rateLimit";
import { concept2Viewer } from "../gate";

/* CONNECT, STEP ONE. POST { tz } with the app's token; answers the address
 * of Concept2's own sign-in page, which the app opens in the phone's
 * sign-in sheet. The rower signs in to Concept2 there and presses Allow;
 * ROW never sees their Concept2 password. The signed `state` carries who
 * they are to the callback, which the phone's browser reaches with no ROW
 * token of its own. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const v = await concept2Viewer();
  if ("error" in v) return NextResponse.json({ ok: false, error: v.error }, { status: v.status });
  const cfg = c2Config();
  if (!cfg) return NextResponse.json({ ok: false, error: "The Concept2 Logbook is not set up on ROW yet." }, { status: 503 });
  const rl = await rateLimit({ key: `concept2-start:${v.userId}`, limit: 20, windowSec: 600 }).catch(() => null);
  if (rl && !rl.ok) return NextResponse.json({ ok: false, error: "Too many tries. Wait a few minutes." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { tz?: unknown } | null;
  const state = makeState(cfg, v.userId, cleanTz(body?.tz));
  return NextResponse.json({ ok: true, url: authorizeUrl(cfg, redirectUri(cfg, req.url), state) }, { headers: { "Cache-Control": "no-store" } });
}
