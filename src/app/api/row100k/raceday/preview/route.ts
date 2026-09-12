import { NextResponse } from "next/server";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { resolvedRace } from "@/app/row100k/racedaySettings";
import { waveEmail } from "@/app/row100k/raceEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* THE WAVE NOTE, on a page — the shirt mails have had one since they were
 * built (api/row100k/shirt/preview) and this one now carries two pictures,
 * which is the one thing nobody can review in their head. A made-up rower,
 * nothing sent, no row touched.
 *
 * ADMIN ONLY in production, open in local dev: the gate the dev pages wear
 * (dev/stats, dev/raceday-results). Deliberately NOT raceOpenFor — that
 * switch went public on 09-12 and it opens the sign-up page to the world;
 * this is the console's mail and it stays the owner's.
 *
 * THE BASE URL IS THE REQUEST'S OWN ORIGIN, and that is not laziness — it
 * is the only way this page shows you your change. .env.local sets
 * NEXT_PUBLIC_BASE_URL to https://mikianmusser.com even in local dev, so a
 * preview that let raceEmail fall through to the env would quietly load
 * PRODUCTION's copies of both pictures and tell you nothing about the files
 * on this branch. The real send keeps the env, which is what makes a note
 * mailed from anywhere point at the canonical host.
 *
 *   ?wave=N          default 3. Not 1: wave 1 arrives at 6:00 PM, the same
 *                    minute the doors open, so a broken arrival time would
 *                    hide behind a coincidence. Wave 3 goes off at 7:15 and
 *                    is due in the door at 7:00.
 *   ?signed=1        a rower whose waiver is already signed — drops the
 *                    ONE THING FIRST block, which is the shorter mail.
 *   ?text=1          the plain twin, as text/plain.
 *   ?images=blocked  srcs pointed at a path that serves nothing, so the
 *                    browser genuinely draws the alt text. This is what
 *                    Gmail shows a stranger by default and it is the state
 *                    this mail has to read completely in — look at it.
 *   ?images=off      no img tags at all, which is what a missing or
 *                    garbled base URL renders. */

const SAMPLE = { name: "Sasha Vance", rowerNumber: 12 };

export async function GET(req: Request) {
  const actor = await getEffectiveActor();
  const isAdmin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  if (process.env.NODE_ENV === "production" && !isAdmin) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const waveRaw = url.searchParams.get("wave");
  const wave = waveRaw && /^[0-9]+$/.test(waveRaw) ? Math.max(1, Math.min(20, Number(waveRaw))) : 3;
  const images = url.searchParams.get("images");
  /* "none" is not a URL, so assetUrl returns null and no img is written —
   * the same code path a garbled env var takes. */
  const baseUrl =
    images === "off" ? "none" : images === "blocked" ? `${url.origin}/__blocked` : url.origin;

  /* The race as the CONSOLE has it, not as the code ships it: the owner can
   * move the first wave an hour before he mails these, and a preview of the
   * wrong clock is worse than no preview. */
  const race = await resolvedRace();
  const mail = waveEmail({
    race,
    ...SAMPLE,
    wave,
    waiverSigned: url.searchParams.get("signed") === "1",
    baseUrl,
  });

  if (url.searchParams.get("text") === "1") {
    return new NextResponse(`${mail.subject}\n\n${mail.text}`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${mail.subject}</title></head><body style="margin:0;background:#F4F3EE">${mail.html}</body></html>`;
  return new NextResponse(page, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}
