import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { expensesPayload } from "@/lib/lasd26/expenses";
import { teamPath, tspApi } from "@/lib/tsp/paths";
import { gateTspDev, getTeam, getTspViewer, tspTitle } from "@/lib/tsp/team";
import { expensesCss } from "@/app/lasd26/expensesCss";
import { Expenses, InviteNotice, SignInNotice } from "@/app/lasd26/expenses/Expenses";
import { TspPage } from "@/app/tsp/lalv/TspPage";

/**
 * A TSP team's EXPENSES (teamPath(slug, "/expenses")) — the lasd26 invoice
 * (src/app/lasd26/expenses) for this team (owner, 2026-11-16: "I want the
 * expenses again. I think that worked out pretty good."): the same sheet
 * component pointed at /api/tsp/<team>/expenses, where a captain stands in
 * for "the owner". Signed out → the sign-in notice; signed in but not on
 * the team → the invite notice; a member → the sheet.
 *
 * In development (CLAUDE.md): gateTspDev() first, "(dev)" in the title,
 * noindex.
 */

export async function generateMetadata({ params }: { params: { team: string } }): Promise<Metadata> {
  const team = await getTeam(params.team);
  return {
    title: tspTitle(`${team?.name ?? "TSP"} — Expenses`),
    description: "Every cost of the crossing and each person's share.",
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated, live numbers — never render statically.
export const dynamic = "force-dynamic";

export default async function TspExpensesPage({ params }: { params: { team: string } }) {
  const actor = await gateTspDev();
  const viewer = await getTspViewer(params.team, actor);
  if (!viewer) notFound();
  const slug = viewer.team.slug;

  let body: ReactNode;
  let eyebrow: string;
  if (!viewer.actor) {
    body = <SignInNotice callbackUrl={teamPath(slug, "/expenses")} from="your captain" />;
    eyebrow = "TEAM ONLY";
  } else if (!viewer.onTeam) {
    body = <InviteNotice teamName={viewer.team.name} from="your captain" />;
    eyebrow = "TEAM ONLY";
  } else {
    const payload = await expensesPayload(viewer, slug);
    body = <Expenses initial={payload} apiBase={tspApi(slug, "/expenses")} />;
    eyebrow = `${payload.lineCount} LINE${payload.lineCount === 1 ? "" : "S"} · SPLIT ${payload.splitCount} WAYS`;
  }

  return (
    <TspPage viewer={viewer} active="expenses" extraCss={expensesCss}>
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Expenses</h2>
            <span className="mono">{eyebrow}</span>
          </div>
          {body}
        </div>
      </section>
    </TspPage>
  );
}
