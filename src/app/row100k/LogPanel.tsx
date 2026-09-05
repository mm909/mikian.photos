"use client";

import { useEffect, useState } from "react";
import type { SanityBand } from "@/lib/row100k";
import { LogRow } from "./LogRow";
import { MyRows, type MyRow } from "./MyRows";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* The logging station on a rower's own profile page: the "Log a row" section
 * followed by "The log" — the same table visitors see, except every row here
 * carries share / edit / delete. Logging a row pops the share dialog on the
 * single-row card — that's the moment someone wants to post. */
export function LogPanel({
  data,
  rows,
  defaultDay,
  defaultTitle,
  phase,
  earlyAdmin,
  simulate,
  sanity,
}: {
  data: ShareData;
  rows: MyRow[];
  /* Pacific today clamped into September (the profile page computes it). */
  defaultDay: string;
  /* Prefill for the title field — "Rowtember #<next session number>". */
  defaultTitle?: string;
  phase: "before" | "open" | "closed";
  /* Challenge admin logging before Sep 1 — the form is open for test rows. */
  earlyAdmin?: boolean;
  simulate?: boolean;
  /* The plausibility band for the second-look strip (sanity.ts); the form
     uses its rowing-club defaults when a caller (the preview) has none. */
  sanity?: SanityBand;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRow, setShareRow] = useState<{
    day: string;
    meters: number;
    seconds: number;
    title?: string;
  } | null>(null);
  // The dialog opens the instant a row is saved — before router.refresh()
  // lands — so the just-logged meters are folded in locally. Once the server
  // props catch up (data.meters changes), the fold-in is retired.
  const [boosted, setBoosted] = useState<ShareData | null>(null);
  useEffect(() => {
    setBoosted(null);
  }, [data.meters]);

  const onLogged = (entry: { day: string; meters: number; seconds: number; title?: string }) => {
    // Fold into the previous fold-in, not the props — a second quick log
    // before the first refresh lands must keep both rows on the card.
    setBoosted((prev) => {
      const base = prev ?? data;
      return {
        ...base,
        meters: base.meters + entry.meters,
        sessions: base.sessions + 1,
        byDay: { ...base.byDay, [entry.day]: (base.byDay[entry.day] ?? 0) + entry.meters },
        // The profile card shows LONGEST ROW — a first-ever log would read
        // "0" next to real meters until the refresh lands without this.
        longest: Math.max(base.longest ?? 0, entry.meters),
        // A hidden rower's block count follows a digit boundary (99,999 →
        // 100,000) before the refresh lands.
        digits: base.masked ? String(base.meters + entry.meters).length : base.digits,
      };
    });
    setShareRow(entry);
    setShareOpen(true);
  };

  const shareOne = (r: MyRow) => {
    setShareRow({ day: r.day, meters: r.meters, seconds: r.seconds, title: r.title });
    setShareOpen(true);
  };

  const shareTotals = () => {
    setShareRow(null);
    setShareOpen(true);
  };

  return (
    <>
      <section id="log">
        <div className="wrap">
          <div className="sec-head">
            <h2>Log a row</h2>
            <span className="mono">
              {earlyAdmin
                ? "ADMIN — OPEN EARLY FOR TESTING"
                : phase === "open"
                  ? "EVERY SESSION COUNTS"
                  : phase === "before"
                    ? "OPENS SEP 1"
                    : "SEPTEMBER'S WRAPPED"}
            </span>
          </div>
          {/* No panel box around the form any more — LogRow brings its own
              flat chrome (owner call, 2026-09-05). */}
          <LogRow
            defaultDay={defaultDay}
            defaultTitle={defaultTitle}
            phase={phase}
            earlyAdmin={earlyAdmin}
            simulate={simulate}
            sanity={sanity}
            onLogged={onLogged}
          />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The log</h2>
            <button type="button" className="quiet-btn" onClick={shareTotals}>
              SHARE A CARD
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="board-empty">NOTHING LOGGED YET.</p>
          ) : (
            <MyRows rows={rows} canEdit={phase !== "closed"} onShare={shareOne} />
          )}
        </div>
      </section>

      <ShareDialog
        data={{ ...(boosted ?? data), row: shareRow }}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        preferredCardId={shareRow ? "rowtember-row" : undefined}
      />
    </>
  );
}
