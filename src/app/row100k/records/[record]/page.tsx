import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ELITE_LABEL, digitCount, fmtPacificDay } from "@/lib/blackoutRules";
import {
  START_MS,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtSplit,
  nowMs as clockNow,
} from "@/lib/row100k";
import { barProps, maskedIds, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { BlockClock, Blocks } from "../../Blackout";
import { Who } from "../../Boards";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { boardView, EMPTY_BOARDS } from "../../boardData";
import { DIV_DEFS, RECORD_DEFS, divMatch, parseDiv, rankedRows, recordDef } from "../defs";

export const dynamic = "force-dynamic";

/* Full ranking for one record board — every place, not just the podium.
 * The record key is the URL segment; the division filter rides in ?d= as
 * plain links, so the whole page stays a server component.
 *
 * Blackout: the board is read as THIS viewer sees it (boardView), and a
 * rower in the masked set keeps their place and their name but draws
 * blocks for every record — meters (total, longest row, biggest day) as a
 * digit run, a pace time as its ▮▮:▮▮.▮ silhouette with no split beside it
 * (owner rule, 2026-09-05: a time over a known distance is the meters by
 * another route). Pure server markup, so the real value never leaves this
 * function for a hidden row. */

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

  const viewer = await resolveViewer();
  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  try {
    const view = await boardView(viewOpts(viewer));
    boards = view.boards;
    blackout = view.blackout;
  } catch (err) {
    console.error("row100k/records: failed to load board data", err);
  }
  // The one masked set (row100kViewer.maskedIds) — self and admins exempt.
  const hidden = maskedIds(boards);
  const until = blackout.endsAt ? ` UNTIL ${fmtPacificDay(blackout.endsAt).toUpperCase()}` : "";

  const started = clockNow() >= START_MS;
  const rows = rankedRows(boards, def.key).filter((r) => divMatch(div, r.row.division));
  const divWord = DIV_DEFS.find((d) => d.key === div)?.word ?? "everyone";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      {/* No tag next to the account chip — it crowds the bar on phones
          (owner call, cycle 4); the page heading says where you are. */}
      <RowBar {...barProps(viewer)} />

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

          {/* Same line the board prints; an admin sees nothing hidden and is
              told so. Every board hides the fifteen now, times included. */}
          {(blackout.active || hidden.size > 0) && (
            <p className="bo-note">
              {hidden.size > 0
                ? `BLACKOUT — ${ELITE_LABEL} ARE HIDDEN${until}`
                : `BLACKOUT ON${until} — YOU SEE EVERYTHING`}
            </p>
          )}

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
                        {/* Who is a client component (Boards.tsx), so every
                            prop it gets is serialized into the page source —
                            the whole RecordRow would put a hidden rower's
                            seconds and piece length in the HTML behind the
                            blocks (review, 2026-09-05). Hand it the name and
                            number only, the way the front page does. */}
                        <Who row={{ name: r.row.name, rowerNumber: r.row.rowerNumber }} />
                      </td>
                      <td className="num">
                        {def.kind === "time" ? (
                          hidden.has(r.row.participantId) ? (
                            /* The seconds stay on the server: only the
                               ▮▮:▮▮.▮ silhouette is rendered, no split. */
                            <BlockClock seconds={r.value} tenths />
                          ) : (
                            <>
                              {fmtRecordTime(r.value)}
                              {def.dist ? (
                                <span style={{ color: "var(--gray)" }}> · {fmtSplit(def.dist, r.value)} /500m</span>
                              ) : null}
                            </>
                          )
                        ) : hidden.has(r.row.participantId) ? (
                          /* Total rows carry their digit count from boardView;
                             the record rows still hold the real value here on
                             the server, so count it and print nothing else. */
                          <>
                            <Blocks digits={("digits" in r.row ? r.row.digits : undefined) ?? digitCount(r.value)} /> m
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
