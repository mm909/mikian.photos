"use client";

import { useState, type ReactNode } from "react";
import { Boards, type BlackoutProp, type BoardsProp, type Tab } from "../Boards";

/* FIND A ROWER ON THE BOARD (owner, 2026-09-25: "I want to be able to
 * search for a rower on this page. Not ugly: a search field on the far
 * right of the ALL / MEN'S / WOMEN'S line").
 *
 * The division chips are the page's own links, rendered on the server and
 * handed in as `chips`; this wraps them in the chips line, adds the field
 * at its far right, and draws the board under it with whatever is typed.
 * It exists because the chips line and the board have to share one piece
 * of state — the query — and the page is a server component: the field is
 * a plain input, no button, in the house mono caps with a dotted rule for
 * a baseline (recordsCss.ts .rec-find). Typing narrows the board as you go
 * (Boards.tsx `query`); clearing it brings the whole board back. Nothing
 * navigates, so the tap line (NavProgress.tsx) never runs for it.
 *
 * The other four records have no board to narrow and draw the chips line
 * without this. */
export function BoardFind({
  chips,
  boards,
  started,
  blackout,
  tab,
  movement,
  statsHref,
}: {
  chips: ReactNode;
  boards: BoardsProp;
  started: boolean;
  blackout: BlackoutProp;
  tab: Tab;
  movement: boolean;
  statsHref: string;
}) {
  const [q, setQ] = useState("");
  return (
    <>
      <nav className="tabs rec-div" aria-label="Division">
        {chips}
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
      </nav>
      <Boards boards={boards} started={started} blackout={blackout} head={false} tab={tab} movement={movement} statsHref={statsHref} query={q} />
    </>
  );
}
