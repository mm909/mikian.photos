import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { SWITCHABLE } from "@/lib/rowNotify";
import { avatarsFor } from "@/lib/rowSocial";
import { asRower, no, yes } from "../social";

/* WHAT A ROWER HAS CHOSEN, for the phone app (2026-11-21): whether the
 * account is private, and which kinds of notification are switched off.
 * GET reads it; POST { isPrivate?, notifyOff? } changes what it names.
 *
 * GOING PUBLIC accepts everybody who was waiting: a public rower has no
 * requests, so they would otherwise sit unanswered for ever. Going private
 * keeps the followers already there. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function read(participantId: string) {
  const s = await db.rowSocialSetting.findUnique({ where: { participantId }, select: { isPrivate: true, notifyOff: true } });
  const avatar = (await avatarsFor([participantId])).get(participantId) ?? null;
  return { isPrivate: s?.isPrivate ?? false, notifyOff: s?.notifyOff ?? [], kinds: SWITCHABLE, avatar };
}

export async function GET() {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  try {
    return yes({ settings: await read(who.me.id) });
  } catch (err) {
    console.error("row app: failed to read settings", err);
    return no("Your settings could not be read just now.", 500);
  }
}

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const body = (await req.json().catch(() => null)) as { isPrivate?: unknown; notifyOff?: unknown; avatarKey?: unknown } | null;
    const data: { isPrivate?: boolean; notifyOff?: string[]; avatarKey?: string | null } = {};
    /* THE PROFILE PHOTO: a key the rower's own upload was signed for (the
     * photos/sign route only signs under their own prefix), or null to
     * take the photo off. */
    if (body?.avatarKey === null) data.avatarKey = null;
    else if (typeof body?.avatarKey === "string") {
      const key = body.avatarKey;
      const own = `row100k/${CHALLENGE}/${me.id}/`;
      if (key.length > 200 || key.includes("..") || !key.startsWith(own) || !/\.(jpe?g|png|webp)$/i.test(key)) return no("That photo is not one of yours.", 400);
      data.avatarKey = key;
    }
    if (typeof body?.isPrivate === "boolean") data.isPrivate = body.isPrivate;
    if (Array.isArray(body?.notifyOff)) data.notifyOff = SWITCHABLE.filter((k) => (body.notifyOff as unknown[]).includes(k));
    if (Object.keys(data).length === 0) return no("Nothing to change.", 400);
    await db.rowSocialSetting.upsert({ where: { participantId: me.id }, create: { challenge: CHALLENGE, participantId: me.id, ...data }, update: data });
    if (data.isPrivate === false) {
      await db.rowFollow.updateMany({ where: { followeeId: me.id, status: "pending" }, data: { status: "accepted", acceptedAt: new Date() } });
      await db.rowNotification.deleteMany({ where: { participantId: me.id, kind: "request" } });
    }
    return yes({ settings: await read(me.id) });
  } catch (err) {
    console.error("row app: failed to save settings", err);
    return no("That did not save. Try again.", 500);
  }
}
