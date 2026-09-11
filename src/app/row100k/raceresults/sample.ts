import { currentRace, type RaceDef } from "../raceday";
import type { Bracket, ResultBoard, ResultRacer, ResultWave } from "./types";

/* THE SAMPLE FIELD — forty invented racers, so the board can be looked at
 * before a single time exists in the database. Nothing here is read from or
 * written to anything: it is one implementation of the ResultBoard shape in
 * types.ts, and the real page will produce the same shape off RowRaceSignup.
 *
 * FIVE WAVES, NOT SIX. Forty racers on eight ergs is five full waves; all
 * three design mocks drew six and every judge caught it, and six waves
 * thirty minutes apart from 6:30 PM puts the last pull past the posted 9 PM.
 * Five waves go off at 6:30 / 7:00 / 7:30 / 8:00 / 8:30 and the last rower
 * is off the erg just before 9. The grid comes from raceday.ts, so if the
 * owner moves the first wave the sample moves with it.
 *
 * THE MID-RACE MOMENT IS 7:38 PM, not 7:00. With a 6:30 first wave, at
 * 7:00 PM exactly one wave is down and wave 2 has just sat — the state the
 * brief describes (two rowed, one on the ergs, the rest to come) is only
 * true around 7:38. Wave 3 is slipped eighty seconds off its scheduled
 * start so the elapsed clock is visibly reading the NIGHT, not the plan.
 *
 * THE TIMES ARE INTERNALLY CONSISTENT. Splits are never typed — every split
 * on the board is the time over ten — and the field is drawn so the screen
 * tells a true story: the fastest man of the night (16:31.4) is in WAVE 5
 * and the fastest woman (18:29.8) is ON THE ERGS at 7:38, so the mid-race
 * leaderboard is genuinely provisional, and one man loses second place by
 * four tenths to somebody who rowed ninety minutes later. One racer does not
 * start, which is what makes the status column earn its place: his erg
 * shows empty in the lane strip and he drops out of every denominator. */

type Row = {
  n: number;
  name: string;
  bracket: Bracket;
  wave: number;
  lane: number;
  /* The 5,000 m on the night, seconds to a tenth. "dns" and "dnf" instead
   * of a number where there is no time to record. */
  result: number | "dns" | "dnf";
  /* Their fastest 5k coming in. Null: they came in without one. */
  best: number | null;
  prorated?: boolean;
};

/* wave / lane / bracket / the night / the seed. */
const FIELD: Row[] = [
  // WAVE 1 — 6:30 PM
  { n: 19, name: "Ty Brennan", bracket: "M", wave: 1, lane: 1, result: 1023.3, best: 1031.0 },
  { n: 7, name: "Sam Ruiz", bracket: "M", wave: 1, lane: 2, result: 1061.0, best: 1074.6 },
  { n: 56, name: "Kara Lindstrom", bracket: "F", wave: 1, lane: 3, result: 1152.7, best: 1160.4 },
  { n: 24, name: "Eli Sandoval", bracket: "M", wave: 1, lane: 4, result: 1187.5, best: 1215.6 },
  { n: 60, name: "Alice Torrey", bracket: "F", wave: 1, lane: 5, result: 1327.4, best: null },
  {
    n: 33,
    name: "Owen Castellanos",
    bracket: "M",
    wave: 1,
    lane: 6,
    result: 1254.8,
    best: 1249.0,
  },
  { n: 26, name: "Reese Calder", bracket: "F", wave: 1, lane: 7, result: 1408.7, best: 1440.0 },
  { n: 41, name: "Dom Pruitt", bracket: "M", wave: 1, lane: 8, result: 1272.4, best: 1280.2 },

  // WAVE 2 — 7:00 PM
  { n: 71, name: "Theo Lindqvist", bracket: "M", wave: 2, lane: 1, result: 1105.4, best: 1118.9 },
  { n: 29, name: "Kendall Moss", bracket: "F", wave: 2, lane: 2, result: 1138.4, best: 1150.2 },
  { n: 12, name: "Arturo Salas", bracket: "M", wave: 2, lane: 3, result: 1143.6, best: null },
  { n: 63, name: "Wes Delgado", bracket: "M", wave: 2, lane: 4, result: 1166.2, best: 1161.0 },
  { n: 64, name: "Marisol Chen", bracket: "F", wave: 2, lane: 5, result: 1291.6, best: 1305.4 },
  { n: 52, name: "Jared Moss", bracket: "M", wave: 2, lane: 6, result: 1218.9, best: 1233.3 },
  /* The biggest gain of the night: 24:03.5 in September, 21:55.6 tonight. */
  { n: 73, name: "Nia Okonkwo", bracket: "F", wave: 2, lane: 7, result: 1315.6, best: 1443.5 },
  { n: 84, name: "Josh Brennan", bracket: "M", wave: 2, lane: 8, result: 1249.1, best: 1252.0 },

  // WAVE 3 — 7:30 PM (on the ergs at 7:38)
  /* The fastest woman of the night is pulling right now, and her seed is
   * already under the leading time — the sharpest line on the mid-race
   * screen belongs to this row. */
  { n: 5, name: "Priya Raghavan", bracket: "F", wave: 3, lane: 1, result: 1109.8, best: 1121.0 },
  { n: 22, name: "Sam Ortega", bracket: "M", wave: 3, lane: 2, result: 1131.8, best: 1140.5 },
  /* THE NO-SHOW. Erg 3 stays empty and he leaves every denominator. */
  { n: 37, name: "Gabe Huerta", bracket: "M", wave: 3, lane: 3, result: "dns", best: 1305.6 },
  { n: 88, name: "Eve Sandberg", bracket: "F", wave: 3, lane: 4, result: 1268.3, best: 1277.0 },
  { n: 49, name: "Cal Mackey", bracket: "M", wave: 3, lane: 5, result: 1214.0, best: null },
  { n: 17, name: "Renata Cruz", bracket: "F", wave: 3, lane: 6, result: 1332.9, best: 1420.2 },
  { n: 20, name: "Tim Ruvalcaba", bracket: "M", wave: 3, lane: 7, result: 1198.7, best: 1205.9 },
  { n: 58, name: "Rafa Ibarra", bracket: "M", wave: 3, lane: 8, result: 1289.5, best: 1296.0 },

  // WAVE 4 — 8:00 PM
  /* Takes second by four tenths from a man who rowed ninety minutes earlier. */
  { n: 3, name: "Dane Okafor", bracket: "M", wave: 4, lane: 1, result: 1022.9, best: 1021.5 },
  /* Misses the podium by nine tenths of a second. */
  { n: 9, name: "Tasha Boone", bracket: "F", wave: 4, lane: 2, result: 1153.6, best: 1145.0 },
  { n: 15, name: "Marco Ibarra", bracket: "M", wave: 4, lane: 3, result: 1078.6, best: 1089.2 },
  { n: 35, name: "Meg Salazar", bracket: "F", wave: 4, lane: 4, result: 1224.1, best: 1238.8 },
  { n: 44, name: "Nate Kowalski", bracket: "M", wave: 4, lane: 5, result: 1113.0, best: 1126.4 },
  { n: 82, name: "Claire Odum", bracket: "F", wave: 4, lane: 6, result: 1181.2, best: null },
  { n: 67, name: "Brandon Hale", bracket: "M", wave: 4, lane: 7, result: 1113.9, best: 1120.0 },
  { n: 91, name: "Luis Pineda", bracket: "M", wave: 4, lane: 8, result: 1236.3, best: 1244.9 },

  // WAVE 5 — 8:30 PM
  /* The fastest piece in the room, and the only sub-17 of the night. */
  { n: 11, name: "Marcus Vela", bracket: "M", wave: 5, lane: 1, result: 991.4, best: 1012.0 },
  { n: 2, name: "Jo Whitaker", bracket: "F", wave: 5, lane: 2, result: 1196.5, best: 1210.3 },
  {
    n: 31,
    name: "Cole Fenner",
    bracket: "M",
    wave: 5,
    lane: 3,
    result: 1069.8,
    best: 1076.9,
    prorated: true,
  },
  { n: 47, name: "Sloane Reyes", bracket: "F", wave: 5, lane: 4, result: 1262.7, best: 1270.1 },
  /* The viewer, for the YOU strip and the row with the bar down its side. */
  { n: 55, name: "Ray Tolentino", bracket: "M", wave: 5, lane: 5, result: 1152.2, best: 1160.8 },
  { n: 69, name: "Bianca Ferro", bracket: "F", wave: 5, lane: 6, result: 1298.4, best: null },
  /* Sat down and stopped — the other half of why status exists. */
  { n: 78, name: "Devin Pryor", bracket: "M", wave: 5, lane: 7, result: "dnf", best: 1230.0 },
  { n: 95, name: "Dana Kwon", bracket: "F", wave: 5, lane: 8, result: 1355.0, best: 1372.6 },
];

const WAVES = 5;
const MIN = 60_000;

/* The viewer, when the sample is drawn signed in: a wave 5 rower, so the
 * YOU strip has something to say at 7:38 (you have not rowed yet) and
 * something else to say at the end. */
const YOU_NUMBER = 55;

function idOf(n: number): string {
  return `s${String(n).padStart(3, "0")}`;
}

function waveStart(race: RaceDef, wave: number): number {
  return race.firstWaveAt + (wave - 1) * race.waveMinutes * MIN;
}

/* The night as it actually ran: every wave a little late, because they are.
 * Wave 3 is eighty seconds off its scheduled start at the mid-race moment,
 * which is exactly the reason the elapsed clock cannot be computed from the
 * grid in raceday.ts. */
const SLIP_SECONDS = [70, 100, 80, 140, 160];

export type SampleState = "midrace" | "finished";

export function sampleBoard(state: SampleState, opts?: { you?: boolean }): ResultBoard {
  const race = currentRace();
  const mid = state === "midrace";
  /* 7:38 PM on the room clock, eight minutes into wave 3. */
  const nowMs = mid
    ? waveStart(race, 3) + 8 * MIN
    : /* 9:04 PM: the last rower is off, the sheet went up at 8:58. */
      waveStart(race, WAVES) + 34 * MIN;

  const liveWave = mid ? 3 : WAVES + 1;

  const waves: ResultWave[] = Array.from({ length: WAVES }, (_, i) => {
    const wave = i + 1;
    const scheduledAtMs = waveStart(race, wave);
    const started = scheduledAtMs + SLIP_SECONDS[i] * 1000;
    const state_: ResultWave["state"] =
      wave < liveWave ? "rowed" : wave === liveWave ? "on_the_ergs" : "to_come";
    return {
      wave,
      scheduledAtMs,
      /* A wave to come has no start stamp, and so gets no clock. */
      startedAtMs: state_ === "to_come" ? null : started,
      state: state_,
    };
  });

  const racers: ResultRacer[] = FIELD.map((row) => {
    const waveState = waves[row.wave - 1].state;
    let status: ResultRacer["status"];
    let seconds: number | null = null;
    if (row.result === "dns") status = "dns";
    else if (row.result === "dnf") status = mid && waveState !== "rowed" ? "to_come" : "dnf";
    else if (waveState === "rowed") {
      status = "finished";
      seconds = row.result;
    } else if (waveState === "on_the_ergs") status = "rowing";
    else status = "to_come";
    if (!mid && status === "rowing") {
      status = "finished";
      seconds = typeof row.result === "number" ? row.result : null;
    }
    return {
      id: idOf(row.n),
      name: row.name,
      rowerNumber: row.n,
      bracket: row.bracket,
      wave: row.wave,
      lane: row.lane,
      status,
      seconds,
      best5k: row.best === null ? null : { seconds: row.best, prorated: !!row.prorated },
    };
  });

  return {
    raceSlug: race.slug,
    dateLine: `Race day · ${race.when} · ${race.meters.toLocaleString()} m`,
    placeLine: `${race.venueLine} · ${race.room}`,
    meters: race.meters,
    ergs: race.waveSize,
    /* Straight off the race definition, so the copy that says how far apart
     * the waves go cannot disagree with the grid that sends them. */
    waveMinutes: race.waveMinutes,
    state,
    nowMs,
    /* The last time typed in. Mid-race it is nine minutes old on purpose:
     * the freshness line has to be able to go stale in front of somebody. */
    updatedAtMs: mid ? nowMs - 9 * MIN : nowMs - 6 * MIN,
    waves,
    racers,
    youId: opts?.you === false ? null : idOf(YOU_NUMBER),
    sample: true,
  };
}
