import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { teamPath } from "@/lib/tsp/paths";
import { teamPositions } from "@/lib/tsp/positions";
import { teamCourseUrl } from "@/lib/tsp/courseStore";
import { gateTspDev, getTspViewer, listTspMembers, tspTitle } from "@/lib/tsp/team";
import { courseUrl } from "../../course";
import { routeCss } from "@/app/lasd26/routeCss";
import { teamCss } from "@/app/lasd26/teamCss";
import { TspPage } from "../../TspPage";
import { SignInButton } from "../../TeamClient";
import { TurnsView } from "./TurnsView";

/**
 * TURNS — everything about the course that is not the map (owner,
 * 2026-11-16: "turn by turn, etas etc can be on a diff page"): where the
 * team is and at what pace, the course's figures and profile, then every
 * turn and town in order with the clock time the team gets there. A row
 * opens the map on that point. Team only.
 */

export const viewport: Viewport = { themeColor: "#F4F3EE" };
export const dynamic = "force-dynamic";

type Props = { params: { team: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getTspViewer(params.team, null);
  return { title: tspTitle(`${viewer?.team.name ?? "TSP"} — Turn by turn`), robots: { index: false, follow: false } };
}

export default async function TurnsPage({ params }: Props) {
  const actor = await gateTspDev();
  const viewer = await getTspViewer(params.team, actor);
  if (!viewer) notFound();
  const slug = viewer.team.slug;

  if (!viewer.onTeam) {
    return (
      <TspPage viewer={viewer} active="turns" extraCss={teamCss}>
        <section className="tsp-sec">
          <div className="wrap">
            <div className="jn-bad">
              <strong>{viewer.actor ? "Not on this team yet." : "Team only."}</strong>
              {viewer.actor ? "You need the invite link from your captain." : "Sign in to see the turn by turn. Not on the team? You need the invite link from your captain."}
            </div>
            {!viewer.actor && <SignInButton callback={teamPath(slug, "/turns")} />}
          </div>
        </section>
      </TspPage>
    );
  }

  const [members, positions, legs, url] = await Promise.all([
    listTspMembers(slug),
    teamPositions(slug).catch(() => []),
    db.teamLeg.findMany({ where: { team: slug }, orderBy: { startCm: "asc" }, select: { startCm: true, endCm: true, memberId: true } }).catch(() => []),
    teamCourseUrl(viewer.team).catch(() => courseUrl(viewer.team.route, viewer.team.secrets)),
  ]);

  return (
    <TspPage viewer={viewer} active="turns" extraCss={routeCss + teamCss}>
      <TurnsView
        nowMs={Date.now()}
        slug={slug}
        courseUrl={url}
        members={members.map((x) => ({ id: x.id, name: x.name, role: x.role, paceSec: x.paceSec, squad: x.squad, placeholder: x.placeholder }))}
        initial={{ positions, others: [], legs, team: { startAt: viewer.team.startAt, planPaceSec: viewer.team.planPaceSec, shareVan: viewer.team.shareVan } }}
      />
    </TspPage>
  );
}
