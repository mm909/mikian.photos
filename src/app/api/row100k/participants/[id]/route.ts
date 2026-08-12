import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { r2Delete } from "@/lib/r2";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";

export const runtime = "nodejs";

/* Remove a rower from the challenge entirely — participant row plus their
 * whole log (RowEntry cascades on delete). Moderation only: both admin
 * accounts qualify (see isRow100kAdmin); there is deliberately no
 * delete-my-own-account path, so a rower can't wipe their number and rejoin
 * for a lower one. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 });
  }
  if (!isRow100kAdmin(actor.email, actor.roles)) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }

  const limit = await rateLimit({
    key: `row100k-mod:${actor.photographerId}`,
    limit: 20,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many removals at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  // Their photos leave with them — collect the keys BEFORE the cascade
  // deletes the entries out from under us.
  const photoKeys = (
    await db.rowEntry.findMany({
      where: { participantId: params.id, challenge: CHALLENGE, photoKey: { not: "" } },
      select: { photoKey: true },
    })
  )
    .map((e) => e.photoKey)
    .filter((k) => k.startsWith("row100k/rows/"));

  // Scoped to the active namespace so a demo-mode admin can't touch live rows
  // (and vice versa); deleteMany so a double-tap is a no-op.
  const res = await db.rowParticipant.deleteMany({
    where: { id: params.id, challenge: CHALLENGE },
  });
  if (res.count === 0) {
    return NextResponse.json({ ok: false, error: "That rower is already gone." }, { status: 404 });
  }

  if (photoKeys.length > 0) {
    try {
      await r2Delete(photoKeys);
    } catch (err) {
      console.error("row100k: rower photo cleanup failed", err);
    }
  }

  revalidateTag("row100k-boards");
  return NextResponse.json({ ok: true });
}
