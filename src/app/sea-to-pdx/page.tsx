import type { Metadata, Viewport } from "next";
import { Countdown } from "@/components/foodrelay/Countdown";
import { TicketMark } from "@/components/foodrelay/Marks";
import { Siblings, startParts } from "@/components/foodrelay/Parts";
import { Profile } from "@/components/foodrelay/Profile";
import { SERIES } from "@/components/foodrelay/series";
import { css, frBody, frDisplay } from "@/components/foodrelay/theme";
import { COURSE } from "./courseData";
import { seaCss } from "./look";
import { StreetMap } from "./StreetMap";
import { StripMap } from "./StripMap";

/* SEA TO PDX (owner, 2026-11-10, after the three Las Vegas food relays:
 * "What about a relay from Seattle to Portland, keep the sites focused on
 * the routes. Fewer rules/conditions"). A team relay on foot from the
 * Space Needle to the White Stag sign.
 *
 * THIS PAGE IS THE ROUTE. Where its siblings spend their length on rules,
 * bonus challenges, pace tables and food math, this one has the line
 * three ways (a strip chart of the whole thing, every leg in a list, a
 * street map that zooms to any block), the profile, the GPX, and three
 * rules. Keep it that way: a new section has to be about the route.
 *
 * THE OWNER'S CALLS (interview, same day): the Washington side (the bike
 * ride's towns to Kelso, then the east bank to Vancouver and the
 * Interstate Bridge; scripts/food-relays/build-courses.mjs has why); any
 * size team, split however; the name SEA to PDX; and live, unlisted like
 * the other three ("All 4 live. no need to trim": the three food pages
 * keep their rules and their length).
 *
 * MINE, not the owner's, and marked ASSUMED below: the date (series.ts),
 * the wording of the three rules, and where a team says it is in.
 *
 * Every number on the page is read off courseData.ts. The two paragraphs
 * that walk the line name its towns by hand: if the stop list changes,
 * read them again. */

const SITE = "https://www.mikianmusser.com";
const PATH = "/sea-to-pdx";
const START = SERIES["sea-to-pdx"].start;
/* ASSUMED: where a team says it is in, until there is a sign-up. */
const OWNER_IG = "mikian_";

const MILES = COURSE.totalMi.toFixed(0);
const LEGS = COURSE.stops.length - 1;

const TITLE = `SEA to PDX — Seattle to Portland on foot, ${MILES} miles`;
const DESCRIPTION = `A team relay on foot from the Space Needle to the White Stag sign. ${MILES} miles, ${LEGS} legs, town to town. The whole route, leg by leg.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE}${PATH}`,
    type: "website",
    images: [{ url: `${SITE}${PATH}/og.png`, width: 1200, height: 630, alt: `SEA to PDX: Seattle to Portland on foot, ${MILES} miles.` }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE}${PATH}/og.png`] },
};

export const viewport: Viewport = { themeColor: "#fbf4e6" };

const num = (n: number) => n.toLocaleString("en-US");
const pin = (lat: number, lon: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

/* The shape of one leg, cut from the profile. Every leg is drawn on the
 * same height scale, so a flat one looks flat next to a hilly one. */
function Spark({ from, to }: { from: number; to: number }) {
  const W = 92;
  const H = 26;
  const lo = COURSE.lowFt;
  const hi = COURSE.highFt;
  const pts = COURSE.profile.filter(([mi]) => mi >= from - 0.11 && mi <= to + 0.11);
  if (pts.length < 2) return null;
  const x = (mi: number) => ((mi - pts[0][0]) / (pts[pts.length - 1][0] - pts[0][0])) * W;
  const y = (ft: number) => H - 2 - ((ft - lo) / (hi - lo)) * (H - 4);
  const line = pts.map(([mi, ft]) => `${x(mi).toFixed(1)},${y(ft).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon className="sk-a" points={`0,${H} ${line} ${W},${H}`} />
      <polyline className="sk-l" points={line} />
    </svg>
  );
}

export default function SeaToPdxPage() {
  const start = startParts(START);
  const stops = COURSE.stops;
  const n = stops.length;
  const miles = COURSE.totalMi;
  const first = stops[0];
  const last = stops[n - 1];
  const ftAt = (mi: number) => COURSE.profile.reduce((a, b) => (Math.abs(b[0] - mi) < Math.abs(a[0] - mi) ? b : a))[1];
  /* The leg that goes highest, named by the town it runs into. */
  const highStop = stops.slice(1).reduce((a, b) => ((b.hiFt ?? 0) > (a.hiFt ?? 0) ? b : a));
  const highFrom = stops[highStop.n - 2];
  /* The legs that run on the Yelm-Tenino Trail. */
  const trailMi = stops.filter((s) => s.via?.[0] === "Yelm-Tenino Trail").reduce((a, s) => a + s.legMi, 0);
  const hops = stops.slice(1).map((s) => s.legMi);
  const shortHop = Math.min(...hops);
  const longHop = Math.max(...hops);
  const hoursAtTen = Math.round((miles * 10) / 60);

  return (
    <div className={`fr fr-seapdx ${frDisplay.variable} ${frBody.variable}`}>
      <style>{css + seaCss}</style>

      <div className="fr-bar">
        <div className="fr-wm">
          <TicketMark size={22} />
          SEA to PDX
        </div>
        <nav className="fr-nav" aria-label="On this page">
          <a href="#route">Route</a>
          <a href="#legs">Legs</a>
          <a href="#map">Street map</a>
          <a href="#rules">Rules</a>
        </nav>
      </div>

      <header className="fr-hero">
        <div className="wrap">
          <div className="fr-hero-grid">
            <div>
              <div className="fr-chips">
                <span className="fr-chip on">Seattle to Portland</span>
                <span className="fr-chip">{start.dateShort}</span>
                <span className="fr-chip">Team relay</span>
                <span className="fr-chip alt">On foot</span>
              </div>
              <h1>
                <span>SEA</span>
                <span className="hl">to PDX</span>
              </h1>
              <p className="fr-sub">
                Space Needle to the White Stag sign. {MILES} miles on foot.
              </p>
              <p className="fr-lede">
                A team relay from Seattle to Portland, town to town, on rail trails, back roads and one bridge over the
                Columbia. This page is the route.
              </p>
            </div>
            <div className="fr-art" aria-hidden="true">
              <TicketMark size={300} detail className="sp-ticket" />
            </div>
          </div>

          <div className="fr-stats">
            <div className="fr-stat">
              <div className="n">{MILES}</div>
              <div className="l">Miles on foot</div>
            </div>
            <div className="fr-stat">
              <div className="n">{LEGS}</div>
              <div className="l">Legs, town to town</div>
            </div>
            <div className="fr-stat">
              <div className="n">{num(COURSE.highFt)}</div>
              <div className="l">Feet at the high point</div>
            </div>
            <div className="fr-stat">
              <div className="n">3</div>
              <div className="l">Rules</div>
            </div>
          </div>

          <div className="fr-start">
            <div>
              <div className="when">
                {start.dateLong} · {start.time}
              </div>
              <div className="where">
                Under the Space Needle, Seattle. At ten minutes a mile the running takes about {hoursAtTen} hours: a full
                day, and the night in the middle of it.
              </div>
            </div>
            <Countdown target={START} doneLabel="Runners are on the road." />
          </div>
          <p className="fr-fine">The date is pencilled in. It becomes ink when the teams are.</p>

          <div className="fr-cta">
            <a className="fr-btn" href="#route">
              See the route
            </a>
            <a className="fr-btn ghost" href={`${PATH}/course.gpx`} download="sea-to-pdx.gpx">
              Download the GPX
            </a>
          </div>
        </div>
      </header>

      <section className="fr-sec" id="route">
        <div className="wrap">
          <div className="fr-kick">01 · The route</div>
          <h2>{MILES} miles, one line south</h2>
          <p className="fr-intro">
            The line leaves the Space Needle, picks up the Green River and Interurban trails through Tukwila, Kent and
            Auburn, and climbs out of Puyallup to Spanaway. State Route 507 carries it to Yelm, where the Yelm-Tenino Trail
            gives it about {trailMi.toFixed(0)} miles with no cars at all.
          </p>
          <p className="fr-intro">
            From Tenino it follows the old highway towns: Centralia, Chehalis, Napavine, Winlock, Vader, Castle Rock, Kelso.
            After {highFrom.name} it goes over Green Mountain, the high point at {num(COURSE.highFt)} feet, and drops to{" "}
            {highStop.name}. From Vancouver it crosses the Columbia on the Interstate Bridge and finishes under the White Stag
            sign.
          </p>

          <div className="sp-route">
            <div className="sp-stick">
              <div className="fr-map">
                <StripMap
                  course={COURSE}
                  /* The line runs west into Tenino at the height of its dot,
                   * so that name hangs under the line and Bucoda makes room. */
                  nudge={{ 11: { dy: 24 }, 12: { dy: 12 } }}
                  label={`Map of the route from the Space Needle in Seattle south to the White Stag sign in Portland, ${miles.toFixed(1)} miles through ${n - 2} towns. Every leg is listed beside the map.`}
                />
              </div>
            </div>

            <div id="legs">
              <ol className="sp-legs">
                {stops.slice(1).map((to, k) => {
                  const from = stops[k];
                  const leg = k + 1;
                  /* Emerald in Washington, rose once a leg lands in Oregon:
                   * the strip chart's line changes colour at the same place. */
                  const oregon = to.city.endsWith("OR");
                  return (
                    <li key={to.n}>
                      <span className={oregon ? "n or" : "n"}>
                        {leg}
                      </span>
                      <div>
                        <div className="name">
                          {from.name} <i aria-hidden="true">→</i>
                          <span className="sp-sr"> to </span> {to.name}
                        </div>
                        {to.via && to.via.length > 0 && <div className="via">{to.via.join(" · ")}</div>}
                        <div className="meta">
                          Mile {from.mi.toFixed(1)} to {to.mi.toFixed(1)}
                          {to.hiFt !== undefined && ` · tops out at ${num(to.hiFt)} ft`}
                          <br />
                          {to.n === n ? "Finish under the " : "Hand off at "}
                          <a href={pin(to.lat, to.lon)} target="_blank" rel="noopener noreferrer">
                            {to.address}
                          </a>
                          {" · "}
                          <a href="#map" data-leg={leg}>
                            Street map
                          </a>
                        </div>
                      </div>
                      <div className="mi">
                        <b>{to.legMi.toFixed(1)}</b>miles
                        <Spark from={from.mi} to={to.mi} />
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="fr-cap">
                {LEGS} legs of {shortHop.toFixed(1)} to {longHop.toFixed(1)} miles. Every hand-off is a public place in a
                town. The small charts share one height scale, so a flat leg looks flat.
              </p>
              <p className="fr-cap">
                Course v1. A routing engine drew this line and nobody has run it end to end yet. It moves wherever the ground
                disagrees with the map. Route data © OpenStreetMap contributors. Shoreline: Natural Earth.
              </p>
            </div>
          </div>

          <div className="sp-wide">
            <div className="fr-profile">
              <div className="fr-profile-head">
                <span>
                  {first.name} <b>{num(ftAt(0))} ft</b>
                </span>
                <span>
                  High <b>{num(COURSE.highFt)} ft</b>, between {highFrom.name} and {highStop.name}
                </span>
                <span>
                  {last.name} <b>{num(ftAt(miles))} ft</b>
                </span>
              </div>
              <Profile course={COURSE} numbers={false} step={25} />
            </div>
            <p className="fr-cap">
              Ground height along the line, a dot at every hand-off. The heights come from a 90 m terrain model: right about
              where the hills are, not fine enough to add up a climb total.
            </p>
          </div>
        </div>
      </section>

      <section className="fr-sec tint" id="map">
        <div className="wrap">
          <div className="fr-kick">02 · The street map</div>
          <h2>Every corner of it</h2>
          <p className="fr-intro">
            The strip above is a sketch. This is the same line on real streets. Step through it a leg at a time, or pick a
            town.
          </p>
          <StreetMap src={`${PATH}/line.json`} />
          <p className="fr-cap">
            Click the map and the wheel zooms it. On a phone, two fingers move it. The GPX has every point of the line and
            every hand-off, for a watch or a phone.
          </p>
          <div className="fr-cta">
            <a className="fr-btn" href={`${PATH}/course.gpx`} download="sea-to-pdx.gpx">
              Download the GPX
            </a>
          </div>
        </div>
      </section>

      <section className="fr-sec" id="rules">
        <div className="wrap">
          <div className="fr-kick">03 · The rules</div>
          <h2>All three of them</h2>
          {/* ASSUMED: the owner asked for fewer rules, not for these words. */}
          <ol className="sp-rules">
            <li>
              <span className="n">1</span>
              <p>Space Needle to the White Stag sign, every mile on foot.</p>
            </li>
            <li>
              <span className="n">2</span>
              <p>One runner on the road at a time.</p>
            </li>
            <li>
              <span className="n">3</span>
              <p>Any size team. Split the miles however you like.</p>
            </li>
          </ol>
          <p className="sp-small">
            The roads, sidewalks and trails are open and nobody is closing them. There are no permits, no aid stations and no
            support, and the line has not been scouted. You run it at your own risk and under every traffic law. Wear lights
            at night.
          </p>
        </div>
      </section>

      <section className="fr-band" id="join">
        <div className="wrap">
          <h2>Get a team in</h2>
          <p>
            Runners, a vehicle and somebody to drive it. Tell Mikian your team is in and you will hear the moment the date is
            ink:{" "}
            <a href={`https://www.instagram.com/${OWNER_IG}/`} target="_blank" rel="noopener noreferrer">
              @{OWNER_IG} on Instagram
            </a>
            .
          </p>
        </div>
      </section>

      <footer className="fr-foot">
        <div className="wrap">
          <Siblings current="sea-to-pdx" />
          <p>
            The towns between Seattle and Kelso are the ones the Seattle to Portland bike ride made famous. This run is not
            part of that ride and has nothing to do with Cascade Bicycle Club.
          </p>
          <p>© 2026 SEA to PDX. Run safely.</p>
        </div>
      </footer>
    </div>
  );
}
