import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import {
  CHALLENGE,
  END_MS,
  LOG_CLOSE_MS,
  START_MS,
  daysElapsed,
  fmtDay,
  isRow100kAdmin,
  nowMs as clockNow,
} from "@/lib/row100k";
import { maskStandings } from "@/lib/blackoutRules";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Boards } from "../Boards";
import { StatsShare } from "../StatsShare";
import { JoinPanel } from "../JoinPanel";
import { BOARD_CARD_IDS } from "../share/cards";
import { EMPTY_BOARDS, boardView } from "../boardData";

export const metadata: Metadata = {
  title: "The board — Rowtember 2026",
  description: "Every rower's September, ranked by meters.",
};

// Session-gated + live standings — never render statically.
export const dynamic = "force-dynamic";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/* THE BOARD, on its own page (owner call, 2026-09-05: the front page is the
 * front page of the newspaper; the standings moved to a tab). It is for
 * rowers: signed out you get the nameplate, one line and OPT IN — signed in,
 * joined or not, you get the board. Same boardView masking as before: an
 * open blackout hides the elite fifteen from everyone but admins and the
 * rower themself, and the sticker that leaves the site is masked for all. */
export default async function BoardPage() {
  const actor = await getEffectiveActor();
  const isAdmin = actor ? isRow100kAdmin(actor.email, actor.roles) : false;

  let me: { id: string; rowerNumber: number } | null = null;
  try {
    if (actor) {
      me = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { id: true, rowerNumber: true },
      });
    }
  } catch (err) {
    console.error("row100k/board: failed to load viewer data", err);
  }

  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  if (actor) {
    try {
      const view = await boardView({ viewerParticipantId: me?.id, admin: isAdmin });
      boards = view.boards;
      blackout = view.blackout;
    } catch (err) {
      console.error("row100k/board: failed to load board data", err);
    }
  }

  const nowMs = clockNow();
  const phase: "before" | "open" | "closed" =
    nowMs < START_MS ? "before" : nowMs >= LOG_CLOSE_MS ? "closed" : "open";
  const started = nowMs >= START_MS;
  const west = new Date(nowMs - 7 * 3_600_000);
  const stamp = `${MONTHS[west.getUTCMonth()]} ${west.getUTCDate()}`;
  const dateline =
    phase === "before"
      ? `${stamp} · FIRST STROKE SEP 1`
      : phase === "closed"
        ? `${stamp} · FINAL`
        : nowMs >= END_MS
          ? `${stamp} · LATE LOGS THROUGH OCT 3`
          : `${stamp} · DAY ${daysElapsed(nowMs)} OF 30`;

  // The board stickers (ten places to a card) share the community card
  // plumbing, which wants per-day totals too; the curve carries cumulative
  // meters, so unroll it. `asOf` is today in US-west wall clock, the date
  // the sticker says the standings were read.
  const communityByDay: Record<string, number> = {};
  let prevCum = 0;
  for (const d of boards.daily) {
    communityByDay[d.day] = d.cum - prevCum;
    prevCum = d.cum;
  }
  const boardShare = {
    meters: boards.community.meters,
    rowers: boards.community.people,
    sessions: boards.community.sessions,
    byDay: communityByDay,
    daily: boards.daily,
    // The sticker leaves the site, so it is masked for EVERYONE while a
    // window is open — an admin sees the real board on screen but must not
    // be able to post it, and an elite rower does not get to share their
    // own number either (owner call: the numbers are not shareable to the
    // public). Idempotent on rows boardView already masked.
    standings: maskStandings(
      boards.total.map((r) => ({
        name: r.name,
        rowerNumber: r.rowerNumber,
        meters: r.meters,
        masked: r.masked,
        digits: r.digits,
      })),
      { active: blackout.active, admin: false },
    ),
    asOf: fmtDay(new Date(nowMs - 7 * 3600_000).toISOString().slice(0, 10)),
  };

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar active="board" signedIn={!!actor} rowerNumber={me?.rowerNumber ?? null} admin={isAdmin} />

      {/* No nameplate here — the bar already says ROWTEMBER and the board
       * is the whole page; the dateline rides in the section eyebrow. */}
      {actor ? (
        <section id="board">
          <div className="wrap front">
            <div className="sec-head">
              <h2>The board</h2>
              <span className="mono">
                {nowMs >= LOG_CLOSE_MS
                  ? "FINAL"
                  : nowMs >= END_MS
                    ? "CLOSING — LATE LOGS THROUGH OCT 3"
                    : "LIVE — UPDATES AS ROWS LAND"}
              </span>
            </div>
            {/* Only the slices the board reads. Boards is a client
             * component, so whatever is handed in is serialized into the
             * page source — and boardView masks only `total`; the record
             * boards still hold every elite rower's real seconds and
             * meters, which the board never prints (review, 2026-09-05). */}
            <Boards
              boards={{ total: boards.total, community: boards.community }}
              started={started}
              blackout={blackout}
            />
            {started && boards.total.length > 0 && (
              <StatsShare
                community={boardShare}
                prefer={BOARD_CARD_IDS[0]}
                only={BOARD_CARD_IDS}
                label="SHARE THE BOARD"
              />
            )}
          </div>
        </section>
      ) : (
        <section id="join" className="fs front-cta">
          <div className="wrap front">
            <p className="front-latest mono">THE BOARD IS FOR ROWERS — OPT IN TO SEE IT</p>
            <JoinPanel mode="signedOut" />
          </div>
        </section>
      )}

      <RowFooter />
    </div>
  );
}
