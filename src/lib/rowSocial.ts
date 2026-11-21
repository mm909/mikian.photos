import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { resolvePhotoMedia } from "@/app/row100k/photoUrls";

/* WHO SEES WHOSE ROWS (2026-11-21). The phone app's social layer, and the
 * one place its rules are written, so the feed, a profile, a row's page and
 * the website's own pages cannot disagree. The owner's rules, 2026-11-20:
 *
 *   "New accounts are public. Everyone starts following no one."
 *   A PRIVATE rower still appears on the board. Their individual rows are
 *   not shown to people they have not accepted. Their page still shows the
 *   name, the number, Instagram, total metres, hours, average split and the
 *   number of sessions.
 *   BLOCKING removes someone from my feed and from my view of their profile
 *   (and mine from theirs). They stay on the board.
 *   Anyone can see who a rower follows and who follows them.
 *
 * Nobody is exempt, admins included: an admin who wants a private rower's
 * rows follows them like anybody else. (A REPORT mails the owner what was
 * reported, so moderation does not need the exemption.)
 *
 * Rowers are named by RowParticipant.id throughout; the tables are in
 * prisma/schema.prisma (RowSocialSetting, RowFollow, RowBlock, RowReport,
 * RowNotification). SERVER ONLY. */

/* A DATABASE THAT DOES NOT HAVE THE TABLES YET. They arrive with a
 * production build; a laptop pointed at the live database from this code
 * before that build would otherwise fail every page that asks who is
 * private. No table means nobody has chosen anything: everyone is public,
 * nobody follows, nobody is blocked. Any other failure is thrown. */
function missing(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022");
}
async function orEmpty<T>(q: Promise<T[]>): Promise<T[]> {
  try {
    return await q;
  } catch (err) {
    if (missing(err)) return [];
    throw err;
  }
}

export type FollowState = "none" | "pending" | "accepted";
export type Access = "open" | "private" | "blocked";

export type Relation = {
  /* Me to them. */
  following: FollowState;
  /* The bell on my follow of them. */
  bell: boolean;
  /* Them to me. */
  followsYou: FollowState;
  blockedByMe: boolean;
  blockedMe: boolean;
  /* I have muted them: their rows are left out of my feed, nothing else. */
  muted: boolean;
  isPrivate: boolean;
  /* What I may see of their rows. */
  access: Access;
};

const state = (s: string | undefined): FollowState => (s === "accepted" ? "accepted" : s === "pending" ? "pending" : "none");

export async function isPrivate(participantId: string): Promise<boolean> {
  const rows = await orEmpty(db.rowSocialSetting.findMany({ where: { participantId }, select: { isPrivate: true } }));
  return rows[0]?.isPrivate ?? false;
}

/* How the viewer and one rower stand. `viewerId` null is a signed-out
 * visitor, or an account that has not joined. */
export async function relation(viewerId: string | null, subjectId: string): Promise<Relation> {
  const priv = await isPrivate(subjectId);
  if (!viewerId || viewerId === subjectId) {
    return { following: "none", bell: false, followsYou: "none", blockedByMe: false, blockedMe: false, muted: false, isPrivate: priv, access: viewerId === subjectId || !priv ? "open" : "private" };
  }
  const [follows, blocks, mutes] = await Promise.all([
    orEmpty(
      db.rowFollow.findMany({
        where: { OR: [{ followerId: viewerId, followeeId: subjectId }, { followerId: subjectId, followeeId: viewerId }] },
        select: { followerId: true, status: true, notify: true },
      }),
    ),
    orEmpty(
      db.rowBlock.findMany({
        where: { OR: [{ blockerId: viewerId, blockedId: subjectId }, { blockerId: subjectId, blockedId: viewerId }] },
        select: { blockerId: true },
      }),
    ),
    orEmpty(db.rowMute.findMany({ where: { muterId: viewerId, mutedId: subjectId }, select: { id: true } })),
  ]);
  const out = follows.find((f) => f.followerId === viewerId);
  const back = follows.find((f) => f.followerId === subjectId);
  const blockedByMe = blocks.some((b) => b.blockerId === viewerId);
  const blockedMe = blocks.some((b) => b.blockerId === subjectId);
  const following = state(out?.status);
  const access: Access = blockedByMe || blockedMe ? "blocked" : priv && following !== "accepted" ? "private" : "open";
  return { following, bell: following === "accepted" ? out!.notify : false, followsYou: state(back?.status), blockedByMe, blockedMe, muted: mutes.length > 0, isPrivate: priv, access };
}

/* Everybody this viewer follows and has been accepted by. */
export async function followingIds(viewerId: string): Promise<string[]> {
  const rows = await orEmpty(db.rowFollow.findMany({ where: { challenge: CHALLENGE, followerId: viewerId, status: "accepted" }, select: { followeeId: true } }));
  return rows.map((r) => r.followeeId);
}

/* Everybody blocked by, or blocking, this viewer. */
export async function blockedIds(viewerId: string): Promise<string[]> {
  const rows = await orEmpty(db.rowBlock.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } }));
  return rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId));
}

/* Everybody this viewer has muted: left out of their feed only. */
export async function mutedIds(viewerId: string): Promise<string[]> {
  const rows = await orEmpty(db.rowMute.findMany({ where: { muterId: viewerId }, select: { mutedId: true } }));
  return rows.map((r) => r.mutedId);
}

/* THE ROWERS WHOSE ROWS THIS VIEWER MAY NOT BE SHOWN: every private rower
 * they have not been accepted by, and everybody on either side of a block.
 * Never the viewer themselves. A list of rows (the feed, the gallery)
 * leaves these rowers' rows out altogether. */
export async function hiddenRowers(viewerId: string | null): Promise<string[]> {
  const privates = await orEmpty(db.rowSocialSetting.findMany({ where: { challenge: CHALLENGE, isPrivate: true }, select: { participantId: true } }));
  if (!viewerId) return privates.map((p) => p.participantId);
  const [following, blocked] = await Promise.all([privates.length ? followingIds(viewerId) : Promise.resolve([] as string[]), blockedIds(viewerId)]);
  const ok = new Set(following);
  const out = new Set(blocked);
  for (const p of privates) if (!ok.has(p.participantId)) out.add(p.participantId);
  out.delete(viewerId);
  return [...out];
}

/* How many follow a rower and how many they follow (accepted only). */
export async function followCounts(participantId: string): Promise<{ followers: number; following: number }> {
  try {
    const [followers, following] = await Promise.all([
      db.rowFollow.count({ where: { followeeId: participantId, status: "accepted" } }),
      db.rowFollow.count({ where: { followerId: participantId, status: "accepted" } }),
    ]);
    return { followers, following };
  } catch (err) {
    if (missing(err)) return { followers: 0, following: 0 };
    throw err;
  }
}

/* PROFILE PHOTOS, by rower: the address of the small copy of each one that
 * has been set. A rower with none is simply not in the map. Public like a
 * name, private account or not: it is the face beside the name on the
 * board. */
export async function avatarsFor(participantIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(participantIds)];
  if (ids.length === 0) return out;
  try {
    const rows = await orEmpty(db.rowSocialSetting.findMany({ where: { participantId: { in: ids }, avatarKey: { not: null } }, select: { participantId: true, avatarKey: true } }));
    const media = await resolvePhotoMedia(rows.map((r) => r.avatarKey as string));
    rows.forEach((r, i) => {
      const m = media[i];
      if (m) out.set(r.participantId, m.thumb || m.full);
    });
  } catch (err) {
    /* A face that cannot be read is initials, never a broken page. */
    console.error("row social: profile photos unreadable", err);
  }
  return out;
}

/* The kinds of notification a rower has switched off. */
export async function notifyOff(participantIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (participantIds.length === 0) return out;
  const rows = await orEmpty(db.rowSocialSetting.findMany({ where: { participantId: { in: participantIds } }, select: { participantId: true, notifyOff: true } }));
  for (const r of rows) out.set(r.participantId, new Set(r.notifyOff));
  return out;
}
