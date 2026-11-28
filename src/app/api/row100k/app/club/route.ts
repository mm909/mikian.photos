import { COUNTDOWN_S, join, lobbyOut, members, newId, readLobby, writeLobby, type Lobby } from "@/app/row100k/club";
import { asRower, no, yes } from "../social";

/* ROW CLUB'S LOBBY (row100k/club.ts). GET: the open lobby, or null, and
 * whether this viewer may run one. POST { action }:
 *   open   { title?, meters?, pretend? }  admin: a new lobby, waiting
 *   start                                 admin: the row starts in ten seconds
 *   end                                   admin: the lobby closes
 *   pretend { on }                        admin: the made-up rowers on or off
 *   join                                  any rower: into the open lobby
 * Answers what GET answers. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METERS = [500, 1000, 2000, 5000, 6000, 10000];

async function answer(meId: string, canHost: boolean) {
  const l = await readLobby();
  if (!l) return yes({ lobby: null, canHost });
  return yes({ lobby: lobbyOut(l, await members(l.id), meId), canHost, countdown: COUNTDOWN_S });
}

export async function GET() {
  try {
    const got = await asRower();
    if ("denied" in got) return got.denied;
    return answer(got.me.id, got.viewer.isAdmin);
  } catch (err) {
    console.error("row club: read failed", err);
    return yes({ lobby: null, canHost: false });
  }
}

export async function POST(req: Request) {
  try {
    const got = await asRower();
    if ("denied" in got) return got.denied;
    const { viewer, me } = got;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = body?.action;
    const by = me.id;
    const l = await readLobby();
    if (action === "join") {
      if (!l) return no("No Row Club is open.", 404);
      await join(l.id, me.id);
      return answer(me.id, viewer.isAdmin);
    }
    if (!viewer.isAdmin) return no("Only the host can do that.", 403);
    if (action === "open") {
      const meters = METERS.includes(Number(body?.meters)) ? Number(body?.meters) : 2000;
      const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 40) : "ROW CLUB";
      const next: Lobby = { id: newId(), title, meters, openedAt: Date.now(), startsAt: null, endedAt: null, pretend: body?.pretend === true };
      await writeLobby(next, by);
      await join(next.id, me.id);
      return answer(me.id, true);
    }
    if (!l) return no("No Row Club is open.", 404);
    if (action === "start") {
      if (l.startsAt) return answer(me.id, true);
      await writeLobby({ ...l, startsAt: Date.now() + COUNTDOWN_S * 1000 }, by);
      return answer(me.id, true);
    }
    if (action === "pretend") {
      await writeLobby({ ...l, pretend: body?.on === true }, by);
      return answer(me.id, true);
    }
    if (action === "end") {
      await writeLobby({ ...l, endedAt: Date.now() }, by);
      return answer(me.id, true);
    }
    return no("Not an action.", 400);
  } catch (err) {
    console.error("row club: write failed", err);
    return no("Row Club could not be saved. Try again.", 500);
  }
}
