import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nowMs as clockNow } from "@/lib/row100k";
import { parsePeriod } from "@/lib/rowPeriod";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { parseDiv, recordDef } from "../defs";
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
 * their flat ranking. /row100k/board redirects here. THE BOARD on the
 * rail lands here, plain URL (owner, 2026-09-25).
 *
 * This file is the frame: who is looking, which record the URL segment
 * names (404 for any other), which bracket ?d= and which period ?m= name,
 * and the payload for the period (recordsData.ts) — everything under the
 * bar is the client shell (RecordsShell.tsx), fed once from here and from
 * then on swapping in place (owner, 2026-09-25: "why is there a loading
 * page between each click (category, bracket, month)? There shouldn't
 * be"). The old /row100k/records/<key> URLs still render here for the
 * given key; the shell keeps the URL in step as it swaps (recordsUrl.ts).
 *
 * Blackout: the payload is built as THIS viewer sees it (boardView), so a
 * hidden meters value never leaves the server — only a digit count does;
 * times are public for everyone (owner, 2026-09-08). */

type Params = { record: string };
type Query = { d?: string | string[]; m?: string | string[] };

const one = (q: string | string[] | undefined) => (Array.isArray(q) ? q[0] : q);

export function generateMetadata({ params, searchParams }: { params: Params; searchParams?: Query }): Metadata {
  const def = recordDef(params.record);
  const period = parsePeriod(searchParams?.m, clockNow());
  return {
    title: def ? `${def.title} — ${period.label} — Rowtember` : "The records — Rowtember",
    description: "Full record rankings for the Rowtember challenge.",
  };
}

export default async function RecordRankingPage({ params, searchParams }: { params: Params; searchParams?: Query }) {
  const def = recordDef(params.record);
  if (!def) notFound();
  const div = parseDiv(one(searchParams?.d));

  /* WHICH MONTH (owner, 2026-09-24): this one unless ?m= says a past one
   * or all time. The same page, the same rankings, other rows. */
  const period = parsePeriod(searchParams?.m, clockNow());

  const viewer = await resolveViewer();
  const initial = await buildRecordsPayload(viewer, period);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{recordsCss}</style>
      <style>{leadCss}</style>

      {/* THE BOARD is the lit tab on every record (owner, 2026-09-25: a
          header link for the board that lands here, on total meters). */}
      <RowBar active="board" {...barProps(viewer)} />

      <RecordsShell initial={initial} recordKey={def.key} div0={div} />

      <RowFooter />
    </div>
  );
}
