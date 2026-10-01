"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { availableCards, prepareCard, type ShareCard, type ShareData, type ShareFonts } from "../share/cards";
import { useShareFonts } from "../shareables/CardPreview";

/* THE CARD TILES ON THE LANDING, painted: landing/LandingCards with two
 * things the landing needs (review, 2026-09-30, written for the card draft
 * and kept for THE DARE, L1.tsx) and the shared painter does not have.
 * (1) The canvas is sized off ITS OWN BOX and the device pixel ratio, not
 * a fixed 0.3 of the 1080 art: the card is the one thing a stranger is
 * asked to believe is real, and a 324px bitmap shown at 226 CSS px on a 3x
 * phone is a 2x upscale, smeared. (2) Each tile names its card.
 *
 * A STRIP OF TEMPLATES (owner, 2026-10-01: "the cards need to be something
 * other than just Rowtember … let's show several of them, like templates,
 * and have them be swipeable, swipe-throughable"). Each tile is its own
 * card off its own payload — everyone's month, one row, a rower's month,
 * the leader in gold — so a tile carries its data with it, and a line
 * under it saying whose. The strip scrolls inside itself and snaps a tile
 * at a time (l1Css.ts .l1-tiles): a finger or a trackpad, the arrow keys
 * once it has focus, and the two arrows under it for a mouse, which has no
 * sideways wheel. The count beside them is the last tile wholly in view.
 *
 * The cards are white on TRANSPARENT (cards.ts `light`); the tile under
 * each is the ink the sheet gives it. A card the payload cannot draw
 * (availableCards says no) is left out, never painted blank. */
export type L4Tile = { id: string; data: ShareData; caption?: ReactNode };

const pad = (n: number) => String(n).padStart(2, "0");

export function L4Cards({ tiles, label = "Share cards" }: { tiles: L4Tile[]; label?: string }) {
  const { fonts, probes } = useShareFonts();
  const shown = tiles.flatMap((t) => {
    const card = availableCards(t.data).find((c) => c.id === t.id);
    return card ? [{ ...t, card }] : [];
  });
  const n = shown.length;
  const strip = useRef<HTMLDivElement | null>(null);
  /* seen: how many tiles are wholly in view counting from the first;
   * over: the strip is wider than its box; start, end: at either end. */
  const [pos, setPos] = useState({ seen: 1, over: false, start: true, end: false });

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    // Off the boxes as they sit on the screen, not offsetLeft: the strip is
    // not a positioned box, so a tile's offsets are some ancestor's.
    const right = el.getBoundingClientRect().right + 1;
    let seen = 0;
    for (const child of Array.from(el.children)) {
      if (child.getBoundingClientRect().right <= right) seen += 1;
    }
    setPos({
      seen: Math.max(1, seen),
      over: el.scrollWidth > el.clientWidth + 1,
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    measure();
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  const onScroll = useCallback(() => {
    requestAnimationFrame(measure);
  }, [measure]);

  /* One tile along: the distance between two tiles, so the snap lands it. */
  const go = (dir: 1 | -1) => {
    const el = strip.current;
    if (!el) return;
    const kids = el.children as HTMLCollectionOf<HTMLElement>;
    const step = kids.length > 1 ? kids[1].offsetLeft - kids[0].offsetLeft : el.clientWidth;
    const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * step, behavior: still ? "auto" : "smooth" });
  };

  if (n === 0) return null;
  // The probes sit outside the strip so the tiles are its only children.
  return (
    <>
      {probes}
      <div className="l4c" ref={strip} role="region" aria-label={label} tabIndex={0} onScroll={onScroll}>
        {shown.map((t) => (
          <figure key={t.card.id} className="l4c-tile">
            <Card card={t.card} data={t.data} fonts={fonts} />
            {t.caption ? <figcaption className="l4c-cap mono">{t.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
      {n > 1 ? (
        <div className={pos.over ? "l4c-pg mono" : "l4c-pg mono off"} aria-hidden={pos.over ? undefined : true}>
          <span className="l4c-n">
            {pad(pos.seen)} / {pad(n)}
          </span>
          <span className="l4c-arr">
            <button type="button" onClick={() => go(-1)} disabled={pos.start} aria-label="Previous card" tabIndex={pos.over ? undefined : -1}>
              ←
            </button>
            <button type="button" onClick={() => go(1)} disabled={pos.end} aria-label="Next card" tabIndex={pos.over ? undefined : -1}>
              →
            </button>
          </span>
        </div>
      ) : null}
    </>
  );
}

/* The largest bitmap worth painting: the art itself, 1080 wide. */
const MAX_DPR = 3;

function Card({ card, data, fonts }: { card: ShareCard; data: ShareData; fonts: React.RefObject<ShareFonts | null> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const paint = useCallback(async () => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      await document.fonts.ready;
    } catch {
      /* older browsers just paint in the fallback */
    }
    await prepareCard(card, data);
    // The box the CSS gave the canvas, in device pixels, capped at the art.
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const cssW = canvas.getBoundingClientRect().width || card.width * 0.3;
    const scale = Math.min(1, (cssW * dpr) / card.width);
    canvas.width = Math.round(card.width * scale);
    canvas.height = Math.round(card.height * scale);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    try {
      card.draw(ctx, data, fonts.current ?? { black: "sans-serif", mono: "monospace" });
    } catch (err) {
      console.error(`landing: ${card.id} failed to paint`, err);
    }
    ctx.restore();
  }, [card, data, fonts]);

  // Painted once the box is laid out, and again when the box changes (a
  // phone turned, a window dragged): the bitmap follows the box.
  useEffect(() => {
    void paint();
    let t: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void paint(), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (t) clearTimeout(t);
    };
  }, [paint]);

  return <canvas ref={ref} className="l4c-card" data-card={card.id} role="img" aria-label={card.label} />;
}
