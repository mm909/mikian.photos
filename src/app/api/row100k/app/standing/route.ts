import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { CHALLENGE, nowMs } from "@/lib/row100k";
import { maskedIds, previewBlackout, viewOpts } from "@/lib/row100kViewer";
import { inPeriod, parsePeriod } from "@/lib/rowPeriod";
import { boardView } from "@/app/row100k/boardData";
import { buildDistanceKdes } from "@/app/row100k/stats/distances";
import { buildField, type FieldEntry } from "@/app/row100k/stats/field";
import { asRower, no, yes } from "../social";

/* THE SIGNED-IN ROWER OVER THE FIELD, for the phone app's stats tab (owner,
 * 2026-11-23: "can we do that swiping like the cards ... where this one
 * will show everyone's, but then if I swipe, maybe it can show mine
 * overlaid on it"). GET ?m=YYYY-MM | all, the same ?m= the stats take.
 *
 * The stats answer (/api/row100k/stats) is the field with nobody laid over
 * it, as the site's page is (owner, 2026-09-08). This is the other half and
 * nothing else: the rower's own marks, their own middle and best, and how
 * their average stands among the other rowers', for the length of a row,
 * its split, and each timed distance the stats draw. It is worked out by
 * the same lines over the same rows of the same period (stats/field.ts,
 * stats/distances.ts, with the same hidden set), so a curve from here sits
 * on the grid of the chart it is drawn over.
 *
 * Only the asker's own figures are in it, so lights out has nothing of
 * anybody else's to hide; the hidden set is passed along because the
 * builders ask for one. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const got = await asRower();
    if ("denied" in got) return got.denied;
    const { viewer, me } = got;
    const period = parsePeriod(new URL(req.url).searchParams.get("m") ?? undefined, nowMs());

    const hidden = new Set<string>();
    let hideAll = false;
    try {
      const view = await boardView({ ...viewOpts(viewer), period });
      for (const id of maskedIds(view.boards)) hidden.add(id);
    } catch (err) {
      console.error("row app standing: board unreadable for the mask", err);
      const blackout = previewBlackout(viewer, await activeBlackout());
      hideAll = blackout.active && !(viewer.isAdmin && !viewer.preview);
    }
    const isHidden = (id: string) => hidden.has(id) || (hideAll && id !== me.id);

    const [participants, rows] = await Promise.all([
      db.rowParticipant.findMany({ where: { challenge: CHALLENGE }, select: { id: true } }),
      db.rowEntry.findMany({ where: { challenge: CHALLENGE }, select: { participantId: true, day: true, meters: true, seconds: true } }),
    ]);
    const known = new Set(participants.map((p) => p.id));
    const entries: FieldEntry[] = rows.filter((e) => known.has(e.participantId) && inPeriod(e.day, period)).map((e) => ({ participantId: e.participantId, meters: e.meters, seconds: e.seconds }));

    const you = buildField(entries, { isHidden, meId: me.id }).you;
    const distances = buildDistanceKdes(entries, me.id, isHidden)
      .filter((d) => d.you)
      .map((d) => ({ meters: d.meters, you: d.you, youN: d.youN }));
    return yes({ period: period.key, you, distances });
  } catch (err) {
    console.error("row app standing: failed", err);
    return no("Your own rows could not be read just now.", 500);
  }
}
