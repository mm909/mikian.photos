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
import { activeBlackout, listBlackouts, type BlackoutState } from "@/lib/blackout";
import { CHALLENGE, nowMs, type Boards } from "@/lib/row100k";
import type { Viewer } from "@/lib/row100kViewer";
import { boardView } from "../boardData";
import { fieldEntries } from "../fieldData";
import { firstToGoal } from "../firstToGoal";
import { assembleCommunity, assembleRower, forceBlackoutState } from "./assemble";
import type { CommunityPoster, PosterRosterRower, RowerPoster } from "./types";

export type PosterDataOpts = {
  /* The admin's test blackout: treat the window as open for this request.
   * The page passes `viewer.preview !== null`; the leak test passes true. */
  forceBlackout?: boolean;
};

/* The page may hand the resolved Viewer straight through instead of the
 * options (the brief's `rowerPosterData(num, viewer)` form): the only
 * thing read off it is whether the preview cookie is set. */
function forceOf(opts: PosterDataOpts | Viewer | undefined): boolean {
  if (!opts) return false;
  if ("preview" in opts) return opts.preview !== null;
  return opts.forceBlackout === true;
}

/* The PUBLIC board and the window as boardView returns them; null board
 * when the read threw (the assembler then fails closed under a window). */
async function publicBoard(
  force: boolean,
  what: string,
): Promise<{ boards: Boards | null; blackout: BlackoutState }> {
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
    });
    return { boards: v.boards, blackout: v.blackout };
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
  const [{ boards, blackout }, rows, field, claim] = await Promise.all([
    publicBoard(force, "community"),
    // Who / day / logged-at for the hour bars and the big-day row count.
    // Orphan rows are dropped in the assembler against the board's ids.
    db.rowEntry
      .findMany({
        where: { challenge: CHALLENGE },
        select: { participantId: true, day: true, createdAt: true },
      })
      .then((list) =>
        list.map((e) => ({
          participantId: e.participantId,
          day: e.day,
          createdAtMs: e.createdAt.getTime(),
        })),
      )
      .catch((err: unknown) => {
        console.error("row100k/poster: failed to load entries for the hours", err);
        return null;
      }),
    fieldEntries().catch((err: unknown) => {
      console.error("row100k/poster: failed to load the field entries", err);
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
  return assembleCommunity({ boards, blackout, rows, field, claim, atMs });
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
      db.rowEntry.findMany({
        where: { participantId: participant.id },
        select: { day: true, meters: true, seconds: true, title: true },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      }),
      publicBoard(force, `rower ${rowerNumber}`),
    ]);
    return assembleRower({ participant, entries, pub: boards, blackout, atMs });
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
