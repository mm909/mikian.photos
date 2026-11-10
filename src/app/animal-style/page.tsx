import type { Metadata, Viewport } from "next";
import { Countdown } from "@/components/foodrelay/Countdown";
import { CourseMap } from "@/components/foodrelay/CourseMap";
import { BurgerMark } from "@/components/foodrelay/Marks";
import { Faq, Siblings, StopGrid, clock, hm, pace, startParts } from "@/components/foodrelay/Parts";
import { Profile } from "@/components/foodrelay/Profile";
import { SERIES } from "@/components/foodrelay/series";
import { css, frBody, frDisplay } from "@/components/foodrelay/theme";
import { COURSE } from "./courseData";

/* ANIMAL STYLE (owner, 2026-11-10, after the Glizzy Gauntlet and Ring
 * Every Bell: "Actually do a version of this but for In and Outs"). A team
 * relay on foot to every In-N-Out in the Las Vegas valley — all 19 — in
 * one business day: the doors open at 10:30 AM at St. Rose in Henderson
 * and the last burger is ordered at the LINQ on the Strip before a
 * Saturday night's 1:30 AM close. 87.2 miles.
 *
 * THE OWNER'S CALLS (interview, same day): all 19 with the Strip finish
 * (over the 3.5-mile-shorter line that ends on Craig Road, a 17-store
 * "4x4" and a 14-store double marathon); the name Animal Style; Sat Mar
 * 20, 2027 as the stand-in (series.ts); and "Yes, publish it live" — LIVE
 * BUT UNLISTED like its two siblings: robots off, no link in any menu,
 * linked only from the other two pages' feet.
 *
 * Unlike Ring Every Bell, "every" here is every store: In-N-Out's own
 * locator listed 19 between Henderson and North Las Vegas on the day the
 * course was drawn, and the line rings all of them. A store that opens
 * before race day joins the course (scripts/food-relays/build-courses.mjs).
 *
 * The time math is worked out below from the start, the closing time and
 * the course length. The rule that every burger is ordered Animal Style is
 * mine, to give the owner's name for the event a job. What I assumed
 * rather than was told is marked ASSUMED. */

const SITE = "https://www.mikianmusser.com";
const PATH = "/animal-style";

const START = SERIES["animal-style"].start;
/* A Saturday night's close, as minutes past the midnight the day began
 * on: 1:30 AM Sunday (every store page lists Sunday to Thursday 10:30 AM
 * to 1:00 AM, Friday and Saturday to 1:30 AM; read 2026-11-10). */
const CLOSE_MIN = 25 * 60 + 30;
/* Sunset in Las Vegas on Mar 20, to the nearest five minutes. */
const SUNSET_MIN = 18 * 60 + 55;
/* ASSUMED: a tag at the door, a runner out of the van, a runner into it. */
const EXCHANGE_MIN = 3;
/* ASSUMED: where a team says it is in, until there is a sign-up. */
const OWNER_IG = "mikian_";

const TITLE = "Animal Style — all 19 In-N-Outs, 87 miles, open to close";
const DESCRIPTION =
  "A team relay on foot to every In-N-Out in the Las Vegas valley in one business day. 19 stores, 87 miles, and the runner who arrives eats.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE}${PATH}`,
    type: "website",
    images: [{ url: `${SITE}${PATH}/og.png`, width: 1200, height: 630, alt: "Animal Style: all 19 In-N-Outs, 87 miles, open to close." }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE}${PATH}/og.png`] },
};

export const viewport: Viewport = { themeColor: "#fbf4e6" };

const BRAND = "In-N-Out";

/* Calories for the standard burgers, with spread and onion, as In-N-Out
 * has long published them. Animal Style adds spread and grilled onions on
 * top; the nutrition page on in-n-out.com is the authority. No prices:
 * the menu board has them. */
const MENU: { item: string; cal: number }[] = [
  { item: "Hamburger", cal: 390 },
  { item: "Cheeseburger", cal: 480 },
  { item: "Double-Double", cal: 670 },
];

const num = (n: number) => n.toLocaleString("en-US");

export default function AnimalStylePage() {
  const start = startParts(START);
  const stops = COURSE.stops;
  const n = stops.length;
  const miles = COURSE.totalMi;
  const first = stops[0];
  const last = stops[n - 1];
  const hops = stops.slice(1).map((s) => s.legMi);
  const shortHop = Math.min(...hops);
  const longHop = Math.max(...hops);
  const ftAt = (mi: number) => COURSE.profile.reduce((a, b) => (Math.abs(b[0] - mi) < Math.abs(a[0] - mi) ? b : a))[1];
  const highStop = stops.reduce((a, b) => (ftAt(b.mi) > ftAt(a.mi) ? b : a));

  /* The clock: the first order goes in at START, the last has to go in
   * before the doors lock, and every store in between costs an exchange. */
  const windowMin = CLOSE_MIN - start.minutes;
  const exchMin = (n - 2) * EXCHANGE_MIN;
  const slowest = Math.floor(((windowMin - exchMin) / miles) * 60) / 60;
  const paces = [8, 8.5, 9, 9.5].map((p) => {
    const run = p * miles;
    return { p, run, total: run + exchMin, finish: clock(start.minutes, run + exchMin), spare: windowMin - (run + exchMin) };
  });
  const midnightPace = Math.floor(((24 * 60 - start.minutes - exchMin) / miles) * 60) / 60;
  const darkMi = Math.round(miles - ((SUNSET_MIN - start.minutes) / (9 * miles + exchMin)) * miles);

  /* A team of four: 19 burgers is five, five, five and four. The table
   * takes the runner with five. */
  const burgersEach = Math.ceil(n / 4);
  const milesEach4 = miles / 4;
  const burnEach4 = Math.round(milesEach4 * 10) * 10;

  const faq = [
    {
      q: "Is that really every In-N-Out?",
      a: (
        <p>
          Yes. In-N-Out lists {n} stores between Henderson and North Las Vegas and the course rings all of them. If another
          one opens before race day, it joins the line.
        </p>
      ),
    },
    {
      q: "What is Animal Style?",
      a: (
        <p>
          The best-known order on the not-so-secret menu: the patty cooked in mustard, with pickles, extra spread and
          grilled onions. It is also the name of the event, so it is how every burger on the course gets ordered.
        </p>
      ),
    },
    {
      q: "Why does it start at 10:30?",
      a: (
        <p>
          Because that is when In-N-Out unlocks the doors, everywhere, every day. Nothing can be ordered before then, so
          nothing starts before then.
        </p>
      ),
    },
    {
      q: "Why a Saturday?",
      a: (
        <p>
          The stores close at 1:00 AM from Sunday to Thursday and at {clock(CLOSE_MIN, 0)} on Friday and Saturday nights.
          Half an hour matters at the end of {miles.toFixed(0)} miles.
        </p>
      ),
    },
    {
      q: "What about the lines?",
      a: (
        <p>
          In-N-Out lines are part of the course. The van drives ahead and orders, so the burger should be waiting when the
          runner arrives. The stores on the Strip have no drive-thru: somebody walks in.
        </p>
      ),
    },
    {
      q: "Is there an entry fee?",
      a: <p>No. You pay for your own burgers and your own gas.</p>,
    },
    {
      q: "Do we need a van?",
      a: (
        <p>
          Yes. One vehicle, and somebody driving it who is not the runner on the road. It is a long day behind the wheel
          too: bring a second driver.
        </p>
      ),
    },
    {
      q: "Can I run it alone?",
      a: (
        <p>
          You could try. One runner, {miles.toFixed(0)} miles, {n} burgers, {hm(windowMin).split(":")[0]} hours. Nobody is
          asking you to.
        </p>
      ),
    },
    {
      q: "What if we cannot finish?",
      a: (
        <p>
          Every store is a place to stop, with parking, bathrooms and dinner. Count the ones you reached. A team that runs
          out of clock at store 15 still ran {stops[14].mi.toFixed(0)} miles.
        </p>
      ),
    },
    {
      q: "What is the weather in late March?",
      a: (
        <p>
          Highs around 70 Fahrenheit, lows around 50, usually dry and often windy. The sun sets at about{" "}
          {clock(SUNSET_MIN, 0)}, so the last third of the course or more is run in the dark.
        </p>
      ),
    },
    {
      q: "Is this an official In-N-Out event?",
      a: <p>No. In-N-Out has nothing to do with it. See the fine print below.</p>,
    },
  ];

  return (
    <div className={`fr fr-animal ${frDisplay.variable} ${frBody.variable}`}>
      <style>{css}</style>

      <div className="fr-bar">
        <div className="fr-wm">
          <BurgerMark size={30} />
          Animal Style
        </div>
        <nav className="fr-nav" aria-label="On this page">
          <a href="#course">Course</a>
          <a href="#relay">Relay</a>
          <a href="#rules">Rules</a>
          <a href="#clock">Clock</a>
          <a href="#faq">FAQ</a>
        </nav>
      </div>

      <header className="fr-hero">
        <div className="wrap">
          <div className="fr-hero-grid">
            <div>
              <div className="fr-chips">
                <span className="fr-chip on">Las Vegas</span>
                <span className="fr-chip">{start.dateShort}</span>
                <span className="fr-chip">Team relay</span>
                <span className="fr-chip alt">No entry fee</span>
              </div>
              <h1>
                <span>Animal</span>
                <span className="hl">Style</span>
              </h1>
              <p className="fr-sub">
                All {n} In-N-Outs. {miles.toFixed(0)} miles. Open to close.
              </p>
              <p className="fr-lede">
                A team relay on foot to every In-N-Out in the Las Vegas valley, in one business day. The doors open at{" "}
                {start.time} in Henderson. The last burger has to be ordered on the Strip before they lock at{" "}
                {clock(CLOSE_MIN, 0)}.
              </p>
            </div>
            <div className="fr-art" aria-hidden="true">
              <BurgerMark size={340} />
            </div>
          </div>

          <div className="fr-stats">
            <div className="fr-stat">
              <div className="n">{n}</div>
              <div className="l">In-N-Outs, all of them</div>
            </div>
            <div className="fr-stat">
              <div className="n">{miles.toFixed(0)}</div>
              <div className="l">Miles on foot</div>
            </div>
            <div className="fr-stat">
              <div className="n">4–5</div>
              <div className="l">Runners per team</div>
            </div>
            <div className="fr-stat">
              <div className="n">{hm(windowMin).split(":")[0]}</div>
              <div className="l">Hours, open to close</div>
            </div>
          </div>

          <div className="fr-start">
            <div>
              <div className="when">
                {start.dateLong} · {start.time}
              </div>
              <div className="where">
                {BRAND} {first.name}, {first.address}, {first.city}. The doors open, the first burger goes down, the first
                runner leaves.
              </div>
            </div>
            <Countdown target={START} doneLabel="The grill is on." />
          </div>
          <p className="fr-fine">The date is pencilled in. It becomes ink when the teams are.</p>

          <div className="fr-cta">
            <a className="fr-btn" href="#course">
              See the course
            </a>
            <a className="fr-btn ghost" href={`${PATH}/course.gpx`} download="animal-style.gpx">
              Download the GPX
            </a>
          </div>
        </div>
      </header>

      <section className="fr-sec" id="course">
        <div className="wrap">
          <div className="fr-kick">01 · The course</div>
          <h2>
            {n} stores, {miles.toFixed(0)} miles, one line
          </h2>
          <p className="fr-intro">
            The line starts in Henderson, runs up the east side to North Las Vegas, crosses the top of the valley to
            Centennial, comes down the west side, and turns in through the south to finish on the Strip. Hops run from{" "}
            {shortHop.toFixed(1)} to {longHop.toFixed(1)} miles.
          </p>
          <p className="fr-intro">That is every In-N-Out in the valley. Nothing is left over for next year.</p>

          <div className="fr-course long">
            <div>
              <div className="fr-map">
                <CourseMap
                  course={COURSE}
                  brand={BRAND}
                  label={`Map of the course: ${n} In-N-Outs from ${first.name} in Henderson to ${last.name} on the Strip. The stops are listed beside the map.`}
                  names={[1, n]}
                  size="large"
                  arrowEvery={2}
                  pad={{ t: 0.08, r: 0.09, b: 0.13, l: 0.09 }}
                  labelPos={{
                    1: { dx: 36, dy: 30, anchor: "start", name: null, tag: "START" },
                    [n]: { dx: 32, dy: -14, anchor: "start", name: null, tag: "FINISH" },
                  }}
                  areas={[
                    { name: "Henderson", lat: 36.028, lon: -115.045 },
                    { name: "Summerlin", lat: 36.2, lon: -115.312 },
                  ]}
                />
              </div>
              <div className="fr-profile">
                <div className="fr-profile-head">
                  <span>
                    Start <b>{num(ftAt(0))} ft</b>
                  </span>
                  <span>
                    High <b>{num(COURSE.highFt)} ft</b>, near {highStop.name}
                  </span>
                  <span>
                    Finish <b>{num(ftAt(miles))} ft</b>
                  </span>
                </div>
                <Profile course={COURSE} numbers={false} />
              </div>
              <p className="fr-cap">
                Course v1. A routing engine drew this line along sidewalks and paths. Every hop gets scouted on foot before
                race day, and the line moves wherever the ground disagrees with the map. Map data © OpenStreetMap
                contributors.
              </p>
            </div>
            <div>
              <StopGrid course={COURSE} brand={BRAND} one />
              <p className="fr-cap">
                All {n} keep the same hours: {start.time} to 1:00 AM, and to {clock(CLOSE_MIN, 0)} on Friday and Saturday
                nights. Stores 16 and 19, on the Strip, are walk-up only.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="fr-sec tint" id="relay">
        <div className="wrap">
          <div className="fr-kick">02 · The relay</div>
          <h2>Run in. Order. Tag out.</h2>
          <p className="fr-intro">
            The team shares {miles.toFixed(0)} miles. Each runner eats at the stores they run to, so nobody runs a hop for
            free.
          </p>
          <div className="fr-cards">
            <div className="fr-card">
              <h3>Teams of 4 or 5</h3>
              <p>
                Four runners cover about {(miles / 4).toFixed(0)} miles each. Five cover about {(miles / 5).toFixed(0)}. Bring
                two people who can drive.
              </p>
            </div>
            <div className="fr-card">
              <h3>Every store is an exchange zone</h3>
              <p>
                {n - 1} hops of {shortHop.toFixed(1)} to {longHop.toFixed(1)} miles. Hand off at a store, or split a long
                hop anywhere it is safe and legal to pull over.
              </p>
            </div>
            <div className="fr-card">
              <h3>The runner who arrives eats</h3>
              <p>
                One burger at the store you ran to, ordered Animal Style, finished before your next turn on the road. That is{" "}
                {n} burgers a team.
              </p>
            </div>
            <div className="fr-card">
              <h3>Store one counts too</h3>
              <p>
                The first runner eats at {first.name} before leaving. The clock starts with that order, at {start.time}{" "}
                sharp.
              </p>
            </div>
            <div className="fr-card">
              <h3>The van does the ordering</h3>
              <p>
                It drives ahead, drops the next runner at the door and gets in line. Drive-thru is fair for the van. The
                runner only has to reach the door.
              </p>
            </div>
            <div className="fr-card">
              <h3>Open to close</h3>
              <p>
                The last order goes in at {last.name} before {clock(CLOSE_MIN, 0)}. A team that is still on the road when
                the doors lock has not finished.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="fr-sec" id="rules">
        <div className="wrap">
          <div className="fr-kick">03 · The rules</div>
          <h2>Nine rules and a spirit clause</h2>
          <ol className="fr-rules">
            <li>
              <span className="n">1</span>
              <p>
                <b>Reach all {n} stores, in order.</b> {first.name} first, {last.name} last. A team member touches the door
                of every one, and every mile between them is covered on foot. No course cutting.
              </p>
            </li>
            <li>
              <span className="n">2</span>
              <p>
                <b>One runner on the road at a time.</b> Swap at a store, or anywhere between two stores that is safe and
                legal to stop a vehicle.
              </p>
            </li>
            <li>
              <span className="n">3</span>
              <p>
                <b>The runner who arrives eats.</b> One burger from that store, finished before that runner’s next turn on
                the road. At the start, the first runner eats before leaving.
              </p>
            </li>
            <li>
              <span className="n">4</span>
              <p>
                <b>Order it Animal Style.</b> Hamburger, cheeseburger or Double-Double, your call, but Animal Style every
                time. A grilled cheese ordered Animal Style counts for anyone who does not eat beef.
              </p>
            </li>
            <li>
              <span className="n">5</span>
              <p>
                <b>Fries and shakes do not count.</b> They are also not forbidden.
              </p>
            </li>
            <li>
              <span className="n">6</span>
              <p>
                <b>Inside business hours.</b> Nothing is ordered before {start.time}. The last order goes in at {last.name}{" "}
                before {clock(CLOSE_MIN, 0)}.
              </p>
            </li>
            <li>
              <span className="n">7</span>
              <p>
                <b>Keep every receipt and record the run.</b> A receipt from each of the {n} stores and a GPS track of the
                whole line are the proof. Hand the watch off or stitch the files together.
              </p>
            </li>
            <li>
              <span className="n">8</span>
              <p>
                <b>Open roads, real laws.</b> Nothing is closed and nobody is marshalling. Runners use sidewalks and paths
                and cross with the signal. Drivers park legally and never follow a runner at running speed.
              </p>
            </li>
            <li>
              <span className="n">9</span>
              <p>
                <b>Lights after dark.</b> A front light, a rear light and something reflective on every runner from sunset,
                at about {clock(SUNSET_MIN, 0)}, to the finish.
              </p>
            </li>
            <li>
              <span className="n">+</span>
              <p>
                More rules may appear to protect the spirit of the event, which is to find out what {n} Animal Style burgers
                and {miles.toFixed(0)} miles do to a group of friends.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="fr-sec tint" id="bonus">
        <div className="wrap">
          <div className="fr-kick">04 · Bonus challenges</div>
          <h2>Ways to make it worse</h2>
          <div className="fr-cards">
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Double-Double or nothing</h3>
              <p>
                All {n} burgers are Double-Doubles. That is {n * 2} patties and {n * 2} slices of cheese across the team.
              </p>
            </div>
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Protein Style</h3>
              <p>All {n} burgers wrapped in lettuce instead of a bun. The low-carb way to make the same mistake.</p>
            </div>
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Fries with that</h3>
              <p>An order of fries with every burger, eaten by the same runner. Well done is allowed.</p>
            </div>
            <div className="fr-card">
              <span className="tag">One runner</span>
              <h3>The 4x4</h3>
              <p>Whoever brings the team into {last.name} orders a 4x4: four patties, four slices of cheese, one finish line.</p>
            </div>
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Before midnight</h3>
              <p>
                The last order at {last.name} goes in before midnight. That takes roughly {pace(midnightPace)} a mile with{" "}
                {EXCHANGE_MIN}-minute exchanges.
              </p>
            </div>
            <div className="fr-card">
              <span className="tag">Solo</span>
              <h3>Fully loaded</h3>
              <p>
                One runner, all {miles.toFixed(0)} miles, all {n} burgers, inside the {hm(windowMin).split(":")[0]} hours.
                Listed for completeness.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="fr-sec" id="clock">
        <div className="wrap">
          <div className="fr-kick">05 · The clock</div>
          <h2>{hm(windowMin).split(":")[0]} hours, open to close</h2>
          <p className="fr-intro">
            The doors set both ends. They open at {start.time} and lock at {clock(CLOSE_MIN, 0)} on a Saturday night. The
            table allows {EXCHANGE_MIN} minutes at each exchange.
          </p>
          <div className="fr-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Team pace</th>
                  <th className="num">Running</th>
                  <th className="num">With exchanges</th>
                  <th className="num">At {last.name}</th>
                  <th className="num">To spare</th>
                </tr>
              </thead>
              <tbody>
                {paces.map((r) => (
                  <tr key={r.p} className={r.spare < 30 ? "hot" : undefined}>
                    <td className="big">{pace(r.p)} / mile</td>
                    <td className="num">{hm(r.run)}</td>
                    <td className="num">{hm(r.total)}</td>
                    <td className="num">{r.finish}</td>
                    <td className="num">{hm(r.spare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fr-cap">
            The slowest pace that still gets the last order in is about {pace(slowest)} a mile, held for {miles.toFixed(0)}{" "}
            miles with a stomach full of burgers. Sunset is about {clock(SUNSET_MIN, 0)}: at nine minutes a mile, roughly the
            last {darkMi} miles are run in the dark.
          </p>
        </div>
      </section>

      <section className="fr-sec tint" id="math">
        <div className="wrap">
          <div className="fr-kick">06 · Burger math</div>
          <h2>What {burgersEach} burgers do to one runner</h2>
          <p className="fr-intro">
            On a team of four each runner covers about {milesEach4.toFixed(1)} miles and eats four or five burgers. Running
            that far burns roughly {num(burnEach4)} calories. The table takes the runner who eats {burgersEach}.
          </p>
          <div className="fr-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>If you order</th>
                  <th className="num">Each</th>
                  <th className="num">Times {burgersEach}</th>
                  <th className="num">Against the run</th>
                </tr>
              </thead>
              <tbody>
                {MENU.map((m) => {
                  const net = m.cal * burgersEach - burnEach4;
                  return (
                    <tr key={m.item}>
                      <td className="big">{m.item}</td>
                      <td className="num">about {num(m.cal)}</td>
                      <td className="num">about {num(m.cal * burgersEach)}</td>
                      <td className="num">{net > 0 ? `${num(net)} over` : `${num(-net)} under`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="fr-cap">
            These are the standard burgers. Animal Style adds spread and grilled onions, so the real numbers are higher.
            In-N-Out’s own nutrition page is the authority.
          </p>
        </div>
      </section>

      <section className="fr-sec" id="faq">
        <div className="wrap">
          <div className="fr-kick">07 · Questions</div>
          <h2>Before you ask</h2>
          <Faq items={faq} />
        </div>
      </section>

      <section className="fr-band" id="join">
        <div className="wrap">
          <h2>Get a team in</h2>
          <p>
            Four or five runners, a van and two drivers. Tell Mikian your team is in and you will hear the moment the date is
            ink:{" "}
            <a href={`https://www.instagram.com/${OWNER_IG}/`} target="_blank" rel="noopener noreferrer">
              @{OWNER_IG} on Instagram
            </a>
            .
          </p>
        </div>
      </section>

      <section className="fr-fineprint">
        <div className="wrap">
          <h3>Not affiliated with In-N-Out</h3>
          <p>
            Animal Style is not affiliated with, sponsored by or endorsed by In-N-Out Burgers. It is an independent,
            unofficial run organized by friends. Be a good customer: order politely, wait your turn, clean up after
            yourselves and leave every store the way you found it.
          </p>
          <h3>Your own risk</h3>
          <p>
            This is a self-supported run on open public roads and sidewalks, and a long stretch of it happens after dark.
            There are no permits, no road closures, no aid stations, no course marshals and no medical support. By taking
            part you accept all of the risk of doing so, including injury, accident and property damage. You are responsible
            for your own navigation, food, water, safety and for obeying every traffic law, on foot and behind the wheel.
            Tired drivers are the biggest danger on a day this long: swap them as carefully as you swap runners. Know your
            limits and stop when you should.
          </p>
        </div>
      </section>

      <footer className="fr-foot">
        <div className="wrap">
          <Siblings current="animal-style" />
          <p>
            Third in a series with the Vegas Glizzy Gauntlet and Ring Every Bell, and modeled like them on the{" "}
            <a href="https://ggg.lmarx.com" target="_blank" rel="noopener noreferrer">
              Great Glizzy Gauntlet
            </a>{" "}
            in Utah and the{" "}
            <a href="https://tacobell50k.com" target="_blank" rel="noopener noreferrer">
              Taco Bell 50K
            </a>{" "}
            in Denver. Credit where it is due.
          </p>
          <p>© 2026 Animal Style. Run safely. Keep the receipts.</p>
        </div>
      </footer>
    </div>
  );
}
