import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import {
  currentRace,
  hoursLine,
  raceBySlug,
  withOverrides,
  type RaceDef,
  type RaceOverrides,
} from "./raceday";

/* THE RACE, AS THE CONSOLE MAY MOVE IT (owner, 2026-09-11: "let us make the
 * start time and end time and first wave time all changeable in the settings
 * menu"). Server only.
 *
 * raceday.ts says what the race IS — the code default, the thing that ships
 * in a deploy. This reads the ONE RowRaceSettings row that may sit over it
 * and hands back the race as it actually stands. Every server surface that
 * prints a race time should read it from here, not from currentRace(), or a
 * time the owner moved at 4 PM would still be wrong on the page at 5.
 *
 * A NULL COLUMN IS NOT A VALUE, it is the absence of one: the key is left
 * off the overrides entirely so withOverrides falls through to the code
 * default. That is what makes USE THE DEFAULT a one-column write rather
 * than a copy of the deploy-time number into the database, where it would
 * quietly go stale the next time the definition changed.
 *
 * EVERY READ FAILS OPEN, loudly (console.error) but without throwing: a
 * settings row that cannot be read must cost the overrides, never the page.
 * The signup page 500ing on race day because a table hiccuped is the one
 * outcome worth engineering against. Writes do NOT fail open — a save that
 * did not land has to say so. The ONE read that also refuses to fail open
 * is the one the API takes before a write (raceOverridesStrict): a check
 * run against a half-read set of overrides is not a check. */

/* What a write may carry. Three states per key, and they all mean something
 * different: absent leaves the column alone, null clears the override back
 * to the code default, a value sets it. */
export type RaceSettingsPatch = {
  opensAt?: number | null;
  endsAt?: number | null;
  firstWaveAt?: number | null;
  waveMinutes?: number | null;
  waveSize?: number | null;
  photoKey?: string | null;
  photoBw?: boolean;
};

/* The race as the console draws it: what stands now, and what the code says,
 * so every field can print its default beside it and offer to go back to it.
 * Plain numbers — it crosses to a client component. */
export type RaceSettingsView = {
  slug: string;
  /* Race day itself, "2026-09-27". Not overridable — it is what every stamp
   * on the site prints — and carried here so the console can warn when a
   * typed time has wandered off it. */
  day: string;
  opensAt: number;
  endsAt: number;
  firstWaveAt: number;
  waveMinutes: number;
  waveSize: number;
  photoKey: string | null;
  photoBw: boolean;
  /* "6:00 – 9:00 PM", already derived, so the panel never types the hours
   * out either. */
  hours: string;
  defaults: {
    opensAt: number;
    endsAt: number;
    firstWaveAt: number;
    waveMinutes: number;
    waveSize: number;
    photoKey: string | null;
    photoBw: boolean;
  };
};

/* ------------------------------------------------------------------ read */

/* THE ONE QUERY. Throws on a database failure; the two readers below are
 * the same read with two different answers to what a failure costs. */
async function readOverrides(slug: string): Promise<RaceOverrides> {
  const row = await db.rowRaceSettings.findUnique({
    where: { challenge_race: { challenge: CHALLENGE, race: slug } },
    select: {
      opensAt: true,
      endsAt: true,
      firstWaveAt: true,
      waveMinutes: true,
      waveSize: true,
      photoKey: true,
      photoBw: true,
    },
  });
  if (!row) return {};
  const o: RaceOverrides = {};
  /* Dates in, epoch ms out — RaceOverrides is plain numbers so it can
   * cross to a client component without a Date turning into a string. */
  if (row.opensAt) o.opensAt = row.opensAt.getTime();
  if (row.endsAt) o.endsAt = row.endsAt.getTime();
  if (row.firstWaveAt) o.firstWaveAt = row.firstWaveAt.getTime();
  if (row.waveMinutes !== null) o.waveMinutes = row.waveMinutes;
  if (row.waveSize !== null) o.waveSize = row.waveSize;
  /* An empty string is nobody's photo key; treat it as no pick at all. */
  if (row.photoKey) o.photoKey = row.photoKey;
  /* The one column that cannot be null: a row always carries a bw answer,
   * and its database default is the same true the code has. */
  o.photoBw = row.photoBw;
  return o;
}

/* The overrides sitting over one race, or an empty set when there is no row
 * — or when the row cannot be read. For PAGES: a settings hiccup costs the
 * overrides, never the render. */
export async function raceOverrides(slug: string): Promise<RaceOverrides> {
  try {
    return await readOverrides(slug);
  } catch (err) {
    console.error(`row100k raceday: settings read failed for ${slug} — the code default stands`, err);
    return {};
  }
}

/* THE SAME READ WITHOUT THE NET, for the one caller that must not fail open:
 * the API folding a patch onto what is stored to see whether the result is
 * allowed. Fail open there and a read that hiccups hides a stored 8:45 PM
 * first wave, the check sees the code default instead, and the doors get
 * written shut at 8:00 — the exact combination the try-on exists to refuse.
 * A page may guess; the guard that says no may not. */
export async function raceOverridesStrict(slug: string): Promise<RaceOverrides> {
  return readOverrides(slug);
}

/* The race as it stands, plus everything the console needs to draw it. One
 * database read, so a page that wants both does not pay twice. An unknown
 * slug falls back to the current race rather than throwing — this is never
 * allowed to be the thing that breaks a page. */
export async function raceWithSettings(slug?: string): Promise<{ race: RaceDef; view: RaceSettingsView }> {
  const base = (slug ? raceBySlug(slug) : null) ?? currentRace();
  const race = withOverrides(base, await raceOverrides(base.slug));
  return { race, view: settingsView(base, race) };
}

/* The race as it stands. THE function every server surface should call. */
export async function resolvedRace(slug?: string): Promise<RaceDef> {
  return (await raceWithSettings(slug)).race;
}

function settingsView(base: RaceDef, race: RaceDef): RaceSettingsView {
  return {
    slug: base.slug,
    day: base.day,
    opensAt: race.opensAt,
    endsAt: race.endsAt,
    firstWaveAt: race.firstWaveAt,
    waveMinutes: race.waveMinutes,
    waveSize: race.waveSize,
    photoKey: race.photo.key,
    photoBw: race.photo.bw,
    hours: hoursLine(race),
    defaults: {
      opensAt: base.opensAt,
      endsAt: base.endsAt,
      firstWaveAt: base.firstWaveAt,
      waveMinutes: base.waveMinutes,
      waveSize: base.waveSize,
      photoKey: base.photo.key,
      photoBw: base.photo.bw,
    },
  };
}

/* ----------------------------------------------------------------- merge */

/* What the overrides WOULD be if a patch landed — pure, so the API can try
 * a change on for size (do the doors still make sense? is the first wave
 * still inside them?) before it writes anything. A patch key holding null
 * removes the override, which is exactly what the column going null does. */
export function mergeOverrides(now: RaceOverrides, patch: RaceSettingsPatch): RaceOverrides {
  const out: RaceOverrides = { ...now };
  if ("opensAt" in patch) {
    if (patch.opensAt == null) delete out.opensAt;
    else out.opensAt = patch.opensAt;
  }
  if ("endsAt" in patch) {
    if (patch.endsAt == null) delete out.endsAt;
    else out.endsAt = patch.endsAt;
  }
  if ("firstWaveAt" in patch) {
    if (patch.firstWaveAt == null) delete out.firstWaveAt;
    else out.firstWaveAt = patch.firstWaveAt;
  }
  if ("waveMinutes" in patch) {
    if (patch.waveMinutes == null) delete out.waveMinutes;
    else out.waveMinutes = patch.waveMinutes;
  }
  if ("waveSize" in patch) {
    if (patch.waveSize == null) delete out.waveSize;
    else out.waveSize = patch.waveSize;
  }
  if ("photoKey" in patch) {
    if (patch.photoKey == null) delete out.photoKey;
    else out.photoKey = patch.photoKey;
  }
  if (typeof patch.photoBw === "boolean") out.photoBw = patch.photoBw;
  return out;
}

/* ----------------------------------------------------------------- rules */

/* The Pacific calendar day an instant lands on, as the challenge writes days
 * ("2026-09-27"). Same fixed UTC-7 shift fmtRaceClock uses. */
const pacificDay = (ms: number): string => new Date(ms - 7 * 3_600_000).toISOString().slice(0, 10);

/* THE THINGS AN EVENING CANNOT BE, checked on the WHOLE race after a patch
 * is folded in rather than on the fields that came with it: the owner moves
 * one at a time, and pulling the doors shut at 6:30 has to be refused while
 * a first wave sits at 7:15 — a request that mentions neither. Returns the
 * refusal to say out loud, or null.
 *
 * THE DAY IS PINNED, not just the clock. The three inputs are datetime-local
 * boxes, so the DATE sits one arrow key from the hour, and nothing else on
 * the site would show the slip: race.day, race.when and the flyer stamp are
 * NOT overridable, so an evening dragged whole onto the 28th keeps printing
 * SUN SEP 27 at a clock time that looks perfectly ordinary. Moving ONE field
 * across midnight already trips the wave rule below; moving all three does
 * not, which is what makes it the case that needs its own no.
 *
 * endsAt is left free on purpose: a night that legitimately runs past
 * midnight is the owner's to have.
 *
 * The console warns about the clock rules, in more words and with the last
 * wave named; this is the one that actually says no. */
export function raceRuleBreak(r: RaceDef): string | null {
  if (pacificDay(r.opensAt) !== r.day) return "The doors have to open on race day.";
  if (pacificDay(r.firstWaveAt) !== r.day) return "The first wave has to go off on race day.";
  if (r.endsAt <= r.opensAt) return "The doors have to shut after they open.";
  if (r.firstWaveAt < r.opensAt || r.firstWaveAt > r.endsAt) {
    return "The first wave has to go off while the doors are open.";
  }
  return null;
}

/* ----------------------------------------------------------------- write */

/* The columns a save may touch. Named apart from the patch because these are
 * Dates and those are epoch ms. */
type SettingsColumns = {
  opensAt?: Date | null;
  endsAt?: Date | null;
  firstWaveAt?: Date | null;
  waveMinutes?: number | null;
  waveSize?: number | null;
  photoKey?: string | null;
  photoBw?: boolean;
  updatedBy?: string;
};

const when = (ms: number | null | undefined): Date | null => (ms == null ? null : new Date(ms));

/* Write the keys the patch actually carries and nothing else, so two people
 * (or two tabs) moving different fields cannot undo each other. Throws on a
 * database failure — the route turns that into a 503. */
export async function saveRaceOverrides(slug: string, patch: RaceSettingsPatch, who: string): Promise<void> {
  const data: SettingsColumns = {};
  if ("opensAt" in patch) data.opensAt = when(patch.opensAt);
  if ("endsAt" in patch) data.endsAt = when(patch.endsAt);
  if ("firstWaveAt" in patch) data.firstWaveAt = when(patch.firstWaveAt);
  if ("waveMinutes" in patch) data.waveMinutes = patch.waveMinutes ?? null;
  if ("waveSize" in patch) data.waveSize = patch.waveSize ?? null;
  if ("photoKey" in patch) data.photoKey = patch.photoKey ?? null;
  if (typeof patch.photoBw === "boolean") data.photoBw = patch.photoBw;
  /* Nothing to do — an empty patch is a no-op, not a row full of nulls. */
  if (Object.keys(data).length === 0) return;
  data.updatedBy = who.slice(0, 200);

  await db.rowRaceSettings.upsert({
    where: { challenge_race: { challenge: CHALLENGE, race: slug } },
    create: { challenge: CHALLENGE, race: slug, ...data },
    update: data,
  });
}
