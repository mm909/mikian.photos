import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { teamPath } from "@/lib/tsp/paths";
import { otherVans, teamPositions } from "@/lib/tsp/positions";
import { gateTspDev, getTspViewer, listTspMembers, tspTitle } from "@/lib/tsp/team";
import { routeCss } from "@/app/lasd26/routeCss";
import { teamCss } from "@/app/lasd26/teamCss";
import { TspPage } from "../TspPage";
import { SignInButton } from "../TeamClient";
import { RouteView } from "./RouteView";

/**
 * A TEAM'S FRONT PAGE IS THE ROUTE (owner, 2026-11-16: "there's not really a
 * recruiting call here … the major page that I care about is the route").
 * /tsp/lalv/<team>: the map with everyone on it, the share switch, the turn
 * by turn. ?leg=<startCm>-<endCm> opens it fitted to one leg (the LEGS
 * page's "On the map" door); ?runner=<memberId> with that runner's legs in
 * ink.
 *
 * Team only — the route a team picks is its own business. Signed out → sign
 * in; not on the team → the invite notice.
 */

export const viewport: Viewport = { themeColor: "#F4F3EE" };
export const dynamic = "force-dynamic";

type Props = { params: { team: string }; searchParams?: { leg?: string | string[]; runner?: string | string[]; look?: string | string[] } };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getTspViewer(params.team, null);
  return { title: tspTitle(`${viewer?.team.name ?? "TSP"} — Route`), robots: { index: false, follow: false } };
}

export default async function TeamRoutePage({ params, searchParams }: Props) {
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

  const [members, positions, others, legs] = await Promise.all([
    listTspMembers(slug),
    teamPositions(slug).catch(() => []),
    otherVans(slug).catch(() => []),
    db.teamLeg.findMany({ where: { team: slug }, orderBy: { startCm: "asc" }, select: { startCm: true, endCm: true, memberId: true } }).catch(() => []),
  ]);
  const m = /^(\d{1,5})-(\d{1,5})$/.exec(one(searchParams?.leg));
  const leg: [number, number] | null = m && Number(m[2]) > Number(m[1]) ? [Number(m[1]), Number(m[2])] : null;
  const lookRaw = one(searchParams?.look);
  const look = lookRaw === "a" || lookRaw === "b" || lookRaw === "c" ? lookRaw : "";
  const runner = members.find((x) => x.id === one(searchParams?.runner))?.id ?? null;

  return (
    <TspPage viewer={viewer} active="route" extraCss={routeCss + teamCss} look={look}>
      <RouteView
        look={look}
        nowMs={Date.now()}
        slug={slug}
        route={viewer.team.route}
        secrets={viewer.team.secrets}
        meId={viewer.member?.id ?? null}
        members={members.map((x) => ({ id: x.id, name: x.name, role: x.role }))}
        initial={{ positions, others, legs, team: { startAt: viewer.team.startAt, planPaceSec: viewer.team.planPaceSec, shareVan: viewer.team.shareVan } }}
        initialLeg={leg}
        initialRunner={runner}
      />
    </TspPage>
  );
}
