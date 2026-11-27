import { db } from "@/lib/db";
import { CHALLENGE, nowMs, pacificDay } from "@/lib/row100k";
import { androidTesters, testerCount } from "./android/testers";

/* WHO USES THE APP (owner, 2026-11-26: "I need like a total number of
 * downloads, total number of users, total number of times used in a day.
 * Like I need usage stats there ... I need to know who's using the app
 * because I think someone has downloaded it"; and "a place inside of
 * settings that shows me the Android status, like how many people we have
 * and if they've ... downloaded the app"). SERVER ONLY, reads only; the
 * owner's alone (api/row100k/app/usage).
 *
 * Two records say an account has the app:
 *   RowPushToken  a phone that asked for notifications, from Nov 21: the
 *                 history, back to the first install;
 *   RowAppSeen    every day the app came to the front, from Nov 26.
 * A store download with no sign-in is in neither: Apple and Google keep
 * those counts in their own consoles. */

export type UsagePerson = {
  name: string;
  rowerNumber: number | null;
  platforms: string[];
  firstDay: string;
  lastDay: string;
  days: number;
  opens: number;
};
/* AGAINST FOUR WEEKS (owner, 2026-11-26: "You can include things like
 * likes and comments on rows as well as part of the usage stats. And I
 * probably want to compare most of these numbers to a 4-week period, like a
 * 4-week average"). Each figure today against the average day of the 28
 * before it, and the last 7 days against the average week of the 28 before
 * those. A figure counted only since some day (the app's opens, from Nov
 * 26) is averaged over the days it has; with none yet, no average. */
export type Versus = { key: string; label: string; today: number; avgDay: number | null; week: number; avgWeek: number | null };
export type AppUsage = {
  today: string;
  versus: Versus[];
  since: string | null;
  accounts: number;
  byPlatform: { ios: number; android: number; web: number };
  todayUsers: number;
  todayOpens: number;
  days: { day: string; users: number; opens: number }[];
  people: UsagePerson[];
  android: { have: number; goal: number; testers: { name: string; sent: boolean; onApp: boolean }[]; installs: number };
};

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function appUsage(): Promise<AppUsage> {
  const today = pacificDay(nowMs());
  const [seen, push, testers] = await Promise.all([
    db.rowAppSeen.findMany({ select: { userId: true, day: true, platform: true, opens: true } }),
    db.rowPushToken.findMany({ select: { userId: true, platform: true, createdAt: true, updatedAt: true } }),
    androidTesters(),
  ]);
  type P = { platforms: Set<string>; first: string; last: string; days: Set<string>; opens: number };
  const by = new Map<string, P>();
  const get = (id: string) => {
    let p = by.get(id);
    if (!p) by.set(id, (p = { platforms: new Set(), first: "9999", last: "", days: new Set(), opens: 0 }));
    return p;
  };
  for (const t of push) {
    const p = get(t.userId);
    p.platforms.add(t.platform);
    const d0 = pacificDay(t.createdAt.getTime());
    const d1 = pacificDay(t.updatedAt.getTime());
    if (d0 < p.first) p.first = d0;
    if (d1 > p.last) p.last = d1;
  }
  for (const s of seen) {
    const p = get(s.userId);
    p.platforms.add(s.platform);
    p.days.add(s.day);
    p.opens += s.opens;
    if (s.day < p.first) p.first = s.day;
    if (s.day > p.last) p.last = s.day;
  }
  const ids = [...by.keys()];
  const [accounts, rowers] = await Promise.all([
    db.photographer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }),
    db.rowParticipant.findMany({ where: { challenge: CHALLENGE, userId: { in: ids } }, select: { userId: true, rowerNumber: true, displayName: true } }),
  ]);
  const acct = new Map(accounts.map((a) => [a.id, a]));
  const rower = new Map(rowers.map((r) => [r.userId, r]));

  const people: UsagePerson[] = ids
    .map((id) => {
      const p = by.get(id)!;
      const r = rower.get(id);
      return {
        name: r?.displayName ?? acct.get(id)?.name ?? "An account",
        rowerNumber: r?.rowerNumber ?? null,
        platforms: [...p.platforms].sort(),
        firstDay: p.first,
        lastDay: p.last,
        days: p.days.size,
        opens: p.opens,
      };
    })
    .sort((a, b) => (a.lastDay === b.lastDay ? b.opens - a.opens : a.lastDay < b.lastDay ? 1 : -1));

  const byPlatform = { ios: 0, android: 0, web: 0 };
  for (const p of by.values()) for (const k of p.platforms) if (k === "ios" || k === "android" || k === "web") byPlatform[k]++;

  const days: AppUsage["days"] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    const on = seen.filter((s) => s.day === day);
    days.push({ day, users: new Set(on.map((s) => s.userId)).size, opens: on.reduce((a, s) => a + s.opens, 0) });
  }
  const t = days[days.length - 1];

  /* THE FOUR-WEEK COMPARISONS. Days are Pacific. */
  const from = addDays(today, -34);
  const fromAt = new Date(Date.parse(`${from}T00:00:00-08:00`));
  const [likes, comments, logged] = await Promise.all([
    db.rowLike.findMany({ where: { challenge: CHALLENGE, createdAt: { gte: fromAt } }, select: { createdAt: true, participantId: true } }),
    db.rowComment.findMany({ where: { challenge: CHALLENGE, deletedAt: null, createdAt: { gte: fromAt } }, select: { createdAt: true, participantId: true } }),
    db.rowEntry.findMany({ where: { challenge: CHALLENGE, createdAt: { gte: fromAt } }, select: { createdAt: true, participantId: true } }),
  ]);
  type Ev = { day: string; who: string; n: number };
  const ev = (xs: { createdAt: Date; participantId: string }[]): Ev[] => xs.map((x) => ({ day: pacificDay(x.createdAt.getTime()), who: x.participantId, n: 1 }));
  const seenEv: Ev[] = seen.filter((s) => s.day >= from).map((s) => ({ day: s.day, who: s.userId, n: s.opens }));
  const weekStart = addDays(today, -6);
  const priorDay0 = addDays(today, -28);
  const priorWeek0 = addDays(today, -34);
  const within = (d: string, a: string, b: string) => d >= a && d <= b;
  const tracked = (since: string | null, a: string, b: string) => {
    if (!since) return 0;
    const s = since > a ? since : a;
    return s > b ? 0 : Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${s}T12:00:00Z`)) / 86_400_000) + 1;
  };
  const one = (key: string, label: string, xs: Ev[], how: "count" | "people", since: string | null): Versus => {
    const sum = (a: string, b: string) => {
      const inside = xs.filter((x) => within(x.day, a, b));
      return how === "people" ? new Set(inside.map((x) => x.who)).size : inside.reduce((m, x) => m + x.n, 0);
    };
    /* Distinct people a day, averaged: each day counted on its own. */
    const perDay = (a: string, b: string) => {
      let total = 0;
      for (let d = a; d <= b; d = addDays(d, 1)) total += sum(d, d);
      return total;
    };
    const dayN = tracked(since, priorDay0, addDays(today, -1));
    const weekDays = tracked(since, priorWeek0, addDays(today, -7));
    const weekTotal = how === "people" ? (() => {
      /* Distinct people in each of the four weeks, then their mean. */
      let tot = 0;
      let n = 0;
      for (let w = 0; w < 4; w++) {
        const b = addDays(today, -7 - 7 * w);
        const a = addDays(b, -6);
        const days = tracked(since, a, b);
        /* Only whole weeks: people do not add up by the day. */
        if (days < 7) continue;
        tot += sum(a, b);
        n++;
      }
      return n ? tot / n : null;
    })() : weekDays ? (sum(priorWeek0, addDays(today, -7)) / weekDays) * 7 : null;
    const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
    return {
      key,
      label,
      today: sum(today, today),
      avgDay: dayN ? r1(perDay(addDays(today, -dayN), addDays(today, -1)) / dayN) : null,
      week: sum(weekStart, today),
      avgWeek: r1(weekTotal),
    };
  };
  const appSince = seen.length ? seen.map((s) => s.day).sort()[0] : null;
  const versus: Versus[] = [
    one("users", "Rowers in the app", seenEv, "people", appSince),
    one("opens", "Times opened", seenEv, "count", appSince),
    one("rows", "Rows logged", ev(logged), "count", "2000-01-01"),
    one("rowers", "Rowers who logged", ev(logged), "people", "2000-01-01"),
    one("likes", "Likes", ev(likes), "count", "2000-01-01"),
    one("comments", "Comments", ev(comments), "count", "2000-01-01"),
  ];

  /* An Android tester is on the app when the account with their email has
   * an Android phone in either record. */
  const androidIds = new Set([...by.entries()].filter(([, p]) => p.platforms.has("android")).map(([id]) => id));
  const testerAccounts = await db.photographer.findMany({ where: { email: { in: testers.map((x) => x.email.trim().toLowerCase()) } }, select: { id: true, email: true } });
  const idOf = new Map(testerAccounts.map((a) => [a.email.toLowerCase(), a.id]));
  const list = testers.map((x) => {
    const id = idOf.get(x.email.trim().toLowerCase());
    return { name: x.name || x.email.split("@")[0], sent: !!x.sent, onApp: !!id && androidIds.has(id) };
  });
  const seenDays = seen.map((s) => s.day).sort();
  return {
    today,
    versus,
    since: seenDays[0] ?? null,
    accounts: by.size,
    byPlatform,
    todayUsers: t.users,
    todayOpens: t.opens,
    days,
    people,
    android: { ...testerCount(testers.length), testers: list.sort((a, b) => Number(b.onApp) - Number(a.onApp) || a.name.localeCompare(b.name)), installs: androidIds.size },
  };
}
