import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { NAME_MAX, SKILLS, TOURNEY, skillLabel, teamName } from "@/app/pickleball/tournament";

/* /api/pickleball/team — a doubles team opts in (owner, 2026-11-02): two
 * names and a self-rated level, NO ACCOUNT — the whole page runs on the
 * honor system, so the writes are IP rate-limited and capped instead of
 * gated. Closed once the owner locks the bracket. Every save emails the
 * owner (the standing rule, 2026-10-13: "every single time someone signs
 * up"); a failed send is logged, never surfaced. */

export const runtime = "nodejs";

const MAX_TEAMS = 64;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

const cleanName = (v: unknown): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "";

export async function POST(req: Request) {
  const limit = await rateLimit({ key: `pickle-team:${clientIp(req)}`, limit: 8, windowSec: 3600 });
  if (!limit.ok) return bad("Too many signups from here at once — try again in a bit.", 429);

  let body: Record<string, unknown> | null = null;
  try {
    const b = (await req.json()) as unknown;
    body = b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    /* fall through */
  }
  if (!body) return bad("invalid JSON body");

  const player1 = cleanName(body.player1);
  const player2 = cleanName(body.player2);
  const skill = typeof body.skill === "string" && SKILLS.some((s) => s.id === body.skill) ? body.skill : "";
  if (!player1 || !player2) return bad("Both names, please — it’s doubles.");

  try {
    const setting = await db.pickleSetting.findUnique({ where: { tourney: TOURNEY.slug } });
    if (setting?.lockedAt) return bad("The bracket is locked — signups are closed.", 410);

    const all = await db.pickleTeam.findMany({ where: { tourney: TOURNEY.slug, withdrawnAt: null } });
    if (all.length >= MAX_TEAMS) return bad("The field is full.");
    const norm = (n: string) => n.toLowerCase();
    const pair = new Set([norm(player1), norm(player2)]);
    const dupe = all.find((t) => pair.has(norm(t.player1)) && pair.has(norm(t.player2)) && new Set([norm(t.player1), norm(t.player2)]).size === pair.size);
    if (dupe) return bad(`${teamName(dupe.player1, dupe.player2)} is already on the list.`, 409);

    const saved = await db.pickleTeam.create({ data: { tourney: TOURNEY.slug, player1, player2, skill } });
    const count = all.length + 1;

    const text =
      `${teamName(player1, player2)} opted in.\n` +
      `Skill: ${skill ? skillLabel(skill) : "—"}\n\n` +
      `${count} ${count === 1 ? "team" : "teams"} in the field.\n` +
      `— sent from the pickleball page`;
    const sent = await sendOwnerNotification(`Pickleball — ${teamName(player1, player2)} opted in`, text);
    if (!sent.ok) console.warn(`[pickleball] team saved but email failed: ${sent.error}`);

    return NextResponse.json({
      ok: true,
      team: { id: saved.id, player1: saved.player1, player2: saved.player2, skill: saved.skill, seed: saved.seed, withdrawn: false },
    });
  } catch (err) {
    console.error("pickleball: team save failed (tables pushed?)", err);
    return bad("Couldn’t save that — try again.", 503);
  }
}
