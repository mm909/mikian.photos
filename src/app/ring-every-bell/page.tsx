import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Countdown } from "@/components/foodrelay/Countdown";
import { CourseMap } from "@/components/foodrelay/CourseMap";
import { BellMark } from "@/components/foodrelay/Marks";
import { Faq, StopGrid, clock, hm, pace, startParts } from "@/components/foodrelay/Parts";
import { Profile } from "@/components/foodrelay/Profile";
import { css, frBody, frDisplay } from "@/components/foodrelay/theme";
import { VEGAS_SHIELDS } from "@/components/foodrelay/vegasRoads";
import { COURSE } from "./courseData";

/* RING EVERY BELL — THE TACO BELL 100K (owner, 2026-11-10, after the
 * Glizzy Gauntlet: "I also want the same thing but if we did it to all the
 * taco bells. This would probaby be a relay. Teams of 4-5", then "the taco
 * bell route could be the taco bell 100k"). A team relay on foot around a
 * 100-kilometer loop of 24 Taco Bells that starts and finishes at the
 * Cantina on the Strip. Every bell is an exchange zone; the runner who
 * arrives eats.
 *
 * THE OWNER'S CALLS (interview, same day): a one-day short course, not
 * the 169-mile tour of all 58 walk-up Taco Bells in the valley; the name
 * Ring Every Bell; "a weekend in February 2027" (Sat Feb 20 is the
 * stand-in, START below); teams of 4 to 5; landing page only.
 *
 * "EVERY" IS EVERY BELL ON THE COURSE, and the page says so in the open
 * (section 01, the first question): 24 of 58.
 *
 * LIVE BUT UNLISTED, like its sibling (/glizzy-gauntlet — see the note
 * there): robots off, no link in any menu. The link card is
 * public/ring-every-bell/og.png (scripts/food-relays/og-bells.html).
 *
 * The course is generated (scripts/food-relays/build-courses.mjs →
 * courseData.ts) and the time math below is worked out from START, the
 * store hours in the data and the course length. The homage rules (keep
 * the wrappers, no antacids) and two of the bonus challenges are borrowed
 * from the Taco Bell 50K in Denver and credited on the page. What I
 * assumed rather than was told is marked ASSUMED. */

/* The www host is the one that serves: the bare domain answers with a 307
 * to it, and a link-card crawler should not have to follow a redirect to
 * find the picture. */
const SITE = "https://www.mikianmusser.com";
const PATH = "/ring-every-bell";

/* STAND-IN DATE. 7:00 AM: the Cantina never closes and the first stores
 * that keep hours are open by the time a runner can reach them (see the
 * clock section). Las Vegas is UTC-8 in February. */
const START = "2027-02-20T07:00:00-08:00";
/* Sunset in Las Vegas on Feb 20, to the nearest five minutes. */
const SUNSET_MIN = 17 * 60 + 25;
/* ASSUMED: a tag at the door, a runner out of the van, a runner into it. */
const EXCHANGE_MIN = 3;
/* The whole valley, for the honest count (locations.tacobell.com,
 * 2026-11-10; the 169 miles is the shortest on-foot tour I could find,
 * finishing at the Cantina). */
const VALLEY_BELLS = 58;
const VALLEY_TOUR_MI = 169;
/* ASSUMED: where a team says it is in, until there is a sign-up. */
const OWNER_IG = "mikian_";

const TITLE = "Ring Every Bell — the Taco Bell 100K, Las Vegas";
const DESCRIPTION =
  "A team relay on foot around 24 Taco Bells: one 100-kilometer loop that starts and finishes at the Cantina on the Las Vegas Strip. The runner who arrives eats.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE}${PATH}`,
    type: "website",
    images: [{ url: `${SITE}${PATH}/og.png`, width: 1200, height: 630, alt: "Ring Every Bell: the Taco Bell 100K. 24 Taco Bells, one loop, one day." }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE}${PATH}/og.png`] },
};

export const viewport: Viewport = { themeColor: "#fbf4e6" };

const BRAND = "Taco Bell";

/* Calories per item, rounded, from Taco Bell's nutrition pages. Recipes
 * change; the calculator on tacobell.com is the authority. No prices:
 * they differ store to store. */
const MENU: { item: string; cal: number }[] = [
  { item: "Crunchy Taco", cal: 170 },
  { item: "Bean Burrito", cal: 360 },
  { item: "Crunchwrap Supreme", cal: 530 },
  { item: "Nachos BellGrande", cal: 740 },
];

const num = (n: number) => n.toLocaleString("en-US");

export default function RingEveryBellPage() {
  const start = startParts(START);
  const stops = COURSE.stops;
  const n = stops.length;
  const miles = COURSE.totalMi;
  const km = Math.round(COURSE.totalKm);
  const cantina = stops[0];
  const hops = stops.slice(1).map((s) => s.legMi).concat(COURSE.closeMi);
  const shortHop = Math.min(...hops);
  const longHop = Math.max(...hops);

  /* Store hours against the start: the first store a fast team can beat
   * to its own opening, and the ones that open after 8. */
  const opensMin = (s: (typeof stops)[number]) => (s.opens === "24" ? 0 : Number(s.opens) * 60);
  const firstGate = stops.find((s) => opensMin(s) > start.minutes);
  const gatePace = firstGate ? (opensMin(firstGate) - start.minutes) / firstGate.mi : null;
  const lateOpeners = stops.filter((s) => opensMin(s) >= 9 * 60);
  const allDay = stops.filter((s) => s.opens === "24").length;

  const exchMin = (n - 1) * EXCHANGE_MIN;
  const paces = [7.5, 8.5, 9.5, 10.5].map((p) => {
    const run = p * miles;
    const done = start.minutes + run + exchMin;
    return { p, run, total: run + exchMin, finish: clock(start.minutes, run + exchMin), light: SUNSET_MIN - done };
  });
  const dinnerPace = Math.floor(((SUNSET_MIN - start.minutes - exchMin) / miles) * 60) / 60;

  /* A team of four splits 24 bells evenly: six hops, six items each. */
  const itemsEach = n / 4;
  const milesEach4 = miles / 4;

  const faq = [
    {
      q: `Every bell? There are ${VALLEY_BELLS}.`,
      a: (
        <p>
          Every bell on the course. Las Vegas, Henderson and North Las Vegas have {VALLEY_BELLS} walk-up Taco Bells between
          them, and the shortest tour of all of them on foot is about {VALLEY_TOUR_MI} miles. This loop takes {km} kilometers
          and rings {n}.
        </p>
      ),
    },
    {
      q: "Why 100K?",
      a: (
        <p>
          Denver has the Taco Bell 50K: ten Taco Bells, 31 miles, one stomach. Las Vegas has more Taco Bells, so this one is
          twice as long and you get to bring friends.
        </p>
      ),
    },
    {
      q: "Why the Cantina?",
      a: (
        <p>
          It is the flagship: on the Strip, open 24 hours, pours drinks and has its own wedding chapel. It is the only
          reasonable place to start a day like this and the only reasonable place to end one.
        </p>
      ),
    },
    {
      q: "What if a lobby is closed?",
      a: (
        <p>
          Lobby hours can be shorter than the hours on the door, especially early in the morning. The van may order at the
          drive-thru or on the app. The runner only has to reach the door, and the food has to be in that runner before
          their next hop.
        </p>
      ),
    },
    {
      q: "Is there an entry fee?",
      a: <p>No. You pay for your own food and your own gas.</p>,
    },
    {
      q: "Do we need a van?",
      a: (
        <p>
          Yes. One vehicle, and somebody driving it who is not the runner on the road. The van does more driving than
          anyone does running: {n} stops in one day.
        </p>
      ),
    },
    {
      q: "Can I run it alone?",
      a: (
        <p>
          Yes. One runner, {km} kilometers, {n} menu items. Nobody is asking you to.
        </p>
      ),
    },
    {
      q: "What if we cannot finish?",
      a: (
        <p>
          Every bell is a place to stop, and there is one every {(miles / n).toFixed(1)} miles on average. Count the bells
          you rang and come back for the rest.
        </p>
      ),
    },
    {
      q: "What is the weather in late February?",
      a: (
        <p>
          Highs in the low 60s Fahrenheit, lows in the low 40s, usually dry. The sun is up around 6:20 AM and down around{" "}
          {clock(SUNSET_MIN, 0)}.
        </p>
      ),
    },
    {
      q: "Is this an official Taco Bell event?",
      a: <p>No. Taco Bell has nothing to do with it. See the fine print below.</p>,
    },
  ];

  return (
    <div className={`fr fr-bells ${frDisplay.variable} ${frBody.variable}`}>
      <style>{css}</style>

      <div className="fr-bar">
        <div className="fr-wm">
          <BellMark size={30} />
          Ring Every Bell
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
                <span>Ring</span>
                <span>Every</span>
                <span className="hl">Bell</span>
              </h1>
              <p className="fr-sub">
                The Taco Bell {km}K. {n} bells, one loop, one day.
              </p>
              <p className="fr-lede">
                A team relay on foot around {n} Taco Bells, starting and finishing at the Cantina on the Las Vegas Strip.
                Every bell is an exchange zone. The runner who arrives eats.
              </p>
            </div>
            <div className="fr-art" aria-hidden="true">
              <BellMark size={300} />
            </div>
          </div>

          <div className="fr-stats">
            <div className="fr-stat">
              <div className="n">{n}</div>
              <div className="l">Taco Bells</div>
            </div>
            <div className="fr-stat">
              <div className="n">{km}K</div>
              <div className="l">{miles.toFixed(1)} miles on foot</div>
            </div>
            <div className="fr-stat">
              <div className="n">4–5</div>
              <div className="l">Runners per team</div>
            </div>
            <div className="fr-stat">
              <div className="n">{(miles / n).toFixed(1)}</div>
              <div className="l">Miles, the average hop</div>
            </div>
          </div>

          <div className="fr-start">
            <div>
              <div className="when">
                {start.dateLong} · {start.time}
              </div>
              <div className="where">
                {BRAND} Cantina, {cantina.address}, on the Strip. Out the door at {start.time}, back through it by dinner.
              </div>
            </div>
            <Countdown target={START} doneLabel="The bells are ringing." />
          </div>
          <p className="fr-fine">The date is pencilled in. It becomes ink when the teams are.</p>

          <div className="fr-cta">
            <a className="fr-btn" href="#course">
              See the loop
            </a>
            <a className="fr-btn ghost" href={`${PATH}/course.gpx`} download="ring-every-bell-100k.gpx">
              Download the GPX
            </a>
          </div>
        </div>
      </header>

      <section className="fr-sec" id="course">
        <div className="wrap">
          <div className="fr-kick">01 · The course</div>
          <h2>
            {n} bells, {km} kilometers, clockwise
          </h2>
          <p className="fr-intro">
            From the Strip the loop heads west to Fort Apache, north to Rancho, east across North Las Vegas, then down the
            east side and back to the Cantina. Hops run from {shortHop.toFixed(1)} to {longHop.toFixed(1)} miles.
          </p>
          <p className="fr-intro">
            The valley has {VALLEY_BELLS} walk-up Taco Bells. Ringing all of them is a {VALLEY_TOUR_MI}-mile job. This loop
            rings {n} of them in a day.
          </p>

          <div className="fr-course wide">
            <div className="fr-map">
              <CourseMap
                course={COURSE}
                brand={BRAND}
                label={`Map of the loop: ${n} Taco Bells, clockwise from the Cantina on the Strip. The stops are listed below the map.`}
                names={[1]}
                arrowEvery={3}
                pad={{ t: 0.07, r: 0.08, b: 0.12, l: 0.07 }}
                labelPos={{ 1: { dx: 0, dy: 72, anchor: "middle" } }}
                areas={[
                  { name: "North Las Vegas", lat: 36.232, lon: -115.152 },
                  { name: "Downtown", lat: 36.166, lon: -115.142 },
                  { name: "Summerlin", lat: 36.176, lon: -115.292 },
                  { name: "Spring Valley", lat: 36.122, lon: -115.243 },
                ]}
                shields={VEGAS_SHIELDS}
              />
            </div>
          </div>

          <div className="fr-profile">
            <div className="fr-profile-head">
              <span>
                The Cantina <b>{num(COURSE.profile[0][1])} ft</b>
              </span>
              <span>
                High point <b>{num(COURSE.highFt)} ft</b>
              </span>
              <span>
                Low point <b>{num(COURSE.lowFt)} ft</b>
              </span>
            </div>
            <Profile course={COURSE} />
          </div>

          <StopGrid course={COURSE} brand={BRAND} />
          <p className="fr-cap">
            Opening times are each store’s Saturday hours as listed in November 2026; {allDay} of the {n} never close. Course
            v1: a routing engine drew this line along sidewalks and paths. Every hop gets scouted on foot before race day,
            and the line moves wherever the ground disagrees with the map. Map data © OpenStreetMap contributors.
          </p>
        </div>
      </section>

      <section className="fr-sec tint" id="relay">
        <div className="wrap">
          <div className="fr-kick">02 · The relay</div>
          <h2>Run in. Tag out. Eat.</h2>
          <p className="fr-intro">
            The team shares {km} kilometers. Each runner eats at the bells they run to, so nobody runs a hop for free.
          </p>
          <div className="fr-cards">
            <div className="fr-card">
              <h3>Teams of 4 or 5</h3>
              <p>
                Four runners take {n / 4} hops each, about {(COURSE.totalKm / 4).toFixed(0)} kilometers apiece. Five take
                four or five hops, about {(COURSE.totalKm / 5).toFixed(0)} kilometers.
              </p>
            </div>
            <div className="fr-card">
              <h3>Every bell is an exchange zone</h3>
              <p>
                {n} hops of {shortHop.toFixed(1)} to {longHop.toFixed(1)} miles. Run to the door, tag the next runner, get in
                the van. Hand off at a Taco Bell and nowhere else.
              </p>
            </div>
            <div className="fr-card">
              <h3>The runner who arrives eats</h3>
              <p>
                One menu item at the bell you ran to, finished before your next hop. On a team of four that is {itemsEach}{" "}
                items each by the finish.
              </p>
            </div>
            <div className="fr-card">
              <h3>The van does the ordering</h3>
              <p>
                It drives ahead, drops the next runner at the door and orders: lobby, drive-thru or app. The food should be
                waiting when the runner comes in.
              </p>
            </div>
            <div className="fr-card">
              <h3>The Cantina, twice</h3>
              <p>
                Touch the door at {start.time} and go. The last runner brings the loop back to the same door and eats bell
                number {n} inside.
              </p>
            </div>
            <div className="fr-card">
              <h3>Doubling up is allowed</h3>
              <p>
                A runner may take two hops in a row. They still eat at both bells. The team decides who can stomach what.
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
                <b>Ring all {n} bells, in order.</b> Clockwise from the Cantina. A team member touches the door of every one,
                and every mile between them is covered on foot. No course cutting.
              </p>
            </li>
            <li>
              <span className="n">2</span>
              <p>
                <b>One runner on the road at a time.</b> Hand off only at a Taco Bell.
              </p>
            </li>
            <li>
              <span className="n">3</span>
              <p>
                <b>The runner who arrives eats.</b> One menu item from that bell, finished before that runner’s next hop.
                Drinks and sauce packets are not menu items.
              </p>
            </li>
            <li>
              <span className="n">4</span>
              <p>
                <b>The Cantina counts once, at the finish.</b> The last runner in eats there. That is item number {n}.
              </p>
            </li>
            <li>
              <span className="n">5</span>
              <p>
                <b>If a store is not open yet, you wait.</b> Opening hours are part of the course. Nobody gets credit for a
                locked door.
              </p>
            </li>
            <li>
              <span className="n">6</span>
              <p>
                <b>Keep every receipt and every wrapper.</b> They are the proof, along with a GPS track of the whole loop. A
                rule borrowed from the Taco Bell 50K.
              </p>
            </li>
            <li>
              <span className="n">7</span>
              <p>
                <b>No antacids on the course.</b> No Pepto, no Alka-Seltzer, no Pepcid, no Mylanta. Also borrowed from the Taco
                Bell 50K, and also non-negotiable.
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
                <b>Lights after dark.</b> A front light, a rear light and something reflective on any runner still out after
                sunset.
              </p>
            </li>
            <li>
              <span className="n">+</span>
              <p>
                More rules may appear to protect the spirit of the event, which is to find out how many Taco Bells one day
                can hold.
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
              <h3>Taco purist</h3>
              <p>A Crunchy Taco at all {n} bells and nothing else. The lightest way around, and the most repetitive.</p>
            </div>
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Menu master</h3>
              <p>
                {n} bells, {n} different menu items. Somebody has to keep the list.
              </p>
            </div>
            <div className="fr-card">
              <span className="tag">From the 50K</span>
              <h3>Diablo</h3>
              <p>Every item wears Diablo sauce, and the team takes a Diablo shooter at the finish.</p>
            </div>
            <div className="fr-card">
              <span className="tag">From the 50K</span>
              <h3>Baja Blast</h3>
              <p>Every runner drinks two liters of Baja Blast between the first bell and the last, and keeps it down.</p>
            </div>
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Done by dinner</h3>
              <p>
                Back at the Cantina before the sun sets at about {clock(SUNSET_MIN, 0)}. That takes roughly{" "}
                {pace(dinnerPace)} a mile with {EXCHANGE_MIN}-minute exchanges.
              </p>
            </div>
            <div className="fr-card">
              <span className="tag">Solo</span>
              <h3>The double</h3>
              <p>
                One runner, all {km} kilometers, all {n} items. Denver’s Taco Bell 50K, twice, in one go.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="fr-sec" id="clock">
        <div className="wrap">
          <div className="fr-kick">05 · The clock</div>
          <h2>Out at {start.time}, back by dinner</h2>
          <p className="fr-intro">
            The table allows {EXCHANGE_MIN} minutes at each exchange. Sunset is about {clock(SUNSET_MIN, 0)}.
          </p>
          <div className="fr-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Team pace</th>
                  <th className="num">Running</th>
                  <th className="num">With exchanges</th>
                  <th className="num">Back at the Cantina</th>
                  <th className="num">Daylight left</th>
                </tr>
              </thead>
              <tbody>
                {paces.map((r) => (
                  <tr key={r.p} className={r.light < 0 ? "hot" : undefined}>
                    <td className="big">{pace(r.p)} / mile</td>
                    <td className="num">{hm(r.run)}</td>
                    <td className="num">{hm(r.total)}</td>
                    <td className="num">{r.finish}</td>
                    <td className="num">{r.light >= 0 ? hm(r.light) : "After dark"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fr-cap">
            {firstGate && gatePace !== null && (
              <>
                Store hours keep the early pace honest. The first store that keeps hours is {firstGate.name} at mile{" "}
                {firstGate.mi.toFixed(1)}, which opens at {firstGate.opens}:00 AM: a team running faster than {pace(gatePace)}{" "}
                a mile gets there early and waits at the door.{" "}
              </>
            )}
            {lateOpeners.length > 0 && (
              <>
                The late openers, {lateOpeners.map((s) => `${s.name} (${s.opens}:00 AM, mile ${s.mi.toFixed(1)})`).join(" and ")},
                sit on the back half of the loop on purpose.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="fr-sec tint" id="math">
        <div className="wrap">
          <div className="fr-kick">06 · Taco math</div>
          <h2>What {itemsEach} bells do to one runner</h2>
          <p className="fr-intro">
            On a team of four each runner covers about {milesEach4.toFixed(1)} miles and eats {itemsEach} items. Running that
            far burns roughly {num(Math.round(milesEach4 * 10) * 10)} calories.
          </p>
          <div className="fr-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>If you order</th>
                  <th className="num">Each</th>
                  <th className="num">Times {itemsEach}</th>
                  <th className="num">Against the run</th>
                </tr>
              </thead>
              <tbody>
                {MENU.map((m) => {
                  const net = m.cal * itemsEach - Math.round(milesEach4 * 10) * 10;
                  return (
                    <tr key={m.item}>
                      <td className="big">{m.item}</td>
                      <td className="num">about {num(m.cal)}</td>
                      <td className="num">about {num(m.cal * itemsEach)}</td>
                      <td className="num">{net > 0 ? `${num(net)} over` : `${num(-net)} under`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="fr-cap">
            The taco purist finishes in a deficit. Nobody else does. Calories are rounded from Taco Bell’s nutrition pages and
            recipes change; the calculator on tacobell.com is the authority.
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
            Four or five runners and a van. Tell Mikian your team is in and you will hear the moment the date is ink:{" "}
            <a href={`https://www.instagram.com/${OWNER_IG}/`} target="_blank" rel="noopener noreferrer">
              @{OWNER_IG} on Instagram
            </a>
            .
          </p>
        </div>
      </section>

      <section className="fr-fineprint">
        <div className="wrap">
          <h3>Not affiliated with Taco Bell</h3>
          <p>
            Ring Every Bell is not affiliated with, sponsored by or endorsed by Taco Bell Corp. or Yum! Brands. It is an
            independent, unofficial run organized by friends. Be a good customer: order politely, clean up after
            yourselves and leave every store the way you found it.
          </p>
          <h3>Your own risk</h3>
          <p>
            This is a self-supported run on open public roads and sidewalks. There are no permits, no road closures, no aid
            stations, no course marshals and no medical support. By taking part you accept all of the risk of doing so,
            including injury, accident, property damage and whatever {n} Taco Bells do to a person. You are responsible for
            your own navigation, food, water, safety and for obeying every traffic law, on foot and behind the wheel. Know
            your limits and stop when you should.
          </p>
        </div>
      </section>

      <footer className="fr-foot">
        <div className="wrap">
          <div className="fr-sib">
            <div>
              <div className="k">Also on the calendar</div>
              <div className="t">Vegas Glizzy Gauntlet</div>
              <div className="s">Five Costco food courts, 48 miles across the valley, one glizzy at every stop.</div>
            </div>
            <Link className="fr-btn" href="/glizzy-gauntlet">
              See that one
            </Link>
          </div>
          <p>
            Inspired by the{" "}
            <a href="https://tacobell50k.com" target="_blank" rel="noopener noreferrer">
              Taco Bell 50K
            </a>{" "}
            in Denver, the original bad idea, and by the{" "}
            <a href="https://ggg.lmarx.com" target="_blank" rel="noopener noreferrer">
              Great Glizzy Gauntlet
            </a>{" "}
            in Utah. Credit where it is due.
          </p>
          <p>© 2026 Ring Every Bell. Run safely. Keep the wrappers.</p>
        </div>
      </footer>
    </div>
  );
}
