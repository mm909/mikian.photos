import { digitCount, partialShape } from "@/lib/blackoutRules";
import { GOAL_METERS, MONTH, MONTH_NAME, MONTH_WORD, TIERS, daysElapsed, nowMs, type TotalRow } from "@/lib/row100k";
import { previewViewOpts, type Viewer } from "@/lib/row100kViewer";
import { monthName, type Month } from "@/lib/rowPeriod";
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

/* The first month with an opt-in (owner, 2026-10-01, the board redesign).
 * September had none: everybody who rowed it was on its board. */
const OPT_IN_FROM = "2026-10";

/* `month`: this month unless asked otherwise (owner, 2026-11-23, of the
 * app's 100K tab: "I want to see September's and October's results as
 * well"). A past month is read as boardView reads one, as of its last day,
 * with the same mask on it as this month's. The site's /board asks for
 * this month only. */
export async function buildBoardPage(viewer: Viewer, month: Month = MONTH): Promise<BoardPageData> {
  const me = viewer.me;
  const live = month.key === MONTH.key;

  let total = EMPTY_BOARDS.total;
  let unreadable = false;
  try {
    const view = await boardView({ ...previewViewOpts(viewer.preview, viewer.myParticipantId, viewer.isAdmin), period: month });
    total = view.boards.total;
  } catch (err) {
    console.error("row100k/board: failed to load the board", err);
    unreadable = true;
  }

  /* Before the opt-in there was none to read: everyone with meters. */
  const everyone = month.key < OPT_IN_FROM;
  let optIns = new Set<string>();
  if (everyone) optIns = new Set(total.filter((r) => r.meters > 0).map((r) => r.participantId));
  else
    try {
      optIns = await monthOptIns(month.key);
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
    /* A past month's rungs wear that month's name, not this one's. */
    { key: "athlete", title: live ? t50.title : t50.title.replace(MONTH_NAME, monthName(month)), floor: t50.meters },
    { key: "participant", title: live ? t10.title : t10.title.replace(MONTH_NAME, monthName(month)), floor: t10.meters },
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
    month: live
      ? { key: MONTH.key, label: MONTH.label, name: MONTH_NAME, word: MONTH_WORD, days: MONTH.days, day: daysElapsed(nowMs()) }
      : { key: month.key, label: month.label, name: monthName(month), word: month.label.split(" ")[0], days: month.days, day: month.days },
    rows,
    tiers,
    me: mine,
    unreadable,
  };
}
