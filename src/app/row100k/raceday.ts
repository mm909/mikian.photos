import { nowMs } from "@/lib/row100k";

/* RACE DAY (owner, 2026-09-10): a timed 5,000 m trial on Sunday Sep 27 at
 * The Strip Barbell in Las Vegas. Free — a rower registers, the owner puts
 * them in a wave, and an email tells them which one.
 *
 * The race lives HERE, in code — day, place, hours, distance, wave size,
 * the copy — the way a raffle does (raffles.ts): every one of them needs
 * its own words anyway. What CHANGES lives in the RowRaceSignup table: who
 * signed up, their bracket, their wave, and whether they have been told.
 *
 * Add a race by adding an entry below; the signup page, the racer list and
 * the wave console pick it up. Instants are Pacific, the fixed UTC-7 the
 * whole challenge runs on, so 6:00 AM PT is 13:00Z. */

export type RaceDef = {
  /* URL-safe key; the RowRaceSignup rows hang off it. */
  slug: string;
  /* "Race day" — what it is called on the page. */
  title: string;
  /* "A timed 5,000 m trial" — the line under it. */
  sub: string;
  /* The piece every racer rows. */
  meters: number;
  /* The day, as the challenge writes days. */
  day: string;
  /* "Sunday, Sep 27" — the day, as a stub line. */
  when: string;
  /* THE DOORS, as instants (owner, 2026-09-11: "let us make the start time
   * and end time and first wave time all changeable in the settings
   * menu"). They are instants and not a typed string so that changing one
   * in the console moves every surface at once — the page, the ads and the
   * wave note all read hoursLine(race) rather than a sentence somebody
   * wrote. RowRaceSettings overrides them; see racedaySettings.ts. */
  opensAt: number;
  endsAt: number;
  /* Where. `venue` is the gym's own name and it is what every race surface
   * says now.
   *
   * `venueLine` is the same place WITH ITS TOWN, and it has one reader left
   * (owner, 2026-09-11: "remove Las Vegas whenever we are saying the strip
   * barbell engine room — we just keep it at the strip barbell engine
   * room"). It used to feed all of them: the ads' house block and the
   * flyer's both split the town out of it and set it under THE ENGINE ROOM,
   * the share card printed THE ENGINE ROOM · LAS VEGAS, the wave note opened
   * its evening paragraph on it and the wave console dumped it. All six of
   * those say `venue` now, or the room alone. What still reads this is the
   * results board's stub line, which belongs to another stream this week —
   * so the field stays rather than being pulled out from under it. If that
   * board ever drops the town too, this is a dead field and should go with
   * it. */
  venue: string;
  venueLine: string;
  /* THE ROOM (owner, 2026-09-11): the ergs live in a room of its own.
   * Named because the room is where the race is. (It carried a NEW THIS
   * SEPTEMBER note for a few hours the same day; the owner took it off
   * every surface — "remove the phrase new this September" — so the field
   * is gone rather than emptied.) */
  room: string;
  /* The venue's own mark, keyed WHITE ON TRANSPARENT out of their logo
   * (scratchpad/tsb-logo.js) so it composites on ink and over a photo
   * alike. Their site is white-on-black, which is where race day's
   * monochrome comes from. `ratio` is width over height, for a canvas that
   * has to place it without loading it first. */
  venueMark: { src: string; alt: string; ratio: number } | null;
  venueUrl: string;
  venueInstagram: string;
  /* Registration closes — the last moment a rower can put their name in
   * (Pacific). Signing up after this is refused. The SENTENCE that used to
   * ride with it is gone (owner, 2026-09-11: "remove registration closes
   * Saturday, September twenty sixth"); the rule stays, it just no longer
   * announces itself on the page. */
  closesAt: number;
  /* The first wave goes off here; each one after it is WAVE_MINUTES later.
   * The rowers are not told the grid, only their own wave (owner: "they do
   * not need to know when the wave starts"), but the console prints it. */
  firstWaveAt: number;
  waveMinutes: number;
  /* Ergs on the floor — how many racers a wave holds. */
  waveSize: number;
  /* The picture the ads carry: a gallery R2 key, or null for the newest
   * shot, and whether it is drawn in black and white. */
  photo: { key: string | null; bw: boolean };
  /* Two brackets (owner): the men's and the women's. */
  brackets: { key: "M" | "F"; label: string }[];
  /* The gym's waiver. It is signed on the gym's own system (Wodify), so
   * the site can only ASK and remember the answer — the page links it, the
   * signup asks whether it is done, and the wave note carries it again for
   * anyone who has not. `host` is how the link is named in copy. */
  waiver: { url: string; host: string } | null;
};

export const RACES: RaceDef[] = [
  {
    slug: "raceday-2026-09-27",
    title: "Race day",
    sub: "A timed 5,000 m trial",
    meters: 5000,
    day: "2026-09-27",
    when: "Sunday, Sep 27",
    /* EVENING (owner, 2026-09-11: "6-9pm on the 27th"). The first telling
     * of it was "six to nine, first wave six thirty" with no half named,
     * and it was built as a morning; this is the correction. 6 PM and 9 PM
     * Pacific on the 27th are 01:00Z and 04:00Z on the 28th. Defaults only:
     * the console can move all three (racedaySettings.ts). */
    opensAt: Date.UTC(2026, 8, 28, 1, 0, 0),
    endsAt: Date.UTC(2026, 8, 28, 4, 0, 0),
    venue: "The Strip Barbell",
    venueLine: "The Strip Barbell · Las Vegas",
    room: "The Engine Room",
    venueMark: {
      src: "/row100k/raceday/strip-barbell.png",
      alt: "The Strip Barbell",
      ratio: 1170 / 466,
    },
    venueUrl: "https://thestripbarbell.com",
    venueInstagram: "thestripbarbell",
    /* Midnight Pacific on race morning: the list has to be final before the
     * first wave is called. */
    closesAt: Date.UTC(2026, 8, 27, 7, 0, 0),
    /* 6:15 PM Pacific on the 27th — 01:15Z on the 28th (owner, 2026-09-11:
     * "let us keep the first wave there, but let us change the time to six
     * fifteen"). A default: the console can move it. */
    firstWaveAt: Date.UTC(2026, 8, 28, 1, 15, 0),
    waveMinutes: 30,
    waveSize: 8,
    /* The picture the ads carry. Null means the newest gallery shot; the
     * console picks one and says whether it is drawn in black and white
     * (owner, 2026-09-11: "allow me to change that photo and have it be
     * black and white most likely"). */
    photo: { key: null, bw: true },
    brackets: [
      { key: "M", label: "Men" },
      { key: "F", label: "Women" },
    ],
    waiver: {
      url: "https://app.wodify.com/Token/SignWaiver?WaiverToken=A9C77171C1C472FF02B1FABB64AF3CD1FC0807324BBD0D3FC47FCCD838356278",
      host: "app.wodify.com",
    },
  },
];

/* WHAT SOMEBODY SIGNS UP AS (owner, 2026-09-11: "we need there to be a way
 * to sign up as a spectator versus as just a racer"). A racer pulls and
 * gets a wave; a spectator holds a place in the room and gets neither a
 * wave nor a wave note. The column is RowRaceSignup.role. */
export type RaceRole = "racer" | "spectator";

/* `line` is OPTIONAL, and the spectator has none (owner, 2026-09-11:
 * "remove the phrase come watch, no wave, no erg"). The word is the whole
 * explanation — a spectator is a spectator — and a sentence spent saying so
 * was the bill explaining itself. The RACER keeps his, because the owner
 * struck one line and not the other and because that one says a thing the
 * word does not: the distance, and that you are given a wave.
 *
 * Absent rather than empty. A "" would be a hole pretending to be a value,
 * and every surface that prints a line would go on reserving a row, a dot
 * or a column for it; a missing field makes each of them decide out loud
 * what a role with nothing to add looks like. There are three:
 * SignupPanel's rail, the ads' TWO WAYS IN table, and the confirmation
 * block a spectator reads after opting in. */
export const RACE_ROLES: { key: RaceRole; label: string; line?: string }[] = [
  { key: "racer", label: "Racer", line: "Pull the 5,000 m. You get a wave." },
  { key: "spectator", label: "Spectator" },
];

export function parseRole(v: unknown): RaceRole | null {
  return v === "racer" || v === "spectator" ? v : null;
}

export function raceBySlug(slug: string): RaceDef | null {
  return RACES.find((r) => r.slug === slug) ?? null;
}

/* The race the site should be pointing at: the first one still taking
 * names, else the next one on the calendar, else the last. Never null
 * while RACES has an entry. */
export function currentRace(at: number = nowMs()): RaceDef {
  return RACES.find((r) => at < r.closesAt) ?? RACES[RACES.length - 1];
}

/* Where a race stands on the clock. */
export type RacePhase = "open" | "closed" | "raced";

export function racePhase(r: RaceDef, at: number = nowMs()): RacePhase {
  if (at < r.closesAt) return "open";
  /* The morning itself: names are shut, the waves are running. */
  if (at < r.firstWaveAt + 6 * 3_600_000) return "closed";
  return "raced";
}

/* THE GATE, and it is OPEN (owner, 2026-09-12: "make the race day sign up
 * page live"). It was `NODE_ENV !== "production" || isAdmin` from 09-10,
 * while the page was being built — "this should be hidden in development
 * for now" — and this is him lifting that.
 *
 * THREE THINGS OPEN ON THIS ONE LINE, which is why it is a function and
 * not a flag copied into three files: the sign-up page (raceday/page.tsx),
 * the POST that puts a name in (api/row100k/raceday), and the RACE DAY
 * stamp on the rail (RowBar hands BarNav the answer). The ads point at
 * mikianmusser.com and the rail is how a stranger gets from the root to
 * the race, so the address and the link had to go public together.
 *
 * `isAdmin` is kept in the signature deliberately. Shutting the race again
 * is then one line here rather than an archaeology of what this used to
 * be, and every call site already passes it.
 *
 * NOT everything race day rides this. The wave console is admin-only in
 * every environment ("the console is the owner's, always"), and the sample
 * results board wears the dev-page gate instead, on purpose: forty
 * invented racers must not go public the day the real race does. */
export function raceOpenFor(_isAdmin: boolean): boolean {
  return true;
}

/* "6:15 PM" — an instant on the Pacific wall clock the race runs on. */
export function fmtRaceClock(ms: number): string {
  const p = new Date(ms - 7 * 3_600_000);
  const h24 = p.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(p.getUTCMinutes()).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/* "6:00 – 9:00 PM" — the doors, derived rather than typed, so moving a
 * time in the console moves every surface that prints it. The half is said
 * once when both ends share it, the way a person says it. */
export function hoursLine(r: RaceDef): string {
  const a = fmtRaceClock(r.opensAt);
  const b = fmtRaceClock(r.endsAt);
  const half = (s: string) => s.slice(-2);
  return half(a) === half(b) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/* "6:15 PM" — when wave n goes off, Pacific. Wave numbers are 1-based. */
export function waveTime(r: RaceDef, wave: number): string {
  return fmtRaceClock(r.firstWaveAt + (Math.max(1, wave) - 1) * r.waveMinutes * 60_000);
}

/* WHAT THE CONSOLE MAY MOVE (owner, 2026-09-11: "let us make the start
 * time and end time and first wave time all changeable in the settings
 * menu"), plus the two numbers that shape the grid and the ad's picture.
 * A null or an absent field means the code default stands, so a race with
 * no settings row behaves exactly as it always did. Kept pure and here,
 * beside the definition it patches; the DB read is racedaySettings.ts. */
export type RaceOverrides = {
  opensAt?: number | null;
  endsAt?: number | null;
  firstWaveAt?: number | null;
  waveMinutes?: number | null;
  waveSize?: number | null;
  photoKey?: string | null;
  photoBw?: boolean | null;
};

const num = (v: number | null | undefined, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export function withOverrides(r: RaceDef, o: RaceOverrides | null | undefined): RaceDef {
  if (!o) return r;
  return {
    ...r,
    opensAt: num(o.opensAt, r.opensAt),
    endsAt: num(o.endsAt, r.endsAt),
    firstWaveAt: num(o.firstWaveAt, r.firstWaveAt),
    /* Floored at one minute and one erg: a zero of either would divide the
     * wave grid by nothing. */
    waveMinutes: Math.max(1, Math.round(num(o.waveMinutes, r.waveMinutes))),
    waveSize: Math.max(1, Math.round(num(o.waveSize, r.waveSize))),
    photo: {
      key: o.photoKey === undefined ? r.photo.key : o.photoKey,
      bw: typeof o.photoBw === "boolean" ? o.photoBw : r.photo.bw,
    },
  };
}

/* How many waves a field of `n` racers needs. */
export function waveCount(r: RaceDef, n: number): number {
  return Math.max(1, Math.ceil(n / Math.max(1, r.waveSize)));
}
