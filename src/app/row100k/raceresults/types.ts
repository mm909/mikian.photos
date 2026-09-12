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
 *   - `status`. DNS CAME OUT of it (owner, 2026-09-11: I can just mark them
 *     as a no show when I am assigning waves). A racer who never started is
 *     a ROSTER fact, settled upstream before a board exists, so they are
 *     simply not in the field and no denominator has to duck them. DNF is a
 *     FLOOR fact — a name already printed in a lane, sat down and stopped —
 *     and there is no earlier place to record it, so it stays.
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
 * `rowing` is on an erg right now; `dnf` sat down and stopped. A missing
 * time cannot tell those apart, which is why the column exists.
 *
 * THERE IS NO `dns`. It was here, and it came out: a no-show is marked when
 * the waves are assigned, so they never reach the board at all. The one
 * thing that cost is the named empty erg in the lane strip — an empty lane
 * now means an erg nobody was assigned to, which is the honest reason. */
export type RacerStatus = "to_come" | "rowing" | "finished" | "dnf";

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
  /* Mid-race the board is provisional; finished it is the sheet. The word
   * PROVISIONAL itself came off the leader boxes (owner, 2026-09-11: we can
   * remove the provisional thing there) — the blinking square, the freshness
   * line, the withheld podium fill and sixteen visibly empty rows were
   * already saying it, and a chip saying it a fifth time is a label on a
   * thing that shows. */
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

/* A PERSONAL RECORD: tonight is faster than the fastest 5k they came in
 * with. It is the one mark that replaced every signed plus and minus on this
 * board (owner, 2026-09-11: we do not need to mark plus or minus on their
 * best, but we should mark a PR).
 *
 * NO 5K ON RECORD MEANS NO MARK. A first 5,000 m is not a record broken, and
 * the BEST COMING IN cell on the same row already reads FIRST 5K — so the
 * absence of the tag is never a mystery, it is answered two columns over.
 *
 * A PRO-RATED SEED STILL COUNTS. The seed printed beside the mark is the one
 * the mark is measured against, whatever it was normalised off, or the tag
 * and the number a reader can see would disagree.
 *
 * ONE QUESTION, ONE PLACE: the podium, the field table, the result sheet and
 * the YOU strip all call this, and so does the PERSONAL RECORDS SET count in
 * WORTH SAYING, so the tally always equals the tags. */
export function isPr(r: ResultRacer): boolean {
  if (r.status !== "finished" || r.seconds === null || !r.best5k) return false;
  return r.seconds < r.best5k.seconds;
}

/* STILL TO ROW, THE THREATS AND THE UNSEEDED ARE GONE, and so is the seed
 * bar they drew down the side of the field table (owner, 2026-09-11: remove
 * the callouts to two of them having a faster five k on record, one with
 * zero five k s ... same thing with fastest to come). Nothing computed them
 * once the leader-box foot came off, and the bar had to go with them: it was
 * explained by exactly one sentence of the prose that was also cut, and a
 * mark nobody can read is worse than the paragraph that explained it. */

export type BracketView = {
  bracket: Bracket;
  label: string;
  all: ResultRacer[];
  ranked: ResultRacer[];
  leader: ResultRacer | null;
  /* Times in. The denominator printed beside it is all.length — there used
   * to be a separate `field` count that dropped the no-shows, and with DNS
   * gone it was the same number wearing a second name. */
  rowed: number;
};

export function bracketView(b: ResultBoard, bracket: Bracket): BracketView {
  const all = inBracket(b, bracket);
  const rk = ranked(all);
  return {
    bracket,
    label: bracket === "M" ? "Men" : "Women",
    all,
    ranked: rk,
    leader: rk[0] ?? null,
    rowed: rk.length,
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

/* TWO COUNTS, WHERE THERE WERE SEVEN. On the ergs, still to come, did not
 * start and the two rival denominators all went with the three-up counter
 * strip and the room line under it (owner, 2026-09-11: I probably do not
 * need the number that is already rowed, number still to come, stuff like
 * that. Like, that is not needed). What is left is what the finished sheet
 * and the wall still print: times in, and the size of the field. */
export type RoomCounts = {
  rowed: number;
  field: number;
};

export function roomCounts(racers: ResultRacer[]): RoomCounts {
  return {
    rowed: racers.filter((r) => r.status === "finished").length,
    field: racers.length,
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

/* WHICH WAVE THE PANEL IS SHOWING before anybody touches it — and on a
 * television nobody ever touches it, so this is the whole interaction on the
 * wall.
 *
 * THE WAVE ON THE ERGS ALWAYS WINS. It is the one question the room is
 * asking. BETWEEN WAVES there is no live wave and the lane strip used to
 * vanish outright — liveWave() returns null for the twenty-odd minutes
 * between an eight minute piece and the next wave going off, so the top of
 * the board reflowed every half hour and a frame clipped at 720 was left with
 * a hole. The panel shows the wave that is NEXT instead: who sits down, on
 * which erg, and what they came in with, which is what the room is physically
 * doing in that gap. FINISHED there is nothing live to follow, so a rower
 * gets their own wave and anybody else gets wave 1, the night from the start.
 * A pinned wave beats all of it.
 *
 * NOTHING ROTATES ON A TIMER. The wall moves when the ROOM moves, which needs
 * no clock of its own and starts working the day the poll the cast frame
 * already wants lands: every re-render runs this again. */
export function pickedWave(b: ResultBoard, pick?: number | null): number {
  const first = b.waves[0]?.wave ?? 1;
  if (typeof pick === "number" && b.waves.some((w) => w.wave === pick)) return pick;
  const live = liveWave(b);
  if (live) return live.wave;
  if (b.state === "finished") {
    const you = racerById(b, b.youId);
    return you ? you.wave : first;
  }
  const next = nextWave(b);
  if (next) return next.wave;
  return [...b.waves].filter((w) => w.state === "rowed").pop()?.wave ?? first;
}

/* THE BRACKET, IN ONE LETTER. The model stores F for the women, because
 * that is the key the race definition uses; the screen says W, because W1
 * is what a place mark reads as. Everywhere a bracket is PRINTED it comes
 * through here, so the Br column and the place mark beside it can never
 * again show two different letters for the same rower. */
export function brLetter(bracket: Bracket): string {
  return bracket === "M" ? "M" : "W";
}

/* Their place within their own bracket, 1-based. Null unless they finished.
 * Places are WITHIN BRACKET — men and women are scored apart — so anywhere
 * the two are printed in one table the mark is qualified (M1 / W1) rather
 * than a bare numeral, or the sheet shows two 1s seven rows apart.
 *
 * THE LETTER IS THE BRACKET COLUMN'S LETTER. The paragraph that used to
 * teach M1 and W1 is gone, so the mark has to teach itself: the Br cell on
 * the same row prints the same M or W the place mark wears. It used to print
 * F while the mark said W, and only the legend reconciled them. */
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

/* ONE wave off the same ledger the night table prints, so a fastest or an
 * average in a panel head can never disagree with the table underneath it.
 * The two are two readings of one night: the panel is how ONE wave ran, with
 * the names attached; the table is how the five compare, side by side. */
export function waveLineOf(b: ResultBoard, wave: number): WaveLine | null {
  return waveLines(b).find((l) => l.wave === wave) ?? null;
}
