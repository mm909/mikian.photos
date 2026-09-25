import { db } from "@/lib/db";
import { digitCount } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  MONTH,
  START_MS,
  computeDaily,
  computeWeekly,
  daysElapsed,
  nowMs as clockNow,
  pacificDay,
  type Boards,
  type Week,
  type WeeklyRow,
} from "@/lib/row100k";
import { maskedIds, viewOpts, type Viewer } from "@/lib/row100kViewer";
import { FIRST_MONTH_KEY, nextMonth, periodOptions, prevMonth, weeksOf, type Month, type Period } from "@/lib/rowPeriod";
import type { BoardsProp } from "../Boards";
import { boardView, EMPTY_BOARDS } from "../boardData";
import type { MonthStep, PeriodRow, PeriodTotal } from "../Stats";
import { liteRecords, type RecordsProp } from "./defs";

/* EVERYTHING THE RECORDS PAGE PRINTS FOR ONE PERIOD, as one plain object
 * (owner, 2026-09-25: "why is there a loading page between each click
 * (category, bracket, month)? There shouldn't be"). The page renders it
 * once on the server for the period in the URL; the month word then asks
 * GET /api/row100k/records?m= for another one and the client shell
 * (RecordsShell.tsx) swaps it in place. Both go through here, so a month
 * fetched in place is masked for the viewer exactly as the one the page
 * loaded with — the same boardView, the same hidden set, the same blanking
 * of every row shape that reaches the browser. The stats page's
 * statsData.ts is the model.
 *
 * All five records ride along, and the bracket (All / Men's / Women's) is
 * a filter the shell applies: picking a category or a bracket never asks
 * the server. Three shapes travel:
 *   - `board.total` is the standings as boardView masked them for THIS
 *     viewer — the elite in blocks, the run-up rounded, the viewer's own
 *     row and an admin's view exempt — with the tiers, arrows and progress
 *     bars the board draws (Boards.tsx). Only the slices Boards reads: the
 *     record boards still hold every elite rower's real seconds and meters
 *     on the server and never leave it (review, 2026-09-05).
 *   - `records` is the five flat rankings (records/defs.ts liteRecords): a
 *     hidden rower's METERS records zeroed with only a digit count, their
 *     TIMES kept (owner, 2026-09-08: fastest 5k and 10k show regardless of
 *     the blackout).
 *   - `month` is the two period boards (owner, 2026-09-25: "add METERS BY
 *     DAY and METERS BY WEEK to the category menu"): every day and every
 *     week of the period's month, each a full ranking, masked the way the
 *     stats page masks its own (statsData.ts) — a hidden rower loses their
 *     meters and keeps a digit count, the elite carry their pace tag. They
 *     travel with the month so a day picked swaps in place; ALL TIME has no
 *     month to cut and carries null.
 * JSON throughout — no Date, no Map, no function — since it crosses the
 * wire twice. No sticker and no stats link since 2026-09-25 (owner:
 * "remove the stats link at the bottom of the board, and remove SHARE THE
 * BOARD"). */

export type RecordsMonth = {
  key: string;
  label: string;
  firstDow: number;
  days: number;
  /* True while this is the month the clock is in: today is in it. */
  live: boolean;
  weeks: Week[];
  /* One board per day of the month, index = day-of-month − 1; one per
   * week, filed by `weeks`. */
  daily: PeriodRow[][];
  weekly: PeriodRow[][];
  /* One total per day / per week, same indexes — everyone in it, hidden
   * rowers counted (summed off the raw entries, never off the rows). */
  dayTotals: PeriodTotal[];
  weekTotals: PeriodTotal[];
  /* Index of the last day that has happened (today, clamped; a past
   * month's last day) — the day board opens here. */
  todayDay: number;
  /* Index of the week containing today, clamped into the month — the week
   * board opens here (a past month's last week). */
  defaultWeek: number;
  /* The month before this one and the month after, when there is one, for
   * the calendar's arrows. */
  prev?: MonthStep;
  next?: MonthStep;
};

export type RecordsPayload = {
  period: { key: string; kind: "month" | "all"; label: string };
  /* True while the period is the month the clock is in. */
  thisMonth: boolean;
  /* Every month so far and all time, for the month word. */
  periods: { key: string; label: string }[];
  currentMonthKey: string;
  started: boolean;
  /* The viewer's own participant id, resolved by the caller, or null. */
  meId: string | null;
  blackout: { active: boolean; endsAt?: string };
  /* Whether this viewer has rows hidden from them — the bo-note line. */
  anyHidden: boolean;
  /* The board could not be read: the rankings are empty for that reason. */
  unavailable: boolean;
  /* The five flat rankings, masked (records/defs.ts). */
  records: RecordsProp;
  /* The standings and the community strip, masked, for Boards.tsx. */
  board: BoardsProp;
  /* Up/down arrows: this month or all time. A finished month draws none —
   * there is no last logged day it moved since. */
  movement: boolean;
  /* The day and week boards of the period's month; null for all time. */
  month: RecordsMonth | null;
};

const stepOf = (m: { key: string; label: string } | null): MonthStep | undefined =>
  m ? { key: m.key, label: m.label } : undefined;

export async function buildRecordsPayload(viewer: Viewer, period: Period): Promise<RecordsPayload> {
  const now = clockNow();
  const thisMonth = period.kind === "month" && period.key === MONTH.key;

  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  let unavailable = false;
  try {
    const view = await boardView({ ...viewOpts(viewer), period });
    boards = view.boards;
    blackout = { active: view.blackout.active, ...(view.blackout.endsAt ? { endsAt: view.blackout.endsAt } : {}) };
  } catch (err) {
    console.error("row100k/records: failed to load board data", err);
    unavailable = true;
  }

  // The one masked set (row100kViewer.maskedIds) — self and admins exempt.
  const hidden = maskedIds(boards);
  const records = liteRecords(boards, hidden);
  const started = now >= START_MS;

  /* THE PERIOD BOARDS of the month (owner, 2026-09-25). Read off the raw
   * entries the way the stats page does (statsData.ts), masked with the
   * hidden set the board just gave — this page never decides who is elite
   * on its own. With the board unreadable the hidden set is empty while a
   * window may well be open, so the boards are not built at all: nothing
   * that cannot be masked reaches the browser. */
  const month = period.kind === "month" && !unavailable ? await buildMonth(period, boards, hidden, now) : null;

  return {
    period: { key: period.key, kind: period.kind, label: period.label },
    thisMonth,
    periods: periodOptions(now),
    currentMonthKey: MONTH.key,
    started,
    meId: viewer.myParticipantId,
    blackout,
    anyHidden: hidden.size > 0,
    unavailable,
    records,
    board: { total: boards.total, community: boards.community },
    movement: thisMonth || period.kind === "all",
    month,
  };
}

async function buildMonth(pm: Month, boards: Boards, hidden: Set<string>, now: number): Promise<RecordsMonth | null> {
  const live = pm.key === MONTH.key;
  const weeks = weeksOf(pm);
  const weekIdx = (day: string) => weeks.findIndex((w) => day >= w.first && day <= w.last);

  let weekly: WeeklyRow[][];
  let daily: WeeklyRow[][];
  const emptyTotals = (n: number): PeriodTotal[] => Array.from({ length: n }, () => ({ meters: 0, sessions: 0, rowers: 0 }));
  const dayTotals = emptyTotals(pm.days);
  const weekTotals = emptyTotals(weeks.length);
  try {
    const [participants, entries] = await Promise.all([
      db.rowParticipant.findMany({
        where: { challenge: CHALLENGE },
        select: { id: true, displayName: true, instagram: true, division: true, rowerNumber: true },
        orderBy: { rowerNumber: "asc" },
      }),
      db.rowEntry.findMany({
        where: { challenge: CHALLENGE, day: { gte: pm.firstDay, lte: pm.lastDay } },
        select: { participantId: true, day: true, meters: true },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    weekly = computeWeekly(participants, entries, weeks);
    daily = computeDaily(participants, entries, pm);
    /* The ledger totals under each board: the same buckets computeDaily /
     * computeWeekly file a row into, hidden rowers counted (their meters
     * belong to every aggregate; the rows sent carry 0 for them). */
    const known = new Set(participants.map((p) => p.id));
    const dayWho = dayTotals.map(() => new Set<string>());
    const weekWho = weeks.map(() => new Set<string>());
    for (const e of entries) {
      if (!known.has(e.participantId)) continue;
      const di = Number(e.day.slice(8, 10)) - 1;
      if (di >= 0 && di < dayTotals.length) {
        dayTotals[di].meters += e.meters;
        dayTotals[di].sessions += 1;
        dayWho[di].add(e.participantId);
      }
      const wi = weekIdx(e.day);
      if (wi >= 0) {
        weekTotals[wi].meters += e.meters;
        weekTotals[wi].sessions += 1;
        weekWho[wi].add(e.participantId);
      }
    }
    dayTotals.forEach((t, i) => {
      t.rowers = dayWho[i].size;
    });
    weekTotals.forEach((t, i) => {
      t.rowers = weekWho[i].size;
    });
  } catch (err) {
    console.error("row100k/records: failed to load the period boards", err);
    return null;
  }

  /* Everyone the board lists without a place — the hidden set plus the
   * viewer's own row when they are elite themself — with the average split
   * each wears there, so the period boards lift the same rowers into the
   * same block in the same order (owner, 2026-09-08). The mask itself is
   * the stats page's (statsData.ts): a hidden row loses its meters and
   * keeps a digit count; no instagram handle travels (never printed). */
  const eliteTag = new Map<string, string | undefined>();
  for (const r of boards.total) if (r.unranked) eliteTag.set(r.participantId, r.paceTag);
  const masking = hidden.size > 0 || eliteTag.size > 0;
  const lite = (r: WeeklyRow): PeriodRow => {
    const { instagram: _ig, ...rest } = r;
    if (!masking) return rest;
    const elite = eliteTag.has(r.participantId);
    const paceTag = eliteTag.get(r.participantId);
    const tag = !elite ? {} : paceTag ? { unranked: true as const, paceTag } : { unranked: true as const };
    if (hidden.has(r.participantId)) return { ...rest, meters: 0, masked: true, digits: digitCount(r.meters), ...tag };
    if (elite) return { ...rest, ...tag };
    return rest;
  };

  /* Where the boards open: today and this week on the live month, the last
   * day and the last week of a finished one (owner, 2026-09-25). */
  const today = pacificDay(now);
  const wi = live ? weekIdx(today) : -1;
  const defaultWeek = live ? (wi >= 0 ? wi : today < pm.firstDay ? 0 : weeks.length - 1) : weeks.length - 1;
  const dayCount = live ? daysElapsed(now) : pm.days;
  const todayDay = Math.max(0, Math.min(pm.days, dayCount) - 1);

  const prevM = pm.key > FIRST_MONTH_KEY ? prevMonth(pm) : null;
  const nextM = pm.key < MONTH.key ? nextMonth(pm) : null;

  return {
    key: pm.key,
    label: pm.label,
    firstDow: pm.firstDow,
    days: pm.days,
    live,
    weeks,
    daily: daily.map((rows) => rows.map(lite)),
    weekly: weekly.map((rows) => rows.map(lite)),
    dayTotals,
    weekTotals,
    todayDay,
    defaultWeek,
    prev: stepOf(prevM),
    next: stepOf(nextM),
  };
}
