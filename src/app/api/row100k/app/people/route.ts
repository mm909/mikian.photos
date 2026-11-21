import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { maskedIds, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { boardView } from "@/app/row100k/boardData";
import { no, people, rowerByNum, yes } from "../social";

/* PEOPLE, for the phone app (2026-11-21). One route, four lists:
 *
 *   ?q=text                 SEARCH (owner, 2026-11-20: "search function"):
 *                           by name, by Instagram handle, by rower number.
 *                           No text: the whole roster in number order.
 *   ?num=7&list=followers   who follows rower 7   (owner: "anyone can see
 *   ?num=7&list=following   who rower 7 follows    who a rower follows and
 *                                                  who follows them")
 *   ?list=requests          the viewer's own unanswered follow requests
 *   ?list=blocked           the rowers the viewer has blocked
 *   ?list=muted             the rowers the viewer has muted
 *
 * Every line says how the viewer stands to that rower. A private rower is
 * found like anybody else: it is their rows that are private, not their
 * name.
 *
 * A SEARCH line also carries the rower's lifetime metres (owner,
 * 2026-11-21: "instead of follow button, it should be lifetime meters ...
 * rower 01, first name, last name, meters, Instagram handle. That's it").
 * Not for a rower lights out is hiding from this viewer: their all-time
 * total less last month's would be this month's. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 80;
const PICK = { id: true, rowerNumber: true, displayName: true, instagram: true } as const;

/* Rowers by id, in the order of the ids. */
async function inOrder(ids: string[]) {
  const rows = await db.rowParticipant.findMany({ where: { id: { in: ids } }, select: PICK });
  const by = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = by.get(id);
    return r ? [r] : [];
  });
}

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const viewer = await resolveViewer();
    const meId = viewer.myParticipantId;
    const list = q.get("list");

    if (list === "requests" || list === "blocked" || list === "muted") {
      if (!meId) return no("Sign in first.", 401);
      const ids =
        list === "requests"
          ? (await db.rowFollow.findMany({ where: { followeeId: meId, status: "pending" }, orderBy: { createdAt: "desc" }, select: { followerId: true } })).map((f) => f.followerId)
          : list === "muted"
            ? (await db.rowMute.findMany({ where: { muterId: meId }, orderBy: { createdAt: "desc" }, select: { mutedId: true } })).map((m) => m.mutedId)
            : (await db.rowBlock.findMany({ where: { blockerId: meId }, orderBy: { createdAt: "desc" }, select: { blockedId: true } })).map((b) => b.blockedId);
      return yes({ people: await people(meId, await inOrder(ids)) });
    }

    if (list === "followers" || list === "following") {
      const subject = await rowerByNum(q.get("num"));
      if (!subject) return no("No such rower.", 404);
      const ids =
        list === "followers"
          ? (await db.rowFollow.findMany({ where: { followeeId: subject.id, status: "accepted" }, orderBy: { acceptedAt: "desc" }, select: { followerId: true } })).map((f) => f.followerId)
          : (await db.rowFollow.findMany({ where: { followerId: subject.id, status: "accepted" }, orderBy: { acceptedAt: "desc" }, select: { followeeId: true } })).map((f) => f.followeeId);
      return yes({ people: await people(meId, await inOrder(ids)) });
    }

    /* SEARCH. Somebody who blocked the viewer is not found by them. */
    const text = (q.get("q") ?? "").trim().replace(/^@/, "").slice(0, 60);
    const digits = /^\d{1,6}$/.test(text) ? Number(text) : null;
    const hide = meId ? (await db.rowBlock.findMany({ where: { blockedId: meId }, select: { blockerId: true } })).map((b) => b.blockerId) : [];

    /* NOTHING TYPED: the ten rowers with the most lifetime meters, most
     * first (owner, 2026-11-21: "when I click the search bar, let's just
     * preload the first 10 names, and ... put them in order of most of
     * lifetime meters rowed"). A rower lights out is hiding is left out of
     * this list: where they sit in it would give their meters away. */
    if (!text) {
      let masked = new Set<string>();
      try {
        masked = maskedIds((await boardView(viewOpts(viewer))).boards);
      } catch (err) {
        console.error("row app: board unreadable for the search's opening list", err);
        return yes({ people: [], more: false });
      }
      const top = await db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE, participantId: { notIn: [...hide, ...masked] } }, _sum: { meters: true }, orderBy: { _sum: { meters: "desc" } }, take: 10 });
      const rowers = await inOrder(top.map((t) => t.participantId));
      return yes({ people: await people(meId, rowers, new Map(top.map((t) => [t.participantId, t._sum.meters ?? 0]))), more: true, top: true });
    }
    const rows = await db.rowParticipant.findMany({
      where: {
        challenge: CHALLENGE,
        ...(hide.length ? { id: { notIn: hide } } : {}),
        ...(text
          ? {
              OR: [
                { displayName: { contains: text, mode: "insensitive" as const } },
                { instagram: { contains: text, mode: "insensitive" as const } },
                ...(digits !== null ? [{ rowerNumber: digits }] : []),
              ],
            }
          : {}),
      },
      orderBy: { rowerNumber: "asc" },
      take: MAX + 1,
      select: PICK,
    });
    /* A number typed exactly leads; then names that START with the text. */
    const lower = text.toLowerCase();
    const rank = (r: { rowerNumber: number; displayName: string }) => (digits !== null && r.rowerNumber === digits ? 0 : lower && r.displayName.toLowerCase().startsWith(lower) ? 1 : 2);
    const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || a.rowerNumber - b.rowerNumber);
    const shown = sorted.slice(0, MAX);
    const meters = new Map<string, number | null>();
    try {
      const sums = await db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE, participantId: { in: shown.map((r) => r.id) } }, _sum: { meters: true } });
      const hidden = maskedIds((await boardView(viewOpts(viewer))).boards);
      for (const r of shown) meters.set(r.id, 0);
      for (const s of sums) meters.set(s.participantId, s._sum.meters ?? 0);
      for (const id of hidden) if (meters.has(id)) meters.set(id, null);
    } catch (err) {
      /* No board, no way to know who is hidden: no metres for anybody. */
      console.error("row app: lifetime metres unreadable for search", err);
      meters.clear();
    }
    return yes({ people: await people(meId, shown, meters), more: rows.length > MAX });
  } catch (err) {
    console.error("row app: failed to list people", err);
    return no("That list could not be read just now.", 500);
  }
}
