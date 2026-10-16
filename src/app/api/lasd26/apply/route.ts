import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

/**
 * /api/lasd26/apply — the crew-call pile.
 *
 * The crew call is CLOSED (owner, 2026-10-15: "the van is full"), and since
 * the team site went live over /lasd26 (2026-10-16) nothing on the site
 * renders the "Put your name in" form any more. POST, which used to save a
 * CrewApplication row and email the crew captains, now answers 410 Gone
 * to anything that still has the old page cached. The rows it collected
 * stay: the owner reads them on /lasd26/the-list and can wipe them with
 * DELETE below (ClearPile.tsx).
 */
export const runtime = "nodejs";

const PAGE = "lasd26";

/** POST /api/lasd26/apply — closed. 410, not 404: the door existed and is shut. */
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
