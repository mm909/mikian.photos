import type { CSSProperties } from "react";
import { digitCount } from "@/lib/blackoutRules";
import { GOAL_METERS, MONTH, MONTH_DAYS, MONTH_WORD, fmtDay, fmtMeters, fmtRowerNumber, type TotalRow } from "@/lib/row100k";
import { nextMonth, type Month } from "@/lib/rowPeriod";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { paceCss } from "../r/[num]/looks/paceCss";
import { PaceCurve } from "../r/[num]/looks/PaceCurve";
import { Blocks } from "../Blackout";
import { Who } from "../Boards";
import { OptIn } from "../OptIn";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { LandingCards } from "../landing/LandingCards";
import type { LandingData } from "../landing/data";
import { availableCards, type ShareCard, type ShareData } from "../share/cards";
import { l2Css } from "./l2Css";
import { loadKeptMonth } from "./l2Data";

/* LANDING 2 — THE MATH (owner brief, 2026-09-30: convert someone who came
 * from Instagram into a rower; the month's goal is the 100K; the call to
 * action is OPT IN; a distinct look above the fold, the details under it).
 *
 * The one idea: 100,000 m is a small number once it is divided. The fold
 * is the division set as a poster — ROW 100,000 M IN OCTOBER over a rule,
 * the divisor under the rule, the answer as the one giant figure, the
 * answer again in minutes — and OPT IN. The division is done from the day
 * the page is read (review, 2026-09-30: one meters-a-day number on the
 * page, not the month's constant on the fold and today's under it), so the
 * figure is the reader's own sum. Under the fold: the same sum from other
 * starts, then what the site does with a row once it is logged (a finished
 * month of one real rower, the cards it draws), this month's board, and
 * the close — today as one number, the plan drawn on the calendar, OPT IN.
 *
 * Every number on the page is computed: the goal, the days in the month
 * and the day it is come from row100k.ts; the minutes from SPLIT_S below,
 * which the page names wherever it uses it. */

const SIGN_IN = "/row100k/sign-in?callbackUrl=%2Frow100k%23join";
const FACTS = "Free · any erg · Google sign-in · a minute";

/* The split the minutes are worked at: 2:30 per 500 m, an easy pace. The
 * page says the split beside every minute figure it prints. */
const SPLIT_S = 150;
const SPLIT = `${Math.floor(SPLIT_S / 60)}:${String(SPLIT_S % 60).padStart(2, "0")}`;

/* With fewer days than this left, the sum from today is the silly one
 * (11,112 m a day on the 22nd) and the board resets on the 1st anyway: the
 * fold divides next month instead. */
const LATE_DAYS = 10;

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const n = (v: number) => v.toLocaleString("en-US");
/* Meters a day to cover the goal in this many days, rounded UP: rounding
 * down leaves the month a few meters short. */
const perDay = (days: number) => Math.ceil(GOAL_METERS / Math.max(1, days));
/* Whole minutes those meters take at SPLIT_S. */
const minutesFor = (meters: number) => Math.round(((meters / 500) * SPLIT_S) / 60);
const dayKey = (m: Month, d: number) => `${m.key}-${String(d).padStart(2, "0")}`;
/* The month's name as the site says it (row100k.ts MONTH_NAME, for any month). */
const monthWord = (m: Month) => (m.month === 9 ? "Rowtember" : m.label.split(" ")[0]);

/* THE PLAN the page divides: this month from today, or, in the late days,
 * next month from its 1st. */
type Plan = { month: Month; from: number; days: number; daily: number; minutes: number; late: boolean };

function planFor(today: number): Plan {
  const left = MONTH_DAYS - today + 1;
  const late = left < LATE_DAYS;
  const month = late ? nextMonth(MONTH) : MONTH;
  const from = late ? 1 : today;
  const days = month.days - from + 1;
  const daily = perDay(days);
  return { month, from, days, daily, minutes: minutesFor(daily), late };
}

type StartRow = { key: string; when: string; date: string; days: number; meters: number; minutes: number };

function rowFor(key: string, when: string, month: Month, from: number): StartRow {
  const days = month.days - from + 1;
  const meters = perDay(days);
  return { key, when, date: fmtDay(dayKey(month, from)), days, meters, minutes: minutesFor(meters) };
}

/* THE SAME SUM FROM OTHER STARTS. Under a plan for this month: a week and
 * two weeks after today, as far as the month holds them, then the 1st of
 * next month, when the board resets and the sum is the easy one again.
 * Under a plan for next month (the late days): today, honest, then a week
 * and two weeks into the month the fold divided. Today is never a row of
 * the first table: it is the fold. */
function startRows(plan: Plan, today: number): StartRow[] {
  if (plan.late) {
    return [
      rowFor("today", "Today", MONTH, today),
      rowFor("w1", "A week in", plan.month, 8),
      rowFor("w2", "Two weeks in", plan.month, 15),
    ];
  }
  const rows: StartRow[] = [];
  const offs: [number, string][] = [
    [7, "In a week"],
    [14, "In two weeks"],
  ];
  for (const [off, when] of offs) {
    const d = today + off;
    if (d <= MONTH_DAYS) rows.push(rowFor(`d${d}`, when, MONTH, d));
  }
  const next = nextMonth(MONTH);
  rows.push(rowFor(next.key, "Next month", next, 1));
  return rows;
}

/* THE CALENDAR: the plan's month with the target filling day by day from
 * the day it starts. A day before the start is an empty dashed cell; from
 * the start each cell carries the running total it has to reach, and the
 * water in it stands that high. The last day is the goal, to the meter. */
function Calendar({ plan }: { plan: Plan }) {
  const { month: m, from, daily } = plan;
  return (
    <div
      className="l2-cal"
      role="img"
      aria-label={`${n(daily)} meters a day from ${fmtDay(dayKey(m, from))} reaches ${n(GOAL_METERS)} meters on ${fmtDay(m.lastDay)}`}
    >
      {DOW.map((d, i) => (
        <div className="l2-dow" key={`${d}${i}`}>
          {d}
        </div>
      ))}
      {Array.from({ length: m.firstDow }, (_, i) => (
        <div key={`blank${i}`} />
      ))}
      {Array.from({ length: m.days }, (_, i) => {
        const d = i + 1;
        if (d < from) {
          return (
            <div className="l2-day l2-past" key={d} title={fmtDay(dayKey(m, d))}>
              <span className="l2-dn">{d}</span>
            </div>
          );
        }
        const cum = d === m.days ? GOAL_METERS : Math.min(GOAL_METERS, (d - from + 1) * daily);
        const cls = d === m.days ? "l2-day l2-goal" : d === from ? "l2-day l2-now" : "l2-day";
        return (
          <div className={cls} key={d} title={`${fmtDay(dayKey(m, d))} — ${n(cum)} m`}>
            <i className="l2-fill" style={{ height: `${(cum / GOAL_METERS) * 100}%` }} />
            <span className="l2-dn">{d}</span>
            <span className="l2-k">{Math.round(cum / 1000)}K</span>
          </div>
        );
      })}
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

function Chip({ place }: { place: number | null }) {
  if (!place) return null;
  const cls = place <= 3 ? `dtag m${place}` : "dtag";
  return <span className={cls}>#{place}</span>;
}

/* The cards LandingCards paints, in its order (landing/LandingCards.tsx,
 * IDS), each as its width / height, so the sheet can hold every canvas at
 * its card's shape before the client has painted it — a square month, a
 * 1080 by 700 profile, a 1080 by 620 logo — and not at the browser's
 * 300 by 150 default (review, 2026-09-30: three 2:1 black boxes). */
const CARD_IDS = ["rowtember-month", "rowtember-profile", "rowtember-logo"];
function cardShapes(share: ShareData): CSSProperties {
  const pool = availableCards(share);
  const cards = CARD_IDS.map((id) => pool.find((c) => c.id === id)).filter((c): c is ShareCard => !!c);
  const vars: Record<string, string> = {};
  cards.forEach((c, i) => {
    vars[`--c${i + 1}`] = `${c.width} / ${c.height}`;
  });
  return vars as CSSProperties;
}

/* How many of each board the page prints: the top three, not the front
 * page's five (review, 2026-09-30: a screen shorter before the close). */
const TOP = 3;

export async function L2({ data }: { data: LandingData }) {
  const goal = n(GOAL_METERS);
  const today = Math.min(MONTH_DAYS, Math.max(1, data.today));
  const daysLeft = MONTH_DAYS - today + 1;
  const plan = planFor(today);
  const rows = startRows(plan, today);
  /* ÷ 31 DAYS = on the 1st and for next month; ÷ 26 DAYS LEFT = after. */
  const work = plan.late || plan.from === 1 ? `÷ ${plan.days} days =` : `÷ ${plan.days} days left =`;
  const startName = plan.late ? fmtDay(plan.month.firstDay) : "Today";

  /* What the site keeps: the example rower's last finished month; failing
   * that, their month so far off the shared loader. */
  const kept = await loadKeptMonth();
  const eg = kept ?? data.example;
  const egLabel = kept ? kept.month.label : MONTH.label;
  /* Only the bests that were rowed: a dash is not something the site kept. */
  const bests = eg ? eg.bests.filter((b) => b.value !== "" && b.value !== "—") : [];

  return (
    <div className={`row100k l2 ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{paceCss}</style>
      <style>{l2Css}</style>
      <RowBar active="home" signedIn={false} rowerNumber={null} admin={false} />

      {/* THE FOLD: the division as a poster, and OPT IN. */}
      <section className="l2-fold">
        <div className="wrap front">
          <div className="l2-top">
            <div className="l2-sum">
              <p className="l2-eye mono">Rowtember · a free rowing-machine challenge</p>
              <h1 className="l2-h1">
                Row {goal} m
                <br />
                in {monthWord(plan.month)}.
              </h1>
              <p className="l2-work">{work}</p>
              <p className={plan.daily >= 10_000 ? "l2-fig w5" : "l2-fig"}>{n(plan.daily)}</p>
              <p className="l2-say">
                Meters a day.
                <br />
                <span className="l2-min">About {plan.minutes} minutes.</span>
              </p>
              <p className="l2-at mono">At an easy pace · {SPLIT} per 500 m</p>
            </div>
            <div className="l2-act">
              <OptIn href={SIGN_IN}>Opt in</OptIn>
              <p className="l2-facts mono">{FACTS}</p>
            </div>
          </div>
        </div>
      </section>

      {/* THE SAME SUM FROM OTHER STARTS. */}
      <section className="l2-sec">
        <div className="wrap front">
          <div className="l2-half">
            <h2 className="l2-h">{plan.late ? "The same sum, other starts." : "The same sum, starting later."}</h2>
            <table className="l2-tab">
              <thead>
                <tr>
                  <th>Start</th>
                  <th>Days</th>
                  <th>M a day</th>
                  <th>Min</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <span className="l2-when">{r.when}</span>
                      <span className="l2-date">{r.date}</span>
                    </td>
                    <td>{r.days}</td>
                    <td>
                      <span className="l2-m">{n(r.meters)}</span>
                    </td>
                    <td>{r.minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="l2-note mono">Minutes at an easy pace · {SPLIT} per 500 m</p>
          </div>
        </div>
      </section>

      {/* WHAT THE SITE KEEPS: one real rower, one real month. */}
      {eg ? (
        <section className="l2-sec">
          <div className="wrap front">
            <h2 className="l2-h">Log a row. The site keeps count.</h2>
            <p className="l2-note mono">Two photos of the monitor · meters and time · that is the log</p>
            <p className="l2-eg mono">
              <b>{fmtRowerNumber(eg.rowerNumber)}</b> · {eg.name} · {egLabel} · <b>{fmtMeters(eg.meters)}</b> in {eg.sessions} rows
              {kept ? ` on ${kept.daysRowed} of ${kept.month.days} days` : ""}
            </p>
            <div className="l2-kept">
              <PaceCurve pts={eg.paceCurve} dots={eg.paceDots} />
              <div className="l2-bests">
                {bests.map((b) => (
                  <div className="l2-best" key={b.key}>
                    <div className="l2-bk">
                      {b.label}
                      <Chip place={b.place} />
                    </div>
                    <div className="l2-bv">{b.value}</div>
                    <div className="l2-bs">{b.sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="l2-cards" style={cardShapes(eg.share)}>
              <p className="l2-cap mono">The cards it draws for Instagram</p>
              <LandingCards data={eg.share} />
            </div>
          </div>
        </section>
      ) : null}

      {/* THE BOARD SO FAR. */}
      <section className="l2-sec">
        <div className="wrap front">
          <h2 className="l2-h">
            <span className="l2-nb">{MONTH_WORD} so far:</span> <span className="l2-nb">{n(data.month.meters)} m.</span>
          </h2>
          <p className="l2-note mono">
            {n(data.month.rowers)} rowers · {n(data.month.finished)} past 100K · resets on the 1st
          </p>
          {data.hidden ? (
            <p className="l2-hidden mono">{data.hiddenLabel} · the top of the board is hidden</p>
          ) : (
            <div className="front-top l2-boards">
              <TopRows label="Men" rows={data.topMen.slice(0, TOP)} />
              <TopRows label="Women" rows={data.topWomen.slice(0, TOP)} />
            </div>
          )}
        </div>
      </section>

      {/* THE CLOSE: today as one number, the plan drawn on the calendar, and
       * OPT IN once more. On a desktop the poster-beside-action pairing of
       * the fold repeats: the number and OPT IN left, the calendar right. */}
      <section className="l2-end">
        <div className="wrap front">
          <div className="l2-close">
            <div className="l2-head">
              <p className="l2-eye mono">
                Day {today} of {MONTH_DAYS} ·{" "}
                {plan.late ? `the board resets ${fmtDay(plan.month.firstDay)}` : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
              </p>
              <p className="l2-last">
                {startName} is <b>{n(plan.daily)} m.</b>
              </p>
            </div>
            <div className="l2-calblk">
              <Calendar plan={plan} />
              <p className="l2-note mono">From {fmtDay(dayKey(plan.month, plan.from))} · miss a day and the plan redoes the sum</p>
            </div>
            <div className="l2-act">
              <OptIn href={SIGN_IN}>Opt in</OptIn>
              <p className="l2-facts mono">{FACTS}</p>
            </div>
          </div>
        </div>
      </section>

      <RowFooter front />
    </div>
  );
}
