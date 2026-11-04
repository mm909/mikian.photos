import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { THEME_COLOR } from "./look";
import { readLook } from "./readLook";
import { LegMap } from "./LegMap";
import { LEGS, TOTAL_M } from "./map";
import { RouteMap } from "./RouteMap";
import { RAISED, liveMeters, usd } from "./state";
import { css, spaceMono } from "./theme";
import { ZoomPan } from "./ZoomPan";

/* DAM TO DAM (owner, 2026-11-03: "I want to do a project named Dam to Dam.
 * Where I row from hover dam to davis dam. The goal is 100k meters. Point
 * to point.") — the pre-race page: the chart (zoomable, ZoomPan.tsx), the
 * plan as four leg charts (owner: "show not tell"), the boat, the gear,
 * the safety case, WATCH LIVE, the cause, the sponsor ask. FULLY
 * STANDALONE: its own look (theme.ts, viewer-chosen palette and projection
 * from look.ts), its own bar (RunnerChrome.tsx lists it bare), not a
 * row100k edition. The donor page is ./donate, the look controls are
 * ./settings.
 *
 * LIVE BUT UNLISTED (owner, 2026-11-03: "open this to everyone but keep it
 * unlisted", the lasd26/your-share pattern): no gate any more, robots stay
 * off, and nothing links here except the DEVELOPMENT group of the row100k
 * account menu. The date is a stand-in the owner chose to show plain; the
 * boat is IN EVALUATION until he picks. */

export const metadata: Metadata = {
  title: "Dam to Dam — 100,000 meters, Hoover to Davis",
  description:
    "One rower, one day: every meter of water from the Hoover Dam to the Davis Dam. 100,000 meters, point to point, for Candlelighters.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* The browser chrome follows the viewer's palette (look.ts). */
export function generateViewport(): Viewport {
  return { themeColor: THEME_COLOR[readLook().look] };
}

const OWNER_IG = "mikian_";

/* The simulated position under WATCH LIVE — any mid-lake number reads
 * honestly as a demo next to its SIMULATION tag. */
const DEMO_METERS = 42_180;

export default function DamToDamPage() {
  const { look, view } = readLook();
  /* The hero line (owner: "One rower, 100,000m and $x for children with
   * cancer", live): the meters flip to the boat's own on race day. */
  const meters = liveMeters() ?? TOTAL_M;

  return (
    <div className={`dd dd-${look} ${spaceMono.variable}`}>
      <style>{css}</style>

      <div className="dd-bar">
        <div className="dd-wm">Dam to Dam</div>
        <div className="dd-doors">
          <Link href="/dam-to-dam/donate" className="dd-door">
            Donate
          </Link>
          <Link href="/dam-to-dam/settings" className="dd-door">
            Settings
          </Link>
        </div>
      </div>

      <div className="wrap">
        <div className="dd-hero">
          <h1>
            Dam <span>to</span> Dam
          </h1>
          <div className="dd-sub">
            One rower · {meters.toLocaleString("en-US")} m · {usd(RAISED)} for children with cancer
          </div>
          <p className="dd-lede">
            One rower, one boat, one day: every meter of water between the Hoover Dam and the
            Davis Dam — through Black Canyon, down the length of Lake Mohave, point to point —
            raising a dollar a meter for Candlelighters.
          </p>
          <div className="dd-facts">
            <div className="dd-fact">
              <div className="k">Distance</div>
              <div className="v">
                100,000 m<small>point to point</small>
              </div>
            </div>
            <div className="dd-fact">
              <div className="k">Route</div>
              <div className="v">
                Hoover → Davis<small>Black Canyon, then Lake Mohave</small>
              </div>
            </div>
            <div className="dd-fact">
              <div className="k">Date</div>
              <div className="v">
                Nov 21<small>dawn start · ETA 10–12 hours</small>
              </div>
            </div>
            <div className="dd-fact">
              <div className="k">The cause</div>
              <div className="v">
                $1 = 1 m<small>donations matched 1:1 for Candlelighters</small>
              </div>
            </div>
          </div>
          <div className={`dd-chart ${view}`}>
            <ZoomPan>
              <RouteMap view={view} />
            </ZoomPan>
          </div>
        </div>

        <section>
          <div className="dd-head">
            <h2>The plan</h2>
            <span>the river in four legs</span>
          </div>
          <div className="dd-legs">
            {LEGS.map((leg) => (
              <div className="dd-leg" key={leg.title}>
                <div className="t">{leg.title}</div>
                <div className="r">{leg.range}</div>
                <LegMap leg={leg} />
                <p>{leg.blurb}</p>
              </div>
            ))}
          </div>
          <p className="dd-note">
            No current once the canyon opens, no drafting, no shore breaks longer than a bottle
            swap. Road access at Willow Beach, Cottonwood Cove and Katherine Landing.
          </p>
        </section>

        <section>
          <div className="dd-head">
            <h2>The boat</h2>
            <span>in evaluation</span>
          </div>
          <div className="dd-row">
            <div className="k">Maas Aero</div>
            <p>
              The front-runner. The classic open-water distance single — stable in lake chop,
              around forty pounds, fast enough to hold the all-day pace.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">Maas 24</div>
            <p>Longer and faster, less forgiving. The pick if training says the hands are good enough.</p>
          </div>
          <div className="dd-row">
            <div className="k">Echo Classic</div>
            <p>The most stable hull of the three, wave-piercing bow, a little slower. The guaranteed-finish pick.</p>
          </div>
          <p className="dd-note">
            A flatwater racing shell is ruled out: ten fatigued hours in open-lake chop is a swim
            waiting to happen.
          </p>
        </section>

        <section>
          <div className="dd-head">
            <h2>The gear</h2>
            <span>what makes the attempt honest</span>
          </div>
          <div className="dd-row">
            <div className="k">Tracker</div>
            <p>
              <b>Garmin inReach Mini 2</b> on the boat — satellite, not cell, because Black Canyon
              has no coverage. It pings position every few minutes and carries an SOS button; the
              pings are what move the dot on this page.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">Lights</div>
            <p>Navigation lights on both boats, rigged from the start. The finish is after dark by design of the calendar.</p>
          </div>
          <div className="dd-row">
            <div className="k">On the body</div>
            <p>PFD worn start to finish, dressed for November water, spare thermals dry on the support boat.</p>
          </div>
          <div className="dd-row">
            <div className="k">Support boat</div>
            <p>
              Carries everything the shell cannot: food, water, spares, cameras, first aid, and a
              warm place to put a rower if the attempt ends early.
            </p>
          </div>
        </section>

        <section>
          <div className="dd-head">
            <h2>Safety</h2>
            <span>the case for trying this</span>
          </div>
          <div className="dd-row">
            <div className="k">Never alone</div>
            <p>The support boat holds station alongside for all 100,000 meters — every stroke happens within shouting distance of a motor.</p>
          </div>
          <div className="dd-row">
            <div className="k">Satellite</div>
            <p>Position broadcast every few minutes, SOS on the hull, independent of cell coverage.</p>
          </div>
          <div className="dd-row">
            <div className="k">Bail-outs</div>
            <p>
              Road access at <b>Willow Beach (19k)</b>, <b>Cottonwood Cove (55k)</b> and{" "}
              <b>Katherine Landing (97k)</b>. The attempt can end at any of them without drama.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">Cold water</div>
            <p>November water is cold enough to matter: dressed for immersion, and the support boat drills a recovery before race day.</p>
          </div>
          <div className="dd-row">
            <div className="k">The rules</div>
            <p>
              The canyon is the Black Canyon National Water Trail: the dam-base launch runs on an
              NPS permit through an authorized outfitter, motorboats are banned above Willow Beach
              on Sundays and Mondays — race day is a Saturday — and the off-season caps the
              support boat at 65 horsepower. The row runs inside all of it.
            </p>
          </div>
        </section>

        <section>
          <div className="dd-head">
            <h2>Watch live</h2>
            <span>race day, on this page</span>
          </div>
          <div className={`dd-chart ${view}`}>
            <ZoomPan>
              <RouteMap view={view} live={liveMeters() ?? DEMO_METERS} />
            </ZoomPan>
          </div>
          <p className="dd-lede">
            On race day this page goes live. The dot is the boat — pinged by satellite every few
            minutes, drawn at its exact meter on the line. No cell service in the canyon; the
            tracker does not care. A camera rides the support boat, and when coverage allows the
            stream embeds right here.
          </p>
          {liveMeters() === null && <span className="dd-sim">Simulation — race day is not live yet</span>}
        </section>

        <section>
          <div className="dd-head">
            <h2>The cause</h2>
            <span>a dollar a meter</span>
          </div>
          <p className="dd-lede" style={{ marginTop: 24 }}>
            The row raises money for <b>Candlelighters Childhood Cancer Foundation of Nevada</b>.
            The goal mirrors the distance: $100,000 for 100,000 meters — a dollar a meter — with
            individual donations matched from a pledge pool. {usd(RAISED)} raised so far; the
            whole case for giving is on the donor page.
          </p>
          <Link className="dd-cta" href="/dam-to-dam/donate">
            The donor page →
          </Link>
        </section>

        <section>
          <div className="dd-head">
            <h2>Sponsor this row</h2>
            <span>the hull has room</span>
          </div>
          <p className="dd-lede" style={{ marginTop: 24 }}>
            The attempt is self-funded so far. A sponsor gets the hull, this page, the live map on
            race day, and the story afterward — or anchors the donation match pool and gets named
            for every dollar it doubles. Sponsor logos will live right here.
          </p>
          <a className="dd-cta" href={`https://instagram.com/${OWNER_IG}`} target="_blank" rel="noopener noreferrer">
            Get in touch → @{OWNER_IG}
          </a>
        </section>
      </div>

      <footer>Dam to Dam · 100,000 meters · one day · for Candlelighters</footer>
    </div>
  );
}
