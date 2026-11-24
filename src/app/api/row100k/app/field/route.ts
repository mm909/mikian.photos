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
 * WHO ROWED IT (owner, 2026-11-23: "For the rate and length graph, the
 * comparison against everyone else, there's only 1 dot on there ... we
 * should have enough data because we have all the data. We have all the
 * race day data"). The field used to put a recording to `userId` first,
 * and `userId` is the account that SAVED it: every piece rowed on race day
 * was saved from the console on the owner's laptop, so the whole race day
 * was one rower, the owner, and one dot. And it read only the newest 80
 * recordings, most of them his. Now a recording is the rower's who was on
 * the erg: the Rowtember rower it was filed against (the account behind
 * that rower when there is one, so a rower's phone rows and race-day rows
 * are one rower); a console piece with nobody named on the erg is its own
 * rower, because who sat on it was not written down (MINE: the owner's own
 * unnamed console pieces count the same way). The newest few of each
 * rower's recordings are read, up to a cap, so forty rows from one rower
 * do not crowd out the rest.
 *
 * Nobody's own curve or name is in the answer. Wears the app's erg gate,
 * as the recordings do. Worked out at most once in half an hour on a
 * server: it reads every recording, and it moves slowly. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Field = { points: number[]; peakPct: number; rows: number; rowers: number };
let kept: { at: number; force: Field | null; stats: FieldStats | null } | null = null;
/* Not kept at all off the live site: a sandbox that has just been seeded
 * shows the field it has now. */
const KEEP_MS = process.env.NODE_ENV === "production" ? 30 * 60_000 : 0;
/* How many recordings are looked at to find the rowers (no strokes read:
 * the id and who), how many of one rower's are measured, and how many in
 * all. Each measured one is a whole row of strokes. */
const SCAN = 4000;
const PER_ROWER = 6;
const TAKE = 320;
/* Read in handfuls, so the server never holds every recording at once. */
const CHUNK = 40;

export async function GET() {
  const viewer = await ergViewer();
  const denied = ergAppDenial(viewer);
  if (denied) return no(denied.error, denied.status);
  try {
    if (kept && Date.now() - kept.at < KEEP_MS) return yes({ force: kept.force, stats: kept.stats });
    const light = await db.rowTelemetry.findMany({ where: { simulated: false, strokes: { gte: 40 } }, orderBy: { createdAt: "desc" }, take: SCAN, select: { id: true, participantId: true } });

    /* The account behind each Rowtember rower, where there is one. */
    const pids = [...new Set(light.map((r) => r.participantId).filter((p): p is string => !!p))];
    const account = new Map<string, string | null>();
    for (let i = 0; i < pids.length; i += 500) {
      const ps = await db.rowParticipant.findMany({ where: { id: { in: pids.slice(i, i + 500) } }, select: { id: true, userId: true } });
      for (const p of ps) account.set(p.id, p.userId);
    }
    const whoOf = (r: { id: string; participantId: string | null }) => {
      if (!r.participantId) return `piece:${r.id}`;
      const u = account.get(r.participantId);
      return u ? `user:${u}` : `rower:${r.participantId}`;
    };

    /* Newest first, the newest PER_ROWER of each rower, TAKE in all. */
    const per = new Map<string, number>();
    const picked: { id: string; who: string }[] = [];
    for (const r of light) {
      if (picked.length >= TAKE) break;
      const who = whoOf(r);
      const k = per.get(who) ?? 0;
      if (k >= PER_ROWER) continue;
      per.set(who, k + 1);
      picked.push({ id: r.id, who });
    }
    const whose = new Map(picked.map((p) => [p.id, p.who]));

    const byRower = new Map<string, number[][]>();
    const measured = new Map<string, RowMeasure[]>();
    let counted = 0;
    for (let i = 0; i < picked.length; i += CHUNK) {
      const rows = await db.rowTelemetry.findMany({ where: { id: { in: picked.slice(i, i + CHUNK).map((p) => p.id) } }, select: { id: true, data: true } });
      for (const r of rows) {
        const rower = whose.get(r.id) ?? `piece:${r.id}`;
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
        const list = byRower.get(rower) ?? [];
        list.push(avg.points.map((v) => Math.max(0, v) / avg.peakLbf));
        byRower.set(rower, list);
        counted++;
      }
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
