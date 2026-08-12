import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  MAX_ENTRIES_PER_DAY,
  MAX_ENTRIES_TOTAL,
  nowMs,
  validateEntry,
} from "@/lib/row100k";

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

  const check = validateEntry(body, nowMs());
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  const limit = await rateLimit({
    key: `row100k-log:${participant.id}`,
    limit: 40,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many logs at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  // Count-then-create is racy under concurrency, but the 40/hr rate limit
  // above bounds any overshoot to one window — these caps are anti-absurdity
  // guards on an honor-system board, not hard invariants.
  const [dayCount, totalCount] = await Promise.all([
    db.rowEntry.count({ where: { participantId: participant.id, day: check.value.day } }),
    db.rowEntry.count({ where: { participantId: participant.id } }),
  ]);
  if (dayCount >= MAX_ENTRIES_PER_DAY) {
    return NextResponse.json(
      { ok: false, error: `That's already ${MAX_ENTRIES_PER_DAY} sessions on that day — the max.` },
      { status: 400 },
    );
  }
  if (totalCount >= MAX_ENTRIES_TOTAL) {
    return NextResponse.json(
      { ok: false, error: "You've hit the entry cap for the month." },
      { status: 400 },
    );
  }

  const entry = await db.rowEntry.create({
    data: { challenge: CHALLENGE, participantId: participant.id, ...check.value },
  });
  revalidateTag("row100k-boards");
  return NextResponse.json({ ok: true, id: entry.id });
}
