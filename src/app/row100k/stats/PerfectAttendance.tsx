import { daysElapsed, fmtRowerNumber, type WeeklyRow } from "@/lib/row100k";

/* PERFECT ATTENDANCE (owner, 2026-09-21: "on the stats give me a section for
 * perfect attendance — list people who have not missed a day").
 *
 * THE RULE: every day of the month so far, through YESTERDAY. A day is not
 * missed until it is over, so somebody who has not rowed yet today is still
 * on the list; and on day one, before any day has ended, it is everyone who
 * has rowed. Names only, A to Z — no metres, so lights out has nothing to
 * hide here and nobody is ranked. */

export function perfectAttendance(daily: WeeklyRow[][], now: number): { rows: WeeklyRow[]; note: string; days: number } {
  const done = Math.max(1, Math.min(daily.length, daysElapsed(now) - 1));
  const byId = new Map<string, WeeklyRow>();
  const days: Set<string>[] = [];
  for (let i = 0; i < done; i++) {
    const today = new Set<string>();
    for (const r of daily[i]) {
      today.add(r.participantId);
      byId.set(r.participantId, r);
    }
    days.push(today);
  }
  const ids: string[] = days.length ? [...days[0]].filter((id) => days.every((d) => d.has(id))) : [];
  const rows = ids
    .map((id) => byId.get(id))
    .filter((r): r is WeeklyRow => r !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
  const note = `${rows.length} ${rows.length === 1 ? "ROWER" : "ROWERS"} · EVERY DAY THROUGH SEP ${done}`;
  return { rows, note, days: done };
}

export function PerfectAttendance({ rows }: { rows: WeeklyRow[] }) {
  if (!rows.length) return <p className="mono pa-none">NOBODY HAS ROWED EVERY DAY SO FAR.</p>;
  return (
    <ul className="pa-list">
      {rows.map((r) => (
        <li key={r.participantId}>
          <a href={`/row100k/r/${r.rowerNumber}`}>{r.name}</a>
          <span className="mono">{fmtRowerNumber(r.rowerNumber)}</span>
        </li>
      ))}
    </ul>
  );
}
