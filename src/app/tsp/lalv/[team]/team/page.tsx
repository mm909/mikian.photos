import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { currentInvite, getSettings } from "@/lib/lasd26/team";
import { teamPath } from "@/lib/tsp/paths";
import { gateTspDev, getTspViewer, listTspMembers, tspInviteUrl, tspTitle } from "@/lib/tsp/team";
import { originFrom } from "@/app/lasd26/team/fmt";
import { routeCss } from "@/app/lasd26/routeCss";
import { teamCss } from "@/app/lasd26/teamCss";
import { TspPage } from "../../TspPage";
import { AddRunnerForm, InviteBox, MemberActions, MemberPlan, SignInButton, TeamSettingsForm } from "../../TeamClient";
import { teamCss as tspTeamCss } from "../../teamCss";

/**
 * THE TEAM (owner, 2026-11-16: "multiple teams, multiple team captains, and
 * the users"). Everyone on the team reads the roster. A captain also gets
 * the invite link (copy / make a new one), make-captain / role / remove on
 * every row, and the settings: the name, the start and planned pace the
 * ETAs run on, the expenses split, whether the other teams see our van, and
 * whether this is a secrets team.
 *
 * Every row carries the runner's TARGET PACE and SHIFT (owner, 2026-11-16:
 * "8 runners and target paces"): a captain sets them for anyone, a member
 * their own pace. A captain can also ADD A RUNNER by name before the person
 * has joined (owner: "it has one dummy runner named 'faith' … she has not
 * clicked on the link to join"); the row says NOT JOINED YET until someone
 * claims the name from the invite link.
 */

export const viewport: Viewport = { themeColor: "#F4F3EE" };
export const dynamic = "force-dynamic";

type Props = { params: { team: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getTspViewer(params.team, null);
  return { title: tspTitle(`${viewer?.team.name ?? "TSP"} — The team`), robots: { index: false, follow: false } };
}

export default async function TeamPage({ params }: Props) {
  const actor = await gateTspDev();
  const viewer = await getTspViewer(params.team, actor);
  if (!viewer) notFound();
  const slug = viewer.team.slug;

  if (!viewer.onTeam) {
    return (
      <TspPage viewer={viewer} active="team" extraCss={teamCss}>
        <section className="tsp-sec">
          <div className="wrap">
            <div className="jn-bad">
              <strong>{viewer.actor ? "Not on this team yet." : "Team only."}</strong>
              {viewer.actor ? "You need the invite link from your captain." : "Sign in to see it. Not on the team? You need the invite link from your captain."}
            </div>
            {!viewer.actor && <SignInButton callback={teamPath(slug, "/team")} />}
          </div>
        </section>
      </TspPage>
    );
  }

  const [members, invite, settings] = await Promise.all([listTspMembers(slug), viewer.captain ? currentInvite(slug) : Promise.resolve(null), getSettings(slug)]);
  const h = headers();
  const origin = originFrom((k) => h.get(k));
  const runners = members.filter((m) => m.role === "runner").length;
  const waiting = members.filter((m) => m.placeholder).length;

  return (
    <TspPage viewer={viewer} active="team" extraCss={routeCss + teamCss + tspTeamCss}>
      {viewer.captain && (
        <section className="tsp-sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>Invite link</h2>
              <span className="mono">SEND IT TO YOUR TEAM</span>
            </div>
            <InviteBox slug={slug} url={invite ? tspInviteUrl(origin, slug, invite.token) : null} uses={invite?.uses ?? 0} />
          </div>
        </section>
      )}

      <section className="tsp-sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>The team</h2>
            <span className="mono">
              {runners} RUNNER{runners === 1 ? "" : "S"} · {members.length - runners} CREW
              {waiting > 0 ? ` · ${waiting} NOT JOINED YET` : ""}
            </span>
          </div>
          <ul className="tsp-roster">
            {members.map((m) => (
              <li key={m.id}>
                <div className="who">
                  <b>
                    {m.name}
                    {m.captain && <span className="tsp-chip fill">Captain</span>}
                    {m.placeholder && <span className="tsp-chip wait">Not joined yet</span>}
                  </b>
                  <small>
                    {m.role}
                    {viewer.captain && m.email ? ` · ${m.email}` : ""}
                  </small>
                </div>
                <MemberPlan slug={slug} id={m.id} pace={m.paceSec} squad={m.squad} canPace={viewer.captain || m.id === viewer.member?.id} canSquad={viewer.captain} planPaceSec={viewer.team.planPaceSec} />
                {viewer.captain && <MemberActions slug={slug} id={m.id} name={m.name} captain={m.captain} role={m.role} self={m.id === viewer.member?.id} placeholder={m.placeholder} />}
              </li>
            ))}
          </ul>
          {viewer.captain && (
            <div className="tsp-add">
              <div className="sec-head">
                <h2>Add a runner</h2>
                <span className="mono">BEFORE THEY JOIN</span>
              </div>
              <AddRunnerForm slug={slug} />
            </div>
          )}
        </div>
      </section>

      {viewer.captain && (
        <section className="tsp-sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>Settings</h2>
              <span className="mono">CAPTAINS</span>
            </div>
            <TeamSettingsForm
              slug={slug}
              initial={{
                route: viewer.team.route,
                name: viewer.team.name,
                secrets: viewer.team.secrets,
                shareVan: viewer.team.shareVan,
                startAt: viewer.team.startAt,
                planPaceSec: viewer.team.planPaceSec,
                splitCount: settings.splitCount,
              }}
            />
          </div>
        </section>
      )}
    </TspPage>
  );
}
