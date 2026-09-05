"use client";

import { useEffect, useState } from "react";
import { FIRST_DAY, type SanityBand } from "@/lib/row100k";
import { LogRow } from "./LogRow";
import { OptIn } from "./OptIn";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* LOG A ROW, on the front page, in place. The owner's complaint
 * (2026-09-05): tapping LOG A ROW was a full navigation to the profile
 * page — every photo presigned before the browser could even scroll to the
 * form. Now the button opens the form right under itself; the SHARE button
 * on the right opens the card dialog. Logging a row still refreshes the
 * server props (LogRow does that), and the share dialog pops on the
 * single-row card the moment the save lands — the same fold-in LogPanel
 * does on the profile, so the card shows the new meters before the refresh
 * catches up. Right after joining, the bib card pops instead (JoinPanel
 * leaves the one-shot sessionStorage note). */
export function LogInPlace({
  share,
  defaultDay = FIRST_DAY,
  defaultTitle,
  phase,
  earlyAdmin,
  simulate,
  sanity,
  justJoined,
}: {
  share: ShareData;
  /* Today clamped into September, from the server; LogRow adopts the
   * browser's local date after mount, so the fallback only has to hydrate. */
  defaultDay?: string;
  defaultTitle?: string;
  phase: "before" | "open" | "closed";
  earlyAdmin?: boolean;
  simulate?: boolean;
  /* The did-you-mean-that band for LogRow (sanity.ts). */
  sanity?: SanityBand;
  /* Dev preview only: behave as if the join JUST happened. */
  justJoined?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [preferredCardId, setPreferredCardId] = useState<string | undefined>(undefined);
  const [shareRow, setShareRow] = useState<ShareData["row"]>(null);
  // Folded-in meters until the server props catch up (data.meters changes).
  const [boosted, setBoosted] = useState<ShareData | null>(null);
  useEffect(() => {
    setBoosted(null);
  }, [share.meters]);

  useEffect(() => {
    try {
      if (justJoined || sessionStorage.getItem("row100k.justJoined") === "1") {
        sessionStorage.removeItem("row100k.justJoined");
        setShareRow(null);
        setPreferredCardId("rowtember-bib");
        setShareOpen(true);
      }
    } catch {
      /* storage blocked — no auto-open */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogged = (entry: { day: string; meters: number; seconds: number; title?: string }) => {
    // Fold into the previous fold-in, not the props — a second quick log
    // before the first refresh lands must keep both rows on the card.
    setBoosted((prev) => {
      const base = prev ?? share;
      return {
        ...base,
        meters: base.meters + entry.meters,
        sessions: base.sessions + 1,
        byDay: { ...base.byDay, [entry.day]: (base.byDay[entry.day] ?? 0) + entry.meters },
        longest: Math.max(base.longest ?? 0, entry.meters),
        // A hidden rower's block count follows a digit boundary (99,999 →
        // 100,000) before the refresh lands.
        digits: base.masked ? String(base.meters + entry.meters).length : base.digits,
      };
    });
    setOpen(false);
    setShareRow(entry);
    setPreferredCardId("rowtember-row");
    setShareOpen(true);
  };

  return (
    <div className="front-act">
      <div className="act-row front">
        {phase !== "closed" && (
          <OptIn onClick={() => setOpen((v) => !v)}>Log a row</OptIn>
        )}
        <button
          type="button"
          className="front-share"
          onClick={() => {
            setShareRow(null);
            setPreferredCardId(undefined);
            setShareOpen(true);
          }}
        >
          Share
        </button>
      </div>

      {/* LogRow brings its own flat panel (no box) — this is just the seam. */}
      {open && phase !== "closed" && (
        <div className="front-log">
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
      )}

      <ShareDialog
        data={{ ...(boosted ?? share), row: shareRow }}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        preferredCardId={preferredCardId}
      />
    </div>
  );
}
