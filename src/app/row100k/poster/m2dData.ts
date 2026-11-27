/* poster/m2dData.ts — WHAT THE M2D POSTER DRAWS (owner, 2026-11-26: "The
 * other poster I need is one for M2D. I need an M2D poster."), read off
 * row100k/m2d.ts — the same totals the M2D tab, the /m2d page and the
 * dollar stickers print — and handed to poster/m2dPoster.ts as plain data.
 * SERVER ONLY.
 *
 * The totals are nobody's own number and are never masked (m2d.ts
 * m2dTotals says why). A rower's own line is, exactly as the M2D board
 * masks it for a stranger: blocks for the meters and the dollars. */

import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { fmtInt } from "../analysis/fmt";
import { CHARITIES, M2D_DAYS, M2D_FIRST, M2D_LAST, both, m2dMaskedOnBoard, m2dTotals, m2dWindow } from "../m2d";
import { shapeOf } from "@/lib/blackoutRules";
import { usd } from "./m2dPoster";
import type { M2dPoster } from "./types";

const SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const tag = (day: string) => `${SHORT[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;

/* `rowerNumber`: the rower whose own line goes on (their poster), or null
 * for everyone's. `force`: an admin's test blackout. */
export async function m2dPosterData(rowerNumber: number | null, force = false): Promise<M2dPoster> {
  const w = m2dWindow();
  const [{ totals, by, perKm }, days, logged] = await Promise.all([
    m2dTotals(),
    db.rowEntry.groupBy({ by: ["day"], where: { challenge: CHALLENGE, day: { gte: M2D_FIRST, lte: M2D_LAST } }, _sum: { meters: true } }),
    db.rowEntry.findMany({ where: { challenge: CHALLENGE, day: { gte: M2D_FIRST, lte: M2D_LAST } }, select: { createdAt: true } }),
  ]);
  /* WHEN M2D ROWS (owner, 2026-11-26: "What else do we show here"): the
   * rows by the Pacific hour they were logged. */
  const hourOf = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" });
  const hoursArr = Array.from({ length: 24 }, () => 0);
  for (const e of logged) hoursArr[Number(hourOf.format(e.createdAt)) % 24]++;
  const hours = logged.length ? hoursArr : null;
  const byDay = Array.from({ length: M2D_DAYS }, () => 0);
  const first = Date.parse(`${M2D_FIRST}T00:00:00Z`);
  for (const d of days) {
    const i = Math.round((Date.parse(`${d.day}T00:00:00Z`) - first) / 86_400_000);
    if (i >= 0 && i < M2D_DAYS) byDay[i] += d._sum.meters ?? 0;
  }
  const pledges = Math.max(0, Math.round((totals.total - totals.raised - totals.matched) * 100) / 100);

  let me: M2dPoster["me"] = null;
  if (rowerNumber) {
    const p = await db.rowParticipant.findUnique({
      where: { challenge_rowerNumber: { challenge: CHALLENGE, rowerNumber } },
      select: { id: true, rowerNumber: true, displayName: true },
    });
    if (p) {
      const meters = by.get(p.id) ?? 0;
      const dollars = both(meters, perKm);
      const hid = await m2dMaskedOnBoard(p.id, force);
      me = {
        rowerNumber: p.rowerNumber,
        name: p.displayName,
        meters: hid.masked ? { shape: shapeOf(fmtInt(meters)) } : { text: fmtInt(meters) },
        dollars: hid.masked ? { shape: shapeOf(usd(dollars)) } : { text: usd(dollars) },
      };
    }
  }

  const dayWord = !w.started ? `STARTS ${tag(M2D_FIRST)}` : w.over ? "FINAL" : `DAY ${w.day} OF ${w.days}`;
  return {
    kind: "m2d",
    asOf: {
      dateline: `HOLIDAY CHALLENGE · ${tag(M2D_FIRST)} – ${tag(M2D_LAST)} · ${dayWord}`,
      dayNumber: w.day,
      days: M2D_DAYS,
      firstDay: M2D_FIRST,
      firstDow: new Date(first).getUTCDay(),
      final: w.over,
      year: Number(M2D_FIRST.slice(0, 4)),
    },
    totals: {
      total: totals.total,
      concept2: totals.raised,
      rowtember: totals.matched,
      pledges,
      meters: totals.meters,
      rowers: totals.rowers,
      past100k: totals.past100k,
    },
    charities: CHARITIES.map((c) => ({ key: c.key, name: c.name, dollars: totals.split[c.key] ?? 0 })),
    byDay,
    hours,
    me,
  };
}
