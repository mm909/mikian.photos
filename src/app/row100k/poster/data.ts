/* poster/data.ts — the DATA stream's server entry: what the poster studio
 * draws, read off the live tables and handed to the client as plain JSON
 * (types.ts CommunityPoster / RowerPoster). SERVER ONLY — this file imports
 * the db; never import it from a client component.
 *
 * Assembled the way post/page.tsx builds its PostData and r/[num]/page.tsx
 * its ProfileView, with one difference that is the whole point: the board
 * here is ALWAYS the public one (boardView with no viewer and no admin —
 * the partners-page idiom), because a poster leaves the site. The rower
 * themself and an admin get the same blocks a stranger gets. The
 * projection into shapes lives in ./assemble.ts (pure), which fixture.ts
 * shares, so the dev page's fake payloads are made by the same code.
 *
 * Reads are the site's cached ones where the site caches (boardDataRaw and
 * fieldEntries under the row100k-boards tag, activeBlackout under its own)
 * and fail open per field with a console.error — except the board while a
 * window is open, which fails CLOSED (assemble.ts). */

import { db } from "@/lib/db";
import { forcedBlackout } from "@/lib/blackoutRules";
import { activeBlackout, listBlackouts, type BlackoutState } from "@/lib/blackout";
import type { BlackoutPolicy } from "@/lib/blackoutRules";
import { CHALLENGE, nowMs, type Boards } from "@/lib/row100k";
import { inPeriod, monthOf, type Period } from "@/lib/rowPeriod";
import type { Viewer } from "@/lib/row100kViewer";
import { boardView } from "../boardData";
import { firstToGoal } from "../firstToGoal";
import { assembleCommunity, assembleRower, forceBlackoutState } from "./assemble";
import type { CommunityPoster, PosterRosterRower, RowerPoster } from "./types";

export type PosterDataOpts = {
  /* The admin's test blackout: treat the window as open for this request.
   * The page passes `viewer.preview !== null`; the leak test passes true. */
  forceBlackout?: boolean;
  /* THE TIME FRAME (owner, 2026-10-01: "a specific month or all time"):
   * the board, the rows and the grid are all this period's (rowPeriod.ts
   * parsePeriod off ?m=). This month when absent. */
  period?: Period;
};

/* The page may hand the resolved Viewer straight through instead of the
 * options (the brief's `rowerPosterData(num, viewer)` form): the only
 * thing read off it is whether the preview cookie is set. */
function forceOf(opts: PosterDataOpts | Viewer | undefined): boolean {
  if (!opts) return false;
  if ("preview" in opts) return forcedBlackout(opts.preview);
  return opts.forceBlackout === true;
}

function periodOf(opts: PosterDataOpts | Viewer | undefined, atMs: number): Period {
  if (opts && !("preview" in opts) && opts.period) return opts.period;
  return monthOf(atMs);
}

/* The PUBLIC board and the window as boardView returns them; null board
 * when the read threw (the assembler then fails closed under a window). */
async function publicBoard(
  force: boolean,
  what: string,
  period: Period,
): Promise<{ boards: Boards | null; blackout: BlackoutState; policy?: BlackoutPolicy }> {
  // A poster leaves the site, so the window is decided here UNCACHED and
  // fail-CLOSED (review, 2026-09-10): activeBlackout() answers "no window"
  // on a db error and for a quiet minute after, which is the right call
  // for a page and the wrong one for a print. If the windows cannot be
  // read, the sheet masks.
  try {
    const at = nowMs();
    const open = (await listBlackouts()).some(
      (w) => Date.parse(w.startsAt) <= at && at < Date.parse(w.endsAt),
    );
    if (open) force = true;
  } catch (err) {
    console.error(`row100k/poster: could not read the blackout windows (${what}) — masking`, err);
    force = true;
  }
  try {
    const v = await boardView({
      viewerParticipantId: null,
      admin: false,
      forceBlackout: force,
      period,
    });
    return { boards: v.boards, blackout: v.blackout, policy: v.policy };
  } catch (err) {
    console.error(`row100k/poster: failed to load the public board (${what})`, err);
    return {
      boards: null,
      blackout: forceBlackoutState(await activeBlackout(), force),
    };
  }
}

/* The community summary — ROWTEMBER itself. */
export async function communityPosterData(opts?: PosterDataOpts | Viewer): Promise<CommunityPoster> {
  const force = forceOf(opts);
  const atMs = nowMs();
  const period = periodOf(opts, atMs);
  const [{ boards, blackout, policy }, rows, claim] = await Promise.all([
    publicBoard(force, "community", period),
    // Who / day / logged-at for the hour bars and the big-day row count,
    // and the meters and seconds the split density is built from — one
    // read, THE PERIOD'S rows only, so a September sheet drawn in October
    // carries September's field (fieldData.ts fieldEntries is every month
    // and carries no day). Orphan rows are dropped in the assembler
    // against the board's ids.
    db.rowEntry
      .findMany({
        where: { challenge: CHALLENGE },
        select: { participantId: true, day: true, createdAt: true, meters: true, seconds: true },
      })
      .then((list) =>
        list
          .filter((e) => inPeriod(e.day, period))
          .map((e) => ({
            participantId: e.participantId,
            day: e.day,
            createdAtMs: e.createdAt.getTime(),
            meters: e.meters,
            seconds: e.seconds,
          })),
      )
      .catch((err: unknown) => {
        console.error("row100k/poster: failed to load entries for the hours", err);
        return null;
      }),
    // The claim's running total (GoalClaim.total) is the rower's real
    // number and stops here: only the name, number and day go on.
    firstToGoal()
      .then((c) => (c ? { name: c.name, rowerNumber: c.rowerNumber, day: c.day } : null))
      .catch((err: unknown) => {
        console.error("row100k/poster: failed to resolve the 100k claim", err);
        return null;
      }),
  ]);
  const field = rows ? rows.map((r) => ({ participantId: r.participantId, meters: r.meters, seconds: r.seconds })) : null;
  return assembleCommunity({ boards, blackout, policy, rows, field, claim, atMs, period });
}

/* One rower's poster, or null when there is no such rower (the page then
 * 404s, the way the profile does). A db failure reading the rower is
 * reported and also null — there is no poster without the rows. */
export async function rowerPosterData(
  rowerNumber: number,
  opts?: PosterDataOpts | Viewer,
): Promise<RowerPoster | null> {
  if (!Number.isInteger(rowerNumber) || rowerNumber < 1) return null;
  const force = forceOf(opts);
  const atMs = nowMs();
  const period = periodOf(opts, atMs);
  try {
    const participant = await db.rowParticipant.findUnique({
      where: { challenge_rowerNumber: { challenge: CHALLENGE, rowerNumber } },
      select: {
        id: true,
        rowerNumber: true,
        displayName: true,
        instagram: true,
        division: true,
      },
    });
    if (!participant) return null;
    const [entries, { boards, blackout }] = await Promise.all([
      db.rowEntry
        .findMany({
          where: { participantId: participant.id },
          select: { day: true, meters: true, seconds: true, title: true },
          orderBy: [{ day: "asc" }, { createdAt: "asc" }],
        })
        // The period's rows only: the log, the bests and the calendar are
        // all that month's, or every month's for all time.
        .then((list) => list.filter((e) => inPeriod(e.day, period))),
      publicBoard(force, `rower ${rowerNumber}`, period),
    ]);
    return assembleRower({ participant, entries, pub: boards, blackout, atMs, period });
  } catch (err) {
    console.error(`row100k/poster: failed to load rower ${rowerNumber}`, err);
    return null;
  }
}

/* The roster for the studio's subject picker — the r/[num]/page.tsx
 * getRoster guard, exactly this wide: number, name and board are always
 * public; one meters or seconds field here would publish a figure for the
 * whole roster, the hidden elite included. Not read off the board (that
 * object carries every number). Empty on failure — the picker then says
 * the roster could not be read. */
export async function posterRoster(): Promise<PosterRosterRower[]> {
  try {
    const rows = await db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: { rowerNumber: true, displayName: true, division: true },
      orderBy: { rowerNumber: "asc" },
    });
    return rows.map((r) => ({
      rowerNumber: r.rowerNumber,
      displayName: r.displayName,
      division: r.division === "M" || r.division === "F" ? r.division : "X",
    }));
  } catch (err) {
    console.error("row100k/poster: failed to load the roster", err);
    return [];
  }
}
