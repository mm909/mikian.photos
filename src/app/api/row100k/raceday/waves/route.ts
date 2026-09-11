import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPlainEmail } from "@/lib/email";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { currentRace, raceBySlug, waveTime, type RaceDef } from "@/app/row100k/raceday";
import { resolvedRace } from "@/app/row100k/racedaySettings";
import { listRacers, type Racer } from "@/app/row100k/racedayData";
import { waveEmail } from "@/app/row100k/raceEmail";

export const runtime = "nodejs";

/* THE WAVES (owner, 2026-09-10: "we can assign them manually, we can have
 * something to auto-assign them and then be able to assign them manually
 * after that ... and we also should email them what wave they are whenever
 * we assign them"). Admin only, every verb, from /row100k/race-admin.
 *
 * POST { action: "auto",  dryRun?, mix? } — lay the whole field out into
 *      waves. The dry run returns the plan and writes nothing; the real run
 *      writes only the rows whose wave actually moves.
 * POST { action: "set",   id, wave }      — one racer, one wave (null clears
 *      it). The console saves this on change.
 * POST { action: "email", dryRun? }       — the wave note to every racer who
 *      has a wave and has not been told it. The dry run lists them and sends
 *      nothing at all.
 *
 * Writes touch RowRaceSignup and nothing else, and only its `wave` and
 * `waveEmailedAt` columns.
 *
 * SPECTATORS ARE NOT IN ANY OF IT (owner, 2026-09-11). A spectator has no
 * wave, so every verb here filters role === "racer" first: the plan never
 * sees them, a hand-set wave is refused on them, and the mail run skips
 * them. Belt: the signup route also strips the wave off anybody who turns
 * spectator, so there is nothing to sweep up even if a filter were missed.
 *
 * WHY A CHANGED WAVE RE-SENDS: the table remembers WHEN a rower was told,
 * not WHICH wave they were told — so every write that moves a rower forgets
 * the telling (waveEmailedAt = null) and the next EMAIL THE WAVES picks
 * them up again. One column, no drift, and nobody rows at 6:30 because an
 * old note said so. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

type Guarded = { actor: { photographerId: string; email: string } } | { res: NextResponse };

async function guard(): Promise<Guarded> {
  const actor = await getEffectiveActor();
  if (!actor) return { res: bad("Sign in with Google first.", 401) };
  if (!isRow100kAdmin(actor.email, actor.roles)) return { res: bad("Not allowed.", 403) };
  /* Generous — an owner laying out a field clicks a lot — but low enough
   * that a stuck button cannot mail the field forty times over. */
  const limit = await rateLimit({ key: `row100k-raceday-waves:${actor.photographerId}`, limit: 40, windowSec: 3600 });
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

/* ------------------------------------------------------------- the plan */

/* Kept local: a route file exports handlers, and the console declares the
 * shape it expects for itself (the settle panel's idiom). */
type PlanRow = {
  id: string;
  rowerNumber: number;
  name: string;
  division: string;
  /* Their seed, as the console prints it. */
  best5k: string;
  from: number | null;
  to: number;
};

/* THE AUTO RULE — my call, and the owner can overrule it in one line.
 *
 * The brackets race each other, not the clock: men row with men and women
 * with women, so a wave is a real race and the two results tables come off
 * two real fields. Inside a bracket the seed is the fastest 5k on the
 * board, quickest first, filling waveSize at a time — eight people who can
 * see each other. A rower with no 5k yet has nothing to seed on, so they go
 * to the back of their own bracket (owner's brief: "timeless rowers last");
 * a rower in neither bracket brings up the rear of the morning.
 *
 * The brackets run in the order the race lists them (raceday.ts: men, then
 * women) — reorder that array and the morning reorders with it, which is
 * the one knob that needed no switch. MIX is the single override: one
 * field, one seeding, brackets ignored.
 *
 * Withdrawals are not in the plan at all and keep whatever wave they had;
 * nothing is emailed to them (the mail step skips a withdrawal too). */
function planWaves(race: RaceDef, racers: Racer[], mix: boolean): PlanRow[] {
  /* Only people who are actually pulling: a withdrawal is out, and so is
   * anybody who signed up to watch. */
  const live = racers.filter((r) => !r.withdrewAt && r.role === "racer");

  /* Fastest first, no time last, rower number to break a tie — so a dry run
   * and the write that follows it lay out the same morning. */
  const seed = (a: Racer, b: Racer) => {
    const at = a.best5k ? a.best5k.seconds : Number.POSITIVE_INFINITY;
    const bt = b.best5k ? b.best5k.seconds : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.rowerNumber - b.rowerNumber;
  };

  const keys = race.brackets.map((b) => b.key as string);
  const groups: Racer[][] = mix
    ? [live]
    : [...race.brackets.map((b) => live.filter((r) => r.division === b.key)), live.filter((r) => !keys.includes(r.division))];

  const size = Math.max(1, race.waveSize);
  const out: PlanRow[] = [];
  let wave = 1;
  for (const group of groups) {
    if (group.length === 0) continue;
    const seeded = [...group].sort(seed);
    for (let i = 0; i < seeded.length; i++) {
      /* A new bracket always starts a new wave, so nobody races a bracket
       * they are not scored in. */
      if (i > 0 && i % size === 0) wave += 1;
      const r = seeded[i];
      out.push({
        id: r.id,
        rowerNumber: r.rowerNumber,
        name: r.name,
        division: r.division,
        best5k: r.best5k ? r.best5k.text : "",
        from: r.wave,
        to: wave,
      });
    }
    wave += 1;
  }
  return out;
}

/* ------------------------------------------------------------- the verbs */

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  const body = await readBody(req);
  if (!body) return bad("Send JSON.");
  const action = body.action;
  /* The slug is checked against the code first, so a race nobody has heard
   * of is still a 404 — and only then resolved, so every wave time this
   * route prints or mails is the one the console last set
   * (racedaySettings.ts), not the one that shipped in the deploy. */
  const base = typeof body.race === "string" ? raceBySlug(body.race) : currentRace();
  if (!base) return bad("No such race.", 404);
  const race = await resolvedRace(base.slug);
  const dryRun = body.dryRun === true;

  /* ------------------------------------------------------------ one row */
  if (action === "set") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return bad("Which racer?");
    const raw = body.wave;
    const wave = raw === null || raw === "" || raw === undefined ? null : Number(raw);
    if (wave !== null && (!Number.isInteger(wave) || wave < 1 || wave > 99)) {
      return bad("A wave is a whole number from 1 up.");
    }
    try {
      const row = await db.rowRaceSignup.findFirst({
        where: { id, challenge: CHALLENGE, race: race.slug },
        select: { id: true, wave: true, role: true },
      });
      if (!row) return bad("No such racer.", 404);
      /* By hand or by machine, a spectator never lands in a wave. Clearing
       * one is still allowed, in case a row was left holding one. */
      if (row.role === "spectator" && wave !== null) {
        return bad("That one signed up as a spectator — they do not get a wave.", 409);
      }
      const moved = (row.wave ?? null) !== wave;
      await db.rowRaceSignup.update({
        where: { id: row.id },
        /* Moving a rower forgets that they were told — see the note up top. */
        data: moved ? { wave, waveEmailedAt: null } : { wave },
      });
      return NextResponse.json({ ok: true, id: row.id, wave, moved });
    } catch (err) {
      console.error("row100k raceday: wave set failed", err);
      return bad("Couldn't save that wave — try again.", 503);
    }
  }

  /* --------------------------------------------------------- the whole field */
  if (action === "auto") {
    const mix = body.mix === true;
    try {
      const plan = planWaves(race, await listRacers(race), mix);
      const moves = plan.filter((p) => p.from !== p.to);
      if (!dryRun && moves.length > 0) {
        /* All or nothing: half a laid-out field is worse than none. */
        await db.$transaction(
          moves.map((p) =>
            db.rowRaceSignup.updateMany({
              where: { id: p.id, challenge: CHALLENGE, race: race.slug },
              data: { wave: p.to, waveEmailedAt: null },
            }),
          ),
        );
      }
      return NextResponse.json({
        ok: true,
        dryRun,
        mix,
        assigned: plan.length,
        moved: moves.length,
        waves: plan.reduce((n, p) => Math.max(n, p.to), 0),
        plan,
      });
    } catch (err) {
      console.error("row100k raceday: auto-assign failed", err);
      return bad("Couldn't lay out the waves — try again.", 503);
    }
  }

  /* ------------------------------------------------------------- the mail */
  if (action === "email") {
    try {
      const racers = await listRacers(race);
      /* A wave note goes to racers only. A spectator with a stale wave (a
       * row written before the column existed, say) is skipped rather than
       * mailed a start time they are not racing. */
      const due = racers.filter(
        (r) => !r.withdrewAt && r.role === "racer" && r.wave !== null && !r.waveEmailedAt,
      );
      const results: {
        id: string;
        rowerNumber: number;
        name: string;
        email: string;
        wave: number;
        time: string;
        sent: boolean;
        reason: string;
      }[] = [];

      for (const r of due) {
        const wave = r.wave as number;
        const time = waveTime(race, wave);
        const to = r.email.trim();
        if (!to.includes("@")) {
          /* Listed, not sent: the owner needs to see who has no address as
           * plainly as who does. */
          results.push({ id: r.id, rowerNumber: r.rowerNumber, name: r.name, email: "", wave, time, sent: false, reason: "NO ADDRESS" });
          continue;
        }
        if (dryRun) {
          results.push({ id: r.id, rowerNumber: r.rowerNumber, name: r.name, email: to, wave, time, sent: false, reason: "WOULD SEND" });
          continue;
        }
        const mail = waveEmail({
          race,
          name: r.name,
          rowerNumber: r.rowerNumber,
          wave,
          waiverSigned: r.waiverAt !== null,
        });
        const sent = await sendPlainEmail(to, mail.subject, mail.text, mail.html);
        if (sent.ok) {
          await db.rowRaceSignup.updateMany({
            where: { id: r.id, challenge: CHALLENGE, race: race.slug },
            data: { waveEmailedAt: new Date() },
          });
        } else {
          console.error(`row100k raceday: wave email failed for rower ${r.rowerNumber}`, sent.error);
        }
        results.push({
          id: r.id,
          rowerNumber: r.rowerNumber,
          name: r.name,
          email: to,
          wave,
          time,
          sent: sent.ok,
          reason: sent.ok ? "SENT" : "FAILED",
        });
      }

      return NextResponse.json({
        ok: true,
        dryRun,
        due: results.length,
        sent: results.filter((r) => r.sent).length,
        failed: results.filter((r) => !r.sent && r.reason === "FAILED").length,
        results,
      });
    } catch (err) {
      console.error("row100k raceday: wave email run failed", err);
      return bad("Couldn't send the wave notes — try again.", 503);
    }
  }

  return bad("Unknown action.");
}
