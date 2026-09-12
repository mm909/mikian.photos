import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOwnerNotification, type SendResult } from "@/lib/email";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { parseRole, raceOpenFor, racePhase } from "@/app/row100k/raceday";
import { resolvedRace } from "@/app/row100k/racedaySettings";
import { listRacers, type Racer } from "@/app/row100k/racedayData";
import { signupNote, type SignupArrival, type SignupEvent } from "@/app/row100k/raceSignupMail";

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
 * THE OWNER GETS A NOTE when a name ARRIVES (2026-09-12: "send me an email
 * whenever someone signs up for race day") — a new entry, or somebody
 * coming back after withdrawing. Not a role switch, not a re-press. The
 * words are raceSignupMail.ts and the sending is tellTheOwner below; both
 * are downstream of the write, so the mail can never cost a signup.
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

/* ------------------------------------------------------- telling the owner */

/* HOW LONG A ROWER WAITS FOR THE OWNER'S MAIL, at the very worst. The send
 * IS awaited — see below for why it has to be — so this is the ceiling it
 * is awaited under, and the only latency this feature can ever add to the
 * button. Four seconds is long enough that a healthy Resend (a couple of
 * hundred ms) never sees it and short enough that a hung one is a blink,
 * not a spinner somebody gives up on. */
const MAIL_WAIT_MS = 4000;

/* THE NOTE GOES OUT AND IT CANNOT COST A SIGNUP (owner, 2026-09-12: "send
 * me an email whenever someone signs up for race day"). Three things make
 * that true, and all three are needed:
 *
 * 1. IT RUNS AFTER THE WRITE. By the time this is called the RowRaceSignup
 *    row is committed and the field has already been re-read — so there is
 *    no outcome where the mail happens and the row does not. The tally the
 *    note carries is the field AFTERWARDS for the same reason.
 * 2. NOTHING IN HERE CAN THROW UPWARDS. sendOwnerNotification already
 *    returns a SendResult rather than throwing (lib/email), and with no
 *    RESEND_API_KEY it logs and returns ok — but the try/catch is here
 *    anyway, because "the mailer never throws" is a promise made in another
 *    file and a rower's entry must not depend on it staying true. THE NOTE
 *    IS BUILT INSIDE THE TRY for the same reason: signupNote is pure and
 *    has no business throwing, and if it ever did while sitting outside
 *    this net it would 500 a rower whose row is already written — the one
 *    shape of this feature that would be worse than no mail at all.
 * 3. IT IS AWAITED, UNDER A CLOCK. Awaited because this is a serverless
 *    function: return the response with a promise still floating and Vercel
 *    may freeze the instance the moment the body is flushed, which turns
 *    the mail into a coin flip that also fires late on the NEXT rower's
 *    request when the instance thaws. Next 14 gives a route handler no
 *    after()/waitUntil, so there is no honest way to do work past the
 *    response. Under a clock because awaiting an unbounded fetch would hand
 *    a stuck Resend the power to hold the button open until the platform's
 *    own timeout. Promise.race subscribes to both sides, so the send losing
 *    the race is still a handled promise, never an unhandled rejection.
 *
 * Failure is a console.error and nothing else. The rower is in the field
 * either way, and the door list at /row100k/race-admin is the source of
 * truth the owner actually runs the evening off — this mail is a nudge
 * towards it, not a record of anything. */
async function tellTheOwner(a: SignupArrival): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const note = signupNote(a);
    const capped = new Promise<SendResult>((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, error: `no answer in ${MAIL_WAIT_MS}ms` }), MAIL_WAIT_MS);
    });
    /* Reply-to the signer: the natural answer to this mail is to answer the
     * person who caused it. */
    const sent = await Promise.race([sendOwnerNotification(note.subject, note.text, a.email), capped]);
    if (!sent.ok) console.error(`row100k raceday: signup note not sent — ${sent.error}`);
  } catch (err) {
    console.error("row100k raceday: signup note blew up (the signup stands)", err);
  } finally {
    /* So a send that answers in 200ms does not leave the runtime holding a
     * four-second timer open behind it. */
    if (timer) clearTimeout(timer);
  }
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

  /* WHAT THE OWNER GETS TOLD ABOUT, set below and acted on at the foot of
   * the handler — null for everything that is not news. A ROLE SWITCH IS
   * NOT NEWS (see raceSignupMail): same body, same room. Neither is
   * pressing PUT MY NAME IN twice, which is what a page that re-posts on
   * render would do, and which is the real reason this is decided by
   * reading the row rather than by the action word. */
  let arrival: SignupEvent | null = null;

  try {
    if (action === "enter") {
      /* THE ROW AS IT WAS, one extra read, because an upsert will not say
       * which half of itself it ran. No row is somebody new; a row with a
       * withdrawal stamp on it is somebody coming back — both are a name
       * arriving in the field. A live row is a switch or a re-press. */
      const before = await db.rowRaceSignup.findUnique({
        where: { race_participantId: { race: race.slug, participantId: p.id } },
        select: { withdrewAt: true },
      });
      arrival = !before ? "new" : before.withdrewAt ? "returning" : null;

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
        /* TO BE TOLD ABOUT WITHDRAWALS TOO, this is the line — `arrival =
         * "withdrew";` right here, inside the if, so a rower withdrawing
         * twice is still one note. The wording already exists
         * (raceSignupMail NEWS.withdrew) and the tally below is read after
         * the write, so it would be correct on the way down. He asked for
         * sign-ups; a shrinking field is his call to make, not mine. */
      }
    }
  } catch (err) {
    console.error(`row100k raceday: ${action} failed`, err);
    return bad("Couldn't take that — has the table been pushed?", 503);
  }

  const racers = await listRacers(race);
  const mine = racers.find((r) => r.participantId === p.id) ?? null;
  const tally = counts(racers);

  /* THE NOTE, at the one place a new arrival is known and the field has
   * already been counted. `mine` rather than the request body: it is the
   * row as the door list reads it, so the name, number and bracket in the
   * mail are the ones the owner will see when he follows the link.
   *
   * AND IT SENDS EVEN WHEN THAT READ FAILED. listRacers fails OPEN — a
   * database hiccup on the re-read returns an empty field, not an error —
   * so gating the note on `mine` meant a real signup could be written,
   * confirmed to the rower, and never mentioned to the owner. That is the
   * one failure of this feature he could not detect: a silent miss on the
   * single event he asked to be told about. The row is already committed
   * by here, so we fall back to what the request itself knows — the
   * participant and the role they pressed — and say plainly that the
   * tallies could not be read rather than printing two zeros he would
   * believe. A note with a number and no name beats no note. */
  if (arrival) {
    const known = mine !== null;
    await tellTheOwner({
      race,
      event: arrival,
      name: mine?.name ?? "",
      rowerNumber: mine?.rowerNumber ?? p.rowerNumber,
      role: mine?.role ?? role,
      division: mine?.division ?? p.division,
      email: mine?.email ?? actor.email,
      racing: known ? tally.total : -1,
      watching: known ? tally.spectators : -1,
    });
  }

  return NextResponse.json({ ok: true, mine, counts: tally });
}
