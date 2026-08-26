"use client";

import { useState } from "react";
import { Who } from "./Boards";
import {
  WEEKS,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  type Boards as BoardData,
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

/* The records grid + the weekly boards. One page-level division control —
 * ALL / MEN'S / WOMEN'S — drives every record card AND the weekly table
 * (ALL is one combined ranking across divisions). Each card shows the
 * podium and links out to its full ranking at /row100k/records/[key];
 * the total-meters standings themselves live on the home page. */

export function StatsBoards({
  boards,
  weekly,
  defaultWeek,
  started,
}: {
  boards: BoardData;
  weekly: WeeklyRow[][];
  defaultWeek: number;
  started: boolean;
}) {
  const [div, setDiv] = useState<DivKey>("all");
  const [week, setWeek] = useState(defaultWeek);

  const weekRows = (weekly[week] ?? []).filter((r) => divMatch(div, r.division));

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

      <div className="records">
        {RECORD_DEFS.map((def) => (
          <RecordCard key={def.key} def={def} boards={boards} div={div} started={started} />
        ))}
      </div>

      <div className="sec-head" style={{ marginTop: 52 }}>
        <h2>The weeks</h2>
        <span className="mono">METERS INSIDE EACH WEEK</span>
      </div>

      <div className="tabs" role="group" aria-label="Week">
        {WEEKS.map((w, i) => (
          <button
            key={w.key}
            aria-pressed={week === i}
            className={week === i ? "on" : undefined}
            onClick={() => setWeek(i)}
          >
            {w.label}
          </button>
        ))}
      </div>

      {weekRows.length === 0 ? (
        <p className="board-empty">
          {started
            ? "NOBODY ON THIS BOARD YET — BE FIRST."
            : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
        </p>
      ) : (
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
              {weekRows.map((r, i) => (
                <tr key={r.participantId}>
                  <td className="rk">{i + 1}</td>
                  <td>
                    <Who row={r} />
                  </td>
                  <td className="num">{fmtMeters(r.meters)}</td>
                  <td className="num" style={{ color: "var(--gray)" }}>
                    {r.sessions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* One record card: the podium (1st dominant, 2nd and 3rd small), linking to
 * the full ranking page for this record in the current division. */
function RecordCard({
  def,
  boards,
  div,
  started,
}: {
  def: RecordDef;
  boards: BoardData;
  div: DivKey;
  started: boolean;
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
    <a className="rec" href={`/row100k/records/${def.key}?d=${div}`}>
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
