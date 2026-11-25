import { db } from "@/lib/db";
import { CHALLENGE, nowMs, pacificDay } from "@/lib/row100k";
import { M2D_CAP, M2D_FIRST, M2D_LAST, m2dOptIns, m2dTotals } from "./m2d";

/* M2D'S RETURN (owner, 2026-11-25 evening: "I need in my settings, under
 * the M2D section ... a section for my ROI. And that should keep going and
 * analyzing after M2D is done ... There's two different classes. It's like
 * I started during M2D versus I just rowed during M2D. And then keep track
 * of if they continue"). The owner's alone (api/row100k/app/m2d/return).
 * SERVER ONLY. Reads only; nothing is stored for it.
 *
 * THE TWO CLASSES, among everyone who logged a row on ROW in the window
 * (Nov 26 - Dec 24):
 *   started   their first row ever on ROW is in the window;
 *   rowed     they had rowed on ROW before Nov 26 and rowed in it too.
 * Each class also counts the rowers in it who opted in to M2D, since the
 * match is paid on theirs.
 *
 * AFTER: for each class, how many logged a row in each stretch after the
 * window: the rest of December (Dec 25-31), then every calendar month up
 * to today, and the last 30 days. It keeps counting for as long as the
 * site runs; a month with no days yet is not shown.
 *
 * THE COST is ROWTEMBER's part (m2dTotals matched, under M2D_CAP): the
 * owner's money. Other givers' gifts are theirs and are left out. */

export type ReturnClass = {
  rowers: number;
  registered: number;
  meters: number;
  /* Rowers in the class who logged a row in each stretch after. */
  after: number[];
  last30: number;
};
export type M2dReturn = {
  window: { first: string; last: string; over: boolean };
  today: string;
  cost: number;
  cap: number;
  started: ReturnClass;
  rowed: ReturnClass;
  /* The stretches after the window, in order: a label and its days. */
  stretches: { label: string; first: string; last: string; partial: boolean }[];
  perStarted: number | null;
  perStartedStill: number | null;
};

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const monthLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/* The rest of the window's month, then every month to today's. */
function stretches(today: string): M2dReturn["stretches"] {
  const out: M2dReturn["stretches"] = [];
  const after = addDays(M2D_LAST, 1);
  if (today < after) return out;
  const monthEnd = (d: string) => addDays(`${nextMonth(d)}-01`, -1);
  let first = after;
  let label = `${new Date(`${after}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} to ${new Date(`${monthEnd(after)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  while (first <= today) {
    const last = monthEnd(first);
    out.push({ label, first, last, partial: today < last });
    first = addDays(last, 1);
    label = monthLabel(first);
  }
  return out;
}
function nextMonth(day: string): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export async function m2dReturn(): Promise<M2dReturn> {
  const today = pacificDay(nowMs());
  const [inWindow, firsts, opted, { totals }] = await Promise.all([
    db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE, day: { gte: M2D_FIRST, lte: M2D_LAST } }, _sum: { meters: true } }),
    db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE }, _min: { day: true } }),
    m2dOptIns(),
    m2dTotals(),
  ]);
  const firstDay = new Map(firsts.map((f) => [f.participantId, f._min.day ?? ""]));
  const optedIn = new Set(opted.keys());
  const cls = new Map<string, "started" | "rowed">();
  const blank = (): ReturnClass => ({ rowers: 0, registered: 0, meters: 0, after: [], last30: 0 });
  const c = { started: blank(), rowed: blank() };
  for (const r of inWindow) {
    const meters = r._sum.meters ?? 0;
    if (meters <= 0) continue;
    const k = (firstDay.get(r.participantId) ?? M2D_FIRST) >= M2D_FIRST ? "started" : "rowed";
    cls.set(r.participantId, k);
    c[k].rowers++;
    c[k].meters += meters;
    if (optedIn.has(r.participantId)) c[k].registered++;
  }

  const st = stretches(today);
  c.started.after = st.map(() => 0);
  c.rowed.after = st.map(() => 0);
  if (st.length && cls.size) {
    const since30 = addDays(today, -29);
    const later = await db.rowEntry.findMany({
      where: { challenge: CHALLENGE, day: { gt: M2D_LAST }, participantId: { in: [...cls.keys()] } },
      select: { participantId: true, day: true },
    });
    const seen = st.map(() => new Set<string>());
    const recent = new Set<string>();
    for (const e of later) {
      const i = st.findIndex((s) => e.day >= s.first && e.day <= s.last);
      if (i >= 0) seen[i].add(e.participantId);
      if (e.day >= since30) recent.add(e.participantId);
    }
    seen.forEach((set, i) => {
      for (const id of set) c[cls.get(id)!].after[i]++;
    });
    for (const id of recent) c[cls.get(id)!].last30++;
  }

  const cost = Math.round(totals.matched * 100) / 100;
  const over = today > M2D_LAST;
  return {
    window: { first: M2D_FIRST, last: M2D_LAST, over },
    today,
    cost,
    cap: M2D_CAP,
    started: c.started,
    rowed: c.rowed,
    stretches: st,
    perStarted: c.started.rowers ? Math.round((cost / c.started.rowers) * 100) / 100 : null,
    perStartedStill: over && c.started.last30 ? Math.round((cost / c.started.last30) * 100) / 100 : null,
  };
}
