import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
 * DEV ONLY — a 404 in production, the same gate the poster studio wears. No
 * session, no database, no writes: the board is drawn from
 * raceresults/sample.ts, which is forty invented racers in the ResultBoard
 * shape the real page will produce off RowRaceSignup later.
 *
 *   ?at=midrace   7:38 PM. Waves 1 and 2 rowed, wave 3 on the ergs with one
 *                 empty erg where a man did not start, waves 4 and 5 to
 *                 come, sixteen rows still empty. The default.
 *   ?at=finished  the sheet: two podiums, the fourth-place line under each,
 *                 what the table buries, and all forty in one list.
 *   ?cast=1       the wall. A 1280 by 720 frame with no site bar and no
 *                 footer, forced signed out. Works with either state.
 *   ?you=0        drop the signed-in rower, to see what a stranger sees. */
export default function DevRaceDayResultsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
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
      waves of {board.ergs}, times made up and splits derived. Nothing was read from or written to
      the database.
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
