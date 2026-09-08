"use client";

import { useEffect, useRef, useState } from "react";
import {
  ELITE_LABEL,
  ELITE_TAG,
  clockShape,
  digitCount,
  eliteOrder,
  fmtPacificDay,
  partialShape,
} from "@/lib/blackoutRules";
import { BlockClock, BlockShape, Blocks } from "./Blackout";
import { Who } from "./Boards";
import {
  WEEKS,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  nowMs,
  type Week,
  type WeeklyRow,
} from "@/lib/row100k";
import {
  RECORD_DEFS,
  podiumWindow,
  type RecordDef,
  type RecordKey,
  type RecordRowLite,
  type RecordsProp,
} from "./records/defs";

/* The two client sections of the stats page (owner review, 2026-09-05,
 * the second look the same night, and the 2026-09-08 pass).
 *
 * THE RECORDS: TOTAL METERS is the front page's leader box — eyebrow, the
 * leader's meters, their name — over one mono link to the board, and no
 * podiums (owner, 2026-09-08: the podiums under it ran taller than the
 * other records', so picking fastest 5k snapped the page up). While the
 * elite are hidden nobody leads, and the box does what the front page's
 * does: the longest hidden total in blocks, THE ELITE on the name line —
 * the same three lines, the same height, with or without a window (the
 * list of the elite is the board's, one link away). The other four
 * records print the way the front page prints the board — the overall
 * number one as a big blue headline with the holder on a mono line, then
 * the men's and women's top five
 * side by side — with FULL RANKING after. The control that picks the
 * record is a submenu of small mono links (.st-sub) right under the
 * headline. A signed-in rower outside a podium gets one more line under
 * it: their place, number, name and value — no gap row, no neighbours
 * (owner, 2026-09-08).
 *
 * METERS BY DAY / BY WEEK: the section head is the period, so it lives
 * here where the pick is known — the same .st-sub submenu swaps it — then
 * one table, the top ten plus the viewer's neighbourhood, for the day or
 * the week chosen. The elite lead it in their own block, by average split,
 * and the ranked rows under them count from 1 (owner, 2026-09-08).
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
 * when it repeats — all challenge weeks sit inside September). */
function weekDates(w: Week): string {
  return w.first.slice(0, 7) === w.last.slice(0, 7)
    ? `${fmtDay(w.first)}–${Number(w.last.slice(8, 10))}`
    : `${fmtDay(w.first)}–${fmtDay(w.last)}`;
}

/* ------------------------------------------------------------- records */

export function StatsRecords({
  records,
  started,
  meId,
  anyHidden,
  unavailable = false,
  blackout = { active: false },
}: {
  records: RecordsProp;
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
  const [key, setKey] = useState<RecordKey>("total");
  const def = defOf(key);
  const rows = records[key] ?? [];
  const first = rows[0];
  const until = blackout.endsAt ? ` UNTIL ${fmtPacificDay(blackout.endsAt).toUpperCase()}` : "";

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
  /* The front page's leader: the first row with meters. A masked row
   * carries 0 here (only its digit count travels), so the mask itself has
   * to count as "has meters" or the box would name the wrong rower. */
  const leader = isTotal && !hiddenRanking ? rows.find((r) => r.value > 0 || r.masked) : undefined;

  /* A rower in neither division (X, the schema default — overall boards
   * only) has no podium to sit under, so their own line is drawn once more
   * against the whole ranking: the owner said seeing where you stand on
   * this page matters. Never on TOTAL METERS, which has no podiums. */
  const meRow = meId ? rows.find((r) => r.participantId === meId) : undefined;
  const overall = !isTotal && meRow !== undefined && meRow.division !== "M" && meRow.division !== "F";

  /* The holder line under the headline: number · NAME · day, plus the
   * split for a pace record. Times are public for everyone, the elite
   * included (owner, 2026-09-08), so the split always prints. */
  const meta = first
    ? [
        first.day ? fmtDay(first.day) : null,
        def.kind === "time" && def.dist ? `${fmtSplit(def.dist, first.value)} /500m` : null,
        first.sessions != null ? `${first.sessions} sessions` : null,
      ]
        .filter(Boolean)
        .map((s) => ` · ${s}`)
        .join("")
    : "";

  return (
    <div>
      {/* Same line the board prints: an admin (nothing hidden while a window
          is open) is told what they are looking at rather than about rows
          that are not hidden for them. */}
      {(blackout.active || anyHidden) && (
        <p className="bo-note">
          {anyHidden
            ? /* Times are public for the elite (owner, 2026-09-08) — said on
                 the two records that print one, the way the full-ranking
                 page says it, and not under a meters record. */
              `BLACKOUT — ${ELITE_LABEL} ARE HIDDEN${until}${def.kind === "time" ? " · TIMES ARE SHOWN" : ""}`
            : `BLACKOUT ON${until} — YOU SEE EVERYTHING`}
        </p>
      )}

      {/* TOTAL METERS: the front page's leader box, in the front page's two
          states — the leader, or the elite in blocks while a window is open.
          The other four: the newspaper head, the record's number one big and
          blue, the holder on the mono line (the board head, one size down).
          One descriptor line, no extra title (owner call, 2026-09-05). */}
      {isTotal ? (
        /* The simpler box (no IN THE LEAD FOR N DAYS line — that needs the
           day-by-day leaders the front page loads — and no BLACKOUT head
           line either: the bo-note one line up already says it, so the box
           keeps the same three lines, eyebrow, meters, name, in both states
           and picking another record never moves the submenu): the meters
           (blocks if masked, the way the front page draws them), the name.
           While the elite are hidden the meters are the longest hidden total
           in blocks and the name line reads THE ELITE (front page). */
        <div className="front-box st-lead">
          <div className="eyebrow mono">The leader</div>
          {hiddenRanking ? (
            <>
              <div className="v">
                <Blocks digits={eliteDigits} /> m
              </div>
              <div className="nm">{ELITE_LABEL}</div>
            </>
          ) : leader ? (
            <>
              <div className="v">
                {leader.masked ? (
                  <>
                    <Blocks digits={leader.digits ?? digitCount(leader.value)} /> m
                  </>
                ) : leader.hideLow ? (
                  /* The run-up (blackoutRules.rampRow): the digits still
                     showing are real, the tail is already out of the row
                     — drawn the way the board draws it. */
                  <>
                    <BlockShape shape={partialShape(leader.value, leader.hideLow, leader.digits)} label="partly hidden" /> m
                  </>
                ) : (
                  fmtMeters(leader.value)
                )}
              </div>
              <div className="nm">
                <Who row={{ name: leader.name, rowerNumber: leader.rowerNumber }} />
              </div>
            </>
          ) : (
            <div className="head mono">
              {unavailable
                ? "THE BOARD COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT."
                : started
                  ? "NOBODY HAS LOGGED A METER YET"
                  : "FIRST STROKE SEP 1"}
            </div>
          )}
        </div>
      ) : first ? (
        <div className="bhead st-rec">
          <div className="bhead-n">
            <Val r={first} def={def} unit="big" />
          </div>
          <p className="bhead-l mono">
            {/* Just the holder: the submenu under the number names the
                record (owner, 2026-09-05: this line, not the titled one). */}
            {fmtRowerNumber(first.rowerNumber)} · <b>{first.name}</b>
            {meta}
          </p>
        </div>
      ) : (
        <p className="board-empty">
          {unavailable ? "THE RECORDS COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT." : def.emptyHint(started)}
        </p>
      )}

      {/* The record submenu, right under the headline ("underneath the first
          callout, under the 150,046 for Frankie" — owner, 2026-09-05): small
          mono links, the picked one in ink with a water underline — a
          submenu, not a main menu. Buttons, since they change state on this
          page; the full-ranking pages keep their own links. */}
      <div className="st-sub tight" role="group" aria-label="Record">
        {RECORD_DEFS.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={key === d.key}
            className={key === d.key ? "on" : undefined}
            onClick={() => setKey(d.key)}
          >
            {d.title}
          </button>
        ))}
      </div>

      {isTotal ? (
        /* The whole ranking lives on the board, so the one link goes there
           (the front page's line under the latest row) and FULL RANKING
           stays off this record — two links to the same list is one too
           many. */
        <p className="front-more mono">
          <a href="/row100k/board">See the whole board →</a>
        </p>
      ) : (
        <>
          {!unavailable && (
            <div className="front-top st-podiums">
              <Podium label="Men" rows={rows.filter((r) => r.division === "M")} def={def} meId={meId} />
              <Podium label="Women" rows={rows.filter((r) => r.division === "F")} def={def} meId={meId} />
            </div>
          )}
          {overall && <Podium label="Overall" rows={rows} def={def} meId={meId} top={0} className="st-overall" />}

          <div className="ms-actions">
            <a className="quiet-btn" href={`/row100k/records/${key}?d=all`}>
              FULL RANKING →
            </a>
          </div>
        </>
      )}
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
              <RecTr key={r.participantId} r={r} rank={w.ctxStart + i + 1} def={def} me={r.participantId === meId} />
            ))}
          </tbody>
        </table>
      )}
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

export function StatsBoards({
  weekly,
  daily,
  dayTotals,
  weekTotals,
  defaultWeek,
  defaultDay,
  started,
  meId,
  maskedIds,
}: {
  weekly: (WeeklyRow & Hideable)[][];
  /* One board per September day, index = day-of-month − 1. */
  daily: (WeeklyRow & Hideable)[][];
  /* One total per day / per week, same indexes as `daily` / `weekly`. */
  dayTotals?: PeriodTotal[];
  weekTotals?: PeriodTotal[];
  defaultWeek: number;
  /* Today's index into `daily` (clamped into the challenge). */
  defaultDay: number;
  started: boolean;
  /* Signed-in rower's participant id (resolved server-side), or null. */
  meId: string | null;
  /* Participant ids hidden from this viewer (empty outside a blackout). */
  maskedIds: string[];
}) {
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [week, setWeek] = useState(defaultWeek);
  const [day, setDay] = useState(defaultDay);

  const hidden = new Set(maskedIds);

  // The server's "today" is UTC — an evening viewer in the US would land on
  // tomorrow's empty board. After mount the browser knows the local date, so
  // re-derive today's index (it also caps the picker) and move the selection
  // there unless the viewer already stepped somewhere themselves.
  const [todayIdx, setTodayIdx] = useState(defaultDay);
  const dayTouched = useRef(false);
  useEffect(() => {
    const d = new Date(nowMs());
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const month = WEEKS[0].first.slice(0, 7);
    const idx =
      local < WEEKS[0].first ? 0 : local.slice(0, 7) > month ? daily.length - 1 : Number(local.slice(8, 10)) - 1;
    const clamped = Math.max(0, Math.min(idx, daily.length - 1));
    setTodayIdx(clamped);
    if (!dayTouched.current) setDay(clamped);
  }, [daily.length]);

  /* Only weeks that have started get a chip — a week exists once its first
   * day arrives (same clock as the server's default-week pick). Before
   * Sep 1 that's nothing, so Week 1 stands in with the empty-state copy. */
  const today = new Date(nowMs()).toISOString().slice(0, 10);
  const startedWeeks = WEEKS.filter((w) => w.first <= today);
  const shownWeeks: Week[] = startedWeeks.length > 0 ? startedWeeks : [WEEKS[0]];
  const wk = Math.min(week, shownWeeks.length - 1);
  const weekRows = weekly[wk] ?? [];

  /* Days: 30 chips would swamp the row, so the picker is a stepper plus a
   * dropdown — defaults to today, steps or jumps to any day that has
   * started. (Owner call, cycle 7.) */
  const maxDay = Math.max(0, Math.min(todayIdx, daily.length - 1));
  const dy = Math.max(0, Math.min(day, maxDay));
  const dayLabel = (i: number) => fmtDay(`${WEEKS[0].first.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`);
  const dayRows = daily[dy] ?? [];

  return (
    <div>
      {/* The section head is the period: the owner did not want a third
          "boards" title next to THE BOARD, so the h2 says which meters
          these are and the submenu under it swaps the word. */}
      <div className="sec-head">
        <h2>{period === "day" ? "Meters by day" : "Meters by week"}</h2>
        <span className="mono">{meId ? "TOP TEN · AND WHERE YOU ARE" : "TOP TEN"}</span>
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
        <div className="tabs" role="group" aria-label="Day">
          <button
            type="button"
            aria-label="Previous day"
            disabled={dy === 0}
            style={dy === 0 ? { opacity: 0.35, cursor: "default" } : undefined}
            onClick={() => {
              dayTouched.current = true;
              setDay(Math.max(0, dy - 1));
            }}
          >
            ‹
          </button>
          <select
            aria-label="Day"
            className="day-select"
            value={dy}
            onChange={(e) => {
              dayTouched.current = true;
              setDay(Number(e.target.value));
            }}
          >
            {Array.from({ length: maxDay + 1 }, (_, i) => (
              <option key={i} value={i}>
                {dayLabel(i)}
                {i === todayIdx ? " · today" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Next day"
            disabled={dy >= maxDay}
            style={dy >= maxDay ? { opacity: 0.35, cursor: "default" } : undefined}
            onClick={() => {
              dayTouched.current = true;
              setDay(Math.min(maxDay, dy + 1));
            }}
          >
            ›
          </button>
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

/* Top 10 by default; a signed-in rower deeper on the board gets their
 * neighborhood — three above, themselves, three below — after a gap row.
 * Ranks are places among the VISIBLE rows, and WHOLE BOARD expands to every
 * one of them (owner call, cycle 8). One table for the day and the week.
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
  const showCtx = !all && meIdx >= 10;
  const ctxStart = showCtx ? Math.max(10, meIdx - 3) : 0;
  const ctx = showCtx ? ranked.slice(ctxStart, Math.min(ranked.length, meIdx + 4)) : [];

  if (rows.length === 0) {
    return (
      <p className="board-empty">
        {started
          ? "NOBODY ON THIS BOARD YET — BE FIRST."
          : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
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
            {showCtx && ctxStart > 10 && (
              <tr className="gaprow">
                <td colSpan={4}>···</td>
              </tr>
            )}
            {ctx.map((r, i) => (
              <WeekTr
                key={r.participantId}
                r={r}
                rank={ctxStart + i + 1}
                me={r.participantId === meId}
                masked={isMasked(r)}
              />
            ))}
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
 * finisher tint (tr.fin) so they can spot themselves. The elite are up in
 * their own block (EliteTr); a row still masked down here is the
 * fail-closed path — blocks for the meters and no place, since a place is
 * a standing among rows this page cannot read. */
function WeekTr({ r, rank, me, masked }: { r: WeeklyRow & Hideable; rank: number; me: boolean; masked: boolean }) {
  return (
    <tr className={me ? "fin" : undefined}>
      <td className="rk">{masked ? "" : rank}</td>
      <td>
        <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} />
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
