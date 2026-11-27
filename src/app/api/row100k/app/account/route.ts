import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { sendOwnerNotification } from "@/lib/email";
import { asRower, no, yes } from "../social";

/* A ROWER DELETES THEIR OWN ACCOUNT, from the phone app (2026-11-21; Apple
 * asks every app that makes accounts to let one be deleted from inside
 * it). DELETE { confirm: <their rower number> }.
 *
 * What goes: the rower, and with them every row they logged and its
 * photos' records; who they followed and who followed them; their blocks,
 * mutes, likes, comments and notifications, and the ones about them; their
 * settings, their bio and their profile photo's record; their saved erg
 * recordings; this account's push tokens. What stays: reports made about
 * them (kept for the people who run ROW), and the bare sign-in record of
 * the account, which the photo site's orders hang off.
 *
 * This is the rower's own request about their own data. It is not a
 * "reset" (CLAUDE.md): nobody else's row is touched. The number typed back
 * is the guard against a slip of the thumb. The owner is told. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
    if (Number(body?.confirm) !== me.rowerNumber) return no("Type your rower number to confirm.", 400);
    const rl = await rateLimit({ key: `row-app-account-delete:${me.id}`, limit: 5, windowSec: 3600 });
    if (!rl.ok) return no("Try again in a bit.", 429);
    const userId = who.viewer.actor?.photographerId ?? null;

    const gone = await db.rowParticipant.deleteMany({ where: { id: me.id, challenge: CHALLENGE } });
    if (gone.count === 0) return no("That account is already gone.", 404);
    const id = me.id;
    await Promise.all([
      db.rowFollow.deleteMany({ where: { OR: [{ followerId: id }, { followeeId: id }] } }),
      db.rowBlock.deleteMany({ where: { OR: [{ blockerId: id }, { blockedId: id }] } }),
      db.rowMute.deleteMany({ where: { OR: [{ muterId: id }, { mutedId: id }] } }),
      db.rowNotification.deleteMany({ where: { OR: [{ participantId: id }, { actorId: id }] } }),
      db.rowSocialSetting.deleteMany({ where: { participantId: id } }),
      db.rowLike.deleteMany({ where: { participantId: id } }),
      db.rowComment.deleteMany({ where: { participantId: id } }),
      db.rowCommentLike.deleteMany({ where: { participantId: id } }),
      ...(userId ? [db.rowTelemetry.deleteMany({ where: { userId } }), db.rowPushToken.deleteMany({ where: { userId } }), db.concept2Link.deleteMany({ where: { userId } }), db.concept2Push.deleteMany({ where: { userId } })] : []),
    ]).catch((err) => console.error("row app: failed to clear what a deleted account left", err));

    revalidateTag("row100k-boards");
    try {
      await sendOwnerNotification(`ROW: rower ${me.rowerNumber} deleted their account`, `${me.displayName} (rower ${me.rowerNumber}) deleted their account from the app. Their rows, follows, comments and recordings are gone.`);
    } catch (err) {
      console.error("row app: failed to tell the owner about a deleted account", err);
    }
    return yes();
  } catch (err) {
    console.error("row app: failed to delete an account", err);
    return no("That did not go through. Try again.", 500);
  }
}
