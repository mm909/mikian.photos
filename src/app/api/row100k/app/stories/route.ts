import { db } from "@/lib/db";
import { CHALLENGE, nowMs, pacificDay } from "@/lib/row100k";
import { no, yes } from "../social";

/* THE QUESTIONS BEHIND THE STATS, for the phone app (owner, 2026-11-21:
 * "there's some appetite for ... FAQs ... row after row of a question,
 * like about stats. And then when you click it ... it'll kind of show you
 * whatever graph and some explanation for that stat. Let's try it for two
 * of them"). Two to begin with:
 *
 *   rowers   "how many people rowed in September and October and November
 *            ... the average daily users for that week. And if it's gone up
 *            or down over the past 2 weeks"
 *   when     "when do people row the most?"
 *
 * Three more on 2026-11-21 (owner, of the first two: "in general, these
 * questions are good ... take that as free rein to add a couple more"):
 *
 *   club     how many rowers make the 100K each month, and what it took
 *            the ones who did
 *   length   how far a typical row is
 *   fivek    how long a 5K takes the field
 *
 * Counts of the whole field only: how many rowers, how many rows, on which
 * day and at which hour. Nobody's own figure is in here, so lights out has
 * nothing to hide, and the route is open the way the stats page is.
 *
 * A day is the Pacific day the rower logged the row under. An hour is the
 * Pacific hour the row was LOGGED, which is when most are rowed but not
 * all: a row entered the morning after counts for that morning. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const hourOf = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" });
const addDays = (day: string, by: number) => new Date(Date.parse(`${day}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);

export async function GET() {
  try {
    const rows = await db.rowEntry.findMany({ where: { challenge: CHALLENGE }, select: { participantId: true, day: true, createdAt: true, meters: true, seconds: true } });
    const today = pacificDay(nowMs());

    /* Who rowed on each day. */
    const byDay = new Map<string, Set<string>>();
    const byMonth = new Map<string, { rowers: Set<string>; rows: number; meters: number }>();
    const hours = Array.from({ length: 24 }, () => 0);
    const weekdays = Array.from({ length: 7 }, () => 0);
    for (const r of rows) {
      let d = byDay.get(r.day);
      if (!d) byDay.set(r.day, (d = new Set()));
      d.add(r.participantId);
      const mk = r.day.slice(0, 7);
      let m = byMonth.get(mk);
      if (!m) byMonth.set(mk, (m = { rowers: new Set(), rows: 0, meters: 0 }));
      m.rowers.add(r.participantId);
      m.rows++;
      m.meters += r.meters;
      const h = Number(hourOf.format(r.createdAt));
      if (h >= 0 && h < 24) hours[h]++;
      weekdays[new Date(`${r.day}T12:00:00Z`).getUTCDay()]++;
    }
    const on = (day: string) => byDay.get(day)?.size ?? 0;

    /* The last four weeks, a day at a time, today last. */
    const days = Array.from({ length: 28 }, (_, i) => {
      const day = addDays(today, i - 27);
      return { day, rowers: on(day) };
    });
    /* Three weeks of seven whole days, the newest ending yesterday: today
     * is still being rowed and would drag its week down. */
    const week = (back: number) => {
      let sum = 0;
      for (let i = 1; i <= 7; i++) sum += on(addDays(today, -(back * 7 + i)));
      return Math.round((sum / 7) * 10) / 10;
    };
    const months = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, m]) => ({ key, label: MONTHS[Number(key.slice(5, 7)) - 1] ?? key, year: key.slice(0, 4), rowers: m.rowers.size, rows: m.rows, meters: m.meters }));

    /* THE 100K CLUB, a month at a time: who logged in it, who reached
     * 100,000, and for those who did, how many rows it took them. */
    const GOAL = 100_000;
    const perRower = new Map<string, Map<string, { meters: number; rows: number }>>();
    for (const r of rows) {
      const mk = r.day.slice(0, 7);
      let m = perRower.get(mk);
      if (!m) perRower.set(mk, (m = new Map()));
      const one = m.get(r.participantId) ?? { meters: 0, rows: 0 };
      one.meters += r.meters;
      one.rows++;
      m.set(r.participantId, one);
    }
    const mid = (v: number[]) => {
      if (!v.length) return 0;
      const s = [...v].sort((a, b) => a - b);
      return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    };
    const everMade = new Set<string>();
    const club = [...perRower.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, m]) => {
        const made = [...m.entries()].filter(([, v]) => v.meters >= GOAL);
        for (const [id] of made) everMade.add(id);
        return { key, label: MONTHS[Number(key.slice(5, 7)) - 1] ?? key, year: key.slice(0, 4), rowers: m.size, made: made.length, rowsToMake: Math.round(mid(made.map(([, v]) => v.rows))), live: key === today.slice(0, 7) };
      });

    /* HOW FAR A ROW IS: every row's length, a column a thousand meters. */
    const lengths = rows.map((r) => r.meters).filter((m) => m > 0);
    const bins = Array.from({ length: 13 }, () => 0);
    for (const m of lengths) bins[Math.min(12, Math.floor(m / 1000))]++;
    const near = (m: number, at: number) => Math.abs(m - at) <= 50;

    /* HOW LONG A 5K TAKES: every timed 5,000 m, a column each half minute
     * from 16:00 to 32:00. Counts only: nobody's own time is in here. */
    const fives = rows.filter((r) => near(r.meters, 5000) && r.seconds > 0);
    const T0 = 16 * 60;
    const STEP = 30;
    const tbins = Array.from({ length: 32 }, () => 0);
    for (const r of fives) tbins[Math.max(0, Math.min(31, Math.floor((r.seconds - T0) / STEP)))]++;
    const times = fives.map((r) => r.seconds);

    return yes({
      rowers: { today: on(today), todayDay: today, weeks: [week(0), week(1), week(2)], days, months, everyone: new Set(rows.map((r) => r.participantId)).size },
      when: { hours, weekdays, rows: rows.length },
      club: { months: club, everMade: everMade.size, goal: GOAL },
      length: { bins, median: Math.round(mid(lengths)), rows: lengths.length, fives: lengths.filter((m) => near(m, 5000)).length, tens: lengths.filter((m) => near(m, 10000)).length, longest: lengths.length ? Math.max(...lengths) : 0 },
      fivek: { bins: tbins, from: T0, step: STEP, median: Math.round(mid(times)), rows: fives.length, rowers: new Set(fives.map((r) => r.participantId)).size, under20: times.filter((t) => t < 1200).length },
    });
  } catch (err) {
    console.error("row app: failed to build the stats stories", err);
    return no("That could not be read just now.", 500);
  }
}
