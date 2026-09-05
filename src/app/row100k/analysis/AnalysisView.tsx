"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { fmtRowerNumber } from "@/lib/row100k";
import type { Model, Section, Tile } from "./model";
import { fmtInt } from "./fmt";
import {
  ChartBox,
  DaysSvg,
  DriftSvg,
  DurSvg,
  EcdfSvg,
  FanSvg,
  GrindSvg,
  HistSvg,
  HoursSvg,
  KdeSvg,
  LadderSvg,
  PaceSvg,
  ResidSvg,
} from "./charts";

/* The page body. The only state on the page is the EVERYONE | YOU chip:
 * both datasets arrive precomputed from the server (the YOU one holds the
 * viewer's own marks and nothing else), so flipping the chip is a re-render
 * of the same JSON with the blue layer on or off — no fetch, no flicker.
 * Signed-out and not-joined visitors get the same field with no chip. */

export type ViewerKind = "anon" | "unjoined" | "empty" | "ready";

export function AnalysisView({ model: m, viewer, initialYou }: { model: Model; viewer: ViewerKind; initialYou: boolean }) {
  const [on, setOn] = useState(initialYou && viewer === "ready");
  const you = on && viewer === "ready";

  return (
    <>
      <div className="wrap an-mast">
        <div className="an-eyebrow">ROWTEMBER 2026 · THE NUMBERS · DAY {m.day} OF 30</div>
        <h1>
          By the <span className="o">numbers</span>
        </h1>
        <p className="sub">
          {m.sessions
            ? `${fmtInt(m.sessions)} sessions from ${fmtInt(m.rowers)} rowers, as distributions: the spread, the standard deviations, what correlates with what. The field is grey and nobody in it is named. Sign in and the blue is you — only you.`
            : "Nothing logged yet. The distributions draw themselves as the first rows land."}
        </p>
        <div className="an-pill">
          {viewer === "ready" ? (
            <div className="tabs">
              <button type="button" className={you ? "" : "on"} aria-pressed={!you} onClick={() => setOn(false)}>
                Everyone
              </button>
              <button type="button" className={you ? "on" : ""} aria-pressed={you} onClick={() => setOn(true)}>
                You
              </button>
            </div>
          ) : viewer === "empty" ? (
            <a className="hint" href="/row100k">
              Log a row to see yours →
            </a>
          ) : viewer === "unjoined" ? (
            <a className="hint" href="/row100k#join">
              Join the challenge to overlay yours →
            </a>
          ) : (
            <button type="button" className="hint" onClick={() => signIn("google", { callbackUrl: "/row100k/analysis?you=1" })}>
              Sign in to overlay yours →
            </button>
          )}
          {you && m.you ? (
            <span className="an-who">
              ROWER {fmtRowerNumber(m.you.rowerNumber)} · {m.you.sessions} {m.you.sessions === 1 ? "SESSION" : "SESSIONS"} IN BLUE
            </span>
          ) : null}
        </div>
      </div>

      <Sec s={m.s1} you={you}>
        {m.hist ? (
          <ChartBox title="Session distance — meters per session, every row" take={m.hist.take}>
            <HistSvg c={m.hist} you={you ? m.histYou : null} />
          </ChartBox>
        ) : (
          <Empty />
        )}
        {m.kde ? (
          <ChartBox title="Split per 500 m — kernel density, faster to the left" take={m.kde.take}>
            <KdeSvg c={m.kde} you={you ? m.kdeYou : null} />
          </ChartBox>
        ) : null}
      </Sec>

      <Sec s={m.s2} you={you}>
        {m.dur ? (
          <ChartBox title="Meters vs time — every session, the line in ink" take={m.dur.take}>
            <DurSvg c={m.dur} you={you ? m.durYou : null} />
          </ChartBox>
        ) : null}
        {m.pace ? (
          <ChartBox title="Split vs distance — every session, log scale, faster up" take={m.pace.take}>
            <PaceSvg c={m.pace} you={you ? m.paceYou : null} />
          </ChartBox>
        ) : (
          <Empty />
        )}
        {m.resid ? (
          <ChartBox title="Who rows harder than their distance predicts — residual per session" take={m.resid.take}>
            <ResidSvg c={m.resid} you={you ? m.residYou : null} />
          </ChartBox>
        ) : null}
      </Sec>

      <Sec s={m.s3} you={you}>
        {m.ecdf ? (
          <ChartBox
            title="Where every total lands — share of rowers at or below, log scale"
            take={m.ecdf.take}
            footYou={you ? m.ecdfYou?.sub : null}
          >
            <EcdfSvg c={m.ecdf} you={you ? m.ecdfYou : null} />
          </ChartBox>
        ) : (
          <Empty what="eight rowers with three sessions" />
        )}
        {m.grind ? (
          <ChartBox title="Grinders vs long-haulers — sessions against mean session length, one dot per rower" take={m.grind.take}>
            <GrindSvg c={m.grind} you={you ? m.grindYou : null} />
          </ChartBox>
        ) : null}
      </Sec>

      <Sec s={m.s4} you={you}>
        {m.hour ? (
          <ChartBox title="Hour of the day — sessions per hour logged, Pacific" take={m.hour.take} foot="TIME THE ROW WAS LOGGED, NOT NECESSARILY ROWED · BARS UNDER FIVE ARE DASHED">
            <HoursSvg c={m.hour} you={you ? m.hourYou : null} />
          </ChartBox>
        ) : (
          <Empty />
        )}
        {m.dayc ? (
          <ChartBox title="Sessions per day — weekends shaded, seven-day rolling mean" take={m.dayc.take}>
            <DaysSvg c={m.dayc} you={you ? m.daycYou : null} />
          </ChartBox>
        ) : null}
      </Sec>

      <Sec s={m.s5} you={you}>
        {m.drift ? (
          <ChartBox title="Effort drift — each session against the rower's own average, faster up" take={m.drift.take}>
            <DriftSvg c={m.drift} you={you ? m.driftYou : null} />
          </ChartBox>
        ) : (
          <Empty what="rowers with four sessions" />
        )}
      </Sec>

      <Sec s={m.s6} you={you} tiles={you && m.s6You ? m.s6You : undefined}>
        {m.ladder ? (
          <ChartBox title="Percentile ladder — six ranks, median tick on every strip" take={m.ladder.take} footYou={you ? m.ladderYou?.note : null}>
            <LadderSvg c={m.ladder} you={you ? m.ladderYou : null} />
          </ChartBox>
        ) : (
          <Empty what="eight rowers with three sessions" />
        )}
        {m.fan ? (
          <ChartBox
            title="Cumulative meters — P10–P90 and P25–P75 bands, median in ink"
            take={m.fan.take}
            foot={you && m.fanYou?.proj ? "PROJECTION = CURRENT RATE × DAYS LEFT — THE ONE LINE ON THIS PAGE DRAWN INTO THE FUTURE" : null}
          >
            <FanSvg c={m.fan} you={you ? m.fanYou : null} />
          </ChartBox>
        ) : null}
        <p className="an-note">
          Percentiles read ahead-of: P73 means ahead of 73 % of rowers with three or more sessions on that metric, in the
          division where one is shown. Nobody else&rsquo;s individual numbers are on this page — bins under five sessions are
          dashed, division figures need eight rowers and thirty sessions, residuals stop at ±30 s, and{" "}
          {m.hideTop > 3
            ? `the top ${m.hideTop} totals stay on the leaderboard only while the blackout is on`
            : "the top three totals stay on the leaderboard only"}
          .
        </p>
      </Sec>
    </>
  );
}

function Sec({ s, you, tiles, children }: { s: Section; you: boolean; tiles?: Tile[]; children: React.ReactNode }) {
  const list = tiles ?? s.tiles;
  return (
    <section>
      <div className="wrap">
        <div className="sec-head">
          <h2>{s.title}</h2>
          <span className="mono">{s.eyebrow}</span>
        </div>
        <div className="an-tiles">
          {list.map((t, i) => (
            <div className="an-tile" key={i}>
              <div className="n">{t.n}</div>
              <div className="d">{t.d}</div>
              {you && t.you ? <div className="y">{t.you}</div> : null}
            </div>
          ))}
        </div>
        {children}
      </div>
    </section>
  );
}

function Empty({ what = "a handful of sessions" }: { what?: string }) {
  return <p className="an-empty">Not enough rows to draw this yet — it needs {what}.</p>;
}
