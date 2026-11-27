import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { notifyOwner } from "@/lib/rowNotify";
import { CHALLENGE, CHALLENGE_LIVE, MONTH, nowMs, pacificDay } from "@/lib/row100k";
import { previewViewOpts, type Viewer } from "@/lib/row100kViewer";
import type { Month } from "@/lib/rowPeriod";
import { boardView } from "./boardData";
import { filledPledges, pledgeLine, publicName } from "./m2dPledges";

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

/* ROWTEMBER'S PART (owner, 2026-11-25, the last word of several that day:
 * "a flat 3 cents per kilometer on every meter", from the first, no 100K
 * minimum and no step; "I don't like saying it is a match"; no cap shown;
 * credited to ROWTEMBER, never a person; "I don't want to ask people for
 * money": he pays it himself, nothing is collected). The big figure is the
 * total; under it CONCEPT2 (their rule, nothing until 100K) and ROWTEMBER
 * (every meter at the rate), split by the charity each rower picked.
 *
 * THE RATE is a stored setting (RowSetting M2D_RATE_KEY) the owner changes
 * from his planner without a deploy (api/row100k/app/m2d/rate), so he can
 * raise it and say so. A raise applies to every meter in the window. The
 * default stands until he sets one. Never printed as able to go down. */
export const M2D_BY = "ROWTEMBER";
/* 4¢, MATCHING CONCEPT2 (owner, 2026-11-25 afternoon: "update everything
 * and say 4 cents, saying that we're just going to match. That way we can
 * say we're matching"): Concept2 gives 4¢ a km past 100K; ROWTEMBER gives
 * the same 4¢ on every km from the first. This overrides the morning's "I
 * don't like saying it is a match". It is also the floor: a stored rate
 * below it is read as 4, so the figure never goes down. */
export const M2D_RATE_DEFAULT = 4;
/* THE MOST ROWTEMBER MATCHES (owner, 2026-11-25: "let's make sure that my
 * liability is no greater than like $5,000 ... we'll say we match up to
 * $5,000"). Said once, in the FAQ's questions and the giving page's fine
 * print, never as a bar or a countdown. Should registered meters ever be
 * worth more than this at the rate, ROWTEMBER's part is scaled to it: every
 * rower's share shrinks by the same fraction. Lowered to $1,000 (owner,
 * 2026-11-25 evening: "Cap it at $1,000 ... move it from 5,000 down to
 * 1,000"). At 4¢ that is 25,000 km, 2.5 million registered meters. */
export const M2D_CAP = 1000;
export const M2D_RATE_KEY = "m2d.rate";
/* Cents a kilometer, to a hundredth of a cent, from 0.5 to 500 ($5/km)
 * (owner, 2026-11-25: "it doesn't have to be whole number. It can be 4
 * point whatever cents"). */
const hundredths = (c: number) => Math.abs(Math.round(c * 100) - c * 100) < 1e-6;
export const rateOk = (c: unknown): c is number => typeof c === "number" && Number.isFinite(c) && c >= 0.5 && c <= 500 && hundredths(c);

/* THE OTHER GIVERS: A PLEDGE IN CENTS, UP TO A CAP (owner, 2026-11-25,
 * the last word: "the way that I need to phrase fundraising is pledge X
 * cents up to a cap. $1 $75"). A giver pledges cents a kilometer on every
 * registered meter, and each cent is capped at M2D_CENT_CAP dollars ($75:
 * about what September's 7.6M m would cost at 1¢), so 2¢ is never more than
 * $150. Their line on the receipts grows with the meters; past the cap it
 * stops, and the rate is scaled to fit (the same rule as ROWTEMBER's
 * M2D_CAP). The owner keeps the list from his planner (a stored setting,
 * no deploy). It goes where each rower picked, as ROWTEMBER's part does. */
export const M2D_GIVERS_KEY = "m2d.givers";
export const M2D_CENT_CAP = 75;
export type Giver = { name: string; cents: number };
const giverOk = (g: unknown): g is Giver =>
  !!g &&
  typeof (g as Giver).name === "string" &&
  (g as Giver).name.trim().length > 0 &&
  (g as Giver).name.length <= 40 &&
  typeof (g as Giver).cents === "number" &&
  Number.isFinite((g as Giver).cents) &&
  (g as Giver).cents > 0 &&
  (g as Giver).cents <= 500 &&
  hundredths((g as Giver).cents);
export const giversOk = (l: unknown): l is Giver[] => Array.isArray(l) && l.length <= 50 && l.every(giverOk);
/* The most a pledge can come to. */
export const pledgeCap = (c: number): number => Math.round(c * M2D_CENT_CAP * 100) / 100;
export async function m2dGivers(): Promise<Giver[]> {
  try {
    const row = await db.rowSetting.findUnique({ where: { challenge_key: { challenge: CHALLENGE, key: M2D_GIVERS_KEY } }, select: { value: true } });
    const l = row?.value ? (JSON.parse(row.value) as unknown) : [];
    return giversOk(l) ? l.map((g) => ({ name: g.name.trim(), cents: g.cents })) : [];
  } catch {
    return [];
  }
}
export async function setM2dGivers(list: Giver[], by: string): Promise<void> {
  const value = JSON.stringify(list.map((g) => ({ name: g.name.trim(), cents: g.cents })));
  await db.rowSetting.upsert({
    where: { challenge_key: { challenge: CHALLENGE, key: M2D_GIVERS_KEY } },
    create: { challenge: CHALLENGE, key: M2D_GIVERS_KEY, value, updatedBy: by },
    update: { value, updatedBy: by },
  });
}
export async function m2dRate(): Promise<number> {
  try {
    const row = await db.rowSetting.findUnique({ where: { challenge_key: { challenge: CHALLENGE, key: M2D_RATE_KEY } }, select: { value: true } });
    const n = Number(row?.value);
    return rateOk(n) ? Math.max(n, M2D_RATE_DEFAULT) : M2D_RATE_DEFAULT;
  } catch {
    return M2D_RATE_DEFAULT;
  }
}
export async function setM2dRate(centsPerKm: number, by: string): Promise<void> {
  await db.rowSetting.upsert({
    where: { challenge_key: { challenge: CHALLENGE, key: M2D_RATE_KEY } },
    create: { challenge: CHALLENGE, key: M2D_RATE_KEY, value: String(centsPerKm), updatedBy: by },
    update: { value: String(centsPerKm), updatedBy: by },
  });
}
/* ROWTEMBER's dollars for some meters at a rate (cents a kilometer). */
export const ours = (meters: number, rate: number): number => Math.round(((Math.max(0, meters) / 1000) * rate) / 100 * 100) / 100;

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

/* THE SPLIT (owner, 2026-11-25: on the profile only, never at sign-up, a
 * rower can split the match across the three, "1/3 each, 10/90, 0/50/50",
 * the shares adding to 100%). Stored in RowMonthOptIn.choice: a lone key
 * ("inclusion") is 100% to it, the sign-up's one pick; a split is
 * "candlelighters:50,shine:50". Shares are whole percents in steps of 10,
 * except 34/33/33 for thirds. */
export type Shares = Partial<Record<CharityKey, number>>;
export function parseShares(choice: string | null | undefined): Shares | null {
  if (!choice) return null;
  if (isCharity(choice)) return { [choice]: 100 } as Shares;
  const s: Shares = {};
  for (const part of choice.split(",")) {
    const [k, v] = part.split(":");
    const n = Number(v);
    if (!isCharity(k) || !Number.isInteger(n) || n < 0 || n > 100) return null;
    if (n > 0) s[k] = n;
  }
  return Object.values(s).reduce((a, b) => a + (b ?? 0), 0) === 100 ? s : null;
}
export function encodeShares(s: Shares): string {
  const on = CHARITIES.filter((c) => (s[c.key] ?? 0) > 0);
  if (on.length === 1) return on[0].key;
  return on.map((c) => `${c.key}:${s[c.key]}`).join(",");
}
/* "Project Inclusion", or "Candlelighters 50% · Shine A Light 50%". */
/* SPLIT EVENLY, THE DEFAULT (owner, 2026-11-25: "we should definitely give
 * them the default option just to split it ... evenly amongst each of the
 * charities. We can still let them select"): a rower in with no pick is
 * read as this. 34 / 33 / 33, so it adds to 100. */
export const EVEN_SHARES: Shares = Object.fromEntries(
  CHARITIES.map((c, i) => [c.key, Math.floor(100 / CHARITIES.length) + (i < 100 % CHARITIES.length ? 1 : 0)]),
) as Shares;
export const isEven = (s: Shares | null | undefined): boolean => !!s && CHARITIES.every((c) => (s[c.key] ?? 0) === (EVEN_SHARES[c.key] ?? 0));
export function sharesName(s: Shares | null): string {
  if (!s || isEven(s)) return "split evenly";
  const on = CHARITIES.filter((c) => (s[c.key] ?? 0) > 0);
  if (on.length === 1) return on[0].name;
  return on.map((c) => `${c.name} ${s[c.key]}%`).join(" · ");
}
/* A split a rower may save: the three keys only, whole percents, adding to
 * 100. */
function readShares(x: unknown): Shares | null {
  if (!x || typeof x !== "object") return null;
  const s: Shares = {};
  let sum = 0;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (!isCharity(k) || typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100) return null;
    if (v > 0) s[k] = v;
    sum += v;
  }
  return sum === 100 ? s : null;
}


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

/* EVERY ROWER COUNTS (owner, 2026-11-26, of a rower whose dollars showed
 * grey: "Make it by default just evenly distribute to all 3 charities ...
 * even if they haven't interacted with it, that way they still count").
 * Who is in: every rower with meters in the window, split evenly unless
 * they picked, plus everyone who pressed in. Out only by their own word:
 * a row under M2D_KEY with cancelledAt set. */
export async function m2dOptIns(meters?: Map<string, number>): Promise<Map<string, Shares | null>> {
  const [rows, by] = await Promise.all([
    db.rowMonthOptIn.findMany({
      where: { challenge: CHALLENGE, month: M2D_KEY },
      select: { participantId: true, choice: true, cancelledAt: true },
    }),
    meters ? Promise.resolve(meters) : windowMeters(),
  ]);
  const out = new Set(rows.filter((r) => r.cancelledAt).map((r) => r.participantId));
  const ins = new Map<string, Shares | null>();
  for (const [id, m] of by) if (m > 0 && !out.has(id)) ins.set(id, EVEN_SHARES);
  for (const r of rows) if (!r.cancelledAt) ins.set(r.participantId, parseShares(r.choice) ?? EVEN_SHARES);
  return ins;
}

/* Each rower's meters in the window. */
async function windowMeters(): Promise<Map<string, number>> {
  const sums = await db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE, day: { gte: M2D_FIRST, lte: M2D_LAST } }, _sum: { meters: true } });
  return new Map(sums.map((s) => [s.participantId, s._sum.meters ?? 0]));
}

/* A REGISTERED ROWER'S DOLLARS: Concept2's (nothing until 100K) and
 * ROWTEMBER's (every meter at the rate). */
export const both = (meters: number, rate: number): number => cents(locked(meters) + ours(meters, rate));

/* THE TOTALS: nobody's own number, so nothing of them is masked (the stats
 * tab's every-meter total follows the same rule). Registered rowers only.
 *   raised     CONCEPT2: their rule, a rower's money once past 100K;
 *   matched    ROWTEMBER: every meter at the rate (the name is older than
 *              the rule; the app reads it);
 *   total      the two: THE figure the page and the app print big;
 *   split      ROWTEMBER's part by the charity each rower picked;
 *   unpicked   ROWTEMBER's part of registered rowers with no pick yet;
 *   unclaimed  what the rowers not registered would raise. */
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
  /* Meters by registered rowers: what ROWTEMBER's part is paid on. */
  inMeters: number;
  /* The pledges, each its cents a kilometer, its cap and its dollars so
   * far; in `total` and in `split`. */
  /* Since 2026-11-26 the approved PLEDGES (m2dPledges.ts) follow the old
   * list here, each with `line` ("$1/km for 500 km · Name"), its km so far
   * and the km its cap buys; the app reads name, cents, cap and dollars. */
  givers: (Giver & { cap: number; dollars: number; line?: string; km?: number; capKm?: number; pledge?: true })[];
};
/* `perKm`: what a registered kilometer is paid past Concept2's part:
 * ROWTEMBER's rate and every pledge, each under its cap. */
export async function m2dTotals(): Promise<{ totals: M2dTotals; by: Map<string, number>; ins: Map<string, Shares | null>; rate: number; perKm: number; givers: Giver[] }> {
  const by = await windowMeters();
  const [ins, nominal, givers] = await Promise.all([m2dOptIns(by), m2dRate(), m2dGivers()]);
  /* UNDER THE CAPS: what the registered meters would cost at each rate; a
   * part that would pass its cap is paid at the rate that meets it. The
   * receipts print the rate offered; the dollars are the paid ones. */
  let regMeters = 0;
  for (const [id, m] of by) if (m > 0 && ins.has(id)) regMeters += m;
  const fit = (r: number, cap: number) => {
    const full = ((regMeters / 1000) * r) / 100;
    return full > cap ? (r * cap) / full : r;
  };
  const rate = fit(nominal, M2D_CAP);
  const paid = givers.map((g) => fit(g.cents, pledgeCap(g.cents)));
  const perKm = Math.round((rate + paid.reduce((a, r) => a + r, 0)) * 10000) / 10000;
  const split = Object.fromEntries(CHARITIES.map((c) => [c.key, 0])) as Record<CharityKey, number>;
  const gave: M2dTotals["givers"] = givers.map((g) => ({ ...g, cap: pledgeCap(g.cents), dollars: 0 }));
  const t: M2dTotals = { meters: 0, raised: 0, matched: 0, total: 0, split, unpicked: 0, locked: 0, unclaimed: 0, rowers: 0, registered: ins.size, past100k: 0, inMeters: 0, givers: gave };
  for (const [id, m] of by) {
    if (m <= 0) continue;
    t.meters += m;
    t.rowers++;
    if (ins.has(id)) {
      t.matched += ours(m, rate);
      gave.forEach((g, i) => (g.dollars += ours(m, paid[i])));
      /* What goes where the rower picked: ROWTEMBER's part and the pledges'. */
      const mine = ours(m, rate) + paid.reduce((a, r) => a + ours(m, r), 0);
      t.inMeters += m;
      t.raised += locked(m);
      if (m >= 100_000) t.past100k++;
      const shares = ins.get(id);
      if (shares) for (const c of CHARITIES) split[c.key] += (mine * (shares[c.key] ?? 0)) / 100;
      else t.unpicked += mine;
    } else t.unclaimed += both(m, perKm);
  }
  for (const g of gave) g.dollars = cents(Math.min(g.cap, g.dollars));
  /* THE PLEDGES (m2dPledges.ts): approved only, each on the kilometers
   * logged after its approval, under its own cap, split where those rowers
   * picked. They join the receipts after the old list. */
  const pledged = await filledPledges(ins).catch((err) => {
    console.error("M2D pledges: not counted", err);
    return [];
  });
  const pledgeSplit = Object.fromEntries(CHARITIES.map((c) => [c.key, 0])) as Record<CharityKey, number>;
  for (const p of pledged) {
    for (const c of CHARITIES) pledgeSplit[c.key] += p.fill.split[c.key];
  }
  const gifts = cents(gave.reduce((a, g) => a + g.dollars, 0));
  const pledgeDollars = cents(pledged.reduce((a, p) => a + p.fill.dollars, 0));
  t.raised = cents(t.raised);
  t.matched = cents(t.matched);
  t.locked = t.raised;
  const pool = cents(t.matched + gifts);
  t.total = cents(t.raised + pool);
  for (const c of CHARITIES) split[c.key] = cents(split[c.key]);
  t.unpicked = cents(t.unpicked);
  /* A split (thirds) rounds each line to the cent; the lines must still
   * add up to ROWTEMBER's part, so the cent left over goes to the biggest. */
  const gap = cents(pool - t.unpicked - CHARITIES.reduce((a, c) => a + split[c.key], 0));
  if (gap !== 0) {
    const big = CHARITIES.reduce((a, c) => (split[c.key] > split[a.key] ? c : a), CHARITIES[0]);
    split[big.key] = cents(split[big.key] + gap);
  }
  /* The pledges' own split is exact to the cent already; it is added after
   * the rounding above. */
  for (const c of CHARITIES) split[c.key] = cents(split[c.key] + pledgeSplit[c.key]);
  t.total = cents(t.total + pledgeDollars);
  for (const p of pledged)
    gave.push({
      name: publicName(p),
      cents: p.centsPerKm,
      cap: p.capDollars,
      dollars: p.fill.dollars,
      line: pledgeLine(p),
      km: Math.round(p.fill.km * 10) / 10,
      capKm: Math.round(p.fill.capKm * 10) / 10,
      pledge: true,
    });
  t.unclaimed = cents(t.unclaimed);
  /* `rate` out is the one offered (4¢ on the receipts); perKm is paid. */
  return { totals: t, by, ins, rate: nominal, perKm, givers };
}

/* `dollars`: Concept2's and ROWTEMBER's together for the rower's meters. */
export type M2dRow = { rowerNumber: number; name: string; division: string; meters: number; dollars: number | null; in: boolean; me: boolean; blocks?: number };
export type M2dView = {
  window: M2dWindow;
  link: string;
  signup: string;
  goal: number;
  /* ROWTEMBER's rate, cents a kilometer on every meter; perKm, its and
   * every other giver's together (totals.givers lists them). */
  rate: number;
  perKm: number;
  /* Kept for the app builds that read it: who gives the second part. */
  match: { on: boolean; by: string };
  charities: Charity[];
  totals: M2dTotals;
  rows: M2dRow[];
  /* choice: the one charity when all of ROWTEMBER's part goes to one (null
   * for a split or no pick); shares: the whole of it, percent by charity.
   * dollars: Concept2's (concept2) and ROWTEMBER's (rowtember) together. */
  me: {
    rowerNumber: number;
    in: boolean;
    choice: string | null;
    shares: Shares | null;
    meters: number;
    dollars: number;
    concept2: number;
    rowtember: number;
    locked: number;
  } | null;
};

/* THE M2D BOARD for one viewer: every rower with meters in the window, and
 * every registered rower, in the board's own order, masked as the 100K
 * board masks (boardView): a hidden rower prints blocks and no dollars. */
export async function m2dView(viewer: Viewer): Promise<M2dView> {
  const window = m2dWindow();
  const { totals, by, ins, rate, perKm } = await m2dTotals();
  const meId = viewer.myParticipantId;
  let rows: M2dRow[] = [];
  if (window.started) {
    const view = await boardView({ ...previewViewOpts(viewer.preview, meId, viewer.isAdmin), period: PERIOD });
    rows = view.boards.total
      .filter((r) => r.meters > 0 || ins.has(r.participantId))
      .map((r) => ({
        rowerNumber: r.rowerNumber,
        name: r.name,
        division: r.division,
        meters: r.masked ? 0 : r.meters,
        dollars: r.masked ? null : both(r.meters, perKm),
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
    rate,
    perKm,
    match: { on: true, by: M2D_BY },
    charities: CHARITIES.map((c) => ({ ...c })),
    totals,
    rows,
    me: viewer.me
      ? {
          rowerNumber: viewer.me.rowerNumber,
          in: !!meId && ins.has(meId),
          choice: (() => {
            const s = meId ? ins.get(meId) : null;
            const one = s ? CHARITIES.filter((c) => (s[c.key] ?? 0) === 100) : [];
            return one.length === 1 ? one[0].key : null;
          })(),
          shares: meId ? (ins.get(meId) ?? null) : null,
          meters: mine,
          dollars: both(mine, perKm),
          concept2: locked(mine),
          rowtember: ours(mine, rate),
          locked: locked(mine),
        }
      : null,
  };
}

/* What a rower's dollar stickers print (share/cards.ts, the M2D cards).
 * Null before the window opens: no sticker says $0 for a challenge that
 * has not started. `allRaised` is the total (Concept2 and the match), the
 * figure the page prints big. */
/* `day`: the challenge day the DAY X sticker prints (owner, 2026-11-26: "I
 * need a day X sticker for meters to dollars"): the row's own day when the
 * deck is a row's, otherwise today's. 0 before the window opens. */
export type M2dShare = { meters: number; dollars: number; in: boolean; allMeters: number; allRaised: number; row: { meters: number; dollars: number } | null; day: number; days: number };
export async function m2dShare(participantId: string | null, row: { day: string; meters: number } | null): Promise<M2dShare | null> {
  /* Open before Nov 26 too, at $0 (owner, 2026-11-25: "let me share the
   * M2D stickers, even if it says 0 ... like now"). */
  const { totals, by, ins, perKm: rate } = await m2dTotals();
  const m = participantId ? (by.get(participantId) ?? 0) : 0;
  /* A row's own dollars are what it added to the rower's: ROWTEMBER's on
   * every meter, and Concept2's once the rower is past 100K. */
  let r: M2dShare["row"] = null;
  if (row && inWindow(row.day)) r = { meters: row.meters, dollars: cents(both(m, rate) - both(Math.max(0, m - row.meters), rate)) };
  const w = m2dWindow();
  const day = row && inWindow(row.day) ? Math.round((Date.parse(`${row.day}T00:00:00Z`) - Date.parse(`${M2D_FIRST}T00:00:00Z`)) / 86_400_000) + 1 : w.day;
  return { meters: m, dollars: both(m, rate), in: !!participantId && ins.has(participantId), allMeters: totals.meters, allRaised: totals.total, row: r, day, days: M2D_DAYS };
}

/* The body both routes take, { in, choice? , shares? }, read once: the
 * answer (the pick as stored, encodeShares), or the words to refuse with.
 * `choice` is one charity (the sign-up); `shares` a split (the profile). A
 * pick is refused once the window has closed. */
export function readM2dBody(body: unknown): { in: boolean; choice: string | undefined } | string {
  const b = (body ?? {}) as { in?: unknown; choice?: unknown; shares?: unknown };
  if (typeof b.in !== "boolean") return "Say in or out.";
  let choice: string | undefined;
  if (b.shares !== undefined) {
    const s = readShares(b.shares);
    if (!s) return "The shares must add up to 100%.";
    choice = encodeShares(s);
  } else if (b.choice !== undefined) {
    if (!isCharity(b.choice)) return "Pick one of the three charities.";
    choice = b.choice;
  }
  if (choice !== undefined && m2dWindow().over) return "Picks closed on Dec 24.";
  return { in: b.in, choice };
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
  choice: string | undefined,
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
  const pick = sharesName(parseShares(saved.choice));
  const subject = `M2D: #${me.rowerNumber} ${me.displayName} ${isIn ? `is in · ${pick}` : "is out"}`;
  /* And a push to his phone, the same line (owner, 2026-11-25: "Give me a
   * push notification for this"); a tap opens the M2D tab. Never throws. */
  /* The push is the alert; the email only when it could not go. */
  if (await notifyOwner(subject, { kind: "m2d" })) return;
  const sent = await sendOwnerNotification(
    subject,
    `Rower #${me.rowerNumber} ${me.displayName} ${word} the Concept2 Holiday Challenge (M2D) on ${where}.
ROWTEMBER's part goes to: ${pick}.
Account: ${email ?? ""}`,
    email ?? undefined,
  ).catch((err) => ({ ok: false as const, error: String(err) }));
  if (!sent.ok) console.error("M2D: owner email failed", sent.error);
}

/* THE OWNER'S COST PLANNER (owner, 2026-11-25: what this will cost him and
 * what rate he can afford; "built to work every month later, not just
 * M2D"). The window's meters so far and a projection for the whole of it,
 * low / likely / high:
 *   from the pace so far once three days are in (low 0.6x, high 1.5x the
 *   pace for the days left);
 *   before that from history on the live database: the biggest month there
 *   is (HIGH_MONTH, September 2026) and the month the window starts in, up
 *   to the day before it (the low), each as meters a day; likely is their
 *   geometric mean.
 * Meters are everyone's: ROWTEMBER pays registered rowers' only, so the
 * projection is a ceiling. The arithmetic of a rate is the client's: cost =
 * km x cents / 100, so 1 cent a km is $1 for every 100K meters. */
export const HIGH_MONTH = { label: "September 2026", first: "2026-09-01", last: "2026-09-30" };
export type PlanSpan = { label: string; meters: number; rowers: number; days: number };
export type M2dPlan = {
  window: M2dWindow;
  rate: number;
  givers: Giver[];
  /* WHAT ROWERS PICKED (owner, 2026-11-25: "I personally want to see ...
   * what charities people chose, what percentage"): each charity's share of
   * the registered rowers' picks, a split counted by its shares (a rower
   * at 50/50 is half a rower to each), and how many have no pick yet. */
  picks: { key: string; name: string; rowers: number; pct: number }[];
  unpicked: number;
  soFar: { meters: number; inMeters: number; rowers: number; registered: number; cost: number };
  history: { high: PlanSpan; low: PlanSpan };
  projected: { low: number; likely: number; high: number };
  basis: "pace" | "history";
};
const spanDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
async function span(label: string, first: string, last: string): Promise<PlanSpan> {
  const rows = await db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE, day: { gte: first, lte: last } }, _sum: { meters: true } });
  return { label, meters: rows.reduce((a, r) => a + (r._sum.meters ?? 0), 0), rowers: rows.filter((r) => (r._sum.meters ?? 0) > 0).length, days: spanDays(first, last) };
}
export async function m2dPlan(): Promise<M2dPlan> {
  const window = m2dWindow();
  const monthStart = `${M2D_FIRST.slice(0, 8)}01`;
  const dayBefore = new Date(Date.parse(`${M2D_FIRST}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const [{ totals, rate, givers, ins }, high, low] = await Promise.all([
    m2dTotals(),
    span(HIGH_MONTH.label, HIGH_MONTH.first, HIGH_MONTH.last),
    span(`${new Date(`${monthStart}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} 1 to ${Number(dayBefore.slice(8))}`, monthStart, dayBefore),
  ]);
  const left = window.days - window.day;
  let projected: M2dPlan["projected"];
  let basis: M2dPlan["basis"];
  if (window.day >= 3 && totals.meters > 0) {
    const pace = totals.meters / window.day;
    projected = { low: totals.meters + 0.6 * pace * left, likely: totals.meters + pace * left, high: totals.meters + 1.5 * pace * left };
    basis = "pace";
  } else {
    const lo = totals.meters + (low.meters / Math.max(1, low.days)) * left;
    const hi = totals.meters + (high.meters / Math.max(1, high.days)) * left;
    projected = { low: lo, likely: Math.sqrt(lo * hi), high: hi };
    basis = "history";
  }
  const r = (n: number) => Math.round(n);
  return {
    window,
    rate,
    givers,
    ...(() => {
      const w = Object.fromEntries(CHARITIES.map((c) => [c.key, 0])) as Record<string, number>;
      let unpicked = 0;
      for (const s of ins.values()) {
        if (!s) unpicked++;
        else for (const c of CHARITIES) w[c.key] += (s[c.key] ?? 0) / 100;
      }
      const picked = Math.max(1, ins.size - unpicked);
      return {
        picks: CHARITIES.map((c) => ({ key: c.key, name: c.name, rowers: Math.round(w[c.key] * 10) / 10, pct: Math.round((w[c.key] / picked) * 100) })),
        unpicked,
      };
    })(),
    soFar: { meters: totals.meters, inMeters: totals.inMeters, rowers: totals.rowers, registered: totals.registered, cost: totals.matched },
    history: { high, low },
    projected: { low: r(projected.low), likely: r(projected.likely), high: r(projected.high) },
    basis,
  };
}

/* THE PRICE OF A CENT (owner, 2026-11-25: "give me a best guess ... sell 1
 * cent at this amount"), for the giving page (/m2d/give) and the planner.
 * One cent a kilometer on every registered meter costs meters / 100,000
 * dollars. The projection is everyone's meters (m2dPlan), so it is a
 * ceiling on what registered rowers will row. The ask is the likely case
 * rounded UP to the next $5. A pledge of a cent is capped at M2D_CENT_CAP:
 * the likely case is what to expect, the cap the most it can come to. */
export type M2dPrice = {
  window: M2dWindow;
  meters: number;
  inMeters: number;
  registered: number;
  /* Cents a kilometer offered now: ROWTEMBER's and every pledge. */
  perKm: number;
  rate: number;
  givers: (Giver & { cap: number })[];
  centCap: number;
  projected: { low: number; likely: number; high: number };
  cent: { low: number; likely: number; high: number; ask: number };
  cap: number;
};
export async function m2dPrice(): Promise<M2dPrice> {
  const p = await m2dPlan();
  const one = (m: number) => Math.round((m / 100_000) * 100) / 100;
  const likely = one(p.projected.likely);
  return {
    window: p.window,
    meters: p.soFar.meters,
    inMeters: p.soFar.inMeters,
    registered: p.soFar.registered,
    perKm: Math.round((p.rate + p.givers.reduce((a, g) => a + g.cents, 0)) * 100) / 100,
    rate: p.rate,
    givers: p.givers.map((g) => ({ ...g, cap: pledgeCap(g.cents) })),
    centCap: M2D_CENT_CAP,
    projected: p.projected,
    cent: { low: one(p.projected.low), likely, high: one(p.projected.high), ask: Math.max(5, Math.ceil(likely / 5) * 5) },
    cap: M2D_CAP,
  };
}
