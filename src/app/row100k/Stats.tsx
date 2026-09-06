"use client";

import { useEffect, useRef, useState } from "react";
import { ELITE_LABEL, clockShape, digitCount, fmtPacificDay } from "@/lib/blackoutRules";
import { BlockClock, Blocks } from "./Blackout";
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
 * and the second look the same night).
 *
 * THE RECORDS: the page prints the chosen record the way the front page
 * prints the board — the overall number one as a big blue headline with
 * the holder on a mono line, then the men's and women's top three side
 * by side — and only THEN the control that picks the record: a submenu
 * of small mono links (.st-sub) — total meters, fastest 5k, fastest 10k,
 * longest row, biggest day — under the podiums, with FULL RANKING after
 * it. The owner wanted the eye on who leads and by how much, not on five
 * boxed buttons that never fit a row. A signed-in rower outside a podium
 * sees where they stand under it — a gap row, the rower above,
 * themselves, the rower below, nothing after.
 *
 * METERS BY DAY / BY WEEK: the section head is the period, so it lives
 * here where the pick is known — the same .st-sub submenu swaps it — then
 * one table, the top ten plus the viewer's neighbourhood, for the day or
 * the week chosen.
 *
 * Blackout: the page blanks every number a hidden rower owns before it
 * gets here (records/defs.ts liteRecords for the records, the weekly rows
 * in stats/page.tsx), since anything in these props is in the browser. A
 * hidden row keeps its place and its name and draws blocks of the shape
 * the number had — a digit count for meters, a ##:##.# silhouette for a
 * time. */

/* What a board row carries when the page blanked its number. */
type Hideable = { masked?: boolean; digits?: number; shape?: string };

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

  /* A rower in neither division (X, the schema default — overall boards
   * only) has no podium to sit under, so their neighbourhood is drawn once
   * more against the whole ranking: the owner said seeing where you stand
   * on this page matters. */
  const meRow = meId ? rows.find((r) => r.participantId === meId) : undefined;
  const overall = meRow !== undefined && meRow.division !== "M" && meRow.division !== "F";

  /* The holder line under the headline: number · NAME · day, plus the
   * split for a pace record and the session count for total meters. A
   * hidden holder's split is the time by another name, so it stays off. */
  const meta = first
    ? [
        first.day ? fmtDay(first.day) : null,
        def.kind === "time" && def.dist && !first.masked ? `${fmtSplit(def.dist, first.value)} /500m` : null,
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
          {anyHidden ? `BLACKOUT — ${ELITE_LABEL} ARE HIDDEN${until}` : `BLACKOUT ON${until} — YOU SEE EVERYTHING`}
        </p>
      )}

      {/* The newspaper head: the record's number one, big and blue, the
          holder on the mono line (the board head, one size down). The line
          opens with the record's name: the section head that used to say
          it is gone, and a bare time does not say 5k from 10k — one
          descriptor line, no extra title (owner call, 2026-09-05). */}
      {first ? (
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
    </div>
  );
}

/* A record value: a time with tenths, or meters with its unit — small and
 * grey inside the headline, plain in a table cell. A hidden row draws the
 * shape the page attached (the value itself is 0 by now). */
function Val({ r, def, unit }: { r: RecordRowLite; def: RecordDef; unit: "big" | "table" }) {
  if (def.kind === "time") {
    return r.masked ? <BlockClock shape={r.shape ?? clockShape(r.value, true)} /> : <>{fmtRecordTime(r.value)}</>;
  }
  const num = r.masked ? <Blocks digits={r.digits ?? digitCount(r.value)} /> : Math.round(r.value).toLocaleString("en-US");
  return unit === "big" ? (
    <>
      {num} <span className="u">m</span>
    </>
  ) : (
    <>{num} m</>
  );
}

/* One division's top three — the front page's compact board — and, for a
 * signed-in rower placed deeper, their neighbourhood under a gap row
 * (records/defs.ts podiumWindow). Places are within the rows given: the
 * division's for the two podiums, the whole ranking for the Overall block,
 * which takes top=0 and so draws the neighbourhood alone (nothing at all
 * when the viewer is not on the list). */
function Podium({
  label,
  rows,
  def,
  meId,
  top = 3,
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
            {w.gap && (
              <tr className="gaprow">
                <td colSpan={3}>···</td>
              </tr>
            )}
            {w.ctx.map((r, i) => (
              <RecTr key={r.participantId} r={r} rank={w.ctxStart + i + 1} def={def} me={r.participantId === meId} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RecTr({ r, rank, def, me }: { r: RecordRowLite; rank: number; def: RecordDef; me: boolean }) {
  return (
    <tr className={me ? "fin" : undefined}>
      <td className="rk">{rank}</td>
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

export function StatsBoards({
  weekly,
  daily,
  defaultWeek,
  defaultDay,
  started,
  meId,
  maskedIds,
}: {
  weekly: (WeeklyRow & Hideable)[][];
  /* One board per September day, index = day-of-month − 1. */
  daily: (WeeklyRow & Hideable)[][];
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

      <BoardWindow rows={period === "day" ? dayRows : weekRows} meId={meId} started={started} hidden={hidden} />
    </div>
  );
}

/* Top 10 by default; a signed-in rower deeper on the board gets their
 * neighborhood — three above, themselves, three below — after a gap row.
 * Ranks stay global (their place on the whole board), and WHOLE BOARD
 * expands to every rower (owner call, cycle 8). One table for the day and
 * the week. */
function BoardWindow({
  rows,
  meId,
  started,
  hidden,
}: {
  rows: (WeeklyRow & Hideable)[];
  meId: string | null;
  started: boolean;
  hidden: Set<string>;
}) {
  const [all, setAll] = useState(false);
  const meIdx = meId ? rows.findIndex((r) => r.participantId === meId) : -1;
  const top = all ? rows : rows.slice(0, 10);
  const showCtx = !all && meIdx >= 10;
  const ctxStart = showCtx ? Math.max(10, meIdx - 3) : 0;
  const ctx = showCtx ? rows.slice(ctxStart, Math.min(rows.length, meIdx + 4)) : [];

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
            {top.map((r, i) => (
              <WeekTr
                key={r.participantId}
                r={r}
                rank={i + 1}
                me={r.participantId === meId}
                hidden={r.masked || hidden.has(r.participantId)}
              />
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
                hidden={r.masked || hidden.has(r.participantId)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button
          type="button"
          className="quiet-btn"
          style={{ marginTop: 12 }}
          aria-expanded={all}
          onClick={() => setAll((a) => !a)}
        >
          {all ? "TOP 10 ONLY" : `WHOLE BOARD — ALL ${rows.length}`}
        </button>
      )}
    </div>
  );
}

/* One row of the period board; the signed-in rower's row wears the
 * finisher tint (tr.fin) so they can spot themselves. A hidden row keeps
 * its place and its name (the profile masks the same way, so the link is
 * safe) and draws blocks for the meters. */
function WeekTr({
  r,
  rank,
  me,
  hidden,
}: {
  r: WeeklyRow & Hideable;
  rank: number;
  me: boolean;
  hidden: boolean;
}) {
  return (
    <tr className={me ? "fin" : undefined}>
      <td className="rk">{rank}</td>
      <td>
        <Who row={r} />
      </td>
      <td className="num">
        {hidden ? (
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
