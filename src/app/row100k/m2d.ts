import { db } from "@/lib/db";
import { CHALLENGE, MONTH, nowMs, pacificDay } from "@/lib/row100k";
import { previewViewOpts, type Viewer } from "@/lib/row100kViewer";
import type { Month } from "@/lib/rowPeriod";
import { boardView } from "./boardData";

/* M2D, METERS TO DOLLARS (owner, 2026-11-25, of the Concept2 Holiday
 * Challenge, Nov 26 - Dec 24: "we really need a place where we can show
 * how much money collectively Rowtember users have raised ... it doesn't
 * start until that date ... M2D is what we'll call it"). The phone app's
 * M2D tab, the profile's M2D column, the stats tab's dollars and the
 * dollar stickers all read this. SERVER ONLY.
 *
 * CONCEPT2'S RULE (log.concept2.com/challenges/holiday, read 2026-11-25):
 * for every person who rows 100,000 m in the window, Concept2 gives $0.02 a
 * kilometre, and $0.04 for each kilometre past 100K. No cap is stated. The
 * meters must be in the Concept2 Logbook and a charity picked there; we
 * cannot see either, so "in" here is the rower's own word that they are
 * registered (RowMonthOptIn under the key M2D_KEY: no new table).
 *
 * WORTH is the formula run on any count of meters, as if they reach 100K:
 * 2 cents a kilometre to 100K, 4 cents past it. That is what the board
 * prints and what the app's big figure adds up. LOCKED is the part Concept2
 * has actually promised: worth only for a rower who has passed 100K. */

export const M2D_KEY = "m2d-2026";
export const M2D_FIRST = "2026-11-26";
export const M2D_LAST = "2026-12-24";
export const M2D_DAYS = 29;
export const M2D_LINK = "https://log.concept2.com/challenges/holiday";
export const M2D_SIGNUP = "https://log.concept2.com/signup";
/* The first goal on the stats tab (owner: "a goal can be, can we raise
 * $100"). */
export const M2D_GOAL = 100;

/* Dollars, to the cent. */
export function worth(meters: number): number {
  const km = Math.max(0, meters) / 1000;
  const d = km <= 100 ? 0.02 * km : 2 + 0.04 * (km - 100);
  return Math.round(d * 100) / 100;
}
export const locked = (meters: number): number => (meters >= 100_000 ? worth(meters) : 0);
export const inWindow = (day: string): boolean => day >= M2D_FIRST && day <= M2D_LAST;

/* The window as a period the board code reads (boardData.ts). */
const PERIOD = {
  ...MONTH,
  kind: "month",
  key: M2D_KEY,
  label: "M2D",
  short: "M2D",
  firstDay: M2D_FIRST,
  lastDay: M2D_LAST,
  days: M2D_DAYS,
} as Month;

export type M2dWindow = { first: string; last: string; days: number; day: number; started: boolean; over: boolean };
/* M2D_NOW moves this window's clock in development only, to look at the
 * board before Nov 26 or after Dec 24; production ignores it. */
const DEV_AT = process.env.NODE_ENV !== "production" ? Date.parse(process.env.M2D_NOW ?? "") : NaN;
export function m2dWindow(at = Number.isFinite(DEV_AT) ? DEV_AT : nowMs()): M2dWindow {
  const today = pacificDay(at);
  const started = today >= M2D_FIRST;
  const over = today > M2D_LAST;
  const day = !started ? 0 : over ? M2D_DAYS : Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${M2D_FIRST}T00:00:00Z`)) / 86_400_000) + 1;
  return { first: M2D_FIRST, last: M2D_LAST, days: M2D_DAYS, day, started, over };
}

export async function m2dOptIns(): Promise<Set<string>> {
  const rows = await db.rowMonthOptIn.findMany({ where: { challenge: CHALLENGE, month: M2D_KEY, cancelledAt: null }, select: { participantId: true } });
  return new Set(rows.map((r) => r.participantId));
}

/* Each rower's meters in the window. */
async function windowMeters(): Promise<Map<string, number>> {
  const sums = await db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE, day: { gte: M2D_FIRST, lte: M2D_LAST } }, _sum: { meters: true } });
  return new Map(sums.map((s) => [s.participantId, s._sum.meters ?? 0]));
}

/* THE TOTALS: nobody's own number, so nothing of them is masked (the stats
 * tab's every-meter total follows the same rule). `raised` is the worth of
 * every registered rower's meters; `unclaimed` the worth of the meters of
 * rowers who have not said they are registered. */
export type M2dTotals = { meters: number; raised: number; locked: number; unclaimed: number; rowers: number; registered: number; past100k: number };
export async function m2dTotals(): Promise<{ totals: M2dTotals; by: Map<string, number>; ins: Set<string> }> {
  const [by, ins] = await Promise.all([windowMeters(), m2dOptIns()]);
  const t: M2dTotals = { meters: 0, raised: 0, locked: 0, unclaimed: 0, rowers: 0, registered: ins.size, past100k: 0 };
  for (const [id, m] of by) {
    if (m <= 0) continue;
    t.meters += m;
    t.rowers++;
    if (ins.has(id)) {
      t.raised += worth(m);
      t.locked += locked(m);
      if (m >= 100_000) t.past100k++;
    } else t.unclaimed += worth(m);
  }
  t.raised = Math.round(t.raised * 100) / 100;
  t.locked = Math.round(t.locked * 100) / 100;
  t.unclaimed = Math.round(t.unclaimed * 100) / 100;
  return { totals: t, by, ins };
}

export type M2dRow = { rowerNumber: number; name: string; meters: number; dollars: number | null; in: boolean; me: boolean; blocks?: number };
export type M2dView = {
  window: M2dWindow;
  link: string;
  signup: string;
  goal: number;
  totals: M2dTotals;
  rows: M2dRow[];
  me: { rowerNumber: number; in: boolean; meters: number; dollars: number; locked: number } | null;
};

/* THE M2D BOARD for one viewer: every rower with meters in the window, and
 * every registered rower, in the board's own order, masked as the 100K
 * board masks (boardView): a hidden rower prints blocks and no dollars. */
export async function m2dView(viewer: Viewer): Promise<M2dView> {
  const window = m2dWindow();
  const { totals, by, ins } = await m2dTotals();
  const meId = viewer.myParticipantId;
  let rows: M2dRow[] = [];
  if (window.started) {
    const view = await boardView({ ...previewViewOpts(viewer.preview, meId, viewer.isAdmin), period: PERIOD });
    rows = view.boards.total
      .filter((r) => r.meters > 0 || ins.has(r.participantId))
      .map((r) => ({
        rowerNumber: r.rowerNumber,
        name: r.name,
        meters: r.masked ? 0 : r.meters,
        dollars: r.masked ? null : worth(r.meters),
        in: ins.has(r.participantId),
        me: r.participantId === meId,
        ...(r.masked ? { blocks: r.digits ?? String(r.meters).length } : {}),
      }));
  }
  const mine = meId ? (by.get(meId) ?? 0) : 0;
  return {
    window,
    link: M2D_LINK,
    signup: M2D_SIGNUP,
    goal: M2D_GOAL,
    totals,
    rows,
    me: viewer.me ? { rowerNumber: viewer.me.rowerNumber, in: !!meId && ins.has(meId), meters: mine, dollars: worth(mine), locked: locked(mine) } : null,
  };
}

/* What a rower's dollar stickers print (share/cards.ts, the M2D cards).
 * Null before the window opens: no sticker says $0 for a challenge that
 * has not started. */
export type M2dShare = { meters: number; dollars: number; in: boolean; allMeters: number; allRaised: number; row: { meters: number; dollars: number } | null };
export async function m2dShare(participantId: string | null, row: { day: string; meters: number } | null): Promise<M2dShare | null> {
  if (!m2dWindow().started) return null;
  const { totals, by, ins } = await m2dTotals();
  const m = participantId ? (by.get(participantId) ?? 0) : 0;
  /* A row's own worth is what it added to the rower's: past 100K a
   * kilometre is worth 4 cents, under it 2. */
  let r: M2dShare["row"] = null;
  if (row && inWindow(row.day)) r = { meters: row.meters, dollars: Math.round((worth(m) - worth(Math.max(0, m - row.meters))) * 100) / 100 };
  return { meters: m, dollars: worth(m), in: !!participantId && ins.has(participantId), allMeters: totals.meters, allRaised: totals.raised, row: r };
}
