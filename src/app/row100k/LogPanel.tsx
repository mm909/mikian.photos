"use client";

import { useEffect, useState } from "react";
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
  phase,
  earlyAdmin,
  simulate,
}: {
  data: ShareData;
  rows: MyRow[];
  defaultDay: string;
  phase: "before" | "open" | "closed";
  /* Challenge admin logging before Sep 1 — the form is open for test rows. */
  earlyAdmin?: boolean;
  simulate?: boolean;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRow, setShareRow] = useState<{ day: string; meters: number; seconds: number } | null>(
    null,
  );
  // The dialog opens the instant a row is saved — before router.refresh()
  // lands — so the just-logged meters are folded in locally. Once the server
  // props catch up (data.meters changes), the fold-in is retired.
  const [boosted, setBoosted] = useState<ShareData | null>(null);
  useEffect(() => {
    setBoosted(null);
  }, [data.meters]);

  const onLogged = (entry: { day: string; meters: number; seconds: number }) => {
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
      };
    });
    setShareRow(entry);
    setShareOpen(true);
  };

  const shareOne = (r: MyRow) => {
    setShareRow({ day: r.day, meters: r.meters, seconds: r.seconds });
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
          <div className="panel">
            <LogRow
              defaultDay={defaultDay}
              phase={phase}
              earlyAdmin={earlyAdmin}
              simulate={simulate}
              onLogged={onLogged}
            />
          </div>
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
