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
  /* "Sunday, Sep 27" and "6:00 – 9:00 AM" — the stub lines. */
  when: string;
  hours: string;
  /* Where, and how to say it in one line. */
  venue: string;
  venueLine: string;
  /* A sentence about the thing, for the page. */
  blurb: string;
  /* Registration closes — the last moment a rower can put their name in
   * (Pacific). Signing up after this is refused. */
  closesAt: number;
  closesLine: string;
  /* The first wave goes off here; each one after it is WAVE_MINUTES later.
   * The rowers are not told the grid, only their own wave (owner: "they do
   * not need to know when the wave starts"), but the console prints it. */
  firstWaveAt: number;
  waveMinutes: number;
  /* Ergs on the floor — how many racers a wave holds. The one number to
   * change when the owner counts the machines. */
  waveSize: number;
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
     * and it was built as a morning; this is the correction. */
    hours: "6:00 – 9:00 PM",
    venue: "The Strip Barbell",
    venueLine: "The Strip Barbell · Las Vegas",
    blurb:
      "One piece, one clock, everybody watching: 5,000 meters against the field on the last Sunday of Rowtember. Free to enter — put your name in and we will tell you your wave.",
    /* Midnight Pacific on race morning: the list has to be final before the
     * first wave is called. */
    closesAt: Date.UTC(2026, 8, 27, 7, 0, 0),
    closesLine: "Registration closes Saturday, Sep 26 at 11:59 PM Pacific",
    /* 6:30 PM Pacific on the 27th — which is 01:30Z on the 28th. */
    firstWaveAt: Date.UTC(2026, 8, 28, 1, 30, 0),
    waveMinutes: 30,
    waveSize: 8,
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

/* THE GATE (owner, 2026-09-10: "this should be hidden in development for
 * now"). Same shape as the shirt shop's shopOpenFor: open to anyone in
 * local dev so the page can be seen and driven, admin-only in production
 * until the owner opens it. One switch, read by every race surface. */
export function raceOpenFor(isAdmin: boolean): boolean {
  return process.env.NODE_ENV !== "production" || isAdmin;
}

/* "6:30 AM" — when wave n goes off, Pacific. Wave numbers are 1-based. */
export function waveTime(r: RaceDef, wave: number): string {
  const ms = r.firstWaveAt + (Math.max(1, wave) - 1) * r.waveMinutes * 60_000;
  const p = new Date(ms - 7 * 3_600_000);
  const h24 = p.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(p.getUTCMinutes()).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/* How many waves a field of `n` racers needs. */
export function waveCount(r: RaceDef, n: number): number {
  return Math.max(1, Math.ceil(n / Math.max(1, r.waveSize)));
}
