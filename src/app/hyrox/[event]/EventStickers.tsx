"use client";

import { useCallback, useState } from "react";
import type { HyroxEvent } from "../events";
import { StickerFrame } from "./StickerFrame";
import { INNER, PAD, fit, line, paintHeader, palette, type Fonts, type Look } from "./stickerPaint";

/* THE EVENT'S OWN STICKERS, for anyone (owner, 2026-10-14: "add a sticker
 * that is just the Hyrox, Las Vegas 27 part of the sticker ... also put
 * a x days away sticker"). Two cards on the shared frame: THE MARK —
 * HYROX, the city, the year in its box, nothing else — and DAYS AWAY,
 * the mark over the count to the first race day, huge. The count is
 * taken when the card paints, from the phone's own calendar, so a story
 * posted tonight says tonight's number. */

type Card = "mark" | "days";

/* Whole days from the viewer's today to the event's first day. */
function daysUntil(ev: HyroxEvent, now = new Date()): number {
  const [y, m, d] = ev.days[0].date.split("-").map(Number);
  const first = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((first - today) / 86_400_000);
}

export function EventStickers({ ev }: { ev: HyroxEvent }) {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<Card>("days");

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, draw: boolean): number => {
      const { ink, dim } = palette(look);
      if (card === "mark") {
        /* The header without its rule, and nothing under it. */
        return paintHeader(ctx, fonts, look, ev.city, ev.year, draw, PAD, false) + PAD - 26;
      }
      let y = paintHeader(ctx, fonts, look, ev.city, ev.year, draw);
      const n = daysUntil(ev);
      const big = n > 0 ? String(n) : n === 0 ? "TODAY" : "RACE WEEKEND";
      const under = n > 1 ? "DAYS AWAY" : n === 1 ? "DAY AWAY" : n === 0 ? "IT IS HERE" : "";
      const bs = fit(ctx, big, fonts.display, 320, 90, INNER);
      y = line(ctx, draw, y + 6, big, fonts.display, 400, bs, ink, 6);
      if (under) y = line(ctx, draw, y, under, fonts.cond, 700, 48, ink, 0, 10);
      y = line(ctx, draw, y + 24, "MIKIANMUSSER.COM/HYROX", fonts.cond, 700, 30, dim, 0, 4);
      return y + PAD;
    },
    [ev, card],
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
      filename={(look) => `hyrox-${ev.slug}-${card}-${look}.png`}
      label="Event sticker"
      pickers={
        <div className="hx-stk-pick" role="group" aria-label="Card">
          <button type="button" aria-pressed={card === "days"} onClick={() => setCard("days")}>
            Days away
          </button>
          <button type="button" aria-pressed={card === "mark"} onClick={() => setCard("mark")}>
            The mark
          </button>
        </div>
      }
    />
  );
}
