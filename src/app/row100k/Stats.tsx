"use client";

import { Fragment, useState } from "react";
import { Who } from "./Boards";
import {
  WEEKS,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  nowMs,
  type Boards as BoardData,
  type Week,
  type WeeklyRow,
} from "@/lib/row100k";
import {
  DIV_DEFS,
  RECORD_DEFS,
  divMatch,
  rankedRows,
  type DivKey,
  type Ranked,
  type RecordDef,
} from "./records/defs";

/* The records + the weekly boards. One page-level division control —
 * ALL / MEN'S / WOMEN'S — drives every record card AND the weekly table
 * (ALL is one combined ranking across divisions). Total meters stands alone
 * as a full-width headline card; the other four records regroup under two
 * eyebrows — pace and distance (owner call, cycle 2: the flat grid is out,
 * total meters is dominant again). Each card shows the podium and links out
 * to its full ranking at /row100k/records/[key]; the total-meters standings
 * themselves live on the home page. */

const defOf = (key: RecordDef["key"]): RecordDef => RECORD_DEFS.find((d) => d.key === key)!;

const RECORD_GROUPS: { eyebrow: string; keys: RecordDef["key"][] }[] = [
  { eyebrow: "The pace records", keys: ["5000", "10000"] },
  { eyebrow: "The distance records", keys: ["longest", "bigday"] },
];

/* "Sep 15–21" (both ends via fmtDay; the month drops off the second end
 * when it repeats — all challenge weeks sit inside September). */
function weekDates(w: Week): string {
  return w.first.slice(0, 7) === w.last.slice(0, 7)
    ? `${fmtDay(w.first)}–${Number(w.last.slice(8, 10))}`
    : `${fmtDay(w.first)}–${fmtDay(w.last)}`;
}

export function StatsBoards({
  boards,
  weekly,
  daily,
  defaultWeek,
  defaultDay,
  started,
  meId,
}: {
  boards: BoardData;
  weekly: WeeklyRow[][];
  /* One board per September day, index = day-of-month − 1. */
  daily: WeeklyRow[][];
  defaultWeek: number;
  /* Today's index into `daily` (clamped into the challenge). */
  defaultDay: number;
  started: boolean;
  /* Signed-in rower's participant id (resolved server-side), or null. */
  meId: string | null;
}) {
  const [div, setDiv] = useState<DivKey>("all");
  const [week, setWeek] = useState(defaultWeek);
  const [day, setDay] = useState(defaultDay);

  /* Only weeks that have started get a chip — a week exists once its first
   * day arrives (same clock as the server's default-week pick). Before
   * Sep 1 that's nothing, so Week 1 stands in with the empty-state copy. */
  const today = new Date(nowMs()).toISOString().slice(0, 10);
  const startedWeeks = WEEKS.filter((w) => w.first <= today);
  const shownWeeks: Week[] = startedWeeks.length > 0 ? startedWeeks : [WEEKS[0]];
  const wk = Math.min(week, shownWeeks.length - 1);

  const weekRows = (weekly[wk] ?? []).filter((r) => divMatch(div, r.division));

  /* Days: 30 chips would swamp the row, so the picker is a stepper plus a
   * dropdown — defaults to today, steps or jumps to any day that has
   * started. (Owner call, cycle 7.) */
  const maxDay = Math.max(0, Math.min(defaultDay, daily.length - 1));
  const dy = Math.max(0, Math.min(day, maxDay));
  const dayLabel = (i: number) => fmtDay(`${WEEKS[0].first.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`);
  const dayRows = (daily[dy] ?? []).filter((r) => divMatch(div, r.division));

  return (
    <div>
      <div className="tabs" role="group" aria-label="Division">
        {DIV_DEFS.map((d) => (
          <button
            key={d.key}
            aria-pressed={div === d.key}
            className={div === d.key ? "on" : undefined}
            onClick={() => setDiv(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="records solo">
        <RecordCard def={defOf("total")} boards={boards} div={div} started={started} headline />
      </div>

      {RECORD_GROUPS.map((g) => (
        <Fragment key={g.eyebrow}>
          <div className="rec-eyebrow">{g.eyebrow}</div>
          <div className="records vol">
            {g.keys.map((k) => (
              <RecordCard key={k} def={defOf(k)} boards={boards} div={div} started={started} />
            ))}
          </div>
        </Fragment>
      ))}

      <div className="sec-head" style={{ marginTop: 52 }}>
        <h2>The weeks</h2>
        <span className="mono">METERS INSIDE EACH WEEK</span>
      </div>

      <div className="tabs" role="group" aria-label="Week">
        {shownWeeks.map((w, i) => (
          <button
            key={w.key}
            aria-pressed={wk === i}
            className={wk === i ? "on" : undefined}
            onClick={() => setWeek(i)}
          >
            {w.label} · {weekDates(w)}
          </button>
        ))}
      </div>

      <BoardWindow rows={weekRows} meId={meId} started={started} />

      <div className="sec-head" style={{ marginTop: 52 }}>
        <h2>The days</h2>
        <span className="mono">METERS INSIDE EACH DAY</span>
      </div>

      <div className="tabs" role="group" aria-label="Day">
        <button
          type="button"
          aria-label="Previous day"
          disabled={dy === 0}
          style={dy === 0 ? { opacity: 0.35, cursor: "default" } : undefined}
          onClick={() => setDay(Math.max(0, dy - 1))}
        >
          ‹
        </button>
        <select
          aria-label="Day"
          className="day-select"
          value={dy}
          onChange={(e) => setDay(Number(e.target.value))}
        >
          {Array.from({ length: maxDay + 1 }, (_, i) => (
            <option key={i} value={i}>
              {dayLabel(i)}
              {i === defaultDay ? " · today" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Next day"
          disabled={dy >= maxDay}
          style={dy >= maxDay ? { opacity: 0.35, cursor: "default" } : undefined}
          onClick={() => setDay(Math.min(maxDay, dy + 1))}
        >
          ›
        </button>
      </div>

      <BoardWindow rows={dayRows} meId={meId} started={started} />
    </div>
  );
}

/* Top 10 by default; a signed-in rower deeper on the board gets their
 * neighborhood — three above, themselves, three below — after a gap row.
 * Ranks stay global (their place on the whole board), and WHOLE BOARD
 * expands to every rower (owner call, cycle 8). Shared by the weekly and
 * daily boards. */
function BoardWindow({
  rows,
  meId,
  started,
}: {
  rows: WeeklyRow[];
  meId: string | null;
  started: boolean;
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
              <WeekTr key={r.participantId} r={r} rank={i + 1} me={r.participantId === meId} />
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

/* One row of the weekly board; the signed-in rower's row wears the
 * finisher tint (tr.fin) so they can spot themselves. */
function WeekTr({ r, rank, me }: { r: WeeklyRow; rank: number; me: boolean }) {
  return (
    <tr className={me ? "fin" : undefined}>
      <td className="rk">{rank}</td>
      <td>
        <Who row={r} />
      </td>
      <td className="num">{fmtMeters(r.meters)}</td>
      <td className="num" style={{ color: "var(--gray)" }}>
        {r.sessions}
      </td>
    </tr>
  );
}

/* One record card: the podium (1st dominant, 2nd and 3rd small), linking to
 * the full ranking page for this record in the current division. The total
 * meters card takes the headline treatment — full width, bigger digits. */
function RecordCard({
  def,
  boards,
  div,
  started,
  headline,
}: {
  def: RecordDef;
  boards: BoardData;
  div: DivKey;
  started: boolean;
  headline?: boolean;
}) {
  const rows = rankedRows(boards, def.key).filter((r) => divMatch(div, r.row.division));
  const [first, second, third] = rows;

  const val = (r: Ranked) =>
    def.kind === "time" ? (
      fmtRecordTime(r.value)
    ) : (
      <>
        {Math.round(r.value).toLocaleString("en-US")} <em>m</em>
      </>
    );

  const topMeta = first
    ? [
        first.day ? fmtDay(first.day) : null,
        def.kind === "time" && def.dist ? `${fmtSplit(def.dist, first.value)} /500m` : null,
        first.sessions != null ? `${first.sessions} sessions` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <a className={headline ? "rec headline" : "rec"} href={`/row100k/records/${def.key}?d=${div}`}>
      <div className="t">{def.title}</div>
      {first ? (
        <>
          <div className="v">{val(first)}</div>
          <div className="hold">
            {fmtRowerNumber(first.row.rowerNumber)} · {first.row.name}
          </div>
          {topMeta && <div className="meta">{topMeta}</div>}
          {(second || third) && (
            <div className="also">
              {second && (
                <div>
                  2. <b>{second.row.name}</b> — {val(second)}
                </div>
              )}
              {third && (
                <div>
                  3. <b>{third.row.name}</b> — {val(third)}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="rec-empty">{def.emptyHint(started)}</p>
      )}
      <div className="rec-open">Full ranking →</div>
    </a>
  );
}
