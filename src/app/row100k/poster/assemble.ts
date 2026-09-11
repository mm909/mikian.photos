/* poster/assemble.ts — the PURE half of the DATA stream.
 *
 * Boards and rows in, poster JSON out (types.ts CommunityPoster /
 * RowerPoster). No db, no next/headers, no Dates: data.ts reads the live
 * tables and hands them here; fixture.ts builds fake tables and hands them
 * here too, so the dev page and the harnesses exercise the SAME masking
 * path the studio ships — a fixture that hand-built its shapes would drift
 * from the real payload the first time a rule moved.
 *
 * The masking rule is the share-card rule (SPEC.md §1.4, §5): everything
 * is read off the PUBLIC board — boardView with no viewer and no admin —
 * and whatever that board hides arrives here already as a tier floor plus
 * a digit count (blackoutRules.maskBoards). This file turns those into
 * Figure shapes and never lets a hidden number through: a masked rower's
 * meters, seconds, split, pace curve and calendar are simply not built.
 * "I shouldn't be able to know that I'm number three or number four"
 * (owner, 2026-09-05) — a poster leaves the site, so the rower themself
 * and an admin get the same blocks a stranger gets. */

import type { BlackoutState } from "@/lib/blackout";
import {
  PACIFIC_SHIFT_MS,
  clockShape,
  digitCount,
  fmtPacificDay,
  maskStandings,
  partialShape,
  shapeOf,
  type StandingRow,
} from "@/lib/blackoutRules";
import {
  END_MS,
  FIRST_DAY,
  GOAL_METERS,
  LAST_DAY,
  computeBoards,
  daysElapsed,
  divisionRank,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtPaceTag,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  nowMs,
  pacificDay,
  recordPlacements,
  type Boards,
  type RecordRow,
} from "@/lib/row100k";
import { fmtClock, fmtInt } from "../analysis/fmt";
import { recordDef } from "../records/defs";
import { buildField, type FieldEntry, type FieldModel } from "../stats/field";
import type {
  CommunityPoster,
  Division,
  Figure,
  PosterAsOf,
  PosterBlackout,
  PosterClub,
  PosterPartner,
  PosterRecord,
  PosterRecordKey,
  PosterRecordLine,
  PosterSplit,
  PosterStanding,
  PosterTakeaway,
  RowerBest,
  RowerLogRow,
  RowerPoster,
} from "./types";

/* ------------------------------------------------------------ constants */

/* The partner is the static block partners/page.tsx draws (GRIZZLY), with
 * the two lines the poster prints pre-formatted. Same-origin PNGs; the
 * wordmark is gold + white so it only ever sits on the green plate. */
export const GRIZZLY_PARTNER: PosterPartner = {
  name: "Grizzly Health",
  code: "ROWTEMBER",
  deal: "10% OFF MEALS AT GRIZZLYHEALTH.ORG",
  site: "https://grizzlyhealth.org",
  bear: "/row100k/partners/grizzly-bear.png",
  wordmark: "/row100k/partners/grizzly-wordmark.png",
  footerLine: "PARTNER · GRIZZLY HEALTH · CODE ROWTEMBER · 10% OFF",
};

export const COMMUNITY_URL = "MIKIANMUSSER.COM/ROW100K";
export const rowerUrl = (rowerNumber: number) => `${COMMUNITY_URL}/R/${fmtRowerNumber(rowerNumber)}`;

/* Sessions before the hour bars or a density are drawn (stats/field.ts
 * MIN_KDE — the field keeps its own copy; the hours follow the same floor). */
const MIN_SESSIONS = 5;

const YEAR = Number(FIRST_DAY.slice(0, 4));
const MONTH = FIRST_DAY.slice(0, 7);

const r1 = (v: number) => Math.round(v * 10) / 10;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/* "561k" / "1.2M" — share/cards.ts kLabel (not exported there), copied so
 * the poster's takeaways read the way the community month card does. */
export const kLabel = (m: number): string =>
  m >= 999_500 ? `${(m / 1_000_000).toFixed(1)}M` : `${Math.max(1, Math.round(m / 1000))}k`;

/* "7 AM" — the busiest hour, on the challenge's fixed Pacific clock. */
export const hourLabel = (h: number): string =>
  h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;

/* ------------------------------------------------------------- as-of */

/* The poster's clock, built once from the challenge's fixed UTC-7 day
 * (row100k.ts daysElapsed / pacificDay). Clamped into September on both
 * ends: a hung poster reads SEP 30 · FINAL from END_MS on, never "Oct 2",
 * and before the first stroke it reads Sep 1 (the studio is not offered
 * then, but the payload must still be sane). `stamp` is the mono tail both
 * datelines share. */
export function posterAsOf(atMs = nowMs()): PosterAsOf & { stamp: string } {
  const dayNumber = daysElapsed(atMs);
  const final = atMs >= END_MS;
  const raw = pacificDay(atMs);
  const iso = final || raw > LAST_DAY ? LAST_DAY : raw < FIRST_DAY ? FIRST_DAY : raw;
  const day = fmtDay(iso);
  // The day count is gone (owner, 2026-09-10: "day ten of thirty can just
  // get removed on both of them — if it is September tenth, then we know it
  // is day ten"), and at FINAL the date goes with it: a finished month is
  // the whole month, and the nameplate already says ROWTEMBER 2026.
  const stamp = final ? "FINAL" : day.toUpperCase();
  return { day, iso, dayNumber, final, year: YEAR, dateline: stamp, stamp };
}

/* The blackout as the sheet prints it. The note explains the blocks on the
 * paper itself — a poster has no legend page — and says that the times are
 * still real (records/defs.ts liteRecords: TIME records stay public). */
export function posterBlackout(state: BlackoutState): PosterBlackout {
  const until = state.active && state.endsAt ? fmtPacificDay(state.endsAt) || null : null;
  const note = state.active
    ? `BLACKOUT — THE ELITE ARE HIDDEN${until ? ` UNTIL ${until.toUpperCase()}` : ""} · TIMES ARE SHOWN`
    : null;
  return { active: state.active, until, note };
}

/* The admin's test blackout (row100kViewer.previewBlackout, boardView
 * forceBlackout): the window is open for this request only. */
export function forceBlackoutState(real: BlackoutState, force: boolean): BlackoutState {
  return force && !real.active
    ? { ...real, active: true, hideLow: undefined, rampDaysLeft: undefined }
    : real;
}

/* THE hidden set — row100kViewer.maskedIds, copied because that module
 * imports next/headers and the db and this file must stay pure. Same rule:
 * the rows boardView masked, nothing decided here. */
export function hiddenIds(boards: Boards): Set<string> {
  const out = new Set<string>();
  for (const r of boards.total) if (r.masked) out.add(r.participantId);
  return out;
}

const divisionOf = (d: string): Division | "X" => (d === "M" || d === "F" ? d : "X");

/* Rows with a meter, or masked (a masked row under 10k carries a floor of
 * 0 and is on the board by definition — post/page.tsx, records/defs.ts). */
const onBoard = (boards: Boards) => boards.total.filter((r) => r.meters > 0 || r.masked);

/* ---------------------------------------------------------- community */

export type CommunityInput = {
  /* The PUBLIC board (boardView, no viewer, no admin, forceBlackout as the
   * page asks) — or null when the read threw. */
  boards: Boards | null;
  /* The window as boardView returned it (the forced one under the preview). */
  blackout: BlackoutState;
  /* Every row's who / day / logged-at, for the hour bars and the big-day
   * row count. null when the read failed — the hours then say so. */
  rows: { participantId: string; day: string; createdAtMs: number }[] | null;
  /* fieldData.ts fieldEntries — the split density. null when unreadable. */
  field: FieldEntry[] | null;
  /* firstToGoal reduced to what may ship: the claim's running total never
   * comes this far. */
  claim: { name: string; rowerNumber: number; day: string } | null;
  atMs?: number;
};

/* One PUBLIC-board row as a standing. Masked: the tier floor and the digit
 * count become a shape of the real total's length with the real commas
 * (partialShape(0, digits, digits) = "###,###"); the run-up (hideLow) keeps
 * the digits still showing ("142,###"); everyone else prints. */
type StandRow = StandingRow & { participantId: string; hideLow?: number };

function toStanding(r: StandRow): PosterStanding {
  const base = {
    name: r.name,
    rowerNumber: r.rowerNumber,
    division: (r.division === "F" ? "F" : "M") as Division,
  };
  if (r.masked) {
    const digits = r.digits ?? digitCount(r.meters);
    return {
      ...base,
      meters: { shape: `${partialShape(0, digits, digits)} m` },
      masked: true,
      unranked: true,
      ...(r.paceTag ? { paceTag: r.paceTag } : {}),
    };
  }
  if (r.hideLow) {
    return {
      ...base,
      meters: { shape: `${partialShape(r.meters, r.hideLow, r.digits)} m` },
      ...(r.unranked ? { unranked: true as const } : {}),
    };
  }
  return {
    ...base,
    meters: { text: fmtMeters(r.meters) },
    ...(r.unranked ? { unranked: true as const } : {}),
    ...(r.paceTag ? { paceTag: r.paceTag } : {}),
  };
}

/* The board rows for the two top-tens. The board arrives masked already;
 * maskStandings runs over it again for idempotency (blackoutRules.ts: a
 * second pass finds the same elite in the same order), so a board that was
 * somehow read without the mask still leaves here masked. */
function standingsOf(boards: Boards, active: boolean): { men: PosterStanding[]; women: PosterStanding[] } {
  const rows: StandRow[] = onBoard(boards).map((r) => ({
    participantId: r.participantId,
    name: r.name,
    rowerNumber: r.rowerNumber,
    meters: r.meters,
    division: r.division,
    ...(r.masked ? { masked: true } : {}),
    ...(r.digits != null ? { digits: r.digits } : {}),
    ...(r.unranked ? { unranked: true } : {}),
    ...(r.paceTag ? { paceTag: r.paceTag } : {}),
    ...(r.hideLow ? { hideLow: r.hideLow } : {}),
  }));
  const safe = maskStandings(rows, { active, admin: false }) as StandRow[];
  const pick = (d: Division) =>
    safe
      .filter((r) => r.division === d)
      .slice(0, 10)
      .map(toStanding);
  return { men: pick("M"), women: pick("F") };
}

/* The four records, six lines (records/defs.ts liteRecords rule): the two
 * TIME records print for a hidden holder too; a hidden holder's METERS
 * record ships as its shape. post/page.tsx add() masks times as well and
 * is not this surface's rule — the community records and a rower's bests
 * must agree (SPEC.md §5.3). */
function recordsOf(
  boards: Boards,
  hidden: Set<string>,
  rowsThatDay: (participantId: string, day: string) => number | null,
): PosterRecord[] {
  const label = (key: string, fallback: string) => recordDef(key)?.title ?? fallback;
  const holder = (r: RecordRow) => ({
    name: r.name,
    rowerNumber: r.rowerNumber,
  });

  const timeLine = (dist: 5000 | 10000, division: Division): PosterRecordLine | null => {
    const r = boards.fastest[dist].find((x) => x.division === division);
    if (!r) return null;
    return {
      division,
      value: { text: fmtRecordTime(r.value) },
      holder: holder(r),
      day: fmtDay(r.day),
      meta: `${fmtSplit(dist, r.value)} /500m`,
    };
  };
  const metersLine = (r: RecordRow | undefined, meta?: string): PosterRecordLine | null =>
    r
      ? {
          value: hidden.has(r.participantId)
            ? { shape: shapeOf(fmtMeters(r.value)) }
            : { text: fmtMeters(r.value) },
          holder: holder(r),
          day: fmtDay(r.day),
          ...(meta ? { meta } : {}),
        }
      : null;
  const lines = (...xs: (PosterRecordLine | null)[]) => xs.filter((x): x is PosterRecordLine => x !== null);

  const big = boards.bigDay[0];
  const bigN = big ? rowsThatDay(big.participantId, big.day) : null;
  const bigMeta = bigN === null ? undefined : bigN === 1 ? "1 row" : `${bigN} rows`;

  return [
    {
      key: "fastest5000",
      label: label("5000", "Fastest 5k"),
      lines: lines(timeLine(5000, "M"), timeLine(5000, "F")),
    },
    {
      key: "fastest10000",
      label: label("10000", "Fastest 10k"),
      lines: lines(timeLine(10000, "M"), timeLine(10000, "F")),
    },
    {
      key: "longest",
      label: label("longest", "Longest row"),
      lines: lines(metersLine(boards.longest[0])),
    },
    {
      key: "bigday",
      label: label("bigday", "Biggest day"),
      lines: lines(metersLine(big, bigMeta)),
    },
  ];
}

const EMPTY_RECORDS: PosterRecord[] = [
  { key: "fastest5000", label: "Fastest 5k", lines: [] },
  { key: "fastest10000", label: "Fastest 10k", lines: [] },
  { key: "longest", label: "Longest row", lines: [] },
  { key: "bigday", label: "Biggest day", lines: [] },
];

/* The 100K club: names only, PUBLIC-board order. Membership is the tier
 * floor (a masked row's meters IS its floor, and 100,000 ≥ GOAL_METERS), so
 * the filter never reads a hidden total; the roll is never sorted on
 * meters and never carries them. The claim is a name and a day. */
function clubOf(boards: Boards, claim: CommunityInput["claim"]): PosterClub {
  const roll = boards.total
    .filter((r) => r.meters >= GOAL_METERS)
    .map((r) => ({ name: r.name, rowerNumber: r.rowerNumber }));
  return {
    count: boards.community.finished,
    roll,
    first: claim
      ? {
          name: claim.name,
          rowerNumber: claim.rowerNumber,
          day: fmtDay(claim.day),
        }
      : null,
  };
}

/* Meters per day, Sep 1 … the as-of day, by differencing boards.daily — the
 * SAME board read as totals.meters, so the curve's last point equals the
 * headline (an admin's future-dated test row is the one way they differ; it
 * is skipped rather than folded onto the wrong day). */
function byDayOf(boards: Boards, dayNumber: number): number[] {
  const out = Array<number>(dayNumber).fill(0);
  let prev = 0;
  for (const d of boards.daily) {
    const m = d.cum - prev;
    prev = d.cum;
    if (d.day.slice(0, 7) !== MONTH) continue;
    const i = Number(d.day.slice(8, 10)) - 1;
    if (i < 0 || i >= dayNumber) continue;
    out[i] += m;
  }
  return out;
}

/* 24 SESSION counts by Pacific hour of createdAt (stats/page.tsx recipe:
 * createdAt − 7 h, September rows only, orphans dropped). Sessions, never
 * meters — "a meters sum handed to client components would equal one
 * rower's session whenever they row an hour alone" (review, 2026-09-05). */
function hoursOf(rows: CommunityInput["rows"], known: Set<string> | null): number[] | null {
  if (!rows) return null;
  const counts = Array<number>(24).fill(0);
  let n = 0;
  for (const r of rows) {
    if (known && !known.has(r.participantId)) continue;
    const west = new Date(r.createdAtMs - PACIFIC_SHIFT_MS);
    const day = west.toISOString().slice(0, 10);
    if (day < FIRST_DAY || day > LAST_DAY) continue;
    counts[west.getUTCHours()] += 1;
    n += 1;
  }
  return n >= MIN_SESSIONS ? counts : null;
}

/* The split density (stats/field.ts buildField): an aggregate over
 * everyone, hidden rowers included — the rug, which is the only part that
 * skips them, never ships. null under MIN_KDE timed rows. */
function fieldOf(field: FieldEntry[] | null, hidden: Set<string>): FieldModel | null {
  if (!field) return null;
  try {
    return buildField(field, { isHidden: (id) => hidden.has(id), meId: null }).field;
  } catch (err) {
    console.error("row100k/poster: field maths failed", err);
    return null;
  }
}

function splitOf(model: FieldModel | null): PosterSplit {
  const k = model?.paceKde;
  if (!k) return null;
  return {
    xs: k.xs,
    ys: k.ys,
    median: r1(k.median),
    mean: r1(k.mean),
    sd: r1(k.sd),
  };
}

/* Pre-formatted, in PRIORITY order (SPEC.md §5.7). Every value is an
 * aggregate; the blackout never touches this list. A line whose figure does
 * not exist yet (no hours, no field) is left out rather than printed as a
 * dash — the ledgers draw the lines they have. */
function takeawaysOf(
  byDay: number[],
  hours: number[] | null,
  model: FieldModel | null,
  totals: { sessions: number; meters: number; rowers: number },
  dayNumber: number,
  club: PosterClub,
): PosterTakeaway[] {
  const out: PosterTakeaway[] = [];
  let bi = -1;
  let bm = 0;
  byDay.forEach((m, i) => {
    if (m > bm) {
      bm = m;
      bi = i;
    }
  });
  if (bi >= 0)
    out.push({
      key: "biggestDay",
      label: "BIGGEST DAY",
      value: `SEP ${bi + 1} · ${kLabel(bm).toUpperCase()}`,
    });
  if (hours) {
    let hi = 0;
    hours.forEach((c, h) => {
      if (c > hours[hi]) hi = h;
    });
    out.push({
      key: "busiestHour",
      label: "BUSIEST HOUR",
      value: hourLabel(hi),
    });
  }
  if (model?.pace)
    out.push({
      key: "medianSplit",
      label: "MEDIAN SPLIT",
      value: `${fmtClock(model.pace.median)} /500M`,
    });
  if (model?.length)
    out.push({
      key: "avgRow",
      label: "AVERAGE ROW",
      value: `${fmtInt(model.length.mean)} M`,
    });
  if (totals.sessions > 0) {
    out.push({
      key: "rowsADay",
      label: "ROWS A DAY",
      value: fmtInt(totals.sessions / Math.max(1, dayNumber)),
    });
  }
  if (totals.rowers > 0) {
    out.push({
      key: "metersARower",
      label: "METERS A ROWER",
      value: `${fmtInt(totals.meters / totals.rowers)} M`,
    });
  }
  if (club.count > 0) {
    const first = club.first
      ? ` · FIRST ${club.first.name.toUpperCase()} · ${club.first.day.toUpperCase()}`
      : "";
    out.push({
      key: "club",
      label: "THE 100K CLUB",
      value: `${club.count} ROWERS${first}`,
    });
  }
  return out;
}

export function assembleCommunity(input: CommunityInput): CommunityPoster {
  const atMs = input.atMs ?? nowMs();
  const asOf = posterAsOf(atMs);
  const blackout = posterBlackout(input.blackout);
  const boards = input.boards;

  /* Fail CLOSED without a board while a window is open (SPEC.md §5.1):
   * standings empty, records empty; the aggregates below still count what
   * the other reads give, since none of them is anyone's number. With no
   * window open a missing board just means an empty sheet. */
  const hidden = boards ? hiddenIds(boards) : new Set<string>();
  const known = boards ? new Set(boards.total.map((r) => r.participantId)) : null;
  const rowsThatDay = (participantId: string, day: string): number | null =>
    input.rows ? input.rows.filter((r) => r.participantId === participantId && r.day === day).length : null;

  const standings = boards ? standingsOf(boards, input.blackout.active) : { men: [], women: [] };
  const records = boards ? recordsOf(boards, hidden, rowsThatDay) : EMPTY_RECORDS;
  const club = boards ? clubOf(boards, input.claim) : { count: 0, roll: [], first: null };
  const byDay = boards ? byDayOf(boards, asOf.dayNumber) : Array<number>(asOf.dayNumber).fill(0);
  const totals = {
    meters: boards?.community.meters ?? 0,
    seconds: boards?.community.seconds ?? 0,
    sessions: boards?.community.sessions ?? 0,
    /* Rowers with a meter on the board (post/page.tsx rowersLogged) — the
     * people METERS A ROWER divides by, not the sign-up count. */
    rowers: boards ? onBoard(boards).length : 0,
    club: boards?.community.finished ?? 0,
  };
  const hours = hoursOf(input.rows, known);
  const model = fieldOf(input.field, hidden);

  return {
    kind: "community",
    year: asOf.year,
    asOf: {
      day: asOf.day,
      iso: asOf.iso,
      dayNumber: asOf.dayNumber,
      final: asOf.final,
      year: asOf.year,
      dateline: asOf.stamp,
    },
    blackout,
    totals,
    byDay,
    standings,
    records,
    club,
    hours,
    split: splitOf(model),
    takeaways: takeawaysOf(byDay, hours, model, totals, asOf.dayNumber, club),
    partner: GRIZZLY_PARTNER,
    url: COMMUNITY_URL,
  };
}

/* -------------------------------------------------------------- rower */

export type RowerInput = {
  participant: {
    id: string;
    rowerNumber: number;
    displayName: string;
    instagram: string;
    division: string;
  };
  /* The rower's rows, day asc then logged asc (r/[num]/page.tsx getRower). */
  entries: { day: string; meters: number; seconds: number; title: string }[];
  /* The PUBLIC board — or null when the read threw. */
  pub: Boards | null;
  blackout: BlackoutState;
  atMs?: number;
};

const metersFigure = (v: number, masked: boolean): Figure =>
  masked ? { shape: shapeOf(fmtMeters(v)) } : { text: fmtMeters(v) };

export function assembleRower(input: RowerInput): RowerPoster {
  const atMs = input.atMs ?? nowMs();
  const asOf = posterAsOf(atMs);
  const p = input.participant;
  const entries = input.entries;
  const pub = input.pub;
  const active = input.blackout.active;

  const b = computeBoards(
    [p],
    entries.map((e) => ({
      participantId: p.id,
      day: e.day,
      meters: e.meters,
      seconds: e.seconds,
    })),
    pacificDay(atMs),
  );
  const me = b.total[0];
  const seconds = entries.reduce((s, e) => s + e.seconds, 0);
  const timed = me.meters > 0 && seconds > 0;

  /* Masked = the PUBLIC board hides this rower, fail CLOSED when it cannot
   * be read while a window is open. Self and admins included — a poster
   * leaves the site. */
  const pubRow = pub?.total.find((r) => r.participantId === p.id);
  const masked = active && (pub ? hiddenIds(pub).has(p.id) : true);
  const floor = pubRow?.meters ?? 0;
  const club = (masked ? floor : me.meters) >= GOAL_METERS;
  const division = divisionOf(p.division);

  /* ELITE is a claim, not a withheld value (r/[num]/page.tsx review,
   * 2026-09-05): it rides only on a rower the BOARD listed as elite. With
   * the board unreadable the numbers still mask, but no badge is pinned —
   * the rank is null and the strip prints a dash. */
  let rank: RowerPoster["rank"] = null;
  if (pub && pubRow) {
    if (masked || pubRow.unranked) rank = "ELITE";
    else if (division !== "X") rank = divisionRank(pub, p.id);
  }

  /* Places to #10 off the public board's record lists (the record boards
   * are never masked — maskBoards touches total only — so a place is real).
   * Time-board places stay while masked (times are public); meters-board
   * places go with the meters. */
  const places = pub ? recordPlacements(pub, p.id, 10) : [];
  const placeOf = (key: PosterRecordKey): number | null => {
    if (masked && (key === "longest" || key === "bigday")) return null;
    return places.find((r) => r.key === key)?.place ?? null;
  };

  /* Per-day meters and the rowed flags, Sep 1 … the as-of day. Dates are
   * public; the meters are not built while masked. */
  const rowed = Array<boolean>(asOf.dayNumber).fill(false);
  const dayMeters = Array<number>(asOf.dayNumber).fill(0);
  const rowsOn = new Map<string, number>();
  for (const e of entries) {
    rowsOn.set(e.day, (rowsOn.get(e.day) ?? 0) + 1);
    if (e.day.slice(0, 7) !== MONTH) continue;
    const i = Number(e.day.slice(8, 10)) - 1;
    if (i < 0 || i >= asOf.dayNumber) continue;
    rowed[i] = true;
    dayMeters[i] += e.meters;
  }

  /* THE PACE: the running average split after each timed session against
   * the meters so far (r/[num]/page.tsx paceCurve). Never built while
   * masked — a session-indexed curve ships ratios of hidden numbers on
   * paper forever; the pace slot draws the paceTag instead (SPEC.md §6 R5). */
  let pace: RowerPoster["pace"] = null;
  if (!masked) {
    pace = [];
    let cm = 0;
    let cs = 0;
    for (const e of entries) {
      if (!(e.meters > 0) || !(e.seconds > 0)) continue;
      cm += e.meters;
      cs += e.seconds;
      pace.push({ m: cm, s: r1(cs / (cm / 500)) });
    }
  }

  const timeBest = (dist: 5000 | 10000): RowerBest => {
    const key: PosterRecordKey = dist === 5000 ? "fastest5000" : "fastest10000";
    const r = b.fastest[dist][0];
    const label = recordDef(String(dist))?.title ?? `Fastest ${dist / 1000}k`;
    if (!r)
      return {
        key,
        label,
        value: { text: "—" },
        sub: "not yet rowed",
        place: null,
      };
    // The prorated note stops naming the piece while masked: "pace from a
    // 12,345 m row" is a row's meters by another route.
    const sub =
      r.prorated && r.meters
        ? `${fmtDay(r.day)} · pace from a ${masked ? "longer" : fmtMeters(r.meters)} row`
        : `${fmtDay(r.day)} · ${fmtSplit(dist, r.value)} /500m`;
    return {
      key,
      label,
      value: { text: fmtRecordTime(r.value) },
      sub,
      place: placeOf(key),
    };
  };
  const metersBest = (key: "longest" | "bigday", r: RecordRow | undefined): RowerBest => {
    const label = recordDef(key)?.title ?? (key === "longest" ? "Longest row" : "Biggest day");
    if (!r)
      return {
        key,
        label,
        value: { text: "—" },
        sub: "not yet rowed",
        place: null,
      };
    const n = key === "bigday" ? (rowsOn.get(r.day) ?? 0) : 0;
    const sub = key === "bigday" ? `${fmtDay(r.day)} · ${n === 1 ? "one row" : `${n} rows`}` : fmtDay(r.day);
    return {
      key,
      label,
      value: metersFigure(r.value, masked),
      sub,
      place: placeOf(key),
    };
  };
  const bests: RowerBest[] = [
    timeBest(5000),
    timeBest(10000),
    metersBest("longest", b.longest[0]),
    metersBest("bigday", b.bigDay[0]),
  ];

  /* EVERY logged row, oldest first. While masked: meters a shape, time a
   * clock shape, and the SPLIT column removed (null) — "a time over a known
   * distance is the meters by another route". An untimed row has no time
   * to hide and prints a dash either way. */
  const log: RowerLogRow[] = entries.map((e) => ({
    day: fmtDay(e.day),
    title: e.title,
    meters: metersFigure(e.meters, masked),
    time:
      e.seconds > 0
        ? masked
          ? { shape: clockShape(e.seconds) }
          : { text: fmtDuration(e.seconds) }
        : { text: "—" },
    split: masked || !(e.seconds > 0) || !(e.meters > 0) ? null : fmtSplit(e.meters, e.seconds),
  }));

  const communityMeters = pub?.community.meters ?? 0;
  const communityRowers = pub ? onBoard(pub).length : 0;

  const board = division === "M" ? " · MEN’S BOARD" : division === "F" ? " · WOMEN’S BOARD" : "";
  const dateline = `ROWTEMBER ${asOf.year}${board}${club ? " · 100K CLUB" : ""} · ${asOf.stamp}`;

  return {
    kind: "rower",
    year: asOf.year,
    asOf: {
      day: asOf.day,
      iso: asOf.iso,
      dayNumber: asOf.dayNumber,
      final: asOf.final,
      year: asOf.year,
      dateline,
    },
    blackout: posterBlackout(input.blackout),
    rower: {
      rowerNumber: p.rowerNumber,
      name: p.displayName,
      instagram: p.instagram || null,
      division,
    },
    masked,
    club,
    totals: {
      meters: masked
        ? { shape: shapeOf(me.meters.toLocaleString("en-US")) }
        : { text: me.meters.toLocaleString("en-US") },
      seconds: masked ? null : seconds,
      // No timed row → no hours line at all (a "0.0 h" is not a figure the
      // headline should carry; it prints the sessions instead).
      hours: masked || seconds <= 0 ? null : `${(seconds / 3600).toFixed(1)} h`,
      sessions: entries.length,
      daysRowed: new Set(entries.map((e) => e.day)).size,
      longest: b.longest[0] ? metersFigure(b.longest[0].value, masked) : null,
      bigDay: b.bigDay[0] ? metersFigure(b.bigDay[0].value, masked) : null,
      paceTag: timed ? fmtPaceTag(me.meters, seconds) : null,
      avgSplit: masked || !timed ? null : `${fmtSplit(me.meters, seconds)} /500m`,
      metersADay: masked ? null : Math.round(me.meters / Math.max(1, asOf.dayNumber)),
    },
    rank,
    month: { rowed, meters: masked ? null : dayMeters },
    pace,
    bests,
    log,
    community: {
      meters: communityMeters,
      rowers: communityRowers,
      share: masked || communityMeters <= 0 ? null : r4(me.meters / communityMeters),
    },
    partner: GRIZZLY_PARTNER,
    url: rowerUrl(p.rowerNumber),
  };
}
