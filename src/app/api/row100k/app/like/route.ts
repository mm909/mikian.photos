import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { notifyTouch } from "@/lib/rowNotify";
import { asRower, no, seeEntry, yes } from "../social";

/* A LIKE, for the phone app (2026-11-22; owner: "I've officially bit the
 * bullet. I think we want like, comment, share on the posts"). POST
 * { entryId, on }: like a row, or take the like back. Only a row the
 * viewer can see can be liked (a private rower's by an accepted follower,
 * nobody's across a block). The rower is told once per liker per row, and
 * not at all for their own like. Answers the row's count. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const body = (await req.json().catch(() => null)) as { entryId?: unknown; on?: unknown } | null;
    const entry = await seeEntry(me.id, body?.entryId);
    if (!entry) return no("No such row.", 404);
    const rl = await rateLimit({ key: `row-app-like:${me.id}`, limit: 600, windowSec: 3600 });
    if (!rl.ok) return no("Too many at once. Try again in a bit.", 429);
    if (body?.on === false) {
      await db.rowLike.deleteMany({ where: { entryId: entry.id, participantId: me.id } });
    } else {
      const had = await db.rowLike.findUnique({ where: { entryId_participantId: { entryId: entry.id, participantId: me.id } }, select: { id: true } });
      if (!had) {
        await db.rowLike.create({ data: { challenge: CHALLENGE, entryId: entry.id, participantId: me.id } });
        await notifyTouch("liked", entry.participantId, { id: me.id, displayName: me.displayName }, entry.id);
      }
    }
    return yes({ likes: await db.rowLike.count({ where: { entryId: entry.id } }), liked: body?.on !== false });
  } catch (err) {
    console.error("row app: like failed", err);
    return no("That did not go through. Try again.", 500);
  }
}
