import type { Metadata } from "next";
import { db } from "@/lib/db";
import { CHALLENGE, FIRST_DAY, LAST_DAY, MONTH, daysElapsed } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { PlanTool } from "./PlanTool";
import { planCss } from "./planCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plan — Rowtember",
};

/* THE PLAN, live since 2026-09-25 (owner: "Lets make the plan live"). A dev
 * page from 2026-09-08, a calendar since 2026-09-24, simplified 2026-09-25:
 * "it's just THE PLAN, and the calendar gets a date like December 2026 …
 * days are ON or OFF, plus what was actually done". Given a target in
 * meters, what the rest of the month has to look like, day by day — and,
 * with a pace goal, where the average split is and where it has to go. The
 * rower's own rows this month feed the need, the past days of the calendar
 * and the pace goal's default; the target, the pace goal and the off days
 * are kept in the browser per rower (PlanTool.tsx). Open to anyone: a
 * signed-in rower gets their rows, everyone else the tool under "anon".
 * Reached from the account menu (BarAccount.tsx, Plan →); the old
 * dev/plan address only redirects here. */
export default async function PlanPage() {
  const viewer = await resolveViewer();

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
      console.error("row100k/plan: failed to load the viewer's rows", err);
    }
  }
  const today = daysElapsed();
  /* One plan per rower per browser; a signed-in viewer who has not joined
   * still gets a plan, under "anon", so the tool can be tried. */
  const storageKey = `${CHALLENGE}:${viewer.me?.rowerNumber ?? "anon"}`;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{planCss}</style>
      <RowBar {...barProps(viewer)} />

      {/* One section, one mono eyebrow (owner, 2026-09-25: no separation
          between the plan and the calendar). The eyebrow is the profile
          one (.pf-eye, theme.ts). */}
      <section>
        <div className="wrap">
          <div className="pf-eye">
            <span>Plan · {MONTH.label}</span>
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
