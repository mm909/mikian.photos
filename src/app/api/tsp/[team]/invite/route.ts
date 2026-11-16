import { NextResponse } from "next/server";
import { originFrom } from "@/app/lasd26/team/fmt";
import { rotateInvite } from "@/lib/lasd26/team";
import { bad, requireTspCaptain } from "@/lib/tsp/guard";
import { tspInviteUrl } from "@/lib/tsp/team";

/**
 * POST /api/tsp/[team]/invite — a captain makes a NEW link; every older one
 * stops working at once (rotating is the only revocation, as on lasd26).
 * The live link itself is handed to the team page by the server.
 */
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTspCaptain(params.team);
  if (gate.res) return gate.res;
  try {
    const made = await rotateInvite(gate.viewer.actor?.photographerId ?? "", params.team);
    return NextResponse.json({ ok: true, url: tspInviteUrl(originFrom((k) => req.headers.get(k)), params.team, made.token), uses: 0 });
  } catch (err) {
    console.error("tsp/invite POST failed", err);
    return bad("Could not make a link.", 500);
  }
}
