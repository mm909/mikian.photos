import type { CSSProperties } from "react";
import { digitCount } from "@/lib/blackoutRules";
import {
  END_MS,
  GOAL_METERS,
  MONTH,
  MONTH_DAYS,
  MONTH_WORD,
  fmtMeters,
  fmtRowerNumber,
  nowMs,
  type TotalRow,
} from "@/lib/row100k";
import { nextMonth } from "@/lib/rowPeriod";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { paceCss } from "../r/[num]/looks/paceCss";
import { PaceCurve } from "../r/[num]/looks/PaceCurve";
import { Blocks } from "../Blackout";
import { Who } from "../Boards";
import { Heatmap } from "../Heatmap";
import { OptIn } from "../OptIn";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { LandingCards } from "../landing/LandingCards";
import type { LandingData, LandingExample } from "../landing/data";
import { l5Css } from "./l5Css";
import { loadL5, type L5Row } from "./l5Data";

/* LANDING 5: THE CLOCK (owner brief, 2026-09-30: convert someone off
 * Instagram into a rower; the 100K month is the point, the stats are the
 * second reason, OPT IN is the call; a distinct fold, details under it).
 *
 * The idea: the month is live and you are late. The fold is a scoreboard —
 * the dateline (month, day d of n, one cell per day), everyone together as
 * the one water-blue figure, then the ask with the time left ticking under
 * it, then OPT IN. Under the fold the same clock does the arithmetic (the
 * meters a day from today, and what waiting a week costs), then the
 * evidence that the month is moving: the latest rows, the top fives, what
 * a rower gets, how a row counts, and OPT IN again.
 *
 * Every figure is computed: the totals and boards from landing/data.ts, the
 * latest rows, last month and the next number from l5Data.ts. */

const SIGN_IN = "/row100k/sign-in?callbackUrl=%2Frow100k%23join";
const FACTS = "Free · any rowing machine · a minute to join";

const n = (v: number) => Math.round(v).toLocaleString("en-US");

/* "12 min ago", server-rendered against the challenge clock. */
function ago(thenMs: number, now: number): string {
  const s = Math.max(0, Math.floor((now - thenMs) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/* What a day of the plan costs in time, at a split (seconds per 500 m). */
function minutesAt(meters: number, split: number): number {
  return Math.max(1, Math.round(((meters / 500) * split) / 60));
}

function fmtClock(split: number): string {
  const t = Math.round(split);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/* The width of a comma-grouped figure in ems of Archivo Black: a lining
 * digit is about .67em and a comma about .3em. The page sizes its big
 * numbers off this, so seven digits and one digit both fill the measure
 * (or stop at the cap) and neither runs off a 360px phone. */
function figureEms(text: string): number {
  let em = 0.06;
  for (const ch of text) em += ch === "," ? 0.3 : 0.67;
  return em;
}

/* The --l5-em a sized figure reads (l5Css.ts): its width in ems. */
const ems = (em: number) => ({ "--l5-em": Math.round(em * 100) / 100 }) as CSSProperties;

/* THE CLOCK: the time left in the month, ticking, with no script. Each
 * cell is a strip of values (59 down to 00) behind a one-line window,
 * moved down a step at a time by a CSS animation whose negative delay
 * puts it on the value that is true at this render — so the first paint
 * is right, on a phone in the Instagram browser before a byte of
 * JavaScript has arrived, and it keeps time from there. The strips run
 * for exactly the time left and then hold at zero. Under
 * prefers-reduced-motion the theme stops every animation and the strip
 * shows the render-time value, still, through the same variable. */
const STEP = { days: 86_400, hrs: 3_600, min: 60, sec: 1 } as const;

function Strip({ label, top, step, leftS }: { label: string; top: number; step: number; leftS: number }) {
  const items = top + 1;
  const value = Math.floor(leftS / step) % items;
  const k = top - value;
  /* Seconds already spent on the value showing, and so how far into the
   * animation the strip starts. A hair short of the whole step at an
   * exact boundary, so the strip never starts one value early. */
  const spent = Math.min(step - 0.01, step - (leftS % step));
  const delay = k * step + spent;
  const duration = items * step;
  /* Runs out with the month, a hair early so the frame it holds is 00. */
  const count = Math.max(0, (leftS + delay - 0.01) / duration);
  const style = {
    "--l5-k": k,
    "--l5-c": items,
    animationDuration: `${duration}s`,
    animationDelay: `-${delay.toFixed(2)}s`,
    animationTimingFunction: `steps(${items})`,
    animationIterationCount: String(Math.round(count * 100_000) / 100_000),
  } as CSSProperties;
  return (
    <div className="c">
      <div className="l5-tk" aria-hidden="true">
        <div className="st" style={style}>
          {Array.from({ length: items }, (_, i) => (
            <i key={i}>{String(top - i).padStart(2, "0")}</i>
          ))}
        </div>
      </div>
      <div className="l mono">{label}</div>
    </div>
  );
}

function Clock({ leftMs }: { leftMs: number }) {
  const leftS = Math.max(0, leftMs / 1000);
  const days = Math.floor(leftS / STEP.days);
  const hrs = Math.floor(leftS / STEP.hrs) % 24;
  const mins = Math.floor(leftS / STEP.min) % 60;
  return (
    <div
      className="l5-count"
      role="timer"
      aria-label={`${days} days, ${hrs} hours and ${mins} minutes left in ${MONTH_WORD}`}
    >
      <Strip label="days" top={days} step={STEP.days} leftS={leftS} />
      <Strip label="hrs" top={23} step={STEP.hrs} leftS={leftS} />
      <Strip label="min" top={59} step={STEP.min} leftS={leftS} />
      <Strip label="sec" top={59} step={STEP.sec} leftS={leftS} />
    </div>
  );
}

function Dateline({ today }: { today: number }) {
  return (
    <p className="l5-date mono">
      <b>{MONTH.label}</b>
      <span>
        Day {today} of {MONTH_DAYS}
      </span>
    </p>
  );
}

/* One cell per day of the month; the days gone (today with them) in ink. */
function Days({ today }: { today: number }) {
  return (
    <div className="l5-days" role="img" aria-label={`Day ${today} of ${MONTH_DAYS}`}>
      {Array.from({ length: MONTH_DAYS }, (_, i) => (
        <i key={i} className={i < today ? "on" : undefined} />
      ))}
    </div>
  );
}

function Meters({ r }: { r: Pick<TotalRow, "meters" | "masked" | "digits"> }) {
  return r.masked ? (
    <>
      <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
    </>
  ) : (
    <>{fmtMeters(r.meters)}</>
  );
}

function TopRows({ label, rows }: { label: string; rows: TotalRow[] }) {
  return (
    <div className="front-three">
      <h3 className="mono">{label}</h3>
      {rows.length === 0 ? (
        <p className="board-empty">NOBODY ON THIS BOARD YET.</p>
      ) : (
        <table className="board">
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.participantId}>
                <td className="rk">{i + 1}</td>
                <td>
                  <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} />
                </td>
                <td className="num">
                  <Meters r={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LatestRow({ r, now }: { r: L5Row; now: number }) {
  return (
    <li>
      <span className="l5-who">
        <span className="no">{fmtRowerNumber(r.rowerNumber)} · </span>
        <a href={`/row100k/r/${r.rowerNumber}`}>{r.name}</a>
      </span>
      <span className="l5-m">
        {r.masked ? (
          <>
            <Blocks digits={r.digits} /> m
          </>
        ) : (
          fmtMeters(r.meters)
        )}
      </span>
      <span className="l5-sp mono">{r.split ? `${r.split} /500m` : ""}</span>
      <span className="l5-ago mono">{ago(r.createdAtMs, now)}</span>
    </li>
  );
}

function Chip({ place }: { place: number | null }) {
  if (!place) return null;
  const cls = place <= 3 ? `dtag m${place}` : "dtag";
  return <span className={cls}>#{place}</span>;
}

/* WHAT YOU GET, as a ledger: the thing on the left, one line of what it
 * is, and the thing itself drawn off one real rower's month. */
function Get({ eg, today, nextNumber }: { eg: LandingExample | null; today: number; nextNumber: number | null }) {
  return (
    <section className="l5-sec">
      <h2 className="mono">
        What you get <span>· all of it free</span>
      </h2>
      <div className="l5-get">
        {nextNumber ? (
          <div className="l5-item">
            <p className="k mono">A number</p>
            <p className="v">
              <b className="l5-big">{fmtRowerNumber(nextNumber)}</b>
              is next. It is yours for life.
            </p>
          </div>
        ) : null}
        {eg ? (
          <>
            <div className="l5-item">
              <p className="k mono">Your month</p>
              <p className="v">Every day, every meter.</p>
              <div className="l5-cal">
                <Heatmap byDay={eg.byDay} days={today} fullMonth />
              </div>
              <p className="l5-eg mono">
                This one is <b>{fmtRowerNumber(eg.rowerNumber)}</b> ·{" "}
                <a href={`/row100k/r/${eg.rowerNumber}`}>{eg.name}</a> · {fmtMeters(eg.meters)} in {eg.sessions} rows
              </p>
            </div>
            {eg.paceCurve.length >= 2 ? (
              <div className="l5-item">
                <p className="k mono">Your split</p>
                <p className="v">The average, moved by every row.</p>
                <div className="l5-curve">
                  <PaceCurve pts={eg.paceCurve} dots={eg.paceDots} />
                </div>
              </div>
            ) : null}
            <div className="l5-item">
              <p className="k mono">Your bests</p>
              <p className="v">Timed, dated, ranked against the board.</p>
              <div className="l5-bests">
                {eg.bests.map((b) => (
                  <div className="l5-best" key={b.key}>
                    <div className="bk mono">
                      {b.label}
                      <Chip place={b.place} />
                    </div>
                    <div className="bv">{b.value}</div>
                    <div className="bs mono">{b.sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="l5-item">
              <p className="k mono">Your cards</p>
              <p className="v">Drawn from your numbers, made for a story.</p>
              <div className="l5-cards">
                <LandingCards data={eg.share} />
              </div>
            </div>
          </>
        ) : null}
        <div className="l5-item">
          <p className="k mono">The boards</p>
          <p className="v">Men and women. Fastest 5K and 10K. Longest row. All-time totals.</p>
        </div>
      </div>
    </section>
  );
}

export async function L5({ data }: { data: LandingData }) {
  const extra = await loadL5();
  const now = nowMs();

  const today = Math.min(MONTH_DAYS, Math.max(1, data.today));
  const daysLeft = MONTH_DAYS - today + 1;
  const perDay = Math.ceil(GOAL_METERS / daysLeft);

  /* IN A WEEK: the same sum seven days on — or, once a week from now is
   * past the end of the month, the first of the next one. */
  const weekLeft = daysLeft - 7;
  const weekPerDay = Math.ceil(GOAL_METERS / Math.max(1, weekLeft));
  const next = nextMonth(MONTH);
  const later =
    weekLeft >= 1
      ? {
          label: `In a week · ${MONTH.short} ${today + 7}`,
          days: weekLeft,
          perDay: weekPerDay,
          note: `A week of waiting costs ${n(weekPerDay - perDay)} m a day.`,
        }
      : {
          label: `Next month · ${next.short} 1`,
          days: next.days,
          perDay: Math.ceil(GOAL_METERS / next.days),
          note: "The board resets on the 1st.",
        };

  /* The board average split this month: every logged second over every
   * logged meter. What turns a day of meters into minutes. */
  const split =
    data.month.meters > 0 && data.month.seconds > 0 ? data.month.seconds / (data.month.meters / 500) : null;

  const rowersIn = extra.rowersIn ?? 0;
  const empty = !(data.month.meters > 0);
  const figure = n(data.month.meters);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{paceCss}</style>
      <style>{l5Css}</style>
      <RowBar active="home" signedIn={false} rowerNumber={null} admin={false} />

      {/* THE FOLD: the scoreboard. Four groups — the dateline, the figure,
       * the ask with its clock, OPT IN. */}
      <header className="l5-fold">
        <div className="wrap front">
          <div>
            <Dateline today={today} />
            <Days today={today} />
          </div>

          <div>
            <div className="l5-fig" style={ems(figureEms(figure))}>
              <div className="l5-n">{figure}</div>
            </div>
            <p className="l5-cap mono">
              {empty ? (
                <b>The board is empty. Be first.</b>
              ) : (
                <>
                  Meters rowed this month ·{" "}
                  <b>
                    {n(rowersIn)} {rowersIn === 1 ? "rower" : "rowers"} in
                  </b>
                </>
              )}
            </p>
          </div>

          <div className="l5-ask">
            <div className="l5-hw">
              <h1 className="l5-h">Row {n(GOAL_METERS)} m.</h1>
            </div>
            <div className="l5-clock">
              <Clock leftMs={END_MS - now} />
              <p className="l5-left mono">Left in {MONTH_WORD}</p>
            </div>
          </div>

          <div className="l5-go">
            <OptIn href={SIGN_IN}>Opt in</OptIn>
            <p className="l5-facts mono">{FACTS}</p>
          </div>
        </div>
      </header>

      <div className={extra.latest.length > 0 ? "wrap front l5-duo" : "wrap front"}>
        {/* START TODAY: the clock, as meters a day. */}
        <section className="l5-sec">
          <h2 className="mono">
            Start today{" "}
            <span>
              · {n(GOAL_METERS)} m by {MONTH.short} {MONTH_DAYS}
            </span>
          </h2>
          <div className="l5-plan">
            <div className="c">
              <div className="k mono">
                From today · {MONTH.short} {today}
              </div>
              <div className="v" style={ems(figureEms(n(perDay)) + 1.3)}>
                {n(perDay)} m
              </div>
              <div className="s mono">
                a day · {daysLeft} {daysLeft === 1 ? "day" : "days"}
                {split ? ` · about ${minutesAt(perDay, split)} min` : ""}
              </div>
            </div>
            <div className="c late">
              <div className="k mono">{later.label}</div>
              <div className="v" style={ems(figureEms(n(later.perDay)) + 1.3)}>
                {n(later.perDay)} m
              </div>
              <div className="s mono">
                a day · {later.days} {later.days === 1 ? "day" : "days"}
                {split ? ` · about ${minutesAt(later.perDay, split)} min` : ""}
              </div>
            </div>
          </div>
          <p className="l5-note mono">
            {later.note}
            {split ? ` Minutes at ${fmtClock(split)} /500m, the board average this month.` : ""}
          </p>
        </section>

        {/* THE LATEST ROWS: who is on the clock right now. */}
        {extra.latest.length > 0 ? (
          <section className="l5-sec">
            <h2 className="mono">
              The latest rows <span>· {MONTH.label}</span>
            </h2>
            <ol className="l5-rows">
              {extra.latest.map((r) => (
                <LatestRow key={r.id} r={r} now={now} />
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <div className="wrap front">
        {/* THE BOARD SO FAR: the top five, men and women. */}
        <section className="l5-sec">
          <h2 className="mono">
            The board so far{" "}
            <span>
              · day {today} of {MONTH_DAYS}
            </span>
          </h2>
          {data.hidden ? (
            <p className="l5-note mono">{data.hiddenLabel} · the top of the board is hidden</p>
          ) : (
            <div className="front-top l5-top">
              <TopRows label="Men" rows={data.topMen} />
              <TopRows label="Women" rows={data.topWomen} />
            </div>
          )}
          {extra.prev ? (
            <p className="l5-prev mono">
              Last month · <b>{extra.prev.label}</b> · {n(extra.prev.meters)} m · {n(extra.prev.rowers)} rowers ·{" "}
              {n(extra.prev.finished)} made 100K
            </p>
          ) : null}
        </section>

        <Get eg={data.example} today={today} nextNumber={extra.nextNumber} />

        {/* HOW IT COUNTS: three lines, no pictures. */}
        <section className="l5-sec">
          <h2 className="mono">
            How it counts <span>· three moves</span>
          </h2>
          <ol className="l5-how">
            <li>
              <b>Row.</b>
              <span>Any rowing machine, any gym, any garage.</span>
            </li>
            <li>
              <b>Two photos.</b>
              <span>You, and the screen.</span>
            </li>
            <li>
              <b>Log it.</b>
              <span>Meters and time. The board moves on the spot.</span>
            </li>
          </ol>
          <p className="l5-note mono">
            The board resets on the 1st · your number and your all-time total stay · race day is in September
          </p>
        </section>
      </div>

      {/* THE END: the clock once more, and the one call. */}
      <section className="l5-end">
        <div className="wrap front">
          <Dateline today={today} />
          <div className="l5-hw" style={ems(9.6)}>
            <p className="l5-h">
              {daysLeft} {daysLeft === 1 ? "day" : "days"} left.
              <br />
              {n(perDay)} m a day.
            </p>
          </div>
          <div className="l5-go">
            <OptIn href={SIGN_IN}>Opt in</OptIn>
            <p className="l5-facts mono">{FACTS}</p>
          </div>
        </div>
      </section>

      <RowFooter front />
    </div>
  );
}
