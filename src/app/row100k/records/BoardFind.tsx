"use client";

import { useState, type ReactNode } from "react";

/* FIND A ROWER ON THE FULL RANKINGS (owner, 2026-09-25: "I want to be able
 * to search for a rower on this page. Not ugly"; the same day: "search on
 * ALL the categories, not just total meters").
 *
 * One field, one piece of state — the query — and whatever table sits
 * under it gets the query through the render child. The field is a plain
 * input, no button, in the house mono caps with a dotted rule for a
 * baseline (recordsCss.ts .rec-find), on the far right of its own line
 * over the table; on a phone it runs the measure. Typing narrows the table
 * as you go (Boards.tsx `query`, or the flat rankings in
 * RecordsShell.tsx); clearing it brings the whole table back. Nothing
 * navigates, so the tap line (NavProgress.tsx) never runs for it.
 *
 * The field stays mounted while the category, the bracket or the month
 * swap under it (RecordsShell.tsx), so what was typed carries across: a
 * rower found on TOTAL METERS is still found on FASTEST 5K. */
export function BoardFind({ children }: { children: (query: string) => ReactNode }) {
  const [q, setQ] = useState("");
  return (
    <>
      <div className="rec-findline">
        <input
          className="rec-find"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a rower"
          aria-label="Find a rower by number or name"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
        />
      </div>
      {children(q)}
    </>
  );
}
