import { MONTH_DAYS } from "@/lib/row100k";
import { Heatmap } from "./Heatmap";

/* "The month" block on the stats page: the community calendar. The
 * CUMULATIVE | DAILY chart that used to follow the calendar is gone (owner
 * call, 2026-09-05: the month is fine, the cumulative and daily charts are
 * not) — the curve card is still in the share dialog's picker, drawn from
 * the same `daily`. The SHARE A CARD button that sat under the calendar
 * went too (owner, 2026-09-24: one share button near the top of the page
 * with every stats card in it — stats/page.tsx). No state left, so this
 * renders on the server. */

export function MonthSection({
  byDay,
  thresholds,
  days = MONTH_DAYS,
  month,
}: {
  byDay: Record<string, number>;
  thresholds: [number, number, number];
  /* Which month the calendar draws (rowPeriod.ts); this one when absent. */
  month?: { key: string; firstDow: number; days: number };
  /* Days of the month elapsed — the calendar stops at today. */
  days?: number;
}) {
  return (
    <div>
      <Heatmap byDay={byDay} thresholds={thresholds} days={days} month={month} />
    </div>
  );
}
