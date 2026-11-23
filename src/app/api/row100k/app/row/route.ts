import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { digitCount } from "@/lib/blackoutRules";
import { CHALLENGE, fmtDay, fmtDuration, fmtMeters, fmtRowerNumber, fmtSplit, plainTitle } from "@/lib/row100k";
import { maskedIds, previewBlackout, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { boardView } from "@/app/row100k/boardData";
import { stampParts } from "@/app/row100k/feed/view";
import { avatarsFor, relation } from "@/lib/rowSocial";
import { resolvePhotoMedia } from "@/app/row100k/photoUrls";
import { asRower } from "../social";

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
      select: { id: true, participantId: true, day: true, meters: true, seconds: true, title: true, caption: true, photos: true, createdAt: true, participant: { select: { displayName: true, rowerNumber: true } } },
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

    /* THIS ROW AGAINST THE ROWER'S USUAL (owner, 2026-11-22: "there's got
     * to be some more details here, even when it didn't come from the erg
     * ... like this row's performance compared to how you normally
     * perform"). From the rower's own rows and nothing else: their average
     * split and length, and where this row's time stands among their rows
     * of the same distance. Never for a hidden row. */
    let usual: { rows: number; avgPace: number; avgMeters: number; same: number; place: number; best: number } | null = null;
    if (!masked && e.meters > 0 && e.seconds > 0) {
      try {
        const all = await db.rowEntry.findMany({ where: { challenge: CHALLENGE, participantId: e.participantId, meters: { gt: 0 }, seconds: { gt: 0 } }, select: { meters: true, seconds: true } });
        if (all.length >= 3) {
          const m = all.reduce((n, r) => n + r.meters, 0);
          const s = all.reduce((n, r) => n + r.seconds, 0);
          const same = all.filter((r) => Math.abs(r.meters - e.meters) <= 50).map((r) => r.seconds / r.meters);
          const mine0 = e.seconds / e.meters;
          usual = { rows: all.length, avgPace: (s / m) * 500, avgMeters: m / all.length, same: same.length, place: same.filter((p) => p < mine0).length + 1, best: Math.min(...same) * e.meters };
        }
      } catch (err) {
        console.error("row app: failed to read a rower's usual", err);
      }
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
          caption: e.caption ?? "",
          meters: masked ? null : e.meters,
          seconds: masked ? null : e.seconds,
          metersStr: masked ? "" : fmtMeters(e.meters),
          durationStr: masked ? "" : fmtDuration(e.seconds),
          splitStr: fmtSplit(e.meters, e.seconds),
          photos: masked ? [] : await resolvePhotoMedia(e.photos),
          /* The storage keys of the two photos, for the rower's own EDIT ROW:
           * a photo that is kept goes back to the site's edit by its key. */
          photoKeys: mine ? e.photos : undefined,
          masked,
          digits: masked ? digitCount(e.meters) : undefined,
          elite,
          mine,
          /* For the three dots on the row: how the viewer stands to its rower. */
          rel: { following: rel.following, bell: rel.bell, muted: rel.muted },
          avatar: (await avatarsFor([e.participantId])).get(e.participantId) ?? null,
          usual,
          likes: await db.rowLike.count({ where: { entryId: e.id } }).catch(() => 0),
          liked: viewer.myParticipantId ? !!(await db.rowLike.findUnique({ where: { entryId_participantId: { entryId: e.id, participantId: viewer.myParticipantId } }, select: { id: true } }).catch(() => null)) : false,
          comments: await db.rowComment.count({ where: { entryId: e.id, deletedAt: null } }).catch(() => 0),
          canShare: mine || viewer.isAdmin,
          /* The owner's tools on any row: take it down, or one photo of it. */
          admin: viewer.isAdmin,
          /* A reel can be filmed: a recording is tied to the row, it is the
           * viewer's to film, and the erg gate is open to them (admins only
           * in production while the erg is in development). */
          canReel: !!t && full,
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

/* THE CAPTION (owner, 2026-11-22: "allow users to submit ... a caption
 * whenever you post. So with the images can come a caption, and then we
 * can display that caption"). POST { id, caption }: the row's own rower
 * writes it, changes it, or clears it with an empty one. Sent by the app
 * straight after the row is logged, so the site's log route stays as it
 * is. Wears the app's gate (social.ts).
 *
 * AND WHICH PHOTO IS FIRST (owner, 2026-11-23, of SWAP PHOTO in the menu a
 * held row opens: "the reason why I want to swap photos is because I want
 * to swap which one shows up first ... it should be swap which one shows
 * to other users. And I shouldn't be able to swap other people's photos.
 * Just me"). POST { id, swap: true }: the row's own rower turns its two
 * photos about, for everybody and for good; the answer is the pair as it
 * now stands. Nobody else may, the owner of the site included: this is the
 * rower's own choice of face, not moderation. */
export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  try {
    const body = (await req.json().catch(() => null)) as { id?: unknown; caption?: unknown; swap?: unknown } | null;
    const id = typeof body?.id === "string" ? body.id : "";
    if (body?.swap === true) {
      const row = await db.rowEntry.findFirst({ where: { id, challenge: CHALLENGE }, select: { id: true, participantId: true, photos: true } });
      if (!row) return no("No such row.", 404);
      if (row.participantId !== who.me.id) return no("That row is not yours.", 403);
      if (row.photos.length < 2) return no("This row has one photo.", 400);
      const photos = [row.photos[1], row.photos[0], ...row.photos.slice(2)];
      await db.rowEntry.update({ where: { id: row.id }, data: { photos } });
      revalidateTag("row100k-boards");
      return NextResponse.json({ ok: true, photos: await resolvePhotoMedia(photos) }, { headers: NO_STORE });
    }
    const caption = typeof body?.caption === "string" ? body.caption.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 500) : null;
    if (caption === null) return no("Nothing to save.", 400);
    const e = await db.rowEntry.findFirst({ where: { id, challenge: CHALLENGE }, select: { id: true, participantId: true } });
    if (!e) return no("No such row.", 404);
    if (e.participantId !== who.me.id) return no("That row is not yours.", 403);
    await db.rowEntry.update({ where: { id: e.id }, data: { caption: caption || null } });
    return NextResponse.json({ ok: true, caption }, { headers: NO_STORE });
  } catch (err) {
    console.error("row app: failed to save a caption", err);
    return no("That did not save. Try again.", 500);
  }
}
