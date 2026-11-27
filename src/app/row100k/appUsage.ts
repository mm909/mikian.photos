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
export type AppUsage = {
  today: string;
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
