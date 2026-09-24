import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MONTH, fmtRowerNumber, nowMs as clockNow } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { periodOptions } from "@/lib/rowPeriod";
import { archivo, archivoBlack, spaceMono, css } from "../../../theme";
import { PeriodSelect } from "../../../PeriodSelect";
import { RowBar } from "../../../RowBar";
import { RowFooter } from "../../../RowFooter";
import { getRower, rowerShareView } from "../shareData";
import { ShareGrid } from "./ShareGrid";
import { shareCss } from "./shareCss";

export const dynamic = "force-dynamic";

/* THE SHAREABLES PAGE — a rower's master deck (owner, 2026-09-24:
 * "Instead of My poster, turn that into Shareables — a page where you can
 * go to get all the copy-pasteable shareables: the ones you'd have for
 * your profile (meters this month, meters this day, the bests) and also
 * select a row and share based on that row's stats. A master shareables
 * page. Keep the existing share buttons working as they are; the poster
 * lives there too."). Every card the profile's SHARE would offer, the best
 * card for every best, and the row cards for a row picked off the month,
 * all painted inline with COPY and DOWNLOAD under each (ShareGrid.tsx);
 * the poster studio is a link on the dateline.
 *
 * The payload is the profile's own (shareData.ts), over the same ?m=
 * month, so a card made here is the card made there. Only the rower
 * themself and admins get the page: the cards carry the rower's numbers,
 * and a stranger is sent to the profile, which decides for itself what a
 * stranger may see. /row100k/shareables is the admin switches page, so
 * this lives under the rower. */

function parseNum(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: { num: string } }): Promise<Metadata> {
  const num = parseNum(params.num);
  const data = num ? await getRower(num).catch(() => null) : null;
  return {
    title: data ? `Rower ${fmtRowerNumber(data.participant.rowerNumber)} · ${data.participant.displayName} — Shareables` : "Rower — Shareables",
    robots: { index: false, follow: false },
  };
}

export default async function RowerSharePage({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: { m?: string | string[]; row?: string | string[] };
}) {
  const num = parseNum(params.num);
  if (!num) notFound();
  const data = await getRower(num).catch(() => null);
  if (!data) notFound();
  const p = data.participant;
  const viewer = await resolveViewer();

  // The profile, with the month kept, for anyone this page is not for —
  // and for an admin who cannot see this rower's numbers right now (one of
  // the elite under a window): the profile shows them the dog tag, and a
  // page of cards that would draw blocks has nothing to add.
  const m = one(searchParams?.m);
  const profileHref = m ? `/row100k/r/${num}?m=${encodeURIComponent(m)}` : `/row100k/r/${num}`;
  if (!(viewer.isAdmin || viewer.myParticipantId === p.id)) redirect(profileHref);

  const view = await rowerShareView(num, searchParams?.m, viewer);
  if (!view) notFound();
  if (view.masked) redirect(profileHref);

  const options = periodOptions(clockNow());
  const base = `/row100k/r/${num}/share`;
  const periodKey = view.period.key;
  const gridBase = periodKey === MONTH.key ? base : `${base}?m=${periodKey}`;
  const periodLabel = view.period.kind === "month" ? view.period.label : "All time";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{shareCss}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap front">
          <div className="sec-head">
            <h2>
              {fmtRowerNumber(p.rowerNumber)} {p.displayName}
            </h2>
            <span className="mono">SHAREABLES</span>
          </div>
          {/* THE MONTH AS A WORD THAT IS A MENU (the profile idiom,
              PeriodSelect.tsx): every card below is over this month. With
              one month to choose from the word is plain text. The poster
              studio, on this rower, at the right (owner: the poster lives
              here too). */}
          <div className="shp-line">
            <span>{options.length > 2 ? <PeriodSelect options={options} value={periodKey} base={base} current={MONTH.key} /> : periodLabel}</span>
            <span>
              <Link href={`/row100k/posters?r=${p.rowerNumber}`}>The poster →</Link>
              {" · "}
              <Link href={profileHref}>The profile →</Link>
            </span>
          </div>

          <ShareGrid data={view.shareData} bests={view.bests} rows={view.rows} initialRowId={one(searchParams?.row) ?? null} base={gridBase} periodLabel={periodLabel.toUpperCase()} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
