import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { digitCount } from "@/lib/blackoutRules";
import { CHALLENGE, fmtDay, fmtDuration, fmtMeters, fmtRowerNumber, fmtSplit, plainTitle } from "@/lib/row100k";
import { maskedIds, previewBlackout, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { boardView } from "@/app/row100k/boardData";
import { stampParts } from "@/app/row100k/feed/view";
import { relation } from "@/lib/rowSocial";
import { resolvePhotoMedia } from "@/app/row100k/photoUrls";

/* ONE ROW, for its page in the phone app (2026-11-20; owner the same day:
 * "if you tap a row it can open up the commentary on that row, that post
 * row screen, and there you can use the shareables"). GET ?id=<entry id>.
 *
 * The row as the feed prints it, masked by the feed's own rule: a row by one
 * of the hidden elite carries no metres, no time and no photos for anybody
 * but the rower and an admin, only its split and the digit count. Beside it:
 * the monitor's averages when a recording is tied to the row, and, for the
 * rower themself (or an admin), the whole recording, which is what the
 * read is made from. `canShare` says whether a deck of stickers exists for
 * this viewer (/api/row100k/app/cards). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[a-z0-9]{1,40}$/i.test(id)) return no("No such row.", 404);
    const e = await db.rowEntry.findFirst({
      where: { id, challenge: CHALLENGE },
      select: { id: true, participantId: true, day: true, meters: true, seconds: true, title: true, photos: true, createdAt: true, participant: { select: { displayName: true, rowerNumber: true } } },
    });
    if (!e) return no("No such row.", 404);

    const viewer = await resolveViewer();
    const mine = viewer.myParticipantId === e.participantId;
    /* A private rower's row, or one across a block, is not there for this
     * viewer (lib/rowSocial.ts), however they came by its id. */
    const rel = await relation(viewer.myParticipantId, e.participantId);
    if (!mine && rel.access !== "open") return no("That row is private.", 404);
    let masked = false;
    let elite = false;
    try {
      const view = await boardView(viewOpts(viewer));
      elite = maskedIds(view.boards).has(e.participantId);
      masked = elite;
    } catch (err) {
      console.error("row app: board unreadable for one row's mask", err);
      const blackout = previewBlackout(viewer, await activeBlackout());
      masked = blackout.active && !mine && !(viewer.isAdmin && !viewer.preview);
    }

    const full = !masked && (mine || viewer.isAdmin);
    const t = masked
      ? null
      : await db.rowTelemetry
          .findFirst({ where: { entryId: e.id }, select: { id: true, device: true, simulated: true, avgWatts: true, avgSpm: true, avgHr: true, dragFactor: true, strokes: true, ...(full ? { data: true } : {}) } })
          .catch(() => null);

    return NextResponse.json(
      {
        ok: true,
        row: {
          id: e.id,
          day: e.day,
          rowedStr: fmtDay(e.day),
          ...stampParts(e.createdAt),
          rowerNumber: e.participant.rowerNumber,
          numStr: fmtRowerNumber(e.participant.rowerNumber),
          name: e.participant.displayName,
          title: plainTitle(e.title),
          meters: masked ? null : e.meters,
          seconds: masked ? null : e.seconds,
          metersStr: masked ? "" : fmtMeters(e.meters),
          durationStr: masked ? "" : fmtDuration(e.seconds),
          splitStr: fmtSplit(e.meters, e.seconds),
          photos: masked ? [] : await resolvePhotoMedia(e.photos),
          masked,
          digits: masked ? digitCount(e.meters) : undefined,
          elite,
          mine,
          /* For the three dots on the row: how the viewer stands to its rower. */
          rel: { following: rel.following, bell: rel.bell, muted: rel.muted },
          canShare: mine || viewer.isAdmin,
          /* The owner's tools on any row: take it down, or one photo of it. */
          admin: viewer.isAdmin,
          /* A reel can be filmed: a recording is tied to the row, it is the
           * viewer's to film, and the erg gate is open to them (admins only
           * in production while the erg is in development). */
          canReel: !!t && full && (process.env.NODE_ENV !== "production" || viewer.isAdmin),
          erg: t ? { id: t.id, device: t.device, simulated: t.simulated, watts: t.avgWatts, spm: t.avgSpm, hr: t.avgHr, drag: t.dragFactor, strokes: t.strokes } : null,
          doc: t && full && "data" in t ? t.data : null,
        },
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("row app: failed to read a row", err);
    return no("That row could not be read just now.", 500);
  }
}
