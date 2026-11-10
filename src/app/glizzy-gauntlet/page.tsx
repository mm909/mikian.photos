import type { Metadata, Viewport } from "next";
import { Countdown } from "@/components/foodrelay/Countdown";
import { CourseMap } from "@/components/foodrelay/CourseMap";
import { GlizzyMark } from "@/components/foodrelay/Marks";
import { Faq, Siblings, StopRail, clock, hm, pace, startParts } from "@/components/foodrelay/Parts";
import { Profile } from "@/components/foodrelay/Profile";
import { SERIES } from "@/components/foodrelay/series";
import { css, frBody, frDisplay } from "@/components/foodrelay/theme";
import { VEGAS_SHIELDS } from "@/components/foodrelay/vegasRoads";
import { COURSE } from "./courseData";

/* THE VEGAS GLIZZY GAUNTLET (owner, 2026-11-10, of ggg.lmarx.com, the
 * Great Glizzy Gauntlet — a 100-mile bike ride to ten Utah Costcos: "Make
 * a site like this but for running it and in Las Vegas"). A team relay on
 * foot through every Costco food court in the valley, north to south:
 * Centennial, Summerlin, Spring Valley, SW Henderson, Henderson. 48.0
 * miles; one glizzy each at every stop.
 *
 * THE OWNER'S CALLS (interview, same day): the five food courts, not the
 * Business Center on MLK (Costco lists no food court there); the name; "a
 * Saturday in January 2027" (Jan 16 is the stand-in, in series.ts); "both
 * races would be relays", teams of 4 to 5, free split (one runner on the
 * road, swap anywhere, everyone eats at every Costco); landing page only —
 * no sign-up, no database.
 *
 * LIVE BUT UNLISTED (owner: "publish these sites live but dont add the
 * link to the header. I want to be able to share"): open to anyone with
 * the address, robots off, linked from nowhere except its sibling pages
 * (/ring-every-bell and, later the same day, /animal-style). The link card is public/glizzy-gauntlet/og.png
 * (scripts/food-relays/og-glizzy.html).
 *
 * The course, the mile marks and the profile are generated
 * (scripts/food-relays/build-courses.mjs → courseData.ts). Everything a
 * rule or a table says about time is worked out below from START, the
 * food court hours and the course length, so moving the date or the
 * course moves the page. What I assumed rather than was told is marked
 * ASSUMED. */

/* The www host is the one that serves: the bare domain answers with a 307
 * to it, and a link-card crawler should not have to follow a redirect to
 * find the picture. */
const SITE = "https://www.mikianmusser.com";
const PATH = "/glizzy-gauntlet";

/* The stand-in date lives with its two siblings in series.ts. */
const START = SERIES["glizzy-gauntlet"].start;
/* Saturday food court close, minutes past midnight (costco.com warehouse
 * pages for all five, read 2026-11-10). */
const CLOSE_MIN = 19 * 60;
/* ASSUMED: a team of five through a food court line and five trays. */
const STOP_MIN = 15;
/* ASSUMED: where a team says it is in, until there is a sign-up (the Dam
 * to Dam pattern: contact by Instagram for now). */
const OWNER_IG = "mikian_";

const TITLE = "Vegas Glizzy Gauntlet — 5 Costcos, 48 miles, one relay";
const DESCRIPTION =
  "A team relay on foot through every Costco food court in the Las Vegas valley. Five Costcos, 48 miles, one glizzy each at every stop.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE}${PATH}`,
    type: "website",
    images: [{ url: `${SITE}${PATH}/og.png`, width: 1200, height: 630, alt: "Vegas Glizzy Gauntlet: 5 Costcos, 48 miles, one relay." }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE}${PATH}/og.png`] },
};

export const viewport: Viewport = { themeColor: "#fbf4e6" };

const BRAND = "Costco";

/* Prices and calories as the Utah original lists them for 2026; the hot
 * dog combo, the slice and the cookie agree with this year's menu guides.
 * The board at the warehouse is the authority. */
const MENU: { item: string; price: number; cal: number }[] = [
  { item: "Hot dog combo", price: 1.5, cal: 550 },
  { item: "Pizza slice", price: 1.99, cal: 700 },
  { item: "Cookie", price: 2.49, cal: 750 },
  { item: "Chicken bake", price: 3.99, cal: 770 },
];

const usd = (n: number) => `$${n.toFixed(2)}`;
const num = (n: number) => n.toLocaleString("en-US");

export default function GlizzyGauntletPage() {
  const start = startParts(START);
  const stops = COURSE.stops;
  const n = stops.length;
  const miles = COURSE.totalMi;
  const first = stops[0];
  const last = stops[n - 1];
  const ftAt = (mi: number) => COURSE.profile.reduce((a, b) => (Math.abs(b[0] - mi) < Math.abs(a[0] - mi) ? b : a))[1];
  const startFt = ftAt(0);
  const finishFt = ftAt(miles);
  const climbFt = Math.round((ftAt(stops[1].mi) - startFt) / 100) * 100;
  /* Floored, because the page says "more than". */
  const dropFt = Math.floor((COURSE.highFt - finishFt) / 100) * 100;

  /* The clock: the first order goes in at START, the last has to go in
   * before the food court closes, and every Costco before the finish
   * costs a stop. */
  const windowMin = CLOSE_MIN - start.minutes;
  const stopsMin = (n - 1) * STOP_MIN;
  const slowest = Math.floor(((windowMin - stopsMin) / miles) * 60) / 60;
  const paces = [7.5, 8.5, 9.5, 10.5].map((p) => {
    const run = p * miles;
    return { p, run, total: run + stopsMin, finish: clock(start.minutes, run + stopsMin), spare: windowMin - (run + stopsMin) };
  });

  const faq = [
    {
      q: "Is there an entry fee?",
      a: <p>No. You pay for your own food, your own gas and your own Costco membership.</p>,
    },
    {
      q: "Do we need a Costco membership?",
      a: (
        <p>
          Yes, at least one per team. Costco checks cards at the food court. One member can order for everybody, so one card
          gets a whole team fed.
        </p>
      ),
    },
    {
      q: "How does Costco take payment?",
      a: (
        <p>
          Visa credit cards and most debit cards. Mastercard, American Express and Discover credit cards do not work at
          Costco. Bring a card either way: the ordering kiosks do not always take cash.
        </p>
      ),
    },
    {
      q: "Do we need a van?",
      a: (
        <p>
          You need one vehicle and somebody to drive it who is not the runner on the road. A minivan holds a team of five.
          Park it like a shopper would: in a space, legally, and never in a fire lane.
        </p>
      ),
    },
    {
      q: "Can I run the whole thing alone?",
      a: (
        <p>
          Yes. One runner, {miles.toFixed(0)} miles, {n} food court stops. With {STOP_MIN}-minute stops you would need to
          hold about {pace(slowest)} a mile to reach {last.name} before the food court closes.
        </p>
      ),
    },
    {
      q: "What if we cannot finish?",
      a: (
        <p>
          Then you stop at a Costco, which is a fine place to stop. Every warehouse on the course has parking, bathrooms,
          water and lunch. A team that reaches three of {n} still ate three lunches.
        </p>
      ),
    },
    {
      q: "Why north to south?",
      a: (
        <p>
          Because the course drops. {first.name} sits at about {num(startFt)} feet and {last.name} at about {num(finishFt)}.
          The one real climb, about {num(climbFt)} feet up to {stops[1].name}, comes first, on fresh legs.
        </p>
      ),
    },
    {
      q: "Where is the Costco Business Center?",
      a: (
        <p>
          Not on the course. The Business Center on Martin Luther King Boulevard has no food court. No glizzy, no stop.
        </p>
      ),
    },
    {
      q: "What is the weather in mid-January?",
      a: (
        <p>
          Cool and usually dry: highs in the upper 50s Fahrenheit, lows near 40. Good running weather. The sun sets a little before
          5:00 PM, so most teams run the last stage in the dark. Bring lights and something reflective.
        </p>
      ),
    },
    {
      q: "What is a glizzy?",
      a: <p>A hot dog. The word came out of Washington, DC and the internet did the rest.</p>,
    },
    {
      q: "Is this an official Costco event?",
      a: <p>No. Costco has nothing to do with it. See the fine print below.</p>,
    },
  ];

  return (
    <div className={`fr fr-glizzy ${frDisplay.variable} ${frBody.variable}`}>
      <style>{css}</style>

      <div className="fr-bar">
        <div className="fr-wm">
          <GlizzyMark size={40} />
          Vegas Glizzy Gauntlet
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
                <span>Vegas</span>
                <span className="hl">Glizzy</span>
                <span>Gauntlet</span>
              </h1>
              <p className="fr-sub">
                {n} Costcos. {miles.toFixed(0)} miles. One glizzy at every stop.
              </p>
              <p className="fr-lede">
                A team relay on foot through every Costco food court in the Las Vegas valley, from {first.name} in the north
                to {last.name} in the southeast. One runner is on the road at a time. Everybody eats at every stop.
              </p>
            </div>
            <div className="fr-art" aria-hidden="true">
              <GlizzyMark size={400} />
            </div>
          </div>

          <div className="fr-stats">
            <div className="fr-stat">
              <div className="n">{n}</div>
              <div className="l">Costco food courts</div>
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
              <div className="n">$1.50</div>
              <div className="l">The combo, since 1985</div>
            </div>
          </div>

          <div className="fr-start">
            <div>
              <div className="when">
                {start.dateLong} · {start.time}
              </div>
              <div className="where">
                {BRAND} {first.name}, {first.address}. The doors open, the team eats, the first runner leaves.
              </div>
            </div>
            <Countdown target={START} doneLabel="It is glizzy day." />
          </div>
          <p className="fr-fine">The date is pencilled in. It becomes ink when the teams are.</p>

          <div className="fr-cta">
            <a className="fr-btn" href="#course">
              See the course
            </a>
            <a className="fr-btn ghost" href={`${PATH}/course.gpx`} download="vegas-glizzy-gauntlet.gpx">
              Download the GPX
            </a>
          </div>
        </div>
      </header>

      <section className="fr-sec" id="course">
        <div className="wrap">
          <div className="fr-kick">01 · The course</div>
          <h2>{miles.toFixed(0)} miles, north to south</h2>
          <p className="fr-intro">
            The line touches every Costco food court in the valley: {stops.map((s) => s.name).join(", ")}. It climbs about{" "}
            {num(climbFt)} feet to {stops[1].name} in the first stage, then gives back more than {num(dropFt)} on the way
            down to {last.name}.
          </p>

          <div className="fr-course">
            <div>
              <div className="fr-map">
                <CourseMap
                  course={COURSE}
                  brand={BRAND}
                  label={`Map of the course: ${stops.map((s) => `${s.n}, ${s.name}, mile ${s.mi.toFixed(1)}`).join("; ")}.`}
                  names
                  size="large"
                  pad={{ t: 0.09, r: 0.1, b: 0.14, l: 0.1 }}
                  labelPos={{
                    1: { dx: 36, dy: -2, anchor: "start" },
                    2: { dx: 38, dy: 52, anchor: "start" },
                    3: { dx: -36, dy: 44, anchor: "end" },
                    4: { dx: -38, dy: 38, anchor: "end" },
                    5: { dx: -2, dy: -62, anchor: "end" },
                  }}
                  areas={[
                    { name: "North Las Vegas", lat: 36.222, lon: -115.128 },
                    { name: "Downtown", lat: 36.158, lon: -115.142 },
                    { name: "The Strip", lat: 36.106, lon: -115.172 },
                    { name: "Red Rock", lat: 36.2, lon: -115.345 },
                  ]}
                  shields={VEGAS_SHIELDS}
                />
              </div>
            </div>
            <div>
              <StopRail course={COURSE} brand={BRAND} />
              <p className="fr-cap">
                Food courts at all {n}: Saturday 9:30 AM to 7:00 PM. Executive members get in at 9:00 AM.
              </p>
            </div>
          </div>

          <div className="fr-profile">
            <div className="fr-profile-head">
              <span>
                Start <b>{num(startFt)} ft</b>
              </span>
              <span>
                High point <b>{num(COURSE.highFt)} ft</b>, near {stops[1].name}
              </span>
              <span>
                Finish <b>{num(finishFt)} ft</b>
              </span>
            </div>
            <Profile course={COURSE} />
          </div>
          <p className="fr-cap">
            Course v1. A routing engine drew this line along sidewalks and paths. Every mile gets scouted on foot before race
            day, and the line moves wherever the ground disagrees with the map. Map data © OpenStreetMap contributors.
          </p>
        </div>
      </section>

      <section className="fr-sec tint" id="relay">
        <div className="wrap">
          <div className="fr-kick">02 · The relay</div>
          <h2>One runner on the road. Everyone at the table.</h2>
          <p className="fr-intro">
            The team shares the miles however it likes. Nobody shares the food: each person eats at each Costco.
          </p>
          <div className="fr-cards">
            <div className="fr-card">
              <h3>Teams of 4 or 5</h3>
              <p>
                Four runners cover {(miles / 4).toFixed(0)} miles each. Five cover {(miles / 5).toFixed(1)}. Somebody who is
                not running drives.
              </p>
            </div>
            <div className="fr-card">
              <h3>Free split</h3>
              <p>
                There are no set exchange points. Swap runners whenever you like, anywhere it is safe and legal to pull over.
                One long stage each or a mile at a time: your call.
              </p>
            </div>
            <div className="fr-card">
              <h3>The van leapfrogs</h3>
              <p>
                The team vehicle drives ahead, waits, and meets its runner. It should beat the runner to every Costco and
                already be standing in line.
              </p>
            </div>
            <div className="fr-card">
              <h3>Everybody eats, {n} times</h3>
              <p>
                At each Costco every team member buys and finishes one food court item. The runner who just arrived is not
                excused.
              </p>
            </div>
            <div className="fr-card">
              <h3>The clock never stops</h3>
              <p>
                Your time runs from the first order at {first.name} to the last bite at {last.name}. Lunch is on the clock,
                all {n} of them.
              </p>
            </div>
            <div className="fr-card">
              <h3>Solo is allowed</h3>
              <p>
                One runner, {miles.toFixed(0)} miles, {n} glizzies. The Utah ride this is modeled on is a solo effort. Nothing
                here stops you.
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
                <b>Reach all {n} Costcos, in order.</b> {stops.map((s) => s.name).join(", ")}. Every mile between them is
                covered on foot by a member of the team. No course cutting.
              </p>
            </li>
            <li>
              <span className="n">2</span>
              <p>
                <b>One runner on the road at a time.</b> Swap wherever it is safe and legal to stop a vehicle.
              </p>
            </li>
            <li>
              <span className="n">3</span>
              <p>
                <b>Everybody eats at every Costco.</b> Each team member buys and finishes at least one food court item at each
                of the {n} stops. A drink on its own is not a food order.
              </p>
            </li>
            <li>
              <span className="n">4</span>
              <p>
                <b>The next runner leaves when the last tray is empty.</b> No taking it to go.
              </p>
            </li>
            <li>
              <span className="n">5</span>
              <p>
                <b>Same day, inside food court hours.</b> The first order goes in at {first.name} at {start.time}. The last
                one has to go in at {last.name} before {clock(CLOSE_MIN, 0)}.
              </p>
            </li>
            <li>
              <span className="n">6</span>
              <p>
                <b>Bring a Costco member.</b> At least one per team, with the card on them.
              </p>
            </li>
            <li>
              <span className="n">7</span>
              <p>
                <b>Keep the receipts and record the run.</b> A receipt from each food court and a GPS track of the whole
                course are the proof. Hand the watch off or stitch the files together.
              </p>
            </li>
            <li>
              <span className="n">8</span>
              <p>
                <b>Open roads, real laws.</b> Nothing is closed and nobody is marshalling. Runners use sidewalks and paths and
                cross with the signal. Drivers park legally and never follow a runner at running speed.
              </p>
            </li>
            <li>
              <span className="n">9</span>
              <p>
                <b>Lights after dark.</b> A front light, a rear light and something reflective on every runner once the sun
                is down.
              </p>
            </li>
            <li>
              <span className="n">+</span>
              <p>
                More rules may appear to protect the spirit of the event, which is to run across an entire city for five
                lunches that cost a dollar fifty each.
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
              <h3>Glizzy purist</h3>
              <p>Every team member eats the hot dog combo at all {n} Costcos. Nothing else counts.</p>
            </div>
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Pizza party</h3>
              <p>A slice each at every stop. That is {n} slices per person and roughly {num(700 * n)} calories.</p>
            </div>
            <div className="fr-card">
              <span className="tag">Solo or team</span>
              <h3>Menu master</h3>
              <p>A different item at each of the {n} food courts. Plan the order of attack before you leave {first.name}.</p>
            </div>
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Sample collector</h3>
              <p>A free sample from inside the warehouse at three of the {n} stops. The clock is still running.</p>
            </div>
            <div className="fr-card">
              <span className="tag">Team</span>
              <h3>Under seven</h3>
              <p>
                {first.name} to {last.name} in under seven hours, lunches included. That is about{" "}
                {pace((7 * 60 - stopsMin) / miles)} a mile between {STOP_MIN}-minute stops.
              </p>
            </div>
            <div className="fr-card">
              <span className="tag">Solo</span>
              <h3>The whole glizzy</h3>
              <p>One runner covers all {miles.toFixed(0)} miles and eats at all {n} stops. No van, no teammates, no excuses.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="fr-sec" id="clock">
        <div className="wrap">
          <div className="fr-kick">05 · The Costco clock</div>
          <h2>{hm(windowMin).replace(":", " hours ")} minutes of food court</h2>
          <p className="fr-intro">
            The food courts set the cutoff. They open to every member at {start.time} on a Saturday and close at{" "}
            {clock(CLOSE_MIN, 0)}. The table allows {STOP_MIN} minutes at each of the first {n - 1} Costcos.
          </p>
          <div className="fr-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Team pace</th>
                  <th className="num">Running</th>
                  <th className="num">With stops</th>
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
            The slowest pace that still gets the last order in is about {pace(slowest)} a mile. A relay team holds that easily.
            One runner alone has to work for it. Sunset on the day is a little before 5:00 PM, so plan on finishing in the
            dark.
          </p>
        </div>
      </section>

      <section className="fr-sec tint" id="math">
        <div className="wrap">
          <div className="fr-kick">06 · Food court math</div>
          <h2>What {n} lunches cost one person</h2>
          <div className="fr-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>If you order</th>
                  <th className="num">Each</th>
                  <th className="num">Times {n}</th>
                  <th className="num">Calories</th>
                </tr>
              </thead>
              <tbody>
                {MENU.map((m) => (
                  <tr key={m.item}>
                    <td className="big">{m.item}</td>
                    <td className="num">{usd(m.price)}</td>
                    <td className="num">{usd(m.price * n)}</td>
                    <td className="num">about {num(m.cal * n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fr-cap">
            Running your share of the course on a team of five burns roughly {num(Math.round((miles / 5) * 10) * 10)}{" "}
            calories. You will finish this race heavier than you started. Prices and calories are approximate and the menu
            board at the warehouse is the authority.
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
            Four or five runners and a vehicle. Tell Mikian your team is in and you will hear the moment the date is ink:{" "}
            <a href={`https://www.instagram.com/${OWNER_IG}/`} target="_blank" rel="noopener noreferrer">
              @{OWNER_IG} on Instagram
            </a>
            .
          </p>
        </div>
      </section>

      <section className="fr-fineprint">
        <div className="wrap">
          <h3>Not affiliated with Costco</h3>
          <p>
            The Vegas Glizzy Gauntlet is not affiliated with, sponsored by or endorsed by Costco Wholesale Corporation. It is
            an independent, unofficial run organized by friends. Be a good customer: buy your food, clear your table and leave
            the lot the way you found it.
          </p>
          <h3>Your own risk</h3>
          <p>
            This is a self-supported run on open public roads and sidewalks. There are no permits, no road closures, no aid
            stations, no course marshals and no medical support. By taking part you accept all of the risk of doing so,
            including injury, accident and property damage. You are responsible for your own navigation, food, water, safety
            and for obeying every traffic law, on foot and behind the wheel. Know your limits and stop when you should.
          </p>
        </div>
      </section>

      <footer className="fr-foot">
        <div className="wrap">
          <Siblings current="glizzy-gauntlet" />
          <p>
            Modeled on the{" "}
            <a href="https://ggg.lmarx.com" target="_blank" rel="noopener noreferrer">
              Great Glizzy Gauntlet
            </a>
            , a 100-mile bike ride to ten Costcos in Utah, which was itself inspired by the{" "}
            <a href="https://tacobell50k.com" target="_blank" rel="noopener noreferrer">
              Taco Bell 50K
            </a>{" "}
            in Denver. Credit where it is due.
          </p>
          <p>© 2026 Vegas Glizzy Gauntlet. Run safely. Eat everything.</p>
        </div>
      </footer>
    </div>
  );
}
