import type { CSSProperties } from "react";
import Link from "next/link";
import { ELITE_LABEL, digitCount } from "@/lib/blackoutRules";
import { GOAL_METERS, MONTH, MONTH_WORD, fmtMeters, fmtRowerNumber, type TotalRow } from "@/lib/row100k";
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
import type { LandingData } from "../landing/data";
import { recordsHref } from "../records/recordsUrl";
import { l3Css } from "./l3Css";
import { loadProof, type ProofExample, type ProofMonth } from "./l3Data";

/* LANDING 3 — THE PROOF (owner brief, 2026-09-30: convert someone who came
 * from Instagram into a rower; the month's goal is the 100K; the call to
 * action is OPT IN; a distinct look above the fold, the details under it).
 *
 * The argument of this one is that it already happened. The fold is LAST
 * MONTH as a closed ledger — how many rowed, how many meters, how many made
 * the 100K — read top to bottom as one sentence, the three figures staggered
 * (short, long, short) and the third one wearing the only display label:
 * MADE THE 100K. Then the turn, the one water line on the screen: THE
 * OCTOBER 100K IS OPEN, and OPT IN under it at the foot of the first screen,
 * where a thumb is. Nothing is claimed; every figure is counted off the
 * board (l3Data.ts).
 *
 * Under the fold, the same proof in detail: the final top five men and
 * women, how the rungs filled, this month as a strip of days with what
 * counts as a row, what a rower gets (their calendar, their bests, two
 * cards), and OPT IN once more with the number they would be handed.
 *
 * After two reviews (2026-09-30): the turn names the 100K, not the month;
 * ANY MACHINE for ANY ERG under OPT IN; CLOSES OCT 3 for LATE LOGS; the
 * month-so-far cells (the front page again) cut to the strip and one line;
 * WHAT COUNTS said once; a best that does not exist and the logo card are
 * not printed; ROWER 101 IS NEXT, not NUMBER. */

const SIGN_IN = "/row100k/sign-in?callbackUrl=%2Frow100k%23join";

const num = (n: number) => Math.round(n).toLocaleString("en-US");

/* How wide a figure sets in Archivo Black, in em: a digit is .667em and a
 * comma .333em (the landing counter math, frontCss.ts). The sheet sizes
 * each figure off its container over this, so eight digits fill the measure
 * and never run past it. */
function emOf(text: string): number {
  let w = 0;
  for (const ch of text) w += ch === "," ? 0.333 : 0.667;
  return Math.round(w * 1000) / 1000;
}

const emVar = (text: string) => ({ "--l3-em": emOf(text) }) as CSSProperties;

function Meters({ r }: { r: Pick<TotalRow, "meters" | "masked" | "digits"> }) {
  return r.masked ? (
    <>
      <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
    </>
  ) : (
    <>{fmtMeters(r.meters)}</>
  );
}

/* ANY MACHINE, not ANY ERG: a stranger off Instagram does not know the
 * word, and ROWING MACHINE is already on the screen in the second figure. */
function Facts() {
  return <p className="l3-facts mono">Free · Any machine · A minute to join</p>;
}

/* The turn: the thing being opted into, in one line. The 100K is defined
 * two lines up (100,000 M IN 30 DAYS), so the line can carry it. */
function Open() {
  return <h1 className="l3-open">The {MONTH_WORD} 100K is open.</h1>;
}

/* THE FOLD. Three figures, then the turn. */
function Fold({ m, tag, thisMonth }: { m: ProofMonth; tag: string; thisMonth: boolean }) {
  const rowers = num(m.rowers);
  const meters = num(m.meters);
  const finished = num(m.finished);
  return (
    <header className="l3-fold">
      <p className="l3-date mono">
        <span>
          {thisMonth ? "" : "Last month · "}
          {m.label}
        </span>
        <b>{tag}</b>
      </p>
      <div className="l3-figs">
        <div className="l3-fig l3-a">
          <div className="l3-n" style={emVar(rowers)}>
            {rowers}
          </div>
          <p className="l3-l mono">
            <b>Rowers</b>
            <span>on the board</span>
          </p>
        </div>
        <div className="l3-fig l3-b">
          <div className="l3-n" style={emVar(meters)}>
            {meters}
          </div>
          <p className="l3-l mono">
            <b>Meters</b>
            <span>on the rowing machine, together</span>
          </p>
        </div>
        <div className="l3-fig l3-c">
          <div className="l3-n" style={emVar(finished)}>
            {finished}
          </div>
          <p className="l3-l mono">
            <b>Made the 100K</b>
            <span>
              {num(GOAL_METERS)} m in {m.days} days
            </span>
          </p>
        </div>
      </div>
      <div className="l3-turn">
        <Open />
        <div className="l3-go">
          <OptIn href={SIGN_IN}>Opt in</OptIn>
        </div>
        <Facts />
      </div>
    </header>
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

/* THE BOARD of the proof month: the top five men and women as they
 * finished, and the way to everyone under them. */
function Board({ m, final }: { m: ProofMonth; final: boolean }) {
  return (
    <section className="l3-sec">
      <h2 className="l3-h mono">
        <span>{final ? "The final board" : "The board"}</span>
        <i>{m.label}</i>
      </h2>
      {m.hidden ? (
        <p className="l3-note mono">{ELITE_LABEL} · the top of the board is hidden</p>
      ) : (
        <div className="front-top l3-tops">
          <TopRows label="Men" rows={m.topMen} />
          <TopRows label="Women" rows={m.topWomen} />
        </div>
      )}
      <p className="l3-more mono">
        <Link href={recordsHref({ key: "total", m: m.key }, MONTH.key)}>
          All {num(m.rowers)} rowers, {m.word}
        </Link>
      </p>
    </section>
  );
}

/* THE RUNGS: how many of the month's rowers passed each one, as a bar of
 * everyone who rowed. The 100K is the one in water. When the proof is this
 * month (no last month to show) there is no SO FAR section, so WHAT COUNTS
 * is said here instead. */
function Rungs({ m, counts }: { m: ProofMonth; counts?: boolean }) {
  const pct = m.rowers > 0 ? Math.round((m.finished / m.rowers) * 100) : 0;
  return (
    <section className="l3-sec">
      <h2 className="l3-h mono">
        <span>How the rungs filled</span>
        <i>of {num(m.rowers)} rowers</i>
      </h2>
      <div className="l3-rungs">
        {m.rungs.map((r) => {
          const goal = r.meters === GOAL_METERS;
          const w = m.rowers > 0 ? (r.count / m.rowers) * 100 : 0;
          return (
            <div className={goal ? "l3-rung goal" : "l3-rung"} key={r.meters}>
              <div className="k">{r.label}</div>
              {/* Not .bar: that is the sticky nav in theme.ts. */}
              <div className="l3-track" role="img" aria-label={`${r.count} of ${m.rowers} rowers passed ${r.label}`}>
                <div className="l3-fill" style={{ width: `${Math.max(w, r.count > 0 ? 1.5 : 0)}%` }} />
              </div>
              <div className="v">{num(r.count)}</div>
            </div>
          );
        })}
      </div>
      {m.finished > 0 ? (
        <p className="l3-note mono">
          <b>{pct}%</b> of everyone who rowed made the 100K
        </p>
      ) : null}
      {counts ? <Counts /> : null}
    </section>
  );
}

/* WHAT COUNTS, said once, in the words the log form uses (LogRow.tsx: two
 * photos, you and the screen). A stranger who has never used a challenge
 * site does not know whether they need an app, a Concept2 account or a
 * gym; this is the last question before a Google sign-in. */
function Counts() {
  return (
    <p className="l3-note mono">
      <b>What counts</b> · a row logged with its meters and two photos, you and the screen · any machine, any gym
    </p>
  );
}

/* THIS MONTH SO FAR: the month as a strip of days — gone, today, to come —
 * and one line under it. Today is the one water mark. No meters-so-far
 * cells here: on day 6 they argue with the proof above (review, 2026-09-30),
 * and they are the front page again for anyone who taps ROWTEMBER next. */
function Now({ m, day, left }: { m: ProofMonth; day: number; left: number }) {
  const empty = m.rowers <= 0;
  return (
    <section className="l3-sec">
      <h2 className="l3-h mono">
        <span>{m.word} so far</span>
        <i>
          Day {day} of {m.days}
        </i>
      </h2>
      <div className="l3-days" style={{ "--l3-days": m.days } as CSSProperties} role="img" aria-label={`Day ${day} of ${m.days}`}>
        {Array.from({ length: m.days }, (_, i) => (
          <i key={i} className={i + 1 < day ? "gone" : i + 1 === day ? "today" : ""} />
        ))}
      </div>
      {empty ? (
        <p className="l3-empty">The {m.word} board is empty. The first row takes the top of it.</p>
      ) : (
        <p className="l3-note mono">
          <b>{num(m.rowers)}</b> {m.rowers === 1 ? "rower" : "rowers"} in · <b>{num(left)}</b> {left === 1 ? "day" : "days"} left
        </p>
      )}
      <Counts />
    </section>
  );
}

function Chip({ place }: { place: number | null }) {
  if (!place) return null;
  const cls = place <= 3 ? `dtag m${place}` : "dtag";
  return <span className={cls}>#{place}</span>;
}

/* WHAT YOU GET: one rower's page for the month, their real numbers — the
 * calendar, the split (desktop only: its axis type sets at 5px in a phone
 * column, l3Css.ts), the bests they have rowed, two cards for Instagram.
 * A best that does not exist (buildBests prints an em dash) is not printed:
 * a dash under YOUR NUMBERS is the opposite of the pitch. The logo card is
 * dropped in the sheet the same way, for not being drawn from anything. */
function Get({ eg }: { eg: ProofExample }) {
  const bests = eg.bests.filter((b) => b.value !== "—");
  return (
    <section className="l3-sec">
      <h2 className="l3-h mono">
        <span>What you get</span>
        <i>a page like this</i>
      </h2>
      <p className="l3-eg mono">
        <b>{fmtRowerNumber(eg.rowerNumber)}</b> · <a href={`/row100k/r/${eg.rowerNumber}`}>{eg.name}</a> · {eg.monthLabel}{" "}
        · {fmtMeters(eg.meters)} in {eg.sessions} rows
      </p>
      <div className="l3-story">
        <div className="l3-cal">
          <div className="t">The month, day by day</div>
          <Heatmap byDay={eg.byDay} month={eg.month} days={eg.shown} fullMonth />
        </div>
        <PaceCurve pts={eg.paceCurve} dots={eg.paceDots} />
      </div>
      <div className="l3-bests">
        {bests.map((b) => (
          <div className="l3-best" key={b.key}>
            <div className="k">
              {b.label}
              <Chip place={b.place} />
            </div>
            <div className="v">{b.value}</div>
            <div className="s">{b.sub}</div>
          </div>
        ))}
      </div>
      <div className="l3-cards">
        <div className="t">Cards for Instagram, drawn from your numbers</div>
        <LandingCards data={eg.share} />
      </div>
    </section>
  );
}

export async function L3({ data }: { data: LandingData }) {
  const d = await loadProof(data);
  const m = d.proof;
  // CLOSES OCT 3, not LATE LOGS TO: the 1st to the 3rd is when the recap
  // posts send the most strangers, and late logs is site vocabulary.
  const tag = d.fallback ? `Day ${d.day} of ${MONTH.days}` : d.final ? "Final" : `Closes ${d.closesTag}`;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{paceCss}</style>
      <style>{l3Css}</style>
      <RowBar active="home" signedIn={false} rowerNumber={null} admin={false} />
      <div className="wrap front l3">
        {m ? (
          <>
            <Fold m={m} tag={tag} thisMonth={d.fallback} />
            <Board m={m} final={d.final} />
            <Rungs m={m} counts={!d.now} />
            {d.now ? <Now m={d.now} day={d.day} left={d.left} /> : null}
          </>
        ) : (
          /* The board could not be read: the turn alone still does the job. */
          <header className="l3-fold">
            <div className="l3-turn">
              <Open />
              <div className="l3-go">
                <OptIn href={SIGN_IN}>Opt in</OptIn>
              </div>
              <Facts />
            </div>
          </header>
        )}
        {d.example ? <Get eg={d.example} /> : null}
        <section className="l3-sec l3-end">
          {/* ROWER 101, not NUMBER 101: after a page of 10K and 100K a bare
           * number reads as a distance; ROWER ties it to the 93 ROWERS the
           * fold opened with. */}
          <p className="l3-open">
            {d.nextNumber ? <>Rower {fmtRowerNumber(d.nextNumber)} is next.</> : <>The {MONTH_WORD} 100K is open.</>}
          </p>
          <div className="l3-go">
            <OptIn href={SIGN_IN}>Opt in</OptIn>
          </div>
          <p className="l3-facts mono">Yours for life · Free · The board resets on the 1st</p>
        </section>
      </div>
      <RowFooter front />
    </div>
  );
}
