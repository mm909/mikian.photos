"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
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
  WEEKS,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtSplit,
  nowMs,
  type Week,
  type WeeklyRow,
} from "@/lib/row100k";
import { TextMenu, type TextMenuOption } from "./TextMenu";
import { LeadBlock } from "./records/LeadBlock";
import {
  RECORD_DEFS,
  podiumWindow,
  type RecordDef,
  type RecordKey,
  type RecordRowLite,
  type RecordsProp,
} from "./records/defs";

/* The two client sections of the stats page (owner review, 2026-09-05,
 * the second look the same night, the 2026-09-08 pass and the 2026-09-24
 * month pass).
 *
 * THE STAT BLOCK (owner, 2026-09-24: "the big bold number shows the
 * selected stat, with a selector for the time period and a selector for
 * the stat; then the men's and women's top five. For example November
 * 2026 · Fastest 10K shows the person who did it and when, and the men and
 * women brackets for November"). The page owns the pick: the month is
 * ?m= and the stat is ?s=, and the line of two words above the figure is
 * two TextMenus the page builds (stats/page.tsx). Under the line, the
 * leading value of the stat for the period — for TOTAL METERS the
 * leader's total, big and blue, with the holder on the mono line (owner,
 * 2026-09-09: "like the other leaderboards — the blue text"); for a
 * record its number one and the day it was set — then the men's and
 * women's top five, each with one line under it to the whole ranking for
 * the period (/row100k/records/[record]?m=). While the elite are hidden
 * nobody leads TOTAL METERS: the same head holds the longest hidden total
 * in blocks with THE ELITE on the holder line, and no podiums under it. A
 * signed-in rower outside a podium gets one more line under it: their
 * place, number, name and value — no gap row, no neighbours (owner,
 * 2026-09-08).
 *
 * METERS BY DAY / BY WEEK: the section head is the period, so it lives
 * here where the pick is known — the .st-sub submenu swaps it — then one
 * table, the top ten and the viewer under them, for the day or the week
 * chosen. The day is a word that is a menu (TextMenu.tsx) of the days of
 * the month that have happened, with the months either side as its first
 * and last lines (owner, 2026-09-24: "if I pick a date outside the
 * selected month it swaps to that month"). The elite lead the table in
 * their own block, by average split, and the ranked rows under them count
 * from 1 (owner, 2026-09-08).
 *
 * Blackout: the page blanks every METERS number a hidden rower owns before
 * it gets here (records/defs.ts liteRecords for the records, the weekly
 * rows in stats/page.tsx), since anything in these props is in the
 * browser; their times are public (owner, 2026-09-08). A hidden row keeps
 * its name and draws blocks of the shape the number had — a digit count
 * for meters. */

/* What a board row carries when the page blanked its number, and — on the
 * period boards — when the rower is one of the elite: no place, and the
 * average split that orders them. */
type Hideable = { masked?: boolean; digits?: number; shape?: string; unranked?: boolean; paceTag?: string };

const defOf = (key: RecordKey): RecordDef => RECORD_DEFS.find((d) => d.key === key)!;

/* "Sep 15–21" (both ends via fmtDay; the month drops off the second end
 * when it repeats — every week sits inside its month). */
function weekDates(w: Week): string {
  return w.first.slice(0, 7) === w.last.slice(0, 7)
    ? `${fmtDay(w.first)}–${Number(w.last.slice(8, 10))}`
    : `${fmtDay(w.first)}–${fmtDay(w.last)}`;
}

/* The whole ranking for a stat over the period: the records page, with
 * the month carried (owner, 2026-09-24: every footer link goes to the
 * full ranking page, not the board) and the division the table was. */
function rankingHref(key: RecordKey, periodKey: string, div?: "m" | "f"): string {
  const q = new URLSearchParams({ m: periodKey });
  if (div) q.set("d", div);
  return `/row100k/records/${key}?${q.toString()}`;
}

/* ------------------------------------------------------------- records */

export function StatsRecords({
  records,
  statKey,
  periodKey,
  pick,
  started,
  meId,
  anyHidden,
  unavailable = false,
  blackout = { active: false },
}: {
  records: RecordsProp;
  /* The stat the page is showing (?s=), one of records/defs.ts. */
  statKey: RecordKey;
  /* The period the records are over (?m=), for the ranking links. */
  periodKey: string;
  /* The line of two words above the figure — the month and the stat, each
   * a menu — built by the page, which owns both URLs. */
  pick: ReactNode;
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

  const foot = (div: "m" | "f") => (
    <p className="st-foot">
      <Link href={rankingHref(key, periodKey, div)}>Full ranking →</Link>
    </p>
  );

  return (
    <div>
      {/* The two words: NOVEMBER 2026 · FASTEST 10K, each a menu. */}
      {pick}

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
          THE ELITE and the list is the board's. Each table ends in one line
          to the whole ranking for the period. */}
      {!unavailable && !(isTotal && hiddenRanking) && (
        <div className="front-top st-podiums">
          <Podium label="Men" rows={rows.filter((r) => r.division === "M")} def={def} meId={meId} foot={foot("m")} />
          <Podium label="Women" rows={rows.filter((r) => r.division === "F")} def={def} meId={meId} foot={foot("f")} />
        </div>
      )}
      {overall && <Podium label="Overall" rows={rows} def={def} meId={meId} top={0} className="st-overall" />}
    </div>
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
 * podiumWindow; owner, 2026-09-08). Five, not three, since 2026-09-06
 * (owner: "show top five for each of the categories"); a rower sitting
 * sixth is the first line under the five. Places are within the rows given:
 * the division's for the two podiums, the whole ranking for the Overall
 * block, which takes top=0 and so draws the viewer's line alone (nothing at
 * all when the viewer is not on the list). `foot` is the line under the
 * table — the whole ranking, one link. */
function Podium({
  label,
  rows,
  def,
  meId,
  top = 5,
  className,
  foot,
}: {
  label: string;
  rows: RecordRowLite[];
  def: RecordDef;
  meId: string | null;
  top?: number;
  className?: string;
  foot?: ReactNode;
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
              <RecTr key={r.participantId} r={r} rank={w.ctxStart + i + 1} def={def} me={r.participantId === meId} />
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && foot}
    </div>
  );
}

/* One record row. A hidden rower on the TOTAL board carries no place, so
 * the # cell is empty wherever such a row can still appear (the cell keeps
 * the column). */
function RecTr({ r, rank, def, me }: { r: RecordRowLite; rank: number; def: RecordDef; me: boolean }) {
  return (
    <tr className={me ? "fin" : undefined}>
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

/* A month either side of the one on the page, as the first or last line
 * of the day menu: its word and its ?m= key. */
export type MonthStep = { key: string; label: string };

export function StatsBoards({
  weekly,
  daily,
  weeks: weeksProp,
  live = true,
  dayTotals,
  weekTotals,
  defaultWeek,
  defaultDay,
  dayPinned = false,
  started,
  meId,
  maskedIds,
  query = {},
  prev,
  next,
}: {
  weekly: (WeeklyRow & Hideable)[][];
  /* The weeks `weekly` is filed by — this month's unless the page is over
   * another month (rowPeriod.ts weeksOf). */
  weeks?: Week[];
  /* False when the page is over a past month: no day is today. */
  live?: boolean;
  /* One board per day of the month, index = day-of-month − 1. */
  daily: (WeeklyRow & Hideable)[][];
  /* One total per day / per week, same indexes as `daily` / `weekly`. */
  dayTotals?: PeriodTotal[];
  weekTotals?: PeriodTotal[];
  defaultWeek: number;
  /* Today's index into `daily` (clamped into the month), or the day the
   * URL named. */
  defaultDay: number;
  /* True when the URL named the day (?day=), so the browser's own idea of
   * today does not move the board off it after mount. */
  dayPinned?: boolean;
  started: boolean;
  /* Signed-in rower's participant id (resolved server-side), or null. */
  meId: string | null;
  /* Participant ids hidden from this viewer (empty outside a blackout). */
  maskedIds: string[];
  /* The query this page is already carrying (m, s) — every day line and
   * the month steps keep it. */
  query?: Record<string, string>;
  /* The month before this one and the month after, when there is one
   * (owner, 2026-09-24: a date outside the month swaps to that month). */
  prev?: MonthStep;
  next?: MonthStep;
}) {
  const weeks = weeksProp ?? WEEKS;
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [week, setWeek] = useState(defaultWeek);
  const [day, setDay] = useState(defaultDay);

  const hidden = new Set(maskedIds);

  // The server's "today" is UTC — an evening viewer in the US would land on
  // tomorrow's empty board. After mount the browser knows the local date, so
  // re-derive today's index (it also caps the picker) and move the selection
  // there unless the viewer already stepped somewhere themselves, or the
  // URL named the day.
  const [todayIdx, setTodayIdx] = useState(defaultDay);
  const dayTouched = useRef(dayPinned);
  useEffect(() => {
    if (!live) return;
    const d = new Date(nowMs());
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const month = weeks[0].first.slice(0, 7);
    const idx =
      local < weeks[0].first ? 0 : local.slice(0, 7) > month ? daily.length - 1 : Number(local.slice(8, 10)) - 1;
    const clamped = Math.max(0, Math.min(idx, daily.length - 1));
    setTodayIdx(clamped);
    if (!dayTouched.current) setDay(clamped);
  }, [daily.length, live]);

  /* Only weeks that have started get a chip — a week exists once its first
   * day arrives (same clock as the server's default-week pick). Before
   * the 1st that's nothing, so Week 1 stands in with the empty-state copy. */
  const today = new Date(nowMs()).toISOString().slice(0, 10);
  const startedWeeks = weeks.filter((w) => w.first <= today);
  const shownWeeks: Week[] = startedWeeks.length > 0 ? startedWeeks : [weeks[0]];
  const wk = Math.min(week, shownWeeks.length - 1);
  const weekRows = weekly[wk] ?? [];

  /* Days: the day is a word that is a menu — every day that has started,
   * today marked, the months either side as the first and last lines
   * (owner, 2026-09-24). The arrows step a day, and past either end they
   * are links into the month next door. */
  const maxDay = Math.max(0, Math.min(todayIdx, daily.length - 1));
  const dy = Math.max(0, Math.min(day, maxDay));
  const monthKey = weeks[0].first.slice(0, 7);
  const dayKey = (i: number) => `${monthKey}-${String(i + 1).padStart(2, "0")}`;
  const dayLabel = (i: number) => fmtDay(dayKey(i));
  const dayRows = daily[dy] ?? [];

  /* The hrefs keep whatever the page carries (?m=, ?s=), and a day line is
   * a real address for the same board — soft, so a plain tap swaps the
   * table in place instead of loading the page. */
  const hrefWith = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...query, ...extra });
    const qs = q.toString();
    return qs ? `/row100k/stats?${qs}` : "/row100k/stats";
  };
  const dayOptions: TextMenuOption[] = [];
  if (prev) dayOptions.push({ key: `m:${prev.key}`, label: `← ${prev.label}`, href: hrefWith({ m: prev.key, day: "31" }) });
  for (let i = 0; i <= maxDay; i++) {
    dayOptions.push({
      key: String(i),
      label: live && i === todayIdx ? `${dayLabel(i)} · today` : dayLabel(i),
      href: hrefWith({ day: String(i + 1) }),
      soft: true,
    });
  }
  if (next) dayOptions.push({ key: `m:${next.key}`, label: `${next.label} →`, href: hrefWith({ m: next.key, day: "1" }) });
  const pickDay = (k: string) => {
    if (k.startsWith("m:")) return;
    dayTouched.current = true;
    setDay(Number(k));
  };

  return (
    <div>
      {/* The section head is the period: the owner did not want a third
          "boards" title next to THE BOARD, so the h2 says which meters
          these are and the submenu under it swaps the word. No tag after
          it (owner, 2026-09-24: remove the TOP TEN tag). */}
      <div className="sec-head">
        <h2>{period === "day" ? "Meters by day" : "Meters by week"}</h2>
      </div>
      <div className="st-sub lead" role="group" aria-label="Period">
        <button
          type="button"
          aria-pressed={period === "day"}
          className={period === "day" ? "on" : undefined}
          onClick={() => setPeriod("day")}
        >
          By day
        </button>
        <button
          type="button"
          aria-pressed={period === "week"}
          className={period === "week" ? "on" : undefined}
          onClick={() => setPeriod("week")}
        >
          By week
        </button>
      </div>

      {period === "day" ? (
        <div className="st-day" role="group" aria-label="Day">
          {dy > 0 ? (
            <button
              type="button"
              className="st-arrow"
              aria-label="Previous day"
              onClick={() => {
                dayTouched.current = true;
                setDay(dy - 1);
              }}
            >
              ‹
            </button>
          ) : prev ? (
            <Link className="st-arrow" aria-label={`Last day of ${prev.label}`} href={hrefWith({ m: prev.key, day: "31" })}>
              ‹
            </Link>
          ) : (
            <span className="st-arrow off" aria-hidden="true">
              ‹
            </span>
          )}
          <TextMenu options={dayOptions} value={String(dy)} ariaLabel="Which day" onPick={pickDay} className="st-days" />
          {dy < maxDay ? (
            <button
              type="button"
              className="st-arrow"
              aria-label="Next day"
              onClick={() => {
                dayTouched.current = true;
                setDay(dy + 1);
              }}
            >
              ›
            </button>
          ) : next ? (
            <Link className="st-arrow" aria-label={`First day of ${next.label}`} href={hrefWith({ m: next.key, day: "1" })}>
              ›
            </Link>
          ) : (
            <span className="st-arrow off" aria-hidden="true">
              ›
            </span>
          )}
        </div>
      ) : (
        <div className="tabs" role="group" aria-label="Week">
          {shownWeeks.map((w, i) => (
            <button
              key={w.key}
              type="button"
              aria-pressed={wk === i}
              className={wk === i ? "on" : undefined}
              onClick={() => setWeek(i)}
            >
              {w.label} · {weekDates(w)}
            </button>
          ))}
        </div>
      )}

      <BoardWindow
        rows={period === "day" ? dayRows : weekRows}
        meId={meId}
        started={started}
        hidden={hidden}
        total={period === "day" ? dayTotals?.[dy] : weekTotals?.[wk]}
      />
    </div>
  );
}

/* Top 10 by default; a signed-in rower deeper on the board gets ONE more
 * row — their own, at its real place, straight under the ten, no gap row
 * and no neighbours (owner, 2026-09-24: "top ten and then me on the next
 * row if I am not in the top ten"). Ranks are places among the VISIBLE
 * rows, and WHOLE BOARD expands to every one of them (owner call, cycle
 * 8). One table for the day and the week.
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
  rows: (WeeklyRow & Hideable)[];
  meId: string | null;
  started: boolean;
  hidden: Set<string>;
  /* The period's own total, from the server. Absent (or empty) on a day
   * nobody logged, and then no total row prints. */
  total?: PeriodTotal;
}) {
  const [all, setAll] = useState(false);
  const isElite = (r: WeeklyRow & Hideable) => !!r.unranked;
  const isMasked = (r: WeeklyRow & Hideable) => !!r.masked || hidden.has(r.participantId);
  const elite = rows.filter(isElite).sort(eliteOrder);
  const ranked = rows.filter((r) => !isElite(r));
  const meIdx = meId ? ranked.findIndex((r) => r.participantId === meId) : -1;
  const top = all ? ranked : ranked.slice(0, 10);
  const showMe = !all && meIdx >= 10;

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
              <WeekTr
                key={ranked[meIdx].participantId}
                r={ranked[meIdx]}
                rank={meIdx + 1}
                me
                masked={isMasked(ranked[meIdx])}
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
      {ranked.length > 10 && (
        <button
          type="button"
          className="quiet-btn"
          style={{ marginTop: 12 }}
          aria-expanded={all}
          onClick={() => setAll((a) => !a)}
        >
          {all ? "TOP 10 ONLY" : `WHOLE BOARD — ALL ${ranked.length}`}
        </button>
      )}
    </div>
  );
}

/* One ranked row of the period board; the signed-in rower's row wears the
 * finisher tint (tr.fin) and a YOU tag so they can spot themselves. The
 * elite are up in their own block (EliteTr); a row still masked down here
 * is the fail-closed path — blocks for the meters and no place, since a
 * place is a standing among rows this page cannot read. */
function WeekTr({ r, rank, me, masked }: { r: WeeklyRow & Hideable; rank: number; me: boolean; masked: boolean }) {
  return (
    <tr className={me ? "fin" : undefined}>
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
function EliteTr({ r, masked }: { r: WeeklyRow & Hideable; masked: boolean }) {
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
