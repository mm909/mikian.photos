import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { statusFor } from "@/lib/concept2";
import { concept2Viewer } from "./gate";

/* THE ROWER'S LINK TO THEIR CONCEPT2 LOGBOOK (2026-11-26; plan in
 * mobile/CONCEPT2-LOGBOOK.md, the talk with Concept2 in lib/concept2.ts).
 *
 *   GET     where it stands: set up or not, connected as whom, how many
 *           rows have gone and which were refused
 *   DELETE  Disconnect: the stored tokens go. The rows already in the
 *           Logbook stay there; it is the rower's Logbook.
 *
 * In development: admin-only in production (./gate.ts). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const v = await concept2Viewer();
  if ("error" in v) return NextResponse.json({ ok: false, error: v.error }, { status: v.status });
  try {
    return NextResponse.json({ ok: true, concept2: await statusFor(v.userId) }, { headers: NO_STORE });
  } catch (err) {
    console.error("concept2: status unreadable", err);
    return NextResponse.json({ ok: false, error: "The Concept2 link could not be read just now." }, { status: 500 });
  }
}

export async function DELETE() {
  const v = await concept2Viewer();
  if ("error" in v) return NextResponse.json({ ok: false, error: v.error }, { status: v.status });
  try {
    await db.concept2Link.deleteMany({ where: { userId: v.userId } });
    return NextResponse.json({ ok: true, concept2: await statusFor(v.userId) }, { headers: NO_STORE });
  } catch (err) {
    console.error("concept2: disconnect failed", err);
    return NextResponse.json({ ok: false, error: "That did not disconnect. Try again." }, { status: 500 });
  }
}
