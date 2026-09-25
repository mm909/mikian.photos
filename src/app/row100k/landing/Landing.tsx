import { digitCount } from "@/lib/blackoutRules";
import { MONTH, fmtMeters, fmtRecordTime, fmtRowerNumber, type RecordRow, type TotalRow } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { paceCss } from "../r/[num]/looks/paceCss";
import { PaceCurve } from "../r/[num]/looks/PaceCurve";
import { Blocks } from "../Blackout";
import { Who } from "../Boards";
import { Heatmap } from "../Heatmap";
import { OptIn } from "../OptIn";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { LandingCards } from "./LandingCards";
import { landingCss } from "./landingCss";
import type { LandingData, LandingExample, LandingTotals } from "./data";
import type { Land } from "./view";

/* THE THREE SIGNED-OUT LANDINGS (owner, 2026-09-25: "present me with 3
 * different landing pages designed at getting user sign ups; lean into the
 * stats we collect, the long-term logging and progress, some of the
 * leaderboards, maybe the shareables/logos"). One job each: OPT IN.
 *   a. THE NUMBERS — headline, OPT IN, the totals, the top fives, what you
 *      get, OPT IN again.
 *   b. THE PROGRESS — one rower's month first, OPT IN under it, the boards,
 *      the totals last.
 *   c. THE BOARD — the leaderboard first with a YOUR NAME HERE row, OPT IN,
 *      the totals, the progress strip.
 * The same blocks in three orders; the loader (data.ts) feeds all three. */

/* OPT IN goes to the Rowtember sign-in (its own package) and lands back
 * on the front page at #join. */
const SIGN_IN = "/row100k/sign-in?callbackUrl=%2Frow100k%23join";

const HEADLINE = (
  <>
    A free monthly rowing challenge. <b>Row 100,000 m.</b> Every meter counted.
  </>
);

function Switch({ land }: { land: Land }) {
  return (
    <p className="ld-switch mono">
      Land ·{" "}
      {(["a", "b", "c"] as const).map((k, i) => (
        <span key={k}>
          {i ? " · " : ""}
          <a href={`?land=${k}`} className={k === land ? "on" : ""}>
            {k.toUpperCase()}
          </a>
        </span>
      ))}
    </p>
  );
}

function Head() {
  return (
    <header className="ld-head">
      <h1>{HEADLINE}</h1>
    </header>
  );
}

function Opt({ tight }: { tight?: boolean }) {
  return (
    <div className={tight ? "ld-opt tight" : "ld-opt"}>
      <OptIn href={SIGN_IN}>Opt in</OptIn>
    </div>
  );
}

function fmtHours(seconds: number): string {
  const h = seconds / 3600;
  return h >= 100 ? Math.round(h).toLocaleString("en-US") : (Math.round(h * 10) / 10).toLocaleString("en-US");
}

function Cell({ n, l }: { n: string; l: string }) {
  return (
    <div className="c">
      <div className="n">{n}</div>
      <div className="l mono">{l}</div>
    </div>
  );
}

/* THE TOTALS: this month as four big cells, all time as four quieter
 * ones under them (owner: "lean into the stats we collect"). */
function Totals({ month, all }: { month: LandingTotals; all: LandingTotals }) {
  return (
    <section className="ld-sec">
      <h2 className="mono">
        {MONTH.label} <span>· everyone together</span>
      </h2>
      <div className="ld-cells" style={{ borderTop: "none" }}>
        <Cell n={month.meters.toLocaleString("en-US")} l="meters" />
        <Cell n={fmtHours(month.seconds)} l="hours" />
        <Cell n={month.rowers.toLocaleString("en-US")} l="rowers" />
        <Cell n={month.finished.toLocaleString("en-US")} l="100K finishers" />
      </div>
      <div className="ld-cells all">
        <Cell n={all.meters.toLocaleString("en-US")} l="meters all time" />
        <Cell n={fmtHours(all.seconds)} l="hours all time" />
        <Cell n={all.rowers.toLocaleString("en-US")} l="rowers all time" />
        <Cell n={all.sessions.toLocaleString("en-US")} l="rows logged" />
      </div>
    </section>
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

/* The row a stranger is invited into, under every board. */
function YouRow() {
  return (
    <tr className="ld-you">
      <td className="rk">?</td>
      <td className="who">Your name here</td>
      <td className="num">0 m</td>
    </tr>
  );
}

function TopRows({ label, rows, you }: { label: string; rows: TotalRow[]; you?: boolean }) {
  return (
    <div className="front-three">
      <h3 className="mono">{label}</h3>
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
          {you ? <YouRow /> : null}
        </tbody>
      </table>
    </div>
  );
}

function FastRows({ label, rows }: { label: string; rows: RecordRow[] }) {
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
                <td className="num">{fmtRecordTime(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* THE BOARDS: the top fives, then the fastest 5K and 10K. While a blackout
 * window is open the top fives are not printed at all (the PLACES half of
 * blackoutRules.ts); the fastest boards come masked off boardData. */
function Boards({ d, you }: { d: LandingData; you?: boolean }) {
  return (
    <section className="ld-sec">
      <h2 className="mono">
        The board <span>· {MONTH.label}</span>
      </h2>
      {d.hidden ? (
        <p className="ld-hidden">{d.hiddenLabel} · the top of the board is hidden</p>
      ) : (
        <div className="front-top ld-boards">
          <TopRows label="Men" rows={d.topMen} you={you} />
          <TopRows label="Women" rows={d.topWomen} you={you} />
        </div>
      )}
      <div className="front-top ld-boards">
        <FastRows label="Fastest 5K" rows={d.fastest5k} />
        <FastRows label="Fastest 10K" rows={d.fastest10k} />
      </div>
    </section>
  );
}

function Chip({ place }: { place: number | null }) {
  if (!place) return null;
  const cls = place <= 3 ? `dtag m${place}` : "dtag";
  return <span className={cls}>#{place}</span>;
}

/* THE PROGRESS STRIP: what a profile holds, off the example rower's real
 * month — the calendar, the pace line, the four bests with their placement
 * chips, and the cards the share dialog would draw. */
function Progress({ eg, today, label, cards }: { eg: LandingExample; today: number; label: string; cards?: boolean }) {
  return (
    <section className="ld-sec">
      <h2 className="mono">
        {label} <span>· your own page</span>
      </h2>
      <p className="ld-eg mono">
        e.g. <b>{fmtRowerNumber(eg.rowerNumber)}</b> ·{" "}
        <a href={`/row100k/r/${eg.rowerNumber}`}>{eg.name}</a> · {fmtMeters(eg.meters)} in {eg.sessions} rows
      </p>
      <div className="ld-story">
        <div className="ld-cal">
          <div className="t">The month</div>
          <Heatmap byDay={eg.byDay} days={today} fullMonth />
        </div>
        <PaceCurve pts={eg.paceCurve} dots={eg.paceDots} />
      </div>
      <div className="ld-bests">
        {eg.bests.map((b) => (
          <div className="ld-best" key={b.key}>
            <div className="k">
              {b.label}
              <Chip place={b.place} />
            </div>
            <div className="v">{b.value}</div>
            <div className="s">{b.sub}</div>
          </div>
        ))}
      </div>
      {cards ? <LandingCards data={eg.share} /> : null}
    </section>
  );
}

/* The partner marks, in ink (public/row100k/partners/bw). */
function Marks() {
  return (
    <div className="ld-marks">
      <span className="l">With</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/row100k/partners/bw/grizzly-wordmark-ink.png" alt="Grizzly" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/row100k/partners/bw/lvss-ink.png" alt="LVSS" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/row100k/partners/bw/strip-barbell-ink.png" alt="The Strip Barbell" />
    </div>
  );
}

export function Landing({ land, data }: { land: Land; data: LandingData }) {
  const eg = data.example;
  const body =
    land === "a" ? (
      <>
        <Head />
        <Opt />
        <Totals month={data.month} all={data.all} />
        <Boards d={data} />
        {eg ? <Progress eg={eg} today={data.today} label="What you get" cards /> : null}
        <Opt />
      </>
    ) : land === "b" ? (
      <>
        {eg ? <Progress eg={eg} today={data.today} label="This is what you will see" cards /> : null}
        <Head />
        <Opt />
        <Boards d={data} />
        <Totals month={data.month} all={data.all} />
      </>
    ) : (
      <>
        <Boards d={data} you />
        <Head />
        <Opt />
        <Totals month={data.month} all={data.all} />
        {eg ? <Progress eg={eg} today={data.today} label="What you get" cards /> : null}
      </>
    );

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{paceCss}</style>
      <style>{landingCss}</style>
      <RowBar active="home" signedIn={false} rowerNumber={null} admin={false} />
      <div className="wrap front">
        <Switch land={land} />
        {body}
        <Marks />
      </div>
      <RowFooter front />
    </div>
  );
}
