import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, LOG_CLOSE_MS } from "@/lib/row100k";

export const runtime = "nodejs";

/* Delete one of your own logged rows (the platform owner can moderate any).
 * Once logging closes the board is final — non-owner deletes are refused so
 * the archived standings can't quietly rewrite themselves in December. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Sign in with Google first." },
      { status: 401 },
    );
  }

  const isOwner = actor.roles.includes("owner");
  if (!isOwner && Date.now() >= LOG_CLOSE_MS) {
    return NextResponse.json(
      { ok: false, error: "The challenge is closed — the board is final." },
      { status: 400 },
    );
  }

  const limit = await rateLimit({
    key: `row100k-del:${actor.photographerId}`,
    limit: 40,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many deletes at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  const entry = await db.rowEntry.findUnique({
    where: { id: params.id },
    include: { participant: { select: { userId: true } } },
  });
  if (!entry || entry.challenge !== CHALLENGE) {
    return NextResponse.json({ ok: false, error: "That row is already gone." }, { status: 404 });
  }

  const mine = entry.participant.userId === actor.photographerId;
  if (!mine && !isOwner) {
    return NextResponse.json({ ok: false, error: "Not your row." }, { status: 403 });
  }

  // deleteMany so a concurrent double-delete is a no-op, not a P2025 throw.
  await db.rowEntry.deleteMany({ where: { id: entry.id } });
  revalidateTag("row100k-boards");
  return NextResponse.json({ ok: true });
}
