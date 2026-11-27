import { NextResponse } from "next/server";
import { forcedBlackout } from "@/lib/blackoutRules";
import { nowMs } from "@/lib/row100k";
import { editionOf, monthName, monthOf, monthsThrough, parsePeriod } from "@/lib/rowPeriod";
import { rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";
import { communityPosterData, rowerPosterData } from "@/app/row100k/poster/data";
import { isFormatKey, FORMATS } from "@/app/row100k/poster/formats";
import { m2dPosterData } from "@/app/row100k/poster/m2dData";
import { APP_FORMAT_KEYS, posterColors, renderPosterPng, sheetOf } from "@/app/row100k/poster/serverPoster";

/* A POSTER, AS A PNG, FOR THE PHONE APP (owner, 2026-11-26: "need to bring
 * over the poster utility into the app ... We want to bring the poster for
 * the individual rower. We want to bring the poster for Rowtember in
 * general. We want to be able to select time frames. We want to be able to
 * change the color. We want different aspect ratios. We don't need race
 * day or top 10 at the moment. The other poster I need is one for M2D.").
 * The site's own poster engine, drawn on the server (poster/serverPoster.ts).
 *
 *   ?options=1          what the app's Posters page offers: the subjects,
 *                       the time frames, the colours and the formats
 *   ?subject=           rower (default) | rowtember | m2d
 *   &m=                 YYYY-MM | all — the time frame; this month when
 *                       absent. The M2D sheet is its own window, Nov 26 -
 *                       Dec 24, and takes none.
 *   &color=             a key from options.colors; the site's cream first
 *   &format=            story (default) | post | square | 24x36 | 18x24 | 16x20
 *   &full=1             a wall size at its print resolution (150 ppi); a
 *                       phone frame is 1080 px wide either way
 *   &num=               an admin's pick of rower; anyone else gets their own
 *   &mine=0             the M2D sheet without the rower's own line
 *
 * Signed in only, rate limited like the stickers. Every board on a sheet is
 * the PUBLIC one (poster/data.ts), so a rower the blackout hides gets
 * blocks on their own poster exactly as the site's studio draws it. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

function parseNum(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const viewer = await resolveViewer();
    if (!viewer.actor) return no("Sign in first.", 401);
    const at = nowMs();
    const colors = await posterColors();
    const mineNum = viewer.me?.rowerNumber ?? null;

    if (q.get("options") === "1") {
      /* The ROWTEMBER sheet's chip wears the month's own name when it has
       * one (rowPeriod.ts EDITIONS: ROWVEMBER in November), ROWTEMBER
       * otherwise. */
      const now = monthOf(at);
      const periods = [...monthsThrough(at).map((m) => ({ key: m.key, label: `${monthName(m)} ${m.year}` })).reverse(), { key: "all", label: "All time" }];
      return NextResponse.json(
        {
          ok: true,
          me: mineNum,
          community: (editionOf(now) ?? "Rowtember").toUpperCase(),
          subjects: [
            ...(mineNum ? [{ key: "rower", label: "You" }] : []),
            { key: "rowtember", label: (editionOf(now) ?? "Rowtember").toUpperCase() },
            { key: "m2d", label: "M2D" },
          ],
          periods,
          current: now.key,
          colors: colors.map((c) => ({ key: c.key, label: c.label, swatch: c.swatch, ground: c.ground })),
          formats: APP_FORMAT_KEYS.map((k) => ({ key: k, label: FORMATS[k].label, kind: FORMATS[k].kind, w: FORMATS[k].w, h: FORMATS[k].h })),
        },
        { headers: NO_STORE },
      );
    }

    const full = q.get("full") === "1";
    const rl = await rateLimit({ key: `row-app-poster${full ? "-full" : ""}:${viewer.actor.photographerId}`, limit: full ? 30 : 180, windowSec: 3600 });
    if (!rl.ok) return no("Too many posters at once. Try again in a bit.", 429);

    const subject = q.get("subject") ?? "rower";
    const formatRaw = q.get("format") ?? "story";
    if (!isFormatKey(formatRaw)) return no("No such size.", 400);
    const color = colors.find((c) => c.key === (q.get("color") ?? "cream")) ?? colors[0];
    const force = forcedBlackout(viewer.preview);
    const period = parsePeriod(q.get("m") ?? undefined, at);

    let sheet;
    let stem: string;
    if (subject === "rowtember") {
      sheet = sheetOf(await communityPosterData({ forceBlackout: force, period }));
      stem = `rowtember-${period.key}`;
    } else if (subject === "m2d") {
      const num = q.get("mine") === "0" ? null : viewer.isAdmin ? (parseNum(q.get("num")) ?? mineNum) : mineNum;
      sheet = sheetOf(await m2dPosterData(num, force));
      stem = num ? `m2d-${String(num).padStart(3, "0")}` : "m2d";
    } else if (subject === "rower") {
      const asked = parseNum(q.get("num"));
      const num = viewer.isAdmin && asked ? asked : mineNum;
      if (!num) return no("Join first, and your poster is here.", 404);
      const data = await rowerPosterData(num, { forceBlackout: force, period });
      if (!data) return no("That poster could not be read just now.", 404);
      sheet = sheetOf(data);
      stem = `rower-${String(num).padStart(3, "0")}-${period.key}`;
    } else return no("No such poster.", 400);

    const { png } = await renderPosterPng(sheet, formatRaw, color, full);
    const name = `${stem}-${FORMATS[formatRaw].stem}${color.key === "cream" ? "" : `-${color.key}`}.png`;
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("row app: failed to draw a poster", err);
    return no("That poster could not be drawn just now.", 500);
  }
}
