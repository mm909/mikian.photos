"use client";

import { createContext, useContext, type ReactNode } from "react";
import { paletteCss, paletteOf, type Palette } from "@/lib/rowPalette";
import type { Look } from "@/lib/rowSettings";

/* What every /row100k page inherits from the segment layout (owner,
 * 2026-09-16): the LOOK the site wears, the PALETTE (2026-09-30) and which
 * share cards are switched off. A client context so the share dialog — a
 * client component fed by a dozen different server pages — can read the
 * card switches without every one of those pages threading them through
 * its own props.
 *
 * The wrapper div carries the look as a class the stylesheet keys on
 * (theme.ts: `.row-ink .row100k{...}`) and as a data attribute for
 * anything that wants to read it off the DOM. Paper adds nothing at all,
 * so a page under the default look renders byte-for-byte what it did
 * before the layout existed.
 *
 * THE PALETTE is one style tag ahead of the page (rowPalette.ts
 * paletteCss): the preset's accent on paper into --water, --water-hover
 * and --water-pale on the .row100k root, keyed off the data attribute so it
 * outranks the theme's own root rule wherever the page's style tag lands.
 * The ink look keeps its monochrome white (theme.ts, higher specificity). */

type Site = { look: Look; palette: Palette; cardsOff: readonly string[] };

const Ctx = createContext<Site>({ look: "paper", palette: paletteOf("paper-water"), cardsOff: [] });

export function RowSite({ look, palette, cardsOff, children }: Site & { children: ReactNode }) {
  return (
    <Ctx.Provider value={{ look, palette, cardsOff }}>
      <div className={look === "ink" ? "row-ink" : undefined} data-look={look} data-palette={palette.id}>
        <style>{paletteCss(palette)}</style>
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
