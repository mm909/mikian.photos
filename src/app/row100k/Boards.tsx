"use client";

import { useState } from "react";
import {
  GOAL_METERS,
  fmtMeters,
  fmtRowerNumber,
  type Boards as BoardData,
  type RecordRow,
  type TotalRow,
} from "@/lib/row100k";

export type Tab = "ALL" | "M" | "F";

export const TAB_LABEL: Record<Tab, string> = { ALL: "Everyone", M: "Men's", F: "Women's" };
export const TAB_WORD: Record<Tab, string> = { ALL: "everyone", M: "men", F: "women" };

/* Names link to the rower's profile page (their IG link lives there). */
export function Who({ row }: { row: TotalRow | RecordRow }) {
  return (
    <span className="who">
      <span style={{ color: "var(--gray)", fontFamily: "var(--row-mono), monospace", fontWeight: 400 }}>
        {fmtRowerNumber(row.rowerNumber)} ·{" "}
      </span>
      <a href={`/row100k/r/${row.rowerNumber}`}>{row.name}</a>
    </span>
  );
}

function Movement({ delta }: { delta: number }) {
  if (!delta) return null;
  return delta > 0 ? (
    <span className="mv up" title={`Up ${delta} since the last logged day`}>
      ▲{delta}
    </span>
  ) : (
    <span className="mv dn" title={`Down ${-delta} since the last logged day`}>
      ▼{-delta}
    </span>
  );
}

/* THE BOARD on the main page: the community strip and the standings — total
 * meters, the number the month is named after. Everything deeper (records,
 * the calendar, the curve) lives on /row100k/stats. */
export function Boards({ boards, started }: { boards: BoardData; started: boolean }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const total = boards.total.filter((r) => tab === "ALL" || r.division === tab);

  const fins = total.filter((r) => r.meters >= GOAL_METERS);
  const rest = total.filter((r) => r.meters < GOAL_METERS);

  return (
    <div>
      <div className="comm">
        <div className="c">
          <div className="n">{boards.community.meters.toLocaleString("en-US")}</div>
          <div className="l">meters combined</div>
        </div>
        <div className="c">
          <div className="n">{boards.community.people}</div>
          <div className="l">rowers in</div>
        </div>
        <div className="c">
          <div className="n">{boards.community.sessions}</div>
          <div className="l">sessions</div>
        </div>
        <div className="c">
          <div className="n">{boards.community.finished}</div>
          <div className="l">finished 100k</div>
        </div>
      </div>

      <div className="tabs">
        {(["ALL", "M", "F"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "on" : undefined}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {total.length === 0 ? (
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
                <th aria-label="Movement" />
                <th style={{ textAlign: "right" }}>Meters</th>
              </tr>
            </thead>
            <tbody>
              {fins.length > 0 && (
                <tr className="divrow">
                  <td colSpan={4}>The 100k club — finished</td>
                </tr>
              )}
              {fins.map((r, i) => (
                <TotalRowTr key={r.participantId} r={r} rank={i + 1} fin />
              ))}
              {fins.length > 0 && rest.length > 0 && (
                <tr className="divrow rest">
                  <td colSpan={4}>Still rowing</td>
                </tr>
              )}
              {rest.map((r, i) => (
                <TotalRowTr key={r.participantId} r={r} rank={fins.length + i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="board-links">
        <a className="big-act primary" href="/row100k/feed">
          The feed →
        </a>
        <a className="big-act" href="/row100k/stats">
          Records &amp; stats →
        </a>
      </div>
    </div>
  );
}

function TotalRowTr({ r, rank, fin }: { r: TotalRow; rank: number; fin?: boolean }) {
  return (
    <tr className={fin ? "fin" : undefined}>
      <td className="rk">{rank}</td>
      <td>
        <Who row={r} />
        {fin && <span className="donebadge">100K</span>}
      </td>
      <td>
        <Movement delta={r.delta} />
      </td>
      <td className="num">
        {fmtMeters(r.meters)}
        <div className="rowbar" aria-hidden="true">
          <div className="f" style={{ width: `${Math.min(100, r.pct)}%` }} />
        </div>
      </td>
    </tr>
  );
}
