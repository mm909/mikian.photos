import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/row100kViewer";
import { serverCards, shareDataFor } from "@/app/row100k/share/serverCard";

/* THE STICKERS A VIEWER CAN MAKE (2026-11-20), for the phone app: the same
 * deck the site's share dialog offers on a rower's own page, as a list.
 * GET ?row=<entry id> for one row's deck (THIS ROW first), or no row for
 * the viewer's own month. Each line is drawn by /api/row100k/app/card.
 * Only the rower and an admin get a deck, as on the site; anybody else gets
 * an empty one, not an error, so a row page can simply show nothing. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: Request) {
  try {
    const row = new URL(req.url).searchParams.get("row");
    const viewer = await resolveViewer();
    const data = await shareDataFor(viewer, row);
    if (!data) return NextResponse.json({ ok: true, cards: [] }, { headers: NO_STORE });
    const cards = await serverCards(data);
    return NextResponse.json(
      { ok: true, rowerNumber: data.rowerNumber, cards: cards.map((c) => ({ id: c.id, label: c.labelFor ? c.labelFor(data) : c.label, width: c.width, height: c.height })) },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("row app: failed to list the stickers", err);
    return NextResponse.json({ ok: false, error: "The stickers could not be read just now." }, { status: 500, headers: NO_STORE });
  }
}
