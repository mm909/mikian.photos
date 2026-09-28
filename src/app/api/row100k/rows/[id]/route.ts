import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  MAX_ENTRIES_PER_DAY,
  isRow100kAdmin,
  nowMs,
  validateEntry,
} from "@/lib/row100k";
import { monthFromKey } from "@/lib/rowPeriod";

export const runtime = "nodejs";

/* Fix or delete one of your own logged rows (the platform owner can moderate
 * any). Once a month's logging closes its board is final — non-owner edits
 * and deletes of that month's rows are refused so the archived standings
 * can't quietly rewrite themselves in December. The line is the ROW'S
 * month's grace close, not the process month's (rollover review,
 * 2026-09-28: the old gate never shut on a September row once October
 * was the month). Both verbs share the guard rail below. */
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

  const m = monthFromKey(entry.day.slice(0, 7));
  if (!isOwner && m && nowMs() >= m.logCloseMs) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: `${m.label} is closed — the board is final.` },
        { status: 400 },
      ),
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

/* Fix a mistake: day, meters, time, the title, and the photo pair are all
 * replaceable; the same validation as logging applies, so an edit can't
 * sneak in what a log couldn't. A blank title leaves the stored one alone
 * (rows always carry one — POST defaults it) — except for a challenge
 * admin sending an explicit string: that sets the title verbatim, so the
 * rowers table (/row100k/signups) can clear one (2026-09-08). An absent
 * `photos` keeps the current pair; a present one must be a full pair, same
 * as logging. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guarded = await guard(params.id, "edit");
  if (!guarded.ok) return guarded.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  // Replacement photos must sit under an upload prefix the editor could
  // legitimately have signed: the row owner's own prefix, or — for challenge
  // admins fixing someone else's row — any prefix inside this challenge
  // (admins upload under their own participant id). Mirrors the POST rule.
  let photos: string[] | undefined;
  if (body.photos !== undefined) {
    const ownPrefix = `row100k/${CHALLENGE}/${guarded.participantId}/`;
    const anyPrefix = `row100k/${CHALLENGE}/`;
    const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
    const valid = rawPhotos.filter(
      (k): k is string =>
        typeof k === "string" &&
        k.length < 200 &&
        !k.includes("..") &&
        (k.startsWith(ownPrefix) || (guarded.isOwner && k.startsWith(anyPrefix))),
    );
    if (valid.length !== 2 || rawPhotos.length !== 2) {
      return NextResponse.json(
        { ok: false, error: "Two photos required — you and the screen." },
        { status: 400 },
      );
    }
    photos = valid;
  }

  // The guard already decided who may edit after a month's close (the
  // owner, for moderation); validateEntry's admin reach takes any day back
  // to the first month, so the clock goes in as it is — no clamp.
  const check = validateEntry(body, nowMs(), { admin: guarded.isOwner });
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
  // note (a retired field) rides along unchanged on old rows. Replaced
  // photos leave their old R2 objects orphaned — same as a deleted row;
  // storage housekeeping, not correctness.
  await db.rowEntry.updateMany({
    where: { id: guarded.entryId },
    data: {
      day: check.value.day,
      meters: check.value.meters,
      seconds: check.value.seconds,
      note: guarded.note,
      ...(check.value.title || (guarded.isOwner && typeof body.title === "string")
        ? { title: check.value.title }
        : {}),
      ...(photos ? { photos } : {}),
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
