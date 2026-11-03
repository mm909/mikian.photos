import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { THEME_COLOR } from "./look";
import { readLook } from "./readLook";
import { RouteMap } from "./RouteMap";
import { css, spaceMono } from "./theme";

/* DAM TO DAM (owner, 2026-11-03: "I want to do a project named Dam to Dam.
 * Where I row from hover dam to davis dam. The goal is 100k meters. Point
 * to point.") — the pre-race page: the chart, the plan, the boat, the gear,
 * the safety case, what race day will look like here, the cause, and the
 * sponsor ask. FULLY STANDALONE (interview, 2026-11-03): its own look
 * (theme.ts, the viewer-chosen palette and projection from look.ts), not a
 * row100k edition, on mikianmusser.com. The donor page is ./donate, the
 * look controls are ./settings.
 *
 * Facts and copy come from SPEC.md — the date is a stand-in the owner
 * chose to show plain, and the boat is IN EVALUATION until he picks.
 *
 * IN DEVELOPMENT (the standing rule): owner-only in production, a 404 for
 * everyone else; open in local dev. Reached from the DEVELOPMENT group of
 * the row100k account menu (BarAccount.tsx, absolute URL — that menu
 * renders on rowtember.com). */

export const metadata: Metadata = {
  title: "Dam to Dam (dev) — 100,000 meters, Hoover to Davis",
  description:
    "One rower, one day: every meter of water from the Hoover Dam to the Davis Dam. 100,000 meters, point to point.",
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

export default async function DamToDamPage() {
  const actor = await getEffectiveActor();
  const owner = actor ? isOwner(actor) : false;
  if (process.env.NODE_ENV === "production" && !owner) notFound();
  const { look, view } = readLook();

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
          <span className="dd-dev">Dev</span>
        </div>
      </div>

      <div className="wrap">
        <div className="dd-hero">
          <h1>
            Dam to <span>Dam</span>
          </h1>
          <div className="dd-sub">Hoover Dam → Davis Dam · Colorado River</div>
          <p className="dd-lede">
            One rower, one boat, one day: every meter of water between the Hoover Dam and the
            Davis Dam. Through Black Canyon, down the length of Lake Mohave, point to point.
          </p>
          <div className="dd-facts">
            <div className="dd-fact">
              <div className="k">Distance</div>
              <div className="v">
                100,000 m<small>point to point, every meter on the water</small>
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
                Nov 21<small>one continuous push, dawn start</small>
              </div>
            </div>
            <div className="dd-fact">
              <div className="k">Crew</div>
              <div className="v">
                Solo<small>one rower, one support boat</small>
              </div>
            </div>
          </div>
          <div className={`dd-chart ${view}`}>
            <RouteMap view={view} />
          </div>
        </div>

        <section>
          <div className="dd-head">
            <h2>The plan</h2>
            <span>three legs, one line</span>
          </div>
          <div className="dd-row">
            <div className="k">0 – 19 k</div>
            <p>
              <b>Black Canyon.</b> Launch below the Hoover Dam at first light — the dam-base
              launch is permit country, arranged through an authorized outfitter. Nineteen
              kilometers of cold, moving water between canyon walls to Willow Beach.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">19 – 97 k</div>
            <p>
              <b>Lake Mohave.</b> The long middle: seventy-eight kilometers of open lake, past
              Cottonwood Cove at the halfway-and-some mark. The water goes slack and the wind
              becomes the adversary.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">97 – 100 k</div>
            <p>
              <b>The finish.</b> Katherine Landing, then the last three thousand meters to the
              Davis Dam line. November gives ten hours of daylight and the row does not fit
              inside them — the finish happens under lights.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">The clock</div>
            <p>
              Ten to twelve hours of rowing at an all-day pace. No current to speak of once the
              canyon opens; no drafting, no relay, no shore breaks longer than a bottle swap.
            </p>
          </div>
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
            <RouteMap view={view} live={DEMO_METERS} />
          </div>
          <p className="dd-lede">
            On race day this page goes live. The dot is the boat — pinged by satellite every few
            minutes, drawn at its exact meter on the line. No cell service in the canyon; the
            tracker does not care. A camera rides the support boat, and when coverage allows the
            stream embeds right here.
          </p>
          <span className="dd-sim">Simulation — race day is not live yet</span>
        </section>

        <section>
          <div className="dd-head">
            <h2>The cause</h2>
            <span>a dollar a meter</span>
          </div>
          <p className="dd-lede" style={{ marginTop: 24 }}>
            The row raises money for <b>Candlelighters Childhood Cancer Foundation of Nevada</b>.
            The goal mirrors the distance: $100,000 for 100,000 meters — a dollar a meter — with
            individual donations matched from a pledge pool. The whole case for giving is on the
            donor page.
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

      <footer>Dam to Dam · 100,000 meters · one day</footer>
    </div>
  );
}
