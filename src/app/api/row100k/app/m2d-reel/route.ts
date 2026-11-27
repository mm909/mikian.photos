import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";
import type { BgId } from "@/app/erg/reel/paint";
import { NoEncoder, REEL_FORMATS, REEL_GROUNDS, REEL_LENGTHS, paintedGif, paintedMp4, paintedStill, paintedStrip, type ReelFormat } from "@/app/erg/reel/serverReel";
import { both, m2dTotals } from "@/app/row100k/m2d";
import { M2D_CLIPS, m2dPainter, type M2dClip } from "@/app/row100k/m2dReel";

/* THE M2D COUNT-UP REELS for the phone app (2026-11-26; owner: "I
 * definitely need an animated meters rolling up for my total meters rowed
 * during M2D ... an animation for a reel for animating the money and meters
 * going up for M2D"). The painting is row100k/m2dReel.ts; the filming is
 * the row reel's (erg/reel/serverReel.ts). GET
 *   ?clip=me-m|me-both|all-m|all-both
 *   &bg=green|blue|black|ink|cream  &len=1|5|10|15  &format=phone|story|...
 *   &still=1  the last frame as a PNG     &strip=1  the five-second preview
 *   &gif=1    no ground at all, an animated GIF cropped to the drawing
 *
 * Any signed-in rower. The `me` clips count the caller's own M2D meters
 * (0 before they have any); the `all` clips everyone's. No address. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
const oneOf = <T extends string>(v: string | null, list: readonly T[], d: T): T => ((list as readonly string[]).includes(v ?? "") ? (v as T) : d);

/* The totals behind every clip, read once a minute: a reel tray asks for
 * four stills and four strips at once. Per server instance. */
let kept: { at: number; read: ReturnType<typeof m2dTotals> } | null = null;
function totals() {
  if (!kept || Date.now() - kept.at > 60_000) {
    const read = m2dTotals();
    kept = { at: Date.now(), read };
    read.catch(() => (kept = null));
  }
  return kept.read;
}

export async function GET(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return no("Sign in first.", 401);
  try {
    const q = new URL(req.url).searchParams;
    const strip = q.get("strip") === "1";
    const still = strip || q.get("still") === "1";
    const rl = await rateLimit({ key: `row-app-m2d-reel:${viewer.actor.photographerId}:${still ? "still" : "film"}`, limit: still ? 300 : 40, windowSec: 3600 });
    if (!rl.ok) return no("Too many reels at once. Try again in a bit.", 429);

    const clip = oneOf<M2dClip>(q.get("clip"), M2D_CLIPS, "me-m");
    const bg = oneOf<BgId>(q.get("bg"), REEL_GROUNDS, "green");
    const format = oneOf<ReelFormat>(q.get("format"), Object.keys(REEL_FORMATS) as ReelFormat[], "story");
    const len = Number(q.get("len"));
    const lengthS = (REEL_LENGTHS as readonly number[]).includes(len) ? len : 10;

    const { totals: t, by, perKm } = await totals();
    const mineM = viewer.myParticipantId ? (by.get(viewer.myParticipantId) ?? 0) : 0;
    const mine = clip.startsWith("me");
    const paint = m2dPainter({ clip, meters: mine ? mineM : t.meters, dollars: mine ? both(mineM, perKm) : t.total, perKm });
    const name = `m2d-${clip}-${bg}-${lengthS}s`;

    if (strip) return new NextResponse(new Uint8Array(paintedStrip(paint, bg)), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" } });
    if (still) return new NextResponse(new Uint8Array(paintedStill(paint, bg, format, lengthS)), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" } });
    if (q.get("gif") === "1") {
      const gif = await paintedGif(paint, lengthS);
      return new NextResponse(new Uint8Array(gif), { headers: { "Content-Type": "image/gif", "Content-Disposition": `attachment; filename="${name}.gif"`, "Cache-Control": "private, max-age=60" } });
    }
    const mp4 = await paintedMp4(paint, bg, format, lengthS);
    return new NextResponse(new Uint8Array(mp4), { headers: { "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="${name}.mp4"`, "Cache-Control": "private, max-age=60" } });
  } catch (err) {
    if (err instanceof NoEncoder) return no(err.message, 503);
    console.error("row app: failed to film an M2D reel", err);
    return no("That reel could not be filmed just now.", 500);
  }
}
