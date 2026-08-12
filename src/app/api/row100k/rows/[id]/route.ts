import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  LOG_CLOSE_MS,
  MAX_ENTRIES_PER_DAY,
  isRow100kAdmin,
  nowMs,
  validateEntry,
} from "@/lib/row100k";

export const runtime = "nodejs";

/* Fix or delete one of your own logged rows (the platform owner can moderate
 * any). Once logging closes the board is final — non-owner edits and deletes
 * are refused so the archived standings can't quietly rewrite themselves in
 * December. Both verbs share the guard rail below. */
type Guarded =
  | { ok: true; entryId: string; participantId: string; day: string; note: string; isOwner: boolean }
  | { ok: false; res: NextResponse };

async function guard(id: string, verb: "edit" | "del"): Promise<Guarded> {
  const actor = await getEffectiveActor();
  if (!actor) {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 }),
    };
  }

  const isOwner = isRow100kAdmin(actor.email, actor.roles);
  if (!isOwner && nowMs() >= LOG_CLOSE_MS) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "The challenge is closed — the board is final." },
        { status: 400 },
      ),
    };
  }

  const limit = await rateLimit({
    key: `row100k-${verb}:${actor.photographerId}`,
    limit: 40,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Too many changes at once — try again in a bit." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
      ),
    };
  }

  const entry = await db.rowEntry.findUnique({
    where: { id },
    include: { participant: { select: { userId: true } } },
  });
  if (!entry || entry.challenge !== CHALLENGE) {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: "That row is already gone." }, { status: 404 }),
    };
  }

  const mine = entry.participant.userId === actor.photographerId;
  if (!mine && !isOwner) {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: "Not your row." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    entryId: entry.id,
    participantId: entry.participantId,
    day: entry.day,
    note: entry.note,
    isOwner,
  };
}

/* Fix a mistake: day, meters and time are replaceable; the same validation
 * as logging applies, so an edit can't sneak in what a log couldn't. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guarded = await guard(params.id, "edit");
  if (!guarded.ok) return guarded.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  // The guard already decided who may edit after close (the owner, for
  // moderation) — clamp the clock so validateEntry's own closed check can't
  // re-refuse what the guard allowed.
  const atMs = guarded.isOwner ? Math.min(nowMs(), LOG_CLOSE_MS - 1) : nowMs();
  const check = validateEntry(body, atMs);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  // Moving a row onto another day must respect the same per-day cap POST
  // enforces — otherwise edits could stack a "biggest day" no one could log.
  if (check.value.day !== guarded.day) {
    const dayCount = await db.rowEntry.count({
      where: { participantId: guarded.participantId, day: check.value.day },
    });
    if (dayCount >= MAX_ENTRIES_PER_DAY) {
      return NextResponse.json(
        { ok: false, error: `That's already ${MAX_ENTRIES_PER_DAY} sessions on that day — the max.` },
        { status: 400 },
      );
    }
  }

  // updateMany so a concurrent delete is a no-op, not a P2025 throw. The
  // note (a retired field) rides along unchanged on old rows.
  await db.rowEntry.updateMany({
    where: { id: guarded.entryId },
    data: {
      day: check.value.day,
      meters: check.value.meters,
      seconds: check.value.seconds,
      note: guarded.note,
    },
  });
  revalidateTag("row100k-boards");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guarded = await guard(params.id, "del");
  if (!guarded.ok) return guarded.res;

  // deleteMany so a concurrent double-delete is a no-op, not a P2025 throw.
  await db.rowEntry.deleteMany({ where: { id: guarded.entryId } });
  revalidateTag("row100k-boards");
  return NextResponse.json({ ok: true });
}
