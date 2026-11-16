import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { teamPath } from "@/lib/tsp/paths";
import { teamPositions } from "@/lib/tsp/positions";
import { teamCourseUrl } from "@/lib/tsp/courseStore";
import { gateTspDev, getTspViewer, listTspMembers, tspTitle } from "@/lib/tsp/team";
import { courseUrl } from "../../course";
import { expensesCss } from "@/app/lasd26/expensesCss";
import { routeCss } from "@/app/lasd26/routeCss";
import { teamCss } from "@/app/lasd26/teamCss";
import { TspPage } from "../../TspPage";
import { SignInButton } from "../../TeamClient";
import { LegsView } from "./LegsView";

/**
 * LEGS — who runs what (LegsView.tsx; lib/tsp/legs.ts). Team only.
 * ?runner=<memberId> opens on that runner; otherwise it opens on the viewer
 * when they are down for a leg, else on the whole plan.
 */

export const viewport: Viewport = { themeColor: "#F4F3EE" };
export const dynamic = "force-dynamic";

type Props = { params: { team: string }; searchParams?: { runner?: string | string[] } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getTspViewer(params.team, null);
  return { title: tspTitle(`${viewer?.team.name ?? "TSP"} — Plan`), robots: { index: false, follow: false } };
}

export default async function LegsPage({ params, searchParams }: Props) {
  const actor = await gateTspDev();
  const viewer = await getTspViewer(params.team, actor);
  if (!viewer) notFound();
  const slug = viewer.team.slug;

  if (!viewer.onTeam) {
    return (
      <TspPage viewer={viewer} active="legs" extraCss={teamCss}>
        <section className="tsp-sec">
          <div className="wrap">
            <div className="jn-bad">
              <strong>{viewer.actor ? "Not on this team yet." : "Team only."}</strong>
              {viewer.actor ? "You need the invite link from your captain." : "Sign in to see who runs what. Not on the team? You need the invite link from your captain."}
            </div>
            {!viewer.actor && <SignInButton callback={teamPath(slug, "/legs")} />}
          </div>
        </section>
      </TspPage>
    );
  }

  const [members, legs, positions, url] = await Promise.all([
    listTspMembers(slug),
    db.teamLeg.findMany({ where: { team: slug }, orderBy: { startCm: "asc" }, select: { startCm: true, endCm: true, memberId: true } }).catch(() => []),
    teamPositions(slug).catch(() => []),
    teamCourseUrl(viewer.team).catch(() => courseUrl(viewer.team.route, viewer.team.secrets)),
  ]);
  const raw = searchParams?.runner;
  const runner = members.find((x) => x.id === (Array.isArray(raw) ? raw[0] : raw))?.id ?? null;

  return (
    <TspPage viewer={viewer} active="legs" extraCss={expensesCss + routeCss + teamCss}>
      <section className="tsp-sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>The plan</h2>
            <span className="mono">WHO RUNS WHAT · SHIFTS · HAND-OFFS</span>
          </div>
          <LegsView
            nowMs={Date.now()}
            slug={slug}
            courseUrl={url}
            meId={viewer.member?.id ?? null}
            members={members.map((x) => ({ id: x.id, name: x.name, role: x.role, paceSec: x.paceSec, squad: x.squad, placeholder: x.placeholder }))}
            initialLegs={legs}
            team={{ startAt: viewer.team.startAt, planPaceSec: viewer.team.planPaceSec }}
            positions={positions}
            initialRunner={runner}
          />
        </div>
      </section>
    </TspPage>
  );
}
