import type { Metadata, Viewport } from "next";
import { devTitle, gateLasdDev } from "@/lib/lasd26/devGate";
import { LasdPage } from "../LasdPage";
import { routeCss } from "../routeCss";
import { GOOGLE_MAP_URL } from "./course";
import { RouteView } from "./RouteView";

/**
 * THE ROUTE (lasdPath("/route") = /lasd26/route) — No Shortcuts' official
 * course on a map in the site's colours, the turn-by-turn calls and the
 * bathroom stops (owner, 2026-10-16: "I've attached a google maps with the
 * route, embed this route into the site, make it the same color scheme as
 * the rest of the site. put it behind the dev gate"). IN DEVELOPMENT: the
 * gate in lib/lasd26/devGate.ts (admin-only in production, open on a
 * laptop), "(dev)" in the title, noindex, and the only door is the owner's
 * DEVELOPMENT group in the account menu. The course itself is a static
 * file, public/lasd26/route/course.json, made from the organizer's KML by
 * scripts/lasd26-route-from-kml.ts — rerun it when they move a turn.
 */

export const metadata: Metadata = {
  title: `LASD26 — ${devTitle("The route")}`,
  description: "The official No Shortcuts course, turn by turn.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated — never render statically.
export const dynamic = "force-dynamic";

export default async function RoutePage() {
  const viewer = await gateLasdDev();

  return (
    <LasdPage viewer={viewer} active="none" extraCss={routeCss}>
      <section className="rt-top">
        <div className="wrap">
          <div className="sec-head">
            <h2>The route</h2>
            <span className="mono">SANTA MONICA → PACIFIC BEACH · DEV</span>
          </div>
          <p className="rt-lede">
            The official course, straight from No Shortcuts&apos; directions map: inland through Inglewood and down the LA River trail to Long
            Beach, then the coast highway south. Everyone rides I-5 through Camp Pendleton. Tap a call below to see it on the map; the{" "}
            <a href={GOOGLE_MAP_URL} target="_blank" rel="noopener noreferrer">
              Google map
            </a>{" "}
            is the one to navigate the van with.
          </p>
        </div>
      </section>

      <RouteView />

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <p className="mono">for yourself and others</p>
        </div>
      </footer>
    </LasdPage>
  );
}
