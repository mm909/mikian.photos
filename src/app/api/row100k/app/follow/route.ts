import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { clearRequest, notifyPerson } from "@/lib/rowNotify";
import { followCounts, relation } from "@/lib/rowSocial";
import { asRower, no, rowerByNum, yes } from "../social";

/* FOLLOWING, for the phone app (2026-11-21; owner's list, 2026-11-20:
 * "follow someone ... accept (or decline) a follow request when private ...
 * turn notifications on or off per person"). POST { num, action }:
 *
 *   follow     follow rower `num`. A public rower is followed at once; a
 *              private one is ASKED, and nothing of theirs opens until they
 *              accept.
 *   unfollow   stop, or withdraw the request.
 *   accept     let rower `num` follow me (their request to me).
 *   decline    refuse it.
 *   remove     make rower `num` stop following me.
 *   bell       { on } whether I am told when rower `num` passes me. Off
 *              until turned on (owner, 2026-11-21: "it's off by default").
 *   mute       { on } leave rower `num`'s rows out of my feed, or bring
 *              them back. Nothing else changes and they are not told.
 *
 * Answers how the two now stand, and the rower's counts, so the button and
 * the numbers on the screen can be redrawn from the answer alone. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = ["follow", "unfollow", "accept", "decline", "remove", "bell", "mute"] as const;

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const body = (await req.json().catch(() => null)) as { num?: unknown; action?: unknown; on?: unknown } | null;
    const action = ACTIONS.find((a) => a === body?.action);
    if (!action) return no("Unknown action.", 400);
    const them = await rowerByNum(body?.num);
    if (!them) return no("No such rower.", 404);
    if (them.id === me.id) return no("That is you.", 400);
    const rl = await rateLimit({ key: `row-app-follow:${me.id}`, limit: 300, windowSec: 3600 });
    if (!rl.ok) return no("Too many at once. Try again in a bit.", 429);

    const actor = { id: me.id, displayName: me.displayName };
    const theirs = { followerId_followeeId: { followerId: them.id, followeeId: me.id } };

    if (action === "follow") {
      const rel = await relation(me.id, them.id);
      if (rel.blockedByMe) return no("You blocked this rower. Unblock them first.", 400);
      /* Somebody who blocked me learns nothing from the answer, and neither
       * do I: it reads as a request sent, and it never arrives. */
      if (rel.blockedMe) return yes({ rel: { ...rel, following: "pending" }, counts: await followCounts(them.id) });
      if (rel.following === "none") {
        const status = rel.isPrivate ? "pending" : "accepted";
        await db.rowFollow.create({ data: { challenge: CHALLENGE, followerId: me.id, followeeId: them.id, status, notify: false, acceptedAt: status === "accepted" ? new Date() : null } });
        await notifyPerson(status === "accepted" ? "follow" : "request", them.id, actor);
      }
    } else if (action === "unfollow") {
      await db.rowFollow.deleteMany({ where: { followerId: me.id, followeeId: them.id } });
      await clearRequest(them.id, me.id);
    } else if (action === "mute") {
      if (body?.on === false) await db.rowMute.deleteMany({ where: { muterId: me.id, mutedId: them.id } });
      else await db.rowMute.upsert({ where: { muterId_mutedId: { muterId: me.id, mutedId: them.id } }, create: { challenge: CHALLENGE, muterId: me.id, mutedId: them.id }, update: {} });
    } else if (action === "bell") {
      await db.rowFollow.updateMany({ where: { followerId: me.id, followeeId: them.id }, data: { notify: body?.on === true } });
    } else if (action === "accept") {
      const asked = await db.rowFollow.findUnique({ where: theirs, select: { status: true } });
      if (asked?.status === "pending") {
        await db.rowFollow.update({ where: theirs, data: { status: "accepted", acceptedAt: new Date() } });
        await clearRequest(me.id, them.id);
        await notifyPerson("accepted", them.id, actor);
      }
    } else {
      /* decline, remove: either way they no longer follow me, and are not told. */
      await db.rowFollow.deleteMany({ where: { followerId: them.id, followeeId: me.id } });
      await clearRequest(me.id, them.id);
    }
    return yes({ rel: await relation(me.id, them.id), counts: await followCounts(them.id) });
  } catch (err) {
    console.error("row app: follow action failed", err);
    return no("That did not go through. Try again.", 500);
  }
}
