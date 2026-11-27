import { db } from "@/lib/db";
import { ADMIN_EMAILS, CHALLENGE, nowMs, pacificDay } from "@/lib/row100k";
import { DEV_EMAIL } from "@/lib/devHide";
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
  /* `phone`: on the app by what they did there, the kind of phone not yet
   * known (nothing in either record says it). */
  byPlatform: { ios: number; android: number; web: number; phone: number };
  /* The share of the meters logged that were logged on the app. */
  meterShare: { today: number | null; week: number | null; prior4: number | null };
  /* ROWS OFF A MONITOR (owner, 2026-11-26: "how many rows have telemetry
   * data versus are just logged manually"): of all rows logged, the share
   * with a recording, the last 7 days and the 4 weeks before. */
  recorded: { week: number | null; weekRows: number; prior4: number | null; prior4Rows: number };
  /* THE LIVE ERG VIEW (owner: "which panel users are spending their time
   * on"): minutes on each panel over the last 28 days, and the rowers. */
  panels: { panel: string; minutes: number; rowers: number }[];
  /* Phones that opened the app and have not signed in. */
  signedOut: number;
  todayUsers: number;
  todayOpens: number;
  days: { day: string; users: number; opens: number }[];
  people: UsagePerson[];
  android: { have: number; goal: number; testers: { name: string; sent: boolean; onApp: boolean }[]; installs: number };
};

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function appUsage(): Promise<AppUsage> {
  const today = pacificDay(nowMs());
  /* NONE OF THE OWNER'S OWN (owner, 2026-11-26: "this usage page should
   * exclude any of my usage"): his accounts and the Developer sign-in are
   * left out of every figure here. */
  const ownAccounts = await db.photographer.findMany({ where: { email: { in: [...ADMIN_EMAILS, DEV_EMAIL] } }, select: { id: true } });
  const notMe = new Set(ownAccounts.map((a) => a.id));
  const notMePids = new Set(
    (await db.rowParticipant.findMany({ where: { userId: { in: [...notMe] } }, select: { id: true } })).map((p) => p.id),
  );
  const [seenAll, pushAll, testers] = await Promise.all([
    db.rowAppSeen.findMany({ select: { userId: true, day: true, platform: true, opens: true } }),
    db.rowPushToken.findMany({ select: { userId: true, platform: true, createdAt: true, updatedAt: true } }),
    androidTesters(),
  ]);
  /* A phone not signed in is "device:<id>" (app/seen): counted apart. */
  const signedOut = new Set(seenAll.filter((s) => s.userId.startsWith("device:")).map((s) => s.userId)).size;
  const seen = seenAll.filter((s) => !notMe.has(s.userId) && !s.userId.startsWith("device:"));
  const push = pushAll.filter((t) => !notMe.has(t.userId));
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
  /* WHAT ONLY THE APP DOES (owner, 2026-11-26: "How does the app usage
   * only show me ... when we know that Abe has downloaded and used it
   * because of the like and comment?"): a like, a comment, a follow, a
   * recording off a monitor, a row logged on the app. Anyone who did one is
   * on the app, the kind of phone unknown until it opens and is counted. */
  const [likesAll, commentsAll, followsAll, recordings, appRows] = await Promise.all([
    db.rowLike.findMany({ where: { challenge: CHALLENGE }, select: { participantId: true, createdAt: true } }),
    db.rowComment.findMany({ where: { challenge: CHALLENGE }, select: { participantId: true, createdAt: true } }),
    db.rowFollow.findMany({ select: { followerId: true, createdAt: true } }),
    db.rowTelemetry.findMany({ where: { simulated: false, userId: { not: null } }, select: { userId: true, startedAt: true } }),
    db.rowEntry.findMany({ where: { challenge: CHALLENGE, via: "app" }, select: { participantId: true, createdAt: true } }),
  ]);
  const acts: { pid?: string; uid?: string; at: Date }[] = [
    ...likesAll.map((x) => ({ pid: x.participantId, at: x.createdAt })),
    ...commentsAll.map((x) => ({ pid: x.participantId, at: x.createdAt })),
    ...followsAll.map((x) => ({ pid: x.followerId, at: x.createdAt })),
    ...appRows.map((x) => ({ pid: x.participantId, at: x.createdAt })),
    ...recordings.map((x) => ({ uid: x.userId as string, at: x.startedAt })),
  ];
  const pidUser = new Map(
    (await db.rowParticipant.findMany({ where: { id: { in: [...new Set(acts.map((a) => a.pid).filter((x): x is string => !!x))] } }, select: { id: true, userId: true } })).map((p) => [p.id, p.userId]),
  );
  for (const a of acts) {
    const uid = a.uid ?? (a.pid ? pidUser.get(a.pid) : undefined);
    if (!uid || notMe.has(uid)) continue;
    const p = get(uid);
    const d = pacificDay(a.at.getTime());
    if (d < p.first) p.first = d;
    if (d > p.last) p.last = d;
  }
  for (const p of by.values()) if (p.platforms.size === 0) p.platforms.add("phone");
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

  const byPlatform = { ios: 0, android: 0, web: 0, phone: 0 };
  for (const p of by.values()) for (const k of p.platforms) if (k === "ios" || k === "android" || k === "web" || k === "phone") byPlatform[k]++;

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
  const [likesRaw, commentsRaw, loggedRaw] = await Promise.all([
    db.rowLike.findMany({ where: { challenge: CHALLENGE, createdAt: { gte: fromAt } }, select: { createdAt: true, participantId: true } }),
    db.rowComment.findMany({ where: { challenge: CHALLENGE, deletedAt: null, createdAt: { gte: fromAt } }, select: { createdAt: true, participantId: true } }),
    db.rowEntry.findMany({ where: { challenge: CHALLENGE, createdAt: { gte: fromAt } }, select: { id: true, createdAt: true, participantId: true, via: true, caption: true, meters: true } }),
  ]);
  const likes = likesRaw.filter((x) => !notMePids.has(x.participantId));
  const comments = commentsRaw.filter((x) => !notMePids.has(x.participantId));
  const allLogged = loggedRaw.filter((x) => !notMePids.has(x.participantId));
  /* ON THE APP, NOT THE SITE (owner, 2026-11-26: "this usage needs to be
   * usage of ... the Row app, not Rowtember in general"). A row says where
   * it was logged since Nov 26 (RowEntry.via); before that, a row with a
   * recording off a monitor or a caption (both the app's alone) was the
   * app's, and a plain typed one is counted as the site's. */
  const recorded = new Set(
    (await db.rowTelemetry.findMany({ where: { entryId: { in: allLogged.map((r) => r.id) } }, select: { entryId: true } })).map((t) => t.entryId as string),
  );
  const onApp = (r: (typeof allLogged)[number]) => r.via === "app" || (r.via === "" && (recorded.has(r.id) || !!r.caption));
  const logged = allLogged.filter(onApp);
  const shareOf = (a: string, b: string) => {
    const inside = allLogged.filter((r) => within(pacificDay(r.createdAt.getTime()), a, b));
    const all = inside.reduce((m, r) => m + r.meters, 0);
    return all > 0 ? Math.round((inside.filter(onApp).reduce((m, r) => m + r.meters, 0) / all) * 100) : null;
  };
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
    one("rows", "Rows logged on the app", ev(logged), "count", "2000-01-01"),
    one("rowers", "Rowers who logged on the app", ev(logged), "people", "2000-01-01"),
    one("likes", "Likes", ev(likes), "count", "2000-01-01"),
    one("comments", "Comments", ev(comments), "count", "2000-01-01"),
  ];

  /* An Android tester is on the app when the account with their email has
   * an Android phone in either record. */
  const androidIds = new Set([...by.entries()].filter(([, p]) => p.platforms.has("android")).map(([id]) => id));
  const testerAccounts = await db.photographer.findMany({ where: { email: { in: testers.map((x) => x.email.trim().toLowerCase()) } }, select: { id: true, email: true } });
  const idOf = new Map(testerAccounts.map((a) => [a.email.toLowerCase(), a.id]));
  /* BY NAME WHEN THE EMAIL IS ANOTHER (owner, 2026-11-26: "Abe's account
   * ... just shows as invited on the testers page"): Abe gave the list one
   * Gmail and signs in to the app with another. A tester whose email is no
   * account here is matched to the one rower with the same name, if just
   * one has it. */
  const named = await db.rowParticipant.findMany({
    where: { challenge: CHALLENGE, displayName: { in: testers.map((x) => x.name.trim()).filter(Boolean), mode: "insensitive" } },
    select: { userId: true, displayName: true },
  });
  const byName = new Map<string, string | null>();
  for (const r of named) {
    const k = r.displayName.trim().toLowerCase();
    byName.set(k, byName.has(k) ? null : r.userId);
  }
  const list = testers.map((x) => {
    /* The email's account first; when that one is not on the app (Abe's
     * tester Gmail is an account of its own, from the site), the rower of
     * the same name. */
    const byMail = idOf.get(x.email.trim().toLowerCase());
    const id = byMail && by.has(byMail) ? byMail : (byName.get(x.name.trim().toLowerCase()) ?? byMail ?? undefined);
    /* On an Android by its record, or on the app by what they did there
     * with no iPhone known: a closed tester's phone is an Android. */
    const p = id ? by.get(id) : undefined;
    return { name: x.name || x.email.split("@")[0], sent: !!x.sent, onApp: !!p && (p.platforms.has("android") || (p.platforms.has("phone") && !p.platforms.has("ios"))) };
  });
  const seenDays = seen.map((s) => s.day).sort();
  const meterShare = { today: shareOf(today, today), week: shareOf(weekStart, today), prior4: shareOf(priorWeek0, addDays(today, -7)) };
  const recShare = (a: string, b: string) => {
    const inside = allLogged.filter((r) => within(pacificDay(r.createdAt.getTime()), a, b));
    return { n: inside.length, pct: inside.length ? Math.round((inside.filter((r) => recorded.has(r.id)).length / inside.length) * 100) : null };
  };
  const rw = recShare(weekStart, today);
  const rp = recShare(priorWeek0, addDays(today, -7));
  const panelRows = (await db.rowPanelTime.findMany({ where: { day: { gte: addDays(today, -27) } }, select: { userId: true, panel: true, seconds: true } })).filter((p) => !notMe.has(p.userId));
  const pm = new Map<string, { s: number; who: Set<string> }>();
  for (const p of panelRows) {
    const e = pm.get(p.panel) ?? { s: 0, who: new Set<string>() };
    e.s += p.seconds;
    e.who.add(p.userId);
    pm.set(p.panel, e);
  }
  const panels = [...pm.entries()].map(([panel, e]) => ({ panel, minutes: Math.round(e.s / 6) / 10, rowers: e.who.size })).sort((a, b) => b.minutes - a.minutes);
  return {
    today,
    versus,
    meterShare,
    recorded: { week: rw.pct, weekRows: rw.n, prior4: rp.pct, prior4Rows: rp.n },
    panels,
    signedOut,
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
