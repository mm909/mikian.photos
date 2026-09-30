import {
  GOAL_METERS,
  MONTH,
  MONTH_DAYS,
  MONTH_WORD,
  fmtRowerNumber,
  fmtSplit,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { paceCss } from "../r/[num]/looks/paceCss";
import { PaceCurve } from "../r/[num]/looks/PaceCurve";
import { OptIn } from "../OptIn";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import type { LandingData } from "../landing/data";
import type { ShareData } from "../share/cards";
import { L4Cards } from "./L4Cards";
import { L4InApp } from "./L4InApp";
import { l4Css } from "./l4Css";
import { loadL4 } from "./l4Data";

/* LANDING 4 — THE CARD (owner brief, 2026-09-30: convert someone who came
 * from Instagram into a rower; the goal is the 100K month, the tracking is
 * the second reason, the call is OPT IN; a distinct fold, details under it).
 *
 * They came from a story with a Rowtember card in it, so the fold IS that:
 * one real month card on an ink tile, the ledger of what is on it beside
 * it, the headline over it and OPT IN under it. Below the fold, in the
 * order a stranger asks (review, 2026-09-30): how it counts, the other
 * cards, the page a card is drawn from (the split line, the ranked bests),
 * the goal and the rungs, OPT IN again.
 *
 * The card is a FINISHED month when the example rower has one (l4Data.ts):
 * last month's, whole. Every figure is read, none typed. */

/* OPT IN goes to the Rowtember sign-in and lands back on the front page at
 * #join (the same link the three earlier landings used). */
const SIGN_IN = "/row100k/sign-in?callbackUrl=%2Frow100k%23join";

/* What the tile paints when there is no rower to draw: the mark alone. */
const BARE: ShareData = { displayName: "", rowerNumber: 0, instagram: "", meters: 0, sessions: 0, byDay: {} };

const n = (v: number) => v.toLocaleString("en-US");

function Facts() {
  return <p className="l4-facts mono">Free · Any machine · A minute to join</p>;
}

function Chip({ place }: { place: number | null }) {
  if (!place) return null;
  const cls = place <= 3 ? `dtag m${place}` : "dtag";
  return <span className={cls}>#{place}</span>;
}

export async function L4({ data }: { data: LandingData }) {
  const l4 = await loadL4(data);
  const eg = l4.example;
  const monthWord = l4.label.split(" ")[0];
  const done = eg ? eg.meters >= GOAL_METERS : false;
  const profile = eg ? `/row100k/r/${eg.rowerNumber}${l4.finished ? `?m=${l4.grid.key}` : ""}` : "";

  // This month so far, the second set of cards — only when the fold shows
  // last month's and the same rower has rowed this one.
  const now = l4.finished && data.example ? data.example : null;

  // Bests the example rower has actually rowed (buildBests prints a dash
  // on one they have not): a hole is not proof.
  const bests = eg ? eg.bests.filter((b) => b.value !== "—") : [];
  // The running average split, the number the pace line ends on.
  const lastPace = eg && eg.paceCurve.length > 0 ? eg.paceCurve[eg.paceCurve.length - 1] : null;

  // The rate from TODAY, not the whole month's: the stranger arrives on the
  // 6th or the 20th, and the number that says whether to start is the one
  // over the days left (review, 2026-09-30).
  const left = Math.max(1, MONTH_DAYS - data.today + 1);
  const perDay = (meters: number) => n(Math.ceil(meters / left));
  const fromWhen = data.today > 1 ? `from ${MONTH.short} ${data.today}` : `in ${MONTH_WORD}`;
  const club = l4.rungs.find((r) => r.meters === GOAL_METERS);
  // The rungs somebody has stood on; the unnamed next one up is a members'
  // convention (blocks) with no job on a landing.
  const rungs = l4.rungs.filter((r) => r.reached > 0);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{paceCss}</style>
      <style>{l4Css}</style>
      <RowBar active="home" signedIn={false} rowerNumber={null} admin={false} />

      <div className="wrap front">
        <div className="l4-page">
          {/* THE FOLD. */}
          <section className={eg ? "l4-fold" : "l4-fold l4-bare"}>
            <p className="l4-eye mono">A monthly rowing machine challenge</p>
            <h1 className="l4-h">
              <span>
                Row <b>100,000 m</b>
              </span>
              <span>in {MONTH_WORD}.</span>
              <span>Post the proof.</span>
            </h1>

            <div className="l4-tile">
              <L4Cards
                data={eg ? eg.share : BARE}
                ids={[eg ? "rowtember-month" : "rowtember-logo"]}
                standIn={
                  eg ? (
                    <p className="l4-tile-ssr">
                      Rowtember<b>{n(eg.meters)}</b>meters
                    </p>
                  ) : undefined
                }
              />
            </div>

            {eg ? (
              <dl className="l4-side">
                <div className="l4-led">
                  <dt>Rower</dt>
                  <dd>{fmtRowerNumber(eg.rowerNumber)}</dd>
                  <dd className="s">{eg.name}</dd>
                </div>
                <div className="l4-led">
                  <dt>Month</dt>
                  <dd>
                    {l4.short} {l4.year}
                  </dd>
                </div>
                <div className="l4-led">
                  <dt>Meters</dt>
                  <dd>{n(eg.meters)}</dd>
                </div>
                <div className="l4-led">
                  <dt>Rows</dt>
                  <dd>{n(eg.sessions)}</dd>
                </div>
                <div className="l4-led">
                  <dt>{done ? "100K" : "To 100K"}</dt>
                  <dd>{done ? "Done" : n(GOAL_METERS - eg.meters)}</dd>
                </div>
              </dl>
            ) : null}

            <div className="l4-cta">
              <OptIn href={SIGN_IN}>Opt in</OptIn>
            </div>
            <Facts />
            <L4InApp />
          </section>

          {/* HOW IT COUNTS: the headline said POST THE PROOF, and the next
           * question is what proof, so this is the first thing under it. */}
          <section className="l4-sec">
            <h2 className="mono">How it counts</h2>
            <div className="l4-how">
              <div className="l4-step">
                <div className="d mono">Opt in</div>
                <p>A Google sign-in. A minute. Free.</p>
              </div>
              <div className="l4-step">
                <div className="d mono">Row</div>
                <p>Any rowing machine, any gym, any distance.</p>
              </div>
              <div className="l4-step">
                <div className="d mono">Log</div>
                <p>The meters and two photos of the monitor.</p>
              </div>
              <div className="l4-step">
                <div className="d mono">Counted</div>
                <p>Your page, the month boards, the records, all time.</p>
              </div>
              <div className="l4-step">
                <div className="d mono">The 1st</div>
                <p>The board resets. Your number is yours for life.</p>
              </div>
            </div>
          </section>

          {/* THE OTHER CARDS, in a strip. */}
          {eg ? (
            <section className="l4-sec">
              <h2 className="mono">
                The cards <span>· made for a story</span>
              </h2>
              <p className="l4-note mono">Redrawn with every row you log</p>
              <div className="l4-strip">
                <div className={now ? "l4-strip-in" : "l4-strip-in l4-one"}>
                  <div className="l4-seta">
                    <L4Cards data={eg.share} ids={["rowtember-profile", "rowtember-logo"]} />
                  </div>
                  {now ? (
                    <div className="l4-setb">
                      <L4Cards data={now.share} ids={["rowtember-month", "rowtember-profile"]} />
                    </div>
                  ) : null}
                  <p className="l4-capt mono l4-c1">
                    <b>The profile</b> · {monthWord}
                  </p>
                  {now ? (
                    <>
                      <p className="l4-capt mono l4-c2">
                        <b>The month</b> · {MONTH.short} {data.today}, so far
                      </p>
                      <p className="l4-capt mono l4-c3">
                        <b>The profile</b> · {MONTH.short} {data.today}, so far
                      </p>
                    </>
                  ) : null}
                  <p className={now ? "l4-capt mono l4-c4" : "l4-capt mono l4-c2"}>
                    <b>The mark</b>
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* BEHIND THE CARD: the page it is drawn from — the month in one
           * line, the split line (a desktop only; at phone width its labels
           * are specks), the bests, each ranked. */}
          {eg ? (
            <section className="l4-sec">
              <h2 className="mono">
                Behind the card <span>· your own page</span>
              </h2>
              <p className="l4-note mono">
                {fmtRowerNumber(eg.rowerNumber)} · <a href={profile}>{eg.name}</a> · {l4.label}
              </p>
              <p className="l4-line mono">
                {n(l4.rowedDays)} days rowed · {n(eg.sessions)} rows · {n(eg.meters)} m
                {lastPace ? <> · avg {fmtSplit(500, lastPace.s)}</> : null}
              </p>
              <div className="l4-behind">
                {eg.paceCurve.length >= 2 ? (
                  <div className="l4-blk l4-pace">
                    <PaceCurve pts={eg.paceCurve} dots={eg.paceDots} />
                  </div>
                ) : null}
                {bests.length > 0 ? (
                  <div className="l4-bests">
                    {bests.map((b) => (
                      <div className="l4-best" key={b.key}>
                        <div className="k">
                          {b.label}
                          <Chip place={b.place} />
                        </div>
                        <div className="v">{b.value}</div>
                        <div className="s">{b.sub}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* THE GOAL AND THE RUNGS. */}
          <section className="l4-sec">
            <h2 className="mono">
              The goal <span>· one month</span>
            </h2>
            <div className="l4-goal">
              <div className="g">{n(GOAL_METERS)} m</div>
              <p className="l4-line mono">
                {perDay(GOAL_METERS)} m a day {fromWhen}
                {club && club.reached > 0 ? (
                  <>
                    {" "}
                    · {n(club.reached)} of {n(l4.rowers)} rowers did it in {monthWord}
                  </>
                ) : null}
              </p>
            </div>
            {rungs.length > 0 ? (
              <>
                <div className="l4-rungs">
                  {rungs.map((r) => {
                    const isClub = r.meters === GOAL_METERS;
                    return (
                      <div className={isClub ? "l4-rung l4-club" : "l4-rung"} key={r.meters}>
                        <div className="r">{n(r.meters / 1000)}K</div>
                        <div className="d mono">
                          {isClub ? <b>The club · </b> : null}
                          {perDay(r.meters)} m a day
                        </div>
                        <div className="c mono">
                          {n(r.reached)} {r.reached === 1 ? "rower" : "rowers"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="l4-line mono">
                  Rowers on each rung, {l4.label}
                  {l4.finished ? "" : " so far"}
                </p>
              </>
            ) : null}
          </section>

          {/* OPT IN, once more, at the very end. */}
          <section className="l4-end">
            <OptIn href={SIGN_IN}>Opt in</OptIn>
            <Facts />
          </section>
        </div>
      </div>

      <RowFooter front />
    </div>
  );
}
