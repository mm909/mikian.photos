"use client";

import type { CSSProperties } from "react";
import { fmtClock } from "../analysis/fmt";
import { KdeScrub } from "./KdeScrub";
import type { DistanceKde } from "./distances";

/* THE 5K AND THE 10K (owner ask, 2026-09-11): one chart per distance, two
 * density curves on one axis of TIME — the field in ink, the viewer in blue
 * — under the two densities that were already here. Built by
 * stats/distances.ts; this only lays it out, in the same quiet .st-kde
 * frame as the length and split densities (a mono title, a dashed hairline,
 * no 2px box) so the four read as one family.
 *
 * `mine` is the profile: only the distances this rower has actually rowed,
 * and their own curve over the field's. Off, it is the stats page's
 * field-only version — every distance the field has enough of, nobody
 * singled out. The profile now drops the untouched distances server-side,
 * where they cost nothing to serialise (r/[num]/page.tsx), so the filter
 * below is a guard rather than the thing doing the work.
 *
 * THE SCRUB (owner, 2026-09-24: "the 5K and 10K time distributions must be
 * interactable like the split-per-500 and length-of-every-row ones"): the
 * same KdeScrub the two densities above wear, in its `time` kind — a
 * finger, the mouse or the arrow keys read a time and its share of the
 * field off the curve. The worry that kept the scrub off before (a chart
 * carrying two curves, a readout that could answer about the wrong one) is
 * met in the readout itself: it says OF THE FIELD, and the field curve is
 * the one it integrates. */

const ENDS: [string, string] = ["← FASTER", "SLOWER →"];

/* mm:ss all the way up (fmtClock), so a slow 10k reads 1:08:00 as 68:00 —
 * the way a rower says it, and narrow enough that the tick sitting on the
 * right edge of the frame is not cut in half by the margin. */
const FMT = fmtClock;

/* The foot line. Inline rather than a theme class on purpose: two other
 * workflows are editing this tree tonight and theme.ts is shared ground. */
const FOOT: CSSProperties = {
  fontFamily: "var(--row-mono), monospace",
  fontSize: 10,
  letterSpacing: "0.06em",
  lineHeight: 1.7,
  color: "var(--gray)",
  textTransform: "uppercase",
  marginTop: 6,
};

/* THE FIGURES, IN WORDS, for the accessible label. The scrub speaks its
 * readout through role slider and aria-valuetext, but the MED / YOU / BEST
 * tags live inside the SVG where a screen reader cannot reach them, so the
 * label says what the marks say. */
function figures(d: DistanceKde, you: DistanceKde["you"]): string {
  const field = `field median ${FMT(d.field.median)} over ${d.fieldN} attempts by ${d.fieldRowers} rowers`;
  if (!you) return field;
  const best = Number.isFinite(you.best) ? `, best ${FMT(you.best)}` : "";
  return `${field}; your median ${FMT(you.median)}${best} over ${d.youN} attempts`;
}

export function DistanceKdes({ charts, mine = false }: { charts: DistanceKde[]; mine?: boolean }) {
  const shown = mine ? charts.filter((d) => d.youN > 0) : charts;
  if (!shown.length) return null;
  return (
    <>
      {shown.map((d) => {
        const you = mine ? d.you : null;
        /* Each curve is scaled to its own peak — that is what lets a rower
         * with four attempts show up against a field of a hundred — and the
         * chart no longer explains itself in a sentence (owner, 2026-09-11).
         * Under three attempts there is no second curve — say so, rather
         * than let a reader hunt for a blue hill that was never drawn. */
        const marksOnly =
          you && !you.ys
            ? ` · YOUR ${d.youN === 1 ? "ONE ATTEMPT IS A MARK" : `${d.youN} ATTEMPTS ARE MARKS`}, NOT A CURVE`
            : "";
        return (
          <div className="st-kde" key={d.meters}>
            <div className="t">
              {d.label} times · {mine ? "everyone in grey, you in blue" : "everyone who has rowed one"}
            </div>
            <KdeScrub
              c={d.field}
              you={you}
              kind="time"
              fmt={FMT}
              ends={ENDS}
              label={`Kernel density of ${d.label} times across every rower who has rowed one${
                you ? ", with this rower's own attempts over it" : ""
              } — ${figures(d, you)}`}
            />
            <div style={FOOT}>
              {d.take}
              {marksOnly}
            </div>
          </div>
        );
      })}
    </>
  );
}
