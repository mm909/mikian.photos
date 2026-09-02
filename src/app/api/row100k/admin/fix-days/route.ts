import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, FIRST_DAY, isRow100kAdmin } from "@/lib/row100k";

export const runtime = "nodejs";

/* One-shot repair for the launch-night date bug: before the local-date fix
 * went live (2026-09-02 ~01:05 UTC), the log form defaulted the day to
 * "today" in UTC — so US rowers logging in the evening silently filed their
 * row on tomorrow. This moves every such row back to the date the rower
 * actually pressed submit, on the most-generous US clock (UTC-7, so an
 * evening log anywhere in the US counts as that evening's date), clamped
 * into September.
 *
 * Only rows created BEFORE the fix deployed are candidates — the cutoff is
 * hard-coded so pressing the button later can never touch a legitimately
 * future-dated row (e.g. a rower east of UTC logging their own "today").
 * Idempotent: a repaired row no longer matches. */

const CUTOFF_MS = Date.parse("2026-09-02T01:15:00Z");

function usWestDay(createdAt: Date): string {
  const d = new Date(createdAt.getTime() - 7 * 3600_000).toISOString().slice(0, 10);
  return d < FIRST_DAY ? FIRST_DAY : d;
}

export async function POST() {
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
      { ok: false, error: "Too many admin actions at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  const entries = await db.rowEntry.findMany({
    where: { challenge: CHALLENGE, createdAt: { lt: new Date(CUTOFF_MS) } },
    select: {
      id: true,
      day: true,
      meters: true,
      createdAt: true,
      participant: { select: { rowerNumber: true, displayName: true } },
    },
  });

  const fixes = entries
    .map((e) => ({ ...e, target: usWestDay(e.createdAt) }))
    .filter((e) => e.day > e.target);

  for (const f of fixes) {
    await db.rowEntry.update({ where: { id: f.id }, data: { day: f.target } });
  }
  if (fixes.length > 0) revalidateTag("row100k-boards");

  return NextResponse.json({
    ok: true,
    fixed: fixes.map((f) => ({
      rowerNumber: f.participant.rowerNumber,
      name: f.participant.displayName,
      meters: f.meters,
      from: f.day,
      to: f.target,
    })),
  });
}
