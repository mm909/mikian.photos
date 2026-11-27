import { db } from "@/lib/db";
import { ADMIN_EMAILS, CHALLENGE, nowMs, pacificDay } from "@/lib/row100k";
import { DEV_EMAIL } from "@/lib/devHide";

/* WHO STAYS (owner, 2026-11-26: "how many people sign up and never row
 * again ... what's your churn probability after row number 3? ... There's
 * probably a nice curve that says something like if a user logs 3 rows,
 * then they're more likely to stay"). SERVER ONLY, reads only; the owner's
 * alone (api/row100k/app/analytics?k=churn). None of the owner's own
 * accounts, nor rower 000.
 *
 *   signedUp / neverRowed   joined, and never logged a row;
 *   afterRow                for row N: of the rowers whose Nth row is two
 *                           weeks old or more, the share who logged row N+1
 *                           (a newer Nth row has not had the time);
 *   months                  rowers in each month, and how many of them
 *                           rowed in the month after;
 *   byEffort                rows in a month against rowing the month after. */
export type Churn = {
  signedUp: number;
  neverRowed: number;
  afterRow: { n: number; rowers: number; judged: number; went: number }[];
  months: { key: string; rowers: number; next: number | null }[];
  byEffort: { from: string; to: string; bands: { label: string; rowers: number; stayed: number }[] } | null;
};

const BANDS: [number, number][] = [[1, 2], [3, 5], [6, 10], [11, 20], [21, 999]];

export async function churn(): Promise<Churn> {
  const today = pacificDay(nowMs());
  const own = await db.photographer.findMany({ where: { email: { in: [...ADMIN_EMAILS, DEV_EMAIL] } }, select: { id: true } });
  const ownIds = new Set(own.map((o) => o.id));
  const parts = (await db.rowParticipant.findMany({ where: { challenge: CHALLENGE }, select: { id: true, userId: true, rowerNumber: true } })).filter((p) => !ownIds.has(p.userId) && p.rowerNumber !== 0);
  const ids = new Set(parts.map((p) => p.id));
  const rows = (await db.rowEntry.findMany({ where: { challenge: CHALLENGE }, select: { participantId: true, day: true } })).filter((r) => ids.has(r.participantId));
  const by = new Map<string, string[]>();
  for (const r of rows) (by.get(r.participantId) ?? by.set(r.participantId, []).get(r.participantId)!).push(r.day);
  for (const d of by.values()) d.sort();
  const age = (day: string) => Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000);

  const afterRow = [1, 2, 3, 4, 5, 7, 10, 15, 20, 30].map((n) => {
    const have = [...by.values()].filter((d) => d.length >= n);
    const old = have.filter((d) => age(d[n - 1]) >= 14);
    return { n, rowers: have.length, judged: old.length, went: old.filter((d) => d.length > n).length };
  });

  const keys = [...new Set(rows.map((r) => r.day.slice(0, 7)))].sort();
  const inMonth = (k: string) => new Set([...by.entries()].filter(([, d]) => d.some((x) => x.startsWith(k))).map(([p]) => p));
  const sets = keys.map(inMonth);
  const months = keys.map((key, i) => ({ key, rowers: sets[i].size, next: i + 1 < keys.length ? [...sets[i]].filter((p) => sets[i + 1].has(p)).length : null }));

  /* The biggest month, against the one after it. */
  let byEffort: Churn["byEffort"] = null;
  const big = months.slice(0, -1).reduce<number>((b, m, i) => (b < 0 || m.rowers > months[b].rowers ? i : b), -1);
  if (big >= 0) {
    const from = keys[big];
    const to = keys[big + 1];
    byEffort = {
      from,
      to,
      bands: BANDS.map(([lo, hi]) => {
        const grp = [...by.entries()].filter(([, d]) => {
          const n = d.filter((x) => x.startsWith(from)).length;
          return n >= lo && n <= hi;
        });
        return { label: hi >= 999 ? `${lo}+` : `${lo}–${hi}`, rowers: grp.length, stayed: grp.filter(([p]) => sets[big + 1].has(p)).length };
      }),
    };
  }
  return { signedUp: parts.length, neverRowed: parts.filter((p) => !by.has(p.id)).length, afterRow, months, byEffort };
}
