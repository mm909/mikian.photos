"use client";

import { useState, type KeyboardEvent as ReactKeyEvent, type ReactNode } from "react";

/* FIND A ROWER ON THE FULL RANKINGS (owner, 2026-09-25: "I want to be able
 * to search for a rower on this page. Not ugly"; the same day: "search on
 * ALL the categories, not just total meters"; and that evening: "the FIND
 * A ROWER field looks out of place. Make the NAME the search: click on the
 * name and search a rower from there").
 *
 * So there is no field over the table any more. The ROWER column head IS
 * the control: the word as the head prints it — mono caps, grey — on a
 * dotted rule, the rule every word that opens something wears (.tm-btn).
 * A tap turns the head into the search input in place, focused, in the
 * same type; Escape, or clearing what was typed, puts the word back. The
 * table narrows as you type (Boards.tsx `query`, or the flat rankings and
 * the period boards in RecordsShell.tsx); nothing navigates, so the tap
 * line (NavProgress.tsx) never runs for it.
 *
 * One piece of state — the query — held here so it stays put while the
 * category, the bracket or the month swap under it (RecordsShell.tsx): a
 * rower found on TOTAL METERS is still found on FASTEST 5K. The render
 * child gets the query and the head node, and puts the head in whichever
 * table it draws. */
export function BoardFind({ children }: { children: (query: string, head: ReactNode) => ReactNode }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const close = () => {
    setQ("");
    setOpen(false);
  };

  const onKey = (ev: ReactKeyEvent<HTMLInputElement>) => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    close();
  };

  const head = open ? (
    <input
      className="rec-find"
      type="text"
      value={q}
      onChange={(e) => {
        const v = e.target.value;
        setQ(v);
        /* Clearing restores the head (owner, 2026-09-25). */
        if (v === "") setOpen(false);
      }}
      onKeyDown={onKey}
      onBlur={() => {
        if (q === "") setOpen(false);
      }}
      placeholder="Find a rower"
      aria-label="Find a rower by number or name"
      autoFocus
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="search"
    />
  ) : (
    <button type="button" className="rec-find-w" aria-label="Find a rower by number or name" onClick={() => setOpen(true)}>
      Rower
    </button>
  );

  return <>{children(q, head)}</>;
}
