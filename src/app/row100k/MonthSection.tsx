import { Heatmap } from "./Heatmap";
import { StatsShare, type CommunityShare } from "./StatsShare";

/* "The month" block on the stats page: the community calendar and one
 * SHARE A CARD button under it. The CUMULATIVE | DAILY chart that used to
 * follow the calendar is gone (owner call, 2026-09-05: the month is fine,
 * the cumulative and daily charts are not) — the curve card is still in
 * the share dialog's picker, drawn from the same `daily`. No state left,
 * so this renders on the server; StatsShare carries its own client
 * boundary. */

export function MonthSection({
  byDay,
  thresholds,
  daily,
  community,
  hourGrid,
  days = 30,
}: {
  byDay: Record<string, number>;
  thresholds: [number, number, number];
  daily: { day: string; cum: number }[];
  community: { meters: number; rowers: number; sessions: number };
  hourGrid?: number[][];
  /* September days elapsed — the calendar stops at today. */
  days?: number;
}) {
  const share: CommunityShare = {
    meters: community.meters,
    rowers: community.rowers,
    sessions: community.sessions,
    byDay,
    daily,
    hourGrid,
  };

  return (
    <div>
      <Heatmap byDay={byDay} thresholds={thresholds} days={days} />
      <StatsShare community={share} prefer="rowtember-community-month" />
    </div>
  );
}
