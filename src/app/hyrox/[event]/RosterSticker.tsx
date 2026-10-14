"use client";

import { useCallback, useState } from "react";
import { DIVISION_LABEL, FORMAT_LABEL, GENDER_LABEL, categoryRank, partnerSlots, readCategory, shortDay, type Category, type HyroxEvent } from "../events";
import type { BoardRow } from "./Board";
import { StickerFrame, type Deck, type Painter } from "./StickerFrame";
import { INNER, PAD, W, daysCard, fit, paintHeader, palette, placeCard, tag, titleCard, type Fonts, type Look } from "./stickerPaint";

/* THE ROSTER STICKER (owner, 2026-10-14: "a way to share a whole schedule
 * for everyone who signed up ... just the dates and then who's running,
 * with which partners and which events ... the Vegas roster"). The board
 * as pages of a STORY (1080 × 1920) or a POST (1080 × 1350): the header,
 * then each day as a filled bar, its categories, and every entry — the
 * names joined with an ampersand, TBD for a partner not yet named. For
 * anyone, on the board itself, with the four looks, a day picker for one
 * day at a time, and the same frame carrying a TITLE and a DAYS AWAY page
 * at the same size.
 *
 * After the owner's first look (same day): no WHO IS RACING, no page
 * count, no entry count on the day bars; the roster sticks to the top of
 * every page rather than centring a short one; more air between the
 * names; and the category is called out — MEN'S DOUBLES with PRO in a
 * filled box the way the year sits ("let's do the same thing with pro");
 * open says nothing ("we don't have to specify open, just pro").
 *
 * THE PAGES: the roster is laid out as blocks — a day bar, a category, an
 * entry — and packed into pages of the frame; a page never ends on a day
 * bar or a category, and a page that starts mid-day repeats the day bar
 * (and the category) it continues.
 *
 * THE DECK: SHARE ALL / DOWNLOAD ALL hand over the title page, the days-
 * away page and every roster page of the day pick, in the format and the
 * look on screen ("one button that generates me a post that is the title
 * screen ... and then each of the slides showing the athletes"). */

type DayPick = "all" | string;
type Format = "story" | "post";
type Card = "roster" | "title" | "days";
const HEIGHT: Record<Format, number> = { story: 1920, post: 1350 };

/* One thing on the roster and how tall it is; `kind` drives the page
 * breaks. */
type Block = { h: number; kind: "day" | "cat" | "entry"; paint: (y: number) => void };

/* "MEN'S DOUBLES" and the tag beside it: PRO or ADAPTIVE in a box; open
 * says nothing (owner, 2026-10-14: "we don't have to specify open on the
 * stickers, just pro"). */
function catWords(cat: Category | null): { words: string; tag: string } {
  if (!cat) return { words: "OTHER", tag: "" };
  const words = `${GENDER_LABEL[cat.gender]} ${FORMAT_LABEL[cat.format]}`.toUpperCase();
  if (cat.format === "relay" || cat.division === "open") return { words, tag: "" };
  return { words, tag: DIVISION_LABEL[cat.division].toUpperCase() };
}

export function RosterSticker({ ev, rows }: { ev: HyroxEvent; rows: BoardRow[] }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<DayPick>("all");
  const [format, setFormat] = useState<Format>("story");
  const [card, setCard] = useState<Card>("roster");
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  /* The roster's pages for a day pick, laid out against the fonts. */
  const layout = useCallback(
    (ctx: CanvasRenderingContext2D, look: Look, fonts: Fonts, H: number, pick: DayPick): Block[][] => {
      const { ink, ground } = palette(look);
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

      const blocks: Block[] = [];
      const days = ev.days.filter((d) => pick === "all" || d.date === pick);
      for (const d of days) {
        const today = rows.filter((r) => r.day === d.date);
        if (today.length === 0) continue;
        blocks.push({
          h: 34 + 68,
          kind: "day",
          paint: (y) => {
            ctx.fillStyle = ink;
            ctx.fillRect(PAD, y + 34, INNER, 68);
            text(PAD + 20, y + 34 + 46 * 0.86 + 11, up(shortDay(d)), `400 46px ${fonts.display}`, onBar);
          },
        });

        const groups = new Map<string, { rank: number; cat: Category | null; rows: BoardRow[] }>();
        for (const r of today) {
          const cat = readCategory(r.format, r.division, r.gender);
          const key = cat ? `${cat.format}/${cat.division}/${cat.gender}` : "other";
          const g = groups.get(key) ?? { rank: cat ? categoryRank(cat) : 999, cat, rows: [] };
          g.rows.push(r);
          groups.set(key, g);
        }
        for (const g of [...groups.values()].sort((a, b) => a.rank - b.rank)) {
          const { words, tag: tagWord } = catWords(g.cat);
          blocks.push({
            h: 30 + 40 + 14,
            kind: "cat",
            paint: (y) => {
              const top = y + 30;
              text(PAD, top + 32 * 0.86 + 4, words, `700 32px ${fonts.cond}`, ink, 6);
              ctx.font = `700 32px ${fonts.cond}`;
              ctx.letterSpacing = "6px";
              const ww = ctx.measureText(words).width;
              ctx.letterSpacing = "0px";
              if (tagWord) tag(ctx, true, PAD + ww + 22, top, tagWord, fonts, look, 26);
            },
          });
          for (const r of g.rows.slice().sort((a, b) => a.name.localeCompare(b.name))) {
            const missing = Math.max(0, (g.cat ? partnerSlots(g.cat.format) : 0) - r.partners.length);
            const names = [r.name, ...r.partners.map((p) => p.name)].map(up);
            for (let i = 0; i < missing; i++) names.push("TBD");
            const joined = names.join(" & ");
            /* One line when it holds at a readable size; one name per
             * line when it does not. */
            const size = fit(ctx, joined, fonts.display, 52, 36, INNER);
            if (ctx.measureText(joined).width <= INNER) {
              blocks.push({ h: size + 16, kind: "entry", paint: (y) => text(PAD, y + size * 0.86, joined, `400 ${size}px ${fonts.display}`, ink) });
            } else {
              const lines = names.map((n, i) => {
                const t = (i === 0 ? "" : "& ") + n;
                return { t, size: fit(ctx, t, fonts.display, 44, 30, INNER) };
              });
              const h = lines.reduce((a, l) => a + l.size + 4, 0) + 12;
              blocks.push({
                h,
                kind: "entry",
                paint: (y) => {
                  let yy = y;
                  for (const l of lines) {
                    text(PAD, yy + l.size * 0.86, l.t, `400 ${l.size}px ${fonts.display}`, ink);
                    yy += l.size + 4;
                  }
                },
              });
            }
          }
        }
      }
      if (blocks.length === 0) {
        blocks.push({ h: 30 + 52, kind: "entry", paint: (y) => text(PAD, y + 30 + 52 * 0.86, "NOBODY YET — BE THE FIRST", `400 52px ${fonts.display}`, ink) });
      }

      const headerH = paintHeader(ctx, fonts, look, ev.city, ev.year, false, 0);
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
      return pageList;
    },
    [ev, rows],
  );

  /* One roster page, stuck to the top. */
  const pagePainter = useCallback(
    (H: number, pick: DayPick, p: number): Painter =>
      (ctx, look, fonts, draw) => {
        const pageList = layout(ctx, look, fonts, H, pick);
        if (draw) {
          let y = paintHeader(ctx, fonts, look, ev.city, ev.year, true, PAD);
          for (const b of pageList[Math.min(p, pageList.length - 1)] ?? []) {
            b.paint(y);
            y += b.h;
          }
        }
        return H;
      },
    [layout, ev],
  );

  const paint = useCallback<Painter>(
    (ctx, look, fonts, draw) => {
      const H = HEIGHT[format];
      if (card === "title") return placeCard(ctx, fonts, look, draw, H, titleCard(ev.city, ev.year));
      if (card === "days") return placeCard(ctx, fonts, look, draw, H, daysCard(ev));
      const n = layout(ctx, look, fonts, H, day).length;
      if (n !== pages) setPages(n);
      return pagePainter(H, day, page)(ctx, look, fonts, draw);
    },
    [format, card, day, page, pages, layout, pagePainter, ev],
  );

  const deck = useCallback<Deck>(
    (ctx, look, fonts) => {
      const H = HEIGHT[format];
      const stem = `hyrox-${ev.slug}-${format}-${look}`;
      const slides = [
        { name: `${stem}-01-title.png`, paint: ((c, l, f, d) => placeCard(c, f, l, d, H, titleCard(ev.city, ev.year))) as Painter },
        { name: `${stem}-02-days-away.png`, paint: ((c, l, f, d) => placeCard(c, f, l, d, H, daysCard(ev))) as Painter },
      ];
      const n = layout(ctx, look, fonts, H, day).length;
      for (let i = 0; i < n; i++) {
        slides.push({ name: `${stem}-${String(i + 3).padStart(2, "0")}-roster-${day}-${i + 1}.png`, paint: pagePainter(H, day, i) });
      }
      return slides;
    },
    [format, day, ev, layout, pagePainter],
  );

  if (!open) {
    return (
      <button type="button" className="hx-cta quiet" onClick={() => setOpen(true)}>
        Share the roster →
      </button>
    );
  }

  const pickDay = (d: DayPick) => {
    setDay(d);
    setPage(0);
  };
  const shownPage = Math.min(page, pages - 1);

  return (
    <StickerFrame
      paint={paint}
      deck={deck}
      filename={(look) =>
        card === "roster" ? `hyrox-${ev.slug}-roster-${day}-${format}${pages > 1 ? `-${shownPage + 1}of${pages}` : ""}-${look}.png` : `hyrox-${ev.slug}-${card}-${format}-${look}.png`
      }
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
          <div className="hx-stk-pick" role="group" aria-label="Card">
            <button type="button" aria-pressed={card === "roster"} onClick={() => setCard("roster")}>
              Roster
            </button>
            <button type="button" aria-pressed={card === "title"} onClick={() => setCard("title")}>
              Title
            </button>
            <button type="button" aria-pressed={card === "days"} onClick={() => setCard("days")}>
              Days away
            </button>
          </div>
          {card === "roster" && ev.days.length > 1 ? (
            <div className="hx-stk-pick" role="group" aria-label="Day">
              <button type="button" aria-pressed={day === "all"} onClick={() => pickDay("all")}>
                All days
              </button>
              {ev.days.map((d) => (
                <button key={d.date} type="button" aria-pressed={day === d.date} onClick={() => pickDay(d.date)}>
                  {d.dow}
                </button>
              ))}
            </div>
          ) : null}
          {card === "roster" && pages > 1 ? (
            <div className="hx-stk-pick" role="group" aria-label="Page">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} type="button" aria-pressed={shownPage === i} onClick={() => setPage(i)}>
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
