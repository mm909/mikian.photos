import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

/**
 * /api/lasd26/apply — once the "Put your name in" form on /lasd26.
 *
 * CREW CALL IS CLOSED (owner, 2026-10-15: "the van is full"). The form is
 * gone from the page and POST answers 410 Gone so nothing — a cached page,
 * a saved request — can still put a name in. The rows that came in stay:
 * the owner reads them on /lasd26/the-list (DEVELOPMENT group of the
 * account menu) and DELETE still clears that list.
 */
export const runtime = "nodejs";

const PAGE = "lasd26";

export async function POST() {
  return NextResponse.json({ ok: false, error: "Crew call is closed." }, { status: 410 });
}

/** DELETE /api/lasd26/apply — owner only: wipe the applicant list. */
export async function DELETE() {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }
  const res = await db.crewApplication.deleteMany({ where: { page: PAGE } });
  return NextResponse.json({ ok: true, deleted: res.count });
}
