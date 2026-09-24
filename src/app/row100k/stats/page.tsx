import type { Metadata } from "next";
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
  type WeeklyRow,
  MONTH,
} from "@/lib/row100k";
import { barProps, maskedIds, previewBlackout, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { FIRST_MONTH_KEY, inPeriod, monthsThrough, nextMonth, parsePeriod, periodOptions, prevMonth, weeksOf } from "@/lib/rowPeriod";
import { PeriodSelect } from "../PeriodSelect";
import { TextMenu } from "../TextMenu";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { headCss } from "../headCss";
import { HourGrid } from "../HourGrid";
import { MonthSection } from "../MonthSection";
import { PageHead } from "../PageHead";
import { StatsShare } from "../StatsShare";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { StatsBoards, StatsRecords, type MonthStep, type PeriodTotal } from "../Stats";
import { boardView, EMPTY_BOARDS } from "../boardData";
import { RECORD_DEFS, liteRecords, recordDef, type RecordKey, type RecordsProp } from "../records/defs";
import { buildField, buildHours, type FieldEntry, type FieldModel } from "./field";
import { buildDistanceKdes, type DistanceKde } from "./distances";
import { FieldSection } from "./FieldSection";
import { PerfectAttendance, perfectAttendance } from "./PerfectAttendance";
import { statsCss } from "./statsCss";

export const metadata: Metadata = {
  title: "The stats — Rowtember",
  description:
    "The month's meters, hours, rowers and sessions, the records, meters by day and by week, the calendar, the hours and the field.",
};

export const dynamic = "force-dynamic";

/* THE STATS (owner review, 2026-09-05, second look; the month pass,
 * 2026-09-24): the head — the month word, then the four headline numbers
 * in their order of importance, meters biggest, then hours, then rowers
 * and sessions — and one SHARE A CARD for every card on the page; then
 * the stat block, two words that are menus (the month and the stat) over
 * the leading value and the men's and women's top five; then meters by
 * day or by week (the period IS that section's title, so the head lives
 * inside the client component that knows which is picked), the month
 * calendar, the hours grid, the field — every row's length and pace as
 * densities — and perfect attendance last. The cumulative and daily
 * charts, the turnout chart and the split-vs-distance scatter are the
 * numbers page's. No sign-in gate here, ever: the anonymous view is the
 * page. */
export default async function StatsPage({
  searchParams,
}: {
  searchParams?: { m?: string | string[]; s?: string | string[]; day?: string | string[] };
}) {
  /* Who is looking decides what the boards may print: the period boards
   * pull the signed-in rower into view below the top 10, and during a
   * blackout the elite are hidden from everyone but admins and the rower
   * themself (boardView, blackoutRules.ts). Cosmetic on failure — the
   * anonymous view renders. */
  const viewer = await resolveViewer();

  /* WHICH MONTH (owner, 2026-09-24: the stats page takes the same month
   * word as the board). `pm` is the month the period boards, the hour
   * grid and the calendar count in — the period's own month, or this one
   * for all time, where a week or a day board has no meaning of its own. */
  const now0 = clockNow();
  const period = parsePeriod(searchParams?.m, now0);
  const months = monthsThrough(now0);
  const pm = period.kind === "month" ? period : MONTH;
  const thisMonth = period.kind === "month" && period.key === MONTH.key;
  const weeks = weeksOf(pm);
  const weekIdx = (day: string) => weeks.findIndex((w) => day >= w.first && day <= w.last);

  /* WHICH STAT (owner, 2026-09-24: a selector for the stat next to the
   * one for the period): ?s= is a record key from records/defs.ts, and
   * anything else is TOTAL METERS, the first word in the list. */
  const one = (q: string | string[] | undefined) => (Array.isArray(q) ? q[0] : q);
  const statKey: RecordKey = recordDef(one(searchParams?.s) ?? "")?.key ?? "total";

  /* WHICH DAY (?day=, 1-based): the day menu's lines are real addresses,
   * and the arrows past either end of a month land on the neighbour's
   * first or last day. Out of range clamps into the month; the board
   * then clamps again to the days that have happened. */
  const dayQ = Number(one(searchParams?.day));
  const dayPinned = Number.isFinite(dayQ) && dayQ >= 1;
  const pinnedDay = dayPinned ? Math.min(pm.days, Math.floor(dayQ)) - 1 : -1;

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
    const view = await boardView({ ...viewOpts(viewer), period });
    boards = view.boards;
    blackout = view.blackout;
  } catch (err) {
    console.error("row100k/stats: failed to load board data", err);
    boardUnreadable = true;
    blackout = previewBlackout(viewer, await activeBlackout());
    hideAll = blackout.active && !(viewer.isAdmin && !viewer.preview);
    if (hideAll) {
      console.warn("row100k/stats: board unreadable during a blackout window — blanking every row but the viewer's own");
    }
  }

  /* THE masked set for this viewer — the elite the board hid, read off
   * boardView (row100kViewer.maskedIds) so this page never decides who is
   * elite on its own. The records section and the period boards are client
   * components, so every row shape that reaches them is blanked HERE, not
   * there: liteRecords zeroes a hidden rower's METERS records and keeps
   * only a digit count (their times are public — owner, 2026-09-08), and
   * the period rows below lose their meters and keep a digit count. Total
   * rows arrive masked from boardView already. */
  const hidden = maskedIds(boards);
  const isHidden = (participantId: string) =>
    hidden.has(participantId) || (hideAll && participantId !== viewer.myParticipantId);
  const records: RecordsProp = liteRecords(boards, hidden);

  /* Everyone the board lists without a place — the hidden set plus the
   * viewer's own row when they are elite themself (exempt from the mask,
   * not from the block) — with the average split each wears there, so the
   * period boards can lift the same rowers into the same block in the same
   * order (owner, 2026-09-08). Empty while no window is open. */
  const eliteTag = new Map<string, string | undefined>();
  for (const r of boards.total) if (r.unranked) eliteTag.set(r.participantId, r.paceTag);

  /* The period boards, the hour grid and the field need per-entry data
   * that boardData() doesn't carry, so this page pulls the raw rows itself
   * (same selects as boardData, plus createdAt for the hours). */
  let weekly: WeeklyRow[][] = weeks.map(() => []);
  let daily: WeeklyRow[][] = Array.from({ length: pm.days }, () => []);
  let gridEntries: { meters: number; createdAt: Date }[] = [];
  let fieldEntries: FieldEntry[] = [];
  /* Hour of the day each known rower's row was logged, on the challenge's
   * fixed UTC-7 clock, fractional — the field's hour chart (field.ts
   * buildHours). One per session, everyone, and the same rows the hour
   * grid counts: logged on a day of the month, timed or not. */
  let loggedHours: number[] = [];
  /* The ledger total under each period board (owner ask, 2026-09-05: show a
   * total somewhere on the meters-by-day board). Summed HERE off the raw
   * entries so the hidden elite are counted — their meters belong to every
   * aggregate, and the rows handed to the client carry 0 for them. */
  const emptyTotals = (n: number): PeriodTotal[] =>
    Array.from({ length: n }, () => ({ meters: 0, sessions: 0, rowers: 0 }));
  let dayTotals: PeriodTotal[] = emptyTotals(pm.days);
  let weekTotals: PeriodTotal[] = emptyTotals(weeks.length);
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
    /* Only a known participant's rows reach the field, the way computeBoards
     * drops orphans — and nothing but the three numbers it needs. */
    const known = new Set(participants.map((p) => p.id));
    fieldEntries = entries
      .filter((e) => known.has(e.participantId))
      .map((e) => ({ participantId: e.participantId, meters: e.meters, seconds: e.seconds }));
    for (const e of monthEntries) {
      if (!known.has(e.participantId)) continue;
      const west = new Date(e.createdAt.getTime() - PACIFIC_SHIFT_MS);
      // A late log landing outside the month is skipped, as on the grid.
      const westDay = west.toISOString().slice(0, 10);
      if (westDay < pm.firstDay || westDay > pm.lastDay) continue;
      loggedHours.push(west.getUTCHours() + west.getUTCMinutes() / 60);
    }

    /* Same two buckets computeDaily / computeWeekly file a row into, so a
     * total always matches the board under it: the month's days only,
     * weeks by `weeks`, orphan rows dropped. Rowers are distinct loggers,
     * not the start list. */
    const month = pm.key;
    const dayWho = Array.from({ length: dayTotals.length }, () => new Set<string>());
    const weekWho = weeks.map(() => new Set<string>());
    for (const e of monthEntries) {
      if (!known.has(e.participantId)) continue;
      if (e.day.slice(0, 7) === month) {
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
  if (hidden.size > 0 || hideAll || eliteTag.size > 0) {
    /* A hidden row loses its meters and keeps a digit count; every elite
     * row — hidden or the viewer's own — carries `unranked` and the pace
     * tag, so StatsBoards can draw the block (Stats.tsx BoardWindow).
     * `unranked` only rides on a rower the BOARD listed as elite: with the
     * board unreadable (hideAll) nobody is known to be, so the blanked rows
     * carry blocks and no place but no block is drawn over them — a block
     * headed THE ELITE · BY AVERAGE SPLIT over the whole field, with no
     * split to order it by, would say something untrue. */
    type PeriodRow = WeeklyRow & { masked?: boolean; digits?: number; unranked?: boolean; paceTag?: string };
    const blankWeek = (r: WeeklyRow): PeriodRow => {
      const elite = eliteTag.has(r.participantId);
      const paceTag = eliteTag.get(r.participantId);
      const tag = !elite ? {} : paceTag ? { unranked: true as const, paceTag } : { unranked: true as const };
      if (isHidden(r.participantId)) return { ...r, meters: 0, masked: true, digits: digitCount(r.meters), ...tag };
      if (elite) return { ...r, ...tag };
      return r;
    };
    weekly = weekly.map((rows) => rows.map(blankWeek));
    daily = daily.map((rows) => rows.map(blankWeek));
  }

  const meId = viewer.myParticipantId;

  /* The field: aggregates over everyone, individual marks without the
   * hidden rowers (field.ts). No viewer overlay on this page since
   * 2026-09-08 (owner: no YOU on the field here — the profile has its
   * own), so meId goes in as null. The hour chart under it counts every
   * logged session by the hour it landed. The maths is the one step that
   * could throw on a shape of data nobody foresaw; the section then says
   * nothing rather than the page failing. */
  let field: FieldModel | null = null;
  let hours: ReturnType<typeof buildHours> = null;
  /* The 5k and the 10k as distributions of TIME (owner ask, 2026-09-11).
   * The field's only here — meId is null, the same call this page makes for
   * the other densities. The figures need no masking (a 5k time is public
   * even for one of the elite while a window is open, records/defs.ts
   * liteRecords) but the rug ticks do, so `isHidden` goes along exactly as
   * it does to buildField: a tick on a chart titled 5K is a rower's meters
   * by another route (distances.ts). */
  let distances: DistanceKde[] = [];
  try {
    field = buildField(fieldEntries, { isHidden, meId: null }).field;
    hours = buildHours(loggedHours);
    distances = buildDistanceKdes(fieldEntries, null, isHidden);
  } catch (err) {
    console.error("row100k/stats: field maths failed", err);
  }

  const now = clockNow();
  const started = now >= START_MS;

  /* Default to the week containing today, clamped to the month: before
   * the 1st shows Week 1, after it shows the finish. */
  // Pacific, like the dateline and the hour grid — a UTC date here put an
  // empty "tomorrow" board under a Sep 5 dateline every evening.
  const today = pacificDay(now);
  const wi = thisMonth ? weekIdx(today) : -1;
  const defaultWeek = thisMonth ? (wi >= 0 ? wi : today < pm.firstDay ? 0 : weeks.length - 1) : weeks.length - 1;

  /* The daily board opens on the day the URL named, else today, clamped
   * into the month; a past month opens on its last day. */
  const todayDay = !thisMonth
    ? pm.days - 1
    : today < pm.firstDay
      ? 0
      : today.slice(0, 7) === pm.key
        ? Number(today.slice(8, 10)) - 1
        : pm.days - 1;
  const defaultDay = dayPinned ? Math.max(0, pinnedDay) : todayDay;

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
   * Late logs landing outside the month are skipped, and the grid only
   * runs through today (US-west), clamped to the last day. */
  const SHIFT_MS = 7 * 3600_000;
  /* Days of the month that have actually happened — every chart on this
   * page stops here rather than reserving space for the rest of the month. */
  const gridDayCount = thisMonth ? daysElapsed(now) : pm.days;
  const hourGrid: number[][] = Array.from(
    { length: gridDayCount },
    () => Array(24).fill(0) as number[],
  );
  for (const e of gridEntries) {
    const shifted = new Date(e.createdAt.getTime() - SHIFT_MS);
    const day = shifted.toISOString().slice(0, 10);
    if (day < pm.firstDay || day > pm.lastDay) continue;
    const di = Number(day.slice(8, 10)) - 1;
    if (di >= gridDayCount) continue;
    // Sessions, not meters: the section is WHEN rows get logged, and a
    // meters sum handed to client components would equal one rower's
    // session whenever they row an hour alone — a blackout leak (review,
    // 2026-09-05). The post pack counts the same way.
    hourGrid[di][shifted.getUTCHours()] += 1;
  }

  /* THE QUERY this page carries: the month unless it is this one, the stat
   * unless it is the first word. Every menu on the page keeps the other
   * word (owner, 2026-09-24: a selector for the period and one for the
   * stat, side by side). */
  const carry: Record<string, string> = {};
  if (!thisMonth) carry.m = period.key;
  if (statKey !== "total") carry.s = statKey;
  const statHref = (key: RecordKey) => {
    const q = new URLSearchParams(carry);
    if (key === "total") q.delete("s");
    else q.set("s", key);
    const qs = q.toString();
    return qs ? `/row100k/stats?${qs}` : "/row100k/stats";
  };
  const monthQuery = statKey !== "total" ? { s: statKey } : undefined;

  /* THE MONTH IS THE CONTROL here too (PeriodSelect.tsx), and the only
   * thing in the dateline (owner, 2026-09-24: no FINAL, no DEC 15). */
  const monthWord =
    months.length > 1 ? (
      <PeriodSelect options={periodOptions(now)} value={period.key} base="/row100k/stats" current={MONTH.key} query={monthQuery} />
    ) : (
      MONTH.label
    );
  const dateline = monthWord;

  /* The stat block's two words: the same month word again, and the stat
   * (records/defs.ts titles, so a record is called the same thing
   * everywhere). */
  const pick = (
    <p className="st-pick">
      {months.length > 1 ? (
        <PeriodSelect options={periodOptions(now)} value={period.key} base="/row100k/stats" current={MONTH.key} query={monthQuery} />
      ) : (
        MONTH.label
      )}
      <span className="dot">·</span>
      <TextMenu
        options={RECORD_DEFS.map((d) => ({ key: d.key, label: d.title, href: statHref(d.key) }))}
        value={statKey}
        ariaLabel="Which stat"
      />
    </p>
  );

  /* The months either side of the one the boards are over, for the day
   * menu (owner, 2026-09-24: a date outside the month swaps to that
   * month). Nothing before the first month; nothing after this one. */
  const prevM = pm.key > FIRST_MONTH_KEY ? prevMonth(pm) : null;
  const nextM = pm.key < MONTH.key ? nextMonth(pm) : null;
  const stepOf = (m: { key: string; label: string } | null): MonthStep | undefined =>
    m ? { key: m.key, label: m.label } : undefined;

  const attendance = perfectAttendance(daily, now, { through: thisMonth ? undefined : pm.days, short: pm.short });

  const community = {
    meters: boards.community.meters,
    rowers: boards.community.people,
    sessions: boards.community.sessions,
    /* WHICH MONTH the community cards draw (cards.ts ShareData.month —
     * owner, 2026-09-24: a past month's calendar card came up empty because
     * the cards spelled September into every key). A past month is drawn
     * whole; this month stops at today (StatsShare fills the day count in);
     * all time has no one month, so the calendar and day cards stay out. */
    month: period.kind === "all" ? null : { key: pm.key, firstDow: pm.firstDow, days: pm.days },
    days: thisMonth || period.kind === "all" ? undefined : pm.days,
  };
  /* Hours rowed: time on the erg over the period, everyone, the elite
   * included — an aggregate the blackout never masks. */
  const hoursRowed = Math.round(boards.community.seconds / 3600);
  const monthWordShort = pm.label.slice(0, 3);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{headCss}</style>
      <style>{statsCss}</style>

      <RowBar active="stats" {...barProps(viewer)} />

      {/* The head (owner, 2026-09-24: "the headline stats for the month:
       * total meters together (biggest), then hours rowed; also rowers and
       * sessions, with an order of importance in the top fold"). The
       * community total in the odometer — a sum over everyone, the elite
       * included, which the blackout never masks — then the three under
       * it, hours first and largest. One SHARE A CARD for every card on
       * the page sits under them. */}
      <div className="ph-sec">
        <div className="wrap">
          <PageHead
            name=""
            dateline={dateline}
            meters={boardUnreadable ? null : community.meters}
            unit={
              <>
                Meters · <b>everyone together</b>
              </>
            }
            after={
              <>
                <div className="st-figs">
                  <div className="st-fig hours">
                    <div className="n">
                      {boardUnreadable ? "—" : hoursRowed.toLocaleString("en-US")}
                      <span className="u">h</span>
                    </div>
                    <div className="l">Hours rowed</div>
                  </div>
                  <div className="st-fig">
                    <div className="n">{boardUnreadable ? "—" : community.rowers.toLocaleString("en-US")}</div>
                    <div className="l">Rowers</div>
                  </div>
                  <div className="st-fig">
                    <div className="n">{boardUnreadable ? "—" : community.sessions.toLocaleString("en-US")}</div>
                    <div className="l">Sessions</div>
                  </div>
                </div>
                <div className="st-share">
                  <StatsShare
                    community={{
                      ...community,
                      byDay: communityByDay,
                      daily: boards.daily,
                      hourGrid,
                      days: gridDayCount,
                    }}
                    prefer="rowtember-community-month"
                  />
                </div>
              </>
            }
          />
        </div>
      </div>

      {/* The stat block runs straight off the head: the two words, the
          leading value, the podiums (owner call, 2026-09-05 — the leaders
          and their values carry the emphasis, not the controls). */}
      <section>
        <div className="wrap">
          {/* anyHidden covers the fail-closed path too: with the board
              unreadable the masked set is empty, yet every row but the
              viewer's own is blanked, and the note must say so. */}
          <StatsRecords
            records={records}
            statKey={statKey}
            periodKey={period.key}
            pick={pick}
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
            weeks={weeks}
            live={thisMonth}
            weekly={weekly}
            daily={daily}
            dayTotals={dayTotals}
            weekTotals={weekTotals}
            defaultWeek={defaultWeek}
            defaultDay={defaultDay}
            dayPinned={dayPinned}
            started={started}
            meId={meId}
            maskedIds={[...hidden]}
            query={carry}
            prev={stepOf(prevM)}
            next={stepOf(nextM)}
          />
        </div>
      </section>

      {/* THE MONTH: the calendar alone under its title (owner, 2026-09-24:
          no subtitle). */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The month</h2>
          </div>
          <MonthSection
            month={{ key: pm.key, firstDow: pm.firstDow, days: pm.days }}
            byDay={communityByDay}
            thresholds={thresholds}
            days={gridDayCount}
          />
        </div>
      </section>

      {/* THE HOURS: the grid alone (owner, 2026-09-24: no WHEN ROWS GET
          LOGGED after the title, and the share button went to the top). */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The hours</h2>
          </div>
          <HourGrid grid={hourGrid} month={monthWordShort} />
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
          <FieldSection field={field} hours={hours} distances={distances} />
        </div>
      </section>

      {/* PERFECT ATTENDANCE (owner, 2026-09-21: "give me a section for
        * perfect attendance — list people who have not missed a day"), last
        * on the page since 2026-09-24 (owner: below THE FIELD). A day is
        * not missed until it is over, so the rule is every day through
        * yesterday, and on day one it is everyone who has rowed. */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Perfect attendance</h2>
            <span className="mono">{attendance.note}</span>
          </div>
          <PerfectAttendance rows={attendance.rows} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
