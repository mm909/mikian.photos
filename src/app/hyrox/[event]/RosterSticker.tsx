"use client";

import { useCallback, useState } from "react";
import { categoryLabel, categoryRank, partnerSlots, readCategory, shortDay, type HyroxEvent } from "../events";
import type { BoardRow } from "./Board";
import { StickerFrame } from "./StickerFrame";
import { INNER, PAD, W, fit, paintHeader, palette, type Fonts, type Look } from "./stickerPaint";

/* THE ROSTER STICKER (owner, 2026-10-14: "a way to share a whole schedule
 * for everyone who signed up ... just the dates and then who's running,
 * with which partners and which events. Really similar to how it is on
 * the web page ... the Vegas roster"). The board as an image: the header,
 * WHO IS RACING, then each day as a filled bar, its categories, and every
 * entry — the names joined with an ampersand, TBD for a partner not yet
 * named. For anyone, on the board itself, with the four looks, and a day
 * picker for one day at a time.
 *
 * TWO FORMATS, and PAGES (owner, same day: "make it fit on a story post
 * ... formatted like a story and as a post ... automatically split the
 * list when it gets too long"): STORY is 1080 × 1920, POST 1080 × 1350.
 * The roster is laid out as blocks — a day bar, a category label, an
 * entry — and packed into pages of the frame; a page never ends on a day
 * bar or a category label, and a page that starts mid-day repeats the day
 * bar (and the category) it continues. A short roster sits centred in its
 * frame. No address line (same day: "remove the mikianmusser/Hyrox part"). */

type DayPick = "all" | string;
type Format = "story" | "post";
const HEIGHT: Record<Format, number> = { story: 1920, post: 1350 };

/* One thing on the roster and how tall it is; `kind` drives the page
 * breaks. */
type Block = { h: number; kind: "day" | "cat" | "entry"; paint: (y: number) => void };

export function RosterSticker({ ev, rows }: { ev: HyroxEvent; rows: BoardRow[] }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<DayPick>("all");
  const [format, setFormat] = useState<Format>("story");
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, draw: boolean): number => {
      const H = HEIGHT[format];
      const { ink, dim, ground } = palette(look);
      /* The type a filled day bar carries: the ground under an opaque
       * look, the opposite of the ink on a clear one. */
      const onBar = ground ?? (ink === "#FFED00" ? "#0A0A0A" : "#FFED00");
      const up = (s: string) => s.toUpperCase();
      const text = (x: number, y: number, t: string, font: string, color: string, track = 0) => {
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textBaseline = "alphabetic";
        if (track) ctx.letterSpacing = `${track}px`;
        ctx.fillText(t, x, y);
        if (track) ctx.letterSpacing = "0px";
      };

      /* THE BLOCKS, measured once. */
      const blocks: Block[] = [];
      const days = ev.days.filter((d) => day === "all" || d.date === day);
      for (const d of days) {
        const today = rows.filter((r) => r.day === d.date);
        if (today.length === 0) continue;
        const count = `${today.length} ${today.length === 1 ? "ENTRY" : "ENTRIES"}`;
        const dayBlock: Block = {
          h: 22 + 64,
          kind: "day",
          paint: (y) => {
            ctx.fillStyle = ink;
            ctx.fillRect(PAD, y + 22, INNER, 64);
            text(PAD + 18, y + 22 + 44 * 0.86 + 10, up(shortDay(d)), `400 44px ${fonts.display}`, onBar);
            ctx.font = `700 22px ${fonts.cond}`;
            ctx.letterSpacing = "4px";
            const cw = ctx.measureText(count).width;
            ctx.letterSpacing = "0px";
            text(W - PAD - 18 - cw, y + 22 + 22 * 0.86 + 21, count, `700 22px ${fonts.cond}`, onBar, 4);
          },
        };
        blocks.push(dayBlock);

        const groups = new Map<string, { rank: number; rows: BoardRow[] }>();
        for (const r of today) {
          const cat = readCategory(r.format, r.division, r.gender);
          const label = cat ? categoryLabel(cat) : "Other";
          const g = groups.get(label) ?? { rank: cat ? categoryRank(cat) : 999, rows: [] };
          g.rows.push(r);
          groups.set(label, g);
        }
        for (const [label, g] of [...groups.entries()].sort((a, b) => a[1].rank - b[1].rank)) {
          blocks.push({
            h: 18 + 28 + 6,
            kind: "cat",
            paint: (y) => text(PAD, y + 18 + 28 * 0.86, up(label), `700 28px ${fonts.cond}`, dim, 6),
          });
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
              blocks.push({ h: size + 6, kind: "entry", paint: (y) => text(PAD, y + size * 0.86, joined, `400 ${size}px ${fonts.display}`, ink) });
            } else {
              const lines = names.map((n, i) => {
                const t = (i === 0 ? "" : "& ") + n;
                return { t, size: fit(ctx, t, fonts.display, 44, 30, INNER) };
              });
              const h = lines.reduce((a, l) => a + l.size + 2, 0) + 4;
              blocks.push({
                h,
                kind: "entry",
                paint: (y) => {
                  let yy = y;
                  for (const l of lines) {
                    text(PAD, yy + l.size * 0.86, l.t, `400 ${l.size}px ${fonts.display}`, ink);
                    yy += l.size + 2;
                  }
                },
              });
            }
          }
        }
      }
      if (blocks.length === 0) {
        blocks.push({ h: 16 + 52, kind: "entry", paint: (y) => text(PAD, y + 16 + 52 * 0.86, "NOBODY YET — BE THE FIRST", `400 52px ${fonts.display}`, ink) });
      }

      /* THE PAGES. The header and WHO IS RACING open every page. */
      const headerH = paintHeader(ctx, fonts, look, ev.city, ev.year, false, 0) + 40 + 8;
      const avail = H - PAD * 2 - headerH;
      const pageList: Block[][] = [];
      let cur: Block[] = [];
      let used = 0;
      let lastDay: Block | null = null;
      let lastCat: Block | null = null;
      const close = () => {
        if (cur.length) pageList.push(cur);
        cur = [];
        used = 0;
      };
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        /* A day bar or a category must bring its next block with it. */
        const need = b.kind === "entry" ? b.h : b.h + (blocks[i + 1]?.h ?? 0) + (b.kind === "day" && blocks[i + 2] ? blocks[i + 2].h : 0);
        if (used + need > avail && cur.length > 0) {
          close();
          /* A page that starts mid-day repeats the day, and mid-category
           * the category, it continues. */
          if (b.kind !== "day" && lastDay) {
            cur.push(lastDay);
            used += lastDay.h;
            if (b.kind === "entry" && lastCat) {
              cur.push(lastCat);
              used += lastCat.h;
            }
          }
        }
        cur.push(b);
        used += b.h;
        if (b.kind === "day") {
          lastDay = b;
          lastCat = null;
        } else if (b.kind === "cat") lastCat = b;
      }
      close();
      if (pageList.length !== pages) setPages(pageList.length);
      const p = Math.min(page, pageList.length - 1);
      const content = pageList[p] ?? [];
      const contentH = content.reduce((a, b) => a + b.h, 0);

      if (draw) {
        /* A short page sits centred; a full one starts at the top. */
        const y0 = Math.max(PAD, Math.round((H - headerH - contentH) / 2));
        let y = paintHeader(ctx, fonts, look, ev.city, ev.year, true, y0);
        const who = pageList.length > 1 ? `WHO IS RACING  ·  ${p + 1} / ${pageList.length}` : "WHO IS RACING";
        text(PAD, y + 40 * 0.86, who, `700 40px ${fonts.cond}`, ink, 10);
        y += 40 + 8;
        for (const b of content) {
          b.paint(y);
          y += b.h;
        }
      }
      return H;
    },
    [ev, rows, day, format, page, pages],
  );

  if (!open) {
    return (
      <button type="button" className="hx-cta quiet" onClick={() => setOpen(true)}>
        Share the roster →
      </button>
    );
  }

  const pick = (d: DayPick) => {
    setDay(d);
    setPage(0);
  };

  return (
    <StickerFrame
      paint={paint}
      filename={(look) => `hyrox-${ev.slug}-roster-${day}-${format}${pages > 1 ? `-${page + 1}of${pages}` : ""}-${look}.png`}
      label="The roster, as a sticker"
      pickers={
        <>
          <div className="hx-stk-pick" role="group" aria-label="Format">
            <button type="button" aria-pressed={format === "story"} onClick={() => setFormat("story")}>
              Story
            </button>
            <button type="button" aria-pressed={format === "post"} onClick={() => setFormat("post")}>
              Post
            </button>
          </div>
          {ev.days.length > 1 ? (
            <div className="hx-stk-pick" role="group" aria-label="Day">
              <button type="button" aria-pressed={day === "all"} onClick={() => pick("all")}>
                All days
              </button>
              {ev.days.map((d) => (
                <button key={d.date} type="button" aria-pressed={day === d.date} onClick={() => pick(d.date)}>
                  {d.dow}
                </button>
              ))}
            </div>
          ) : null}
          {pages > 1 ? (
            <div className="hx-stk-pick" role="group" aria-label="Page">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} type="button" aria-pressed={Math.min(page, pages - 1) === i} onClick={() => setPage(i)}>
                  {i + 1} / {pages}
                </button>
              ))}
            </div>
          ) : null}
        </>
      }
    />
  );
}
