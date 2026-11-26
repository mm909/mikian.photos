import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/row100kViewer";
import { decidePledge, pledgeViews, sweepPledges } from "@/app/row100k/m2dPledgeActions";

/* THE OWNER'S PLEDGE LIST (row100k/dev/m2d-pledges): every pledge, and
 * his word on each. An admin only, everywhere: a stranger is told nothing
 * is here.
 *
 *   GET                                    every pledge with its fill.
 *   POST { id, action: approve | decline } approve starts it now and sends
 *                                          the giver the welcome.
 *   POST { action: sweep }                 send what is due
 *                                          (m2dPledgeActions sweepPledges). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

export async function GET() {
  const v = await resolveViewer();
  if (!v.actor || !v.isAdmin) return no("Not here.", 404);
  return NextResponse.json({ ok: true, pledges: await pledgeViews() }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const v = await resolveViewer();
  if (!v.actor || !v.isAdmin) return no("Not here.", 404);
  const body = (await req.json().catch(() => null)) as { id?: unknown; action?: unknown } | null;
  try {
    if (body?.action === "sweep") {
      const r = await sweepPledges();
      return NextResponse.json({ ok: true, ...r, pledges: await pledgeViews() }, { headers: NO_STORE });
    }
    if (typeof body?.id !== "string" || (body.action !== "approve" && body.action !== "decline")) return no("Say which pledge, and approve or decline.", 400);
    const r = await decidePledge(body.id, body.action, v.actor.email);
    if (typeof r === "string") return no(r, 400);
    return NextResponse.json({ ok: true, pledges: await pledgeViews() }, { headers: NO_STORE });
  } catch (err) {
    console.error("M2D pledges: not decided", err);
    return no("That did not save.", 500);
  }
}
