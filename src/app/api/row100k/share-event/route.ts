import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE } from "@/lib/row100k";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { CARDS } from "@/app/row100k/share/cards";

export const runtime = "nodejs";

/* Record one successful use of a shareable card (share sheet / copy /
 * download) so the owner can see which cards actually get used. Fired
 * fire-and-forget from the share dialog AFTER the action succeeded.
 *
 * No auth on purpose — the cards live on public pages (profiles, stats), so
 * most sharers have no session. The payload is validated hard instead:
 * action and cardId must match known values (cardId against the CARDS
 * registry — DOM-free at module scope, safe to import server-side), and the
 * whole thing sits behind a per-IP rate limit. Analytics must never break
 * sharing: a failed write logs and still answers 200. */

const ACTIONS = new Set(["share", "copy", "download"]);
const CARD_IDS = new Set(CARDS.map((c) => c.id));

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  }

  const cardId = typeof body.cardId === "string" ? body.cardId : "";
  if (!CARD_IDS.has(cardId)) {
    return NextResponse.json({ ok: false, error: "unknown card" }, { status: 400 });
  }

  // Optional: 0 = the community cards (stats page), 1+ = a rower's own cards.
  let rowerNumber: number | null = null;
  if (body.rowerNumber !== undefined && body.rowerNumber !== null) {
    const n = body.rowerNumber;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 9999) {
      return NextResponse.json({ ok: false, error: "bad rower number" }, { status: 400 });
    }
    rowerNumber = n;
  }

  // Public endpoint → per-IP ceiling. 60/hr is far beyond any honest sharing
  // spree; the client swallows the 429 (and everything else) silently.
  const limit = await rateLimit({
    key: `row100k-share-event:ip:${clientIp(req)}`,
    limit: 60,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many events — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  // WHO PRESSED THE BUTTON (owner, 2026-09-16: "if rower 1 downloads for
  // rower 3 then include both of those cols"). The session is optional —
  // most sharers have none — and a lookup that fails costs the column, not
  // the event.
  let sharerRowerNumber: number | null = null;
  try {
    const actor = await getEffectiveActor();
    if (actor) {
      const me = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { rowerNumber: true },
      });
      sharerRowerNumber = me?.rowerNumber ?? null;
    }
  } catch (err) {
    console.error("row100k: share-event sharer lookup failed", err);
  }

  // A dead table or DB hiccup is our problem, not the sharer's — log it and
  // answer 200 anyway so the ping never looks like a failure client-side.
  // The sharer column is not pushed yet: a write carrying it is retried
  // without it, so the event is kept and only the sharer is lost until
  // npm run prisma:push. BOTH writes read back only the id (review,
  // 2026-09-16): without a select, create reads every scalar column back
  // after the insert, so even the sharer-less write named the missing
  // column and nothing landed at all until the push.
  const base = { challenge: CHALLENGE, cardId, action, rowerNumber };
  try {
    await db.shareEvent.create({
      data: sharerRowerNumber === null ? base : { ...base, sharerRowerNumber },
      select: { id: true },
    });
  } catch (err) {
    console.error("row100k: share-event write failed", err);
    if (sharerRowerNumber !== null) {
      try {
        await db.shareEvent.create({ data: base, select: { id: true } });
      } catch (again) {
        console.error("row100k: share-event write failed without the sharer too", again);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
