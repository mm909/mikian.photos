import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin, nowMs, validateEntry } from "@/lib/row100k";
import { saveRow } from "@/app/row100k/logEntry";

export const runtime = "nodejs";

/* Log one rowing session. Requires a session AND a participant row (join
 * first). All the real rules live in validateEntry() in src/lib/row100k.ts. */
export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Sign in with Google first." },
      { status: 401 },
    );
  }

  const participant = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
  });
  if (!participant) {
    return NextResponse.json(
      { ok: false, error: "Join the challenge first — it takes 30 seconds." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  // Challenge admins may log early (pre-Sep test rows on their own account);
  // everyone else gets the real window.
  const check = validateEntry(body, nowMs(), {
    admin: isRow100kAdmin(actor.email, actor.roles),
  });
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  // Photos: exactly two — the rower and the erg screen.
  // Keys must sit under this participant's own upload prefix — the sign
  // route only ever mints keys there, so a forged body can't attach someone
  // else's upload or point a card at an arbitrary object.
  const prefix = `row100k/${CHALLENGE}/${participant.id}/`;
  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  const photos = rawPhotos.filter(
    (k): k is string =>
      typeof k === "string" && k.length < 200 && k.startsWith(prefix) && !k.includes(".."),
  );
  if (photos.length !== 2 || rawPhotos.length !== 2) {
    return NextResponse.json(
      { ok: false, error: "Two photos required — you and the screen." },
      { status: 400 },
    );
  }

  /* The saving itself (the rate limit, the caps, the title, the row, the
   * notes to the owner and the followers) is app/row100k/logEntry.ts since
   * 2026-11-24, shared with the door a monitor row comes in by with no
   * photos (api/row100k/app/erg). THIS door still wants its two. */
  const saved = await saveRow(participant, check.value, photos);
  if (!saved.ok) {
    return NextResponse.json(
      { ok: false, error: saved.error },
      { status: saved.status, ...(saved.retryAfterSec ? { headers: { "Retry-After": String(saved.retryAfterSec) } } : {}) },
    );
  }

  return NextResponse.json({ ok: true, id: saved.id });
}
