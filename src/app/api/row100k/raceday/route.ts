import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { parseRole, raceOpenFor, racePhase } from "@/app/row100k/raceday";
import { resolvedRace } from "@/app/row100k/racedaySettings";
import { listRacers, type Racer } from "@/app/row100k/racedayData";

export const runtime = "nodejs";

/* RACE DAY — put my name in, take my name out.
 *
 * POST { action: "enter", role?, waiver? } | { action: "withdraw" }. Signed
 * in, opted in, and only while the race is still taking names
 * (raceday.racePhase). Entering writes the RowRaceSignup row, copying the
 * BRACKET off the rower and the ADDRESS off the account that pressed the
 * button — the two things the wave note needs, frozen as they were at
 * signup.
 *
 * RACER OR SPECTATOR (owner, 2026-09-11: "we need there to be a way to sign
 * up as a spectator versus as just a racer"). The role rides on the SAME
 * enter action rather than getting a verb of its own, so switching is just
 * entering again: a spectator who decides to pull keeps their row, their
 * place in the order and their waiver stamp, and a racer who would rather
 * watch does not have to withdraw first. An unreadable or absent role means
 * RACER — the default the column carries and the thing most people are.
 *
 * A withdrawal STAMPS the row, it never deletes it: coming back clears the
 * stamp and keeps the same row, so a wave already assigned and already
 * emailed survives a rower changing their mind (owner: no cancel that
 * scolds, and nobody should get two different wave emails).
 *
 * Nothing here is money and nothing here is public: the same dev gate the
 * shirt shop wears (raceOpenFor) answers 403 to everyone but an admin in
 * production until the owner opens race day. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

type Action = "enter" | "withdraw";

const parseAction = (v: unknown): Action | null => (v === "enter" || v === "withdraw" ? v : null);

/* What the caller gets back beside their own row: how big the field is, how
 * it splits across the brackets, and how many are only coming to watch.
 * Withdrawals are in neither number, and a SPECTATOR IS NOT IN THE FIELD —
 * the field is the start list. */
function counts(rows: Racer[]) {
  const live = rows.filter((r) => !r.withdrewAt);
  const field = live.filter((r) => r.role === "racer");
  const brackets: Record<string, number> = {};
  for (const r of field) brackets[r.division] = (brackets[r.division] ?? 0) + 1;
  return { total: field.length, brackets, spectators: live.length - field.length };
}

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) return bad("Sign in with Google first.", 401);
  if (!raceOpenFor(isRow100kAdmin(actor.email, actor.roles))) {
    return bad("Race day is not open yet.", 403);
  }

  const p = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
    select: { id: true, rowerNumber: true, division: true },
  });
  if (!p) return bad("Opt in to Rowtember first.", 403);

  const limit = await rateLimit({ key: `row100k-raceday:${p.id}`, limit: 20, windowSec: 3600 });
  if (!limit.ok) return bad("Too many changes at once — try again in a bit.", 429);

  let body: { action?: unknown; role?: unknown; waiver?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }
  const action = parseAction(body.action);
  if (!action) return bad("Say enter or withdraw.");
  const role = parseRole(body.role) ?? "racer";

  // The race AS IT STANDS, the same read the page makes: the gate below is
  // racePhase, and the closed/raced edge is firstWaveAt + 6h — a first wave
  // moved in the console has to move this too, or the button and the page
  // it sits on would disagree about whether the race has been run.
  const race = await resolvedRace();
  // Shut is shut, both ways: after the close nobody can slip a name in, and
  // nobody can quietly disappear off a list the owner has already called
  // waves from. That is an email, not a button.
  if (racePhase(race) !== "open") return bad("Registration for race day is closed.", 409);

  try {
    if (action === "enter") {
      // The waiver is signed on the gym's own system, so all this can do is
      // remember the rower SAYING it is done (owner sent the link
      // 2026-09-11). Ticking stamps it; never un-stamps — a waiver already
      // signed does not come unsigned because somebody re-entered without
      // ticking the box again.
      const said = body.waiver === true;
      /* A SPECTATOR HAS NO WAVE. Turning racer into spectator drops the wave
       * and forgets the telling in the same write, so no ghost can sit in
       * the grid or catch the next run of wave notes. Every reader filters
       * on role too — this is the belt, that is the braces. Turning
       * spectator into racer clears nothing: they simply have no wave yet,
       * and the owner lays the field out again. */
      const asSpectator = role === "spectator" ? { wave: null, waveEmailedAt: null } : {};
      await db.rowRaceSignup.upsert({
        where: { race_participantId: { race: race.slug, participantId: p.id } },
        // Coming back: the row and its wave stay, the stamp comes off, and
        // the role, bracket and address are refreshed to what they are now.
        update: {
          withdrewAt: null,
          role,
          rowerNumber: p.rowerNumber,
          division: p.division,
          email: actor.email,
          ...asSpectator,
          ...(said ? { waiverAt: new Date() } : {}),
        },
        create: {
          challenge: CHALLENGE,
          race: race.slug,
          participantId: p.id,
          role,
          rowerNumber: p.rowerNumber,
          division: p.division,
          email: actor.email,
          waiverAt: said ? new Date() : null,
        },
        select: { id: true },
      });
    } else {
      const existing = await db.rowRaceSignup.findUnique({
        where: { race_participantId: { race: race.slug, participantId: p.id } },
        select: { id: true, withdrewAt: true },
      });
      if (!existing) return bad("Your name is not on the list.", 409);
      if (!existing.withdrewAt) {
        await db.rowRaceSignup.update({ where: { id: existing.id }, data: { withdrewAt: new Date() } });
      }
    }
  } catch (err) {
    console.error(`row100k raceday: ${action} failed`, err);
    return bad("Couldn't take that — has the table been pushed?", 503);
  }

  const racers = await listRacers(race);
  return NextResponse.json({
    ok: true,
    mine: racers.find((r) => r.participantId === p.id) ?? null,
    counts: counts(racers),
  });
}
