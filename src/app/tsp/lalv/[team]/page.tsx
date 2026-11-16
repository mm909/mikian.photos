import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { teamPath } from "@/lib/tsp/paths";
import { otherVans, teamPositions } from "@/lib/tsp/positions";
import { teamCourseUrl } from "@/lib/tsp/courseStore";
import { gateTspDev, getTspViewer, listTspMembers, tspTitle } from "@/lib/tsp/team";
import { courseUrl } from "../course";
import { routeCss } from "@/app/lasd26/routeCss";
import { teamCss } from "@/app/lasd26/teamCss";
import { TspPage } from "../TspPage";
import { SignInButton } from "../TeamClient";
import { MapView } from "./MapView";

/**
 * A TEAM'S FRONT PAGE IS THE MAP (owner, 2026-11-16: "I want a dedicated page
 * for just the route (physical map)"; MapView.tsx). /tsp/lalv/<team>: the
 * course full screen, every leg in its runner's colour, the hand-offs, the
 * people; one OPTIONS button holds the rest. The turn by turn and the ETAs
 * are on /turns, who runs what on /legs.
 *
 * ?leg=<startCm>-<endCm> opens it fitted to one leg (the PLAN page's "On the
 * map" door); ?runner=<memberId> with only that runner's legs; ?at=<metres>
 * on a point (a row tapped on the TURNS page).
 *
 * Team only — the route a team picks is its own business. Signed out → sign
 * in; not on the team → the invite notice.
 */

export const viewport: Viewport = { themeColor: "#F4F3EE" };
export const dynamic = "force-dynamic";

type Props = { params: { team: string }; searchParams?: { leg?: string | string[]; runner?: string | string[]; at?: string | string[] } };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getTspViewer(params.team, null);
  return { title: tspTitle(`${viewer?.team.name ?? "TSP"} — Map`), robots: { index: false, follow: false } };
}

export default async function TeamMapPage({ params, searchParams }: Props) {
  const actor = await gateTspDev();
  const viewer = await getTspViewer(params.team, actor);
  if (!viewer) notFound();
  const slug = viewer.team.slug;

  if (!viewer.onTeam) {
    return (
      <TspPage viewer={viewer} active="route" extraCss={teamCss}>
        <section className="tsp-sec">
          <div className="wrap">
            <div className="jn-bad">
              <strong>{viewer.actor ? "Not on this team yet." : "Team only."}</strong>
              {viewer.actor ? "You are signed in, but this account has not joined. You need the invite link from your captain." : "Sign in to see the route, the legs and where everyone is. Not on the team? You need the invite link from your captain."}
            </div>
            {!viewer.actor && <SignInButton callback={teamPath(slug, "")} />}
          </div>
        </section>
      </TspPage>
    );
  }

  const stock = courseUrl(viewer.team.route, viewer.team.secrets);
  const [members, positions, others, legs, url] = await Promise.all([
    listTspMembers(slug),
    teamPositions(slug).catch(() => []),
    otherVans(slug).catch(() => []),
    db.teamLeg.findMany({ where: { team: slug }, orderBy: { startCm: "asc" }, select: { startCm: true, endCm: true, memberId: true } }).catch(() => []),
    teamCourseUrl(viewer.team).catch(() => stock),
  ]);
  const m = /^(\d{1,5})-(\d{1,5})$/.exec(one(searchParams?.leg));
  const leg: [number, number] | null = m && Number(m[2]) > Number(m[1]) ? [Number(m[1]), Number(m[2])] : null;
  const runner = members.find((x) => x.id === one(searchParams?.runner))?.id ?? null;
  const at = /^\d{1,7}$/.test(one(searchParams?.at)) ? Number(one(searchParams?.at)) : null;

  return (
    <TspPage viewer={viewer} active="route" extraCss={routeCss + teamCss} bare>
      <MapView
        nowMs={Date.now()}
        slug={slug}
        teamName={viewer.team.name}
        courseUrl={url}
        edited={url !== stock}
        captain={viewer.captain}
        meId={viewer.member?.id ?? null}
        members={members.map((x) => ({ id: x.id, name: x.name, role: x.role, paceSec: x.paceSec, squad: x.squad, placeholder: x.placeholder }))}
        initial={{ positions, others, legs, team: { startAt: viewer.team.startAt, planPaceSec: viewer.team.planPaceSec, shareVan: viewer.team.shareVan } }}
        initialLeg={leg}
        initialRunner={runner}
        initialAt={at}
      />
    </TspPage>
  );
}
