import type { Metadata, Viewport } from "next";
import { tspPath, teamPath } from "@/lib/tsp/paths";
import { gateTspDev, myTeams, tspTitle } from "@/lib/tsp/team";
import { teamCss } from "@/app/lasd26/teamCss";
import { DemoButton } from "./DemoButton";
import { TspPage } from "./TspPage";
import { SignInButton } from "./TeamClient";

/**
 * THE HUB of the TSP team sites (owner, 2026-11-16: "this is going to be for
 * … our teams to use during TSP. We should design it in a way that we can
 * give this to other TSP teams"). Signed out: what it is and a sign-in
 * button. Signed in: your teams, and the door to make one. A team is joined
 * through its captain's link, never from here.
 *
 * In development (CLAUDE.md): admin-only in production, noindex, "(dev)".
 */

export const metadata: Metadata = {
  title: tspTitle("TSP LA → Las Vegas — Team sites"),
  description: "One page per team for The Speed Project: the route, who runs what, where the van is, the costs.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#F4F3EE" };
export const dynamic = "force-dynamic";

export default async function TspHubPage() {
  const actor = await gateTspDev();
  const teams = actor ? await myTeams(actor) : [];

  return (
    <TspPage actor={actor} active="hub" extraCss={teamCss}>
      <header className="tsp-hero">
        <div className="wrap">
          <h1>
            Santa Monica
            <br />
            to Vegas<span className="o">.</span>
          </h1>
          <p className="sub">
            A page for your TSP team: the route with every turn and mile, who runs which miles, where the runner and the vans are, the info sheet and the costs. Make a team, send the link, everyone signs in with Google.
          </p>
        </div>
      </header>

      <section className="tsp-sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>Your teams</h2>
            <span className="mono">{actor ? `${teams.length} TEAM${teams.length === 1 ? "" : "S"}` : "SIGN IN"}</span>
          </div>
          {!actor ? (
            <>
              <p className="tm-lede">Sign in to see your team or make one. Joining a team takes its captain&rsquo;s link.</p>
              <SignInButton callback={tspPath("")} />
            </>
          ) : (
            <>
              {teams.length === 0 ? (
                <p className="tm-lede">You are not on a team yet. If your captain sent a link, open it. Otherwise make the team and send the link yourself.</p>
              ) : (
                <ul className="tsp-teams">
                  {teams.map((t) => (
                    <li key={t.slug}>
                      <a href={teamPath(t.slug, "")}>
                        <span className="n">
                          {t.name}
                          {t.secrets && <span className="tsp-chip">Secrets</span>}
                          {t.captain && <span className="tsp-chip fill">Captain</span>}
                        </span>
                        <span className="m">
                          {t.members} on it →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <a className="tm-go" href={tspPath("/new")}>
                Make a team →
              </a>
              <DemoButton />
            </>
          )}
        </div>
      </section>
    </TspPage>
  );
}
