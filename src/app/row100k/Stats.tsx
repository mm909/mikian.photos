"use client";

import { useState } from "react";
import { TAB_LABEL, TAB_WORD, Who, type Tab } from "./Boards";
import {
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  type Boards as BoardData,
  type RecordRow,
  type TotalRow,
} from "@/lib/row100k";

type Mode = "total" | "1000" | "5000" | "10000" | "longest" | "bigday";

/* The detailed records, in the order they matter: total meters first (it's
 * the whole challenge), then the pace records, then the volume one-offs.
 * Every card shows the men's AND women's leader at the same time; the tabs
 * only filter the full-list table underneath. */

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

const DIVISIONS = [
  { key: "M", label: "Men's" },
  { key: "F", label: "Women's" },
] as const;

export function StatsBoards({ boards, started }: { boards: BoardData; started: boolean }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [mode, setMode] = useState<Mode>("total");
  const match = (division: string) => tab === "ALL" || division === tab;

  const activeDef = RECORD_DEFS.find((d) => d.mode === mode);
  const modeRows = mode === "total" ? [] : recordRows(boards, mode).filter((r) => match(r.division));
  const total = boards.total.filter((r) => match(r.division));

  return (
    <div>
      {/* 1 — the one that matters */}
      <div className="rec-eyebrow">Total meters</div>
      <div className="records solo">
        <TotalDuoCard
          rows={boards.total}
          active={mode === "total"}
          onClick={() => setMode("total")}
          started={started}
        />
      </div>

      {/* 2 — how fast */}
      <div className="rec-eyebrow">The pace records</div>
      <div className="records">
        {RECORD_DEFS.filter((d) => d.kind === "time").map((d) => (
          <DuoRecordCard key={d.mode} def={d} boards={boards} mode={mode} setMode={setMode} started={started} />
        ))}
      </div>

      {/* 3 — the one-offs */}
      <div className="rec-eyebrow">The volume records</div>
      <div className="records vol">
        {RECORD_DEFS.filter((d) => d.kind === "meters").map((d) => (
          <DuoRecordCard key={d.mode} def={d} boards={boards} mode={mode} setMode={setMode} started={started} />
        ))}
      </div>

      <div className="tabs" style={{ marginTop: 30 }}>
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

      <div className="rec-eyebrow" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
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
                  <th style={{ textAlign: "right" }}>Meters</th>
                </tr>
              </thead>
              <tbody>
                {total.map((r, i) => (
                  <tr key={r.participantId}>
                    <td className="rk">{i + 1}</td>
                    <td>
                      <Who row={r} />
                    </td>
                    <td className="num">{fmtMeters(r.meters)}</td>
                  </tr>
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
    </div>
  );
}

/* One division's half of a duo card. */
function DuoSide({
  label,
  top,
  second,
  render,
  meta,
  hint,
}: {
  label: string;
  top: RecordRow | TotalRow | undefined;
  second: RecordRow | TotalRow | undefined;
  render: (r: RecordRow | TotalRow) => React.ReactNode;
  meta?: (r: RecordRow | TotalRow) => string;
  hint: string;
}) {
  return (
    <div className="side">
      <div className="dv">{label}</div>
      {top ? (
        <>
          <div className="v">{render(top)}</div>
          <div className="hold">
            {fmtRowerNumber(top.rowerNumber)} · {"name" in top ? top.name : ""}
          </div>
          {meta && <div className="meta">{meta(top)}</div>}
          {second && (
            <div className="also">
              <div>
                2. <b>{second.name}</b> — {render(second)}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="rec-empty">{hint}</p>
      )}
    </div>
  );
}

function TotalDuoCard({
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
  const hint = started ? "Every meter counts — log the first one." : "Claimed Sep 1 by whoever shows up.";
  return (
    <button type="button" className="rec headline" aria-pressed={active} onClick={onClick}>
      <div className="t">Total meters</div>
      <div className="duo">
        {DIVISIONS.map((d) => {
          const ranked = rows.filter((r) => r.division === d.key && r.meters > 0);
          return (
            <DuoSide
              key={d.key}
              label={d.label}
              top={ranked[0]}
              second={ranked[1]}
              render={(r) => (
                <>
                  {(r as TotalRow).meters.toLocaleString("en-US")} <em>m</em>
                </>
              )}
              meta={(r) => `${(r as TotalRow).sessions} sessions`}
              hint={hint}
            />
          );
        })}
      </div>
      <div className="rec-open">{active ? "▲ Standings below" : "▼ The standings"}</div>
    </button>
  );
}

function DuoRecordCard({
  def,
  boards,
  mode,
  setMode,
  started,
}: {
  def: (typeof RECORD_DEFS)[number];
  boards: BoardData;
  mode: Mode;
  setMode: (m: Mode) => void;
  started: boolean;
}) {
  const all = recordRows(boards, def.mode);
  const active = mode === def.mode;

  return (
    <button
      type="button"
      className="rec"
      aria-pressed={active}
      onClick={() => setMode(active ? "total" : def.mode)}
    >
      <div className="t">{def.title}</div>
      <div className="duo">
        {DIVISIONS.map((d) => {
          const rows = all.filter((r) => r.division === d.key);
          return (
            <DuoSide
              key={d.key}
              label={d.label}
              top={rows[0]}
              second={rows[1]}
              render={(r) =>
                def.kind === "time" ? (
                  fmtRecordTime((r as RecordRow).value)
                ) : (
                  <>
                    {Math.round((r as RecordRow).value).toLocaleString("en-US")} <em>m</em>
                  </>
                )
              }
              meta={(r) => {
                const rec = r as RecordRow;
                const bits = [fmtDay(rec.day)];
                if (def.kind === "time" && def.dist) bits.push(`${fmtSplit(def.dist, rec.value)} /500m`);
                if (rec.prorated && rec.meters) bits.push(`from ${fmtMeters(rec.meters)}`);
                return bits.join(" · ");
              }}
              hint={def.emptyHint(started)}
            />
          );
        })}
      </div>
      <div className="rec-open">{active ? "▲ Showing below" : "▼ Full list"}</div>
    </button>
  );
}
