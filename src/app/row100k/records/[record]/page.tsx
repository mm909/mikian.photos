import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ELITE_LABEL, digitCount, maskStandings, partialShape, type BlackoutPolicy } from "@/lib/blackoutRules";
import {
  MONTH,
  START_MS,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtSplit,
  nowMs as clockNow,
  pacificDay,
} from "@/lib/row100k";
import { monthsThrough, parsePeriod, periodOptions, type Period } from "@/lib/rowPeriod";
import { barProps, maskedIds, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { BlockShape, Blocks } from "../../Blackout";
import { Boards, Who, type Tab } from "../../Boards";
import { PeriodSelect } from "../../PeriodSelect";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { StatsShare } from "../../StatsShare";
import { BOARD_CARD_IDS } from "../../share/cards";
import { boardView, EMPTY_BOARDS } from "../../boardData";
import { DIV_DEFS, RECORD_DEFS, divMatch, parseDiv, rankedRows, recordDef, type DivKey, type RecordKey } from "../defs";
import { recordsCss } from "../recordsCss";

export const dynamic = "force-dynamic";

/* THE FULL RANKINGS — one record, every place, for any month or all time.
 *
 * The board page is retired (owner, 2026-09-24: "the board is reduced into
 * the records page: we don't need the board page anymore"): the TOTAL
 * METERS view here IS the board — Boards.tsx with its tiers (THE 100K
 * CLUB, ROWTEMBER ATHLETE, ROWTEMBER PARTICIPANT, LIGHTS OUT, .25M), the
 * up/down arrows, the progress bar toward 100K, the tags, and the rule
 * that keeps rows under 10k off the list. The other four records keep
 * their flat ranking. /row100k/board redirects here.
 *
 * The head is the month word alone (PeriodSelect.tsx; owner, 2026-09-24:
 * "remove the FULL RANKINGS · EVERYONE heading; above the record chips
 * show the time period we're looking at"), then the five categories as
 * one row of equal chips, then All / Men's / Women's. The record key is
 * the URL segment; the month rides in ?m= and the division in ?d=, both
 * as plain links, so the whole page stays a server component.
 *
 * Blackout: the board is read as THIS viewer sees it (boardView), and a
 * rower in the masked set keeps their place and their name but draws
 * blocks for every METERS record — total, longest row, biggest day — as a
 * digit run. Their TIMES are public (owner, 2026-09-08: fastest 5k and
 * 10k show regardless of the blackout), so the two pace boards print the
 * time and the split for everyone. Pure server markup, so a hidden meters
 * value never leaves this function. */

type Params = { record: string };
type Query = { d?: string; m?: string | string[] };

/* The page's own address for a record, division and month: no query for
 * All and for this month, so the plain URL stays the plain URL. */
function hrefFor(key: RecordKey, div: DivKey, period: Period): string {
  const q = new URLSearchParams();
  if (div !== "all") q.set("d", div);
  if (period.key !== MONTH.key) q.set("m", period.key);
  const s = q.toString();
  return `/row100k/records/${key}${s ? `?${s}` : ""}`;
}

export function generateMetadata({ params, searchParams }: { params: Params; searchParams?: Query }): Metadata {
  const def = recordDef(params.record);
  const period = parsePeriod(searchParams?.m, clockNow());
  return {
    title: def ? `${def.title} — ${period.label} — Rowtember` : "The records — Rowtember",
    description: "Full record rankings for the Rowtember challenge.",
  };
}

export default async function RecordRankingPage({ params, searchParams }: { params: Params; searchParams?: Query }) {
  const def = recordDef(params.record);
  if (!def) notFound();
  const div = parseDiv(searchParams?.d);

  /* WHICH MONTH (owner, 2026-09-24): this one unless ?m= says a past one
   * or all time. The same page, the same rankings, other rows. */
  const now = clockNow();
  const period = parsePeriod(searchParams?.m, now);
  const months = monthsThrough(now);
  const thisMonth = period.kind === "month" && period.key === MONTH.key;

  const viewer = await resolveViewer();
  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  let policy: BlackoutPolicy | undefined;
  try {
    const view = await boardView({ ...viewOpts(viewer), period });
    boards = view.boards;
    blackout = view.blackout;
    policy = view.policy;
  } catch (err) {
    console.error("row100k/records: failed to load board data", err);
  }
  // The one masked set (row100kViewer.maskedIds) — self and admins exempt.
  const hidden = maskedIds(boards);

  const started = now >= START_MS;
  const rows = rankedRows(boards, def.key).filter((r) => divMatch(div, r.row.division));

  /* The month word: the whole head. One month so far and it is plain
   * text, the way the board and stats heads did it. The division rides
   * along on every line of the menu. */
  const divQuery = div === "all" ? undefined : `d=${div}`;
  const monthWord =
    months.length > 1 ? (
      <PeriodSelect options={periodOptions(now)} value={period.key} base={`/row100k/records/${def.key}`} current={MONTH.key} query={divQuery} />
    ) : (
      MONTH.label
    );

  /* The board sticker (ten places to a card) shares the community card
   * plumbing, which wants per-day totals too; the curve carries cumulative
   * meters, so unroll it. `asOf` is the day the standings were read: today
   * in US-west wall clock, or a past month's last day. Brought over with
   * the board (owner, 2026-09-24). */
  const communityByDay: Record<string, number> = {};
  let prevCum = 0;
  for (const d of boards.daily) {
    communityByDay[d.day] = d.cum - prevCum;
    prevCum = d.cum;
  }
  const boardShare = {
    meters: boards.community.meters,
    rowers: boards.community.people,
    sessions: boards.community.sessions,
    byDay: communityByDay,
    daily: boards.daily,
    // The sticker leaves the site, so it is masked for EVERYONE while a
    // window is open — an admin sees the real board on screen but must not
    // be able to post it, and an elite rower does not get to share their
    // own number either (owner call: the numbers are not shareable to the
    // public). Idempotent on rows boardView already masked.
    standings: maskStandings(
      boards.total.map((r) => ({
        name: r.name,
        rowerNumber: r.rowerNumber,
        meters: r.meters,
        division: r.division,
        masked: r.masked,
        digits: r.digits,
        unranked: r.unranked,
      })),
      // The same policy the board above was masked with (boardView), so
      // the sticker hides exactly the rows the page did.
      { active: blackout.active, admin: false, policy },
    ),
    asOf: fmtDay(period.kind === "month" && !thisMonth ? period.lastDay : pacificDay(now)),
  };

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{recordsCss}</style>

      {/* The rankings are the stats page's tables in full, so STATS is the
          lit tab (there is no THE BOARD on the rail any more). */}
      <RowBar active="stats" {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="rec-head">
            <h1 className="rec-period">{monthWord}</h1>
          </div>

          {/* The five categories, the only five, centered and equal — like
              1-2-3-4-5 (owner, 2026-09-24). */}
          <nav className="tabs rec-tabs" aria-label="Record">
            {RECORD_DEFS.map((d) => (
              <a
                key={d.key}
                className={d.key === def.key ? "on" : undefined}
                aria-current={d.key === def.key ? "page" : undefined}
                href={hrefFor(d.key, div, period)}
              >
                {d.title}
              </a>
            ))}
          </nav>

          <nav className="tabs rec-div" aria-label="Division">
            {DIV_DEFS.map((d) => (
              <a
                key={d.key}
                className={d.key === div ? "on" : undefined}
                aria-current={d.key === div ? "page" : undefined}
                href={hrefFor(def.key, d.key, period)}
              >
                {d.label}
              </a>
            ))}
          </nav>

          {def.key === "total" ? (
            /* THE BOARD. Only the slices it reads: Boards is a client
             * component, so whatever is handed in is serialized into the
             * page source — and boardView masks only `total`; the record
             * boards still hold every elite rower's real seconds and
             * meters, which the board never prints (review, 2026-09-05).
             * The division is this page's ?d=, so the board draws no tabs
             * of its own; no head number (the stats page and the front
             * carry the community total). A finished month draws no
             * arrows: there is no last logged day it moved since. */
            <>
              <Boards
                boards={{ total: boards.total, community: boards.community }}
                started={started}
                blackout={blackout}
                head={false}
                tab={div.toUpperCase() as Tab}
                movement={thisMonth || period.kind === "all"}
                statsHref={thisMonth ? "/row100k/stats" : `/row100k/stats?m=${period.key}`}
              />
              {started && boards.total.length > 0 && (
                <StatsShare community={boardShare} prefer={BOARD_CARD_IDS[0]} only={BOARD_CARD_IDS} label="SHARE THE BOARD" />
              )}
            </>
          ) : (
            <>
              {/* Same line the board prints; an admin sees nothing hidden
                  and is told so. The meters boards hide the elite; a time
                  board says its times are shown. */}
              {(blackout.active || hidden.size > 0) && (
                <p className="bo-note">
                  {hidden.size > 0
                    ? `${ELITE_LABEL}${def.kind === "time" ? " · TIMES ARE SHOWN" : ""}`
                    : `${ELITE_LABEL} IS ON — YOU SEE EVERYTHING`}
                </p>
              )}

              {rows.length === 0 ? (
                <p className="board-empty">
                  {started ? "NOTHING ON THIS ONE YET." : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="board">
                    <thead>
                      <tr>
                        <th className="rk">#</th>
                        <th>Rower</th>
                        <th style={{ textAlign: "right" }}>{def.kind === "time" ? "Time" : "Meters"}</th>
                        <th style={{ textAlign: "right" }}>Day</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        /* The viewer's own row wears the tint the stats
                           boards use, so their place is findable on the
                           full list (owner, 2026-09-05: seeing where you
                           are matters). */
                        <tr key={r.row.participantId} className={r.row.participantId === viewer.myParticipantId ? "fin" : undefined}>
                          <td className="rk">{i + 1}</td>
                          <td>
                            {/* Who is a client component (Boards.tsx), so
                                every prop it gets is serialized into the
                                page source — the whole RecordRow would put
                                a hidden rower's seconds and piece length in
                                the HTML behind the blocks (review,
                                2026-09-05). Hand it the name and number
                                only, the way the front page does. */}
                            <Who row={{ name: r.row.name, rowerNumber: r.row.rowerNumber }} />
                          </td>
                          <td className="num">
                            {def.kind === "time" ? (
                              /* A time is public for everyone, the elite
                                 included (owner, 2026-09-08). */
                              <>
                                {fmtRecordTime(r.value)}
                                {def.dist ? <span style={{ color: "var(--gray)" }}> · {fmtSplit(def.dist, r.value)} /500m</span> : null}
                              </>
                            ) : hidden.has(r.row.participantId) ? (
                              /* The record rows still hold the real value
                                 here on the server, so count it and print
                                 nothing else. */
                              <>
                                <Blocks digits={("digits" in r.row ? r.row.digits : undefined) ?? digitCount(r.value)} /> m
                              </>
                            ) : "hideLow" in r.row && r.row.hideLow ? (
                              /* The run-up (blackoutRules.rampRow): the
                                 total is already rounded down to the
                                 digits still showing; the covered tail
                                 draws as blocks, the board's way. */
                              <>
                                <BlockShape shape={partialShape(r.value, r.row.hideLow, r.row.digits)} label="partly hidden" /> m
                              </>
                            ) : (
                              fmtMeters(r.value)
                            )}
                          </td>
                          <td className="num" style={{ color: "var(--gray)" }}>
                            {r.day ? fmtDay(r.day) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
