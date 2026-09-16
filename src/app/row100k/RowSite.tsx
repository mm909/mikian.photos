"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Look } from "@/lib/rowSettings";

/* What every /row100k page inherits from the segment layout (owner,
 * 2026-09-16): the LOOK the site wears and which share cards are switched
 * off. A client context so the share dialog — a client component fed by a
 * dozen different server pages — can read the card switches without every
 * one of those pages threading them through its own props.
 *
 * The wrapper div carries the look as a class the stylesheet keys on
 * (theme.ts: `.row-ink .row100k{...}`) and as a data attribute for
 * anything that wants to read it off the DOM. Paper adds nothing at all,
 * so a page under the default look renders byte-for-byte what it did
 * before the layout existed. */

type Site = { look: Look; cardsOff: readonly string[] };

const Ctx = createContext<Site>({ look: "paper", cardsOff: [] });

export function RowSite({ look, cardsOff, children }: Site & { children: ReactNode }) {
  return (
    <Ctx.Provider value={{ look, cardsOff }}>
      <div className={look === "ink" ? "row-ink" : undefined} data-look={look}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useRowSite(): Site {
  return useContext(Ctx);
}

/* The card ids no picker may show. Empty outside the layout (a dev harness
 * rendering the dialog on its own), which is the permissive default. */
export function useCardsOff(): readonly string[] {
  return useContext(Ctx).cardsOff;
}
