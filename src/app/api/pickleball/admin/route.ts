import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { TOURNEY } from "@/app/pickleball/tournament";

/* /api/pickleball/admin — the owner's buttons (owner, 2026-11-02: "you
 * seed manually"). seeds: save seed numbers while signups are open.
 * withdraw / restore: a team, kept not deleted, the race-day way. lock:
 * normalize the seeds (seeded teams first in seed order, the rest behind
 * them in signup order), stamp lockedAt — signups close, the bracket
 * draws. unlock: reopen; the scores already reported stay and replay
 * picks them back up if the field relocks the same. */

export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor || !isAdmin(actor)) return bad("That’s the owner’s panel.", 403);

  let body: Record<string, unknown> | null = null;
  try {
    const b = (await req.json()) as unknown;
    body = b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    /* fall through */
  }
  if (!body || typeof body.action !== "string") return bad("Which action?");

  try {
    const setting = await db.pickleSetting.findUnique({ where: { tourney: TOURNEY.slug } });
    const locked = setting?.lockedAt != null;

    if (body.action === "seeds") {
      if (locked) return bad("Unlock first — the bracket is live.");
      const seeds = Array.isArray(body.seeds) ? body.seeds : [];
      for (const s of seeds) {
        if (!s || typeof s !== "object") continue;
        const { teamId, seed } = s as { teamId?: unknown; seed?: unknown };
        if (typeof teamId !== "string") continue;
        const n = typeof seed === "number" && Number.isInteger(seed) && seed >= 1 && seed <= 128 ? seed : null;
        await db.pickleTeam.updateMany({ where: { id: teamId, tourney: TOURNEY.slug }, data: { seed: n } });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "withdraw" || body.action === "restore") {
      if (locked) return bad("Unlock first — the bracket is live.");
      const teamId = typeof body.teamId === "string" ? body.teamId : "";
      if (!teamId) return bad("Which team?");
      await db.pickleTeam.updateMany({
        where: { id: teamId, tourney: TOURNEY.slug },
        data: { withdrawnAt: body.action === "withdraw" ? new Date() : null },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "lock") {
      if (locked) return bad("Already locked.");
      const active = await db.pickleTeam.findMany({ where: { tourney: TOURNEY.slug, withdrawnAt: null }, orderBy: { createdAt: "asc" } });
      if (active.length < 2) return bad("Two teams at least before a bracket draws.");
      const ordered = [...active].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || a.createdAt.getTime() - b.createdAt.getTime());
      for (let i = 0; i < ordered.length; i++) {
        await db.pickleTeam.update({ where: { id: ordered[i].id }, data: { seed: i + 1 } });
      }
      await db.pickleSetting.upsert({
        where: { tourney: TOURNEY.slug },
        create: { tourney: TOURNEY.slug, lockedAt: new Date(), updatedBy: actor.email },
        update: { lockedAt: new Date(), updatedBy: actor.email },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "unlock") {
      if (!locked) return bad("Already open.");
      await db.pickleSetting.update({ where: { tourney: TOURNEY.slug }, data: { lockedAt: null, updatedBy: actor.email } });
      return NextResponse.json({ ok: true });
    }

    return bad("Which action?");
  } catch (err) {
    console.error("pickleball: admin action failed (tables pushed?)", err);
    return bad("Couldn’t do that — try again.", 503);
  }
}
