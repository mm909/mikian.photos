"use client";

import { useCallback, useState } from "react";
import { categoryLabel, dayOf, shortDay, type HyroxEvent } from "../events";
import type { MyEntry } from "./EntryForm";
import { StickerFrame } from "./StickerFrame";
import { entryCard, placeCard, type EntryFacts, type Fonts, type Look } from "./stickerPaint";

/* THE ENTRY STICKER (owner, 2026-10-13: "a little sticker shareable that
 * says like Las Vegas Hyrox 2027 or just 27, something like that. With
 * their name and their partner's name and their day. Eventually, when
 * start times are announced, we'll have a sticker for their start time
 * as well").
 *
 * Two cards on the shared frame (StickerFrame.tsx; the painters are in
 * stickerPaint.ts): THE RACE — city, year, category, day, the names —
 * and START, the same block with the start time huge, once the entry
 * carries one. */

export type StickerFacts = EntryFacts;

/* The facts a rower's entry hands the card. */
export function entryFacts(ev: HyroxEvent, e: MyEntry): EntryFacts {
  const d = dayOf(ev, e.day);
  return {
    city: ev.city,
    year: ev.year,
    slug: ev.slug,
    category: categoryLabel(e),
    day: d ? shortDay(d) : e.day,
    name: e.name,
    partners: e.partners.map((p) => p.name),
    startTime: e.startTime,
  };
}

type Card = "race" | "start";

export function Sticker({ facts }: { facts: StickerFacts }) {
  const [card, setCard] = useState<Card>("race");

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, draw: boolean): number => placeCard(ctx, fonts, look, draw, null, entryCard(facts, card)),
    [facts, card],
  );

  return (
    <StickerFrame
      paint={paint}
      filename={(look) => `hyrox-${facts.slug}-${card}-${look}.png`}
      label="Your Hyrox sticker"
      pickers={
        facts.startTime ? (
          <div className="hx-stk-pick" role="group" aria-label="Card">
            <button type="button" aria-pressed={card === "race"} onClick={() => setCard("race")}>
              The race
            </button>
            <button type="button" aria-pressed={card === "start"} onClick={() => setCard("start")}>
              Start time
            </button>
          </div>
        ) : null
      }
    />
  );
}
