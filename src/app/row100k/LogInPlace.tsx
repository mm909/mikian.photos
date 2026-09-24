"use client";

import { useCallback, useEffect, useState } from "react";
import { FIRST_DAY, type SanityBand } from "@/lib/row100k";
import { LogRow } from "./LogRow";
import { OptIn } from "./OptIn";
import { useCardsOff } from "./RowSite";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* LOG A ROW, on the front page, in place. The owner's complaint
 * (2026-09-05): tapping LOG A ROW was a full navigation to the profile
 * page — every photo presigned before the browser could even scroll to the
 * form. Now the button opens the form right under itself; the SHARE button
 * on the right opens the card dialog. Logging a row still refreshes the
 * server props (LogRow does that), and the share dialog pops on the
 * single-row card the moment the save lands — the same fold-in LogPanel
 * does on the dev preview, so the card shows the new meters before the refresh
 * catches up. Right after joining, the bib card pops instead (JoinPanel
 * leaves the one-shot sessionStorage note). */

/* Scroll the LOG A ROW word (the #log element, whose top edge is the word)
 * under the sticky bar. The bar is one row on desktop and two on a phone
 * (taller still where the masthead wraps): measure it so the word lands
 * under its rule instead of behind it. Desktop stays at the 72 the inline
 * style starts from; a phone gets the bar's own height plus air. */
function scrollToForm() {
  window.requestAnimationFrame(() => {
    const el = document.getElementById("log");
    if (!el) return;
    const bar = document.querySelector(".row100k .bar");
    if (bar) el.style.scrollMarginTop = `${Math.round(bar.getBoundingClientRect().height) + 10}px`;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

export function LogInPlace({
  share,
  defaultDay = FIRST_DAY,
  defaultTitle,
  phase,
  earlyAdmin,
  simulate,
  sanity,
  justJoined,
  bare,
  noShare,
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
  /* The front page since 2026-09-24 (owner: LOG A ROW is the third cell of
   * the counter row, "opt in becomes log a row"): no act row of its own —
   * the form seam and the share dialog stay, opened by the row100k:log,
   * row100k:log-toggle and row100k:share events from wherever the page put
   * the words. Since 2026-09-25 the page mounts this UNDER the counter row
   * (owner: the form "should open BELOW the cells bar"). */
  bare?: boolean;
  /* The profile since 2026-09-25 (owner: "move the SHARE button onto the
   * same line as the DECEMBER 2026 date selection"): the act row keeps LOG
   * A ROW and drops its SHARE word — the dateline's SHARE (looks/ShareWord)
   * asks for the dialog by the row100k:share event instead. */
  noShare?: boolean;
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

  // The bib is switched off by default (owner, 2026-09-16), so the card that
  // pops after joining is the logo unless he switches the bib back on —
  // never the total, which reads 0 METERS to somebody who just joined.
  const off = useCardsOff();
  const joinedCard = off.includes("rowtember-bib") ? "rowtember-logo" : "rowtember-bib";

  useEffect(() => {
    try {
      if (justJoined || sessionStorage.getItem("row100k.justJoined") === "1") {
        sessionStorage.removeItem("row100k.justJoined");
        setShareRow(null);
        setPreferredCardId(joinedCard);
        setShareOpen(true);
      }
    } catch {
      /* storage blocked — no auto-open */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LOG A ROW is a toggle wherever the word is — the counter row's cell on
  // the front (LogCell.tsx, by event) and this component's own word on the
  // profile: the form opens under it and the same word closes it again
  // (owner, 2026-09-25: the arrow turns down while it is open "and back when
  // closed"). Opening scrolls the word under the sticky bar (owner, same
  // day, of the profile: clicking LOG A ROW "just moves my scroll and
  // doesn't open any menu. It should open the form, the arrow should tilt
  // down, and the scroll should put LOG A ROW at the top"); closing leaves
  // the page where it is.
  const toggleForm = useCallback(() => {
    if (phase === "closed") return;
    setOpen((v) => {
      if (!v) scrollToForm();
      return !v;
    });
  }, [phase]);

  // /row100k#log (the account menu's LOG A ROW) lands here with the form
  // already open — the browser scrolls to the id, this opens the seam. Also
  // answers a hash change on a page that is already up.
  useEffect(() => {
    const openNow = () => {
      if (phase === "closed") return;
      setOpen(true);
      scrollToForm();
    };
    const toggle = toggleForm;
    const openIfAsked = () => {
      if (window.location.hash === "#log") openNow();
    };
    openIfAsked();
    window.addEventListener("hashchange", openIfAsked);
    // The account menu's LOG A ROW on a page that is already up: a
    // same-page hash push fires no hashchange, so it sends this instead.
    window.addEventListener("row100k:log", openNow);
    window.addEventListener("row100k:log-toggle", toggle);
    // SHARE asked for from somewhere else on the page — the dialog is
    // here, so it is asked for by event. Nothing on the front page sends
    // it since 2026-09-25 (owner: "remove the SHARE word on this landing
    // page, everywhere"); the listener stays for any surface that does.
    const openShare = () => {
      setShareRow(null);
      setPreferredCardId(undefined);
      setShareOpen(true);
    };
    window.addEventListener("row100k:share", openShare);
    return () => {
      window.removeEventListener("hashchange", openIfAsked);
      window.removeEventListener("row100k:log", openNow);
      window.removeEventListener("row100k:log-toggle", toggle);
      window.removeEventListener("row100k:share", openShare);
    };
  }, [phase, toggleForm]);

  // The word that opens the form lives in another component (LogCell.tsx,
  // in the counter row) and turns its arrow with the form: it is told each
  // time the seam opens or closes.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent<boolean>("row100k:log-open", { detail: open && phase !== "closed" }));
  }, [open, phase]);

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
    <div className="front-act" id="log" style={{ scrollMarginTop: 72 }}>
      {bare ? null : (
        <div className="act-row front">
          {/* .open turns the arrow down while the form is open (the profile
              rule is in looks/profileCss.ts; the front page draws its own
              word in LogCell.tsx). The click is the same toggle the events
              reach, so it scrolls the word under the bar as it opens. */}
          {phase !== "closed" && (
            <OptIn className={open ? "open" : undefined} onClick={toggleForm}>
              Log a row
            </OptIn>
          )}
          {noShare ? null : (
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
          )}
        </div>
      )}

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
