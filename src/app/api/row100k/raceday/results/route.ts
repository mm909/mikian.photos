import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";
import { currentRace, raceBySlug, type RaceDef } from "@/app/row100k/raceday";
import { resolvedRace } from "@/app/row100k/racedaySettings";
import {
  ResultError,
  TIME_FORMAT_HINT,
  parseRaceTime,
  parseStoredStatus,
  postOwnTime,
  resultBoard,
  setErgResult,
  setFinal,
  setResult,
  setWaveStart,
  type StoredStatus,
} from "@/app/row100k/raceResults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* RACE-DAY TIMING (owner, 2026-09-16: "Review how racers submit times
 * during race day"). The board is public to read; every write answers
 * with the fresh board so a client repaints from one round trip.
 *
 * GET  ?race=slug                       -> { ok, board }  (no auth; youId
 *      from the session when there is one; never cached)
 * POST { action: "post",  time }        -> a racer posts their own 5k.
 *      Signed in, opted in, a live racer with a wave, inside the posting
 *      window, sheet not posted. 30/h per participant.
 * POST { action: "set",   id, time?, status?, lane? }   admin only
 * POST { action: "erg",   rowerNumber, tenths }         admin only — the
 *      erg console posting the finish a PM5 showed (raceResults.ts
 *      setErgResult)
 * POST { action: "wave",  wave, started }               admin only
 * POST { action: "final", on }                          admin only
 *
 * Errors: 400 with the helper's message, 401 signed out, 403 not allowed,
 * 404 no such racer, 409 the sheet is posted / window shut, 503 database.
 * The rules themselves live in raceResults.ts; this is the door. */

const NO_STORE = { "Cache-Control": "no-store" };

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

type Guarded = { actor: { photographerId: string; email: string } } | { res: NextResponse };

/* Same guard idiom as raceday/waves: admin, and a limit high enough to
 * time a whole field by hand and low enough that a stuck key cannot. */
async function adminGuard(): Promise<Guarded> {
  const actor = await getEffectiveActor();
  if (!actor) return { res: bad("Sign in with Google first.", 401) };
  if (!isRow100kAdmin(actor.email, actor.roles)) return { res: bad("Not allowed.", 403) };
  const limit = await rateLimit({ key: `row100k-raceday-results:${actor.photographerId}`, limit: 300, windowSec: 3600 });
  if (!limit.ok) {
    return {
      res: NextResponse.json(
        { ok: false, error: "Too many changes at once — try again in a bit." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
      ),
    };
  }
  return { actor };
}

async function raceFor(slug: unknown): Promise<RaceDef | null> {
  const base = typeof slug === "string" && slug ? raceBySlug(slug) : currentRace();
  if (!base) return null;
  return resolvedRace(base.slug);
}

/* The board, with the viewer's own row marked when they have one. Never
 * throws — resultBoard fails open and so does resolveViewer. */
async function boardFor(race: RaceDef) {
  const viewer = await resolveViewer();
  return resultBoard(race, { youParticipantId: viewer.myParticipantId });
}

const answer = async (race: RaceDef, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: true, ...extra, board: await boardFor(race) }, { headers: NO_STORE });

/* A refusal from the helper keeps its status; anything else is the
 * database and answers 503 with a printable line. */
function failed(err: unknown, what: string) {
  if (err instanceof ResultError) return bad(err.message, err.status);
  console.error(`row100k raceday: ${what} failed`, err);
  return bad("Couldn't save that — try again.", 503);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const race = await raceFor(url.searchParams.get("race") ?? undefined);
  if (!race) return bad("No such race.", 404);
  return answer(race);
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await readBody(req);
  if (!body) return bad("Send JSON.");
  const action = body.action;
  const race = await raceFor(body.race);
  if (!race) return bad("No such race.", 404);

  /* ------------------------------------------------------- a racer posts */
  if (action === "post") {
    const actor = await getEffectiveActor();
    if (!actor) return bad("Sign in with Google first.", 401);
    let p: { id: string } | null;
    try {
      p = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { id: true },
      });
    } catch (err) {
      console.error("row100k raceday: participant lookup failed before a post", err);
      return bad("Couldn't save that — try again.", 503);
    }
    if (!p) return bad("Opt in to Rowtember first.", 403);
    const limit = await rateLimit({ key: `row100k-raceday-post:${p.id}`, limit: 30, windowSec: 3600 });
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many posts at once — try again in a bit." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
      );
    }
    const text = typeof body.time === "string" ? body.time : "";
    try {
      const posted = await postOwnTime({ race, participantId: p.id, text });
      return answer(race, { posted });
    } catch (err) {
      return failed(err, "own time post");
    }
  }

  /* ------------------------------------------------------ the owner's verbs */
  const g = await adminGuard();
  if ("res" in g) return g.res;
  const by = g.actor.email;

  if (action === "set") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return bad("Which racer?");
    /* time: absent leaves it, null clears it, a string is parsed. */
    let tenths: number | null | undefined;
    if ("time" in body) {
      if (body.time === null || body.time === "") tenths = null;
      else if (typeof body.time !== "string") return bad(TIME_FORMAT_HINT);
      else {
        const t = parseRaceTime(body.time);
        if (t === null) return bad(TIME_FORMAT_HINT);
        tenths = t;
      }
    }
    let status: StoredStatus | undefined;
    if ("status" in body) {
      const s = parseStoredStatus(body.status);
      if (!s) return bad("Status is to_come, finished or dnf.");
      status = s;
    }
    let lane: number | null | undefined;
    if ("lane" in body) {
      lane = body.lane === null || body.lane === "" ? null : Number(body.lane);
    }
    try {
      await setResult({ race, id, tenths, status, lane, by });
      return answer(race);
    } catch (err) {
      return failed(err, "result set");
    }
  }

  if (action === "erg") {
    const n = Number(body.rowerNumber);
    const tenths = Number(body.tenths);
    if (!Number.isInteger(n) || n < 1) return bad("Which rower?");
    if (!Number.isInteger(tenths) || tenths <= 0) return bad("A time, in tenths of a second.");
    try {
      const posted = await setErgResult({ race, rowerNumber: n, tenths, by });
      return answer(race, { posted });
    } catch (err) {
      return failed(err, "erg result");
    }
  }

  if (action === "wave") {
    const wave = Number(body.wave);
    if (typeof body.started !== "boolean") return bad("Say whether the wave started: true or false.");
    try {
      await setWaveStart({ race, wave, started: body.started, by });
      return answer(race);
    } catch (err) {
      return failed(err, "wave stamp");
    }
  }

  if (action === "final") {
    if (typeof body.on !== "boolean") return bad("Say whether the sheet is posted: true or false.");
    try {
      await setFinal({ race, on: body.on, by });
      return answer(race);
    } catch (err) {
      return failed(err, "final switch");
    }
  }

  return bad("Unknown action.");
}
