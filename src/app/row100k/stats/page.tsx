import type { Metadata } from "next";
import { START_MS, nowMs as clockNow } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { Curve } from "../Curve";
import { Heatmap } from "../Heatmap";
import { StatsBoards } from "../Stats";
import { boardData, EMPTY_BOARDS } from "../boardData";

export const metadata: Metadata = {
  title: "The stats — 100K September",
  description: "Records, the community calendar and the curve for the Rowtember challenge.",
};

export const dynamic = "force-dynamic";

/* The deep end: every record with both boards' leaders side by side, the
 * community's September as a calendar, and the curve. The main page keeps
 * only the standings; this is where the rest lives. */
export default async function StatsPage() {
  let boards = EMPTY_BOARDS;
  try {
    boards = await boardData();
  } catch (err) {
    console.error("row100k/stats: failed to load board data", err);
  }

  const started = clockNow() >= START_MS;

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

      <div className="bar">
        <a className="mono back-link" href="/row100k#board">
          ← 100K SEPTEMBER
        </a>
        <span className="mono tag">THE STATS</span>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The records</h2>
          </div>
          <StatsBoards boards={boards} started={started} />
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

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <div className="big">100K SEPTEMBER — 2026</div>
          <p className="mono">
            <a href="/row100k#board">← Back to the board</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
