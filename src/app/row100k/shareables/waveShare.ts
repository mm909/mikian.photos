import { hoursLine, waveTime, type RaceDef } from "../raceday";
import { myRacer, type Racer } from "../racedayData";
import { resolvedRace } from "../racedaySettings";
import type { ShareData } from "../share/cards";

/* MY WAVE, fed to a rower's own deck (owner, 2026-09-16: "For race day add
 * a shareable that shows their wave and start time"). Server only: it reads
 * the race as it stands and the rower's own signup.
 *
 * ONE GATE, HERE: a card may print a wave only when the rower has BEEN TOLD
 * it — the wave note is how they learn it, and a wave the grid still holds
 * unsent can move. toldWave is that rule; SignupPanel applies the same one
 * client-side off the row it already holds. Never call this for anybody but
 * the viewer themself or an admin looking at them: the payload it returns is
 * that rower's, and it goes to a client component. */

export type RaceShareBlock = NonNullable<ShareData["race"]>;

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/* The race as the cards print it — the same derivation raceday/page.tsx
 * makes for the bill (stamp off race.day at noon UTC, hoursLine with the
 * :00s dropped, the room alone), so a card from the front page and one from
 * race day say the same evening. */
export function raceFactsOf(race: RaceDef): RaceShareBlock {
  const day = new Date(`${race.day}T12:00:00Z`);
  const stamp = `${DOW[day.getUTCDay()]} ${MON[day.getUTCMonth()]} ${day.getUTCDate()}`;
  const hours = hoursLine(race).replace(/:00/g, "");
  return {
    title: race.title.toUpperCase(),
    sub: race.sub.toUpperCase(),
    when: `${stamp} · ${hours}`,
    where: race.room.toUpperCase(),
    mark: race.venueMark,
    sponsor: race.sponsor?.mark ?? null,
  };
}

/* The rower's wave, only once the note has gone out: a racer, still in,
 * with a wave, emailed. Null otherwise. */
export function toldWave(race: RaceDef, racer: Racer | null | undefined): RaceShareBlock["mine"] | null {
  if (!racer || racer.role !== "racer" || racer.withdrewAt !== null) return null;
  if (racer.wave === null || racer.waveEmailedAt === null) return null;
  return { wave: racer.wave, time: waveTime(race, racer.wave).toUpperCase() };
}

/* The race block for one rower's own share payload, or undefined when they
 * have no told wave — so the race cards stay out of their picker. Flagged
 * waveOnly (review, 2026-09-16): the block unlocks MY WAVE and nothing
 * else here; the bill and the name stay on the race day page, which builds
 * its block without the flag. Fails open: a signup read that hiccups costs
 * the card, never the page. */
export async function myWaveShare(participantId: string | null): Promise<RaceShareBlock | undefined> {
  if (!participantId) return undefined;
  try {
    const race = await resolvedRace();
    const mine = toldWave(race, await myRacer(race, participantId));
    return mine ? { ...raceFactsOf(race), mine, waveOnly: true } : undefined;
  } catch (err) {
    console.error("row100k: wave share lookup failed — no wave card", err);
    return undefined;
  }
}
