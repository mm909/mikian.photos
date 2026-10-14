"use client";

import { useCallback, useState } from "react";
import { StickerFrame } from "./StickerFrame";
import { INNER, fit, line, paintHeader, palette, type Fonts, type Look } from "./stickerPaint";

/* THE ENTRY STICKER (owner, 2026-10-13: "a little sticker shareable that
 * says like Las Vegas Hyrox 2027 or just 27, something like that. With
 * their name and their partner's name and their day. Eventually, when
 * start times are announced, we'll have a sticker for their start time
 * as well").
 *
 * Two cards on the shared frame (StickerFrame.tsx; the looks and the
 * header are stickerPaint.ts): THE RACE — city, year, category, day, the
 * names — and START, the same block with the start time huge, once the
 * entry carries one. */

export type StickerFacts = {
  city: string;
  year: number;
  /* "Women's Pro Doubles". */
  category: string;
  /* "Sat, Mar 13". */
  day: string;
  name: string;
  partners: string[];
  startTime: string;
  /* For the file name. */
  slug: string;
};

type Card = "race" | "start";

export function Sticker({ facts }: { facts: StickerFacts }) {
  const [card, setCard] = useState<Card>("race");

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, draw: boolean): number => {
      const { ink, dim } = palette(look);
      const up = (s: string) => s.toUpperCase();
      let y = paintHeader(ctx, fonts, look, facts.city, facts.year, draw);

      if (card === "start") {
        /* START — the time, the names small, the day. */
        y = line(ctx, draw, y, "START", fonts.cond, 700, 40, ink, 4, 10);
        const t = up(facts.startTime || "TBA");
        const ts = fit(ctx, t, fonts.display, 220, 80, INNER);
        y = line(ctx, draw, y, t, fonts.display, 400, ts, ink, 18);
        y = line(ctx, draw, y, up(facts.day), fonts.cond, 700, 48, ink, 22, 4);
        const who = [facts.name, ...facts.partners].filter(Boolean).map(up).join("  ·  ");
        const ws = fit(ctx, who, fonts.cond, 44, 24, INNER, 600);
        y = line(ctx, draw, y, who, fonts.cond, 600, ws, ink, 8, 2);
        y = line(ctx, draw, y, up(facts.category), fonts.cond, 600, 32, dim, 0, 4);
      } else {
        /* THE RACE — category, day, the names. */
        const cat = up(facts.category);
        const cs = fit(ctx, cat, fonts.display, 72, 40, INNER);
        y = line(ctx, draw, y, cat, fonts.display, 400, cs, ink, 6);
        y = line(ctx, draw, y, up(facts.day) + (facts.startTime ? `  ·  ${up(facts.startTime)}` : ""), fonts.cond, 700, 44, ink, 26, 4);
        const names = [facts.name, ...facts.partners].filter(Boolean);
        names.forEach((n, i) => {
          const text = (i === 0 ? "" : "& ") + up(n);
          const ns = fit(ctx, text, fonts.display, 92, 44, INNER);
          y = line(ctx, draw, y, text, fonts.display, 400, ns, ink, 4);
        });
      }
      return y + 72;
    },
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
