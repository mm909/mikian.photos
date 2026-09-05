import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { getEffectiveActor } from "@/lib/permissions";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

/* Record one click on a tracked link (the PARTNERS rail item, the Grizzly
 * outbound links on /row100k/partners) so the owner can see how much of the
 * traffic reaches the partners and follows the sponsor out. Beaconed from
 * TrackedLink / BarNav on click, fire-and-forget, never in the way of the
 * navigation.
 *
 * No auth on purpose — the links sit on public pages, most clickers have no
 * session. Same shape as share-event: the link name must match a small
 * allow-list, the free-text fields are clamped, the whole thing sits behind
 * a per-IP rate limit, and a failed write logs and still answers 200 so the
 * ping never looks like a failure client-side. The body arrives as text
 * (sendBeacon sends text/plain), so it is parsed by hand, not req.json(). */

const LINKS = new Set(["partners", "grizzly", "grizzly-code"]);
const PATH_MAX = 200;
const REFERRER_MAX = 500;

/* document.referrer is a full URL; keep the host only — that is all the
 * owner needs and it drops any query junk the referring page carried. */
function referrerHost(raw: string): string {
  const s = raw.trim().slice(0, REFERRER_MAX);
  if (!s) return "";
  try {
    return new URL(s).host.slice(0, REFERRER_MAX);
  } catch {
    return s;
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const link = typeof body.link === "string" ? body.link : "";
  if (!LINKS.has(link)) {
    return NextResponse.json({ ok: false, error: "unknown link" }, { status: 400 });
  }
  const path = typeof body.path === "string" ? body.path.slice(0, PATH_MAX) : "";
  const referrer = typeof body.referrer === "string" ? referrerHost(body.referrer) : "";

  // Public endpoint → per-IP ceiling, same as share-event. The client
  // swallows the 429 (and everything else) silently.
  const limit = await rateLimit({
    key: `row100k-click:ip:${clientIp(req)}`,
    limit: 60,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many events — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  // Who clicked, if they are a signed-in rower. Best effort: no session, no
  // participant row, or a session backend hiccup all just leave it null.
  let rowerNumber: number | null = null;
  try {
    const actor = await getEffectiveActor();
    if (actor?.photographerId) {
      const me = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { rowerNumber: true },
      });
      rowerNumber = me?.rowerNumber ?? null;
    }
  } catch {
    /* anonymous click */
  }

  // A dead table or DB hiccup is our problem, not the clicker's.
  try {
    await db.rowLinkClick.create({
      data: { challenge: CHALLENGE, link, path, referrer, rowerNumber },
    });
  } catch (err) {
    console.error("row100k: click write failed", err);
  }

  return NextResponse.json({ ok: true });
}
