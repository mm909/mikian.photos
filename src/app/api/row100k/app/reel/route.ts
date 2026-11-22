import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { monthFromKey } from "@/lib/rowPeriod";
import { validateTelemetryDoc } from "@/lib/pm5/session";
import { ergAppDenial, ergViewer } from "@/app/erg/gate";
import type { BgId, ClipId, ScreenId, UnitId } from "@/app/erg/reel/paint";
import { NoEncoder, REEL_CLIPS, REEL_FORMATS, REEL_GROUNDS, REEL_LENGTHS, renderReelMp4, renderReelStill, renderReelStrip, type ReelFormat } from "@/app/erg/reel/serverReel";

/* ONE REEL OVERLAY for the phone app (2026-11-20): a row's numbers as a
 * short video to lay over the rower's own footage in an editing app. GET
 *   ?row=<entry id>  the logged row; it must have a recording tied to it
 *   &clip=meters|clock|pace|stack|stroke|monitor
 *   &bg=green|blue|black|ink|cream     the ground to key out or blend
 *   &format=story|post|square  &len=5|10|15  &unit=pace|watts|cal
 *   &screen=all|large|force|bars       (the monitor clip's screen)
 *   &still=1   the last frame as a PNG, for a preview, instead of the film
 *   &strip=1   the five-second version as fifty small frames on one JPEG
 *              (serverReel.ts REEL_STRIP), for a preview that moves
 *
 * The frames are the site's own reel painting (erg/reel/paint.ts), filmed
 * on the server (erg/reel/serverReel.ts).
 *
 * Any signed-in rower, since the app opened on 2026-11-21 (app/erg/gate.ts,
 * ergAppDenial). The row must be the caller's own; an admin may film
 * anybody's. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
const oneOf = <T extends string>(v: string | null, list: readonly T[], d: T): T => (list as readonly string[]).includes(v ?? "") ? (v as T) : d;

export async function GET(req: Request) {
  const viewer = await ergViewer();
  const denied = ergAppDenial(viewer);
  if (denied) return no(denied.error, denied.status);
  try {
    const q = new URL(req.url).searchParams;
    const strip = q.get("strip") === "1";
    const still = strip || q.get("still") === "1";
    const rl = await rateLimit({ key: `row-app-reel:${viewer.userId}:${still ? "still" : "film"}`, limit: still ? 300 : 40, windowSec: 3600 });
    if (!rl.ok) return no("Too many reels at once. Try again in a bit.", 429);

    const entry = await db.rowEntry.findFirst({
      where: { id: q.get("row") ?? "", challenge: CHALLENGE },
      select: { id: true, day: true, participantId: true, participant: { select: { userId: true, rowerNumber: true } } },
    });
    if (!entry) return no("No such row.", 404);
    if (!viewer.isAdmin && entry.participant.userId !== viewer.userId) return no("That row is not yours.", 404);
    const t = await db.rowTelemetry.findFirst({ where: { entryId: entry.id }, select: { data: true } });
    if (!t) return no("That row has no recording behind it, so there is nothing to film.", 404);
    const doc = validateTelemetryDoc(t.data);
    if (typeof doc === "string") return no("That recording could not be read.", 500);

    /* The running total starts at every metre logged in the row's month
     * before the row's day, as the site's reel page starts it. */
    const month = monthFromKey(entry.day.slice(0, 7));
    const before = month
      ? await db.rowEntry.aggregate({ where: { challenge: CHALLENGE, participantId: entry.participantId, day: { gte: month.firstDay, lt: entry.day } }, _sum: { meters: true } })
      : null;
    /* And the timed ones among them, for the month's own average pace. */
    const timed = month
      ? await db.rowEntry.aggregate({ where: { challenge: CHALLENGE, participantId: entry.participantId, day: { gte: month.firstDay, lt: entry.day }, seconds: { gt: 0 } }, _sum: { meters: true, seconds: true } })
      : null;

    const format = oneOf<ReelFormat>(q.get("format"), Object.keys(REEL_FORMATS) as ReelFormat[], "story");
    const len = Number(q.get("len"));
    const ask = {
      doc,
      clip: oneOf<ClipId>(q.get("clip"), REEL_CLIPS, "meters"),
      bg: oneOf<BgId>(q.get("bg"), REEL_GROUNDS, "green"),
      unit: oneOf<UnitId>(q.get("unit"), ["pace", "watts", "cal"], "pace"),
      screen: oneOf<ScreenId>(q.get("screen"), ["all", "large", "force", "bars"], "all"),
      format,
      lengthS: (REEL_LENGTHS as readonly number[]).includes(len) ? len : 10,
      startTotal: before?._sum.meters ?? 0,
      startPaceM: timed?._sum.meters ?? 0,
      startPaceS: timed?._sum.seconds ?? 0,
      /* The month in capitals. Its plain name: months wear their normal names. */
      label: (month ? month.label.split(" ")[0] : "Month").toUpperCase(),
    };
    const name = `row-${entry.participant.rowerNumber}-${entry.day}-${ask.clip}`;

    if (strip) {
      const jpg = renderReelStrip(ask);
      return new NextResponse(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" } });
    }
    if (still) {
      const png = renderReelStill(ask);
      return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" } });
    }
    const mp4 = await renderReelMp4(ask);
    return new NextResponse(new Uint8Array(mp4), {
      headers: { "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="${name}.mp4"`, "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    if (err instanceof NoEncoder) return no(err.message, 503);
    console.error("row app: failed to film a reel", err);
    return no("That reel could not be filmed just now.", 500);
  }
}
