import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { CHALLENGE, CHALLENGE_LIVE, MONTH, nowMs, pacificDay } from "@/lib/row100k";
import { previewViewOpts, type Viewer } from "@/lib/row100kViewer";
import type { Month } from "@/lib/rowPeriod";
import { boardView } from "./boardData";

/* M2D, METERS TO DOLLARS (owner, 2026-11-25, of the Concept2 Holiday
 * Challenge, Nov 26 - Dec 24: "we really need a place where we can show
 * how much money collectively Rowtember users have raised ... it doesn't
 * start until that date ... M2D is what we'll call it"). The phone app's
 * M2D tab, the profile's M2D column, the stats tab's dollars, the site's
 * /m2d page and the dollar stickers all read this. SERVER ONLY.
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
 * prints. LOCKED is the part Concept2 has actually promised: worth only for
 * a rower who has passed 100K. */

export const M2D_KEY = "m2d-2026";
export const M2D_FIRST = "2026-11-26";
export const M2D_LAST = "2026-12-24";
export const M2D_DAYS = 29;
export const M2D_LINK = "https://log.concept2.com/challenges/holiday";
export const M2D_SIGNUP = "https://log.concept2.com/signup";
/* The goal on the stats tab and the page (owner: "a goal can be, can we
 * raise $100"; raised to $1,000 on review, 2026-11-25). Measured against
 * the total to charity, the match included. */
export const M2D_GOAL = 1000;

/* THE MATCH (owner, 2026-11-25: "I think that I want to match the amount
 * made"; then "I don't want to say a cap for what I'm donating. Also let's
 * just show a total amount raised and show where the donated money is
 * coming from"; and it is matched by "ROWTEMBER", not by a person). So
 * ROWTEMBER gives what Concept2 gives for Rowtember rowers, dollar for
 * dollar, NO CAP SHOWN ANYWHERE; the big figure is the total, and under it
 * where it comes from: Concept2 for the meters, and ROWTEMBER's match,
 * split by the charity each rower picked. `on: false` takes the match off
 * everywhere (the total is then Concept2's alone). */
export const M2D_MATCH = { on: true, by: "ROWTEMBER" } as const;

/* WHERE ROWTEMBER'S MATCH GOES (owner, 2026-11-25: "I want users to be able
 * to pick where their donations go to. I'm thinking Project Inclusion,
 * Shine a Light, and Candlelighters. They can choose one of those three").
 * Three Las Vegas charities; each rower's match goes to the one they pick
 * (RowMonthOptIn.choice). Concept2's own money goes wherever the rower
 * picked in their Concept2 Logbook: that is separate. */
export const CHARITIES = [
  {
    key: "candlelighters",
    name: "Candlelighters",
    full: "Candlelighters Childhood Cancer Foundation of Nevada",
    what: "Support for kids with cancer and their families.",
    url: "https://candlelightersnv.org",
  },
  {
    key: "shine",
    name: "Shine A Light",
    full: "Shine A Light Foundation",
    what: "Outreach and housing for people living in the Las Vegas flood tunnels.",
    url: "https://www.shinealightlv.com",
  },
  {
    key: "inclusion",
    name: "Project Inclusion",
    full: "Project Inclusion",
    what: "Social opportunities for neurodivergent and disabled adults in Southern Nevada.",
    url: "https://www.projectinclusion.org",
  },
] as const;
export type CharityKey = (typeof CHARITIES)[number]["key"];
export type Charity = { key: string; name: string; full: string; what: string; url: string | null };
export const isCharity = (k: unknown): k is CharityKey => typeof k === "string" && CHARITIES.some((c) => c.key === k);
const charityName = (k: string | null | undefined): string => CHARITIES.find((c) => c.key === k)?.name ?? "no pick yet";

/* What Concept2 says on its own page (read 2026-11-25): its group goal for
 * the whole challenge, and the rewards. */
export const C2_GROUP_GOAL = 70_000;

/* The strip under the bar that leads to /m2d (M2dBanner.tsx): the cookie
 * its x sets. */
export const M2D_BANNER_COOKIE = "row100k_m2d_banner";

/* Dollars, to the cent. */
export function worth(meters: number): number {
  const km = Math.max(0, meters) / 1000;
  const d = km <= 100 ? 0.02 * km : 2 + 0.04 * (km - 100);
  return Math.round(d * 100) / 100;
}
export const locked = (meters: number): number => (meters >= 100_000 ? worth(meters) : 0);
export const inWindow = (day: string): boolean => day >= M2D_FIRST && day <= M2D_LAST;
const cents = (d: number) => Math.round(d * 100) / 100;

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

/* `until`: whole days to the first day (1 = it starts tomorrow; 0 once
 * started), so the page says STARTS TOMORROW instead of a page of $0.00. */
export type M2dWindow = { first: string; last: string; days: number; day: number; started: boolean; over: boolean; until: number };
/* M2D_NOW moves this window's clock in development only, to look at the
 * board before Nov 26 or after Dec 24; production ignores it. */
const DEV_AT = process.env.NODE_ENV !== "production" ? Date.parse(process.env.M2D_NOW ?? "") : NaN;
export function m2dWindow(at = Number.isFinite(DEV_AT) ? DEV_AT : nowMs()): M2dWindow {
  const today = pacificDay(at);
  const started = today >= M2D_FIRST;
  const over = today > M2D_LAST;
  const day = !started ? 0 : over ? M2D_DAYS : Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${M2D_FIRST}T00:00:00Z`)) / 86_400_000) + 1;
  const until = started ? 0 : Math.round((Date.parse(`${M2D_FIRST}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return { first: M2D_FIRST, last: M2D_LAST, days: M2D_DAYS, day, started, over, until };
}

/* Every registered rower, and the charity they picked (null: not yet). */
export async function m2dOptIns(): Promise<Map<string, string | null>> {
  const rows = await db.rowMonthOptIn.findMany({
    where: { challenge: CHALLENGE, month: M2D_KEY, cancelledAt: null },
    select: { participantId: true, choice: true },
  });
  return new Map(rows.map((r) => [r.participantId, isCharity(r.choice) ? r.choice : null]));
}

/* Each rower's meters in the window. */
async function windowMeters(): Promise<Map<string, number>> {
  const sums = await db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE, day: { gte: M2D_FIRST, lte: M2D_LAST } }, _sum: { meters: true } });
  return new Map(sums.map((s) => [s.participantId, s._sum.meters ?? 0]));
}

/* THE TOTALS: nobody's own number, so nothing of them is masked (the stats
 * tab's every-meter total follows the same rule).
 *   raised     what Concept2 gives: the worth of every registered rower's meters;
 *   matched    ROWTEMBER's match, equal to it (0 with the match off);
 *   total      the two together: THE figure the page and the app print big;
 *   split      the match by the charity each rower picked;
 *   unpicked   the match of registered rowers who have not picked yet;
 *   unclaimed  the worth of the meters of rowers not registered. */
export type M2dTotals = {
  meters: number;
  raised: number;
  matched: number;
  total: number;
  split: Record<CharityKey, number>;
  unpicked: number;
  locked: number;
  unclaimed: number;
  rowers: number;
  registered: number;
  past100k: number;
};
export async function m2dTotals(): Promise<{ totals: M2dTotals; by: Map<string, number>; ins: Map<string, string | null> }> {
  const [by, ins] = await Promise.all([windowMeters(), m2dOptIns()]);
  const split = Object.fromEntries(CHARITIES.map((c) => [c.key, 0])) as Record<CharityKey, number>;
  const t: M2dTotals = { meters: 0, raised: 0, matched: 0, total: 0, split, unpicked: 0, locked: 0, unclaimed: 0, rowers: 0, registered: ins.size, past100k: 0 };
  for (const [id, m] of by) {
    if (m <= 0) continue;
    t.meters += m;
    t.rowers++;
    const w = worth(m);
    if (ins.has(id)) {
      t.raised += w;
      t.locked += locked(m);
      if (m >= 100_000) t.past100k++;
      const pick = ins.get(id);
      if (M2D_MATCH.on) {
        if (pick && isCharity(pick)) split[pick] += w;
        else t.unpicked += w;
      }
    } else t.unclaimed += w;
  }
  t.raised = cents(t.raised);
  t.matched = M2D_MATCH.on ? t.raised : 0;
  t.total = cents(t.raised + t.matched);
  for (const c of CHARITIES) split[c.key] = cents(split[c.key]);
  t.unpicked = cents(t.unpicked);
  t.locked = cents(t.locked);
  t.unclaimed = cents(t.unclaimed);
  return { totals: t, by, ins };
}

export type M2dRow = { rowerNumber: number; name: string; meters: number; dollars: number | null; in: boolean; me: boolean; blocks?: number };
export type M2dView = {
  window: M2dWindow;
  link: string;
  signup: string;
  goal: number;
  /* Concept2's goal for the whole challenge, everyone's. */
  c2Goal: number;
  match: { on: boolean; by: string };
  charities: Charity[];
  totals: M2dTotals;
  rows: M2dRow[];
  me: { rowerNumber: number; in: boolean; choice: string | null; meters: number; dollars: number; locked: number } | null;
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
    c2Goal: C2_GROUP_GOAL,
    match: { on: M2D_MATCH.on, by: M2D_MATCH.by },
    charities: CHARITIES.map((c) => ({ ...c })),
    totals,
    rows,
    me: viewer.me
      ? {
          rowerNumber: viewer.me.rowerNumber,
          in: !!meId && ins.has(meId),
          choice: meId ? (ins.get(meId) ?? null) : null,
          meters: mine,
          dollars: worth(mine),
          locked: locked(mine),
        }
      : null,
  };
}

/* What a rower's dollar stickers print (share/cards.ts, the M2D cards).
 * Null before the window opens: no sticker says $0 for a challenge that
 * has not started. `allRaised` is the total (Concept2 and the match), the
 * figure the page prints big. */
export type M2dShare = { meters: number; dollars: number; in: boolean; allMeters: number; allRaised: number; row: { meters: number; dollars: number } | null };
export async function m2dShare(participantId: string | null, row: { day: string; meters: number } | null): Promise<M2dShare | null> {
  if (!m2dWindow().started) return null;
  const { totals, by, ins } = await m2dTotals();
  const m = participantId ? (by.get(participantId) ?? 0) : 0;
  /* A row's own worth is what it added to the rower's: past 100K a
   * kilometre is worth 4 cents, under it 2. */
  let r: M2dShare["row"] = null;
  if (row && inWindow(row.day)) r = { meters: row.meters, dollars: cents(worth(m) - worth(Math.max(0, m - row.meters))) };
  return { meters: m, dollars: worth(m), in: !!participantId && ins.has(participantId), allMeters: totals.meters, allRaised: totals.total, row: r };
}

/* The body both routes take, { in, choice? }, read once: the answer, or
 * the words to refuse with. A pick is refused once the window has closed. */
export function readM2dBody(body: unknown): { in: boolean; choice: CharityKey | undefined } | string {
  const b = (body ?? {}) as { in?: unknown; choice?: unknown };
  if (typeof b.in !== "boolean") return "Say in or out.";
  if (b.choice !== undefined && !isCharity(b.choice)) return "Pick one of the three charities.";
  if (b.choice !== undefined && m2dWindow().over) return "Picks closed on Dec 24.";
  return { in: b.in, choice: b.choice as CharityKey | undefined };
}

/* A ROWER SAYS THEY ARE REGISTERED (or takes it back), and which charity
 * ROWTEMBER's match goes to, from the app or the site page: one row under
 * M2D_KEY. `choice` undefined leaves the pick as it is; the pick can be
 * changed until Dec 24 (the routes refuse after). On the live challenge an
 * email to the owner every time, with the pick (CLAUDE.md: every sign-up
 * emails the owner). A failed send is logged, never surfaced. Throws when
 * the save fails. */
export async function saveM2d(
  me: { id: string; rowerNumber: number; displayName: string },
  isIn: boolean,
  choice: CharityKey | undefined,
  email: string | null | undefined,
  where: "the ROW app" | "rowtember.com",
): Promise<void> {
  const cancelledAt = isIn ? null : new Date();
  const saved = await db.rowMonthOptIn.upsert({
    where: { challenge_participantId_month: { challenge: CHALLENGE, participantId: me.id, month: M2D_KEY } },
    create: { challenge: CHALLENGE, participantId: me.id, rowerNumber: me.rowerNumber, month: M2D_KEY, cancelledAt, choice: choice ?? null },
    update: { cancelledAt, ...(choice !== undefined ? { choice } : {}) },
    select: { choice: true },
  });
  if (CHALLENGE !== CHALLENGE_LIVE) return;
  const word = isIn ? "registered for" : "took back their registration for";
  const pick = charityName(saved.choice);
  const sent = await sendOwnerNotification(
    `M2D: #${me.rowerNumber} ${me.displayName} ${isIn ? `is in · ${pick}` : "is out"}`,
    `Rower #${me.rowerNumber} ${me.displayName} ${word} the Concept2 Holiday Challenge (M2D) on ${where}.
ROWTEMBER's match goes to: ${pick}.
Account: ${email ?? ""}`,
    email ?? undefined,
  ).catch((err) => ({ ok: false as const, error: String(err) }));
  if (!sent.ok) console.error("M2D: owner email failed", sent.error);
}
