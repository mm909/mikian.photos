import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ensureOwnerMember, getTeamViewer } from "@/lib/lasd26/team";
import { expensesPayload } from "@/lib/lasd26/expenses";
import { LasdFooter } from "../LasdFooter";
import { LasdPage } from "../LasdPage";
import { expensesCss } from "../expensesCss";
import { Expenses, InviteNotice, SignInNotice } from "./Expenses";

/**
 * EXPENSES (lasdPath("/expenses"); lib/lasd26/paths.ts) — the crew's
 * invoice (owner, 2026-10-15: "kind of like an invoice … they can see
 * every cost and where it came from … add costs … title, cost, and a
 * picture"). Team pages are reached only through the invite link: a
 * visitor who is signed out sees the sign-in notice, one who is signed in
 * but not on the team sees the invite notice, and the list itself renders
 * only for a member (the owner counts — and gets his member row made on
 * the way in, so PAID BY can name him and his lines are his).
 */

export const metadata: Metadata = {
  title: "LASD26 — Expenses",
  description: "Every cost of the crossing and each person's share.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated, live numbers — never render statically.
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const viewer = await ensureOwnerMember(await getTeamViewer());

  let body: ReactNode;
  let eyebrow: string;
  if (!viewer.actor) {
    body = <SignInNotice />;
    eyebrow = "TEAM ONLY";
  } else if (!viewer.onTeam) {
    body = <InviteNotice />;
    eyebrow = "TEAM ONLY";
  } else {
    const payload = await expensesPayload(viewer);
    body = <Expenses initial={payload} />;
    // Every live line, the real costs inside the buckets included.
    eyebrow = `${payload.lineCount} LINE${payload.lineCount === 1 ? "" : "S"} · SPLIT ${payload.splitCount} WAYS`;
  }

  return (
    <LasdPage viewer={viewer} active="expenses" extraCss={expensesCss}>
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Expenses</h2>
            <span className="mono">{eyebrow}</span>
          </div>
          {body}
        </div>
      </section>

      <LasdFooter />
    </LasdPage>
  );
}
