import { maskStandings, type BlackoutPolicy } from "@/lib/blackoutRules";
import { MONTH, START_MS, fmtDay, nowMs as clockNow, pacificDay } from "@/lib/row100k";
import { maskedIds, viewOpts, type Viewer } from "@/lib/row100kViewer";
import { periodOptions, type Period } from "@/lib/rowPeriod";
import type { BoardsProp } from "../Boards";
import { boardView, EMPTY_BOARDS } from "../boardData";
import type { CommunityShare } from "../StatsShare";
import { liteRecords, type RecordsProp } from "./defs";

/* EVERYTHING THE RECORDS PAGE PRINTS FOR ONE PERIOD, as one plain object
 * (owner, 2026-09-25: "why is there a loading page between each click
 * (category, bracket, month)? There shouldn't be"). The page renders it
 * once on the server for the period in the URL; the month word then asks
 * GET /api/row100k/records?m= for another one and the client shell
 * (RecordsShell.tsx) swaps it in place. Both go through here, so a month
 * fetched in place is masked for the viewer exactly as the one the page
 * loaded with — the same boardView, the same hidden set, the same blanking
 * of every row shape that reaches the browser. The stats page's
 * statsData.ts is the model.
 *
 * All five records ride along, and the bracket (All / Men's / Women's) is
 * a filter the shell applies: picking a category or a bracket never asks
 * the server. Two shapes of the same board travel:
 *   - `board.total` is the standings as boardView masked them for THIS
 *     viewer — the elite in blocks, the run-up rounded, the viewer's own
 *     row and an admin's view exempt — with the tiers, arrows and progress
 *     bars the board draws (Boards.tsx). Only the slices Boards reads: the
 *     record boards still hold every elite rower's real seconds and meters
 *     on the server and never leave it (review, 2026-09-05).
 *   - `records` is the five flat rankings (records/defs.ts liteRecords): a
 *     hidden rower's METERS records zeroed with only a digit count, their
 *     TIMES kept (owner, 2026-09-08: fastest 5k and 10k show regardless of
 *     the blackout).
 * JSON throughout — no Date, no Map, no function — since it crosses the
 * wire twice. */

export type RecordsPayload = {
  period: { key: string; kind: "month" | "all"; label: string };
  /* True while the period is the month the clock is in. */
  thisMonth: boolean;
  /* Every month so far and all time, for the month word. */
  periods: { key: string; label: string }[];
  currentMonthKey: string;
  started: boolean;
  /* The viewer's own participant id, resolved by the caller, or null. */
  meId: string | null;
  blackout: { active: boolean; endsAt?: string };
  /* Whether this viewer has rows hidden from them — the bo-note line. */
  anyHidden: boolean;
  /* The board could not be read: the rankings are empty for that reason. */
  unavailable: boolean;
  /* The five flat rankings, masked (records/defs.ts). */
  records: RecordsProp;
  /* The standings and the community strip, masked, for Boards.tsx. */
  board: BoardsProp;
  /* Up/down arrows: this month or all time. A finished month draws none —
   * there is no last logged day it moved since. */
  movement: boolean;
  /* The stats page for this period — the line under every table (owner,
   * 2026-09-25: "at the bottom of the board, have the callout be to the
   * STATS page"). */
  statsHref: string;
  /* The board sticker's data (share/cards.ts), masked for EVERYONE while a
   * window is open, or null when there is nothing to share yet. */
  share: CommunityShare | null;
};

export async function buildRecordsPayload(viewer: Viewer, period: Period): Promise<RecordsPayload> {
  const now = clockNow();
  const thisMonth = period.kind === "month" && period.key === MONTH.key;

  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  let policy: BlackoutPolicy | undefined;
  let unavailable = false;
  try {
    const view = await boardView({ ...viewOpts(viewer), period });
    boards = view.boards;
    blackout = { active: view.blackout.active, ...(view.blackout.endsAt ? { endsAt: view.blackout.endsAt } : {}) };
    policy = view.policy;
  } catch (err) {
    console.error("row100k/records: failed to load board data", err);
    unavailable = true;
  }

  // The one masked set (row100kViewer.maskedIds) — self and admins exempt.
  const hidden = maskedIds(boards);
  const records = liteRecords(boards, hidden);
  const started = now >= START_MS;

  /* The board sticker (ten places to a card) shares the community card
   * plumbing, which wants per-day totals too; the curve carries cumulative
   * meters, so unroll it. `asOf` is the day the standings were read: today
   * in US-west wall clock, or a past month's last day. */
  const communityByDay: Record<string, number> = {};
  let prevCum = 0;
  for (const d of boards.daily) {
    communityByDay[d.day] = d.cum - prevCum;
    prevCum = d.cum;
  }
  const share: CommunityShare | null =
    started && boards.total.length > 0
      ? {
          meters: boards.community.meters,
          rowers: boards.community.people,
          sessions: boards.community.sessions,
          byDay: communityByDay,
          daily: boards.daily,
          // The sticker leaves the site, so it is masked for EVERYONE while
          // a window is open — an admin sees the real board on screen but
          // must not be able to post it, and an elite rower does not get to
          // share their own number either (owner call: the numbers are not
          // shareable to the public). Idempotent on rows boardView already
          // masked, and applied with the same policy the board was.
          standings: maskStandings(
            boards.total.map((r) => ({
              name: r.name,
              rowerNumber: r.rowerNumber,
              meters: r.meters,
              division: r.division,
              masked: r.masked,
              digits: r.digits,
              unranked: r.unranked,
            })),
            { active: blackout.active, admin: false, policy },
          ),
          asOf: fmtDay(period.kind === "month" && !thisMonth ? period.lastDay : pacificDay(now)),
        }
      : null;

  return {
    period: { key: period.key, kind: period.kind, label: period.label },
    thisMonth,
    periods: periodOptions(now),
    currentMonthKey: MONTH.key,
    started,
    meId: viewer.myParticipantId,
    blackout,
    anyHidden: hidden.size > 0,
    unavailable,
    records,
    board: { total: boards.total, community: boards.community },
    movement: thisMonth || period.kind === "all",
    statsHref: thisMonth ? "/row100k/stats" : `/row100k/stats?m=${encodeURIComponent(period.key)}`,
    share,
  };
}
