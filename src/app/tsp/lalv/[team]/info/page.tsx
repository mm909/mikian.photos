import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { listInfoItems } from "@/lib/lasd26/info";
import { teamPath, tspApi } from "@/lib/tsp/paths";
import { gateTspDev, getTeam, getTspViewer, tspTitle } from "@/lib/tsp/team";
import { TspPage } from "@/app/tsp/lalv/TspPage";
import { infoCss } from "@/app/lasd26/infoCss";
import { InfoInvite, InfoSheet, InfoSignIn, type WireItem } from "@/app/lasd26/info/InfoSheet";

/**
 * A TSP TEAM'S INFO SHEET (teamPath(slug, "/info") = /tsp/lalv/[team]/info)
 * — owner, 2026-11-16: "I like the info tab … let's just make an info sheet
 * per team … we should have this edit and remove. We also need the add …
 * I should also be able to reorder the notes."
 *
 * The lasd26 sheet (src/app/lasd26/info) keyed by the team's slug: the
 * lines are TeamInfoItem rows, seeded on first read from TSP_DEFAULT_ITEMS
 * (lib/lasd26/infoSheet.ts — labels and hints, no values), and the
 * CAPTAINS edit, add, remove and reorder them through /api/tsp/[team]/info;
 * members read. Signed out → the sign-in notice; signed in but not on this
 * team → the invite notice. Behind the dev gate (CLAUDE.md) and noindex.
 */

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated, live values — never render statically.
export const dynamic = "force-dynamic";

type Props = { params: { team: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = await getTeam(params.team);
  return {
    title: tspTitle(`${team?.name ?? "TSP"} — Info sheet`),
    description: "The team's sheet — addresses, times, who to call.",
    robots: { index: false, follow: false },
  };
}

export default async function TspInfoPage({ params }: Props) {
  const actor = await gateTspDev();
  const viewer = await getTspViewer(params.team, actor);
  if (!viewer) notFound();
  const slug = viewer.team.slug;

  let body: ReactNode;
  let eyebrow: string;
  if (!viewer.actor) {
    body = <InfoSignIn callbackUrl={teamPath(slug, "/info")} />;
    eyebrow = "TEAM ONLY";
  } else if (!viewer.onTeam) {
    body = <InfoInvite team={viewer.team.name} from="your team captain" />;
    eyebrow = "TEAM ONLY";
  } else {
    let items: WireItem[] = [];
    try {
      items = (await listInfoItems(slug)).map((it) => ({ key: it.key, label: it.label, value: it.value, hint: it.hint }));
    } catch (err) {
      // The table is not pushed yet: an empty sheet, not a crash.
      console.error("tsp/info: list failed (table pushed?)", err);
    }
    const filled = items.filter((it) => it.value.trim() !== "").length;
    body = <InfoSheet items={items} canEdit={viewer.captain} api={tspApi(slug, "/info")} />;
    eyebrow = `${filled} OF ${items.length} FILLED IN`;
  }

  return (
    <TspPage viewer={viewer} active="info" extraCss={infoCss}>
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Info sheet</h2>
            <span className="mono">{eyebrow}</span>
          </div>
          <p className="if-lede">The team&rsquo;s sheet — addresses, times, who to call.</p>
          {body}
        </div>
      </section>
    </TspPage>
  );
}
