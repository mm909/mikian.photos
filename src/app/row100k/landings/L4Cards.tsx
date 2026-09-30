"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { availableCards, prepareCard, type ShareCard, type ShareData, type ShareFonts } from "../share/cards";
import { useShareFonts } from "../shareables/CardPreview";

/* THE CARDS ON LANDING 4, painted: landing/LandingCards with two things
 * that landing needs (review, 2026-09-30) and the shared painter does not
 * have. (1) The canvas is sized off ITS OWN BOX and the device pixel
 * ratio, not a fixed 0.3 of the 1080 art: the fold's card is the one thing
 * a stranger is asked to believe is real, and a 324px bitmap shown at 226
 * CSS px on a 3x phone is a 2x upscale, smeared. (2) `ids` says which cards
 * to paint, so a tile that shows one card paints one, not three.
 *
 * `standIn` is whatever the server should print in the box until the
 * bitmap is there: this is a client component, so it server-renders with
 * `painted` false and the stand-in in place, and the first paint takes it
 * out. The cards are white on TRANSPARENT (cards.ts `light`), so the
 * stand-in cannot just sit under the canvas — it would show through. */
export function L4Cards({
  data,
  ids,
  standIn,
}: {
  data: ShareData;
  ids: string[];
  standIn?: React.ReactNode;
}) {
  const { fonts, probes } = useShareFonts();
  const [painted, setPainted] = useState(false);
  const pool = availableCards(data);
  const cards = ids.map((id) => pool.find((c) => c.id === id)).filter((c): c is ShareCard => !!c);
  const onPaint = useCallback(() => setPainted(true), []);
  if (cards.length === 0) return null;
  // The probes sit outside the box so the cards are its only children.
  return (
    <>
      {probes}
      <div className="l4c">
        {painted ? null : standIn}
        {cards.map((c) => (
          <Card key={c.id} card={c} data={data} fonts={fonts} onPaint={onPaint} />
        ))}
      </div>
    </>
  );
}

/* The largest bitmap worth painting: the art itself, 1080 wide. */
const MAX_DPR = 3;

function Card({
  card,
  data,
  fonts,
  onPaint,
}: {
  card: ShareCard;
  data: ShareData;
  fonts: React.RefObject<ShareFonts | null>;
  onPaint: () => void;
}) {
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
      console.error(`landing 4: ${card.id} failed to paint`, err);
    }
    ctx.restore();
    onPaint();
  }, [card, data, fonts, onPaint]);

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

  return <canvas ref={ref} className="l4c-card" data-card={card.id} aria-label={card.label} />;
}
