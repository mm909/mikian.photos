import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  START_MS,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtSplit,
  nowMs as clockNow,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { Who } from "../../Boards";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { boardData, EMPTY_BOARDS } from "../../boardData";
import { DIV_DEFS, RECORD_DEFS, divMatch, parseDiv, rankedRows, recordDef } from "../defs";

export const dynamic = "force-dynamic";

/* Full ranking for one record board — every place, not just the podium.
 * The record key is the URL segment; the division filter rides in ?d= as
 * plain links, so the whole page stays a server component. */

type Params = { record: string };

export function generateMetadata({ params }: { params: Params }): Metadata {
  const def = recordDef(params.record);
  return {
    title: def ? `${def.title} — full ranking — 100K September` : "The records — 100K September",
    description: "Full record rankings for the Rowtember challenge.",
  };
}

export default async function RecordRankingPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: { d?: string };
}) {
  const def = recordDef(params.record);
  if (!def) notFound();
  const div = parseDiv(searchParams?.d);

  let boards = EMPTY_BOARDS;
  try {
    boards = await boardData();
  } catch (err) {
    console.error("row100k/records: failed to load board data", err);
  }

  const started = clockNow() >= START_MS;
  const rows = rankedRows(boards, def.key).filter((r) => divMatch(div, r.row.division));
  const divWord = DIV_DEFS.find((d) => d.key === div)?.word ?? "everyone";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar>
        <span className="mono tag">FULL RANKING</span>
      </RowBar>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>{def.title}</h2>
            <span className="mono">FULL RANKING, {divWord.toUpperCase()}</span>
          </div>

          <nav className="tabs" aria-label="Record">
            {RECORD_DEFS.map((d) => (
              <a
                key={d.key}
                className={d.key === def.key ? "on" : undefined}
                aria-current={d.key === def.key ? "page" : undefined}
                href={`/row100k/records/${d.key}?d=${div}`}
              >
                {d.title}
              </a>
            ))}
          </nav>

          <nav className="tabs" aria-label="Division">
            {DIV_DEFS.map((d) => (
              <a
                key={d.key}
                className={d.key === div ? "on" : undefined}
                aria-current={d.key === div ? "page" : undefined}
                href={`/row100k/records/${def.key}?d=${d.key}`}
              >
                {d.label}
              </a>
            ))}
          </nav>

          {rows.length === 0 ? (
            <p className="board-empty">
              {started
                ? "NOTHING ON THIS ONE YET."
                : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="board">
                <thead>
                  <tr>
                    <th className="rk">#</th>
                    <th>Rower</th>
                    <th style={{ textAlign: "right" }}>{def.kind === "time" ? "Time" : "Meters"}</th>
                    <th style={{ textAlign: "right" }}>{def.key === "total" ? "Sessions" : "Day"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.row.participantId}>
                      <td className="rk">{i + 1}</td>
                      <td>
                        <Who row={r.row} />
                      </td>
                      <td className="num">
                        {def.kind === "time" ? (
                          <>
                            {fmtRecordTime(r.value)}
                            {def.dist ? (
                              <span style={{ color: "var(--gray)" }}> · {fmtSplit(def.dist, r.value)} /500m</span>
                            ) : null}
                          </>
                        ) : (
                          fmtMeters(r.value)
                        )}
                      </td>
                      <td className="num" style={{ color: "var(--gray)" }}>
                        {def.key === "total" ? r.sessions : r.day ? fmtDay(r.day) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
