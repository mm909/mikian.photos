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
    const rows = await db.rowEntry.findMany({ where: { challenge: CHALLENGE }, select: { participantId: true, day: true, createdAt: true, meters: true } });
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

    return yes({
      rowers: { today: on(today), todayDay: today, weeks: [week(0), week(1), week(2)], days, months, everyone: new Set(rows.map((r) => r.participantId)).size },
      when: { hours, weekdays, rows: rows.length },
    });
  } catch (err) {
    console.error("row app: failed to build the stats stories", err);
    return no("That could not be read just now.", 500);
  }
}
