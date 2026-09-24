import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { PACIFIC_SHIFT_MS, digitCount } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  START_MS,
  computeDaily,
  computeWeekly,
  daysElapsed,
  nowMs as clockNow,
  pacificDay,
  type Week,
  type WeeklyRow,
  MONTH,
} from "@/lib/row100k";
import { maskedIds, previewBlackout, viewOpts, type Viewer } from "@/lib/row100kViewer";
import { FIRST_MONTH_KEY, inPeriod, nextMonth, periodOptions, prevMonth, weeksOf, type Period } from "@/lib/rowPeriod";
import type { HourChart } from "../analysis/model";
import { boardView, EMPTY_BOARDS } from "../boardData";
import { liteRecords, type RecordsProp } from "../records/defs";
import type { MonthStep, PeriodRow, PeriodTotal } from "../Stats";
import { buildField, buildHours, type FieldEntry, type FieldModel } from "./field";
import { buildDistanceKdes, type DistanceKde } from "./distances";
import { perfectAttendance } from "./PerfectAttendance";

/* EVERYTHING THE STATS PAGE PRINTS FOR ONE PERIOD, as one plain object
 * (owner, 2026-09-25: "every time I click fastest 5K / 10K / a month / a
 * day there's a loading page and my scroll resets … whatever we need to do
 * to swap the data without a loading bar, do it"). The page renders it
 * once on the server for the period in the URL; the month word then asks
 * GET /api/row100k/stats?m= for another one and the client shell swaps it
 * in place. Both go through here, so a month fetched in place is masked
 * for the viewer exactly as the one the page loaded with — the same
 * boardView, the same hidden set, the same blanking of every row shape
 * that reaches the browser.
 *
 * All five stat boards ride along: picking the stat never asks the server.
 * The week and day boards, the calendar, the hours and the field are the
 * period's own month (or this one, for all time). JSON throughout — no
 * Date, no Map, no function — since it crosses the wire twice. */

export type StatsPayload = {
  period: { key: string; kind: "month" | "all"; label: string };
  /* The month the day and week boards, the calendar and the hours count
   * in — the period's own, or this one for all time. */
  month: { key: string; label: string; short: string; firstDow: number; days: number };
  /* True while `month` is the month the clock is in: today is in it. */
  liveMonth: boolean;
  weeks: Week[];
  started: boolean;
  /* The viewer's own participant id, resolved by the caller, or null. */
  meId: string | null;
  /* Every month so far and all time, for the month word. */
  periods: { key: string; label: string }[];
  currentMonthKey: string;

  records: RecordsProp;
  anyHidden: boolean;
  /* The board could not be read: the records are empty for that reason. */
  unavailable: boolean;
  blackout: { active: boolean; endsAt?: string };

  weekly: PeriodRow[][];
  daily: PeriodRow[][];
  dayTotals: PeriodTotal[];
  weekTotals: PeriodTotal[];
  /* Index of the last day of `month` that has happened (today, clamped) —
   * the day board opens here and the calendar allows nothing past it. */
  todayDay: number;
  /* Index of the week containing today, clamped into the month. */
  defaultWeek: number;
  maskedIds: string[];
  prev?: MonthStep;
  next?: MonthStep;

  community: {
    meters: number;
    rowers: number;
    sessions: number;
    month: { key: string; firstDow: number; days: number } | null;
    days?: number;
  };
  communityByDay: Record<string, number>;
  curve: { day: string; cum: number }[];
  hourGrid: number[][];
  /* Days of `month` that have happened — every chart stops here. */
  gridDayCount: number;
  thresholds: [number, number, number];

  field: FieldModel | null;
  hours: HourChart | null;
  distances: DistanceKde[];
  attendance: { rows: WeeklyRow[]; note: string };
};

const stepOf = (m: { key: string; label: string } | null): MonthStep | undefined =>
  m ? { key: m.key, label: m.label } : undefined;

export async function buildStatsPayload(viewer: Viewer, period: Period): Promise<StatsPayload> {
  const now = clockNow();
  const pm = period.kind === "month" ? period : MONTH;
  const liveMonth = pm.key === MONTH.key;
  const weeks = weeksOf(pm);
  const weekIdx = (day: string) => weeks.findIndex((w) => day >= w.first && day <= w.last);

  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  /* Set only when the board cannot be read while a window is open. The
   * period boards and the field come off their own query below, which may
   * well succeed on its own — and without the board this page cannot tell
   * who is elite, so it blanks every row but the viewer's own: the same
   * fail-closed line the profile and the feed hold. */
  let hideAll = false;
  let boardUnreadable = false;
  try {
    const view = await boardView({ ...viewOpts(viewer), period });
    boards = view.boards;
    blackout = { active: view.blackout.active, ...(view.blackout.endsAt ? { endsAt: view.blackout.endsAt } : {}) };
  } catch (err) {
    console.error("row100k/stats: failed to load board data", err);
    boardUnreadable = true;
    const real = previewBlackout(viewer, await activeBlackout());
    blackout = { active: real.active, ...(real.endsAt ? { endsAt: real.endsAt } : {}) };
    hideAll = blackout.active && !(viewer.isAdmin && !viewer.preview);
    if (hideAll) {
      console.warn("row100k/stats: board unreadable during a blackout window — blanking every row but the viewer's own");
    }
  }

  /* THE masked set for this viewer — the elite the board hid, read off
   * boardView (row100kViewer.maskedIds) so this page never decides who is
   * elite on its own. Every row shape that reaches the browser is blanked
   * HERE: liteRecords zeroes a hidden rower's METERS records and keeps only
   * a digit count (their times are public — owner, 2026-09-08), and the
   * period rows below lose their meters and keep a digit count. */
  const hidden = maskedIds(boards);
  const isHidden = (participantId: string) =>
    hidden.has(participantId) || (hideAll && participantId !== viewer.myParticipantId);
  const records: RecordsProp = liteRecords(boards, hidden);

  /* Everyone the board lists without a place — the hidden set plus the
   * viewer's own row when they are elite themself — with the average split
   * each wears there, so the period boards can lift the same rowers into
   * the same block in the same order (owner, 2026-09-08). */
  const eliteTag = new Map<string, string | undefined>();
  for (const r of boards.total) if (r.unranked) eliteTag.set(r.participantId, r.paceTag);

  let weekly: WeeklyRow[][] = weeks.map(() => []);
  let daily: WeeklyRow[][] = Array.from({ length: pm.days }, () => []);
  let gridEntries: { meters: number; createdAt: Date }[] = [];
  let fieldEntries: FieldEntry[] = [];
  const loggedHours: number[] = [];
  const emptyTotals = (n: number): PeriodTotal[] =>
    Array.from({ length: n }, () => ({ meters: 0, sessions: 0, rowers: 0 }));
  const dayTotals: PeriodTotal[] = emptyTotals(pm.days);
  const weekTotals: PeriodTotal[] = emptyTotals(weeks.length);
  try {
    const [participants, entriesRaw] = await Promise.all([
      db.rowParticipant.findMany({
        where: { challenge: CHALLENGE },
        select: { id: true, displayName: true, instagram: true, division: true, rowerNumber: true },
        orderBy: { rowerNumber: "asc" },
      }),
      db.rowEntry.findMany({
        where: { challenge: CHALLENGE },
        select: { participantId: true, day: true, meters: true, seconds: true, createdAt: true },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    /* The period's rows for the records and the field; the month's rows
     * for the week and day boards, the hours and the calendar. */
    const entries = entriesRaw.filter((e) => inPeriod(e.day, period));
    const monthEntries = entriesRaw.filter((e) => e.day >= pm.firstDay && e.day <= pm.lastDay);
    weekly = computeWeekly(participants, monthEntries, weeks);
    daily = computeDaily(participants, monthEntries, pm);
    gridEntries = monthEntries;
    const known = new Set(participants.map((p) => p.id));
    fieldEntries = entries
      .filter((e) => known.has(e.participantId))
      .map((e) => ({ participantId: e.participantId, meters: e.meters, seconds: e.seconds }));
    for (const e of monthEntries) {
      if (!known.has(e.participantId)) continue;
      const west = new Date(e.createdAt.getTime() - PACIFIC_SHIFT_MS);
      const westDay = west.toISOString().slice(0, 10);
      if (westDay < pm.firstDay || westDay > pm.lastDay) continue;
      loggedHours.push(west.getUTCHours() + west.getUTCMinutes() / 60);
    }

    /* The ledger totals under each board: the same buckets computeDaily /
     * computeWeekly file a row into, hidden rowers counted (their meters
     * belong to every aggregate; the rows sent carry 0 for them). */
    const dayWho = Array.from({ length: dayTotals.length }, () => new Set<string>());
    const weekWho = weeks.map(() => new Set<string>());
    for (const e of monthEntries) {
      if (!known.has(e.participantId)) continue;
      if (e.day.slice(0, 7) === pm.key) {
        const di = Number(e.day.slice(8, 10)) - 1;
        if (di >= 0 && di < dayTotals.length) {
          dayTotals[di].meters += e.meters;
          dayTotals[di].sessions += 1;
          dayWho[di].add(e.participantId);
        }
      }
      const ewi = weekIdx(e.day);
      if (ewi >= 0) {
        weekTotals[ewi].meters += e.meters;
        weekTotals[ewi].sessions += 1;
        weekWho[ewi].add(e.participantId);
      }
    }
    dayTotals.forEach((t, i) => {
      t.rowers = dayWho[i].size;
    });
    weekTotals.forEach((t, i) => {
      t.rowers = weekWho[i].size;
    });
  } catch (err) {
    console.error("row100k/stats: failed to load weekly data", err);
  }

  /* What a period row carries to the browser: no instagram (never printed
   * there), and — while a window is open — the mask. A hidden row loses its
   * meters and keeps a digit count; every elite row carries `unranked` and
   * the pace tag so StatsBoards can draw the block. `unranked` only rides
   * on a rower the BOARD listed as elite: with the board unreadable
   * (hideAll) nobody is known to be, so the blanked rows carry blocks and
   * no place but no block is drawn over them. */
  const masking = hidden.size > 0 || hideAll || eliteTag.size > 0;
  const lite = (r: WeeklyRow): PeriodRow => {
    const { instagram: _ig, ...rest } = r;
    if (!masking) return rest;
    const elite = eliteTag.has(r.participantId);
    const paceTag = eliteTag.get(r.participantId);
    const tag = !elite ? {} : paceTag ? { unranked: true as const, paceTag } : { unranked: true as const };
    if (isHidden(r.participantId)) return { ...rest, meters: 0, masked: true, digits: digitCount(r.meters), ...tag };
    if (elite) return { ...rest, ...tag };
    return rest;
  };
  const weeklyOut = weekly.map((rows) => rows.map(lite));
  const dailyOut = daily.map((rows) => rows.map(lite));

  /* The field: aggregates over everyone, individual marks without the
   * hidden rowers (field.ts); no viewer overlay on this page (owner,
   * 2026-09-08). The 5k and 10k as distributions of time (2026-09-11). */
  let field: FieldModel | null = null;
  let hours: HourChart | null = null;
  let distances: DistanceKde[] = [];
  try {
    field = buildField(fieldEntries, { isHidden, meId: null }).field;
    hours = buildHours(loggedHours);
    distances = buildDistanceKdes(fieldEntries, null, isHidden);
  } catch (err) {
    console.error("row100k/stats: field maths failed", err);
  }

  const started = now >= START_MS;
  const today = pacificDay(now);
  const wi = liveMonth ? weekIdx(today) : -1;
  const defaultWeek = liveMonth ? (wi >= 0 ? wi : today < pm.firstDay ? 0 : weeks.length - 1) : weeks.length - 1;
  /* Days of the month that have happened. */
  const gridDayCount = liveMonth ? daysElapsed(now) : pm.days;
  const todayDay = Math.max(0, Math.min(pm.days, gridDayCount) - 1);

  // The curve carries cumulative meters; the calendar wants per-day totals.
  const communityByDay: Record<string, number> = {};
  let prevCum = 0;
  for (const d of boards.daily) {
    communityByDay[d.day] = d.cum - prevCum;
    prevCum = d.cum;
  }
  const biggest = Math.max(0, ...Object.values(communityByDay));
  const thresholds: [number, number, number] =
    biggest > 0
      ? [Math.round(biggest * 0.25), Math.round(biggest * 0.5), Math.round(biggest * 0.75)]
      : [2500, 5000, 10000];

  /* The hour grid reads createdAt — when a row was LOGGED — on the fixed
   * UTC-7 clock; sessions, not meters (a meters sum handed to the browser
   * would equal one rower's session whenever they row an hour alone — a
   * blackout leak, review 2026-09-05). */
  const hourGrid: number[][] = Array.from({ length: gridDayCount }, () => Array(24).fill(0) as number[]);
  for (const e of gridEntries) {
    const shifted = new Date(e.createdAt.getTime() - PACIFIC_SHIFT_MS);
    const day = shifted.toISOString().slice(0, 10);
    if (day < pm.firstDay || day > pm.lastDay) continue;
    const di = Number(day.slice(8, 10)) - 1;
    if (di >= gridDayCount) continue;
    hourGrid[di][shifted.getUTCHours()] += 1;
  }

  const prevM = pm.key > FIRST_MONTH_KEY ? prevMonth(pm) : null;
  const nextM = pm.key < MONTH.key ? nextMonth(pm) : null;

  const attendance = perfectAttendance(daily, now, { through: liveMonth ? undefined : pm.days, short: pm.short });

  return {
    period: { key: period.key, kind: period.kind, label: period.label },
    month: { key: pm.key, label: pm.label, short: pm.short, firstDow: pm.firstDow, days: pm.days },
    liveMonth,
    weeks,
    started,
    meId: viewer.myParticipantId,
    periods: periodOptions(now),
    currentMonthKey: MONTH.key,
    records,
    anyHidden: hidden.size > 0 || hideAll,
    unavailable: boardUnreadable,
    blackout,
    weekly: weeklyOut,
    daily: dailyOut,
    dayTotals,
    weekTotals,
    todayDay,
    defaultWeek,
    maskedIds: [...hidden],
    prev: stepOf(prevM),
    next: stepOf(nextM),
    community: {
      meters: boards.community.meters,
      rowers: boards.community.people,
      sessions: boards.community.sessions,
      /* WHICH MONTH the community cards draw (cards.ts ShareData.month): a
       * past month whole; this month stops at today; all time has no one
       * month, so the calendar and day cards stay out. */
      month: period.kind === "all" ? null : { key: pm.key, firstDow: pm.firstDow, days: pm.days },
      days: liveMonth || period.kind === "all" ? undefined : pm.days,
    },
    communityByDay,
    curve: boards.daily,
    hourGrid,
    gridDayCount,
    thresholds,
    field,
    hours,
    distances,
    attendance: { rows: attendance.rows, note: attendance.note },
  };
}
