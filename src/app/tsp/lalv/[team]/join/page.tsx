import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { inviteByToken } from "@/lib/lasd26/team";
import { teamPath } from "@/lib/tsp/paths";
import { gateTspDev, getTspViewer, listPlaceholders, tspTitle } from "@/lib/tsp/team";
import { teamCss } from "@/app/lasd26/teamCss";
import { TspPage } from "../../TspPage";
import { ClaimList, JoinForm, SignInButton } from "../../TeamClient";
import { teamCss as tspTeamCss } from "../../teamCss";

/**
 * JOIN: /tsp/lalv/<team>/join?t=<token> — the link a captain drops in the
 * group chat (owner, 2026-11-16: "getting a link to join the team and then
 * signing in with Google. I think that process worked pretty good"). The
 * lasd26 join page's four states: a dead link says so and nothing else;
 * signed out → Google and back to this exact link; already on the team →
 * change name or role; otherwise the form.
 *
 * Above the form, for someone not on the team yet: the names a captain has
 * already put on the roster (owner, 2026-11-16: "When joining a team I
 * should be able to pick one of the already given names or just sign in as
 * usual"). Tapping one takes that row over; the form below is "as usual".
 */

export const viewport: Viewport = { themeColor: "#F4F3EE" };
export const dynamic = "force-dynamic";

type Props = { params: { team: string }; searchParams?: { t?: string | string[] } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getTspViewer(params.team, null);
  return { title: tspTitle(`${viewer?.team.name ?? "TSP"} — Join the team`), robots: { index: false, follow: false } };
}

export default async function JoinPage({ params, searchParams }: Props) {
  const actor = await gateTspDev();
  const viewer = await getTspViewer(params.team, actor);
  if (!viewer) notFound();
  const raw = searchParams?.t;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const slug = viewer.team.slug;

  let invite: { id: string } | null = null;
  if (token) {
    try {
      invite = await inviteByToken(token, slug);
    } catch (err) {
      console.error("tsp/join: invite lookup failed", err);
    }
  }

  if (!invite) {
    return (
      <TspPage viewer={viewer} active="join" extraCss={teamCss + tspTeamCss}>
        <section>
          <div className="wrap">
            <div className="jn-bad">
              <strong>This link is not valid.</strong>
              Ask your captain for a fresh one.
            </div>
            {viewer.onTeam && (
              <div className="tm-actions">
                <a className="tm-btn fill" href={teamPath(slug, "")}>
                  You&rsquo;re already on the team — the route →
                </a>
              </div>
            )}
          </div>
        </section>
      </TspPage>
    );
  }

  const member = viewer.member;
  let names: Awaited<ReturnType<typeof listPlaceholders>> = [];
  if (viewer.actor && !member) {
    try {
      names = await listPlaceholders(slug);
    } catch (err) {
      console.error("tsp/join: placeholder lookup failed", err);
    }
  }
  return (
    <TspPage viewer={viewer} active="join" extraCss={teamCss + tspTeamCss}>
      <header className="tsp-hero">
        <div className="wrap">
          <h1>
            Join
            <br />
            {viewer.team.name}
            <span className="o">.</span>
          </h1>
          <p className="sub">TSP, Santa Monica Pier to the Las Vegas sign. One page for the route, who runs what, where the van is, the info sheet and the costs.</p>
        </div>
      </header>
      <section className="tsp-sec">
        <div className="wrap">
          {!viewer.actor ? (
            <>
              <div className="sec-head">
                <h2>Sign in to join</h2>
                <span className="mono">GOOGLE</span>
              </div>
              <p className="tm-lede">Sign in with the Google account you use for email. We keep your name and address to put you on the roster.</p>
              <SignInButton callback={`${teamPath(slug, "/join")}?t=${encodeURIComponent(token)}`} label="Sign in with Google to join →" />
            </>
          ) : (
            <>
              {names.length > 0 && (
                <>
                  <div className="sec-head">
                    <h2>Are you one of these?</h2>
                    <span className="mono">TAP YOUR NAME</span>
                  </div>
                  <ClaimList slug={slug} token={token} names={names} />
                </>
              )}
              <div className="sec-head">
                <h2>{member ? "You're on the team" : names.length > 0 ? "I'm not on the list" : "Put yourself on"}</h2>
                <span className="mono">RUNNER OR CREW</span>
              </div>
              <JoinForm slug={slug} token={token} defaultName={member?.name ?? viewer.actor.name} current={member?.role} />
            </>
          )}
        </div>
      </section>
    </TspPage>
  );
}
