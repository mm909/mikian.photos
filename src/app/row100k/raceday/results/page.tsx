import type { Metadata } from "next";

import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { waveTime } from "../../raceday";
import { resolvedRace } from "../../racedaySettings";
import { resultBoard } from "../../raceResults";
import { CastFrame } from "../../raceresults/CastFrame";
import { RaceResults } from "../../raceresults/RaceResults";
import { rrCss } from "../../raceresults/rrCss";
import { Refresh } from "./Refresh";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Race day results — Rowtember 2026",
  description: "The 5,000 m results, wave by wave, as the night runs. The Strip Barbell, The Engine Room.",
};

/* THE REAL RESULTS BOARD (owner, 2026-09-16: "Review how racers submit
 * times during race day"). The sample page (dev/raceday-results) drew the
 * board off invented rows; this draws the same components off the
 * database — resultBoard() in raceResults.ts, the exact ResultBoard shape
 * raceresults/types.ts reads — and adds the one thing the sample could not
 * have: a poll, so a television never freezes (Refresh.tsx).
 *
 * PUBLIC, and never a 404. Before race day the board is an empty grid of
 * waves still to come, which is the honest picture, and the note over the
 * dateline says the sheet fills on the night. resultBoard fails open, so
 * a database hiccup on race night draws an empty field, never an error.
 *
 *   ?cast=1       the wall — the 1280 by 720 frame, no bar, no footer,
 *                 forced signed out, scaled to fill the television.
 *   ?cast=fixed   the same at the literal 1280 by 720 (?cast=1280 too).
 *   ?wave=N       pin the lane panel to one wave.
 *
 * TIMES ARE PUBLIC FOR EVERYBODY. The blackout hides meters, never a 5k
 * clock (racedayData.ts), so nothing on this board is masked for anyone.
 * The YOU strip reads the session — a rower sees their own row marked —
 * and the cast frame drops it on the way in. */
const DAY_MS = 24 * 3_600_000;
const RACE_PATH = "/row100k/raceday";
const RESULTS_PATH = "/row100k/raceday/results";

export default async function RaceDayResultsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const viewer = await resolveViewer();
  const q = searchParams ?? {};
  const one = (k: string): string | undefined => {
    const v = q[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const castRaw = one("cast");
  const pinned = castRaw === "fixed" || castRaw === "1280";
  const cast = pinned || castRaw === "1" || castRaw === "true";
  const waveRaw = one("wave");
  const pick = waveRaw !== undefined && /^[0-9]+$/.test(waveRaw) ? Number(waveRaw) : null;

  /* The race AS IT STANDS — a first wave moved in the console moves every
   * scheduled time on the grid. */
  const race = await resolvedRace();
  const board = await resultBoard(race, { youParticipantId: viewer.myParticipantId });
  const final = board.state === "finished";
  /* A day out the grid is empty and the note says why. */
  const early = board.nowMs < race.opensAt - DAY_MS;

  const fonts = `${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`;

  if (cast) {
    return (
      /* No chrome-ink: the wall has no bar, no strip, no footer to invert.
       * The white focus ring comes off .rr-fit in rrCss.ts. .rr-wall keeps
       * the ink look (theme.ts) off this root by class, not :has(), so a
       * television with no :has() never gets a white frame with white type
       * (review, 2026-09-16). */
      <div className={`row100k rr-wall ${fonts}`}>
        <style>{css}</style>
        <style>{rrCss}</style>
        <Refresh active={!final} />
        <CastFrame
          board={board}
          pick={pick}
          pinned={pinned}
          note={<a href={RESULTS_PATH}>Back to the page</a>}
        />
      </div>
    );
  }

  /* THE NOTE SLOT. Before race day it says the one thing a reader needs;
   * on the night and after, nothing — the board speaks for itself. */
  const note = early ? (
    <p className="rr-dev">
      <b>The sheet fills on the night</b> — first wave {waveTime(race, 1)}, {race.when}.{" "}
      <a href={RACE_PATH}>Race day →</a>
    </p>
  ) : null;

  return (
    /* chrome-ink: the bar and the footer go ink with the board, exactly as
     * the race day sign up wears it. */
    <div className={`row100k chrome-ink ${fonts}`}>
      <style>{css}</style>
      <style>{rrCss}</style>
      <RowBar active="raceday" {...barProps(viewer)} />
      <Refresh active={!final} />
      <RaceResults board={board} note={note} pick={pick} />
      <RowFooter />
    </div>
  );
}
