import type { Metadata } from "next";
import { nowMs as clockNow } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { parsePeriod } from "@/lib/rowPeriod";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { headCss } from "../headCss";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { recordDef } from "../records/defs";
import { leadCss } from "../records/leadCss";
import { buildStatsPayload } from "./statsData";
import { StatsShell, type StatKey } from "./StatsShell";
import { statsCss } from "./statsCss";
import { isPeriodStat } from "./statsUrl";

export const metadata: Metadata = {
  title: "The stats — Rowtember",
  description:
    "The month's meters, the records, meters by day and by week, the calendar, the hours and the field.",
};

export const dynamic = "force-dynamic";

/* THE STATS (owner review, 2026-09-05, second look; the month pass,
 * 2026-09-24; the swap-in-place pass, 2026-09-25): the head — the month
 * word, the community total, SHARE A CARD on the dateline's right — then
 * the stat block, two words that are menus (the month and the stat) over
 * the leading value and the men's and women's top five with one link to
 * the full rankings; then meters by day or by week, the month calendar,
 * the hours grid, the field and perfect attendance last.
 *
 * This file is the frame: who is looking, which period the URL names, and
 * the payload for it (statsData.ts) — everything under the bar is the
 * client shell (StatsShell.tsx), fed once from here and from then on
 * swapping in place (owner, 2026-09-25: no loading page, no scroll reset
 * on any pick). The URL still renders server-side on a reload: ?m= is the
 * period, ?s= the stat, ?day= / ?w= the board open (statsUrl.ts). No
 * sign-in gate here, ever: the anonymous view is the page. */
export default async function StatsPage({
  searchParams,
}: {
  searchParams?: { m?: string | string[]; s?: string | string[]; day?: string | string[]; w?: string | string[] };
}) {
  /* Who is looking decides what the boards may print: the period boards
   * pull the signed-in rower into view below the top 10, and during a
   * blackout the elite are hidden from everyone but admins and the rower
   * themself (boardView, blackoutRules.ts). Cosmetic on failure — the
   * anonymous view renders. */
  const viewer = await resolveViewer();

  const one = (q: string | string[] | undefined) => (Array.isArray(q) ? q[0] : q);
  const period = parsePeriod(searchParams?.m, clockNow());
  /* ?day= / ?w= (1-based): the day or week on the period board. The shell
   * clamps them into the days that have happened. */
  const num = (q: string | string[] | undefined) => {
    const n = Number(one(q));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  };
  const day0 = num(searchParams?.day);
  const week0 = num(searchParams?.w);
  /* ?s= is a record key from records/defs.ts or one of the two period
   * stats (statsUrl.ts); anything else is TOTAL METERS, the first word in
   * the list. A link from before 2026-09-25 named the day board with a
   * bare ?day= or ?w= and no stat — it still lands on that board. */
  const sRaw = one(searchParams?.s) ?? "";
  const statKey: StatKey = isPeriodStat(sRaw)
    ? sRaw
    : (recordDef(sRaw)?.key ?? (!sRaw && week0 != null ? "week" : !sRaw && day0 != null ? "day" : "total"));

  const initial = await buildStatsPayload(viewer, period);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{headCss}</style>
      <style>{statsCss}</style>
      <style>{leadCss}</style>

      <RowBar active="stats" {...barProps(viewer)} />

      <StatsShell initial={initial} statKey={statKey} day0={day0} week0={week0} />

      <RowFooter />
    </div>
  );
}
