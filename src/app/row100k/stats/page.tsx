import type { Metadata } from "next";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { clockShape, digitCount } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  FIRST_DAY,
  LAST_DAY,
  START_MS,
  WEEKS,
  computeDaily,
  computeWeekly,
  daysElapsed,
  nowMs as clockNow,
  weekIndexOf,
  type RecordRow,
  type WeeklyRow,
} from "@/lib/row100k";
import { barProps, maskedIds, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { HourGrid } from "../HourGrid";
import { MonthSection } from "../MonthSection";
import { StatsShare } from "../StatsShare";
import { RowBar } from "../RowBar";
import { TurnoutChart } from "../TurnoutChart";
import { RowFooter } from "../RowFooter";
import { StatsBoards } from "../Stats";
import { boardView, EMPTY_BOARDS } from "../boardData";

export const metadata: Metadata = {
  title: "The stats — 100K September",
  description: "Records, the weekly boards, the community calendar and the curve for the Rowtember challenge.",
};

export const dynamic = "force-dynamic";

/* The deep end: the five record podiums (each linking to its full ranking
 * under /row100k/records), the week-by-week boards, the community's
 * September as a calendar, and the curve. The main page keeps only the
 * standings; this is where the rest lives. */
export default async function StatsPage() {
  /* Who is looking decides what the boards may print: the weekly boards
   * pull the signed-in rower into view below the top 10, and during a
   * blackout the elite fifteen are hidden from everyone but admins and the
   * rower themself (boardView, blackoutRules.ts). Cosmetic on failure —
   * the anonymous view renders. */
  const viewer = await resolveViewer();

  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  /* Set only when the board cannot be read while a window is open. The
   * weekly and daily boards come off their own query below, which may well
   * succeed on its own — and without the board this page cannot tell who
   * is elite, so it blanks every row but the viewer's own: the same
   * fail-closed line the profile and the feed hold, rather than being the
   * one surface that ships an elite week in the clear. */
  let hideAll = false;
  try {
    const view = await boardView(viewOpts(viewer));
    boards = view.boards;
    blackout = view.blackout;
  } catch (err) {
    console.error("row100k/stats: failed to load board data", err);
    blackout = await activeBlackout();
    hideAll = blackout.active && !viewer.isAdmin;
    if (hideAll) {
      console.warn("row100k/stats: board unreadable during a blackout window — blanking every row but the viewer's own");
    }
  }

  /* THE masked set for this viewer — the fifteen the board hid, read off
   * boardView (row100kViewer.maskedIds) so this page never decides who is
   * elite on its own. StatsBoards is a client component, so every row
   * shape that reaches it is blanked HERE, not there: the two meters
   * records lose their value and keep a digit count, the pace records lose
   * their time (owner rule, 2026-09-05 — a time over a known distance is
   * the meters by another route) and keep only its silhouette, plus they
   * drop the length of the piece; further down the weekly and daily boards
   * lose their meters. So the blocks are the width the number would have
   * been and nothing more. Total rows arrive masked from boardView already. */
  const hidden = maskedIds(boards);
  const isHidden = (participantId: string) =>
    hidden.has(participantId) || (hideAll && participantId !== viewer.myParticipantId);
  const blankRecord = (r: RecordRow): RecordRow & { masked?: boolean; digits?: number } =>
    hidden.has(r.participantId) ? { ...r, value: 0, masked: true, digits: digitCount(r.value) } : r;
  const blankPace = (r: RecordRow): RecordRow & { masked?: boolean; shape?: string } =>
    hidden.has(r.participantId)
      ? { ...r, value: 0, meters: undefined, masked: true, shape: clockShape(r.value, true) }
      : r;
  if (hidden.size > 0) {
    boards = {
      ...boards,
      longest: boards.longest.map(blankRecord),
      bigDay: boards.bigDay.map(blankRecord),
      fastest: {
        5000: boards.fastest[5000].map(blankPace),
        10000: boards.fastest[10000].map(blankPace),
      },
    };
  }

  /* The weekly boards need per-entry data that boardData() doesn't carry,
   * so this page pulls the raw rows itself (same selects as boardData). */
  let weekly: WeeklyRow[][] = WEEKS.map(() => []);
  let daily: WeeklyRow[][] = Array.from({ length: 30 }, () => []);
  let gridEntries: { meters: number; createdAt: Date }[] = [];
  try {
    const [participants, entries] = await Promise.all([
      db.rowParticipant.findMany({
        where: { challenge: CHALLENGE },
        select: { id: true, displayName: true, instagram: true, division: true, rowerNumber: true },
        orderBy: { rowerNumber: "asc" },
      }),
      db.rowEntry.findMany({
        where: { challenge: CHALLENGE },
        select: { participantId: true, day: true, meters: true, createdAt: true },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    weekly = computeWeekly(participants, entries);
    daily = computeDaily(participants, entries);
    gridEntries = entries;
  } catch (err) {
    console.error("row100k/stats: failed to load weekly data", err);
  }
  if (hidden.size > 0 || hideAll) {
    const blankWeek = (r: WeeklyRow): WeeklyRow & { masked?: boolean; digits?: number } =>
      isHidden(r.participantId) ? { ...r, meters: 0, masked: true, digits: digitCount(r.meters) } : r;
    weekly = weekly.map((rows) => rows.map(blankWeek));
    daily = daily.map((rows) => rows.map(blankWeek));
  }

  const meId = viewer.myParticipantId;

  const started = clockNow() >= START_MS;

  /* Default to the week containing today, clamped to the challenge:
   * before September shows Week 1, after it shows the finish. */
  const today = new Date(clockNow()).toISOString().slice(0, 10);
  const wi = weekIndexOf(today);
  const defaultWeek = wi >= 0 ? wi : today < FIRST_DAY ? 0 : WEEKS.length - 1;

  /* The daily board defaults to today, clamped into September. */
  const defaultDay =
    today < FIRST_DAY
      ? 0
      : today.slice(0, 7) === FIRST_DAY.slice(0, 7)
        ? Number(today.slice(8, 10)) - 1
        : 29;

  // The curve carries cumulative meters; the calendar wants per-day totals.
  const communityByDay: Record<string, number> = {};
  let prev = 0;
  for (const d of boards.daily) {
    communityByDay[d.day] = d.cum - prev;
    prev = d.cum;
  }
  const biggest = Math.max(0, ...Object.values(communityByDay));
  const thresholds: [number, number, number] =
    biggest > 0
      ? [Math.round(biggest * 0.25), Math.round(biggest * 0.5), Math.round(biggest * 0.75)]
      : [2500, 5000, 10000];

  // Turnout: unique rowers with at least one logged row, per September day.
  const uniqueByDay = daily.map((rows) => rows.length);

  /* The hour grid reads createdAt — when a row was LOGGED, not rowed —
   * shifted to US-west wall clock per the repo convention (minus 7h Pacific shift).
   * Late logs landing outside September are skipped, and the grid only
   * runs through today (US-west), clamped to the last day. */
  const SHIFT_MS = 7 * 3600_000;
  /* Days of September that have actually happened — every chart on this page
   * stops here rather than reserving space for the rest of the month. */
  const gridDayCount = daysElapsed();
  const hourGrid: number[][] = Array.from(
    { length: gridDayCount },
    () => Array(24).fill(0) as number[],
  );
  for (const e of gridEntries) {
    const shifted = new Date(e.createdAt.getTime() - SHIFT_MS);
    const day = shifted.toISOString().slice(0, 10);
    if (day < FIRST_DAY || day > LAST_DAY) continue;
    const di = Number(day.slice(8, 10)) - 1;
    if (di >= gridDayCount) continue;
    hourGrid[di][shifted.getUTCHours()] += e.meters;
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar active="stats" {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The records</h2>
          </div>
          <StatsBoards
            boards={boards}
            weekly={weekly}
            daily={daily}
            defaultWeek={defaultWeek}
            defaultDay={defaultDay}
            started={started}
            meId={meId}
            maskedIds={[...hidden]}
            blackout={blackout}
          />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The month</h2>
            <span className="mono">EVERYONE&rsquo;S METERS, PER DAY</span>
          </div>
          <MonthSection
            byDay={communityByDay}
            thresholds={thresholds}
            daily={boards.daily}
            community={{
              meters: boards.community.meters,
              rowers: boards.community.people,
              sessions: boards.community.sessions,
            }}
            hourGrid={hourGrid}
            days={gridDayCount}
          />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The turnout</h2>
            <span className="mono">ROWERS LOGGING, PER DAY</span>
          </div>
          <TurnoutChart counts={uniqueByDay} days={gridDayCount} />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The hours</h2>
            <span className="mono">WHEN ROWS GET LOGGED</span>
          </div>
          <HourGrid grid={hourGrid} />
          <StatsShare
            community={{
              meters: boards.community.meters,
              rowers: boards.community.people,
              sessions: boards.community.sessions,
              byDay: communityByDay,
              daily: boards.daily,
              hourGrid,
            }}
            prefer="rowtember-community-hours"
          />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
