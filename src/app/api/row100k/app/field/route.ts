import { db } from "@/lib/db";
import { averageForceCurve } from "@/lib/pm5/analysis";
import type { TelemetryCurve } from "@/lib/pm5/session";
import { ergAppDenial, ergViewer } from "@/app/erg/gate";
import { no, yes } from "../social";

/* THE FIELD'S FORCE CURVE, for the phone app (owner, 2026-11-21, of the
 * force curve on a row's analytics: "it says that the peak comes late at
 * 52% of the drive. What should it be at? Like how far away am I? Like,
 * what does the average force curve look like? And I can't tell that by
 * this chart ... if we swipe ... it would show us the averages across
 * everyone").
 *
 * The average stroke of every real recording saved to the site, by shape:
 * each recording's own average stroke (lib/pm5/analysis.ts) is scaled to
 * its own peak, so a strong rower and a light one weigh the same; a
 * rower's recordings are averaged into one curve first, so somebody with
 * forty rows counts once; and the rowers are then averaged together. What
 * comes back is a shape from 0 to 1 over the drive, where its peak sits,
 * and how many rows and rowers are in it.
 *
 * Nobody's own curve or name is in the answer. Wears the app's erg gate,
 * as the recordings do. Worked out at most once in half an hour on a
 * server: it reads every recording, and it moves slowly. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Field = { points: number[]; peakPct: number; rows: number; rowers: number };
let kept: { at: number; force: Field | null } | null = null;
const KEEP_MS = 30 * 60_000;
/* The newest recordings, at most this many: each is a whole row of strokes. */
const TAKE = 80;

export async function GET() {
  const viewer = await ergViewer();
  const denied = ergAppDenial(viewer);
  if (denied) return no(denied.error, denied.status);
  try {
    if (kept && Date.now() - kept.at < KEEP_MS) return yes({ force: kept.force });
    const rows = await db.rowTelemetry.findMany({ where: { simulated: false, strokes: { gte: 40 } }, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, userId: true, participantId: true, data: true } });
    const byRower = new Map<string, number[][]>();
    let counted = 0;
    for (const r of rows) {
      const curves = (r.data as { forceCurves?: TelemetryCurve[] } | null)?.forceCurves;
      if (!Array.isArray(curves) || curves.length < 12) continue;
      /* The first strokes and the last are the flywheel and the finish. */
      const avg = averageForceCurve(curves.slice(3, -2));
      if (!avg || !(avg.peakLbf > 0)) continue;
      const who = r.userId ?? r.participantId ?? r.id;
      const list = byRower.get(who) ?? [];
      list.push(avg.points.map((v) => Math.max(0, v) / avg.peakLbf));
      byRower.set(who, list);
      counted++;
    }
    let force: Field | null = null;
    if (byRower.size) {
      const mean = (lines: number[][]) => lines[0].map((_, i) => lines.reduce((sum, l) => sum + l[i], 0) / lines.length);
      const all = mean([...byRower.values()].map(mean));
      const top = Math.max(...all) || 1;
      const points = all.map((v) => Math.round((v / top) * 1000) / 1000);
      const at = points.indexOf(Math.max(...points));
      force = { points, peakPct: Math.round((at / (points.length - 1)) * 100), rows: counted, rowers: byRower.size };
    }
    kept = { at: Date.now(), force };
    return yes({ force });
  } catch (err) {
    console.error("row app: failed to build the field's force curve", err);
    return no("That could not be read just now.", 500);
  }
}
