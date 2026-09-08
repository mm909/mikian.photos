import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin, nowMs } from "@/lib/row100k";
import { raffleBySlug, rafflePhase } from "@/app/row100k/raffles";
import { raffleEntrants, raffleState } from "@/app/row100k/raffleData";

export const runtime = "nodejs";

/* THE RAFFLE — draw and switch (owner, 2026-09-08). Admin only on every
 * verb, JSON 401/403 like the blackout route; /row100k/raffles is the page
 * that calls this and it already 404s everyone else.
 *
 * POST  { slug, early?, again? } — draw the winner. Refuses while the
 *       window is still taking entries unless `early` is true (the page
 *       makes that a deliberate second step), and refuses to overwrite a
 *       winner unless `again` is true. One ticket per rower in the hat,
 *       admins left out (raffleData.ts), crypto.randomInt for the pick.
 *       The row remembers the winner with the meters and the rows they
 *       had at the draw, who drew, and how big the hat was.
 * PATCH { slug, ctaLive? , clear? } — flip the partner's second-chance
 *       link live or hidden on the partners page; `clear` forgets the
 *       winner (a wrong draw, a test), leaving the switch alone. */

type Guarded = { actor: { photographerId: string; email: string } } | { res: NextResponse };

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function guard(): Promise<Guarded> {
  const actor = await getEffectiveActor();
  if (!actor) return { res: bad("Sign in with Google first.", 401) };
  if (!isRow100kAdmin(actor.email, actor.roles)) return { res: bad("Not allowed.", 403) };
  const limit = await rateLimit({ key: `row100k-raffle:${actor.photographerId}`, limit: 30, windowSec: 3600 });
  if (!limit.ok) {
    return {
      res: NextResponse.json(
        { ok: false, error: "Too many changes at once — try again in a bit." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
      ),
    };
  }
  return { actor };
}

async function readBody<T extends object>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  const body = await readBody<{ slug?: unknown; early?: unknown; again?: unknown }>(req);
  if (!body) return bad("Send JSON.");
  const r = typeof body.slug === "string" ? raffleBySlug(body.slug) : null;
  if (!r) return bad("No such raffle.", 404);

  const phase = rafflePhase(r);
  if (phase === "before") return bad("The window has not opened yet — nobody can be in the hat.", 409);
  if (phase === "open" && body.early !== true) {
    return bad(`Entries are still open — ${r.closesLine.toLowerCase()}. Draw early only on purpose.`, 409);
  }

  try {
    const current = await raffleState(r.slug);
    if (current.winner && body.again !== true) {
      return bad(`Already drawn — ${current.winner.name} holds the ticket. Draw again to replace them.`, 409);
    }

    const hat = (await raffleEntrants(r)).filter((e) => !e.admin);
    if (hat.length === 0) return bad("Nobody is in the hat yet.", 409);

    const pick = hat[randomInt(hat.length)];
    const drawnAt = new Date(nowMs());
    const data = {
      winnerParticipantId: pick.participantId,
      winnerRowerNumber: pick.rowerNumber,
      winnerName: pick.name,
      winnerMeters: pick.meters,
      winnerRows: pick.rows,
      entrants: hat.length,
      drawnAt,
      drawnBy: g.actor.email,
    };
    await db.rowRaffle.upsert({
      where: { challenge_slug: { challenge: CHALLENGE, slug: r.slug } },
      create: { challenge: CHALLENGE, slug: r.slug, ...data },
      update: data,
    });
    return NextResponse.json({
      ok: true,
      winner: {
        participantId: pick.participantId,
        rowerNumber: pick.rowerNumber,
        name: pick.name,
        meters: pick.meters,
        rows: pick.rows,
        drawnAt: drawnAt.toISOString(),
        drawnBy: g.actor.email,
        entrants: hat.length,
      },
    });
  } catch (err) {
    console.error("row100k raffle: draw failed", err);
    return bad("Couldn't draw — has the RowRaffle table been pushed?", 503);
  }
}

export async function PATCH(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  const body = await readBody<{ slug?: unknown; ctaLive?: unknown; clear?: unknown }>(req);
  if (!body) return bad("Send JSON.");
  const r = typeof body.slug === "string" ? raffleBySlug(body.slug) : null;
  if (!r) return bad("No such raffle.", 404);

  const data: {
    ctaLive?: boolean;
    winnerParticipantId?: null;
    winnerRowerNumber?: null;
    winnerName?: null;
    winnerMeters?: null;
    winnerRows?: null;
    entrants?: null;
    drawnAt?: null;
    drawnBy?: string;
  } = {};
  if (typeof body.ctaLive === "boolean") data.ctaLive = body.ctaLive;
  if (body.clear === true) {
    Object.assign(data, {
      winnerParticipantId: null,
      winnerRowerNumber: null,
      winnerName: null,
      winnerMeters: null,
      winnerRows: null,
      entrants: null,
      drawnAt: null,
      drawnBy: "",
    });
  }
  if (Object.keys(data).length === 0) return bad("Nothing to change.");

  try {
    await db.rowRaffle.upsert({
      where: { challenge_slug: { challenge: CHALLENGE, slug: r.slug } },
      create: { challenge: CHALLENGE, slug: r.slug, ctaLive: data.ctaLive ?? false },
      update: data,
    });
    return NextResponse.json({ ok: true, state: await raffleState(r.slug) });
  } catch (err) {
    console.error("row100k raffle: update failed", err);
    return bad("Couldn't save that — has the RowRaffle table been pushed?", 503);
  }
}
