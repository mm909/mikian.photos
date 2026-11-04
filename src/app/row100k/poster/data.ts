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
import { digitCount, forcedBlackout, maskStandings, type StandingRow } from "@/lib/blackoutRules";
import { activeBlackout, listBlackouts, type BlackoutState } from "@/lib/blackout";
import type { BlackoutPolicy } from "@/lib/blackoutRules";
import { CHALLENGE, fmtDay, nowMs, pacificDay, type Boards } from "@/lib/row100k";
import { inPeriod, monthOf, type Period } from "@/lib/rowPeriod";
import type { Viewer } from "@/lib/row100kViewer";
import { boardView } from "../boardData";
import { firstToGoal } from "../firstToGoal";
import { assembleCommunity, assembleRower, forceBlackoutState } from "./assemble";
import type { CommunityPoster, PosterRosterRower, RowerPoster } from "./types";
import type { DailyShare, StickerRow } from "../share/cards";

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

/* THE DAILY STICKERS (owner, 2026-11-04 — share/cards.ts DailyShare): the
 * two boards, ten each, and who logged meters today and yesterday, for the
 * video he films off the erg. Admin only, the poster page decides that.
 *
 * Off the PUBLIC board, the way every poster is: a row the board hides
 * (the elite under a window, and a run-up row, whose low digits are gone)
 * prints blocks here too, and its meters for the day with it — a day's
 * meters next to yesterday's total is the total by subtraction. The masked
 * rows of a day list go after the rest, by name, so their order says
 * nothing about their meters either. Null when the board could not be read:
 * a sticker leaves the site, so this fails closed like the board. */
export async function dailyStickerData(opts?: PosterDataOpts | Viewer): Promise<DailyShare | null> {
  const force = forceOf(opts);
  const atMs = nowMs();
  const today = pacificDay(atMs);
  const yesterday = pacificDay(atMs - 86_400_000);
  const [{ boards, blackout, policy }, entries] = await Promise.all([
    publicBoard(force, "daily", monthOf(atMs)),
    db.rowEntry
      .findMany({
        where: { challenge: CHALLENGE, day: { in: [today, yesterday] } },
        select: { participantId: true, day: true, meters: true },
      })
      .catch((err: unknown) => {
        console.error("row100k/poster: failed to load the day's rows for the daily stickers", err);
        return null;
      }),
  ]);
  if (!boards) return null;

  const onBoard = boards.total.filter((r) => r.meters > 0 || r.masked);
  const hidden = new Set(onBoard.filter((r) => r.masked || r.hideLow || r.unranked).map((r) => r.participantId));

  // The boards: the standings order maskStandings gives the public page
  // (it is idempotent over an already-masked board), ten per division.
  type Row = StandingRow & { participantId: string; hideLow?: number };
  const rows: Row[] = onBoard.map((r) => ({
    participantId: r.participantId,
    name: r.name,
    rowerNumber: r.rowerNumber,
    meters: r.meters,
    division: r.division,
    ...(r.masked ? { masked: true } : {}),
    ...(r.digits != null ? { digits: r.digits } : {}),
    ...(r.unranked ? { unranked: true } : {}),
    ...(r.paceTag ? { paceTag: r.paceTag } : {}),
    ...(r.hideLow ? { hideLow: r.hideLow } : {}),
  }));
  const safe = maskStandings(rows, { active: blackout.active, admin: false, policy }) as Row[];
  const toSticker = (r: Row): StickerRow => {
    const masked = !!r.masked || !!r.hideLow;
    return {
      name: r.name,
      rowerNumber: r.rowerNumber,
      meters: masked ? 0 : r.meters,
      ...(masked ? { masked: true, digits: r.digits ?? digitCount(r.meters) } : {}),
      ...(r.unranked ? { unranked: true } : {}),
    };
  };
  const asOf = fmtDay(today);
  const board = (key: "M" | "F", label: string) => ({
    key,
    label,
    asOf,
    rows: safe.filter((r) => r.division === key).slice(0, 10).map(toSticker),
  });

  // The days: meters summed per rower, names off the board.
  const byId = new Map(boards.total.map((r) => [r.participantId, r]));
  const dayOf = (key: "today" | "yesterday", dayKey: string) => {
    const sums = new Map<string, number>();
    for (const e of entries ?? []) {
      if (e.day !== dayKey || !byId.has(e.participantId)) continue;
      sums.set(e.participantId, (sums.get(e.participantId) ?? 0) + e.meters);
    }
    const list = [...sums.entries()].filter(([, m]) => m > 0);
    const open: StickerRow[] = [];
    const masked: StickerRow[] = [];
    for (const [id, m] of list) {
      const r = byId.get(id)!;
      if (hidden.has(id)) masked.push({ name: r.name, rowerNumber: r.rowerNumber, meters: 0, masked: true, digits: digitCount(m) });
      else open.push({ name: r.name, rowerNumber: r.rowerNumber, meters: m });
    }
    open.sort((a, b) => b.meters - a.meters || a.name.localeCompare(b.name));
    masked.sort((a, b) => a.name.localeCompare(b.name));
    return {
      key,
      asOf: fmtDay(dayKey),
      meters: list.reduce((s, [, m]) => s + m, 0),
      rows: [...open, ...masked],
    };
  };

  return {
    boards: [board("M", "Men"), board("F", "Women")],
    days: entries ? [dayOf("today", today), dayOf("yesterday", yesterday)] : [],
  };
}
