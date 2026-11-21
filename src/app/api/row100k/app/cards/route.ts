import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/row100kViewer";
import { renderCardPng, serverCards, shareDataFor } from "@/app/row100k/share/serverCard";

/* THE STICKERS A VIEWER CAN MAKE (2026-11-20), for the phone app: the same
 * deck the site's share dialog offers on a rower's own page, as a list.
 * GET ?row=<entry id> for one row's deck (THIS ROW first), or no row for
 * the viewer's own month. Each line is drawn by /api/row100k/app/card.
 * Only the rower and an admin get a deck, as on the site; anybody else gets
 * an empty one, not an error, so a row page can simply show nothing.
 *
 * &art=1 sends every sticker's PNG along, base64, in the same answer
 * (owner, 2026-11-22: "I'm confused as to why it takes so long to generate
 * the shareables ... I should not be waiting for anything there"). Asked
 * for one at a time, each sticker was its own request, and each request
 * built the rower's whole share payload again before drawing a thing. One
 * request builds it once and draws them all, which is tens of
 * milliseconds a card. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const row = q.get("row");
    const art = q.get("art") === "1";
    const viewer = await resolveViewer();
    const data = await shareDataFor(viewer, row);
    if (!data) return NextResponse.json({ ok: true, cards: [] }, { headers: NO_STORE });
    const cards = await serverCards(data);
    const pngs = new Map<string, string>();
    if (art) {
      for (const c of cards) {
        try {
          pngs.set(c.id, (await renderCardPng(c, data)).toString("base64"));
        } catch (err) {
          console.error(`row app: failed to draw the sticker ${c.id}`, err);
        }
      }
    }
    return NextResponse.json(
      { ok: true, rowerNumber: data.rowerNumber, cards: cards.map((c) => ({ id: c.id, label: c.labelFor ? c.labelFor(data) : c.label, width: c.width, height: c.height, ...(pngs.has(c.id) ? { png: pngs.get(c.id) } : {}) })) },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("row app: failed to list the stickers", err);
    return NextResponse.json({ ok: false, error: "The stickers could not be read just now." }, { status: 500, headers: NO_STORE });
  }
}
