import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { notifyTouch } from "@/lib/rowNotify";
import { asRower, no, seeEntry, yes } from "../social";

/* A LIKE, for the phone app (2026-11-22; owner: "I've officially bit the
 * bullet. I think we want like, comment, share on the posts"; then, the
 * same day: "allow me to like comments as well").
 *
 *   POST { entryId, on }      like a row, or take the like back
 *   POST { commentId, on }    the same, of a comment under a row
 *
 * Only a row the viewer can see can be liked, or a comment under one (a
 * private rower's by an accepted follower, nobody's across a block). The
 * rower, or the comment's writer, is told once per liker, and not at all
 * for their own like. Answers the count. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const body = (await req.json().catch(() => null)) as { entryId?: unknown; commentId?: unknown; on?: unknown } | null;
    const on = body?.on !== false;
    const rl = await rateLimit({ key: `row-app-like:${me.id}`, limit: 600, windowSec: 3600 });
    if (!rl.ok) return no("Too many at once. Try again in a bit.", 429);
    const actor = { id: me.id, displayName: me.displayName };

    if (typeof body?.commentId === "string") {
      const c = await db.rowComment.findFirst({ where: { id: body.commentId, challenge: CHALLENGE, deletedAt: null }, select: { id: true, entryId: true, participantId: true } });
      const entry = c ? await seeEntry(me.id, c.entryId) : null;
      if (!c || !entry) return no("That comment is gone.", 404);
      if (!on) {
        await db.rowCommentLike.deleteMany({ where: { commentId: c.id, participantId: me.id } });
      } else {
        const had = await db.rowCommentLike.findUnique({ where: { commentId_participantId: { commentId: c.id, participantId: me.id } }, select: { id: true } });
        if (!had) {
          await db.rowCommentLike.create({ data: { challenge: CHALLENGE, entryId: entry.id, commentId: c.id, participantId: me.id } });
          await notifyTouch("likedComment", c.participantId, actor, entry.id);
        }
      }
      return yes({ likes: await db.rowCommentLike.count({ where: { commentId: c.id } }), liked: on });
    }

    const entry = await seeEntry(me.id, body?.entryId);
    if (!entry) return no("No such row.", 404);
    if (!on) {
      await db.rowLike.deleteMany({ where: { entryId: entry.id, participantId: me.id } });
    } else {
      const had = await db.rowLike.findUnique({ where: { entryId_participantId: { entryId: entry.id, participantId: me.id } }, select: { id: true } });
      if (!had) {
        await db.rowLike.create({ data: { challenge: CHALLENGE, entryId: entry.id, participantId: me.id } });
        await notifyTouch("liked", entry.participantId, actor, entry.id);
      }
    }
    return yes({ likes: await db.rowLike.count({ where: { entryId: entry.id } }), liked: on });
  } catch (err) {
    console.error("row app: like failed", err);
    return no("That did not go through. Try again.", 500);
  }
}
