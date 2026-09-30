import { digitCount } from "@/lib/blackoutRules";
import {
  GOAL_METERS,
  LAST_DAY,
  MONTH,
  MONTH_DAYS,
  MONTH_FIRST_DOW,
  MONTH_KEY,
  MONTH_NAME,
  MONTH_WORD,
  fmtDay,
  fmtMeters,
  fmtRowerNumber,
  type TotalRow,
} from "@/lib/row100k";
import { nextMonth } from "@/lib/rowPeriod";
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
import { l2Css } from "./l2Css";
import { loadKeptMonth } from "./l2Data";

/* LANDING 2 — THE MATH (owner brief, 2026-09-30: convert someone who came
 * from Instagram into a rower; the month's goal is the 100K; the call to
 * action is OPT IN; a distinct look above the fold, the details under it).
 *
 * The one idea: 100,000 m is a small number once it is divided. The fold
 * is the division set as a poster — ROW 100,000 M IN OCTOBER over a rule,
 * the divisor under the rule, the answer as the one giant figure, the
 * answer again in minutes — and OPT IN. Under the fold the same sum is
 * done from today, drawn on the calendar, and then the page shows what the
 * site does with a row once it is logged: a finished month of one real
 * rower, and this month's board.
 *
 * Every number on the page is computed: the goal, the days in the month
 * and the day it is come from row100k.ts; the minutes from SPLIT_S below,
 * which the page names wherever it uses it. */

const SIGN_IN = "/row100k/sign-in?callbackUrl=%2Frow100k%23join";

/* The split the minutes are worked at: 2:30 per 500 m, an easy pace. The
 * page says the split beside every minute figure it prints. */
const SPLIT_S = 150;
const SPLIT = `${Math.floor(SPLIT_S / 60)}:${String(SPLIT_S % 60).padStart(2, "0")}`;

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const n = (v: number) => v.toLocaleString("en-US");
/* Meters a day to cover the goal in this many days, rounded UP: rounding
 * down leaves the month a few meters short. */
const perDay = (days: number) => Math.ceil(GOAL_METERS / Math.max(1, days));
/* Whole minutes those meters take at SPLIT_S. */
const minutesFor = (meters: number) => Math.round(((meters / 500) * SPLIT_S) / 60);
const dayKey = (d: number) => `${MONTH_KEY}-${String(d).padStart(2, "0")}`;

type StartRow = { key: string; when: string; date: string; days: number; meters: number; minutes: number };

/* THE SAME SUM FROM A LATER START: today, in a week, in two weeks — as
 * many of the three as the month still holds. When it holds fewer, the 1st
 * of next month closes the table: the board resets and the sum is the easy
 * one again. */
function startRows(today: number): StartRow[] {
  const rows: StartRow[] = [];
  const offs: [number, string][] = [
    [0, "Today"],
    [7, "In a week"],
    [14, "In two weeks"],
  ];
  for (const [off, when] of offs) {
    const d = today + off;
    if (d > MONTH_DAYS) continue;
    const days = MONTH_DAYS - d + 1;
    const meters = perDay(days);
    rows.push({ key: `d${d}`, when, date: fmtDay(dayKey(d)), days, meters, minutes: minutesFor(meters) });
  }
  if (rows.length < 3) {
    const next = nextMonth(MONTH);
    const meters = perDay(next.days);
    rows.push({
      key: next.key,
      when: "Next month",
      date: fmtDay(next.firstDay),
      days: next.days,
      meters,
      minutes: minutesFor(meters),
    });
  }
  return rows;
}

/* THE CALENDAR: the month with the target filling day by day from today.
 * A day before today is an empty dashed cell; from today each cell carries
 * the running total it has to reach, and the water in it stands that high.
 * The last day is the goal, to the meter. */
function Calendar({ today, daily }: { today: number; daily: number }) {
  return (
    <div className="l2-cal" role="img" aria-label={`${n(daily)} meters a day from ${fmtDay(dayKey(today))} reaches ${n(GOAL_METERS)} meters on ${fmtDay(LAST_DAY)}`}>
      {DOW.map((d, i) => (
        <div className="l2-dow" key={`${d}${i}`}>
          {d}
        </div>
      ))}
      {Array.from({ length: MONTH_FIRST_DOW }, (_, i) => (
        <div key={`blank${i}`} />
      ))}
      {Array.from({ length: MONTH_DAYS }, (_, i) => {
        const d = i + 1;
        if (d < today) {
          return (
            <div className="l2-day l2-past" key={d} title={fmtDay(dayKey(d))}>
              <span className="l2-dn">{d}</span>
            </div>
          );
        }
        const cum = d === MONTH_DAYS ? GOAL_METERS : Math.min(GOAL_METERS, (d - today + 1) * daily);
        const cls = d === MONTH_DAYS ? "l2-day l2-goal" : d === today ? "l2-day l2-now" : "l2-day";
        return (
          <div className={cls} key={d} title={`${fmtDay(dayKey(d))} — ${n(cum)} m`}>
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

export async function L2({ data }: { data: LandingData }) {
  const goal = n(GOAL_METERS);
  const monthDaily = perDay(MONTH_DAYS);
  const monthMinutes = minutesFor(monthDaily);

  const today = Math.min(MONTH_DAYS, Math.max(1, data.today));
  const daysLeft = MONTH_DAYS - today + 1;
  const rows = startRows(today);
  const todayDaily = rows[0].meters;

  /* What the site keeps: the example rower's last finished month; failing
   * that, their month so far off the shared loader. */
  const kept = await loadKeptMonth();
  const eg = kept ?? data.example;
  const egLabel = kept ? kept.month.label : MONTH.label;
  /* Only the bests that were rowed: a dash is not something the site kept. */
  const bests = eg ? eg.bests.filter((b) => b.value !== "" && b.value !== "—") : [];

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{paceCss}</style>
      <style>{l2Css}</style>
      <RowBar active="home" signedIn={false} rowerNumber={null} admin={false} />

      {/* THE FOLD: the division as a poster, and OPT IN. */}
      <section className="l2-fold">
        <div className="wrap front">
          <div className="l2-top">
            <div className="l2-sum">
              <p className="l2-eye mono">A free rowing-machine challenge</p>
              <h1 className="l2-h1">
                Row {goal} m
                <br />
                in {MONTH_NAME}.
              </h1>
              <p className="l2-work mono">÷ {MONTH_DAYS} days =</p>
              <p className="l2-fig">{n(monthDaily)}</p>
              <p className="l2-say">
                Meters a day.
                <br />
                <span className="l2-min">About {monthMinutes} minutes.</span>
              </p>
              <p className="l2-at mono">
                At {SPLIT} /500 m · {goal} m by {fmtDay(LAST_DAY)}
              </p>
            </div>
            <div className="l2-act">
              <OptIn href={SIGN_IN}>Opt in</OptIn>
              <p className="l2-facts mono">Free · any erg · a minute to join</p>
            </div>
          </div>
        </div>
      </section>

      {/* THE SAME SUM FROM TODAY, and the month it draws. */}
      <section className="l2-sec">
        <div className="wrap front">
          <div className="l2-duo">
            <div className="l2-blk">
              <h2 className="l2-h">The same sum, from today.</h2>
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
                  {rows.map((r, i) => (
                    <tr key={r.key} className={i === 0 ? "l2-on" : undefined}>
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
              <p className="l2-note mono">Minutes a day at {SPLIT} /500 m</p>
            </div>
            <div className="l2-blk">
              <h2 className="l2-h">
                {daysLeft} {daysLeft === 1 ? "day" : "days"} to {goal} m.
              </h2>
              <Calendar today={today} daily={todayDaily} />
              <p className="l2-note mono">
                {n(todayDaily)} m a day from {fmtDay(dayKey(today))} · miss a day and the plan redoes the sum
              </p>
            </div>
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
            <div className="l2-cards">
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
              <TopRows label="Men" rows={data.topMen} />
              <TopRows label="Women" rows={data.topWomen} />
            </div>
          )}
        </div>
      </section>

      {/* OPT IN, once more: today, as one number. */}
      <section className="l2-end">
        <div className="wrap front">
          <p className="l2-eye mono">
            Day {today} of {MONTH_DAYS}
          </p>
          <p className="l2-last">
            Today is <b>{n(todayDaily)} m.</b>
          </p>
          <div className="l2-act">
            <OptIn href={SIGN_IN}>Opt in</OptIn>
            <p className="l2-facts mono">Free · any erg · a minute to join</p>
          </div>
        </div>
      </section>

      <RowFooter front />
    </div>
  );
}
