import type { ReactNode } from "react";
import { metersText, tokensFor, type Token } from "@/components/home/digits";

/* THE HEAD of the board, the stats and the feed (owner, 2026-09-16: no bold
 * THE BOARD / THE STATS / THE FEED; the number in the same large meters
 * font as the front page, not incrementing). The number is the front page
 * odometer as a signed-in rower gets it (Dashboard.tsx .my-od): cells with
 * commas, leading zeros dimmed, Archivo Black in water blue, static. Board
 * and stats print the community total; the feed prints what landed today,
 * and dims every zero when today could not be read.
 *
 * Three variants were offered on the live site; the owner picked A for all
 * three tabs (2026-09-16: header a's for all of the tabs), so this is the
 * only one now: one gray mono dateline with the page name folded in, the
 * number, the unit, an optional sub line. The name is never Archivo Black.
 * The h1 is the page name. Server component, no hooks; styles in
 * headCss.ts. */

export function PageHead({
  name,
  dateline,
  meters,
  unit,
  sub,
  digits = 8,
  wide = false,
}: {
  /* "The board" — sentence case; the CSS sets the caps. */
  name: string;
  /* "SEP 16 · DAY 16 OF 30" — the page's own dateline, as it computes it. */
  dateline: ReactNode;
  /* Null when the figure could not be read: every zero dimmed. */
  meters: number | null;
  /* The unit line, the front page way: Meters · <b>everyone together</b>. */
  unit: ReactNode;
  /* An optional second mono line under the unit (the feed's rows/rowers). */
  sub?: string;
  /* How many wheels the odometer pads to. Eight is the landing counter
   * (board, stats: a month of everyone). The feed passes six (owner,
   * 2026-09-16: remove the million and ten million digits on the feed
   * page) — a day over 999,999 m simply grows to seven cells. Sized in
   * headCss.ts by the .ph-6 / default rules. */
  digits?: number;
  /* The front measure (.wrap.front, 1040): the odometer may reach 160px. */
  wide?: boolean;
}) {
  // Unreadable is all zeros, all dimmed — tokensFor keeps a lone zero lit
  // as the number zero, which this is not.
  const tokens: Token[] =
    meters === null
      ? tokensFor(metersText(0, digits)).map((t) => ({ ...t, lead: true }))
      : tokensFor(metersText(meters, digits));
  const label = meters === null ? "meters not available" : `${meters.toLocaleString("en-US")} meters`;

  return (
    <header className={`ph ph-${digits}${wide ? " ph-wide" : ""}`}>
      {/* A page with no name (owner, 2026-09-24: no THE BOARD, no THE
        * STATS) heads with its dateline alone. */}
      <div className="ph-line">
        {name ? <h1>{name}</h1> : <h1>{dateline}</h1>}
        {name ? <span> · {dateline}</span> : null}
      </div>

      <div className="ph-od">
        <div className="my-od" role="img" aria-label={label}>
          {tokens.map((t, i) => (
            <span key={i} className={`${t.sep ? "sep" : "cell"}${t.lead ? " lead" : ""}`} aria-hidden="true">
              {t.ch}
            </span>
          ))}
        </div>
      </div>
      <p className="my-unit mono">{unit}</p>
      {sub && <p className="ph-sub">{sub}</p>}
    </header>
  );
}
