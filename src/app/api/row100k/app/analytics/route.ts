import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/row100kViewer";
import { burn } from "@/app/row100k/costs";
import { churn } from "@/app/row100k/churn";

/* THE OWNER'S ANALYTICS (owner, 2026-11-26: "we can probably group all
 * these into a settings tab ... analytics ... all those back-end analytics
 * that are designed for me"): ?k=costs (row100k/costs.ts) or ?k=churn
 * (row100k/churn.ts). An admin only; a stranger is told nothing is here. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: Request) {
  const v = await resolveViewer();
  if (!v.actor || !v.isAdmin) return NextResponse.json({ ok: false, error: "Not here." }, { status: 404, headers: NO_STORE });
  const k = new URL(req.url).searchParams.get("k");
  try {
    if (k === "costs") return NextResponse.json({ ok: true, ...burn() }, { headers: NO_STORE });
    if (k === "churn") return NextResponse.json({ ok: true, ...(await churn()) }, { headers: NO_STORE });
    return NextResponse.json({ ok: false, error: "Which one?" }, { status: 400, headers: NO_STORE });
  } catch (err) {
    console.error("analytics: not read", err);
    return NextResponse.json({ ok: false, error: "That could not be read." }, { status: 500, headers: NO_STORE });
  }
}
