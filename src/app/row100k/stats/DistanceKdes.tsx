import type { CSSProperties } from "react";
import { fmtClock } from "../analysis/fmt";
import { KdeSvg } from "../analysis/charts";
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
 * No scrub here, unlike the two above (KdeScrub): that readout names one
 * curve and one share of the field, and over a chart carrying two curves it
 * would quietly answer about the wrong one. The marks and the tags say what
 * this chart is for. */

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

/* THE FIGURES, IN WORDS, for the accessible label. The two densities above
 * these are scrubbable (KdeScrub) and speak their readout through role
 * slider and aria-valuetext; dropping the scrub here was right — it names
 * one curve, and this chart carries two — but it took the spoken numbers
 * with it, and the MED / YOU / BEST tags live inside the SVG where a screen
 * reader cannot reach them. So the label says what the marks say. */
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
        /* What the height means, said where it is true: with two curves the
         * point is that each peaks at its own 1, and with one it is still a
         * density and not a tally of rows. Either way the y axis is never a
         * count, and the chart should not let anyone think it is. */
        /* The height clause came off the foot (owner, 2026-09-11: "we can
         * remove the this curve is a density, not a count of rows"). Each
         * curve is still scaled to its own peak — that is what lets a
         * rower with four attempts show up against a field of a hundred —
         * the chart simply no longer explains itself in a sentence. */
        /* Under three attempts there is no second curve — say so, rather
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
            <KdeSvg
              c={d.field}
              you={you}
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
