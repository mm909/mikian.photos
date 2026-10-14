"use client";

import { useCallback, useState } from "react";
import { categoryLabel, dayOf, type HyroxEvent } from "../events";
import type { MyEntry } from "./EntryForm";
import { entryFacts } from "./Sticker";
import { StickerFrame } from "./StickerFrame";
import { daysCard, entryCard, placeCard, signUpCard, titleCard, type Fonts, type Look } from "./stickerPaint";

/* THE STICKERS PANEL, under the facts, for anyone (owner, 2026-10-14:
 * "add a sticker that is just the Hyrox, Las Vegas 27 part ... also a x
 * days away sticker"). DAYS AWAY, THE MARK, SIGN UP (LET US KNOW YOU'RE
 * RACING — the one filler worth having), and, for a rower who is on the
 * board, each of their races (same day: "when I click stickers and I've
 * already signed up, I should also get the option to select my bib").
 * Every card at its own height, in the four looks. */

type Card = { id: string; label: string; paint: ReturnType<typeof titleCard> };

export function EventStickers({ ev, mine }: { ev: HyroxEvent; mine: MyEntry[] }) {
  const [open, setOpen] = useState(false);
  const cards: Card[] = [
    { id: "days", label: "Days away", paint: daysCard(ev) },
    { id: "mark", label: "The mark", paint: titleCard(ev.city, ev.year) },
    { id: "signup", label: "Sign up", paint: signUpCard(ev) },
    ...mine.map((e) => ({
      id: `race-${e.id}`,
      label: mine.length === 1 ? "My race" : `${categoryLabel(e)} · ${dayOf(ev, e.day)?.dow ?? e.day}`,
      paint: entryCard(entryFacts(ev, e), "race"),
    })),
  ];
  const [cardId, setCardId] = useState(mine.length > 0 ? `race-${mine[0].id}` : "days");
  const card = cards.find((c) => c.id === cardId) ?? cards[0];

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, draw: boolean): number => placeCard(ctx, fonts, look, draw, null, card.paint),
    [card],
  );

  if (!open) {
    return (
      <button type="button" className="hx-cta quiet" onClick={() => setOpen(true)}>
        Stickers →
      </button>
    );
  }

  return (
    <StickerFrame
      paint={paint}
      filename={(look) => `hyrox-${ev.slug}-${card.id}-${look}.png`}
      label="Event sticker"
      pickers={
        <div className="hx-stk-pick" role="group" aria-label="Card">
          {cards.map((c) => (
            <button key={c.id} type="button" aria-pressed={card.id === c.id} onClick={() => setCardId(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
