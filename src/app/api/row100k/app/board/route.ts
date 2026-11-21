import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/row100kViewer";
import { buildBoardPage } from "@/app/row100k/board/boardPageData";

/* THE 100K BOARD for the phone app (2026-11-20): the same rows, tiers and
 * own row the /board page prints, masked for whoever is asking by the same
 * function (boardPageData.ts). Never cached. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const viewer = await resolveViewer();
    const data = await buildBoardPage(viewer);
    return NextResponse.json({ ok: true, signedIn: viewer.actor !== null, ...data }, { headers: NO_STORE });
  } catch (err) {
    console.error("row app: failed to build the board", err);
    return NextResponse.json({ ok: false, error: "The board could not be read just now." }, { status: 500, headers: NO_STORE });
  }
}
