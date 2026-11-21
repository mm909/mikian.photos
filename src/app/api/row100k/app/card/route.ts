import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";
import { renderCardPng, serverCards, shareDataFor } from "@/app/row100k/share/serverCard";

/* ONE STICKER, AS A PNG (2026-11-20), for the phone app. GET ?id=<card id>
 * and optionally &row=<entry id>: the card the site's share dialog would
 * paint for that rower, drawn on the server by the same code
 * (share/serverCard.ts) on a transparent ground, ready to lay over a photo.
 *
 * Only a card on the viewer's own deck (/api/row100k/app/cards) is drawn:
 * the rower's, or any rower's for an admin. A hidden rower's card draws
 * blocks, because the payload is the one the site builds. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const id = q.get("id") ?? "";
    const viewer = await resolveViewer();
    if (!viewer.actor) return no("Sign in first.", 401);
    const rl = await rateLimit({ key: `row-app-card:${viewer.actor.photographerId}`, limit: 240, windowSec: 3600 });
    if (!rl.ok) return no("Too many stickers at once. Try again in a bit.", 429);
    const data = await shareDataFor(viewer, q.get("row"));
    if (!data) return no("That is not yours to share.", 404);
    const card = (await serverCards(data)).find((c) => c.id === id);
    if (!card) return no("No such sticker.", 404);
    const png = await renderCardPng(card, data);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="row-${data.rowerNumber}-${card.id.replace(/^rowtember-/, "")}.png"`,
        /* The viewer's own, and it changes with every row they log. */
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("row app: failed to draw a sticker", err);
    return no("That sticker could not be drawn just now.", 500);
  }
}
