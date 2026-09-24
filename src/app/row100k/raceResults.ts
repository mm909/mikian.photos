import { db } from "@/lib/db";
import { CHALLENGE, nowMs as challengeNow } from "@/lib/row100k";
import { waveCount, type RaceDef } from "./raceday";
import { listRacers, type Racer } from "./racedayData";
import { raceFinalAt, raceFinalAtStrict, saveRaceFinal } from "./racedaySettings";
import { bySeed } from "./wavePlan";
import type { Bracket, ResultBoard, ResultRacer, ResultWave } from "./raceresults/types";

/* RACE-DAY TIMING, the server half (owner, 2026-09-16: "Review how racers
 * submit times during race day. Make sure that it works as expected ... I
 * feel like it needs to be tested"). Before this nothing stored a race-day
 * time; the board (raceresults/*) was drawn from sample.ts only.
 *
 * WHAT IS STORED: RowRaceSignup.tenths (the 5,000 m, tenths of a second),
 * .status ("to_come" | "finished" | "dnf" — "rowing" is never written, it
 * is derived from the wave clock), .lane, .resultAt, .resultBy ("self" or
 * the admin's email); RowRaceWave.startedAt per wave (the instant the wave
 * was actually sent); RowRaceSettings.finalAt (the sheet is posted).
 *
 * HOW A TIME GETS IN. Two doors: the RACER posts their own from the race
 * day page (postOwnTime — a live racer with a wave, inside the posting
 * window, sheet not posted; posting again overwrites, unless the owner has
 * entered the result), and the OWNER types
 * or corrects any result from the timing console (setResult — any time,
 * sheet posted or not, and the only door once it is). Both land on the same
 * columns, so the board has one source.
 *
 * THE BOARD is resultBoard(): the real ResultBoard in the exact shape
 * raceresults/types.ts draws, built off listRacers + RowRaceWave + finalAt.
 * Every read in it fails OPEN (console.error, empty field) — the wall on
 * race night must never 500. The writes fail LOUD: a time that did not land
 * has to say so.
 *
 * BLACKOUT: a race-day time is public for everybody (times were never
 * masked — racedayData.ts, blackoutRules). Names and numbers are public.
 * Nothing here reads meters, so nothing here can leak them. */

/* ---------------------------------------------------------------- times */

/* Twelve minutes to forty-five, in tenths. A 5,000 m outside that is a
 * typo (a 500 m split, an hour) and is refused rather than posted. */
export const TIME_MIN_TENTHS = 7200;
export const TIME_MAX_TENTHS = 27000;

/* "18:52.3" or "18:52" -> tenths. mm:ss or mm:ss.t, minutes one or two
 * digits, seconds two digits under sixty. SYNTAX ONLY: the range rule is
 * raceTimeRuleBreak, so a caller can tell "not a time" from "not a 5k".
 *
 * NO COLON TOO (review, 2026-09-16): both time boxes open the decimal
 * keypad on a phone, which has digits and a period and no colon, so on the
 * device the night runs on nobody could type 18:52.3. "1852.3", "1852" and
 * "905.0" read as mmss with the same tenth — the last two digits are the
 * seconds, whatever is in front is the minutes. */
export function parseRaceTime(text: string): number | null {
  const m = /^\s*(?:(\d{1,2}):(\d{2})|(\d{3,4}))(?:\.(\d))?\s*$/.exec(text);
  if (!m) return null;
  const mins = m[3] === undefined ? Number(m[1]) : Number(m[3].slice(0, -2));
  const secs = m[3] === undefined ? Number(m[2]) : Number(m[3].slice(-2));
  if (secs >= 60) return null;
  const tenth = m[4] === undefined ? 0 : Number(m[4]);
  return (mins * 60 + secs) * 10 + tenth;
}

/* The one line under a box that could not be read — the route says it too. */
export const TIME_FORMAT_HINT = "Type the time as minutes:seconds.tenths — 18:52.3, or 1852.3 off a number pad.";

/* The refusal to say out loud, or null when the time is a 5,000 m. */
export function raceTimeRuleBreak(tenths: number): string | null {
  if (!Number.isInteger(tenths)) return "That is not a time I can read.";
  if (tenths < TIME_MIN_TENTHS) return `A 5,000 m under ${fmtTenths(TIME_MIN_TENTHS)} is not a 5,000 m — check the clock.`;
  if (tenths > TIME_MAX_TENTHS) return `Times over ${fmtTenths(TIME_MAX_TENTHS)} are not posted — check the clock.`;
  return null;
}

/* Both at once, for a form: the tenths, or the one line to print under
 * the box. */
export function readRaceTime(text: string): { tenths: number } | { error: string } {
  const tenths = parseRaceTime(text);
  if (tenths === null) return { error: TIME_FORMAT_HINT };
  const rule = raceTimeRuleBreak(tenths);
  return rule ? { error: rule } : { tenths };
}

/* 11323 -> "18:52.3". Integer arithmetic, so no float can shave a tenth. */
export function fmtTenths(tenths: number): string {
  const t = Math.max(0, Math.round(tenths));
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${t % 10}`;
}

/* --------------------------------------------------------------- window */

const MIN = 60_000;
/* A racer may post from an hour before the doors open until a day after
 * they shut — late enough that somebody who forgot on the night can still
 * put it in from home, and never once the sheet is posted (the caller
 * checks finalAt; this is the clock alone). */
export const POST_OPENS_BEFORE_MS = 60 * MIN;
export const POST_CLOSES_AFTER_MS = 24 * 3_600_000;
/* A stamped wave is over after this long whether or not every time is in:
 * nobody rows a 5,000 m for forty minutes. */
export const WAVE_ROWED_AFTER_MS = 40 * MIN;

export function postingWindow(race: RaceDef, nowMs: number): { open: boolean; reason?: string } {
  if (nowMs < race.opensAt - POST_OPENS_BEFORE_MS) return { open: false, reason: "Times open an hour before the doors do." };
  if (nowMs > race.endsAt + POST_CLOSES_AFTER_MS) return { open: false, reason: "The window for posting a time has closed." };
  return { open: true };
}

/* ---------------------------------------------------------------- errors */

/* A refusal with a printable message and the HTTP status it deserves.
 * Anything else thrown out of a write is the database, and the route
 * answers 503. */
export class ResultError extends Error {
  status: 400 | 403 | 404 | 409;
  constructor(message: string, status: 400 | 403 | 404 | 409 = 400) {
    super(message);
    this.name = "ResultError";
    this.status = status;
  }
}

export const SHEET_POSTED = "The results are posted — only the owner can change a time now.";
export const OWNER_ENTERED = "The owner has entered your result — ask at the desk to change it.";

/* ---------------------------------------------------------------- board */

export type StoredStatus = "to_come" | "finished" | "dnf";

export function parseStoredStatus(v: unknown): StoredStatus | null {
  return v === "to_come" || v === "finished" || v === "dnf" ? v : null;
}

/* Who is actually pulling: a racer, not withdrawn, with a wave. Same rule
 * the wave console and the wave note use. */
export function liveField(racers: Racer[]): Racer[] {
  return racers.filter((r) => r.role === "racer" && !r.withdrewAt && r.wave !== null);
}

/* The bracket the board files them under. An X rower already had their
 * participant division consulted in listRacers; one still in neither
 * bracket goes under the men's, and says so once in the log. */
function bracketOf(r: Racer): Bracket {
  if (r.division === "M" || r.division === "F") return r.division;
  console.error(`row100k raceday: rower ${r.rowerNumber} is in neither bracket (${r.division}) — filed under M on the board`);
  return "M";
}

/* Lanes for one wave: a stored lane stands; everybody else takes the
 * lowest free erg in seed order (fastest 5k first, wavePlan bySeed), so a
 * wave nobody has reseated reads exactly as the console printed it and a
 * hand-set lane never collides with a derived one. */
function lanesFor(members: Racer[]): Map<string, number> {
  const out = new Map<string, number>();
  const taken = new Set<number>();
  for (const r of members) {
    if (r.lane !== null && r.lane >= 1) {
      out.set(r.id, r.lane);
      taken.add(r.lane);
    }
  }
  let next = 1;
  for (const r of [...members].sort(bySeed)) {
    if (out.has(r.id)) continue;
    while (taken.has(next)) next++;
    out.set(r.id, next);
    taken.add(next);
  }
  return out;
}

type WaveStamp = { wave: number; startedAt: Date | null };

async function readWaveStamps(race: RaceDef): Promise<WaveStamp[]> {
  try {
    return await db.rowRaceWave.findMany({
      where: { challenge: CHALLENGE, race: race.slug },
      select: { wave: true, startedAt: true },
    });
  } catch (err) {
    console.error(`row100k raceday: wave stamps read failed for ${race.slug} — no wave is on the ergs`, err);
    return [];
  }
}

/* THE REAL BOARD. Pass the viewer's participant id for the YOU strip (never
 * from the cast frame). `nowMs` defaults to the challenge clock. */
export async function resultBoard(
  race: RaceDef,
  opts: { youParticipantId?: string | null; nowMs?: number } = {},
): Promise<ResultBoard> {
  const nowMs = opts.nowMs ?? challengeNow();

  let racers: Racer[] = [];
  try {
    racers = await listRacers(race);
  } catch (err) {
    console.error(`row100k raceday: field read failed for ${race.slug} — empty board`, err);
  }
  const [stamps, finalAt] = await Promise.all([readWaveStamps(race), raceFinalAt(race.slug)]);
  const live = liveField(racers);
  const final = finalAt !== null;

  /* The grid: as many waves as the field needs, or as the highest hand-set
   * wave says, whichever is more. */
  const highest = live.reduce((n, r) => Math.max(n, r.wave ?? 0), 0);
  const count = Math.max(waveCount(race, live.length), highest);
  const startedBy = new Map<number, number | null>(stamps.map((s) => [s.wave, s.startedAt ? s.startedAt.getTime() : null]));

  /* WAVE STATE. No stamp: to come. Stamped: rowed once every racer in it
   * has a time or a DNF, or forty minutes have passed, or the sheet is
   * posted; until then it is on the ergs. */
  const waves: ResultWave[] = [];
  for (let n = 1; n <= count; n++) {
    const startedAtMs = startedBy.get(n) ?? null;
    const members = live.filter((r) => r.wave === n);
    let state: ResultWave["state"] = "to_come";
    if (startedAtMs !== null) {
      const allIn = members.every((r) => r.tenths !== null || r.status === "dnf");
      state = final || allIn || nowMs >= startedAtMs + WAVE_ROWED_AFTER_MS ? "rowed" : "on_the_ergs";
    }
    waves.push({ wave: n, scheduledAtMs: race.firstWaveAt + (n - 1) * race.waveMinutes * MIN, startedAtMs, state });
  }
  const stateOf = new Map(waves.map((w) => [w.wave, w.state]));

  /* RACER STATUS: dnf if stored; finished if a time is in; rowing while
   * their wave is on the ergs; else to come. */
  const lanes = new Map<string, number>();
  for (let n = 1; n <= count; n++) for (const [id, lane] of lanesFor(live.filter((r) => r.wave === n))) lanes.set(id, lane);
  const out: ResultRacer[] = live.map((r) => {
    const wave = r.wave as number;
    let status: ResultRacer["status"];
    if (r.status === "dnf") status = "dnf";
    else if (r.tenths !== null) status = "finished";
    else if (stateOf.get(wave) === "on_the_ergs") status = "rowing";
    else status = "to_come";
    return {
      id: r.id,
      name: r.name,
      rowerNumber: r.rowerNumber,
      bracket: bracketOf(r),
      wave,
      lane: lanes.get(r.id) ?? 1,
      status,
      seconds: status === "finished" && r.tenths !== null ? r.tenths / 10 : null,
      best5k: r.best5k ? { seconds: r.best5k.seconds, prorated: r.best5k.prorated } : null,
    };
  });

  /* The last thing anybody typed, stamped or posted; the doors when
   * nothing has happened yet. */
  let updatedAtMs = race.opensAt;
  for (const r of live) if (r.resultAt) updatedAtMs = Math.max(updatedAtMs, Date.parse(r.resultAt) || 0);
  for (const w of waves) if (w.startedAtMs !== null) updatedAtMs = Math.max(updatedAtMs, w.startedAtMs);
  if (finalAt !== null) updatedAtMs = Math.max(updatedAtMs, finalAt);

  const you = opts.youParticipantId ? live.find((r) => r.participantId === opts.youParticipantId) : null;

  return {
    raceSlug: race.slug,
    dateLine: `Race day · ${race.when} · ${race.meters.toLocaleString()} m`,
    /* The gym and the room, no town — same reasoning as sample.ts. */
    placeLine: `${race.venue} · ${race.room}`,
    meters: race.meters,
    ergs: race.waveSize,
    waveMinutes: race.waveMinutes,
    state: final ? "finished" : "midrace",
    nowMs,
    updatedAtMs,
    waves,
    racers: out,
    youId: you?.id ?? null,
    sample: false,
  };
}

/* --------------------------------------------------------------- writes */

/* A RACER POSTS THEIR OWN TIME. Must be a live racer with a wave, inside
 * the posting window, sheet not posted. Posting again overwrites — the
 * later one is the correction — UNLESS the owner has entered the result
 * (review, 2026-09-16: the owner holds the stopwatch; a rower's re-post
 * used to land over a time or a DNF he typed and flip it back to "self").
 * A result the owner CLEARED is not his: the rower may post again then.
 * Throws ResultError on a refusal; anything else is the database. */
export async function postOwnTime(args: {
  race: RaceDef;
  participantId: string;
  text: string;
  nowMs?: number;
}): Promise<{ id: string; tenths: number }> {
  const { race, participantId } = args;
  const nowMs = args.nowMs ?? challengeNow();
  const read = readRaceTime(args.text);
  if ("error" in read) throw new ResultError(read.error);

  const window = postingWindow(race, nowMs);
  if (!window.open) throw new ResultError(window.reason ?? "Posting is closed.", 409);
  /* Strict: a switch that cannot be read refuses the post, never waves it. */
  if ((await raceFinalAtStrict(race.slug)) !== null) throw new ResultError(SHEET_POSTED, 409);

  const row = await db.rowRaceSignup.findUnique({
    where: { race_participantId: { race: race.slug, participantId } },
    select: { id: true, challenge: true, role: true, wave: true, withdrewAt: true, tenths: true, status: true, resultBy: true },
  });
  if (!row || row.challenge !== CHALLENGE) throw new ResultError("Your name is not on the race day list.", 403);
  if (row.role !== "racer") throw new ResultError("You signed up as a spectator — there is no time to post.", 403);
  if (row.withdrewAt) throw new ResultError("You took your name out of race day.", 403);
  if (row.wave === null) throw new ResultError("You have not been given a wave yet — ask at the desk.", 409);
  const ownerHolds = row.resultBy !== "" && row.resultBy !== "self" && (row.tenths !== null || row.status === "dnf");
  if (ownerHolds) throw new ResultError(OWNER_ENTERED, 409);

  await db.rowRaceSignup.update({
    where: { id: row.id },
    data: { tenths: read.tenths, status: "finished", resultAt: new Date(nowMs), resultBy: "self" },
  });
  return { id: row.id, tenths: read.tenths };
}

/* THE OWNER SETS A RESULT — any racer, any time, sheet posted or not.
 * `tenths` absent leaves the time alone; null clears it. `status` absent is
 * implied: a time means finished, no time means to come. "dnf" and
 * "to_come" drop any stored time; "finished" needs one, given or stored.
 * `lane` absent leaves it alone; null clears it. */
export async function setResult(args: {
  race: RaceDef;
  id: string;
  tenths?: number | null;
  status?: StoredStatus;
  lane?: number | null;
  by: string;
  nowMs?: number;
}): Promise<void> {
  const { race, id } = args;
  const nowMs = args.nowMs ?? challengeNow();
  if (!id) throw new ResultError("Which racer?");
  if (args.tenths !== undefined && args.tenths !== null) {
    const rule = raceTimeRuleBreak(args.tenths);
    if (rule) throw new ResultError(rule);
  }
  if (args.lane !== undefined && args.lane !== null && (!Number.isInteger(args.lane) || args.lane < 1 || args.lane > 60)) {
    throw new ResultError("A lane is a whole number from 1 up.");
  }

  const row = await db.rowRaceSignup.findFirst({
    where: { id, challenge: CHALLENGE, race: race.slug },
    select: { id: true, role: true, tenths: true },
  });
  if (!row) throw new ResultError("No such racer.", 404);
  if (row.role !== "racer") throw new ResultError("That one signed up as a spectator — they have no result.", 409);

  const data: { tenths?: number | null; status?: string; lane?: number | null; resultAt: Date; resultBy: string } = {
    resultAt: new Date(nowMs),
    resultBy: args.by.slice(0, 200),
  };
  const status = args.status ?? (args.tenths === undefined ? undefined : args.tenths === null ? "to_come" : "finished");
  if (args.tenths !== undefined) data.tenths = args.tenths;
  if (status === "dnf" || status === "to_come") data.tenths = null;
  if (status === "finished") {
    const tenths = args.tenths === undefined ? row.tenths : args.tenths;
    if (tenths === null) throw new ResultError("A finished racer needs a time.");
    data.tenths = tenths;
  }
  if (status !== undefined) data.status = status;
  if (args.lane !== undefined) data.lane = args.lane;

  await db.rowRaceSignup.update({ where: { id: row.id }, data });
}

/* A TIME OFF THE ERG (owner, 2026-09-24: "make the addition so that the
 * race's result gets automatically published to the race results page when
 * I assign a rower to the row"). The erg console posts the finish the PM5
 * showed for the rower on that erg the moment a 5,000 m piece ends
 * (hub.ts postRaceResult). Admin only, like setResult: the laptop on the
 * wall is the owner's.
 *
 * The racer is found by ROWER NUMBER in this race. No entry is a refusal
 * that says so (the console prints it), not a signup made on the fly. A
 * racer with no wave yet is put in the wave that is on the ergs — the
 * highest one stamped started — or wave 1, because a time with no wave
 * would never reach the board (liveField). The timing console can still
 * correct anything this wrote. */
export async function setErgResult(args: { race: RaceDef; rowerNumber: number; tenths: number; by: string; nowMs?: number }): Promise<{ id: string; wave: number }> {
  const { race } = args;
  const nowMs = args.nowMs ?? challengeNow();
  const rule = raceTimeRuleBreak(args.tenths);
  if (rule) throw new ResultError(rule);
  const row = await db.rowRaceSignup.findFirst({
    where: { challenge: CHALLENGE, race: race.slug, rowerNumber: args.rowerNumber, withdrewAt: null },
    select: { id: true, role: true, wave: true },
  });
  if (!row) throw new ResultError(`Rower ${args.rowerNumber} has no race day entry — opt them in on the race day page first.`, 404);
  if (row.role !== "racer") throw new ResultError(`Rower ${args.rowerNumber} signed up as a spectator — nothing to post.`, 409);
  let wave = row.wave;
  if (wave === null) {
    const started = (await readWaveStamps(race)).filter((s) => s.startedAt).map((s) => s.wave);
    wave = started.length ? Math.max(...started) : 1;
  }
  await db.rowRaceSignup.update({
    where: { id: row.id },
    data: { tenths: args.tenths, status: "finished", wave, resultAt: new Date(nowMs), resultBy: args.by.slice(0, 200) },
  });
  return { id: row.id, wave };
}

/* START A WAVE (the stamp the elapsed clock runs off), or un-start it.
 * A START ON A WAVE ALREADY RUNNING KEEPS ITS STAMP (review, 2026-09-16):
 * two devices on the console, or one whose page loaded before the stamp,
 * used to move it to now — the wall's clock jumped back to 0:00 and the
 * forty-minute rule started over. UNDO is the only thing that moves it. */
export async function setWaveStart(args: { race: RaceDef; wave: number; started: boolean; by: string; nowMs?: number }): Promise<void> {
  const { race, wave } = args;
  const nowMs = args.nowMs ?? challengeNow();
  if (!Number.isInteger(wave) || wave < 1 || wave > 99) throw new ResultError("A wave is a whole number from 1 up.");
  const key = { challenge_race_wave: { challenge: CHALLENGE, race: race.slug, wave } };
  if (args.started) {
    const had = await db.rowRaceWave.findUnique({ where: key, select: { startedAt: true } });
    if (had?.startedAt) return;
  }
  const startedAt = args.started ? new Date(nowMs) : null;
  const updatedBy = args.by.slice(0, 200);
  await db.rowRaceWave.upsert({
    where: key,
    create: { challenge: CHALLENGE, race: race.slug, wave, startedAt, updatedBy },
    update: { startedAt, updatedBy },
  });
}

/* POST THE SHEET, or take it down. Written through racedaySettings.ts
 * (saveRaceFinal) so RowRaceSettings has one writer per column. */
export async function setFinal(args: { race: RaceDef; on: boolean; by: string; nowMs?: number }): Promise<void> {
  await saveRaceFinal(args.race.slug, args.on, args.by, args.nowMs ?? challengeNow());
}
