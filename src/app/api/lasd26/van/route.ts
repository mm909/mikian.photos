import { NextResponse } from "next/server";
import { ensureOwnerMember, getTeamViewer } from "@/lib/lasd26/team";
import { clearVanPin, getVanPin, setVanPin, wirePin } from "@/lib/lasd26/van";

/**
 * /api/lasd26/van — the van's pin (owner, 2026-10-21: "a 'van location'
 * button. This should be only clickable/visible by team members … put a
 * pin/van indicator on the map so the runners will be able to view where
 * the van is … It can just take the location of the user who is clicking
 * the button as the van's location."). All JSON; every method wants a
 * sign-in (401) and a place on the team (403) — the pin is the team's,
 * not the public's, though the route page itself is open.
 *   GET    → { ok, pin: { lat, lon, accuracyM, at, byName } | null }
 *   POST   { lat, lon, accuracyM? } → { ok, pin }: the phone's position
 *            becomes the pin; the old one goes into the log.
 *   DELETE → { ok, cleared }: takes the pin down.
 */
export const runtime = "nodejs";

const signIn = () => NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
const notOnTeam = () => NextResponse.json({ ok: false, error: "Not on the team — you need the invite link from the group chat." }, { status: 403 });

async function member() {
  const viewer = await ensureOwnerMember(await getTeamViewer());
  if (!viewer.actor) return signIn();
  if (!viewer.onTeam) return notOnTeam();
  return viewer;
}

export async function GET() {
  const v = await member();
  if (v instanceof NextResponse) return v;
  return NextResponse.json({ ok: true, pin: wirePin(await getVanPin()) });
}

export async function POST(req: Request) {
  const v = await member();
  if (v instanceof NextResponse) return v;
  let body: { lat?: unknown; lon?: unknown; accuracyM?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const accuracyM = body.accuracyM === undefined ? 0 : Number(body.accuracyM);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ ok: false, error: "lat and lon must be a position." }, { status: 400 });
  }
  if (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 100_000) {
    return NextResponse.json({ ok: false, error: "accuracyM must be metres." }, { status: 400 });
  }
  try {
    const pin = await setVanPin({ lat, lon, accuracyM, byId: v.member?.id ?? null, byName: v.member?.name ?? v.actor?.name ?? "" });
    return NextResponse.json({ ok: true, pin: wirePin(pin) }, { status: 201 });
  } catch (err) {
    console.error("lasd26/van POST failed (table pushed?)", err);
    return NextResponse.json({ ok: false, error: "Could not save the pin." }, { status: 500 });
  }
}

export async function DELETE() {
  const v = await member();
  if (v instanceof NextResponse) return v;
  try {
    const cleared = await clearVanPin();
    return NextResponse.json({ ok: true, cleared });
  } catch (err) {
    console.error("lasd26/van DELETE failed", err);
    return NextResponse.json({ ok: false, error: "Could not clear the pin." }, { status: 500 });
  }
}
