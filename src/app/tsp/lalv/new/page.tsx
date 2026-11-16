import type { Metadata, Viewport } from "next";
import { tspPath } from "@/lib/tsp/paths";
import { gateTspDev, tspTitle } from "@/lib/tsp/team";
import { teamCss } from "@/app/lasd26/teamCss";
import { TspPage } from "../TspPage";
import { NewTeamForm, SignInButton } from "../TeamClient";

/**
 * MAKE A TEAM (owner, 2026-11-16: "someone make the team and then getting a
 * link to join the team"). A name, your own name on the roster, whether it
 * is a secrets team; POST /api/tsp/teams makes it with you as captain and
 * lands on the team page, where the invite link is waiting.
 */

export const metadata: Metadata = { title: tspTitle("TSP — Make a team"), robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#F4F3EE" };
export const dynamic = "force-dynamic";

export default async function NewTeamPage() {
  const actor = await gateTspDev();
  return (
    <TspPage actor={actor} active="hub" extraCss={teamCss}>
      <section className="tsp-sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>Make a team</h2>
            <span className="mono">YOU ARE ITS CAPTAIN</span>
          </div>
          {actor ? (
            <NewTeamForm defaultName={actor.name} />
          ) : (
            <>
              <p className="tm-lede">Sign in first — the team is tied to your Google account.</p>
              <SignInButton callback={tspPath("/new")} />
            </>
          )}
        </div>
      </section>
    </TspPage>
  );
}
