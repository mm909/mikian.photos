import { rowedAtFor } from "@/lib/rowedAt";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { CHALLENGE, fmtDuration, fmtMeters, fmtRowerNumber, fmtSplit, plainTitle } from "@/lib/row100k";
import { maskedIds, previewBlackout, viewOpts } from "@/lib/row100kViewer";
import { avatarsFor, hiddenRowers, mutedIds } from "@/lib/rowSocial";
import { boardView } from "@/app/row100k/boardData";
import { resolvePhotoMedia } from "@/app/row100k/photoUrls";
import { asRower, no, yes } from "../social";

/* THE STORY RECAP atop the phone app's feed (owner, 2026-11-23: "a story
 * recap. I want anyone who has rowed in the last 24 hours to show up kind
 * of like a story at the top of the feed. And when we click it, something
 * similar to stories happens ... we'll just show their first photo and some
 * text about length and time and who did it"). Not `stories` beside this
 * file: that one is the FAQs' answers.
 *
 * Every rower with a row logged in the last 24 hours that this viewer's
 * feed would show them, the rower who logged last first and the viewer
 * themselves ahead of everybody when they rowed. Each with their rows of
 * those 24 hours, the oldest first, as a story plays them.
 *
 * WHO IS LEFT OUT is the feed's own rule (row100k/feed/feedData.ts): a
 * private rower who has not accepted the viewer, anybody on either side of
 * a block (rowSocial.hiddenRowers), a rower the viewer muted; the Developer
 * account to everybody but itself (lib/db.ts). A row the lights-out hides
 * from this viewer (row100kViewer.maskedIds over boardView; the viewer's own
 * and an admin's view exempt) is LEFT OUT here, not drawn as blocks: a story
 * is the photo and the length and the time, and the lights-out hides all
 * three. With the board unreadable while a window is open, every row but
 * the viewer's own is left out, as the feed fails closed.
 *
 * Cheap: one read of the day's rows, the board (cached), the faces, and
 * only the FIRST photo of each row resolved. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
/* More rows than a day has ever had; the newest are kept. */
const TAKE = 400;

export async function GET() {
  try {
    const who = await asRower();
    if ("denied" in who) return who.denied;
    const { viewer } = who;
    const me = viewer.myParticipantId;
    const since = new Date(Date.now() - DAY_MS);

    const [hidden, muted] = await Promise.all([hiddenRowers(me), me ? mutedIds(me) : Promise.resolve([] as string[])]);
    const hide = [...new Set([...hidden, ...muted])];
    const entries = await db.rowEntry.findMany({
      where: { challenge: CHALLENGE, createdAt: { gte: since }, ...(hide.length ? { participantId: { notIn: hide } } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TAKE,
      select: { id: true, participantId: true, meters: true, seconds: true, title: true, photos: true, createdAt: true, participant: { select: { displayName: true, rowerNumber: true } } },
    });
    if (entries.length === 0) return yes({ rowers: [] });
    /* WHEN IT WAS ROWED, NOT SENT (owner, 2026-11-23: "if I had 2 rows
     * within 24 hours ... the story should be up for 24 hours ... those
     * rows should be there"): a monitor row is stamped with the time it was
     * rowed (lib/rowedAt.ts), as the feed is, and is up for a day from
     * then. A row is sent after it is rowed, so the day's rows are all among
     * those sent in the last day. */
    const rowedAt = await rowedAtFor(entries.map((e) => ({ id: e.id, createdAt: e.createdAt })));
    const when = (e: { id: string; createdAt: Date }) => rowedAt.get(e.id) ?? e.createdAt;
    const inDay = entries.filter((e) => when(e).getTime() >= since.getTime()).sort((a, b) => when(b).getTime() - when(a).getTime());

    /* Lights out, as the feed masks it. */
    let masked = new Set<string>();
    let hideAll = false;
    try {
      masked = maskedIds((await boardView(viewOpts(viewer))).boards);
    } catch (err) {
      console.error("row app: failed to read the board for the story recap's lights out", err);
      const blackout = previewBlackout(viewer, await activeBlackout());
      hideAll = blackout.active && !(viewer.isAdmin && !viewer.preview);
    }
    const shown = inDay.filter((e) => e.participantId === me || (!hideAll && !masked.has(e.participantId)));

    /* By rower, in the order their newest row came in (entries are newest
     * first), the viewer's own at the front. */
    const order: string[] = [];
    const byRower = new Map<string, typeof shown>();
    for (const e of shown) {
      let list = byRower.get(e.participantId);
      if (!list) {
        byRower.set(e.participantId, (list = []));
        order.push(e.participantId);
      }
      list.push(e);
    }
    if (me && byRower.has(me)) {
      order.splice(order.indexOf(me), 1);
      order.unshift(me);
    }

    const [faces, firsts] = await Promise.all([avatarsFor(order), Promise.all(shown.map((e) => (e.photos[0] ? resolvePhotoMedia([e.photos[0]]) : Promise.resolve([]))))]);
    const photoOf = new Map(shown.map((e, i) => [e.id, firsts[i][0] ?? null]));

    const rowers = order.map((pid) => {
      const rows = (byRower.get(pid) ?? []).slice().reverse();
      const p = rows[0].participant;
      return {
        rowerNumber: p.rowerNumber,
        numStr: fmtRowerNumber(p.rowerNumber),
        name: p.displayName,
        avatar: faces.get(pid) ?? null,
        me: pid === me,
        /* When their newest row came in. */
        latest: when(rows[rows.length - 1]).toISOString(),
        rows: rows.map((e) => ({
          id: e.id,
          meters: e.meters,
          seconds: e.seconds,
          metersStr: fmtMeters(e.meters),
          durationStr: fmtDuration(e.seconds),
          splitStr: e.meters > 0 && e.seconds > 0 ? fmtSplit(e.meters, e.seconds) : "",
          title: plainTitle(e.title),
          photo: photoOf.get(e.id) ?? null,
          absIso: when(e).toISOString(),
        })),
      };
    });
    return yes({ rowers });
  } catch (err) {
    console.error("row app: failed to build the story recap", err);
    return no("The recap could not be read just now.", 500);
  }
}
