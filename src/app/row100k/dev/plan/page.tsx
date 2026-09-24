import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CHALLENGE, FIRST_DAY, LAST_DAY, MONTH, daysElapsed } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { PlanTool } from "./PlanTool";
import { planCss } from "./planCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The plan (dev) — Rowtember",
  robots: { index: false, follow: false },
};

/* THE PLAN, dev for now (owner ask, 2026-09-08; rebuilt 2026-09-24 as a
 * calendar: "show a calendar of the remaining days with the meters split
 * among them … let me change the number for each day … remember the plan
 * when I come back"). Given a target in meters, what does the rest of the
 * month have to look like, day by day — and, with a pace goal, where the
 * average split is and where it has to go. The rower's own rows this
 * month feed the need and the past days of the calendar; everything
 * planned is kept in the browser per rower (PlanTool.tsx). Admin-only in
 * production, open in local dev, the same gate as /row100k/shareables;
 * reached from the account menu (BarAccount.tsx). */
export default async function DevPlanPage() {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();

  /* This month's rows, in the order they were done — the need is what is
   * left of the target after them, the pace chart is their running
   * average. */
  let rows: { day: string; meters: number; seconds: number }[] = [];
  if (viewer.myParticipantId) {
    try {
      const all = await db.rowEntry.findMany({
        where: { participantId: viewer.myParticipantId, day: { gte: FIRST_DAY, lte: LAST_DAY } },
        select: { day: true, meters: true, seconds: true },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      });
      rows = all.map((r) => ({ day: r.day, meters: r.meters, seconds: r.seconds }));
    } catch (err) {
      console.error("row100k/dev/plan: failed to load the viewer's rows", err);
    }
  }
  const today = daysElapsed();
  const daysLeft = Math.max(1, MONTH.days - today + 1);
  /* One plan per rower per browser; a signed-in viewer who has not joined
   * still gets a plan, under "anon", so the tool can be tried. */
  const storageKey = `${CHALLENGE}:${viewer.me?.rowerNumber ?? "anon"}`;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{planCss}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The plan</h2>
            <span className="mono">
              DEV · {MONTH.label.toUpperCase()} · {daysLeft} {daysLeft === 1 ? "DAY" : "DAYS"} LEFT
            </span>
          </div>
          <PlanTool
            storageKey={storageKey}
            month={{ key: MONTH.key, days: MONTH.days, firstDow: MONTH.firstDow, label: MONTH.label, short: MONTH.short }}
            today={today}
            rows={rows}
          />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
