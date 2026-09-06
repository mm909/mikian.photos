import type { Metadata } from "next";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { digitCount } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  END_MS,
  FIRST_DAY,
  LAST_DAY,
  LOG_CLOSE_MS,
  START_MS,
  WEEKS,
  computeDaily,
  computeWeekly,
  daysElapsed,
  nowMs as clockNow,
  pacificDay,
  weekIndexOf,
  type WeeklyRow,
} from "@/lib/row100k";
import { barProps, maskedIds, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { HourGrid } from "../HourGrid";
import { MonthSection } from "../MonthSection";
import { StatsShare } from "../StatsShare";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { StatsBoards, StatsRecords } from "../Stats";
import { boardView, EMPTY_BOARDS } from "../boardData";
import { liteRecords, type RecordsProp } from "../records/defs";
import { buildField, type FieldEntry, type FieldModel, type FieldYou } from "./field";
import { FieldSection } from "./FieldSection";

export const metadata: Metadata = {
  title: "The stats — 100K September",
  description:
    "The records, meters by day and by week, the community calendar, the hours and the field for the Rowtember challenge.",
};

export const dynamic = "force-dynamic";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/* THE STATS (owner review, 2026-09-05, second look): the nameplate, then
 * the records straight under it — no section head of their own, the
 * owner found two titles in a row spent the screen on headers — then
 * meters by day or by week (the period IS that section's title, so the
 * head lives inside the client component that knows which is picked),
 * the month calendar, the hours grid and the field — every row's length
 * and pace as two densities. The cumulative and daily charts, the turnout
 * chart and the split-vs-distance scatter are the numbers page's. */
export default async function StatsPage() {
  /* Who is looking decides what the boards may print: the period boards
   * pull the signed-in rower into view below the top 10, and during a
   * blackout the elite fifteen are hidden from everyone but admins and the
   * rower themself (boardView, blackoutRules.ts). Cosmetic on failure —
   * the anonymous view renders. */
  const viewer = await resolveViewer();

  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  /* Set only when the board cannot be read while a window is open. The
   * period boards and the field come off their own query below, which may
   * well succeed on its own — and without the board this page cannot tell
   * who is elite, so it blanks every row but the viewer's own: the same
   * fail-closed line the profile and the feed hold, rather than being the
   * one surface that ships an elite week in the clear. */
  let hideAll = false;
  /* The records come off the board, so when it cannot be read they are
   * empty for a reason the section should say, not the pre-start hint. */
  let boardUnreadable = false;
  try {
    const view = await boardView(viewOpts(viewer));
    boards = view.boards;
    blackout = view.blackout;
  } catch (err) {
    console.error("row100k/stats: failed to load board data", err);
    boardUnreadable = true;
    blackout = await activeBlackout();
    hideAll = blackout.active && !viewer.isAdmin;
    if (hideAll) {
      console.warn("row100k/stats: board unreadable during a blackout window — blanking every row but the viewer's own");
    }
  }

  /* THE masked set for this viewer — the fifteen the board hid, read off
   * boardView (row100kViewer.maskedIds) so this page never decides who is
   * elite on its own. The records section and the period boards are client
   * components, so every row shape that reaches them is blanked HERE, not
   * there: liteRecords zeroes a hidden rower's record and keeps only its
   * shape (owner rule, 2026-09-05 — a time over a known distance is the
   * meters by another route), and the period rows below lose their meters
   * and keep a digit count. Total rows arrive masked from boardView already. */
  const hidden = maskedIds(boards);
  const isHidden = (participantId: string) =>
    hidden.has(participantId) || (hideAll && participantId !== viewer.myParticipantId);
  const records: RecordsProp = liteRecords(boards, hidden);

  /* The period boards, the hour grid and the field need per-entry data
   * that boardData() doesn't carry, so this page pulls the raw rows itself
   * (same selects as boardData, plus createdAt for the hours). */
  let weekly: WeeklyRow[][] = WEEKS.map(() => []);
  let daily: WeeklyRow[][] = Array.from({ length: 30 }, () => []);
  let gridEntries: { meters: number; createdAt: Date }[] = [];
  let fieldEntries: FieldEntry[] = [];
  try {
    const [participants, entries] = await Promise.all([
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
    weekly = computeWeekly(participants, entries);
    daily = computeDaily(participants, entries);
    gridEntries = entries;
    /* Only a known participant's rows reach the field, the way computeBoards
     * drops orphans — and nothing but the three numbers it needs. */
    const known = new Set(participants.map((p) => p.id));
    fieldEntries = entries
      .filter((e) => known.has(e.participantId))
      .map((e) => ({ participantId: e.participantId, meters: e.meters, seconds: e.seconds }));
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

  /* The field: aggregates over everyone, individual marks without the
   * hidden rowers, the viewer's own overlay from their own rows (field.ts).
   * The maths is the one step that could throw on a shape of data nobody
   * foresaw; the section then says nothing rather than the page failing. */
  let field: FieldModel | null = null;
  let fieldYou: FieldYou | null = null;
  try {
    const f = buildField(fieldEntries, { isHidden, meId });
    field = f.field;
    fieldYou = f.you;
  } catch (err) {
    console.error("row100k/stats: field maths failed", err);
  }

  const now = clockNow();
  const started = now >= START_MS;

  /* Default to the week containing today, clamped to the challenge:
   * before September shows Week 1, after it shows the finish. */
  // Pacific, like the dateline and the hour grid — a UTC date here put an
  // empty "tomorrow" board under a Sep 5 dateline every evening.
  const today = pacificDay(now);
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

  /* The hour grid reads createdAt — when a row was LOGGED, not rowed —
   * shifted to US-west wall clock per the repo convention (minus 7h Pacific shift).
   * Late logs landing outside September are skipped, and the grid only
   * runs through today (US-west), clamped to the last day. */
  const SHIFT_MS = 7 * 3600_000;
  /* Days of September that have actually happened — every chart on this page
   * stops here rather than reserving space for the rest of the month. */
  const gridDayCount = daysElapsed(now);
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
    // Sessions, not meters: the section is WHEN rows get logged, and a
    // meters sum handed to client components would equal one rower's
    // session whenever they row an hour alone — a blackout leak (review,
    // 2026-09-05). The post pack counts the same way.
    hourGrid[di][shifted.getUTCHours()] += 1;
  }

  /* The dateline under the nameplate — the same line the front page
   * prints: today in the rowers' day (Pacific, the UTC-7 shift every chart
   * uses) and where the month stands. */
  const phase: "before" | "open" | "closed" =
    now < START_MS ? "before" : now >= LOG_CLOSE_MS ? "closed" : "open";
  const west = new Date(now - SHIFT_MS);
  const stamp = `${MONTHS[west.getUTCMonth()]} ${west.getUTCDate()}`;
  const dateline =
    phase === "before"
      ? `${stamp} · FIRST STROKE SEP 1`
      : phase === "closed"
        ? `${stamp} · FINAL`
        : now >= END_MS
          ? `${stamp} · LATE LOGS THROUGH OCT 3`
          : `${stamp} · DAY ${gridDayCount} OF 30`;

  const community = {
    meters: boards.community.meters,
    rowers: boards.community.people,
    sessions: boards.community.sessions,
  };

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar active="stats" {...barProps(viewer)} />

      {/* The nameplate, the front page's (owner call, 2026-09-05: THE STATS,
       * not the records — the big newspaper head with the dateline). */}
      <header className="front-head">
        <div className="wrap">
          <h1>The stats</h1>
          <p className="front-date mono">{dateline}</p>
        </div>
      </header>

      {/* The records run straight off the nameplate: the record's number
          one as the first thing on the page, the podiums, then the small
          record submenu (owner call, 2026-09-05 — the leaders and their
          values carry the emphasis, not the controls). */}
      <section>
        <div className="wrap">
          {/* anyHidden covers the fail-closed path too: with the board
              unreadable the masked set is empty, yet every row but the
              viewer's own is blanked, and the note must say so. */}
          <StatsRecords
            records={records}
            started={started}
            meId={meId}
            anyHidden={hidden.size > 0 || hideAll}
            unavailable={boardUnreadable}
            blackout={blackout}
          />
        </div>
      </section>

      {/* Meters by day / by week — the section head is the period itself,
          so StatsBoards prints it (the board already answers to THE BOARD;
          owner call, 2026-09-05). */}
      <section>
        <div className="wrap">
          <StatsBoards
            weekly={weekly}
            daily={daily}
            defaultWeek={defaultWeek}
            defaultDay={defaultDay}
            started={started}
            meId={meId}
            maskedIds={[...hidden]}
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
            community={community}
            hourGrid={hourGrid}
            days={gridDayCount}
          />
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
              ...community,
              byDay: communityByDay,
              daily: boards.daily,
              hourGrid,
            }}
            prefer="rowtember-community-hours"
          />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The field</h2>
            {/* The rower count rides here, not on a tile: a tile is one
                number and its own descriptor. */}
            <span className="mono">
              EVERY ROW · LENGTH AND PACE{field && field.rowers > 0 ? ` · ${field.rowers} ROWERS` : ""}
            </span>
          </div>
          <FieldSection field={field} you={fieldYou} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
