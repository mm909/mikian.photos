import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/row100kViewer";
import { appUsage } from "@/app/row100k/appUsage";

/* WHO USES THE APP (row100k/appUsage.ts), for the owner's settings in the
 * app. An admin only: a stranger is told nothing is here. Reads only. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const v = await resolveViewer();
  if (!v.actor || !v.isAdmin) return NextResponse.json({ ok: false, error: "Not here." }, { status: 404, headers: NO_STORE });
  try {
    return NextResponse.json({ ok: true, ...(await appUsage()) }, { headers: NO_STORE });
  } catch (err) {
    console.error("app usage: not read", err);
    return NextResponse.json({ ok: false, error: "The usage could not be read." }, { status: 500, headers: NO_STORE });
  }
}
