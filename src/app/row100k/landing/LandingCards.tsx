"use client";

import { useCallback, useEffect, useRef } from "react";
import { availableCards, prepareCard, type ShareCard, type ShareData, type ShareFonts } from "../share/cards";
import { useShareFonts } from "../shareables/CardPreview";

/* WHAT YOU GET, painted: two or three of the share dialog's cards drawn
 * off the example rower's real month (owner, 2026-09-25: "include maybe
 * some of the shareables/logos"). The painting is CardPreview's — wait for
 * the webfonts, read the hashed families off the probe spans, scale the
 * context, hand the canvas to card.draw — with real data in place of the
 * sample. Cards whose `available` says no for this rower are skipped. */
const IDS = ["rowtember-month", "rowtember-profile", "rowtember-logo"];
const SCALE = 0.3;

export function LandingCards({ data }: { data: ShareData }) {
  const { fonts, probes } = useShareFonts();
  const pool = availableCards(data);
  const cards = IDS.map((id) => pool.find((c) => c.id === id)).filter((c): c is ShareCard => !!c);
  if (cards.length === 0) return null;
  // The probes sit outside the grid so the cards are its only children.
  return (
    <>
      {probes}
      <div className="ld-cards">
        {cards.map((c) => (
          <Card key={c.id} card={c} data={data} fonts={fonts} />
        ))}
      </div>
    </>
  );
}

function Card({
  card,
  data,
  fonts,
}: {
  card: ShareCard;
  data: ShareData;
  fonts: React.RefObject<ShareFonts | null>;
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
    canvas.width = Math.round(card.width * SCALE);
    canvas.height = Math.round(card.height * SCALE);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(SCALE, SCALE);
    try {
      card.draw(ctx, data, fonts.current ?? { black: "sans-serif", mono: "monospace" });
    } catch (err) {
      console.error(`landing: ${card.id} failed to paint`, err);
    }
    ctx.restore();
  }, [card, data, fonts]);

  useEffect(() => {
    void paint();
  }, [paint]);

  return <canvas ref={ref} className="ld-card" aria-label={card.label} />;
}
