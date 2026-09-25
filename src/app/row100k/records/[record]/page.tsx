import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nowMs as clockNow } from "@/lib/row100k";
import { parsePeriod } from "@/lib/rowPeriod";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { statsCss } from "../../stats/statsCss";
import { parseDiv, periodDef, recordDef, type BoardKey } from "../defs";
import { leadCss } from "../leadCss";
import { recordsCss } from "../recordsCss";
import { buildRecordsPayload } from "../recordsData";
import { RecordsShell } from "../RecordsShell";

export const dynamic = "force-dynamic";

/* THE FULL RANKINGS — one record, every place, for any month or all time.
 *
 * The board page is retired (owner, 2026-09-24: "the board is reduced into
 * the records page: we don't need the board page anymore"): the TOTAL
 * METERS view here IS the board — Boards.tsx with its tiers (THE 100K
 * CLUB, ROWTEMBER ATHLETE, ROWTEMBER PARTICIPANT, LIGHTS OUT, .25M), the
 * up/down arrows, the progress bar toward 100K, the tags, and the rule
 * that keeps rows under 10k off the list. The other four records keep
 * their flat ranking, and since 2026-09-25 two more categories are the
 * month's day and week boards (owner: "add METERS BY DAY and METERS BY
 * WEEK to the category menu, with the same day and week picker as the
 * stats page"). /row100k/board redirects here. THE BOARD on the rail
 * lands here, plain URL (owner, 2026-09-25).
 *
 * This file is the frame: who is looking, which category the URL segment
 * names (404 for any other), which bracket ?d=, which period ?m= and which
 * day ?day= or week ?w= name, and the payload for the period
 * (recordsData.ts) — everything under the bar is the client shell
 * (RecordsShell.tsx), fed once from here and from then on swapping in
 * place (owner, 2026-09-25: "why is there a loading page between each
 * click (category, bracket, month)? There shouldn't be"). The old
 * /row100k/records/<key> URLs still render here for the given key; the
 * shell keeps the URL in step as it swaps (recordsUrl.ts).
 *
 * Blackout: the payload is built as THIS viewer sees it (boardView), so a
 * hidden meters value never leaves the server — only a digit count does;
 * times are public for everyone (owner, 2026-09-08). */

type Params = { record: string };
type Query = { d?: string | string[]; m?: string | string[]; day?: string | string[]; w?: string | string[] };

const one = (q: string | string[] | undefined) => (Array.isArray(q) ? q[0] : q);

/* ?day=12 → 12; anything else → null. Clamping is the shell's, against
 * the month it holds. */
const idx = (q: string | string[] | undefined): number | null => {
  const n = Number(one(q));
  return Number.isInteger(n) && n >= 1 ? n : null;
};

const titleOf = (key: string) => recordDef(key)?.title ?? periodDef(key)?.title;

export function generateMetadata({ params, searchParams }: { params: Params; searchParams?: Query }): Metadata {
  const period = parsePeriod(searchParams?.m, clockNow());
  /* A period board on all time lands on the board (below), so it is
   * titled as the board. */
  const title = period.kind === "all" && periodDef(params.record) ? titleOf("total") : titleOf(params.record);
  return {
    title: title ? `${title} — ${period.label} — Rowtember` : "The records — Rowtember",
    description: "Full record rankings for the Rowtember challenge.",
  };
}

export default async function RecordRankingPage({ params, searchParams }: { params: Params; searchParams?: Query }) {
  const def = recordDef(params.record) ?? periodDef(params.record);
  if (!def) notFound();
  const div = parseDiv(one(searchParams?.d));

  /* WHICH MONTH (owner, 2026-09-24): this one unless ?m= says a past one
   * or all time. The same page, the same rankings, other rows. ALL TIME
   * has no day or week to cut, so a period category lands on the board. */
  const period = parsePeriod(searchParams?.m, clockNow());
  const key: BoardKey = period.kind === "all" && (def.key === "day" || def.key === "week") ? "total" : def.key;

  const viewer = await resolveViewer();
  const initial = await buildRecordsPayload(viewer, period);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      {/* The stats page's rules ride along for the calendar and the day
          line the period boards borrow from it (stats/DayCalendar.tsx,
          .st-cal / .st-day), so the two pickers are one picker. */}
      <style>{statsCss}</style>
      <style>{recordsCss}</style>
      <style>{leadCss}</style>

      {/* THE BOARD is the lit tab on every record (owner, 2026-09-25: a
          header link for the board that lands here, on total meters). */}
      <RowBar active="board" {...barProps(viewer)} />

      <RecordsShell initial={initial} recordKey={key} div0={div} day0={idx(searchParams?.day)} week0={idx(searchParams?.w)} />

      <RowFooter />
    </div>
  );
}
