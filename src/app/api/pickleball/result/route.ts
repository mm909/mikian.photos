import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { matchLabel, readScore, replay } from "@/app/pickleball/bracket";
import { TOURNEY, teamName } from "@/app/pickleball/tournament";

/* /api/pickleball/result — a score goes in (owner, 2026-11-02: "anyone
 * with the link", honor system). The server replays the bracket and only
 * takes a score for a match both teams actually stand in; re-posting the
 * same match fixes a typo (the replay silently drops any downstream
 * result the fix invalidates, bracket.ts). Every score emails the owner
 * — his abuse alarm on an open endpoint. DELETE (the owner only) takes a
 * score back out. */

export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = (await req.json()) as unknown;
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const limit = await rateLimit({ key: `pickle-result:${clientIp(req)}`, limit: 40, windowSec: 3600 });
  if (!limit.ok) return bad("Too many scores from here at once — try again in a bit.", 429);

  const body = await readBody(req);
  if (!body) return bad("invalid JSON body");
  const matchKey = typeof body.matchKey === "string" ? body.matchKey.trim().slice(0, 16) : "";
  const scoreA = readScore(body.scoreA);
  const scoreB = readScore(body.scoreB);
  const reportedBy = typeof body.reportedBy === "string" ? body.reportedBy.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  if (!matchKey) return bad("Which match?");
  if (scoreA === null || scoreB === null) return bad("Scores are whole numbers, 0 to 30.");
  if (scoreA === scoreB) return bad("Somebody won — no ties in pickleball.");

  try {
    const setting = await db.pickleSetting.findUnique({ where: { tourney: TOURNEY.slug } });
    if (!setting?.lockedAt) return bad("The bracket isn’t live yet.", 409);

    const [teams, results] = await Promise.all([
      db.pickleTeam.findMany({ where: { tourney: TOURNEY.slug, withdrawnAt: null, seed: { not: null } }, orderBy: { seed: "asc" } }),
      db.pickleResult.findMany({ where: { tourney: TOURNEY.slug } }),
    ]);
    const state = replay(
      teams.map((t) => t.id),
      results,
    );
    const match = state.matches.find((m) => m.key === matchKey);
    if (!match) return bad("No such match in this bracket.");
    if (!match.a || !match.b) return bad("That match doesn’t have both teams yet.");

    await db.pickleResult.upsert({
      where: { tourney_matchKey: { tourney: TOURNEY.slug, matchKey } },
      create: { tourney: TOURNEY.slug, matchKey, teamAId: match.a, teamBId: match.b, scoreA, scoreB, reportedBy },
      update: { teamAId: match.a, teamBId: match.b, scoreA, scoreB, reportedBy },
    });

    const byId = new Map(teams.map((t) => [t.id, teamName(t.player1, t.player2)]));
    const winner = scoreA > scoreB ? match.a : match.b;
    const loser = winner === match.a ? match.b : match.a;
    const [ws, ls] = scoreA > scoreB ? [scoreA, scoreB] : [scoreB, scoreA];
    const text =
      `${byId.get(winner) ?? "?"} def. ${byId.get(loser) ?? "?"} ${ws}–${ls}\n` +
      `${matchLabel(match)}${match.winner ? " (a correction)" : ""}\n` +
      `Reported by: ${reportedBy || "—"}\n` +
      `— sent from the pickleball page`;
    const sent = await sendOwnerNotification(`Pickleball — a score: ${byId.get(winner) ?? "?"} ${ws}–${ls}`, text);
    if (!sent.ok) console.warn(`[pickleball] result saved but email failed: ${sent.error}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("pickleball: result save failed (tables pushed?)", err);
    return bad("Couldn’t save that — try again.", 503);
  }
}

export async function DELETE(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor || !isAdmin(actor)) return bad("That’s the owner’s button.", 403);
  const body = await readBody(req);
  const matchKey = body && typeof body.matchKey === "string" ? body.matchKey.trim().slice(0, 16) : "";
  if (!matchKey) return bad("Which match?");
  try {
    await db.pickleResult.deleteMany({ where: { tourney: TOURNEY.slug, matchKey } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("pickleball: result delete failed", err);
    return bad("Couldn’t remove that — try again.", 503);
  }
}
