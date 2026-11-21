import { db } from "@/lib/db";
import { CHALLENGE, fmtRowerNumber } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";
import { notifyTouch } from "@/lib/rowNotify";
import { avatarsFor, blockedIds } from "@/lib/rowSocial";
import { stampParts } from "@/app/row100k/feed/view";
import { asRower, no, seeEntry, yes } from "../social";

/* COMMENTS ON A ROW, for the phone app (2026-11-22; owner: "like, comment,
 * share on the posts ... allow me to reply to comments. I really want it to
 * work just like Instagram's"; "in Strava, you can't reply to a comment. I
 * think that's a little silly").
 *
 *   GET ?entry=<id>                      the comments, oldest first, each
 *                                        with its replies under it
 *   POST { entryId, text, parentId? }    a comment, or a reply to one
 *   POST { remove: <comment id> }        take one down: its writer, the
 *                                        rower whose row it is, or an admin
 *
 * One level of replies, as Instagram shows them: a reply to a reply is filed
 * under the same first comment. Only a row the viewer can see can be read
 * or written on. A comment by somebody the viewer has blocked, or who has
 * blocked them, is not shown to them. The row's rower is told of a comment,
 * and a comment's writer of a reply.
 *
 * A ROWER TAGGED IN A COMMENT (owner, the same day, of "allow users to add
 * other users": "I meant tagging someone in a comment") is written into the
 * text as @[<rower number>], which is what the app sends once a name has
 * been picked. The answer carries `tags`, number to name as it stands now,
 * so a comment follows a rower who changes their name. Each rower tagged is
 * told, unless the same comment already told them something.
 *
 * Text only (owner: "we just need text, I think, for comments"). Each line
 * carries its likes (api/row100k/app/like). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 500;
const TAG = /@\[(\d{1,6})\]/g;
const tagged = (text: string): number[] => [...new Set([...text.matchAll(TAG)].map((m) => Number(m[1])))].slice(0, 10);

export async function GET(req: Request) {
  try {
    const viewer = await resolveViewer();
    const entry = await seeEntry(viewer.myParticipantId, new URL(req.url).searchParams.get("entry"));
    if (!entry) return no("No such row.", 404);
    const rows = await db.rowComment.findMany({ where: { entryId: entry.id, deletedAt: null }, orderBy: { createdAt: "asc" }, take: 500, select: { id: true, participantId: true, parentId: true, text: true, createdAt: true } });
    const cut = new Set(viewer.myParticipantId ? await blockedIds(viewer.myParticipantId) : []);
    const shown = rows.filter((r) => !cut.has(r.participantId));
    const ids = [...new Set(shown.map((r) => r.participantId))];
    const nums = [...new Set(shown.flatMap((r) => tagged(r.text)))];
    const shownIds = shown.map((r) => r.id);
    const [people, faces, named, likeRows, mineRows] = await Promise.all([
      ids.length ? db.rowParticipant.findMany({ where: { id: { in: ids } }, select: { id: true, rowerNumber: true, displayName: true } }) : Promise.resolve([]),
      avatarsFor(ids),
      nums.length ? db.rowParticipant.findMany({ where: { challenge: CHALLENGE, rowerNumber: { in: nums } }, select: { rowerNumber: true, displayName: true } }) : Promise.resolve([]),
      shownIds.length ? db.rowCommentLike.groupBy({ by: ["commentId"], where: { commentId: { in: shownIds } }, _count: true }) : Promise.resolve([]),
      shownIds.length && viewer.myParticipantId ? db.rowCommentLike.findMany({ where: { commentId: { in: shownIds }, participantId: viewer.myParticipantId }, select: { commentId: true } }) : Promise.resolve([]),
    ]);
    const by = new Map(people.map((p) => [p.id, p]));
    const likes = new Map(likeRows.map((l) => [l.commentId, l._count]));
    const liked = new Set(mineRows.map((l) => l.commentId));
    const line = (r: (typeof shown)[number]) => {
      const p = by.get(r.participantId);
      if (!p) return null;
      return {
        id: r.id,
        parentId: r.parentId,
        rowerNumber: p.rowerNumber,
        numStr: fmtRowerNumber(p.rowerNumber),
        name: p.displayName,
        avatar: faces.get(p.id) ?? null,
        text: r.text,
        likes: likes.get(r.id) ?? 0,
        liked: liked.has(r.id),
        mine: p.id === viewer.myParticipantId,
        /* Who may take it down: its writer, the row's rower, an admin. */
        canRemove: p.id === viewer.myParticipantId || entry.participantId === viewer.myParticipantId || viewer.isAdmin,
        absIso: r.createdAt.toISOString(),
        ...stampParts(r.createdAt),
      };
    };
    const all = shown.map(line).filter((c): c is NonNullable<ReturnType<typeof line>> => c !== null);
    const tops = all.filter((c) => !c.parentId);
    return yes({ comments: tops.map((c) => ({ ...c, replies: all.filter((r) => r.parentId === c.id) })), count: all.length, tags: Object.fromEntries(named.map((p) => [String(p.rowerNumber), p.displayName])) });
  } catch (err) {
    console.error("row app: failed to read comments", err);
    return no("The comments could not be read just now.", 500);
  }
}

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const body = (await req.json().catch(() => null)) as { entryId?: unknown; text?: unknown; parentId?: unknown; remove?: unknown } | null;

    if (typeof body?.remove === "string") {
      const c = await db.rowComment.findFirst({ where: { id: body.remove, challenge: CHALLENGE, deletedAt: null }, select: { id: true, participantId: true, entryId: true } });
      if (!c) return no("That comment is already gone.", 404);
      const entry = await db.rowEntry.findFirst({ where: { id: c.entryId }, select: { participantId: true } });
      if (c.participantId !== me.id && entry?.participantId !== me.id && !who.viewer.isAdmin) return no("Not yours to remove.", 403);
      /* Its replies go with it; nothing is erased, only no longer shown. */
      await db.rowComment.updateMany({ where: { OR: [{ id: c.id }, { parentId: c.id }] }, data: { deletedAt: new Date() } });
      return yes();
    }

    const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX) : "";
    if (!text) return no("Write something first.", 400);
    const entry = await seeEntry(me.id, body?.entryId);
    if (!entry) return no("No such row.", 404);
    const rl = await rateLimit({ key: `row-app-comment:${me.id}`, limit: 120, windowSec: 3600 });
    if (!rl.ok) return no("That is a lot of comments. Try again in a bit.", 429);

    let parentId: string | null = null;
    let parentBy: string | null = null;
    if (typeof body?.parentId === "string") {
      const parent = await db.rowComment.findFirst({ where: { id: body.parentId, entryId: entry.id, deletedAt: null }, select: { id: true, parentId: true, participantId: true } });
      if (!parent) return no("That comment is gone.", 404);
      parentId = parent.parentId ?? parent.id;
      parentBy = parent.participantId;
    }
    const made = await db.rowComment.create({ data: { challenge: CHALLENGE, entryId: entry.id, participantId: me.id, parentId, text }, select: { id: true } });
    const actor = { id: me.id, displayName: me.displayName };
    if (parentBy) await notifyTouch("replied", parentBy, actor, entry.id);
    if (entry.participantId !== parentBy) await notifyTouch("commented", entry.participantId, actor, entry.id);
    /* Whoever was tagged, unless this comment has already told them. */
    const nums = tagged(text);
    if (nums.length) {
      const people = await db.rowParticipant.findMany({ where: { challenge: CHALLENGE, rowerNumber: { in: nums } }, select: { id: true } });
      for (const p of people) if (p.id !== parentBy && p.id !== entry.participantId) await notifyTouch("mentioned", p.id, actor, entry.id);
    }
    return yes({ id: made.id });
  } catch (err) {
    console.error("row app: comment failed", err);
    return no("That did not go through. Try again.", 500);
  }
}
