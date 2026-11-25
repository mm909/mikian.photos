import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/row100kViewer";
import { m2dReturn } from "@/app/row100k/m2dReturn";

/* M2D'S RETURN (row100k/m2dReturn.ts), for the owner's settings in the
 * app: who started on ROW in M2D, who rowed in it, the cost per rower and
 * whether they keep rowing after. An admin only: a stranger is told
 * nothing is here. Reads only. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const v = await resolveViewer();
  if (!v.actor || !v.isAdmin) return NextResponse.json({ ok: false, error: "Not here." }, { status: 404, headers: NO_STORE });
  try {
    return NextResponse.json({ ok: true, ...(await m2dReturn()) }, { headers: NO_STORE });
  } catch (err) {
    console.error("M2D return: not read", err);
    return NextResponse.json({ ok: false, error: "The return could not be read." }, { status: 500, headers: NO_STORE });
  }
}
