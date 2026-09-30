import type { CSSProperties } from "react";
import { GOAL_METERS, MONTH, MONTH_DAYS, MONTH_WORD, fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { nextMonth } from "@/lib/rowPeriod";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { paceCss } from "../r/[num]/looks/paceCss";
import { PaceCurve } from "../r/[num]/looks/PaceCurve";
import { Heatmap } from "../Heatmap";
import { OptIn } from "../OptIn";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { LandingCards } from "../landing/LandingCards";
import type { LandingData, LandingExample } from "../landing/data";
import { l1Css } from "./l1Css";
import { loadL1, type L1Rung } from "./l1Data";

/* LANDING 1 — THE DARE (owner brief, 2026-09-30: the landing has to turn
 * someone who tapped a link on Instagram into a rower; the month's goal is
 * the 100K, the tracking is the second reason, OPT IN is the one action,
 * and the fold is its own look with the detail under it).
 *
 * THE FOLD IS A POSTER, in ink: one sentence, each line fitted flush to the
 * measure so it is as large as the phone allows, then OPT IN where a thumb
 * lands and one mono line of facts. No number of anybody's, no board.
 * Under it the page turns to cream and answers in order: how a meter
 * counts, the rungs on the way, what a rower gets, the month so far — and
 * then closes in ink on OPT IN again, with the number the next rower gets.
 *
 * It wears theme.ts .chrome-ink, so the bar and the footer are ink and
 * belong to the two ink ends of the page; the bar is NOT sticky here, so it
 * leaves with the poster and never hangs black over the cream. */

/* OPT IN goes to the Rowtember sign-in and lands back on the front page at
 * #join (the same place the front page OPT IN sends a stranger). */
const SIGN_IN = "/row100k/sign-in?callbackUrl=%2Frow100k%23join";

/* ARCHIVO BLACK, as a share of the em — the advances and every kerned pair
 * of the face the page loads, the same measurement raceday/page.tsx fits
 * its bill with (kept in step by hand: that table is private to its page).
 * A server page has no measuring context, so each display line is given
 * its width in ems here and CSS sizes it calc(100cqw / var(--k)). */
const ADV: Record<string, number> = {
  A: 0.778, B: 0.778, C: 0.778, D: 0.778, E: 0.722, F: 0.667, G: 0.833,
  H: 0.833, I: 0.389, J: 0.667, K: 0.833, L: 0.667, M: 0.944, N: 0.833,
  O: 0.833, P: 0.722, Q: 0.833, R: 0.778, S: 0.722, T: 0.722, U: 0.833,
  V: 0.778, W: 1, X: 0.778, Y: 0.778, Z: 0.722,
  /* The space is wider than the bill has it: fitted here with one and two
   * of them in a line and read off the screenshot, .333 ran the ink 17px
   * past a 1000px measure. */
  " ": 0.43, ",": 0.333, ".": 0.333,
};
const DIGIT = 0.667;
const KERN: Record<string, number> = {
  AC: -0.018, AG: -0.018, AO: -0.018, AQ: -0.019, AT: -0.069, AU: -0.034,
  AV: -0.055, AW: 0.008, AY: -0.085, BA: -0.017, BU: -0.026, "B,": 0.025,
  "B.": 0.016, "C,": 0.025, "C.": 0.017, DA: -0.043, DV: -0.034, DW: 0.017,
  DY: -0.034, "D,": -0.01, "D.": -0.017, FA: -0.094, "F,": -0.146,
  "F.": -0.153, "G,": 0.016, "G.": 0.01, JA: -0.026, "J,": -0.018,
  "J.": -0.026, KC: -0.034, KG: -0.034, KO: -0.034, LC: -0.017, LG: -0.017,
  LO: -0.017, LT: -0.051, LU: -0.026, LV: -0.051, LW: -0.017, LY: -0.077,
  NA: -0.01, OA: -0.034, OT: -0.026, OV: -0.043, OW: -0.017, OX: -0.052,
  OY: -0.068, "O,": -0.017, "O.": -0.026, PA: -0.085, "P,": -0.18,
  "P.": -0.188, QA: 0.017, QT: -0.018, QV: -0.043, QY: -0.051, "Q,": 0.033,
  "Q.": 0.017, RC: -0.018, RG: -0.018, RO: -0.017, RQ: -0.02, RT: -0.009,
  RU: -0.017, RV: -0.017, RY: -0.043, TA: -0.068, TC: -0.034, TG: -0.034,
  TO: -0.034, TQ: -0.034, "T,": -0.146, "T.": -0.153, UA: -0.034,
  "U,": -0.026, "U.": -0.034, VA: -0.057, VC: -0.034, VG: -0.034,
  VO: -0.034, VQ: -0.034, "V,": -0.12, "V.": -0.128, WC: -0.017,
  WG: -0.017, WO: -0.017, "W,": -0.043, "W.": -0.052, XC: -0.034,
  XG: -0.034, XO: -0.034, YA: -0.094, YC: -0.06, YG: -0.06, YO: -0.06,
  YS: -0.043, "Y,": -0.162, "Y.": -0.17,
};
/* The display lines are tracked at -.02em (l1Css.ts .l1-dare, .l1-total).
 * Counted on the gaps, not the glyphs: CSS tracks after the last character
 * too, and it is the ink that has to reach the edge. */
const TRACK = 0.02;

function fitK(text: string): number {
  const s = text.toUpperCase();
  let em = 0;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    em += ch >= "0" && ch <= "9" ? DIGIT : (ADV[ch] ?? ADV.A);
    if (i > 0) em += KERN[s[i - 1] + ch] ?? 0;
  }
  return Math.max(0.5, em - Math.max(0, s.length - 1) * TRACK);
}

const k = (n: number): CSSProperties => ({ "--k": n.toFixed(3) }) as CSSProperties;
const kl = (n: number): CSSProperties => ({ "--kl": n.toFixed(3) }) as CSSProperties;

const num = (n: number) => n.toLocaleString("en-US");

function Opt() {
  return (
    <div className="l1-go">
      <OptIn href={SIGN_IN}>Opt in</OptIn>
    </div>
  );
}

function Facts() {
  return <p className="l1-facts mono">Free · Any erg · A minute to join</p>;
}

/* THE POSTER. Four lines on a phone, each its own size so each ends on the
 * measure; two lines from 900px, where four would be taller than a laptop.
 * The month line never outgrows the line above it (MAY is a short word). */
function Dare() {
  const goal = num(GOAL_METERS);
  const row = "Row";
  const meters = "Meters";
  const month = `in ${MONTH_WORD}`;
  const lineA = `${row} ${goal}`;
  const lineB = `${meters} ${month}`;
  return (
    <h1 className="l1-dare" aria-label={`Row ${goal} meters in ${MONTH_WORD}`}>
      <span className="l1-ln" style={kl(fitK(lineA))} aria-hidden="true">
        <span className="l1-w" style={k(fitK(row))}>
          {row}
        </span>{" "}
        <span className="l1-w" style={k(fitK(goal))}>
          {goal}
        </span>
      </span>{" "}
      <span className="l1-ln" style={kl(Math.max(fitK(lineB), fitK(lineA)))} aria-hidden="true">
        <span className="l1-w" style={k(fitK(meters))}>
          {meters}
        </span>{" "}
        <span className="l1-w" style={k(Math.max(fitK(month), fitK(meters)))}>
          {month}
        </span>
      </span>
    </h1>
  );
}

function Head({ label, note }: { label: string; note?: string }) {
  return (
    <h2 className="l1-h">
      {label}
      {note ? <span>{note}</span> : null}
    </h2>
  );
}

/* HOW IT COUNTS: three verbs, a fact under each. */
function Steps() {
  const steps = [
    { h: "Row", p: "Any erg, any gym, any distance." },
    { h: "Log it", p: "Meters, time and two photos of the monitor." },
    { h: "It counts", p: "On your page and on the board, the minute you log it." },
  ];
  return (
    <ol className="l1-steps">
      {steps.map((s, i) => (
        <li key={s.h}>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <h3>{s.h}</h3>
            <p>{s.p}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* THE RUNGS, top rung on top, the way a ladder stands: the distance, what
 * the board calls it, how many rowers are on or past it this month (the
 * bar is that count against every rower on the board), and the same count
 * for the month that closed. The 100K rung is the one in water, with what
 * it asks of a day from today. */
function Ladder({
  rungs,
  active,
  prevWord,
  perDay,
  minutes,
  daysLeft,
}: {
  rungs: L1Rung[];
  active: number;
  prevWord: string | null;
  perDay: number;
  minutes: number | null;
  daysLeft: number;
}) {
  const top = [...rungs].reverse();
  return (
    <ol className="l1-ladder" reversed>
      {top.map((r) => {
        const goal = r.meters === GOAL_METERS;
        const share = active > 0 ? Math.min(100, (r.now / active) * 100) : 0;
        return (
          <li key={r.key} className={goal ? "l1-rung goal" : "l1-rung"}>
            <div className="top">
              <span className="m">
                {num(r.meters)} <em>m</em>
              </span>
              <span className="c">{num(r.now)}</span>
            </div>
            <div className="sub">
              <span>{r.title ?? ""}</span>
              <span>
                {r.prev !== null && prevWord ? `${num(r.prev)} in ${prevWord}` : r.now === 1 ? "rower" : "rowers"}
              </span>
            </div>
            <div className="fill">
              <i style={{ width: `${share.toFixed(1)}%` }} />
            </div>
            {goal ? (
              <p className="day">
                {daysLeft} {daysLeft === 1 ? "day" : "days"} left · {num(perDay)} m a day
                {minutes ? ` · about ${num(minutes)} min` : ""}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* WHAT YOU GET: four things off one real rower's month — the calendar, the
 * split line, the bests, the cards the share dialog draws for a story. */
function Get({ eg, today }: { eg: LandingExample; today: number }) {
  return (
    <>
      <p className="l1-eg mono">
        This is <b>{fmtRowerNumber(eg.rowerNumber)}</b> · <a href={`/row100k/r/${eg.rowerNumber}`}>{eg.name}</a> ·{" "}
        {fmtMeters(eg.meters)} in {eg.sessions} rows
      </p>
      <div className="l1-get">
        <figure className="l1-fig">
          <figcaption>
            <b>A</b> The month, day by day
          </figcaption>
          <Heatmap byDay={eg.byDay} days={today} fullMonth />
        </figure>
        <figure className="l1-fig">
          <figcaption>
            <b>B</b> Your average split, meter by meter
          </figcaption>
          <PaceCurve pts={eg.paceCurve} dots={eg.paceDots} />
        </figure>
        <figure className="l1-fig">
          <figcaption>
            <b>C</b> Your bests
          </figcaption>
          <div className="l1-bests">
            {eg.bests.map((b) => (
              <div className="l1-best" key={b.key}>
                <div className="k">{b.label}</div>
                <div className="v">{b.value}</div>
                <div className="s">{b.sub}</div>
              </div>
            ))}
          </div>
        </figure>
        <figure className="l1-fig">
          <figcaption>
            <b>D</b> The cards you post
          </figcaption>
          <LandingCards data={eg.share} />
        </figure>
      </div>
    </>
  );
}

/* The same four, in words, for the day the example rower has no meters yet
 * (the 1st) or is hidden by a blackout. */
function GetWords() {
  return (
    <ol className="l1-steps">
      {[
        { h: "The month", p: "A calendar of every day you row." },
        { h: "The split", p: "Your average pace, meter by meter." },
        { h: "The bests", p: "Fastest 5K and 10K, longest row, biggest day." },
        { h: "The cards", p: "Your month, drawn for a story." },
      ].map((s, i) => (
        <li key={s.h}>
          <span className="n">{"ABCD"[i]}</span>
          <div>
            <h3>{s.h}</h3>
            <p>{s.p}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Cell({ n, l }: { n: string; l: string }) {
  return (
    <div className="c">
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}

export async function L1({ data }: { data: LandingData }) {
  const extra = await loadL1();

  /* What the 100K asks of a day from today, and how long that is on the
   * erg at the pace the whole board is averaging (this month, or all time
   * while the month is still empty). */
  const daysLeft = Math.max(1, MONTH_DAYS - data.today + 1);
  const perDay = Math.ceil(GOAL_METERS / daysLeft);
  const paced = data.month.meters > 0 && data.month.seconds > 0 ? data.month : data.all;
  const minutes =
    paced.meters > 0 && paced.seconds > 0 ? Math.max(1, Math.round((perDay * (paced.seconds / paced.meters)) / 60)) : null;

  const total = num(data.month.meters);
  const next = nextMonth(MONTH);

  return (
    <div className={`row100k chrome-ink l1 ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{paceCss}</style>
      <style>{l1Css}</style>
      <RowBar active="home" sticky={false} signedIn={false} rowerNumber={null} admin={false} />

      <header className="l1-fold">
        <div className="wrap front l1-poster">
          <p className="l1-eye mono">The monthly rowing machine challenge</p>
          <Dare />
          <div className="l1-act">
            <Opt />
            <Facts />
          </div>
        </div>
      </header>

      <main className="l1-body">
        <div className="wrap front">
          <section className="l1-sec first">
            <Head label="How it counts" />
            <Steps />
          </section>

          <section className="l1-sec">
            <Head label="The rungs" note={`Rowers on each · ${MONTH_WORD}`} />
            <Ladder
              rungs={extra.rungs}
              active={extra.active}
              prevWord={extra.prevWord}
              perDay={perDay}
              minutes={minutes}
              daysLeft={daysLeft}
            />
          </section>

          <section className="l1-sec">
            <Head label="What you get" note="Your own page" />
            {data.example ? <Get eg={data.example} today={data.today} /> : <GetWords />}
          </section>

          <section className="l1-sec l1-month">
            <Head label={MONTH.label} note="So far" />
            <div className="l1-total" style={k(fitK(total))}>
              {total}
            </div>
            <p className="l1-total-l mono">Meters · everyone together</p>
            <div className="l1-cells">
              <Cell n={num(extra.active)} l="rowers on the board" />
              <Cell n={num(data.month.sessions)} l="rows logged" />
              <Cell n={num(data.month.finished)} l="at 100K already" />
              <Cell n={num(daysLeft)} l={daysLeft === 1 ? "day left" : "days left"} />
            </div>
          </section>
        </div>
      </main>

      <section className="l1-close">
        <div className="wrap front">
          {extra.nextNumber ? (
            <p className="l1-next">
              Number {fmtRowerNumber(extra.nextNumber)} is next. <span>Yours for life.</span>
            </p>
          ) : null}
          <div className="l1-act">
            <Opt />
            <Facts />
          </div>
          <p className="l1-reset mono">
            Resets {next.short} 1 · Your number stays
          </p>
        </div>
      </section>

      <RowFooter front />
    </div>
  );
}
