"use client";

import { useCallback, useState } from "react";
import { categoryLabel, categoryRank, partnerSlots, readCategory, shortDay, type HyroxEvent } from "../events";
import type { BoardRow } from "./Board";
import { StickerFrame } from "./StickerFrame";
import { INNER, PAD, W, fit, line, paintHeader, palette, type Fonts, type Look } from "./stickerPaint";

/* THE ROSTER STICKER (owner, 2026-10-14: "a way to share a whole schedule
 * for everyone who signed up ... just the dates and then who's running,
 * with which partners and which events. Really similar to how it is on
 * the web page ... the Vegas roster"). The board as one image: the
 * header, WHO IS RACING, then each day as a filled bar, its categories,
 * and every entry — the names joined with an ampersand, TBD for a
 * partner not yet named. No start times until there are some. For
 * anyone, on the board itself, with the four looks. A long weekend goes
 * out one day at a time with the day picker. */

type DayPick = "all" | string;

export function RosterSticker({ ev, rows }: { ev: HyroxEvent; rows: BoardRow[] }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<DayPick>("all");

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, draw: boolean): number => {
      const { ink, dim, ground } = palette(look);
      /* The type a filled day bar carries: the ground under an opaque
       * look, the opposite of the ink on a clear one. */
      const onBar = ground ?? (ink === "#FFED00" ? "#0A0A0A" : "#FFED00");
      const up = (s: string) => s.toUpperCase();
      let y = paintHeader(ctx, fonts, look, ev.city, ev.year, draw);
      y = line(ctx, draw, y, "WHO IS RACING", fonts.cond, 700, 40, ink, 8, 10);

      const days = ev.days.filter((d) => day === "all" || d.date === day);
      let any = false;
      for (const d of days) {
        const today = rows.filter((r) => r.day === d.date);
        if (today.length === 0) continue;
        any = true;
        /* The day, a filled bar. */
        y += 22;
        const barH = 64;
        if (draw) {
          ctx.fillStyle = ink;
          ctx.fillRect(PAD, y, INNER, barH);
          ctx.fillStyle = onBar;
          ctx.font = `400 44px ${fonts.display}`;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(up(shortDay(d)), PAD + 18, y + 44 * 0.86 + 10);
          ctx.font = `700 22px ${fonts.cond}`;
          ctx.letterSpacing = "4px";
          const count = `${today.length} ${today.length === 1 ? "ENTRY" : "ENTRIES"}`;
          ctx.fillText(count, W - PAD - 18 - ctx.measureText(count).width, y + 22 * 0.86 + 21);
          ctx.letterSpacing = "0px";
        }
        y += barH;

        /* The categories, in rulebook order; the names within by name. */
        const groups = new Map<string, { rank: number; rows: BoardRow[] }>();
        for (const r of today) {
          const cat = readCategory(r.format, r.division, r.gender);
          const label = cat ? categoryLabel(cat) : "Other";
          const g = groups.get(label) ?? { rank: cat ? categoryRank(cat) : 999, rows: [] };
          g.rows.push(r);
          groups.set(label, g);
        }
        for (const [label, g] of [...groups.entries()].sort((a, b) => a[1].rank - b[1].rank)) {
          y += 18;
          y = line(ctx, draw, y, up(label), fonts.cond, 700, 28, dim, 6, 6);
          for (const r of g.rows.slice().sort((a, b) => a.name.localeCompare(b.name))) {
            const cat = readCategory(r.format, r.division, r.gender);
            const missing = Math.max(0, (cat ? partnerSlots(cat.format) : 0) - r.partners.length);
            const names = [r.name, ...r.partners.map((p) => p.name)].map(up);
            for (let i = 0; i < missing; i++) names.push("TBD");
            const joined = names.join(" & ");
            /* One line when it holds at a readable size; one name per
             * line when it does not. */
            const size = fit(ctx, joined, fonts.display, 52, 36, INNER);
            if (ctx.measureText(joined).width <= INNER) {
              y = line(ctx, draw, y, joined, fonts.display, 400, size, ink, 6);
            } else {
              names.forEach((n, i) => {
                const text = (i === 0 ? "" : "& ") + n;
                const ns = fit(ctx, text, fonts.display, 44, 30, INNER);
                y = line(ctx, draw, y, text, fonts.display, 400, ns, ink, 2);
              });
              y += 4;
            }
          }
        }
      }
      if (!any) y = line(ctx, draw, y + 16, "NOBODY YET — BE THE FIRST", fonts.display, 400, 52, ink, 6);

      y += 30;
      y = line(ctx, draw, y, "MIKIANMUSSER.COM/HYROX", fonts.cond, 700, 30, dim, 0, 4);
      return y + PAD;
    },
    [ev, rows, day],
  );

  if (!open) {
    return (
      <button type="button" className="hx-cta quiet" onClick={() => setOpen(true)}>
        Share the roster →
      </button>
    );
  }

  return (
    <StickerFrame
      paint={paint}
      filename={(look) => `hyrox-${ev.slug}-roster-${day}-${look}.png`}
      label="The roster, as a sticker"
      pickers={
        ev.days.length > 1 ? (
          <div className="hx-stk-pick" role="group" aria-label="Day">
            <button type="button" aria-pressed={day === "all"} onClick={() => setDay("all")}>
              All days
            </button>
            {ev.days.map((d) => (
              <button key={d.date} type="button" aria-pressed={day === d.date} onClick={() => setDay(d.date)}>
                {d.dow}
              </button>
            ))}
          </div>
        ) : null
      }
    />
  );
}
