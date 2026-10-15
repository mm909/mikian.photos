import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TEAM, getSettings, getTeamViewer, updateSettings, type Settings } from "@/lib/lasd26/team";

/**
 * /api/lasd26/team/settings — the split and the settle-up switch.
 *   GET   (team)  → { splitCount, settleOpen } + memberCount, so the
 *                   expenses page can show "12 joined · splitting 18 ways".
 *   PATCH (owner) → { splitCount?: 1..200, settleOpen?: boolean }; at least
 *                   one of them. Returns the settings as saved.
 */
export const runtime = "nodejs";

export async function GET() {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!viewer.onTeam) return NextResponse.json({ ok: false, error: "Not on the team." }, { status: 403 });
  const settings = await getSettings();
  let memberCount = 0;
  try {
    memberCount = await db.teamMember.count({ where: { team: TEAM } });
  } catch (err) {
    console.error("lasd26/team/settings: count failed", err);
  }
  return NextResponse.json({ ok: true, settings, memberCount });
}

export async function PATCH(req: Request) {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!viewer.owner) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });

  let body: { splitCount?: unknown; settleOpen?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<Settings> = {};
  if (body.splitCount !== undefined) {
    const n = typeof body.splitCount === "number" ? body.splitCount : Number(body.splitCount);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      return NextResponse.json({ ok: false, error: "splitCount must be a whole number from 1 to 200." }, { status: 400 });
    }
    patch.splitCount = n;
  }
  if (body.settleOpen !== undefined) {
    if (typeof body.settleOpen !== "boolean") {
      return NextResponse.json({ ok: false, error: "settleOpen must be true or false." }, { status: 400 });
    }
    patch.settleOpen = body.settleOpen;
  }
  if (patch.splitCount === undefined && patch.settleOpen === undefined) {
    return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  }

  try {
    const settings = await updateSettings(patch);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error("lasd26/team/settings PATCH failed", err);
    return NextResponse.json({ ok: false, error: "Could not save." }, { status: 500 });
  }
}
