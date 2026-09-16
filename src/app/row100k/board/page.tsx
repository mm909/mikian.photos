import type { Metadata } from "next";
import Link from "next/link";
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
import { maskStandings, type BlackoutPolicy } from "@/lib/blackoutRules";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { headCss } from "../headCss";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Boards } from "../Boards";
import { StatsShare } from "../StatsShare";
import { PageHead } from "../PageHead";
import { BOARD_CARD_IDS } from "../share/cards";
import { EMPTY_BOARDS, boardView } from "../boardData";
import { readBlackoutPreview } from "@/lib/row100kViewer";

export const metadata: Metadata = {
  title: "The board — Rowtember 2026",
  description: "Every rower's September, ranked by meters.",
};

// Session-aware + live standings — never render statically.
export const dynamic = "force-dynamic";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/* THE BOARD, on its own page (owner call, 2026-09-05: the front page is the
 * front page of the newspaper; the standings moved to a tab). Open to
 * everyone since 2026-09-16 (owner: no need to be logged in or opted in to
 * see the board or the stats) — signed out you get the same board as a
 * rower who has not logged, and one line at the bottom to opt in. Same
 * boardView masking as before: an open blackout hides the elite from
 * everyone but admins and the rower themself, and the sticker that leaves
 * the site is masked for all. The head is PageHead (owner, 2026-09-16: no
 * bold THE BOARD; the community total in the front page odometer; variant
 * A picked for every tab the same day, so no ?head query any more). */
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

  // The admin's test blackout (row100kViewer): the window is open for this
  // request, the admin is no admin for the mask, and under OUTSIDE IT not
  // themself either — so THE BOARD is the one everybody else gets.
  // Signed out: no viewer, no admin — the public board, elite masked while
  // a window is open.
  const preview = readBlackoutPreview(isAdmin);
  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  let policy: BlackoutPolicy | undefined;
  try {
    const view = await boardView(
      preview
        ? {
            viewerParticipantId: preview === "elite" ? (me?.id ?? null) : null,
            admin: false,
            forceBlackout: true,
          }
        : { viewerParticipantId: me?.id ?? null, admin: isAdmin },
    );
    boards = view.boards;
    blackout = view.blackout;
    policy = view.policy;
  } catch (err) {
    console.error("row100k/board: failed to load board data", err);
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
        // The board the row is on: the elite are the top ten of each.
        division: r.division,
        masked: r.masked,
        digits: r.digits,
        // The places half of the rule travels with the row: a hidden rower
        // has no place on the sticker either. maskStandings sets this on
        // the elite itself, so this only carries an already-masked
        // board's intent forward — the map is not the reason it works.
        unranked: r.unranked,
      })),
      // The same policy the board above was masked with (boardView), so
      // the sticker hides exactly the rows the page did.
      { active: blackout.active, admin: false, policy },
    ),
    asOf: fmtDay(new Date(nowMs - 7 * 3600_000).toISOString().slice(0, 10)),
  };

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{headCss}</style>

      <RowBar active="board" signedIn={!!actor} rowerNumber={me?.rowerNumber ?? null} admin={isAdmin} />

      <section id="board" className="ph-sec">
        <div className="wrap front">
          {/* The head: the dateline carries the month's state (FINAL, LATE
           * LOGS THROUGH OCT 3), so the old eyebrow has nothing left to
           * say. The number is the community total — a sum, nobody's own
           * figure, so the blackout never touches it. */}
          <PageHead
            name="The board"
            dateline={dateline}
            meters={boards.community.meters}
            unit={
              <>
                Meters · <b>everyone together</b>
              </>
            }
            wide
          />
          {/* Only the slices the board reads. Boards is a client
           * component, so whatever is handed in is serialized into the
           * page source — and boardView masks only `total`; the record
           * boards still hold every elite rower's real seconds and
           * meters, which the board never prints (review, 2026-09-05).
           * head off: the number is printed above, once. */}
          <Boards
            boards={{ total: boards.total, community: boards.community }}
            started={started}
            blackout={blackout}
            head={false}
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

      {/* Not on the board yet — signed out or not joined: one line to the
       * front page's join section, where OPT IN (and the form) live. The
       * front page already carries the full call. */}
      {!me && phase !== "closed" && (
        <section className="fs front-cta">
          <div className="wrap front">
            <p className="front-more mono">
              <Link href="/row100k#join">Not on the board yet? Opt in →</Link>
            </p>
          </div>
        </section>
      )}

      <RowFooter />
    </div>
  );
}
