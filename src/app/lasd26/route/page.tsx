import type { Metadata, Viewport } from "next";
import { ensureOwnerMember, getSettings, getTeamViewer } from "@/lib/lasd26/team";
import { getVanPin, wirePin } from "@/lib/lasd26/van";
import { LasdFooter } from "../LasdFooter";
import { LasdPage } from "../LasdPage";
import { routeCss } from "../routeCss";
import { RouteView } from "./RouteView";

/**
 * THE ROUTE (lasdPath("/route") = /lasd26/route) — No Shortcuts' official
 * course on a map in the site's colours and the turn-by-turn calls (owner,
 * 2026-10-16: "I've attached a google maps with the route, embed this route
 * into the site, make it the same color scheme as the rest of the site. put
 * it behind the dev gate"). The page is the title, the map, the facts, the
 * profile and the turn list — no intro (owner, 2026-10-16, on his phone:
 * "Remove the copy at the top of the routes page"), no bathroom stops, no
 * credit line, nothing past the finish, and the site's full footer ("Update
 * the footer with my full footer (like all the other pages)").
 *
 * LIVE (owner, 2026-10-16: "the route page can go live after those
 * changes"): no gate — the course is the race's own published map, nothing
 * on it is private — the ROUTE door in the bar (LasdBar.tsx) for everyone,
 * no "(dev)" in the title. It stays noindex like the other team pages. The
 * course itself is a static file, public/lasd26/route/course.json, made
 * from the organizer's KML by scripts/lasd26-route-from-kml.ts — rerun it
 * when they move a turn.
 *
 * 2026-10-21 (owner): MILE MARKERS on the map, ETAs in the turn by turn with
 * the expected finish under the list, and the VAN button for the team. The
 * page hands the view what the ETAs run on — the three settings
 * (TeamSettings.eta*) and, for a member, the van's pin — and the view polls
 * /api/lasd26/eta for the rest. The owner's member row is made on the way
 * in (ensureOwnerMember) so a pin he drops carries his name.
 *
 * 2026-10-23 (owner): LOCATE keeps the map on you until you move it, then a
 * RECENTER button (RouteMap.tsx). It went to the owner alone first ("deploy
 * this to just my user first so I can test") and to everyone the same
 * morning ("Push this to all users"), so there is no flag any more.
 */

export const metadata: Metadata = {
  title: "LASD26 — The route",
  description: "The official No Shortcuts course, turn by turn.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// The bar reads the session — never render statically.
export const dynamic = "force-dynamic";

export default async function RoutePage() {
  const viewer = await ensureOwnerMember(await getTeamViewer());
  const settings = await getSettings();
  const pin = viewer.onTeam ? wirePin(await getVanPin()) : null;

  return (
    <LasdPage viewer={viewer} active="route" extraCss={routeCss}>
      <section className="rt-top">
        <div className="wrap">
          <div className="sec-head">
            <h2>The route</h2>
            <span className="mono">SANTA MONICA → PACIFIC BEACH</span>
          </div>
        </div>
      </section>

      <RouteView
        onTeam={viewer.onTeam}
        initialEta={{ driveMin: settings.etaDriveMin, startAt: settings.etaStartAt, planPaceSec: settings.etaPlanPaceSec }}
        initialPin={pin}
      />

      <LasdFooter />
    </LasdPage>
  );
}
