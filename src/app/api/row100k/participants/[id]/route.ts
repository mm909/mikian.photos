import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  HOME_GYM_MAX,
  birthdayInput,
  isRow100kAdmin,
  nowMs,
  parseBirthday,
  parseHeightCm,
  parseHomeGym,
  parseWeightKg,
} from "@/lib/row100k";

export const runtime = "nodejs";

/* Prisma's "column does not exist" (P2022) — the schema has a column the
 * database has not been pushed yet. */
function isMissingColumn(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "P2022";
}

/* ABOUT YOU — the rower's own birthday, height, weight and home gym
 * (owner, 2026-09-24: "collect their birthday … height and weight
 * optional, in the settings page"; 2026-09-25: "give them the option to
 * enter their HOME GYM"). PATCH { birthday?, heightCm?, weightKg?,
 * homeGym? }: a key that is absent is left alone; null or "" clears it;
 * anything else must parse (the gym is free text under HOME_GYM_MAX).
 * Height and weight take a number (metric) OR the text the form holds —
 * "5'11", "165 lb" — through the same readers the form uses, so the two
 * cannot disagree about what a value means. THE OWNER OF THE ROW ONLY: not
 * an admin, not the moderation path below — these are the rower's own
 * facts and nobody else's to set. Nothing is revalidated because nothing
 * prints any of the three yet. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 });
  }

  let body: { birthday?: unknown; heightCm?: unknown; weightKg?: unknown; homeGym?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const data: { birthday?: Date | null; heightCm?: number | null; weightKg?: number | null; homeGym?: string | null } = {};
  const blank = (v: unknown) => v === null || v === "";

  if ("birthday" in body) {
    if (blank(body.birthday)) data.birthday = null;
    else {
      const checked = parseBirthday(body.birthday, nowMs());
      if (!checked.ok) return NextResponse.json({ ok: false, error: checked.error }, { status: 400 });
      data.birthday = checked.value;
    }
  }
  if ("heightCm" in body) {
    if (blank(body.heightCm)) data.heightCm = null;
    else {
      const cm = parseHeightCm(body.heightCm);
      if (cm === null) {
        return NextResponse.json({ ok: false, error: "Height did not read — try 180 cm or 5'11." }, { status: 400 });
      }
      data.heightCm = cm;
    }
  }
  if ("weightKg" in body) {
    if (blank(body.weightKg)) data.weightKg = null;
    else {
      const kg = parseWeightKg(body.weightKg);
      if (kg === null) {
        return NextResponse.json({ ok: false, error: "Weight did not read — try 75 kg or 165 lb." }, { status: 400 });
      }
      data.weightKg = kg;
    }
  }
  if ("homeGym" in body) {
    if (blank(body.homeGym)) data.homeGym = null;
    else {
      const gym = parseHomeGym(body.homeGym);
      if (gym === null) {
        return NextResponse.json({ ok: false, error: `Keep the gym to ${HOME_GYM_MAX} characters.` }, { status: 400 });
      }
      // Whitespace-only collapses to "", which is a clear, not a value.
      data.homeGym = gym || null;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to save." }, { status: 400 });
  }

  const limit = await rateLimit({
    key: `row100k-about:${actor.photographerId}`,
    limit: 20,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many updates — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  // Scoped to the namespace AND the caller's own userId in the WHERE, so
  // somebody else's id is a 404, not a write — the same shape as a 403 to
  // the caller but with nothing to learn from it.
  //
  // Until the owner pushes the schema these columns are not in the
  // database and the write throws P2022 (missing column): said plainly as
  // a 503 rather than a 500, the same words the settings page prints.
  let count = 0;
  try {
    const res = await db.rowParticipant.updateMany({
      where: { id: params.id, challenge: CHALLENGE, userId: actor.photographerId },
      data,
    });
    count = res.count;
  } catch (err) {
    if (isMissingColumn(err)) {
      return NextResponse.json({ ok: false, error: "The profile fields are not available yet." }, { status: 503 });
    }
    throw err;
  }
  if (count === 0) {
    return NextResponse.json({ ok: false, error: "That is not your entry." }, { status: 404 });
  }

  const saved = await db.rowParticipant.findUnique({
    where: { id: params.id },
    select: { birthday: true, heightCm: true, weightKg: true, homeGym: true },
  });
  return NextResponse.json({
    ok: true,
    birthday: birthdayInput(saved?.birthday),
    heightCm: saved?.heightCm ?? null,
    weightKg: saved?.weightKg ?? null,
    homeGym: saved?.homeGym ?? null,
  });
}

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

  // Scoped to the active namespace so a demo-mode admin can't touch live rows
  // (and vice versa); deleteMany so a double-tap is a no-op.
  const res = await db.rowParticipant.deleteMany({
    where: { id: params.id, challenge: CHALLENGE },
  });
  if (res.count === 0) {
    return NextResponse.json({ ok: false, error: "That rower is already gone." }, { status: 404 });
  }

  revalidateTag("row100k-boards");
  return NextResponse.json({ ok: true });
}
