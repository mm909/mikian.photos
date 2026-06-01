/**
 * DELETE /api/admin/coverage/photo-bib
 *
 * Body: { photoId: string, bib: number }
 *
 * Removes a single (photo, bib) association — for when OCR or a manual
 * tagger linked the wrong bib to one specific photo. The bib stays valid
 * on other photos in the event; only this one row goes away.
 *
 * Owner + race director. 404 if no matching row.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

export const runtime = "nodejs";

type Body = { photoId?: string; bib?: number };

export async function DELETE(req: Request) {
  const actor = await requireRole("race_director");
  if (!actor) {
    return NextResponse.json(
      { error: "Race director or owner role required" },
      { status: 403 }
    );
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  const { photoId, bib } = body;
  if (!photoId || typeof bib !== "number" || !Number.isFinite(bib)) {
    return NextResponse.json(
      { error: "photoId (string) and bib (number) required" },
      { status: 400 }
    );
  }

  // Schema has @@unique([photoId, bib]) so this matches at most one row.
  const result = await db.photoBib.deleteMany({
    where: { photoId, bib },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "No matching tagging found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: result.count });
}
