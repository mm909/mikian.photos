import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/row100kViewer";
import { giversOk, m2dPlan, rateOk, setM2dGivers, setM2dRate } from "@/app/row100k/m2d";

/* THE OWNER'S M2D PLANNER (row100k/m2d.ts m2dPlan), for the app's
 * developer settings and the site's admin page. An admin only: a stranger
 * is told nothing is here.
 *
 *   GET                 the plan: meters so far, the projection, the rate.
 *   POST { rate }       ROWTEMBER's rate, cents a kilometer, stored with no
 *                       deploy (M2D_RATE_KEY). It applies to every meter in
 *                       the window, the ones already rowed included.
 *   POST { givers }     the other givers, [{ name, rate }], each a pledge in
 *                       cents a kilometer on the same meters (M2D_GIVERS_KEY);
 *                       the whole list, replacing the one stored. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

export async function GET() {
  const v = await resolveViewer();
  if (!v.actor || !v.isAdmin) return no("Not here.", 404);
  try {
    return NextResponse.json({ ok: true, ...(await m2dPlan()) }, { headers: NO_STORE });
  } catch (err) {
    console.error("M2D plan: not read", err);
    return no("The plan could not be read.", 500);
  }
}

export async function POST(req: Request) {
  const v = await resolveViewer();
  if (!v.actor || !v.isAdmin) return no("Not here.", 404);
  const body = (await req.json().catch(() => null)) as { rate?: unknown; givers?: unknown } | null;
  if (body && "givers" in body) {
    if (!giversOk(body.givers)) return no("Each giver needs a name (40 letters at most) and cents a kilometer above 0, to a hundredth.", 400);
    try {
      await setM2dGivers(body.givers, v.actor.email ?? "admin");
      return NextResponse.json({ ok: true, ...(await m2dPlan()) }, { headers: NO_STORE });
    } catch (err) {
      console.error("M2D givers: not saved", err);
      return no("The givers did not save.", 500);
    }
  }
  if (!rateOk(body?.rate)) return no("A rate from 0.5 to 500 cents a kilometer, to a hundredth of a cent.", 400);
  try {
    await setM2dRate(body.rate, v.actor.email ?? "admin");
    return NextResponse.json({ ok: true, ...(await m2dPlan()) }, { headers: NO_STORE });
  } catch (err) {
    console.error("M2D rate: not saved", err);
    return no("The rate did not save.", 500);
  }
}
