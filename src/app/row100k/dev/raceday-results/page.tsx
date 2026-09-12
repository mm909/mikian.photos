import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { CastFrame } from "../../raceresults/CastFrame";
import { RaceResults } from "../../raceresults/RaceResults";
import { rrCss } from "../../raceresults/rrCss";
import { sampleBoard, type SampleState } from "../../raceresults/sample";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Race day results (dev) — 100K September",
  robots: { index: false, follow: false },
};

/* THE SAMPLE RACE DAY BOARD (owner, 2026-09-11: push the sample race day
 * board with sample data so I can take a look at it).
 *
 * ADMIN ONLY in production, open to anyone in local dev — the gate the
 * other dev pages wear (dev/plan, dev/shirts, dev/stats). It used to be a
 * bare NODE_ENV 404 with no escape, so the one man the menu item exists for
 * was the one man it shut out; owner, 2026-09-11: "Race day results 404s.
 * Fix and deploy." A stranger still gets nothing, which is the point — the
 * forty racers are invented and must never be mistaken for a result.
 *
 * Deliberately NOT raceOpenFor. That switch is one lever every real race
 * surface reads, and the day it opens race day to the public a sample board
 * — castable to a television — would open with it.
 *
 * The BOARD reads nothing: it is drawn from raceresults/sample.ts, forty
 * invented racers in the ResultBoard shape the real page will produce off
 * RowRaceSignup later. Only the gate reads the session.
 *
 *   ?at=midrace   7:38 PM. Waves 1 and 2 rowed, wave 3 on the ergs with one
 *                 empty erg where a man did not start, waves 4 and 5 to
 *                 come, sixteen rows still empty. The default.
 *   ?at=finished  the sheet: two podiums, the fourth-place line under each,
 *                 what the table buries, and all forty in one list.
 *   ?cast=1       the wall. A 1280 by 720 frame with no site bar and no
 *                 footer, forced signed out. Works with either state.
 *   ?you=0        drop the signed-in rower, to see what a stranger sees. */
export default async function DevRaceDayResultsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();
  const q = searchParams ?? {};
  const one = (k: string): string | undefined => {
    const v = q[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const at: SampleState = one("at") === "finished" ? "finished" : "midrace";
  const cast = one("cast") === "1" || one("cast") === "true";
  const you = one("you") !== "0";
  const board = sampleBoard(at, { you });

  const fonts = `${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`;

  /* THE WALL has no chrome by design — no bar, no footer, nothing that
   * scrolls — so the cast view is the whole page. It says SAMPLE DATA in
   * its own corner rather than wearing the dev strip, which would not be
   * on the television on the night. */
  if (cast) {
    return (
      <div className={`row100k rr-mono ${fonts}`}>
        <style>{css}</style>
        <style>{rrCss}</style>
        {/* The note rides in the phone-only caption under the frame, so a
         * phone that followed the cast link from the dev strip can say what
         * it is looking at and get back out. A television never renders it. */}
        <CastFrame
          board={board}
          note={<a href={`/row100k/dev/raceday-results?at=${at}`}>Back to the page</a>}
        />
      </div>
    );
  }

  const other: SampleState = at === "midrace" ? "finished" : "midrace";
  const note = (
    <p className="rr-dev">
      <b>Sample data</b> — nothing on this page is real. Forty invented racers, {board.waves.length}{" "}
      waves of {board.ergs}, times made up and splits derived. Not one row of this board came out of
      the database, and nothing here writes to it.
      <br />
      State{" "}
      <a href={`/row100k/dev/raceday-results?at=${at}`}>
        {at === "midrace" ? "mid-race, 7:38 PM" : "finished"}
      </a>{" "}
      · see{" "}
      <a href={`/row100k/dev/raceday-results?at=${other}`}>
        {other === "midrace" ? "mid-race" : "finished"}
      </a>{" "}
      · the wall{" "}
      <a href={`/row100k/dev/raceday-results?at=${at}&cast=1`}>cast view, 1280 by 720</a> ·{" "}
      <a href={`/row100k/dev/raceday-results?at=${at}&you=${you ? "0" : "1"}`}>
        {you ? "signed out" : "signed in"}
      </a>
    </p>
  );

  return (
    <div className={`row100k rr-mono ${fonts}`}>
      <style>{css}</style>
      <style>{rrCss}</style>

      {/* Hardcoded signed out even though the gate has a viewer in scope —
        * do NOT spread barProps(viewer) in here the way dev/plan does. The
        * owner's rower chip and LOG A ROW two inches from a chip reading
        * PREVIEW would make the page look half real. The viewer is read to
        * decide whether this page may be drawn, never what it draws. */}
      <RowBar signedIn={false} rowerNumber={null} admin={false}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em" }}>
          PREVIEW — NOT REAL DATA
        </span>
      </RowBar>

      <RaceResults board={board} note={note} />

      <RowFooter />
    </div>
  );
}
