import { db } from "@/lib/db";
import {
  CHALLENGE,
  FIRST_DAY,
  GOAL_METERS,
  LAST_DAY,
  TIERS,
  WEEKS,
  computeBoards,
  daysElapsed,
  fmtDuration,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  nextTierFor,
  nowMs,
  pacificDay,
  splitSeconds,
  tierFor,
  type Boards,
  type RecordRow,
} from "@/lib/row100k";
import { projectRower } from "./analysis/compute";
import { listRacers, type Racer } from "./racedayData";
import { resolvedRace } from "./racedaySettings";

/* THE LLM EXPORT (owner, 2026-09-16: "give me a button to export my rows
 * data to a json for eval from an LLM about level of athlete and training
 * rec etc. (dev only) allow me to export for any rower"). One rower, or
 * the whole field, as a JSON a model can read cold: every number wears its
 * unit in the key name, and a `guide` string up top says what Rowtember is,
 * what a split is, and what to produce. Real numbers always — the admin
 * truth table, the blackout never touches it — which is why only the
 * admin-only export route (api/row100k/export?kind=llm) calls it. No email,
 * no instagram: a model does not need them.
 *
 * buildRowerExport is pure over what it is handed, so the shape can be
 * checked without the database; llmExport is the one loader around it. */

export const LLM_ROWER_SCHEMA = "rowtember-rower-export/1";
export const LLM_FIELD_SCHEMA = "rowtember-field-export/1";
const LATE_LOGS_THROUGH = "2026-10-03";

/* ---------------------------------------------------------------- inputs */

export type ExportParticipant = {
  id: string;
  rowerNumber: number;
  displayName: string;
  instagram: string;
  division: string;
  createdAt: Date;
};

export type ExportEntry = {
  id: string;
  participantId: string;
  day: string;
  meters: number;
  seconds: number;
  title: string;
  note: string;
  photos: string[];
  createdAt: Date;
};

/* The race, as far as the export cares: which day, how far, and this
 * rower's signup if they have one. Absent when the race could not be read. */
export type ExportRace = {
  day: string;
  meters: number;
  signup: Racer | null;
};

/* ----------------------------------------------------------------- shape */

/* A record-board placing. The value wears its unit in its key (owner,
 * 2026-09-16 review: one `value` was seconds on the fastest boards and
 * metres on the other two, and nothing said which). */
type LlmRecordBase = {
  valueFormatted: string;
  place: number;
  of: number;
  placeInDivision: number;
  ofDivision: number;
  day: string;
};

export type LlmRecord =
  | (LlmRecordBase & {
      board: "fastest5k" | "fastest10k";
      /* The time normalized to the board distance, seconds. */
      valueSeconds: number;
      /* The piece was more than 2% longer than the board distance, so this
       * is a pace conversion, not a rowed test. */
      prorated: boolean;
      pieceMeters: number;
    })
  | (LlmRecordBase & {
      board: "longestRow" | "biggestDay";
      valueMeters: number;
    });

export type LlmSession = {
  day: string;
  weekday: string;
  sessionOfDay: number;
  title: string;
  note: string;
  meters: number;
  seconds: number;
  timeFormatted: string;
  splitSecondsPer500m: number;
  splitFormatted: string;
  metersPerMinute: number;
  loggedAtPacific: string;
  hourLoggedPacific: number;
  photos: number;
};

export type LlmDay = {
  day: string;
  weekday: string;
  meters: number;
  sessions: number;
  seconds: number;
  averageSplitSecondsPer500m: number | null;
  /* "rowed" | "rest" | "today" | "future" — a zero after today is not a
   * rest day, and neither is today until it ends: an unlogged current day
   * reads `today` (owner, 2026-09-16 review: a morning export called the
   * day a rest day and broke the streak). */
  status: "rowed" | "rest" | "today" | "future";
};

/* One challenge week (7, 7, 7, 7 and 2 days). The elapsed-day fields say
 * how much of it has happened, so the current week and the two-day finish
 * do not read as volume drops. */
export type LlmWeek = {
  week: string;
  from: string;
  to: string;
  daysInWeek: number;
  /* Days of this week up to and including today; 0 = not started. */
  daysElapsedInWeek: number;
  /* Every day of the week is over. */
  complete: boolean;
  meters: number;
  sessions: number;
  seconds: number;
  /* meters / daysElapsedInWeek — the figure to compare across weeks. */
  metersPerElapsedDay: number;
  averageSplitSecondsPer500m: number | null;
  averageSplitFormatted: string | null;
};

/* Half of the sessions logged so far — by COUNT, not by calendar. */
export type LlmSessionHalf = {
  sessions: number;
  meters: number;
  averageSessionMeters: number;
  averageSplitSecondsPer500m: number | null;
  averageSplitFormatted: string | null;
};

/* The three figures that are about THIS rower against the field; the
 * field-wide stats they sit beside in the one-rower file are the same
 * LlmFieldStats the field file prints once at the top. */
export type LlmFieldRelative = {
  thisRowerVsMedianMeters: number;
  thisRowerVsMedianSplitSeconds: number | null;
  shareOfFieldOutRowedPct: number | null;
};

export type LlmFieldStats = {
  rowersJoined: number;
  rowersWhoLogged: number;
  fieldMetersTotal: number;
  fieldSessionsTotal: number;
  medianMetersPerRower: number;
  meanMetersPerRower: number;
  metersAtPercentiles: { p25: number; p50: number; p75: number; p90: number };
  medianSessionsPerRower: number;
  medianAverageSplitSecondsPer500m: number | null;
  medianAverageSplitFormatted: string | null;
  rowersAtGoal: number;
};

export type LlmRowerExport = {
  schema: typeof LLM_ROWER_SCHEMA;
  exportedAt: string;
  units: Record<string, string>;
  challenge: {
    name: string;
    firstDay: string;
    lastDay: string;
    goalMeters: number;
    tiers: { meters: number; label: string; title: string }[];
    today: string;
    dayOfChallenge: number;
    daysLeft: number;
    lateLogsThrough: string;
  };
  rower: {
    rowerNumber: number;
    rowerNumberFormatted: string;
    displayName: string;
    division: string;
    joinedAt: string;
  };
  totals: {
    meters: number;
    sessions: number;
    seconds: number;
    timeFormatted: string;
    averageSplitSecondsPer500m: number | null;
    averageSplitFormatted: string | null;
    longestRowMeters: number;
    biggestDayMeters: number;
    daysRowed: number;
    daysRested: number;
    currentStreakDays: number;
    longestStreakDays: number;
    metersPerDayRowed: number;
    metersPerCalendarDay: number;
    tierReached: string | null;
    nextTier: { label: string; metersToGo: number } | null;
    goalPct: number;
  };
  standing: {
    placeOverall: number | null;
    ofOverall: number;
    placeInDivision: number | null;
    ofDivision: number;
    percentileOverall: number | null;
    records: LlmRecord[];
  };
  sessions: LlmSession[];
  byDay: LlmDay[];
  byWeek: LlmWeek[];
  trends: {
    /* Null under two sessions. Halves are by session count; the change is
     * second minus first, so positive = slower. */
    splitTrend: {
      basis: string;
      firstHalfOfSessions: LlmSessionHalf;
      secondHalfOfSessions: LlmSessionHalf;
      splitChangeSecondsPer500m: number | null;
    } | null;
    last7DaysMetersPerDay: number;
    overallMetersPerDay: number;
    longVsShort: { rowsUnder5k: number; rows5kTo10k: number; rowsOver10k: number };
    splitByDistanceBand: { band: string; rows: number; averageSplitSecondsPer500m: number; averageSplitFormatted: string }[];
    typicalHourLogged: number | null;
    projectedFinalMeters: number;
    projectedLowMeters: number;
    projectedHighMeters: number;
    projectionMethod: string;
  };
  fieldContext: LlmFieldStats & LlmFieldRelative;
  raceDay: {
    raceDay: string;
    distanceMeters: number;
    /* An un-withdrawn signup of either role. */
    signedUp: boolean;
    /* Signed up as a racer and not withdrawn: pulls the 5,000 m, gets a
     * wave. A spectator attends only (owner, 2026-09-16 review: a model
     * was tapering spectators for a race they were watching). */
    racing: boolean;
    withdrawn: boolean;
    role: "racer" | "spectator" | null;
    wave: number | null;
    seed5kSeconds: number | null;
    seed5kFormatted: string | null;
    seed5kProrated: boolean | null;
    resultTenths: number | null;
    resultFormatted: string | null;
    /* "to_come" | "finished" | "dnf" as stored on the signup. */
    status: string | null;
  } | null;
  guide: string;
  suggestedPrompt: string;
};

/* Everyone: the guide, the units, the challenge and the field stats once,
 * and the per-rower objects without their copies of any of them. Two more
 * cuts keep a hundred rowers well under a megabyte (owner, 2026-09-16
 * review: the field file measured ~2 MB pretty-printed, most of it thirty
 * byDay slots per rower and the field stats repeated inside every
 * fieldContext): no byDay at all, since `sessions` already carries every
 * row with its day and byWeek the weekly totals, and fieldContext only
 * the three figures relative to the field. Measured 100 rowers x 15
 * sessions at ~820 KB compact. */
export type LlmFieldRower = Omit<
  LlmRowerExport,
  "schema" | "exportedAt" | "guide" | "suggestedPrompt" | "challenge" | "units" | "fieldContext" | "byDay"
> & {
  fieldContext: LlmFieldRelative;
};

export type LlmFieldExport = {
  schema: typeof LLM_FIELD_SCHEMA;
  exportedAt: string;
  units: Record<string, string>;
  challenge: LlmRowerExport["challenge"];
  field: LlmFieldStats;
  guide: string;
  suggestedPrompt: string;
  rowers: LlmFieldRower[];
};

/* --------------------------------------------------------------- helpers */

const r1 = (x: number) => Math.round(x * 10) / 10;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* "Monday" from "2026-09-14", no timezone in the way. */
function weekdayOf(day: string): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
}

/* 1..30 for a September day, 0 for anything else. */
function dayNum(day: string): number {
  if (day.slice(0, 7) !== FIRST_DAY.slice(0, 7)) return 0;
  const n = Number(day.slice(8, 10));
  return n >= 1 && n <= 30 ? n : 0;
}

const avgSplit = (meters: number, seconds: number): number | null =>
  meters > 0 && seconds > 0 ? r1(splitSeconds(meters, seconds)) : null;

const avgSplitText = (meters: number, seconds: number): string | null =>
  meters > 0 && seconds > 0 ? fmtSplit(meters, seconds) : null;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[i];
}

/* The field, once, off the raw board: rowers who have logged at least one
 * meter are the field; a joined-but-idle rower counts in rowersJoined only. */
export function fieldStats(boards: Boards): LlmFieldStats {
  const logged = boards.total.filter((r) => r.meters > 0);
  const meters = logged.map((r) => r.meters);
  const splits = logged.filter((r) => r.seconds > 0).map((r) => splitSeconds(r.meters, r.seconds));
  const medSplit = splits.length ? r1(median(splits)) : null;
  return {
    rowersJoined: boards.total.length,
    rowersWhoLogged: logged.length,
    fieldMetersTotal: meters.reduce((s, m) => s + m, 0),
    fieldSessionsTotal: logged.reduce((s, r) => s + r.sessions, 0),
    medianMetersPerRower: Math.round(median(meters)),
    meanMetersPerRower: logged.length ? Math.round(meters.reduce((s, m) => s + m, 0) / logged.length) : 0,
    metersAtPercentiles: {
      p25: percentile(meters, 25),
      p50: percentile(meters, 50),
      p75: percentile(meters, 75),
      p90: percentile(meters, 90),
    },
    medianSessionsPerRower: median(logged.map((r) => r.sessions)),
    medianAverageSplitSecondsPer500m: medSplit,
    medianAverageSplitFormatted: medSplit === null ? null : fmtSplit(500, medSplit),
    rowersAtGoal: logged.filter((r) => r.meters >= GOAL_METERS).length,
  };
}

function challengeBlock(now: number): LlmRowerExport["challenge"] {
  const dayOfChallenge = daysElapsed(now);
  return {
    name: "Rowtember — 100K September 2026",
    firstDay: FIRST_DAY,
    lastDay: LAST_DAY,
    goalMeters: GOAL_METERS,
    tiers: TIERS.map((t) => ({ meters: t.meters, label: t.label, title: t.title })),
    today: pacificDay(now),
    dayOfChallenge,
    daysLeft: 30 - dayOfChallenge,
    lateLogsThrough: LATE_LOGS_THROUGH,
  };
}

const UNITS: Record<string, string> = {
  meters: "metres rowed on the erg (the machine counts them)",
  seconds: "elapsed time in seconds",
  timeFormatted: "the same time as m:ss or h:mm:ss",
  splitSecondsPer500m: "average pace as seconds per 500 metres; LOWER is faster; 120 = 2:00.0/500m",
  splitFormatted: "the same split as m:ss.t per 500 m",
  metersPerMinute: "metres per minute of rowing",
  day: "calendar day, YYYY-MM-DD, Pacific time",
  dayOfChallenge: "1 on Sep 1 ... 30 on Sep 30; today's number",
  daysLeft: "challenge days after today (30 minus dayOfChallenge)",
  loggedAtPacific: "when the row was entered on the site, Pacific time (not when it was rowed)",
  hourLoggedPacific: "hour of day 0-23 the row was entered, Pacific",
  place: "1 = best; of = how many rowers are on that board",
  percentileOverall: "0-100, share of the logged field this rower is ahead of on total metres (leader = 100)",
  goalPct: "percent of the 100,000 m goal, uncapped",
  "records[].valueSeconds": "fastest5k / fastest10k boards: the time normalized to the board distance, seconds",
  "records[].valueMeters": "longestRow / biggestDay boards: metres",
  "byDay[].status":
    "rowed | rest | today | future; today = the current day with nothing logged yet, NOT a rest day until it ends (daysRested and currentStreakDays leave it out); future = has not happened",
  "byWeek[].daysElapsedInWeek": "days of that week up to and including today; 0 = the week has not started; complete = every day of it is over",
  "byWeek[].metersPerElapsedDay": "meters / daysElapsedInWeek — compare THIS across weeks, not meters; the current week and the two-day finish are shorter, not weaker",
  "trends.splitTrend":
    "the sessions logged so far split in two by COUNT (not by calendar date), each half metre-weighted; splitChangeSecondsPer500m = second half minus first, POSITIVE = slower; check averageSessionMeters in each half first, longer easy rows read as slower without any loss of fitness",
  "raceDay.racing": "true = signed up as a racer and not withdrawn: pulls the 5,000 m and gets a wave; a spectator signup has signedUp true and racing false, attends only, needs no race plan",
  "raceDay.role": "racer | spectator | null (no signup)",
  "raceDay.status": "to_come | finished | dnf | null (no signup)",
  "raceDay.seed5kSeconds":
    "the fastest average pace over any single row of at least 5,000 m this September, normalized to 5,000 m, whether or not it was an all-out effort; a floor for race pace, not a tested 5k",
  tenths: "race result in tenths of a second (11323 = 18:52.3)",
};

function records(boards: Boards, participantId: string, division: string): LlmRecord[] {
  const out: LlmRecord[] = [];
  /* This rower's row on a board, with their overall and division placing. */
  const placing = (rows: readonly RecordRow[]) => {
    const i = rows.findIndex((r) => r.participantId === participantId);
    if (i < 0) return null;
    const div = rows.filter((r) => r.division === division);
    return {
      row: rows[i],
      place: i + 1,
      of: rows.length,
      placeInDivision: div.findIndex((r) => r.participantId === participantId) + 1,
      ofDivision: div.length,
    };
  };
  const timed = [
    ["fastest5k", boards.fastest[5000]],
    ["fastest10k", boards.fastest[10000]],
  ] as const;
  for (const [board, rows] of timed) {
    const p = placing(rows);
    if (!p) continue;
    const { row, ...place } = p;
    out.push({
      board,
      valueSeconds: row.value,
      valueFormatted: fmtRecordTime(row.value),
      ...place,
      day: row.day,
      prorated: !!row.prorated,
      pieceMeters: row.meters ?? 0,
    });
  }
  const metres = [
    ["longestRow", boards.longest],
    ["biggestDay", boards.bigDay],
  ] as const;
  for (const [board, rows] of metres) {
    const p = placing(rows);
    if (!p) continue;
    const { row, ...place } = p;
    out.push({ board, valueMeters: row.value, valueFormatted: fmtMeters(row.value), ...place, day: row.day });
  }
  return out;
}

/* ----------------------------------------------------------------- guide */

function guideText(scope: "rower" | "field", raceDay: string): string {
  const who =
    scope === "rower"
      ? "This JSON describes ONE rower in the challenge."
      : "This JSON describes EVERY rower in the challenge, one object each under `rowers`; the field-wide figures sit once at the top.";
  return [
    "Rowtember (100K September) is a community rowing-machine (erg) challenge: row 100,000 metres between Sep 1 and Sep 30, 2026, logging each session on a shared site. Tiers are reached at 10K, 50K, 100K, 250K and 500K metres.",
    who,
    "A split is the standard rowing pace: seconds per 500 metres, and LOWER is faster (2:00.0 = 120 s). Every key carries its unit in its name; see `units`.",
    "All times and distances are self-reported on an honour system, entered from the machine's monitor after the session, so treat outliers with some doubt. Session `title` and `note` are the rower's own words. A `prorated` record time is a pace conversion from a piece more than 2% longer than the board distance, not a rowed test piece.",
    "The field is mostly recreational rowers rowing at home or in a gym; a handful are club-level or better. No age, sex beyond division (M/F/X), weight, height, training history or health data is available — do not assume any.",
    scope === "rower"
      ? "`byDay` has all thirty September days. Status `future` means the day has not happened yet and is not a rest day; status `today` means the current day has nothing logged YET — it is not a rest day until it ends, and `daysRested` and `currentStreakDays` leave it out."
      : "There is no `byDay` in this file (it kept the field file small): `sessions` carries every row with its day and `byWeek` the weekly totals. A September day before `today` with no session was a rest day; `today` itself is still open, so nothing logged on it yet is not a rest day.",
    "`dayOfChallenge` is today's number. Late logging of September rows is allowed through Oct 3, so the latest day or two may be incomplete.",
    "`byWeek` cuts September into weeks of 7, 7, 7, 7 and 2 days. `daysElapsedInWeek` and `complete` say how much of each week has happened, so compare `metersPerElapsedDay` across weeks, not `meters`: the current week and the two-day finish are shorter, not volume drops.",
    "`trends.splitTrend` splits the sessions logged so far in two by COUNT, not by calendar date, and averages each half metre-weighted; `splitChangeSecondsPer500m` is the second half minus the first, so POSITIVE means slower. Check `averageSessionMeters` in each half before reading a change as fitness: longer easy rows in the second half read as slower.",
    "`projectedFinalMeters` blends the last seven days' rate (60%) with the month-to-date rate (40%) and runs it out over the remaining days; a rower idle seven or more days projects flat; it is never below the metres already logged.",
    `A timed 5,000 m race is held on ${raceDay}. \`raceDay.racing\` says whether this rower pulls it (role \`racer\`, not withdrawn); a \`spectator\` signup attends only, gets no wave and needs no race plan. \`status\` is to_come, finished or dnf. \`seed5kSeconds\` is the fastest average pace over any single row of at least 5,000 m this September, normalized to 5,000 m, whether or not it was an all-out effort — an easy 20k counts, and \`seed5kProrated\` true means that row was longer than 5,100 m. Treat the seed as a floor for race pace, not a tested 5k, and read that session's \`title\`, \`note\` and the record's \`pieceMeters\` before building target splits on it.`,
    "What to produce: an assessment of the rower's level (beginner / recreational / club / competitive) relative to this field and to general erg benchmarks; their strengths; risks such as overtraining, sudden jumps in volume, all-out efforts without easy days, or too little volume to reach 100K; and a concrete two-week plan toward the 100K goal and, when `raceDay.racing` is true, the 5k race, with sessions, distances and target splits. Prefer conservative advice: build volume gradually, keep most rowing easy, and say plainly when the data is too thin (fewer than three sessions) to judge. This is not medical advice.",
  ].join(" ");
}

function promptText(scope: "rower" | "field", raceDay: string): string {
  return scope === "rower"
    ? `You are an experienced rowing coach. Below is a JSON export of one rower's September on the erg: totals, standing in the field, every logged session, daily and weekly volume, trends, a projection and their race-day signup. Read the \`guide\` first. Then give me (1) your read of this rower's level — beginner, recreational, club or competitive — with the numbers you based it on, (2) two or three strengths, (3) any risks you see in how they are training, and (4) a two-week training plan from today toward the 100,000 m goal and, if \`raceDay.racing\` is true, the 5,000 m race on ${raceDay}: sessions per week, distances, target splits per 500 m, and rest days. Be conservative, concrete and brief; use only the data given.`
    : `You are an experienced rowing coach. Below is a JSON export of an entire erg challenge field: one object per rower with their totals, standing, sessions, trends and projection, plus field-wide figures at the top. Read the \`guide\` first. Then give me, for each rower or for the rowers I name, a short read of their level (beginner / recreational / club / competitive), the main risk you see, and one concrete recommendation for the next two weeks toward the 100,000 m goal and, for rowers whose \`raceDay.racing\` is true, the 5,000 m race on ${raceDay}. Be conservative and brief; use only the data given.`;
}

/* --------------------------------------------------------------- builder */

export function buildRowerExport(input: {
  participant: ExportParticipant;
  /* This rower's rows, any order. */
  entries: ExportEntry[];
  /* computeBoards over EVERYONE, unmasked. */
  boards: Boards;
  field: LlmFieldStats;
  race?: ExportRace | null;
  now: number;
}): LlmRowerExport {
  const { participant: p, boards, field, race } = input;
  const today = pacificDay(input.now);
  const dayOfChallenge = daysElapsed(input.now);

  const entries = [...input.entries].sort(
    (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.createdAt.getTime() - b.createdAt.getTime()),
  );

  /* Sessions, in day order, numbered within their day. */
  let lastDay = "";
  let nth = 0;
  const sessions: LlmSession[] = entries.map((e) => {
    nth = e.day === lastDay ? nth + 1 : 1;
    lastDay = e.day;
    const west = new Date(e.createdAt.getTime() - 7 * 3_600_000);
    const iso = west.toISOString();
    return {
      day: e.day,
      weekday: weekdayOf(e.day),
      sessionOfDay: nth,
      title: e.title,
      note: e.note,
      meters: e.meters,
      seconds: e.seconds,
      timeFormatted: fmtDuration(e.seconds),
      splitSecondsPer500m: r1(splitSeconds(e.meters, e.seconds)),
      splitFormatted: fmtSplit(e.meters, e.seconds),
      metersPerMinute: r1(e.meters / (e.seconds / 60)),
      loggedAtPacific: `${iso.slice(0, 10)} ${iso.slice(11, 16)}`,
      hourLoggedPacific: west.getUTCHours(),
      photos: e.photos.length,
    };
  });

  /* Every September day. */
  const dayAcc = new Map<number, { meters: number; sessions: number; seconds: number }>();
  for (const e of entries) {
    const n = dayNum(e.day);
    if (!n) continue;
    const a = dayAcc.get(n) ?? { meters: 0, sessions: 0, seconds: 0 };
    a.meters += e.meters;
    a.sessions += 1;
    a.seconds += e.seconds;
    dayAcc.set(n, a);
  }
  const byDay: LlmDay[] = Array.from({ length: 30 }, (_, i) => {
    const n = i + 1;
    const day = `${FIRST_DAY.slice(0, 8)}${String(n).padStart(2, "0")}`;
    const a = dayAcc.get(n) ?? { meters: 0, sessions: 0, seconds: 0 };
    return {
      day,
      weekday: weekdayOf(day),
      meters: a.meters,
      sessions: a.sessions,
      seconds: a.seconds,
      averageSplitSecondsPer500m: avgSplit(a.meters, a.seconds),
      status: a.sessions > 0 ? "rowed" : day > today ? "future" : day === today ? "today" : "rest",
    };
  });

  const byWeek: LlmWeek[] = WEEKS.map((w) => {
    const rows = entries.filter((e) => e.day >= w.first && e.day <= w.last);
    const meters = rows.reduce((s, e) => s + e.meters, 0);
    const seconds = rows.reduce((s, e) => s + e.seconds, 0);
    const daysInWeek = dayNum(w.last) - dayNum(w.first) + 1;
    const daysElapsedInWeek = Math.min(daysInWeek, Math.max(0, dayOfChallenge - dayNum(w.first) + 1));
    return {
      week: w.label,
      from: w.first,
      to: w.last,
      daysInWeek,
      daysElapsedInWeek,
      complete: today > w.last,
      meters,
      sessions: rows.length,
      seconds,
      metersPerElapsedDay: daysElapsedInWeek ? Math.round(meters / daysElapsedInWeek) : 0,
      averageSplitSecondsPer500m: avgSplit(meters, seconds),
      averageSplitFormatted: avgSplitText(meters, seconds),
    };
  });

  /* Totals. */
  const meters = entries.reduce((s, e) => s + e.meters, 0);
  const seconds = entries.reduce((s, e) => s + e.seconds, 0);
  const daysRowed = new Set(entries.map((e) => e.day)).size;
  let longestStreak = 0;
  let run = 0;
  for (let n = 1; n <= 30; n++) {
    run = dayAcc.has(n) ? run + 1 : 0;
    if (run > longestStreak) longestStreak = run;
  }
  // Counted back from today, or from yesterday when today is not logged yet.
  let currentStreak = 0;
  let from = dayAcc.has(dayOfChallenge) ? dayOfChallenge : dayOfChallenge - 1;
  while (from >= 1 && dayAcc.has(from)) {
    currentStreak += 1;
    from -= 1;
  }
  const next = nextTierFor(meters);
  const totals: LlmRowerExport["totals"] = {
    meters,
    sessions: entries.length,
    seconds,
    timeFormatted: fmtDuration(seconds),
    averageSplitSecondsPer500m: avgSplit(meters, seconds),
    averageSplitFormatted: avgSplitText(meters, seconds),
    longestRowMeters: entries.reduce((m, e) => Math.max(m, e.meters), 0),
    biggestDayMeters: [...dayAcc.values()].reduce((m, a) => Math.max(m, a.meters), 0),
    daysRowed,
    // Days that ended with nothing logged; an unlogged today is still open.
    daysRested: byDay.filter((d) => d.status === "rest").length,
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
    metersPerDayRowed: daysRowed ? Math.round(meters / daysRowed) : 0,
    metersPerCalendarDay: Math.round(meters / dayOfChallenge),
    tierReached: tierFor(meters)?.label ?? null,
    nextTier: next ? { label: next.label, metersToGo: next.meters - meters } : null,
    goalPct: r1((meters / GOAL_METERS) * 100),
  };

  /* Standing: among rowers who have logged, overall and in the division. */
  const logged = boards.total.filter((r) => r.meters > 0);
  const overallIdx = logged.findIndex((r) => r.participantId === p.id);
  const inDivision = logged.filter((r) => r.division === p.division);
  const divIdx = inDivision.findIndex((r) => r.participantId === p.id);
  const placeOverall = overallIdx >= 0 ? overallIdx + 1 : null;
  const standing: LlmRowerExport["standing"] = {
    placeOverall,
    ofOverall: logged.length,
    placeInDivision: divIdx >= 0 ? divIdx + 1 : null,
    ofDivision: inDivision.length,
    percentileOverall:
      placeOverall === null ? null : Math.round((100 * (logged.length - placeOverall)) / Math.max(1, logged.length - 1)),
    records: records(boards, p.id, p.division),
  };

  /* Trends. Halves are by session count, so a rower with three rows still
   * gets a before/after; each half says how long its rows were, since a
   * second half of longer easy rows reads slower on its own. */
  const done = sessions.filter((s) => s.day <= today);
  const half = Math.floor(done.length / 2);
  const halfOf = (rows: LlmSession[]): LlmSessionHalf => {
    const m = rows.reduce((s, r) => s + r.meters, 0);
    const t = rows.reduce((s, r) => s + r.seconds, 0);
    return {
      sessions: rows.length,
      meters: m,
      averageSessionMeters: rows.length ? Math.round(m / rows.length) : 0,
      averageSplitSecondsPer500m: avgSplit(m, t),
      averageSplitFormatted: avgSplitText(m, t),
    };
  };
  const firstHalf = halfOf(done.slice(0, half));
  const secondHalf = halfOf(done.slice(half));
  const splitTrend: LlmRowerExport["trends"]["splitTrend"] =
    done.length >= 2
      ? {
          basis: "sessions logged so far, split in two by count (not by calendar date); splits metre-weighted; change = second half minus first, positive = slower",
          firstHalfOfSessions: firstHalf,
          secondHalfOfSessions: secondHalf,
          splitChangeSecondsPer500m:
            firstHalf.averageSplitSecondsPer500m !== null && secondHalf.averageSplitSecondsPer500m !== null
              ? r1(secondHalf.averageSplitSecondsPer500m - firstHalf.averageSplitSecondsPer500m)
              : null,
        }
      : null;
  const last7 = [...dayAcc.entries()]
    .filter(([n]) => n > dayOfChallenge - 7 && n <= dayOfChallenge)
    .reduce((s, [, a]) => s + a.meters, 0);
  const bands = [
    { band: "under 2,000 m", lo: 0, hi: 2000 },
    { band: "2,000-4,999 m", lo: 2000, hi: 5000 },
    { band: "5,000-9,999 m", lo: 5000, hi: 10000 },
    { band: "10,000 m and over", lo: 10000, hi: Infinity },
  ];
  const splitByDistanceBand = bands
    .map((b) => {
      const rows = sessions.filter((s) => s.meters >= b.lo && s.meters < b.hi);
      const m = rows.reduce((s, r) => s + r.meters, 0);
      const t = rows.reduce((s, r) => s + r.seconds, 0);
      return { band: b.band, rows: rows.length, averageSplitSecondsPer500m: avgSplit(m, t), averageSplitFormatted: avgSplitText(m, t) };
    })
    .filter(
      (b): b is { band: string; rows: number; averageSplitSecondsPer500m: number; averageSplitFormatted: string } =>
        b.rows > 0 && b.averageSplitSecondsPer500m !== null && b.averageSplitFormatted !== null,
    );
  const proj = projectRower(
    entries.map((e) => ({ day: dayNum(e.day), meters: e.meters })),
    dayOfChallenge,
  );
  const trends: LlmRowerExport["trends"] = {
    splitTrend,
    last7DaysMetersPerDay: Math.round(last7 / Math.min(7, dayOfChallenge)),
    overallMetersPerDay: Math.round(meters / dayOfChallenge),
    longVsShort: {
      rowsUnder5k: sessions.filter((s) => s.meters < 5000).length,
      rows5kTo10k: sessions.filter((s) => s.meters >= 5000 && s.meters < 10000).length,
      rowsOver10k: sessions.filter((s) => s.meters >= 10000).length,
    },
    splitByDistanceBand,
    typicalHourLogged: sessions.length ? Math.round(median(sessions.map((s) => s.hourLoggedPacific))) : null,
    projectedFinalMeters: Math.max(meters, proj.projected),
    projectedLowMeters: Math.max(meters, proj.low),
    projectedHighMeters: Math.max(meters, proj.high),
    projectionMethod:
      "current metres + rate x days left, rate = 0.6 x last-7-days metres/day + 0.4 x month-to-date metres/day; flat (rate 0) when idle 7+ days; low/high use the smaller/larger of the two rates; never below metres already logged (rows logged ahead of today count in the totals but not the rate)",
  };

  const mySplit = totals.averageSplitSecondsPer500m;
  const fieldContext: LlmRowerExport["fieldContext"] = {
    ...field,
    thisRowerVsMedianMeters: meters - field.medianMetersPerRower,
    thisRowerVsMedianSplitSeconds:
      mySplit !== null && field.medianAverageSplitSecondsPer500m !== null
        ? r1(mySplit - field.medianAverageSplitSecondsPer500m)
        : null,
    shareOfFieldOutRowedPct:
      meters > 0 && logged.length > 1
        ? Math.round((100 * logged.filter((r) => r.meters < meters).length) / (logged.length - 1))
        : null,
  };

  /* Race day: the seed is this rower's fastest5k board row — the best
   * average pace over any row of 5,000 m or more, all-out or not — which
   * is why the guide calls it a floor. Only a racer pulls; a spectator
   * signup is in the room and nothing else. */
  let raceDay: LlmRowerExport["raceDay"] = null;
  if (race) {
    const seed = boards.fastest[5000].find((r) => r.participantId === p.id) ?? null;
    const s = race.signup;
    const signedUp = !!s && !s.withdrewAt;
    raceDay = {
      raceDay: race.day,
      distanceMeters: race.meters,
      signedUp,
      racing: signedUp && s?.role === "racer",
      withdrawn: !!s?.withdrewAt,
      role: s?.role ?? null,
      wave: s?.wave ?? null,
      seed5kSeconds: seed?.value ?? null,
      seed5kFormatted: seed ? fmtRecordTime(seed.value) : null,
      seed5kProrated: seed ? !!seed.prorated : null,
      resultTenths: s?.tenths ?? null,
      resultFormatted: s?.tenths != null ? fmtRecordTime(s.tenths / 10) : null,
      status: s?.status ?? null,
    };
  }

  const raceLabel = race?.day ?? "2026-09-27";
  return {
    schema: LLM_ROWER_SCHEMA,
    exportedAt: new Date(input.now).toISOString(),
    units: UNITS,
    challenge: challengeBlock(input.now),
    rower: {
      rowerNumber: p.rowerNumber,
      rowerNumberFormatted: fmtRowerNumber(p.rowerNumber),
      displayName: p.displayName,
      division: p.division,
      joinedAt: p.createdAt.toISOString(),
    },
    totals,
    standing,
    sessions,
    byDay,
    byWeek,
    trends,
    fieldContext,
    raceDay,
    guide: guideText("rower", raceLabel),
    suggestedPrompt: promptText("rower", raceLabel),
  };
}

/* One rower's object for the field file: the same shape minus everything
 * the field file prints once, minus byDay, and fieldContext cut to the
 * three figures that are about this rower. Exported so the field file's
 * size can be measured without the database. */
export function fieldRowerOf(x: LlmRowerExport): LlmFieldRower {
  const { thisRowerVsMedianMeters, thisRowerVsMedianSplitSeconds, shareOfFieldOutRowedPct } = x.fieldContext;
  return {
    rower: x.rower,
    totals: x.totals,
    standing: x.standing,
    sessions: x.sessions,
    byWeek: x.byWeek,
    trends: x.trends,
    fieldContext: { thisRowerVsMedianMeters, thisRowerVsMedianSplitSeconds, shareOfFieldOutRowedPct },
    raceDay: x.raceDay,
  };
}

/* ---------------------------------------------------------------- loader */

/* Everyone in the challenge with every row, the same selects the CSV export
 * reads plus instagram for computeBoards (never emitted). */
async function loadAll(): Promise<{ participants: ExportParticipant[]; entries: ExportEntry[] }> {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true, createdAt: true },
      orderBy: { rowerNumber: "asc" },
    }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: {
        id: true,
        participantId: true,
        day: true,
        meters: true,
        seconds: true,
        title: true,
        note: true,
        photos: true,
        createdAt: true,
      },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  return { participants, entries };
}

/* The race and its field, best effort: a missing table or a read hiccup
 * costs the raceDay block, never the export. */
async function loadRace(): Promise<{ day: string; meters: number; racers: Racer[] } | null> {
  try {
    const race = await resolvedRace();
    const racers = await listRacers(race);
    return { day: race.day, meters: race.meters, racers };
  } catch (err) {
    console.error("row100k llm export: race read failed — exporting without raceDay", err);
    return null;
  }
}

export async function llmExport(rowerNumber: number): Promise<LlmRowerExport | null>;
export async function llmExport(rowerNumber: null): Promise<LlmFieldExport>;
export async function llmExport(rowerNumber: number | null): Promise<LlmRowerExport | LlmFieldExport | null> {
  const now = nowMs();
  const [{ participants, entries }, race] = await Promise.all([loadAll(), loadRace()]);
  const boards = computeBoards(participants, entries, pacificDay(now));
  const field = fieldStats(boards);

  const entriesOf = new Map<string, ExportEntry[]>();
  for (const e of entries) {
    const list = entriesOf.get(e.participantId);
    if (list) list.push(e);
    else entriesOf.set(e.participantId, [e]);
  }
  const signupOf = new Map<string, Racer>();
  for (const r of race?.racers ?? []) signupOf.set(r.participantId, r);

  const build = (p: ExportParticipant) =>
    buildRowerExport({
      participant: p,
      entries: entriesOf.get(p.id) ?? [],
      boards,
      field,
      race: race ? { day: race.day, meters: race.meters, signup: signupOf.get(p.id) ?? null } : null,
      now,
    });

  if (rowerNumber !== null) {
    const p = participants.find((x) => x.rowerNumber === rowerNumber);
    return p ? build(p) : null;
  }

  const rowers: LlmFieldRower[] = participants.map((p) => fieldRowerOf(build(p)));
  const raceLabel = race?.day ?? "2026-09-27";
  return {
    schema: LLM_FIELD_SCHEMA,
    exportedAt: new Date(now).toISOString(),
    units: UNITS,
    challenge: challengeBlock(now),
    field,
    guide: guideText("field", raceLabel),
    suggestedPrompt: promptText("field", raceLabel),
    rowers,
  };
}
