import { NextResponse } from "next/server";
import { getSettings, getTeamViewer, updateSettings } from "@/lib/lasd26/team";
import { getVanPin, wirePin } from "@/lib/lasd26/van";
import { PACE_MAX_SEC, PACE_MIN_SEC, type EtaSettings } from "@/app/lasd26/route/eta";

/**
 * /api/lasd26/eta — what the route page's ETAs run on (owner, 2026-10-21:
 * "etas added to the route page that will be filled in as we get more
 * info"; "the pace should be inferred from the van's location and current
 * duration of the race. I can input the drive time"). The page polls this
 * every half minute so a check-in on one phone moves the list on the rest.
 *   GET   (anyone) → { ok, settings: { driveMin, startAt, planPaceSec },
 *                     pin } — the pin only for the team (null otherwise),
 *                     since the van's whereabouts are the team's.
 *   PATCH (team)   { driveMin?, startAt?, planPaceSec? } → { ok, settings }.
 *                   driveMin 0..180 minutes; startAt an ISO time or null for
 *                   the planned start; planPaceSec 4:00..20:00 a mile.
 */
export const runtime = "nodejs";

function etaOf(s: { etaDriveMin: number; etaStartAt: string | null; etaPlanPaceSec: number }): EtaSettings {
  return { driveMin: s.etaDriveMin, startAt: s.etaStartAt, planPaceSec: s.etaPlanPaceSec };
}

export async function GET() {
  const viewer = await getTeamViewer();
  const settings = await getSettings();
  const pin = viewer.onTeam ? wirePin(await getVanPin()) : null;
  return NextResponse.json({ ok: true, settings: etaOf(settings), pin, onTeam: viewer.onTeam });
}

export async function PATCH(req: Request) {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!viewer.onTeam) return NextResponse.json({ ok: false, error: "Not on the team." }, { status: 403 });

  let body: { driveMin?: unknown; startAt?: unknown; planPaceSec?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const patch: { etaDriveMin?: number; etaStartAt?: string | null; etaPlanPaceSec?: number } = {};
  if (body.driveMin !== undefined) {
    const n = Number(body.driveMin);
    if (!Number.isInteger(n) || n < 0 || n > 180) return NextResponse.json({ ok: false, error: "driveMin must be whole minutes, 0 to 180." }, { status: 400 });
    patch.etaDriveMin = n;
  }
  if (body.startAt !== undefined) {
    if (body.startAt === null) patch.etaStartAt = null;
    else {
      const d = typeof body.startAt === "string" ? new Date(body.startAt) : new Date(NaN);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ ok: false, error: "startAt must be a time, or null for the planned start." }, { status: 400 });
      patch.etaStartAt = d.toISOString();
    }
  }
  if (body.planPaceSec !== undefined) {
    const n = Number(body.planPaceSec);
    if (!Number.isInteger(n) || n < PACE_MIN_SEC || n > PACE_MAX_SEC) {
      return NextResponse.json({ ok: false, error: "planPaceSec must be between 4:00 and 20:00 a mile." }, { status: 400 });
    }
    patch.etaPlanPaceSec = n;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });

  try {
    const settings = await updateSettings(patch);
    return NextResponse.json({ ok: true, settings: etaOf(settings) });
  } catch (err) {
    console.error("lasd26/eta PATCH failed (columns pushed?)", err);
    return NextResponse.json({ ok: false, error: "Could not save." }, { status: 500 });
  }
}
