import { digitCount, partialShape } from "@/lib/blackoutRules";
import { GOAL_METERS, MONTH, MONTH_NAME, MONTH_WORD, TIERS, daysElapsed, nowMs, type TotalRow } from "@/lib/row100k";
import { previewViewOpts, type Viewer } from "@/lib/row100kViewer";
import { EMPTY_BOARDS, boardView } from "../boardData";
import { monthOptIns } from "../monthOptIn";
import type { BoardMe, BoardRow, BoardTier } from "./Board100k";

/* THE 100K BOARD, COMPUTED (split out of page.tsx 2026-11-20 so the phone
 * app reads the same rows the page prints: api/row100k/app/board). The rows
 * are the viewer's board, masked as boardView masks them. SERVER ONLY. */

/* The numbers a row may print, as boardView left them: blocks for a hidden
 * total, the partial shape in the run-up, neither otherwise. */
const hiddenOf = (r: TotalRow): { blocks?: number; shape?: string } =>
  r.masked
    ? { blocks: r.digits ?? digitCount(r.meters) }
    : r.hideLow
      ? { shape: partialShape(r.meters, r.hideLow, r.digits) }
      : {};

export type BoardPageData = {
  month: { key: string; label: string; name: string; word: string; days: number; day: number };
  rows: BoardRow[];
  tiers: BoardTier[];
  me: BoardMe | null;
  unreadable: boolean;
};

export async function buildBoardPage(viewer: Viewer): Promise<BoardPageData> {
  const me = viewer.me;

  let total = EMPTY_BOARDS.total;
  let unreadable = false;
  try {
    const view = await boardView(previewViewOpts(viewer.preview, viewer.myParticipantId, viewer.isAdmin));
    total = view.boards.total;
  } catch (err) {
    console.error("row100k/board: failed to load the board", err);
    unreadable = true;
  }

  let optIns = new Set<string>();
  try {
    optIns = await monthOptIns();
  } catch (err) {
    console.error("row100k/board: failed to read the month's opt-ins (table pushed?)", err);
    unreadable = true;
  }

  /* The listed rows: opted in, in the board's own order (meters, the
   * masked elite first while a window is open). */
  const rows: BoardRow[] = total
    .filter((r) => optIns.has(r.participantId))
    .map((r) => ({
      rowerNumber: r.rowerNumber,
      name: r.name,
      meters: r.meters,
      ...hiddenOf(r),
      unranked: r.unranked === true,
      me: me !== null && r.participantId === me.id,
    }));

  /* The tiers, highest first: the club, the athletes, the participants,
   * then WARMING UP for anyone in but under the first rung. The two named
   * rungs wear the month's name (row100k.ts TIERS). */
  const t10 = TIERS.find((t) => t.key === "t10")!;
  const t50 = TIERS.find((t) => t.key === "t50")!;
  const t100 = TIERS.find((t) => t.key === "t100")!;
  const tiers: BoardTier[] = [
    { key: "club", title: t100.title, floor: GOAL_METERS },
    { key: "athlete", title: t50.title, floor: t50.meters },
    { key: "participant", title: t10.title, floor: t10.meters },
    { key: "warming", title: "Warming up", floor: 0 },
  ];

  /* The viewer's own row, whether or not it is listed: what OPT IN puts on
   * the board before the refresh brings the list. */
  const myRow = me ? total.find((r) => r.participantId === me.id) : undefined;
  const mine: BoardMe | null = me
    ? {
        rowerNumber: me.rowerNumber,
        name: me.displayName,
        meters: myRow?.meters ?? 0,
        in: optIns.has(me.id),
        unranked: myRow?.unranked === true,
        ...(myRow ? hiddenOf(myRow) : {}),
      }
    : null;

  return {
    month: { key: MONTH.key, label: MONTH.label, name: MONTH_NAME, word: MONTH_WORD, days: MONTH.days, day: daysElapsed(nowMs()) },
    rows,
    tiers,
    me: mine,
    unreadable,
  };
}
