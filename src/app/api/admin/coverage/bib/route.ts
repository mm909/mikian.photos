/**
 * DELETE /api/admin/coverage/bib
 *
 * Body: { eventId: string, bib: number }
 *
 * Wipes every PhotoBib row carrying that bib for that event. Use when an
 * OCR pass detected a phantom bib number ("1000" from a sign in the
 * background, etc.) that should never appear as a search target.
 *
 * Owner-only. Returns the number of rows deleted so the client can show
 * "removed N taggings" and refresh.
 *
 * The photos themselves are untouched — only the bib associations go away.
 * A photo that lost its only bib here just shows up in the "unreachable"
 * or "face-only" bucket on the next coverage fetch.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

export const runtime = "nodejs";

type Body = { eventId?: string; bib?: number };

export async function DELETE(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  const { eventId, bib } = body;
  if (!eventId || typeof bib !== "number" || !Number.isFinite(bib)) {
    return NextResponse.json(
      { error: "eventId (string) and bib (number) required" },
      { status: 400 }
    );
  }

  // Scope the delete to photos in the named event — guards against cross-
  // event collateral if the same bib number appears at two races.
  const result = await db.photoBib.deleteMany({
    where: {
      bib,
      photo: { eventId },
    },
  });

  return NextResponse.json({ deleted: result.count });
}
