import { db } from "@/lib/db";
import { CHALLENGE, fmtRecordTime, fmtRowerNumber } from "@/lib/row100k";
import { boardData } from "./boardData";
import { parseRole, type RaceDef, type RaceRole } from "./raceday";

/* THE FIELD, read from the database (server only). raceday.ts says what the
 * race IS — day, place, hours, wave size; this says who is in it: every
 * RowRaceSignup row for the race, with the rower hung back on it (their
 * name, number and handle) and the one number the list prints, their
 * fastest 5k.
 *
 * The 5k comes off the SAME record the site computes everywhere else
 * (lib/row100k computeBoards fastest[5000] — best normalized time from any
 * piece of at least 5,000 m), so the racer list can never disagree with the
 * records page about who is quickest.
 *
 * BLACKOUT: a 5k TIME is public even for one of the elite (blackoutRules
 * hides their meters, not their clock — maskBoards never touches the
 * fastest boards), so best5k prints for everybody, window open or not.
 * METERS are the hidden half: they are read through boardData(), the
 * PUBLIC board, and a masked row is carried here as 0 so a page that
 * prints `meters` by accident prints a zero rather than a leak. The signup
 * page never prints it at all — it is here for the wave console, which
 * seeds a grid off it.
 *
 * Every read fails OPEN with a console.error: a missing table or a db
 * hiccup renders an empty field, never a 500 on the signup page. */

export type Racer = {
  id: string;
  participantId: string;
  rowerNumber: number;
  name: string;
  instagram: string;
  /* WHAT THEY SIGNED UP AS (owner, 2026-09-11: "we need there to be a way to
   * sign up as a spectator versus as just a racer"). A racer pulls and gets
   * a wave; a spectator is a body in the room and nothing else. EVERY
   * consumer that hands out a wave, prints the start list or sends the wave
   * note filters on this — a spectator must never be swept into a wave. An
   * unreadable column reads as "racer", which is what every row written
   * before the column existed is. */
  role: RaceRole;
  /* The BRACKET: "M" | "F" (or whatever the rower carries when neither). */
  division: string;
  /* The address the wave note goes to, as it was at signup. */
  email: string;
  /* 1-based wave, null until somebody assigns one. */
  wave: number | null;
  waveEmailedAt: string | null;
  /* When they said they had signed the gym's waiver. Self-reported — the
   * waiver lives on Wodify and this site cannot check it — so it is a
   * chase list, not a gate. */
  waiverAt: string | null;
  /* Set: they took their name out. The row STAYS — a withdrawal is a fact,
   * not a delete — so callers that list the field filter these off. */
  withdrewAt: string | null;
  note: string;
  createdAt: string;
  /* Their fastest 5k this September, null when they have not rowed one. */
  best5k: { seconds: number; text: string; day: string; prorated: boolean } | null;
  /* Their September total. 0 on a row the blackout masks — never print it. */
  meters: number;
};

export const EMPTY_RACERS: Racer[] = [];

/* Every signup for the race, withdrawals included, in the order they put
 * their names in (newest last). The page decides who to show; the wave
 * console needs the withdrawals to know a wave has a hole in it. */
export async function listRacers(race: RaceDef): Promise<Racer[]> {
  let signups: {
    id: string;
    participantId: string;
    rowerNumber: number;
    role: string;
    division: string;
    email: string;
    wave: number | null;
    waveEmailedAt: Date | null;
    waiverAt: Date | null;
    withdrewAt: Date | null;
    note: string;
    createdAt: Date;
  }[];
  try {
    signups = await db.rowRaceSignup.findMany({
      where: { challenge: CHALLENGE, race: race.slug },
      select: {
        id: true,
        participantId: true,
        rowerNumber: true,
        role: true,
        division: true,
        email: true,
        wave: true,
        waveEmailedAt: true,
        waiverAt: true,
        withdrewAt: true,
        note: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    console.error(`row100k raceday: signup read failed for ${race.slug} (table pushed?)`, err);
    return EMPTY_RACERS;
  }
  if (signups.length === 0) return EMPTY_RACERS;

  // The rower behind each signup. A signup whose participant has vanished
  // still lists — as their number — rather than dropping off the field.
  const ids = [...new Set(signups.map((s) => s.participantId))];
  let people = new Map<string, { rowerNumber: number; displayName: string; instagram: string; division: string }>();
  try {
    const rows = await db.rowParticipant.findMany({
      where: { id: { in: ids }, challenge: CHALLENGE },
      select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true },
    });
    people = new Map(rows.map((p) => [p.id, p]));
  } catch (err) {
    console.error(`row100k raceday: rower lookup failed for ${race.slug}`, err);
  }

  // The 5k and the meters, off the public board. Its own failure costs the
  // times, not the list.
  const best = new Map<string, Racer["best5k"]>();
  const meters = new Map<string, number>();
  try {
    const boards = await boardData();
    for (const r of boards.fastest[5000]) {
      best.set(r.participantId, {
        seconds: r.value,
        text: fmtRecordTime(r.value),
        day: r.day,
        prorated: !!r.prorated,
      });
    }
    for (const r of boards.total) meters.set(r.participantId, r.masked ? 0 : r.meters);
  } catch (err) {
    console.error(`row100k raceday: board read failed for ${race.slug}`, err);
  }

  return signups.map((s) => {
    const p = people.get(s.participantId);
    return {
      id: s.id,
      participantId: s.participantId,
      rowerNumber: p?.rowerNumber ?? s.rowerNumber,
      name: p?.displayName ?? `Rower ${fmtRowerNumber(s.rowerNumber)}`,
      instagram: p?.instagram ?? "",
      role: parseRole(s.role) ?? "racer",
      // The bracket recorded at signup wins; it is what a wave was drawn
      // against. Only when the row carries neither M nor F (an "X" rower)
      // does the participant's current division get a say.
      division: s.division === "M" || s.division === "F" ? s.division : (p?.division ?? s.division),
      email: s.email,
      wave: s.wave,
      waveEmailedAt: s.waveEmailedAt?.toISOString() ?? null,
      waiverAt: s.waiverAt?.toISOString() ?? null,
      withdrewAt: s.withdrewAt?.toISOString() ?? null,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
      best5k: best.get(s.participantId) ?? null,
      meters: meters.get(s.participantId) ?? 0,
    };
  });
}

/* One rower's own entry, withdrawn or not — what the signup page asks to
 * decide whether it is offering PUT MY NAME IN or a confirmation. Reads the
 * whole field on purpose: one record rule, one code path, and the board it
 * leans on is cached anyway. Null when signed out, not joined, or not
 * entered. */
export async function myRacer(race: RaceDef, participantId: string | null): Promise<Racer | null> {
  if (!participantId) return null;
  const all = await listRacers(race);
  return all.find((r) => r.participantId === participantId) ?? null;
}
