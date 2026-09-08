import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GOAL_METERS, daysElapsed } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { PlanTool } from "./PlanTool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The plan (dev) — 100K September",
  robots: { index: false, follow: false },
};

/* THE PLAN, dev for now (owner ask, 2026-09-08): given a target in meters
 * and an overall average split, what does the rest of the month have to
 * look like — meters a day, and the split the remaining meters must be
 * rowed at. Prefilled from the signed-in rower's own rows; every number
 * stays editable. Admin-only in production, open in local dev, the same
 * gate as /row100k/dev/stats. */
export default async function DevPlanPage() {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();

  let meters = 0;
  let seconds = 0;
  if (viewer.myParticipantId) {
    try {
      const rows = await db.rowEntry.findMany({
        where: { participantId: viewer.myParticipantId },
        select: { meters: true, seconds: true },
      });
      meters = rows.reduce((s, r) => s + r.meters, 0);
      seconds = rows.reduce((s, r) => s + r.seconds, 0);
    } catch (err) {
      console.error("row100k/dev/plan: failed to load the viewer's rows", err);
    }
  }
  /* Days still to row, today included: day 8 of 30 leaves 23. */
  const daysLeft = Math.max(1, 31 - daysElapsed());

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The plan</h2>
            <span className="mono">DEV · WHAT THE REST OF THE MONTH TAKES</span>
          </div>
          <PlanTool meters={meters} seconds={seconds} daysLeft={daysLeft} goal={GOAL_METERS} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
