"use client";

import { useState } from "react";
import { Curve } from "./Curve";
import {
  GOAL_METERS,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  type Boards as BoardData,
  type RecordRow,
  type TotalRow,
} from "@/lib/row100k";

type Tab = "ALL" | "M" | "F";
type Mode = "total" | "1000" | "5000" | "10000" | "longest" | "bigday";

const TAB_LABEL: Record<Tab, string> = { ALL: "Everyone", M: "Men's", F: "Women's" };
const TAB_WORD: Record<Tab, string> = { ALL: "everyone", M: "men", F: "women" };

/* Names link to the rower's profile page (their IG link lives there). */
function Who({ row }: { row: TotalRow | RecordRow }) {
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

const RECORD_DEFS: {
  mode: Mode;
  title: string;
  kind: "time" | "meters";
  dist?: number;
  emptyHint: (started: boolean) => string;
}[] = [
  { mode: "1000", title: "Fastest 1k", kind: "time", dist: 1000, emptyHint: (s) => (s ? "Log a 1,000m piece to claim this." : "Claimed Sep 1 by whoever shows up.") },
  { mode: "5000", title: "Fastest 5k", kind: "time", dist: 5000, emptyHint: (s) => (s ? "Log a 5,000m piece to claim this." : "Claimed Sep 1 by whoever shows up.") },
  { mode: "10000", title: "Fastest 10k", kind: "time", dist: 10000, emptyHint: (s) => (s ? "Log a 10,000m piece to claim this." : "Claimed Sep 1 by whoever shows up.") },
  { mode: "longest", title: "Longest row", kind: "meters", emptyHint: () => "One sitting, most meters." },
  { mode: "bigday", title: "Biggest day", kind: "meters", emptyHint: () => "Most meters inside one calendar day." },
];

function recordRows(boards: BoardData, mode: Mode): RecordRow[] {
  if (mode === "1000" || mode === "5000" || mode === "10000") {
    return boards.fastest[Number(mode) as 1000 | 5000 | 10000];
  }
  if (mode === "longest") return boards.longest;
  if (mode === "bigday") return boards.bigDay;
  return [];
}

/* All the leaderboards. One table, re-filtered: the record cards above it
 * are selectors — click one and the table shows that record's full list;
 * click it again (or "back to meters") for the distance standings. */
export function Boards({ boards, started }: { boards: BoardData; started: boolean }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [mode, setMode] = useState<Mode>("total");
  const match = (division: string) => tab === "ALL" || division === tab;

  const total = boards.total.filter((r) => match(r.division));
  const activeDef = RECORD_DEFS.find((d) => d.mode === mode);
  const modeRows = mode === "total" ? [] : recordRows(boards, mode).filter((r) => match(r.division));

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

      <div className="rec-eyebrow">The pace records — click one for the full list</div>
      <div className="records">
        {RECORD_DEFS.filter((d) => d.kind === "time").map((d) => (
          <RecordCard key={d.mode} def={d} boards={boards} tab={tab} mode={mode} setMode={setMode} started={started} />
        ))}
      </div>
      <div className="rec-eyebrow">The volume records</div>
      <div className="records">
        <TotalCard rows={total} active={mode === "total"} onClick={() => setMode("total")} started={started} />
        {RECORD_DEFS.filter((d) => d.kind === "meters").map((d) => (
          <RecordCard key={d.mode} def={d} boards={boards} tab={tab} mode={mode} setMode={setMode} started={started} />
        ))}
      </div>

      <div className="rec-eyebrow" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span>
          {mode === "total"
            ? `The standings — total meters, ${TAB_WORD[tab]}`
            : `${activeDef?.title} — full list, ${TAB_WORD[tab]}`}
        </span>
        {mode !== "total" && (
          <button type="button" className="quiet-btn" style={{ color: "var(--water)" }} onClick={() => setMode("total")}>
            ← BACK TO METERS
          </button>
        )}
      </div>

      {mode === "total" ? (
        total.length === 0 ? (
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
        )
      ) : modeRows.length === 0 ? (
        <p className="board-empty">NOTHING ON THIS ONE YET.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <th className="rk">#</th>
                <th>Rower</th>
                <th style={{ textAlign: "right" }}>{activeDef?.kind === "time" ? "Time" : "Meters"}</th>
                <th style={{ textAlign: "right" }}>Day</th>
              </tr>
            </thead>
            <tbody>
              {modeRows.map((r, i) => (
                <tr key={r.participantId}>
                  <td className="rk">{i + 1}</td>
                  <td>
                    <Who row={r} />
                  </td>
                  <td className="num">
                    {activeDef?.kind === "time" ? (
                      <>
                        {fmtRecordTime(r.value)}
                        {activeDef?.dist ? (
                          <span style={{ color: "var(--gray)" }}> · {fmtSplit(activeDef.dist, r.value)} /500m</span>
                        ) : null}
                      </>
                    ) : (
                      fmtMeters(r.value)
                    )}
                  </td>
                  <td className="num" style={{ color: "var(--gray)" }}>
                    {fmtDay(r.day)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Curve daily={boards.daily} title="The curve — cumulative meters, everyone combined" />
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

/* The distance leader as a record card — clicking it brings the table back
 * to the standings (which are the "full list" for this one). */
function TotalCard({
  rows,
  active,
  onClick,
  started,
}: {
  rows: TotalRow[];
  active: boolean;
  onClick: () => void;
  started: boolean;
}) {
  const ranked = rows.filter((r) => r.meters > 0);
  const top = ranked[0];
  const also = ranked.slice(1, 3);

  return (
    <button type="button" className="rec" aria-pressed={active} onClick={onClick}>
      <div className="t">Total meters</div>
      {top ? (
        <>
          <div className="v">
            {top.meters.toLocaleString("en-US")} <em>m</em>
          </div>
          <div className="hold">
            {fmtRowerNumber(top.rowerNumber)} · {top.name}
          </div>
          <div className="meta">
            {top.sessions} sessions · {top.days} {top.days === 1 ? "day" : "days"}
          </div>
          {also.length > 0 && (
            <div className="also">
              {also.map((r, i) => (
                <div key={r.participantId}>
                  {i + 2}. <b>{r.name}</b> — {fmtMeters(r.meters)}
                </div>
              ))}
            </div>
          )}
          <div className="rec-open">{active ? "▲ Showing below" : "▼ The standings"}</div>
        </>
      ) : (
        <p className="rec-empty">
          {started ? "Every meter counts — log the first one." : "Claimed Sep 1 by whoever shows up."}
        </p>
      )}
    </button>
  );
}

function RecordCard({
  def,
  boards,
  tab,
  mode,
  setMode,
  started,
}: {
  def: (typeof RECORD_DEFS)[number];
  boards: BoardData;
  tab: Tab;
  mode: Mode;
  setMode: (m: Mode) => void;
  started: boolean;
}) {
  const rows = recordRows(boards, def.mode).filter((r) => tab === "ALL" || r.division === tab);
  const top = rows[0];
  const also = rows.slice(1, 3);
  const active = mode === def.mode;

  return (
    <button
      type="button"
      className="rec"
      aria-pressed={active}
      onClick={() => setMode(active ? "total" : def.mode)}
    >
      <div className="t">{def.title}</div>
      {top ? (
        <>
          <div className="v">
            {def.kind === "time" ? (
              fmtRecordTime(top.value)
            ) : (
              <>
                {Math.round(top.value).toLocaleString("en-US")} <em>m</em>
              </>
            )}
          </div>
          <div className="hold">
            {fmtRowerNumber(top.rowerNumber)} · {top.name}
          </div>
          <div className="meta">
            {fmtDay(top.day)}
            {def.kind === "time" && def.dist ? ` · ${fmtSplit(def.dist, top.value)} /500m` : ""}
            {top.prorated && top.meters ? ` · out of a ${fmtMeters(top.meters)} row` : ""}
          </div>
          {also.length > 0 && (
            <div className="also">
              {also.map((r, i) => (
                <div key={r.participantId}>
                  {i + 2}. <b>{r.name}</b> — {def.kind === "time" ? fmtRecordTime(r.value) : fmtMeters(r.value)}
                </div>
              ))}
            </div>
          )}
          <div className="rec-open">{active ? "▲ Showing below" : "▼ Full list"}</div>
        </>
      ) : (
        <p className="rec-empty">{def.emptyHint(started)}</p>
      )}
    </button>
  );
}
