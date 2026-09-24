import type { ReactNode } from "react";
import { fmtDay, fmtRowerNumber } from "@/lib/row100k";

/* THE LEADER OF A STAT, as one block: the value big and blue, the holder
 * on the mono line, and — for a pace record — the split as a figure of
 * its own under it. The stats page stat block and the head of every
 * full-ranking page draw the same person the same way (owner,
 * 2026-09-24: "the header of the records page should be the current
 * leader for the category, like the stats page's stat block: for fastest
 * 10K — the time, who did it, what their pace was, when they did it").
 *
 * A plain component — no hooks, no client directive — so the stats page
 * (a client component, Stats.tsx) and the records page (a server
 * component) can both render it. The value and the pace arrive as nodes,
 * already masked by the caller: a hidden meters total comes in as Blocks,
 * a time as text (times are public for everyone, owner 2026-09-08), so
 * nothing here decides what a viewer may see. Styles: leadCss.ts, on top
 * of the .bhead / .st-rec rules in theme.ts. */
export function LeadBlock({
  value,
  holder,
  label,
  day,
  sessions,
  pace,
  paceInline = false,
}: {
  /* The big figure, unit included (a small grey .u for meters). */
  value: ReactNode;
  /* Who holds it: number and name, the name a link to their profile. */
  holder?: { rowerNumber: number; name: string };
  /* With no holder, the bold word on the line instead — LIGHTS OUT while
   * the elite are hidden and nobody leads TOTAL METERS. */
  label?: string;
  /* When it was set (a record), YYYY-MM-DD. */
  day?: string;
  /* How many rows it took (TOTAL METERS). */
  sessions?: number;
  /* The /500 m split for a 5k or 10k, as text or blocks — its own figure,
   * not a suffix on the time (owner, 2026-09-24: "remove the /500m on the
   * time; just say their time and then their pace"). */
  pace?: ReactNode;
  /* The pace ON the holder line instead — "042 · NADIA DUVAL · NOV 30 ·
   * 1:35.4 PACE" — so the block is the same height whichever stat is up
   * (owner, 2026-09-25: "when I select fastest 5K the PACE figure appears
   * below and the UI jumps. I still want to see the pace, but no jump").
   * The stats page sets it; the full-ranking pages keep the figure. */
  paceInline?: boolean;
}) {
  const tail = [day ? fmtDay(day) : null, sessions != null ? `${sessions} sessions` : null]
    .filter(Boolean)
    .map((s) => ` · ${s}`)
    .join("");
  return (
    <div className="bhead st-rec lead">
      <div className="bhead-n">{value}</div>
      <p className="bhead-l mono">
        {holder ? (
          <>
            {fmtRowerNumber(holder.rowerNumber)} ·{" "}
            <b>
              <a href={`/row100k/r/${holder.rowerNumber}`}>{holder.name}</a>
            </b>
          </>
        ) : (
          <b>{label}</b>
        )}
        {tail}
        {paceInline && pace != null ? (
          <>
            {" · "}
            <span className="lead-pace-in">{pace} pace</span>
          </>
        ) : null}
      </p>
      {!paceInline && pace != null && (
        <div className="lead-pace">
          <span className="n">{pace}</span>
          <span className="l mono">Pace</span>
        </div>
      )}
    </div>
  );
}
