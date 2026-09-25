"use client";

import type { ReactNode } from "react";
import {
  ELITE_LABEL,
  ELITE_TAG,
  clockShape,
  digitCount,
  eliteOrder,
  partialShape,
} from "@/lib/blackoutRules";
import { BlockClock, BlockShape, Blocks } from "./Blackout";
import { Who } from "./Boards";
import {
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtSplit,
  type Week,
  type WeeklyRow,
} from "@/lib/row100k";
import { TextMenu } from "./TextMenu";
import { LeadBlock } from "./records/LeadBlock";
import { DayCalendar } from "./stats/DayCalendar";
import type { PeriodStatKey } from "./stats/statsUrl";
import {
  RECORD_DEFS,
  podiumWindow,
  type RecordDef,
  type RecordKey,
  type RecordRowLite,
  type RecordsProp,
} from "./records/defs";

/* The two client sections of the stats page (owner review, 2026-09-05,
 * the second look the same night, the 2026-09-08 pass, the 2026-09-24
 * month pass and the 2026-09-25 swap-in-place pass).
 *
 * Both are CONTROLLED since 2026-09-25: the shell (stats/StatsShell.tsx)
 * owns the period, the stat, the day, the week and the by-day / by-week
 * mode, and hands them down with the callbacks, so that every pick swaps
 * what is on screen without a navigation (owner: "every time I click
 * fastest 5K / 10K / a month / a day there's a loading page and my scroll
 * resets. There shouldn't be"). Nothing in here reads a clock or a URL.
 *
 * THE STAT BLOCK (owner, 2026-09-24: "the big bold number shows the
 * selected stat, with a selector for the time period and a selector for
 * the stat; then the men's and women's top five"). The line of two words
 * above the figure is two TextMenus the shell builds. Under the line, the
 * leading value — for TOTAL METERS the leader's total, big and blue, with
 * the holder on the mono line; for a record its number one, the day it
 * was set and, for a 5k or 10k, the pace ON that line (owner, 2026-09-25:
 * the pace stays, the block never changes height) — then the men's and
 * women's top five. While the elite are hidden nobody leads TOTAL METERS:
 * the same head holds the longest hidden total in blocks with THE ELITE
 * on the holder line, and no podiums under it.
 *
 * THE ONE LINK TO THE FULL RANKINGS closes the block under the tables at
 * every width (owner, 2026-09-25, third look: "on mobile put the FULL
 * RANKINGS link below both tables again" — the phone placement under the
 * holder line from earlier the same day is gone). The viewer's own
 * appended row — the line under a top five for a signed-in rower placed
 * deeper (owner, 2026-09-08), and the line under the top ten on the
 * period board — is a PHONE thing (owner, 2026-09-25: "do not show the
 * viewer's own row when they are not in the top five / top ten … on
 * mobile, DO show where the viewer is"): it is still drawn, with .st-me,
 * and statsCss.ts hides it from the desktop breakpoint up.
 *
 * METERS BY DAY / METERS BY WEEK are two more stats on the stat word
 * since the third look (owner, 2026-09-25: "combine METERS BY DAY and BY
 * WEEK with the headline stat: add them as categories on the stat word …
 * the week or day is chosen with the same picker"), so StatsBoards is the
 * stat block for those two, in the same shape as StatsRecords: the two
 * words, then ONE reading line — BY DAY · BY WEEK · ‹ DEC 15 › (owner:
 * "put BY DAY, BY WEEK and the picker on the same line — easier to read
 * on mobile. Give BY WEEK the same arrows the day has") — then the
 * leader of that day or week in the lead block, and ONE ranked table
 * (everyone, the top ten, meters and sessions) where the men and women
 * pair would be, closed by FULL RANKINGS. The word between the arrows
 * drops the CALENDAR (stats/DayCalendar.tsx) in both modes: in week mode
 * a hover lights the whole week and a tap picks it. The arrows step a day
 * or a week; past either end of the month they step the month, a change
 * of period the shell fetches in place. The elite lead the table in their
 * own block, by average split, and the ranked rows under them count from
 * 1 (2026-09-08). No WHOLE BOARD button any more: the full board is the
 * rankings page.
 *
 * Blackout: the server blanks every METERS number a hidden rower owns
 * before it gets here (records/defs.ts liteRecords for the records,
 * stats/statsData.ts for the period rows), since anything in these props
 * is in the browser; their times are public (owner, 2026-09-08). A hidden
 * row keeps its name and draws blocks of the shape the number had. */

/* What a board row carries when the page blanked its number, and — on the
 * period boards — when the rower is one of the elite: no place, and the
 * average split that orders them. */
type Hideable = { masked?: boolean; digits?: number; shape?: string; unranked?: boolean; paceTag?: string };

/* One row of a day or week board as it crosses the wire: a WeeklyRow less
 * the instagram handle (never printed here), plus the mask. */
export type PeriodRow = Omit<WeeklyRow, "instagram"> & Hideable;

const defOf = (key: RecordKey): RecordDef => RECORD_DEFS.find((d) => d.key === key)!;

/* A board row's class: the viewer's own row wears the finisher tint
 * (tr.fin), and the one APPENDED under a top five / top ten — their place
 * when they are not in it — is .st-me as well, which statsCss.ts shows on
 * a phone only (owner, 2026-09-25). */
const rowClass = (me: boolean, appended: boolean): string | undefined =>
  [me ? "fin" : null, appended ? "st-me" : null].filter(Boolean).join(" ") || undefined;

/* "Sep 15–21" (both ends via fmtDay; the month drops off the second end
 * when it repeats — every week sits inside its month). */
function weekDates(w: Week): string {
  return w.first.slice(0, 7) === w.last.slice(0, 7)
    ? `${fmtDay(w.first)}–${Number(w.last.slice(8, 10))}`
    : `${fmtDay(w.first)}–${fmtDay(w.last)}`;
}

/* ------------------------------------------------------------- records */

export function StatsRecords({
  records,
  statKey,
  pick,
  rankingsHref,
  started,
  meId,
  anyHidden,
  unavailable = false,
  blackout = { active: false },
}: {
  records: RecordsProp;
  /* The stat the page is showing (?s=), one of records/defs.ts. */
  statKey: RecordKey;
  /* The two words above the figure — the month and the stat, each a menu
   * — built by the shell, which owns both. */
  pick: ReactNode;
  /* The full rankings for this stat over the period, ALL selected — the
   * one link, under the two tables (owner, 2026-09-25). */
  rankingsHref: string;
  started: boolean;
  /* Signed-in rower's participant id (resolved server-side), or null. */
  meId: string | null;
  /* Whether this viewer has rows hidden from them — the bo-note line. */
  anyHidden: boolean;
  /* The board could not be read, so the records are empty for that reason
   * and not because nobody has rowed. */
  unavailable?: boolean;
  blackout?: { active: boolean; endsAt?: string };
}) {
  const key = statKey;
  const def = defOf(key);
  const rows = records[key] ?? [];
  const first = rows[0];

  /* TOTAL METERS is the leader, not a record (owner, 2026-09-08). While
   * the elite are hidden they carry no place, so there is no leader to name
   * (the row at the top of the list is the fastest hidden rower by average
   * split, nobody's leader): the box draws the longest hidden total in
   * blocks over THE ELITE, the way the front page's does. The other four
   * records are untouched: a fastest 5k is a time, not the meters ranking
   * (owner, 2026-09-05 evening). */
  const isTotal = key === "total";
  const eliteRows = isTotal ? rows.filter((r) => r.unranked) : [];
  const hiddenRanking = eliteRows.length > 0;
  /* The one thing that stays visible of the elite's meters — "if I have
   * another digit than everyone else, that is visible": the longest total
   * among them, as a digit count. A masked row carries the real total's
   * count; the viewer's own row, exempt from the mask, carries its meters. */
  const eliteDigits = eliteRows.reduce((n, r) => Math.max(n, r.digits ?? digitCount(r.value)), 1);

  /* A rower in neither division (X, the schema default — overall boards
   * only) has no podium to sit under, so their own line is drawn once more
   * against the whole ranking: the owner said seeing where you stand on
   * this page matters. Not while the elite are hidden on TOTAL METERS —
   * there are no podiums then. */
  const meRow = meId ? rows.find((r) => r.participantId === meId) : undefined;
  const overall =
    !(isTotal && hiddenRanking) && meRow !== undefined && meRow.division !== "M" && meRow.division !== "F";

  /* The split for a pace record, its own figure under the holder line
   * (records/LeadBlock.tsx). Times are public for everyone, the elite
   * included (owner, 2026-09-08), so the split always prints. */
  const pace = first && def.kind === "time" && def.dist ? fmtSplit(def.dist, first.value) : undefined;

  return (
    <div>
      {/* The two words: NOVEMBER 2026 · FASTEST 10K, each a menu. */}
      <p className="st-pick">
        <span className="st-pick-words">{pick}</span>
      </p>

      {/* Same line the board prints: an admin (nothing hidden while a window
          is open) is told what they are looking at rather than about rows
          that are not hidden for them. */}
      {(blackout.active || anyHidden) && (
        <p className="bo-note" style={{ marginTop: 12 }}>
          {anyHidden
            ? /* Times are public for the elite (owner, 2026-09-08) — said on
                 the two records that print one, the way the full-ranking
                 page says it, and not under a meters record. */
              `${ELITE_LABEL}${def.kind === "time" ? " · TIMES ARE SHOWN" : ""}`
            : `${ELITE_LABEL} IS ON — YOU SEE EVERYTHING`}
        </p>
      )}

      {/* TOTAL METERS: the front page's leader box, in the front page's two
          states — the leader, or the elite in blocks while a window is open.
          The other four: the newspaper head, the record's number one big and
          blue, the holder on the mono line (the board head, one size down).
          One descriptor line, no extra title (owner call, 2026-09-05). The
          block itself is records/LeadBlock.tsx, the same one the head of a
          full-ranking page draws (owner, 2026-09-24). */}
      {isTotal && hiddenRanking ? (
        /* The elite are hidden: nobody leads, and the row at the top of the
           list is the fastest hidden rower by split, nobody's number one.
           The same head as every other record, so picking one never moves
           the words: the longest hidden total in blocks, big and blue,
           THE ELITE on the holder line (the list of the elite is the
           board's, one link away). */
        <LeadBlock
          value={
            <>
              <Blocks digits={eliteDigits} /> <span className="u">m</span>
            </>
          }
          label={ELITE_LABEL}
        />
      ) : first ? (
        /* Just the holder: the words above the number name the stat
           (owner, 2026-09-05: this line, not the titled one). */
        <LeadBlock
          value={<Val r={first} def={def} unit="big" />}
          holder={{ rowerNumber: first.rowerNumber, name: first.name }}
          day={first.day}
          sessions={first.sessions}
          pace={pace}
          paceInline
        />
      ) : (
        <p className="board-empty">
          {unavailable ? "THE RECORDS COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT." : def.emptyHint(started)}
        </p>
      )}

      {/* The men's and women's top five under the figure (owner, 2026-09-08
          late, on the live page: "bring this table back"; 2026-09-24: the
          men and women brackets for the month). While the elite are hidden
          there is no TOTAL METERS ranking to draw them from — the box says
          THE ELITE and the list is the board's. */}
      {!unavailable && !(isTotal && hiddenRanking) && (
        <div className="front-top st-podiums">
          <Podium label="Men" rows={rows.filter((r) => r.division === "M")} def={def} meId={meId} />
          <Podium label="Women" rows={rows.filter((r) => r.division === "F")} def={def} meId={meId} />
        </div>
      )}
      {/* The Overall block is the viewer's own line and nothing else, so
          it is a phone thing like every other appended row (.st-me). */}
      {overall && <Podium label="Overall" rows={rows} def={def} meId={meId} top={0} className="st-overall st-me" />}

      {/* The link closes the block, under the tables, at every width
          (owner, 2026-09-25, third look). */}
      <AllLink href={rankingsHref} />
    </div>
  );
}

/* The one link to the full rankings, under the tables. A real link: the
 * records page is a page. */
function AllLink({ href }: { href: string }) {
  return (
    <p className="st-all-line">
      <a className="st-all" href={href}>
        Full rankings →
      </a>
    </p>
  );
}

/* A record value: a time with tenths, or meters with its unit — small and
 * grey inside the headline, plain in a table cell. A hidden row draws the
 * shape the page attached (the value itself is 0 by now); a total in the
 * run-up draws its covered tail as blocks (blackoutRules.partialShape, the
 * board's own treatment). */
function Val({ r, def, unit }: { r: RecordRowLite; def: RecordDef; unit: "big" | "table" }) {
  if (def.kind === "time") {
    return r.masked ? <BlockClock shape={r.shape ?? clockShape(r.value, true)} /> : <>{fmtRecordTime(r.value)}</>;
  }
  const num = r.masked ? (
    <Blocks digits={r.digits ?? digitCount(r.value)} />
  ) : r.hideLow ? (
    <BlockShape shape={partialShape(r.value, r.hideLow, r.digits)} label="partly hidden" />
  ) : (
    Math.round(r.value).toLocaleString("en-US")
  );
  return unit === "big" ? (
    <>
      {num} <span className="u">m</span>
    </>
  ) : (
    <>{num} m</>
  );
}

/* One division's top five — the front page's compact board — and, for a
 * signed-in rower placed deeper, ONE more line: their place, number, name
 * and value, tinted, with no gap row and no neighbours (records/defs.ts
 * podiumWindow; owner, 2026-09-08). Since 2026-09-25 that line is for the
 * phone only (.st-me, hidden from the desktop breakpoint up in
 * statsCss.ts; owner: "do not show the viewer's own row when they are not
 * in the top five"). Five, not three, since 2026-09-06
 * (owner: "show top five for each of the categories"); a rower sitting
 * sixth is the first line under the five. Places are within the rows given:
 * the division's for the two podiums, the whole ranking for the Overall
 * block, which takes top=0 and so draws the viewer's line alone (nothing at
 * all when the viewer is not on the list). */
function Podium({
  label,
  rows,
  def,
  meId,
  top = 5,
  className,
}: {
  label: string;
  rows: RecordRowLite[];
  def: RecordDef;
  meId: string | null;
  top?: number;
  className?: string;
}) {
  const meIdx = meId ? rows.findIndex((r) => r.participantId === meId) : -1;
  const w = podiumWindow(rows, meIdx, top);
  if (top === 0 && w.ctx.length === 0) return null;
  return (
    <div className={className ? `front-three ${className}` : "front-three"}>
      <h3 className="mono">{label}</h3>
      {rows.length === 0 ? (
        <p className="board-empty">NOBODY ON THIS BOARD YET.</p>
      ) : (
        <table className="board">
          <tbody>
            {w.top.map((r, i) => (
              <RecTr key={r.participantId} r={r} rank={i + 1} def={def} me={r.participantId === meId} />
            ))}
            {w.ctx.map((r, i) => (
              <RecTr key={r.participantId} r={r} rank={w.ctxStart + i + 1} def={def} me={r.participantId === meId} appended />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* One record row. A hidden rower on the TOTAL board carries no place, so
 * the # cell is empty wherever such a row can still appear (the cell keeps
 * the column). `appended` marks the viewer's own line under the five —
 * .st-me, a phone-only row since 2026-09-25. */
function RecTr({ r, rank, def, me, appended = false }: { r: RecordRowLite; rank: number; def: RecordDef; me: boolean; appended?: boolean }) {
  return (
    <tr className={rowClass(me, appended)}>
      <td className="rk">{r.unranked ? "" : rank}</td>
      <td>
        <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} />
      </td>
      <td className="num">
        <Val r={r} def={def} unit="table" />
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------- boards */

/* The ledger total under a period board — the whole day or the whole week,
 * everyone in it (owner ask, 2026-09-05: "show a total somewhere here").
 * Summed on the SERVER off the raw entries, hidden rowers included: their
 * meters count in every aggregate, and the rows that reach this component
 * carry 0 for a masked rower, so a client-side sum would be a lie. */
export type PeriodTotal = { meters: number; sessions: number; rowers: number };

/* A month either side of the one on the page, for the calendar's arrows:
 * its word and its ?m= key. */
export type MonthStep = { key: string; label: string };

/* Which period board is up: the stat key itself since 2026-09-25. */
export type BoardMode = PeriodStatKey;

export function StatsBoards({
  month,
  weeks,
  live = true,
  weekly,
  daily,
  dayTotals,
  weekTotals,
  todayDay,
  mode,
  day,
  week,
  onMode,
  onDay,
  onWeek,
  onStepMonth,
  hrefMode,
  hrefDay,
  hrefWeek,
  hrefStep,
  pick,
  rankingsHref,
  started,
  meId,
  maskedIds,
  prev,
  next,
  anyHidden = false,
  blackout = { active: false },
}: {
  /* The month the boards are over (rowPeriod.ts). */
  month: { key: string; label: string; firstDow: number; days: number };
  /* The weeks `weekly` is filed by (rowPeriod.ts weeksOf). */
  weeks: Week[];
  /* False when the page is over a past month: no day is today. */
  live?: boolean;
  weekly: PeriodRow[][];
  /* One board per day of the month, index = day-of-month − 1. */
  daily: PeriodRow[][];
  /* One total per day / per week, same indexes as `daily` / `weekly`. */
  dayTotals?: PeriodTotal[];
  weekTotals?: PeriodTotal[];
  /* Index of the last day that has happened: the calendar allows nothing
   * past it, and it is today when `live`. */
  todayDay: number;
  /* THE PICK, owned by the shell: by day or by week (the stat), which day
   * (index), which week (index). */
  mode: BoardMode;
  day: number;
  week: number;
  onMode: (m: BoardMode) => void;
  onDay: (i: number) => void;
  onWeek: (i: number) => void;
  /* The calendar's arrows, and the day / week arrows past either end of
   * the month: a change of period the shell fetches in place. */
  onStepMonth: (dir: "prev" | "next") => void;
  /* Real addresses for the same board, for a middle click. */
  hrefMode: (m: BoardMode) => string;
  hrefDay: (i: number) => string;
  hrefWeek: (i: number) => string;
  hrefStep: (dir: "prev" | "next") => string;
  /* The two words above the block — the month and the stat, each a menu
   * — built by the shell, which owns both. */
  pick: ReactNode;
  /* The full rankings for this day or week (statsUrl.ts rankingsHref). */
  rankingsHref: string;
  started: boolean;
  /* Signed-in rower's participant id (resolved server-side), or null. */
  meId: string | null;
  /* Participant ids hidden from this viewer (empty outside a blackout). */
  maskedIds: string[];
  /* The month before this one and the month after, when there is one. */
  prev?: MonthStep;
  next?: MonthStep;
  /* The bo-note line, the same one the records block prints. */
  anyHidden?: boolean;
  blackout?: { active: boolean; endsAt?: string };
}) {
  const hidden = new Set(maskedIds);
  const isWeek = mode === "week";

  /* Only weeks that have started are offered — a week exists once its
   * first day arrives. Before the 1st that is nothing, so Week 1 stands in
   * with the empty-state copy. */
  const lastDayKey = `${month.key}-${String(todayDay + 1).padStart(2, "0")}`;
  const startedWeeks = weeks.filter((w) => w.first <= lastDayKey);
  const shownWeeks: Week[] = startedWeeks.length > 0 ? startedWeeks : [weeks[0]];
  const maxWeek = shownWeeks.length - 1;
  const wk = Math.max(0, Math.min(week, maxWeek));
  const weekRows = weekly[wk] ?? [];

  const maxDay = Math.max(0, Math.min(todayDay, daily.length - 1));
  const dy = Math.max(0, Math.min(day, maxDay));
  const dayKey = (i: number) => `${month.key}-${String(i + 1).padStart(2, "0")}`;
  const dayRows = daily[dy] ?? [];

  /* THE WORD between the arrows: the day, or the week as its dates —
   * DEC 15, DEC 15–21 (owner, 2026-09-25: one reading line). */
  const word = isWeek ? (shownWeeks[wk] ? weekDates(shownWeeks[wk]) : "Week 1") : fmtDay(dayKey(dy));

  const stepPrev = prev
    ? { label: isWeek ? `Last week of ${prev.label}` : `Last day of ${prev.label}`, href: hrefStep("prev"), onStep: () => onStepMonth("prev") }
    : undefined;
  const stepNext = next
    ? { label: isWeek ? `First week of ${next.label}` : `First day of ${next.label}`, href: hrefStep("next"), onStep: () => onStepMonth("next") }
    : undefined;

  /* The arrows either side of the word step a day or a week; past either
   * end of the month they step the month, the way the calendar's arrows
   * do. */
  const arrow = (dir: "prev" | "next") => {
    const at = isWeek ? wk : dy;
    const max = isWeek ? maxWeek : maxDay;
    const can = dir === "prev" ? at > 0 : at < max;
    const glyph = dir === "prev" ? "‹" : "›";
    const step = dir === "prev" ? stepPrev : stepNext;
    const unit = isWeek ? "week" : "day";
    if (can) {
      const to = dir === "prev" ? at - 1 : at + 1;
      return (
        <button type="button" className="st-arrow" aria-label={dir === "prev" ? `Previous ${unit}` : `Next ${unit}`} onClick={() => (isWeek ? onWeek(to) : onDay(to))}>
          {glyph}
        </button>
      );
    }
    if (step) {
      return (
        <a
          className="st-arrow"
          aria-label={step.label}
          href={step.href}
          data-inplace=""
          onClick={(ev) => {
            if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
            ev.preventDefault();
            step.onStep();
          }}
        >
          {glyph}
        </a>
      );
    }
    return (
      <span className="st-arrow off" aria-hidden="true">
        {glyph}
      </span>
    );
  };

  /* BY DAY and BY WEEK as words: the one up is ink, the other is the
   * control, grey on a dotted rule. Each is a real link to the same block
   * (?s=day / ?s=week) that a plain tap swaps in place. */
  const modeWord = (m: BoardMode, label: string) => {
    const on = m === mode;
    return (
      <a
        className={on ? "st-mode on" : "st-mode"}
        href={hrefMode(m)}
        data-inplace=""
        aria-current={on ? "true" : undefined}
        onClick={(ev) => {
          if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
          ev.preventDefault();
          if (!on) onMode(m);
        }}
      >
        {label}
      </a>
    );
  };

  const rows = isWeek ? weekRows : dayRows;
  const total = isWeek ? weekTotals?.[wk] : dayTotals?.[dy];

  /* THE LEADER of the day or the week, in the lead block the records
   * wear, so the stat word never moves the page: while the elite are up
   * in their block nobody leads, and the longest hidden total draws in
   * blocks over LIGHTS OUT the way TOTAL METERS does; else the first
   * ranked row, its meters big and blue, the holder and the session count
   * on the mono line. */
  const eliteRows = rows.filter((r) => r.unranked);
  const first = rows.find((r) => !r.unranked);
  const firstMasked = first ? !!first.masked || hidden.has(first.participantId) : false;
  const eliteDigits = eliteRows.reduce((n, r) => Math.max(n, r.digits ?? digitCount(r.meters)), 1);

  return (
    <div>
      {/* The two words: DECEMBER 2026 · METERS BY DAY, each a menu. */}
      <p className="st-pick">
        <span className="st-pick-words">{pick}</span>
      </p>

      {/* ONE reading line: BY DAY · BY WEEK · ‹ DEC 15 › (owner, 2026-09-25). */}
      <div className="st-day" role="group" aria-label="Day or week">
        {modeWord("day", "By day")}
        <span className="dot">·</span>
        {modeWord("week", "By week")}
        <span className="dot">·</span>
        <span className="st-step">
          {arrow("prev")}
          {/* The word drops the calendar (DayCalendar.tsx), in both modes. */}
          <TextMenu
            options={[]}
            value={String(isWeek ? wk : dy)}
            label={word}
            ariaLabel={isWeek ? "Which week" : "Which day"}
            className="st-days"
            panel={(close) => (
              <DayCalendar
                mode={mode}
                month={month}
                weeks={shownWeeks}
                maxDay={maxDay}
                value={isWeek ? wk : dy}
                today={live ? todayDay : null}
                hrefFor={isWeek ? hrefWeek : hrefDay}
                onPick={isWeek ? onWeek : onDay}
                prev={stepPrev}
                next={stepNext}
                close={close}
              />
            )}
          />
          {arrow("next")}
        </span>
      </div>

      {(blackout.active || anyHidden) && (
        <p className="bo-note" style={{ marginTop: 12 }}>
          {anyHidden ? ELITE_LABEL : `${ELITE_LABEL} IS ON — YOU SEE EVERYTHING`}
        </p>
      )}

      {eliteRows.length > 0 ? (
        <LeadBlock
          value={
            <>
              <Blocks digits={eliteDigits} /> <span className="u">m</span>
            </>
          }
          label={ELITE_LABEL}
        />
      ) : first ? (
        <LeadBlock
          value={
            <>
              {firstMasked ? <Blocks digits={first.digits ?? digitCount(first.meters)} /> : Math.round(first.meters).toLocaleString("en-US")}{" "}
              <span className="u">m</span>
            </>
          }
          holder={{ rowerNumber: first.rowerNumber, name: first.name }}
          sessions={first.sessions}
        />
      ) : null}

      <div className="st-period">
        <BoardWindow rows={rows} meId={meId} started={started} hidden={hidden} total={total} />
      </div>

      <AllLink href={rankingsHref} />
    </div>
  );
}

/* The top ten; a signed-in rower deeper on the board gets ONE more row —
 * their own, at its real place, straight under the ten, no gap row and
 * no neighbours (owner, 2026-09-24: "top ten and then me on the next row
 * if I am not in the top ten"). Ranks are places among the VISIBLE rows.
 * The WHOLE BOARD button is gone (owner, 2026-09-25, third look: FULL
 * RANKINGS under the table is the way to the rest). One table for the day
 * and the week.
 *
 * The elite (owner, 2026-09-08): a hidden row left in the ranking says how
 * its day compares to the row under it — "Ken is right underneath me but
 * above someone with 25,000 today, so I know Ken has done more than
 * 25,000". So the rows that are elite for this viewer — the ones hidden
 * from them, and their own row when they are elite themself, which keeps
 * its meters and loses its place, the way the board does — are lifted out
 * into one block at the top, no place, the pace tag where the tier tag
 * goes, ordered by average split (blackoutRules.eliteOrder), and the ranked
 * list under them numbers only the visible rows, from 1. The total row
 * still counts everyone.
 *
 * Who is elite is what the page said — `unranked`, stamped off the board's
 * own elite set (stats/page.tsx). A row that is masked without it is the
 * fail-closed path (the board could not be read while a window was open,
 * so every row but the viewer's own is blanked and nobody is known to be
 * elite): those rows stay where the period ranks them, blocks and an empty
 * place cell, with no block over them claiming a pace nobody has. */
function BoardWindow({
  rows,
  meId,
  started,
  hidden,
  total,
}: {
  rows: PeriodRow[];
  meId: string | null;
  started: boolean;
  hidden: Set<string>;
  /* The period's own total, from the server. Absent (or empty) on a day
   * nobody logged, and then no total row prints. */
  total?: PeriodTotal;
}) {
  const isElite = (r: PeriodRow) => !!r.unranked;
  const isMasked = (r: PeriodRow) => !!r.masked || hidden.has(r.participantId);
  const elite = rows.filter(isElite).sort(eliteOrder);
  const ranked = rows.filter((r) => !isElite(r));
  const meIdx = meId ? ranked.findIndex((r) => r.participantId === meId) : -1;
  const top = ranked.slice(0, 10);
  const showMe = meIdx >= 10;

  if (rows.length === 0) {
    return (
      <p className="board-empty">
        {started
          ? "NOBODY ON THIS BOARD YET — BE FIRST."
          : "THE START LIST IS FILLING — METERS SHOW UP HERE ON THE 1ST."}
      </p>
    );
  }
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table className="board">
          <thead>
            <tr>
              <th className="rk">#</th>
              <th>Rower</th>
              <th style={{ textAlign: "right" }}>Meters</th>
              <th style={{ textAlign: "right" }}>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {elite.length > 0 && (
              <>
                {/* The board's own block (Boards.tsx): cream and ink like
                    every other row, the heading on a solid rule and a second
                    solid rule closing the block, the pace tag as the
                    identity, the order by it. Its look is the theme's
                    (tr.divrow.elite, tr.elite-row) — nothing is coloured
                    here. */}
                <tr className="divrow elite">
                  <td colSpan={4}>
                    {ELITE_LABEL}
                    <span className="by">BY AVERAGE SPLIT</span>
                  </td>
                </tr>
                {elite.map((r) => (
                  <EliteTr key={r.participantId} r={r} masked={isMasked(r)} />
                ))}
              </>
            )}
            {top.map((r, i) => (
              <WeekTr key={r.participantId} r={r} rank={i + 1} me={r.participantId === meId} masked={isMasked(r)} />
            ))}
            {showMe && (
              /* The viewer under the ten: a phone-only row (.st-me) since
                 2026-09-25 — on a desktop the ten stand alone. */
              <WeekTr
                key={ranked[meIdx].participantId}
                r={ranked[meIdx]}
                rank={meIdx + 1}
                me
                masked={isMasked(ranked[meIdx])}
                appended
              />
            )}
            {total && total.rowers > 0 && (
              /* The ledger line: everyone in the period, hidden rowers
                 counted (the sum comes off the server's raw entries, never
                 off these rows). No place — it is not a standing. */
              <tr className="totrow">
                {/* The label runs across the place column: the total holds
                    no place, and at 375px the two columns together are what
                    keeps EVERYONE and the rower count on one line. */}
                <td className="lbl" colSpan={2}>
                  EVERYONE · {total.rowers} {total.rowers === 1 ? "ROWER" : "ROWERS"}
                </td>
                <td className="num">{fmtMeters(total.meters)}</td>
                <td className="num">{total.sessions}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* One ranked row of the period board; the signed-in rower's row wears the
 * finisher tint (tr.fin) and a YOU tag so they can spot themselves. The
 * elite are up in their own block (EliteTr); a row still masked down here
 * is the fail-closed path — blocks for the meters and no place, since a
 * place is a standing among rows this page cannot read. `appended` is the
 * viewer's own row under the ten — .st-me, a phone-only row. */
function WeekTr({ r, rank, me, masked, appended = false }: { r: PeriodRow; rank: number; me: boolean; masked: boolean; appended?: boolean }) {
  return (
    <tr className={rowClass(me, appended)}>
      <td className="rk">{masked ? "" : rank}</td>
      <td>
        <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} badge={me ? <span className="tierbadge you">YOU</span> : undefined} />
      </td>
      <td className="num">
        {masked ? (
          <>
            <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
          </>
        ) : (
          fmtMeters(r.meters)
        )}
      </td>
      <td className="num" style={{ color: "var(--gray)" }}>
        {r.sessions}
      </td>
    </tr>
  );
}

/* One of the elite on the period board: the board's elite row (Boards.tsx
 * TotalRowTr while hidden) — no place, the average split where the tier
 * tag goes (ELITE when there is no timed row to average), blocks for the
 * meters, the session count in the open, in the same grey as every other
 * row's (the block is cream and ink like the rest of the table — the theme
 * draws it; no colour is set here). The name still links: the profile
 * masks the same rowers the same way. Only the viewer's own row — exempt
 * from the mask, in the block all the same — prints its real meters. */
function EliteTr({ r, masked }: { r: PeriodRow; masked: boolean }) {
  return (
    <tr className="elite-row">
      <td className="rk" />
      <td>
        <Who
          row={{ name: r.name, rowerNumber: r.rowerNumber }}
          badge={
            r.paceTag ? (
              <span className="tierbadge pace">{r.paceTag}</span>
            ) : (
              <span className="tierbadge elite">{ELITE_TAG}</span>
            )
          }
        />
      </td>
      <td className="num">
        {masked ? (
          <>
            <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
          </>
        ) : (
          fmtMeters(r.meters)
        )}
      </td>
      <td className="num" style={{ color: "var(--gray)" }}>
        {r.sessions}
      </td>
    </tr>
  );
}
