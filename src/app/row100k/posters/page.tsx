import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { START_MS, nowMs } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { communityPosterData, posterRoster, rowerPosterData } from "../poster/data";
import { raceDayPosterData } from "../poster/raceData";
import { poCss } from "../poster/studioCss";
import type { CommunityPoster, PosterRosterRower, RaceDayPoster, RowerPoster } from "../poster/types";
import { PosterStudio } from "./PosterStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The posters — 100K September",
  robots: { index: false, follow: false },
};

/* THE POSTER STUDIO — admin only (SPEC.md §11). Everything the sheet
 * draws is gathered here on the server (poster/data.ts) and handed to the
 * client as plain JSON; the browser only draws. The board it reads is the
 * PUBLIC one, forced open under the admin's test blackout, so a poster of
 * one of the elite draws blocks for the owner too — a poster leaves the
 * site (owner, 2026-09-05: "I shouldn't be able to know that I'm number
 * three or number four"). */

function parseNum(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

export default async function PostersPage({ searchParams }: { searchParams?: { r?: string | string[] } }) {
  const viewer = await resolveViewer();
  if (!viewer.actor || !viewer.isAdmin) notFound();

  const before = nowMs() < START_MS;
  const rNum = parseNum(searchParams?.r);
  if (searchParams?.r !== undefined && rNum === null) notFound();
  const opts = { forceBlackout: viewer.preview !== null };

  let community: CommunityPoster | null = null;
  let rower: RowerPoster | null = null;
  let roster: PosterRosterRower[] = [];
  /* RACE DAY is a chip, not a route, but everything on the ad is a server
   * read: the race AS THE CONSOLE HAS IT (the settings row over the code
   * default), how many names are in, and the photograph the owner picked
   * (poster/raceData.ts). It is read whatever the subject, because the chip
   * flips without a navigation. A failure here costs the race day chip —
   * there is no client-built payload to fall back to any more, because a
   * browser cannot see the settings row (review, 2026-09-11). */
  let raceday: RaceDayPoster | null = null;
  if (!before) {
    const [c, r, ro, rd] = await Promise.all([
      communityPosterData(opts).catch((err: unknown) => {
        console.error("row100k/posters: community payload failed", err);
        return null;
      }),
      rNum
        ? rowerPosterData(rNum, opts).catch((err: unknown) => {
            console.error(`row100k/posters: rower payload failed (rower ${rNum})`, err);
            return null;
          })
        : Promise.resolve(null),
      posterRoster(),
      raceDayPosterData().catch((err: unknown) => {
        console.error("row100k/posters: race day payload failed", err);
        return null;
      }),
    ]);
    community = c;
    rower = r;
    roster = ro;
    raceday = rd;
    if (rNum && !rower) notFound();
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{poCss}</style>

      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The posters</h2>
            <span className="mono">ADMIN ONLY — ROWTEMBER OR ONE ROWER · PNG, PDF, INSTAGRAM</span>
          </div>
          {before ? (
            <p className="po-first">FIRST STROKE SEP 1</p>
          ) : (
            <PosterStudio community={community} rower={rower} raceday={raceday} roster={roster} />
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
