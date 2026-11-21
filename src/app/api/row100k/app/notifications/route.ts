import { db } from "@/lib/db";
import { fmtRowerNumber } from "@/lib/row100k";
import { stampParts } from "@/app/row100k/feed/view";
import { avatarsFor } from "@/lib/rowSocial";
import { asRower, no, yes } from "../social";

/* THE NOTIFICATION CENTRE, for the phone app (2026-11-21; owner,
 * 2026-11-20: "a notification centre lists them all"). GET answers the
 * rower's lines, newest first, each already a sentence, with who it is
 * about and where a tap should lead; POST { read: true } marks them read.
 *
 * A line whose rower has since left, or been blocked, is dropped here and
 * not shown as a blank. No metres in any sentence (lib/rowNotify.ts). */
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
    const [actors, blocks, pending] = await Promise.all([
      ids.length ? db.rowParticipant.findMany({ where: { id: { in: ids } }, select: { id: true, rowerNumber: true, displayName: true } }) : Promise.resolve([]),
      db.rowBlock.findMany({ where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] }, select: { blockerId: true, blockedId: true } }),
      db.rowFollow.findMany({ where: { followeeId: me.id, status: "pending" }, select: { followerId: true } }),
    ]);
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
      else if (r.kind === "rowed") text = "logged a row.";
      else if (r.kind === "liked") text = "liked your row.";
      else if (r.kind === "commented") text = "commented on your row.";
      else if (r.kind === "replied") text = "replied to your comment.";
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
          entryId: r.kind === "rowed" || r.kind === "liked" || r.kind === "commented" || r.kind === "replied" ? r.entryId : null,
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
