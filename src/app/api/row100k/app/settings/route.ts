import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { OPT_IN, SWITCHABLE } from "@/lib/rowNotify";
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

/* The account's own lines (owner, 2026-11-21: "allow me to put in a bio";
 * "places to fill in things like height, weight"; "I really want to
 * capture their birth date"). The bio is shown on the profile; the other
 * three are the rower's own and print nowhere. */
const BIO_MAX = 150;
async function read(participantId: string) {
  const [s, p] = await Promise.all([
    db.rowSocialSetting.findUnique({ where: { participantId }, select: { isPrivate: true, notifyOff: true, notifyOn: true } }),
    db.rowParticipant.findUnique({ where: { id: participantId }, select: { bio: true, heightCm: true, weightKg: true, birthday: true } }),
  ]);
  const avatar = (await avatarsFor([participantId])).get(participantId) ?? null;
  return {
    isPrivate: s?.isPrivate ?? false,
    notifyOff: s?.notifyOff ?? [],
    kinds: SWITCHABLE,
    notifyOn: s?.notifyOn ?? [],
    optIn: OPT_IN,
    avatar,
    bio: p?.bio ?? "",
    heightCm: p?.heightCm ?? null,
    weightKg: p?.weightKg ?? null,
    birthday: p?.birthday ? p.birthday.toISOString().slice(0, 10) : null,
  };
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
    const body = (await req.json().catch(() => null)) as { isPrivate?: unknown; notifyOff?: unknown; notifyOn?: unknown; avatarKey?: unknown; bio?: unknown; heightCm?: unknown; weightKg?: unknown; birthday?: unknown } | null;
    const data: { isPrivate?: boolean; notifyOff?: string[]; notifyOn?: string[]; avatarKey?: string | null } = {};
    /* The rower's own lines live on the rower, not on the settings row. */
    const own: { bio?: string | null; heightCm?: number | null; weightKg?: number | null; birthday?: Date | null } = {};
    if (typeof body?.bio === "string") own.bio = body.bio.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim().slice(0, BIO_MAX) || null;
    if (body?.heightCm === null) own.heightCm = null;
    else if (typeof body?.heightCm === "number") {
      if (!(body.heightCm >= 90 && body.heightCm <= 250)) return no("That height does not look right.", 400);
      own.heightCm = Math.round(body.heightCm);
    }
    if (body?.weightKg === null) own.weightKg = null;
    else if (typeof body?.weightKg === "number") {
      if (!(body.weightKg >= 25 && body.weightKg <= 300)) return no("That weight does not look right.", 400);
      own.weightKg = Math.round(body.weightKg * 10) / 10;
    }
    if (body?.birthday === null) own.birthday = null;
    else if (typeof body?.birthday === "string") {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(body.birthday) ? new Date(`${body.birthday}T00:00:00.000Z`) : null;
      if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== body.birthday || d.getUTCFullYear() < 1900 || d.getTime() > Date.now()) return no("That date does not look right.", 400);
      own.birthday = d;
    }
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
    if (Array.isArray(body?.notifyOn)) data.notifyOn = OPT_IN.filter((k) => (body.notifyOn as unknown[]).includes(k));
    if (Object.keys(data).length === 0 && Object.keys(own).length === 0) return no("Nothing to change.", 400);
    if (Object.keys(own).length) await db.rowParticipant.update({ where: { id: me.id }, data: own });
    if (Object.keys(data).length) await db.rowSocialSetting.upsert({ where: { participantId: me.id }, create: { challenge: CHALLENGE, participantId: me.id, ...data }, update: data });
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
