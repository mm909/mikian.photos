import { db } from "@/lib/db";
import { fmtRowerNumber } from "@/lib/row100k";
import { stampParts } from "@/app/row100k/feed/view";
import { numbersHidden, rowedWords } from "@/lib/rowNotify";
import { avatarsFor } from "@/lib/rowSocial";
import { asRower, no, yes } from "../social";

/* THE NOTIFICATION CENTRE, for the phone app (2026-11-21; owner,
 * 2026-11-20: "a notification centre lists them all"). GET answers the
 * rower's lines, newest first, each already a sentence, with who it is
 * about and where a tap should lead; POST { read: true } marks them read.
 *
 * A line whose rower has since left, or been blocked, is dropped here and
 * not shown as a blank. A row's line says how far and how fast, as its push
 * did ("rowed 5,000 m at 1:57.0."), read off the row as it is now; while
 * lights out or its run-up is on it says "logged a row." and no more
 * (lib/rowNotify.ts). No other sentence has metres in it. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 80;

export async function GET() {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const rows = await db.rowNotification.findMany({
      where: { participantId: me.id },
      orderBy: { createdAt: "desc" },
      take: PAGE,
      select: { id: true, kind: true, actorId: true, entryId: true, actors: true, readAt: true, createdAt: true },
    });
    const ids = [...new Set(rows.flatMap((r) => [...(r.actorId ? [r.actorId] : []), ...r.actors]))];
    const rowedIds = [...new Set(rows.flatMap((r) => (r.kind === "rowed" && r.entryId ? [r.entryId] : [])))];
    const [actors, blocks, pending, entries, dark] = await Promise.all([
      ids.length ? db.rowParticipant.findMany({ where: { id: { in: ids } }, select: { id: true, rowerNumber: true, displayName: true } }) : Promise.resolve([]),
      db.rowBlock.findMany({ where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] }, select: { blockerId: true, blockedId: true } }),
      db.rowFollow.findMany({ where: { followeeId: me.id, status: "pending" }, select: { followerId: true } }),
      rowedIds.length ? db.rowEntry.findMany({ where: { id: { in: rowedIds } }, select: { id: true, participantId: true, meters: true, seconds: true } }) : Promise.resolve([]),
      rowedIds.length ? numbersHidden() : Promise.resolve(true),
    ]);
    const rowOf = new Map(entries.map((e) => [e.id, e]));
    const by = new Map(actors.map((a) => [a.id, a]));
    const faces = await avatarsFor(ids);
    const cut = new Set(blocks.map((b) => (b.blockerId === me.id ? b.blockedId : b.blockerId)));
    const asking = new Set(pending.map((p) => p.followerId));

    const items = rows.flatMap((r) => {
      const a = r.actorId ? by.get(r.actorId) : undefined;
      if (!a || cut.has(a.id)) return [];
      let text = "";
      if (r.kind === "follow") text = "started following you.";
      else if (r.kind === "request") text = "asked to follow you.";
      else if (r.kind === "accepted") text = "accepted your follow request.";
      else if (r.kind === "rowed") {
        /* The row's numbers, when it is still that rower's and nothing is
         * hiding them. */
        const e = r.entryId ? rowOf.get(r.entryId) : undefined;
        text = !dark && e && e.participantId === a.id ? rowedWords(e.meters, e.seconds) : "logged a row.";
      }
      else if (r.kind === "liked") text = "liked your row.";
      else if (r.kind === "commented") text = "commented on your row.";
      else if (r.kind === "replied") text = "replied to your comment.";
      else if (r.kind === "mentioned") text = "mentioned you in a comment.";
      else if (r.kind === "likedComment") text = "liked your comment.";
      else if (r.kind === "passed") {
        const others = r.actors.filter((id) => id !== a.id && by.has(id) && !cut.has(id)).length;
        text = others === 0 ? "passed you on the board." : `and ${others} other${others === 1 ? "" : "s"} you follow passed you on the board.`;
      } else return [];
      return [
        {
          id: r.id,
          kind: r.kind,
          rowerNumber: a.rowerNumber,
          numStr: fmtRowerNumber(a.rowerNumber),
          name: a.displayName,
          avatar: faces.get(a.id) ?? null,
          text,
          /* Where a tap leads: the row, the board, or the rower. */
          entryId: r.kind === "rowed" || r.kind === "liked" || r.kind === "commented" || r.kind === "replied" || r.kind === "mentioned" || r.kind === "likedComment" ? r.entryId : null,
          /* A request still waiting carries its own two buttons. */
          open: r.kind === "request" && asking.has(a.id),
          unread: r.readAt === null,
          absIso: r.createdAt.toISOString(),
          ...stampParts(r.createdAt),
        },
      ];
    });
    return yes({ items, unread: items.filter((i) => i.unread).length });
  } catch (err) {
    console.error("row app: failed to read notifications", err);
    return no("Your notifications could not be read just now.", 500);
  }
}

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  try {
    const body = (await req.json().catch(() => null)) as { read?: unknown } | null;
    if (body?.read !== true) return no("Nothing to change.", 400);
    await db.rowNotification.updateMany({ where: { participantId: who.me.id, readAt: null }, data: { readAt: new Date() } });
    return yes();
  } catch (err) {
    console.error("row app: failed to mark notifications read", err);
    return no("That did not save.", 500);
  }
}
