/* poster/raceAssemble.ts — the race becomes an ad.
 *
 * THE RULE THE JUDGES SET, and the reason this file exists: "STRINGS COME
 * FROM raceday.ts, NOT FROM THE ARTWORK. Any real build reads title,
 * meters, when, the hours, venue, room, venueMark, waveTime(r,1) and
 * RACE_ROLES from the definition so the ad can never drift from the page."
 * So poster/raceday.ts — the modules and the plans — holds no copy at all:
 * every word on every frame is built HERE, out of the RaceDef, and moving
 * the race moves the artwork.
 *
 * Pure: no db, no next, no Dates in the output. The studio calls it on the
 * client (the race is code, not a table) and poster/raceData.ts calls it on
 * the server when it also wants the field count and the photograph.
 *
 * Everything comes back UPPERCASE because an ad sets nothing in sentence
 * case, and this is the one place where a race's words become an ad's
 * words — a module that lower-cased or re-worded anything here would be the
 * drift the rule is against.
 *
 * WHAT THE OWNER TOOK OFF THE BILL, 2026-09-11, reading the story ad:
 * "rowed in waves of eight", "new this September", "men and women scored
 * apart" and "sign up by Sat Sep 26". Four of those five lines were built
 * in this file, and they are not built any more — the assembler is the
 * place a line dies, because a module that still asked for one would be a
 * hole on every frame. */

import { RACE_ROLES, hoursLine, waveTime, type RaceDef } from "../raceday";
import type { Racer } from "../racedayData";
import { bySeed } from "../wavePlan";
import type { RaceDayField, RaceDayFieldRow, RaceDayPoster } from "./types";

/* The field so far, as the ad may print it — and, since 2026-09-16, as THE
 * FIELD artwork prints it (owner: "I want a poster showing what racers are
 * coming to race day"). The counts are what the bill always had; the
 * brackets and the list are what the start list needs. The three extras
 * are optional so a count-only caller (the dev bench's ?field=N) still
 * builds a bill; the assembler reads them as nobody. raceFieldOf() below
 * is the one builder that fills all five. */
export type RaceField = {
  racers: number;
  spectators: number;
  men?: number;
  women?: number;
  list?: RaceDayFieldRow[];
};

/* "M" / "W" — the bracket in one letter, off the race's own labels, the
 * way raceday/Field.tsx marks its table. A rower carrying neither still
 * races and still needs a wave: a dash, never a dropped row. */
const bracketMark = (race: RaceDef, division: string): string => {
  const b = race.brackets.find((x) => x.key === division);
  return b ? b.label.slice(0, 1).toUpperCase() : "—";
};

/* THE FIELD OFF THE SIGNUPS — pure, so a scratchpad check can build it from
 * a synthetic Racer[] (the db read is poster/raceData.ts). Withdrawals are
 * off everything; spectators are a count and never a row. The list comes
 * back IN PRINT ORDER: with waves assigned it is by wave and seeded inside
 * each (wavePlan.ts bySeed — fastest first, no 5k last, number breaks the
 * tie; a racer still without a wave sorts after every numbered one), and
 * with no waves yet it is the whole field A to Z. The clock the seed was
 * cut from does not travel: the rows carry no time and no meters. */
export function raceFieldOf(race: RaceDef, racers: Racer[]): RaceField {
  const live = racers.filter((r) => !r.withdrewAt);
  const field = live.filter((r) => r.role === "racer");
  const byWave = field.some((r) => r.wave !== null);
  const waveOf = (r: Racer) => (r.wave === null ? Number.POSITIVE_INFINITY : r.wave);
  const ordered = [...field].sort(
    byWave
      ? (a, b) => waveOf(a) - waveOf(b) || bySeed(a, b)
      : (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.rowerNumber - b.rowerNumber,
  );
  return {
    racers: field.length,
    spectators: live.filter((r) => r.role === "spectator").length,
    men: field.filter((r) => r.division === "M").length,
    women: field.filter((r) => r.division === "F").length,
    list: ordered.map((r) => ({
      rowerNumber: r.rowerNumber,
      name: r.name,
      bracket: bracketMark(race, r.division),
      wave: r.wave,
      lane: r.lane ?? null,
    })),
  };
}

/* "12 RACERS · 7 MEN · 5 WOMEN · 3 SPECTATORS" — the foot strip, counted in
 * English so one of anything is not a plural. */
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function fieldPoster(race: RaceDef, field: RaceField): RaceDayField {
  const list = field.list ?? [];
  const men = field.men ?? 0;
  const women = field.women ?? 0;
  const waveNums = [...new Set(list.map((r) => r.wave).filter((w): w is number => w !== null))].sort(
    (a, b) => a - b,
  );
  return {
    racers: field.racers,
    spectators: field.spectators,
    men,
    women,
    list,
    /* The eyebrow over each wave, off waveTime() and never typed: moving the
     * first wave in the console moves every eyebrow on the list. */
    waves: waveNums.map((w) => ({ wave: w, label: `WAVE ${w} · ${waveTime(race, w).toUpperCase()}` })),
    counts: [
      plural(field.racers, "RACER", "RACERS"),
      plural(men, "MAN", "MEN"),
      plural(women, "WOMAN", "WOMEN"),
      plural(field.spectators, "SPECTATOR", "SPECTATORS"),
    ].join(" · "),
  };
}

/* The photograph the ad is judged over: the owner's pick resolved to a URL
 * (poster/racePhoto.ts, server only) and how he wants it shown. The studio
 * has no way to resolve a key itself, so a client-built payload passes
 * nothing and the preview falls back to the chequer. */
export type RacePhoto = { url: string | null; bw: boolean };

/* Under this many racers the ad says nothing about the field: "3 RACERS IN"
 * sells against you, and an empty start list is the one thing a launch ad
 * must not show (the judges, on the five-row wave grid). */
export const FIELD_FLOOR = 6;

/* THE SHORT ADDRESS (owner, 2026-09-11: "instead of the full URL, just
 * lead them to mikianmusser.com — this is for the race day ads"). A person
 * reading a bill on a wall or a story on a phone types what they can hold
 * in their head, and nobody holds a path. The deep link still works and is
 * still what the site links to; the AD just stops asking anyone to copy
 * it. Which means the root has to carry them onward — the RACE DAY stamp
 * on the rail is that onward, so this address and that link go public on
 * the same day. */
export const RACE_URL = "MIKIANMUSSER.COM";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAY_WORD = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/* "6:00 – 9:00 PM" → "6 – 9 PM". A window in an ad is read, not set by a
 * timer; the minutes are noise at headline size. The sentence itself is
 * never typed — hoursLine(race) derives it from the two instants the
 * settings console moves. */
const shortHours = (hours: string): string => hours.replace(/:00/g, "").toUpperCase();

/* "app.wodify.com" → "WODIFY". The gym's own system is named because the
 * waiver is signed there and nowhere else. */
const hostWord = (host: string): string =>
  (host.split(".").filter((p) => p && p !== "app" && p !== "www" && p !== "com")[0] ?? host).toUpperCase();

/* THE TOWN IS GONE FROM THE AD, and so is the cityOf() that dug it out of
 * venueLine (owner, 2026-09-11: "remove Las Vegas whenever we are saying
 * the strip barbell engine room"). The house block used to set THE ENGINE
 * ROOM over LAS VEGAS and the caption used to say "at The Strip Barbell,
 * Las Vegas" a line above "The Engine Room" — the same construction, split
 * over two lines, which is the one he was reading. The mark, the room and
 * the gym's Instagram are the address now.
 *
 * "Race day" → ["RACE", "DAY"]: two words, one a line on a tall frame,
 * joined by the head module on a short one. A one-word title comes back as
 * one line, which the same module draws without a special case. */
const headOf = (title: string): string[] => title.trim().toUpperCase().split(/\s+/).filter(Boolean);

export function raceDayPoster(
  race: RaceDef,
  field: RaceField | null,
  photo: RacePhoto | null = null,
): RaceDayPoster {
  // Noon on the race day, read in UTC: the day never slides a square
  // either way, whatever zone the browser is standing in.
  const day = new Date(`${race.day}T12:00:00Z`);
  const first = waveTime(race, 1).toUpperCase();
  const size = race.waveSize;
  const waiver = race.waiver ? `ON ${hostWord(race.waiver.host)}` : null;
  const hours = shortHours(hoursLine(race));
  /* NOT floored here any more (2026-09-16): the start list wants the rows
   * the bill would not yet mention, so the payload carries the field
   * whenever it could be read and the fact table applies FIELD_FLOOR to
   * its own line. Null still means the read failed. */
  const racers = field ? fieldPoster(race, field) : null;

  /* The caption the artwork ships with, and the home of everything a bill
   * has no room for — the waiver, the wave cadence, the scoring — so the
   * frame can be five lines and the post still say the rest. The studio
   * prints it under the preview to be copied with the file (the judges:
   * "write the caption at the same time as the art"). Sentence case: this
   * one is typed by a person into Instagram, not drawn on ink.
   *
   * The DEADLINE is not here either. closesAt still refuses a late entry,
   * but it no longer announces itself anywhere (owner: "remove
   * registration closes Saturday, September twenty sixth").
   *
   * MEN AND WOMEN ARE SCORED APART is gone from here too. A stream kept it
   * on the theory that the caption is where a bill's overflow goes, and
   * that whether a woman is racing her own field is what decides whether
   * she enters — a fair argument, but the owner struck the line and the
   * caption is the ad he pastes. It took FREE with it: FREE is on the
   * bracket of every frame already, so the post still says it. The RULE is
   * untouched — the two brackets are scored apart on the day, the field
   * block and the results board both say so. */
  const caption = [
    `${race.title.toUpperCase()} — ${race.sub.toLowerCase()}.`,
    `${race.when}, ${hoursLine(race)}, at ${race.venue}.`,
    `${race.room}. First wave ${waveTime(race, 1)}, waves every ${race.waveMinutes} minutes.`,
    /* OPT IN, not sign up — the challenge has one verb for this and it is
     * his (owner, 2026-09-11: "instead of put my name in, the phrase
     * should be opt in"). The slab on every frame says the same word. */
    `Opt in as a racer or as a spectator: ${RACE_URL.toLowerCase()}`,
    ...(race.waiver ? ["", `The gym waiver is signed at ${race.waiver.host} before you row.`] : []),
  ].join("\n");

  return {
    kind: "raceday",
    year: day.getUTCFullYear(),
    race: {
      slug: race.slug,
      head: headOf(race.title),
      piece: race.sub.toUpperCase(),
      firstWave: `FIRST WAVE ${first}`,
      date: `${MON[day.getUTCMonth()]} ${day.getUTCDate()}`,
      dayWord: DAY_WORD[day.getUTCDay()],
      hours,
      every: `WAVES EVERY ${race.waveMinutes} MIN`,
      entry: "FREE",
      entrySub: RACE_ROLES.map((r) => r.label).join(" OR ").toUpperCase(),
      stamp: `${DOW[day.getUTCDay()]} ${MON[day.getUTCMonth()]} ${day.getUTCDate()}`,
      waveSize: size,
      waveLabel: `${size} ERGS A WAVE · EVERY ${race.waveMinutes} MIN`,
      waiver,
      venueMark: race.venueMark,
      sponsorMark: race.sponsor?.mark ?? null,
      venue: race.venue.toUpperCase(),
      room: race.room.toUpperCase(),
      /* A role with no line comes through with none — the spectator's went
       * (owner, 2026-09-11) — and the TWO WAYS IN table sets that label on
       * its own rather than drawing a blank second column. */
      roles: RACE_ROLES.map((r) => ({
        label: r.label.toUpperCase(),
        ...(r.line ? { line: r.line.toUpperCase() } : {}),
      })),
    },
    field: racers,
    /* The owner's own switch travels even when nobody could resolve the
     * key: bw is his call, the URL is the server's job. */
    photo: { url: photo?.url ?? null, bw: photo ? photo.bw : race.photo.bw },
    url: RACE_URL,
    caption,
  };
}
