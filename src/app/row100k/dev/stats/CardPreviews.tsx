"use client";

import { useCallback, useEffect, useRef } from "react";
import { CARDS, type ShareCard, type ShareData, type ShareFonts } from "../../share/cards";
import { ELITE_N } from "@/lib/blackoutRules";

/* The card catalogue: every shareable in the registry, painted at quarter
 * size, with how many times it has actually been shared. The counts alone
 * were unreadable — "rowtember-best" means nothing until you see the card —
 * so the picture is the point and the number rides along.
 *
 * Cards paint white-on-transparent (they are Instagram stickers), so each
 * preview sits on the same dark checkerboard stage the share dialog uses.
 * Painting is identical to ShareMenu's: wait for the webfonts, read their
 * real (next/font-hashed) family names off two hidden probe spans, then hand
 * the canvas to card.draw — only with the context pre-scaled, so a 1080px
 * card lands in a 270px box without every card needing to know about it. */

const SCALE = 0.25;

/* One rower and one community month, invented but realistic, chosen to
 * unlock EVERY card's available() gate so nothing in the registry is missing
 * from the catalogue. These numbers are illustrative — the point of this page
 * is what each card looks like, not what it currently says. `masked` is the
 * same rower under a blackout, for the cards that change shape then. */
const SAMPLE_DAYS = 21;

function sampleData(masked = false): ShareData {
  const byDay: Record<string, number> = {};
  const communityByDay: Record<string, number> = {};
  const daily: { day: string; cum: number }[] = [];
  const hourGrid: number[][] = [];
  let cum = 0;
  for (let d = 1; d <= SAMPLE_DAYS; d++) {
    const day = `2026-09-${String(d).padStart(2, "0")}`;
    // A month with rest days and a couple of big ones, so the calendar and
    // the bars have shape instead of a flat block.
    const mine = d % 6 === 0 ? 0 : 3000 + ((d * 1379) % 9000);
    const everyone = 28_000 + ((d * 7717) % 46_000);
    if (mine > 0) byDay[day] = mine;
    communityByDay[day] = everyone;
    cum += everyone;
    daily.push({ day, cum });
    hourGrid.push(
      Array.from({ length: 24 }, (_, h) =>
        h < 4 || h > 21 ? 0 : Math.round((everyone / 14) * (((h * 37 + d * 11) % 10) / 9)),
      ),
    );
  }

  // A board with the elite fifteen hidden, so the sticker pages paint too.
  const standings = Array.from({ length: 25 }, (_, i) => {
    const meters = 118_000 - i * 4_300;
    const hidden = i < ELITE_N;
    return {
      name: `Rower ${String.fromCharCode(65 + i)}`,
      rowerNumber: 40 + i,
      meters: hidden ? Math.floor(meters / 10_000) * 10_000 : meters,
      masked: hidden || undefined,
      digits: hidden ? String(meters).length : undefined,
    };
  });

  return {
    displayName: "Sample Rower",
    rowerNumber: 23,
    instagram: "mikian_",
    meters: 100_000,
    sessions: 24,
    byDay,
    days: SAMPLE_DAYS,
    masked,
    digits: masked ? 6 : undefined,
    row: { day: "2026-09-14", meters: 10_000, seconds: 2461, title: "Sunrise 10k" },
    division: "M",
    longest: 21_097,
    rank: { place: 3, of: 91 },
    best: { label: "Fastest 5k", value: "19:59.5", place: 1 },
    community: {
      meters: cum,
      rowers: 91,
      sessions: 902,
      byDay: communityByDay,
      daily,
      days: SAMPLE_DAYS,
      hourGrid,
      standings,
      asOf: `Sep ${SAMPLE_DAYS}`,
    },
  };
}

/* The cards that look different under a blackout — painted a second time
 * with the masked sample so the owner can check the blocks. */
const BLACKOUT_IDS = ["rowtember-total", "rowtember-named", "rowtember-profile", "rowtember-club"];

function Preview({
  card,
  fonts,
  masked = false,
}: {
  card: ShareCard;
  fonts: React.RefObject<ShareFonts | null>;
  masked?: boolean;
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
    canvas.width = Math.round(card.width * SCALE);
    canvas.height = Math.round(card.height * SCALE);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    // Every card draws in its own 1080-wide coordinate space; scaling the
    // context is what shrinks it without touching a single card's code.
    ctx.scale(SCALE, SCALE);
    try {
      card.draw(ctx, sampleData(masked), fonts.current ?? { black: "sans-serif", mono: "monospace" });
    } catch (err) {
      console.error(`dev/stats: ${card.id} failed to paint`, err);
    }
    ctx.restore();
  }, [card, fonts, masked]);

  useEffect(() => {
    void paint();
  }, [paint]);

  return <canvas ref={ref} className="dst-canvas" aria-label={`${card.label} preview`} />;
}

export function CardPreviews({ counts }: { counts: Record<string, number> }) {
  const fonts = useRef<ShareFonts | null>(null);
  const blackProbe = useRef<HTMLSpanElement | null>(null);
  const monoProbe = useRef<HTMLSpanElement | null>(null);

  /* Resolve the hashed font families once, before the canvases paint. */
  useEffect(() => {
    fonts.current = {
      black: blackProbe.current
        ? window.getComputedStyle(blackProbe.current).fontFamily
        : "sans-serif",
      mono: monoProbe.current ? window.getComputedStyle(monoProbe.current).fontFamily : "monospace",
    };
  }, []);

  /* Most-shared first; never-shared cards keep registry order at the bottom,
   * which is exactly where an unfamiliar card should be findable. A card the
   * sample cannot unlock in either state (board pages past the 25 sample
   * rows) would paint blank, so it is left out. */
  const plain = sampleData(false);
  const dark = sampleData(true);
  const ordered = CARDS.filter(
    (c) => !c.available || c.available(plain) || c.available(dark),
  ).sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
  const blackout = CARDS.filter((c) => BLACKOUT_IDS.includes(c.id));

  return (
    <>
      <span ref={blackProbe} aria-hidden className="share-probe blk" />
      <span ref={monoProbe} aria-hidden className="share-probe mono" />
      <div className="dst-cards">
        {ordered.map((card) => {
          const n = counts[card.id] ?? 0;
          // The elite card only exists under a blackout, so it paints masked.
          const masked = card.id === "rowtember-elite";
          return (
            <figure className="dst-card" key={card.id}>
              <div className="dst-stage">
                <Preview card={card} fonts={fonts} masked={masked} />
              </div>
              <figcaption>
                <span className="dst-name">{card.label}</span>
                <span className="dst-id">{card.id}</span>
                <span className={n > 0 ? "dst-n on" : "dst-n"}>
                  {n}
                  <em>{n === 1 ? " share" : " shares"}</em>
                </span>
              </figcaption>
            </figure>
          );
        })}
        {blackout.map((card) => (
          <figure className="dst-card" key={`${card.id}-blackout`}>
            <div className="dst-stage">
              <Preview card={card} fonts={fonts} masked />
            </div>
            <figcaption>
              <span className="dst-name">{card.label} · blackout</span>
              <span className="dst-id">{card.id}</span>
              <span className="dst-n">
                <em>same id, hidden meters</em>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
