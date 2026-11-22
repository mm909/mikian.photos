import { db } from "@/lib/db";
import { analyseSession, averageForceCurve } from "@/lib/pm5/analysis";
import { fieldOf, measureOf, type FieldStats, type RowMeasure } from "@/lib/pm5/craft";
import { validateTelemetryDoc, type TelemetryCurve } from "@/lib/pm5/session";
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
 * AND THE REST OF THE CARDS (owner, 2026-11-22: "for as many as we're able
 * to, let's create that second pane like we have for the force curve where
 * it compares us against other people"): `stats` is the same recordings
 * measured the way the phone measures the row it is showing
 * (lib/pm5/craft.ts): how steady, how it was paced, rate and length, where
 * the push peaks, the work in a stroke. One figure a rower, each list
 * sorted, so a card can say where this row stands and which way is better.
 * A recording that will not read is left out of it and nothing else.
 *
 * Nobody's own curve or name is in the answer. Wears the app's erg gate,
 * as the recordings do. Worked out at most once in half an hour on a
 * server: it reads every recording, and it moves slowly. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Field = { points: number[]; peakPct: number; rows: number; rowers: number };
let kept: { at: number; force: Field | null; stats: FieldStats | null } | null = null;
/* Not kept at all off the live site: a sandbox that has just been seeded
 * shows the field it has now. */
const KEEP_MS = process.env.NODE_ENV === "production" ? 30 * 60_000 : 0;
/* The newest recordings, at most this many: each is a whole row of strokes. */
const TAKE = 80;

export async function GET() {
  const viewer = await ergViewer();
  const denied = ergAppDenial(viewer);
  if (denied) return no(denied.error, denied.status);
  try {
    if (kept && Date.now() - kept.at < KEEP_MS) return yes({ force: kept.force, stats: kept.stats });
    const rows = await db.rowTelemetry.findMany({ where: { simulated: false, strokes: { gte: 40 } }, orderBy: { createdAt: "desc" }, take: TAKE, select: { id: true, userId: true, participantId: true, data: true } });
    const byRower = new Map<string, number[][]>();
    const measured = new Map<string, RowMeasure[]>();
    let counted = 0;
    for (const r of rows) {
      const rower = r.userId ?? r.participantId ?? r.id;
      try {
        const doc = validateTelemetryDoc(r.data);
        if (typeof doc !== "string") {
          const list = measured.get(rower) ?? [];
          list.push(measureOf(analyseSession({ doc, id: r.id, history: [], compare: null }), doc));
          measured.set(rower, list);
        }
      } catch {
        /* A recording that will not read is left out of the field. */
      }
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
    const stats = fieldOf([...measured.values()]);
    kept = { at: Date.now(), force, stats };
    return yes({ force, stats });
  } catch (err) {
    console.error("row app: failed to build the field's force curve", err);
    return no("That could not be read just now.", 500);
  }
}
