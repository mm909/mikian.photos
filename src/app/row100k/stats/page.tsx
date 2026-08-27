import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import {
  CHALLENGE,
  FIRST_DAY,
  START_MS,
  WEEKS,
  computeWeekly,
  nowMs as clockNow,
  weekIndexOf,
  type WeeklyRow,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { Curve } from "../Curve";
import { Heatmap } from "../Heatmap";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { StatsBoards } from "../Stats";
import { boardData, EMPTY_BOARDS } from "../boardData";

export const metadata: Metadata = {
  title: "The stats — 100K September",
  description: "Records, the weekly boards, the community calendar and the curve for the Rowtember challenge.",
};

export const dynamic = "force-dynamic";

/* The deep end: the five record podiums (each linking to its full ranking
 * under /row100k/records), the week-by-week boards, the community's
 * September as a calendar, and the curve. The main page keeps only the
 * standings; this is where the rest lives. */
export default async function StatsPage() {
  let boards = EMPTY_BOARDS;
  try {
    boards = await boardData();
  } catch (err) {
    console.error("row100k/stats: failed to load board data", err);
  }

  /* The weekly boards need per-entry data that boardData() doesn't carry,
   * so this page pulls the raw rows itself (same selects as boardData). */
  let weekly: WeeklyRow[][] = WEEKS.map(() => []);
  try {
    const [participants, entries] = await Promise.all([
      db.rowParticipant.findMany({
        where: { challenge: CHALLENGE },
        select: { id: true, displayName: true, instagram: true, division: true, rowerNumber: true },
        orderBy: { rowerNumber: "asc" },
      }),
      db.rowEntry.findMany({
        where: { challenge: CHALLENGE },
        select: { participantId: true, day: true, meters: true },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    weekly = computeWeekly(participants, entries);
  } catch (err) {
    console.error("row100k/stats: failed to load weekly data", err);
  }

  /* Who's looking, as a participant id — the weekly boards use it to pull
   * the signed-in rower into view below the top 10. Cosmetic: any failure
   * just renders the anonymous view. */
  let meId: string | null = null;
  try {
    const actor = await getEffectiveActor();
    if (actor) {
      const me = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { id: true },
      });
      meId = me?.id ?? null;
    }
  } catch {
    meId = null;
  }

  const started = clockNow() >= START_MS;

  /* Default to the week containing today, clamped to the challenge:
   * before September shows Week 1, after it shows the finish. */
  const today = new Date(clockNow()).toISOString().slice(0, 10);
  const wi = weekIndexOf(today);
  const defaultWeek = wi >= 0 ? wi : today < FIRST_DAY ? 0 : WEEKS.length - 1;

  // The curve carries cumulative meters; the calendar wants per-day totals.
  const communityByDay: Record<string, number> = {};
  let prev = 0;
  for (const d of boards.daily) {
    communityByDay[d.day] = d.cum - prev;
    prev = d.cum;
  }
  const biggest = Math.max(0, ...Object.values(communityByDay));
  const thresholds: [number, number, number] =
    biggest > 0
      ? [Math.round(biggest * 0.25), Math.round(biggest * 0.5), Math.round(biggest * 0.75)]
      : [2500, 5000, 10000];

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar active="stats" />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The records</h2>
          </div>
          <StatsBoards
            boards={boards}
            weekly={weekly}
            defaultWeek={defaultWeek}
            started={started}
            meId={meId}
          />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The month</h2>
            <span className="mono">EVERYONE&rsquo;S METERS, PER DAY</span>
          </div>
          <Heatmap byDay={communityByDay} thresholds={thresholds} />
          <div style={{ marginTop: 10 }}>
            <Curve daily={boards.daily} title="The curve — cumulative meters, everyone combined" />
          </div>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
