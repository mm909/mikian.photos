import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { board100kCss } from "../../board/board100kCss";
import { m2dPlan } from "../../m2d";
import { m2dCss } from "../../m2d/m2dCss";
import { PlanSite } from "./PlanSite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "M2D cost planner (dev) — Rowtember",
  robots: { index: false, follow: false },
};

/* THE OWNER'S M2D COST PLANNER (owner, 2026-11-25: what M2D will cost him,
 * what rate he can afford; an admin-gated page on the site is fine). The
 * development gate every dev page wears (CLAUDE.md): admin only in
 * production, open in local dev, (dev) in the title, linked from the
 * DEVELOPMENT group of the account menu only. The numbers are m2dPlan
 * (row100k/m2d.ts); the rate it saves is ROWTEMBER's, live at once, through
 * api/row100k/app/m2d/plan. The app's developer settings carry the same. */
export default async function M2dPlanPage() {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();
  const plan = await m2dPlan().catch(() => null);
  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <style>{m2dCss}</style>
      <RowBar {...barProps(viewer)} />
      <main className="bd m2 m2-faq">
        <div className="wrap front">
          <h1 className="bd-date">
            <b>M2D · Cost planner</b>
            <span>Owner only</span>
          </h1>
          {plan ? (
            <PlanSite plan={plan} />
          ) : (
            <p className="bd-say" role="alert">
              The plan could not be read.
            </p>
          )}
        </div>
      </main>
      <RowFooter />
    </div>
  );
}
