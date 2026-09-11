import { fmtRecordTime, fmtSplit } from "@/lib/row100k";

/* THE RESULTS BOARD — the model, and everything derivable from it.
 *
 * The board is a PLAIN SERIALISABLE OBJECT. Nothing in this folder reads the
 * database: the page hands a ResultBoard in, the components draw it, and the
 * fixture (sample.ts) is one implementation of the same shape. When the real
 * race day surface is built it fills this from RowRaceSignup and hands it to
 * the very same components — which is the whole reason the shape is written
 * down here rather than inside the markup.
 *
 * WHAT THE REAL BUILD STILL HAS TO STORE (every judge said this first, and
 * the shape below is drawn so the gaps are obvious):
 *   - the 5,000 m itself, to a tenth. Nothing on RowRaceSignup holds a
 *     race-day time today; `seconds` is that column.
 *   - `status`. Without it a no-show sits in STILL TO ROW all night and
 *     every denominator on the page is wrong from wave one onward, which is
 *     why dns and dnf are in the enum before anything is built.
 *   - `ResultWave.startedAtMs` — the instant the wave was ACTUALLY sent, not
 *     the planned grid. Waves slip. When it is null NO elapsed clock is
 *     drawn at all, rather than counting from a schedule (the mid-race
 *     sample slips wave 3 by 80 seconds on purpose so that shows).
 *   - `lane`. Nobody in the room asks who is in wave 3, they ask which erg.
 *     It can be derived for free from the seeded order the wave console
 *     already sorts by; a column is only needed once the floor reorders.
 *
 * SPLITS ARE NEVER TYPED. A split is time over ten for a 5,000 m, derived
 * here through the same fmtSplit the rest of the site uses, so a split can
 * never disagree with the time above it.
 *
 * EVERY CLOCK IS PACIFIC, the fixed UTC-7 the whole challenge runs on
 * (raceday.ts does the same arithmetic for waveTime). The instants in the
 * model are epoch ms computed on the SERVER; if the viewer's device did the
 * formatting, the phone in the room and the TV on the wall would disagree. */

export type Bracket = "M" | "F";

/* WHERE A RACER IS. `to_come` is assigned to a wave and has not sat down;
 * `rowing` is on an erg right now; `dns` was in the wave and never started;
 * `dnf` sat down and stopped. A missing time cannot tell those apart. */
export type RacerStatus = "to_come" | "rowing" | "finished" | "dns" | "dnf";

export type ResultRacer = {
  id: string;
  name: string;
  rowerNumber: number;
  bracket: Bracket;
  /* 1-based wave, and the erg inside it (1..ergs). */
  wave: number;
  lane: number;
  status: RacerStatus;
  /* The 5,000 m in seconds to a tenth. Null unless status is finished. */
  seconds: number | null;
  /* THEIR FASTEST 5K COMING IN — the seed. The site already computes this
   * (racedayData.ts Racer.best5k, off the same computeBoards fastest[5000]
   * the records page uses), which is why an unrowed row is never blank and
   * why the board can say who is still coming for the lead without a single
   * new column. `prorated` means it was normalised off a longer piece: it is
   * printed, because a prorated seed on a public wall is a promise the rower
   * never made. */
  best5k: { seconds: number; prorated: boolean } | null;
};

export type WaveState = "rowed" | "on_the_ergs" | "to_come";

export type ResultWave = {
  wave: number;
  /* The plan: firstWaveAt plus (n-1) x waveMinutes, same as waveTime(). */
  scheduledAtMs: number;
  /* The night. Null means nobody hit start, and then no elapsed clock. */
  startedAtMs: number | null;
  state: WaveState;
};

export type ResultBoard = {
  raceSlug: string;
  /* "RACE DAY · SUNDAY, SEP 27 · 5,000 M" and the place under it. */
  dateLine: string;
  placeLine: string;
  meters: number;
  /* Ergs on the floor — the width of a wave and of the lane strip. */
  ergs: number;
  /* Minutes between waves. It is on the model rather than typed into the
   * copy because the copy says it out loud in two section heads, and the
   * moment the owner shortens the gap a typed number starts lying. Same
   * one-number-one-source rule the splits already follow. */
  waveMinutes: number;
  /* Mid-race the board is provisional and says so in four places; finished
   * it is the sheet. One word changes in the chip (the ledger idea). */
  state: "midrace" | "finished";
  /* Server now, and the instant the last time was typed in. The gap between
   * them is the freshness line: a board is only as live as the person
   * entering times, and a frozen TV must look frozen. */
  nowMs: number;
  updatedAtMs: number;
  waves: ResultWave[];
  racers: ResultRacer[];
  /* The signed-in viewer, when they are in the field. Never set on the cast
   * frame: a gym casting from a signed-in laptop would put one rower on the
   * wall all evening. */
  youId: string | null;
  /* True when the numbers are invented, so the surface can say so. */
  sample: boolean;
};

/* ---- clocks -------------------------------------------------------- */

const PACIFIC_OFFSET_MS = 7 * 3_600_000;

/* "7:38 PM" — an instant on the room clock. */
export function fmtClock(ms: number): string {
  const p = new Date(ms - PACIFIC_OFFSET_MS);
  const h24 = p.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(p.getUTCMinutes()).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/* "6:40" on the wave clock. Null when the wave has no real start stamp —
 * the clock is left off rather than counted from a schedule that slipped. */
export function fmtElapsed(fromMs: number | null, toMs: number): string | null {
  if (fromMs === null || toMs < fromMs) return null;
  const s = Math.floor((toMs - fromMs) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* "9 MIN AGO" — how stale the board is. Under a minute it is just now. */
export function fmtAgo(fromMs: number, toMs: number): string {
  const m = Math.max(0, Math.floor((toMs - fromMs) / 60000));
  if (m < 1) return "JUST NOW";
  return `${m} MIN AGO`;
}

/* ---- times --------------------------------------------------------- */

export function fmtTime(seconds: number): string {
  return fmtRecordTime(seconds);
}

export function fmtSplitFor(meters: number, seconds: number): string {
  return fmtSplit(meters, seconds);
}

/* "+0:31.5" / "-2:07.9" — a margin, always signed, so second and third read
 * as a measurement from the winner rather than as two more rows. */
export function fmtGap(delta: number): string {
  const sign = delta < 0 ? "-" : "+";
  return `${sign}${fmtRecordTime(Math.abs(delta))}`;
}

/* ---- the field ----------------------------------------------------- */

export function inBracket(b: ResultBoard, bracket: Bracket): ResultRacer[] {
  return b.racers.filter((r) => r.bracket === bracket);
}

/* Finished, fastest first. Ties to the tenth keep the earlier wave ahead —
 * a tie rule has to exist or two equal times silently print 2 and 3. */
export function ranked(racers: ResultRacer[]): ResultRacer[] {
  return racers
    .filter((r) => r.status === "finished" && r.seconds !== null)
    .sort((a, b) => (a.seconds ?? 0) - (b.seconds ?? 0) || a.wave - b.wave || a.lane - b.lane);
}

/* Everybody who could still change the leaderboard: on an erg now, or not
 * sat down yet. A DNS is NOT in here, which is the whole point of status. */
export function stillToRow(racers: ResultRacer[]): ResultRacer[] {
  return racers.filter((r) => r.status === "rowing" || r.status === "to_come");
}

/* The racers still to row who are ALREADY faster on record than the time
 * leading their bracket — the one line that makes a partial leaderboard
 * honest, and it needs no column the site does not already have. */
export function threats(racers: ResultRacer[], leadSeconds: number | null): ResultRacer[] {
  if (leadSeconds === null) return [];
  return stillToRow(racers)
    .filter((r) => r.best5k !== null && r.best5k.seconds < leadSeconds)
    .sort((a, b) => (a.best5k?.seconds ?? 0) - (b.best5k?.seconds ?? 0));
}

/* The unknowns: still to row with no 5k on record at all. They are the ones
 * who actually take a win, so the caveat counts them separately. */
export function unseeded(racers: ResultRacer[]): ResultRacer[] {
  return stillToRow(racers).filter((r) => r.best5k === null);
}

export type BracketView = {
  bracket: Bracket;
  label: string;
  all: ResultRacer[];
  ranked: ResultRacer[];
  leader: ResultRacer | null;
  stillToRow: ResultRacer[];
  threats: ResultRacer[];
  unseeded: ResultRacer[];
  rowed: number;
  field: number;
};

export function bracketView(b: ResultBoard, bracket: Bracket): BracketView {
  const all = inBracket(b, bracket);
  const rk = ranked(all);
  const leader = rk[0] ?? null;
  return {
    bracket,
    label: bracket === "M" ? "Men" : "Women",
    all,
    ranked: rk,
    leader,
    stillToRow: stillToRow(all),
    threats: threats(all, leader?.seconds ?? null),
    unseeded: unseeded(all),
    rowed: rk.length,
    /* The denominator drops the no-shows: a field of 24 with one DNS is 23
     * possible times, and every count on the page leans on this. */
    field: all.filter((r) => r.status !== "dns").length,
  };
}

/* THE PODIUM, and the line a podium normally hides. Fourth is carried
 * because it turns third place from a cut-off into a margin. */
export type Podium = {
  steps: { racer: ResultRacer; place: 1 | 2 | 3; gap: number }[];
  fourth: { racer: ResultRacer; offPodium: number } | null;
  /* What first won by — so the three blocks read as one measurement. */
  wonBy: number | null;
};

export function podium(v: BracketView): Podium {
  const rk = v.ranked;
  const first = rk[0] ?? null;
  const steps = rk.slice(0, 3).map((racer, i) => ({
    racer,
    place: (i + 1) as 1 | 2 | 3,
    gap: (racer.seconds ?? 0) - (first?.seconds ?? 0),
  }));
  const third = rk[2] ?? null;
  const four = rk[3] ?? null;
  return {
    steps,
    fourth:
      four && third ? { racer: four, offPodium: (four.seconds ?? 0) - (third.seconds ?? 0) } : null,
    wonBy: rk.length > 1 ? (rk[1].seconds ?? 0) - (first?.seconds ?? 0) : null,
  };
}

/* ---- the room ------------------------------------------------------ */

export type RoomCounts = {
  rowed: number;
  onErgs: number;
  toCome: number;
  dns: number;
  dnf: number;
  /* EVERYBODY ENTERED, no-shows included — the size of the field. */
  field: number;
  /* EVERYBODY WHO CAN STILL PUT A TIME ON THE BOARD: the field less the
   * no-shows. Two different denominators exist on this page and they must be
   * named apart, or one screen prints 16 OF 40 in the room line while the
   * leader boxes above it print 10 of 23 and 6 of 16 and read as a
   * contradiction. BracketView.field is this same count, per bracket. */
  possible: number;
};

export function roomCounts(racers: ResultRacer[]): RoomCounts {
  const n = (s: RacerStatus) => racers.filter((r) => r.status === s).length;
  const dns = n("dns");
  return {
    rowed: n("finished"),
    onErgs: n("rowing"),
    toCome: n("to_come"),
    dns,
    dnf: n("dnf"),
    field: racers.length,
    possible: racers.length - dns,
  };
}

export function waveOf(b: ResultBoard, wave: number): ResultWave | null {
  return b.waves.find((w) => w.wave === wave) ?? null;
}

/* A wave in lane order — the order the room is called to the machines. */
export function inWave(b: ResultBoard, wave: number): ResultRacer[] {
  return b.racers.filter((r) => r.wave === wave).sort((a, b2) => a.lane - b2.lane);
}

export function liveWave(b: ResultBoard): ResultWave | null {
  return b.waves.find((w) => w.state === "on_the_ergs") ?? null;
}

export function nextWave(b: ResultBoard): ResultWave | null {
  return b.waves.find((w) => w.state === "to_come") ?? null;
}

export function racerById(b: ResultBoard, id: string | null): ResultRacer | null {
  if (!id) return null;
  return b.racers.find((r) => r.id === id) ?? null;
}

/* Their place within their own bracket, 1-based. Null unless they finished.
 * Places are WITHIN BRACKET — men and women are scored apart — so anywhere
 * the two are printed in one table the mark is qualified (M1 / W1) rather
 * than a bare numeral, or the sheet shows two 1s seven rows apart. */
export function placeOf(b: ResultBoard, racer: ResultRacer): number | null {
  if (racer.status !== "finished") return null;
  const i = ranked(inBracket(b, racer.bracket)).findIndex((r) => r.id === racer.id);
  return i < 0 ? null : i + 1;
}

/* The one ordinal the podium spells out. */
export function ordinal(place: 1 | 2 | 3): string {
  return place === 1 ? "1ST" : place === 2 ? "2ND" : "3RD";
}

/* How the night ran, a row per wave: the ledger idea, and it fills the
 * ragged column under the shorter table on the finished sheet. */
export type WaveLine = {
  wave: number;
  timeText: string;
  lanes: number;
  fastest: ResultRacer | null;
  averageSeconds: number | null;
};

export function waveLines(b: ResultBoard): WaveLine[] {
  return b.waves.map((w) => {
    const field = inWave(b, w.wave);
    const done = ranked(field);
    const avg = done.length
      ? done.reduce((s, r) => s + (r.seconds ?? 0), 0) / done.length
      : null;
    return {
      wave: w.wave,
      timeText: fmtClock(w.startedAtMs ?? w.scheduledAtMs),
      lanes: field.length,
      fastest: done[0] ?? null,
      averageSeconds: avg,
    };
  });
}
