"use client";

import { useCallback, useEffect, useRef } from "react";
import { ELITE_N } from "@/lib/blackoutRules";
import { CARDS, prepareCard, type ShareCard, type ShareData, type ShareFonts } from "../share/cards";

/* One shareable, painted small off a sample rower — the preview cell of the
 * shareables table. Moved here from dev/stats/CardPreviews.tsx (owner,
 * 2026-09-16: "combine this page on the shareables menu"); the painting is
 * the share dialog's — wait for the webfonts, read the hashed families off
 * two probe spans, scale the context, hand the canvas to card.draw. */

/* Sep 21 of the sample month, a ROWED day, so the two Today cards stay in
 * the catalogue (they read day SAMPLE_DAYS out of byDay). */
export const SAMPLE_DAYS = 21;

/* A board deep enough to unlock EVERY board sticker: BOARD_PAGES pages of
 * ten. Read off the registry so a thirteenth page would paint too. */
const SAMPLE_STANDINGS = CARDS.filter((c) => c.id.startsWith("rowtember-board-")).length * 10;

/* One rower, one community month and one race day, invented but realistic,
 * chosen to unlock every card in the registry — the wave card included: the
 * sample racer has been told wave 3. `masked` is the same rower under a
 * blackout, which is the only state the elite card exists in. */
export function sampleData(masked = false): ShareData {
  const byDay: Record<string, number> = {};
  const communityByDay: Record<string, number> = {};
  const daily: { day: string; cum: number }[] = [];
  const hourGrid: number[][] = [];
  let cum = 0;
  for (let d = 1; d <= SAMPLE_DAYS; d++) {
    const day = `2026-09-${String(d).padStart(2, "0")}`;
    const mine = d % 6 === 0 ? 0 : 3000 + ((d * 1379) % 9000);
    const everyone = 28_000 + ((d * 7717) % 46_000);
    if (mine > 0) byDay[day] = mine;
    communityByDay[day] = everyone;
    cum += everyone;
    daily.push({ day, cum });
    hourGrid.push(
      Array.from({ length: 24 }, (_, h) => (h < 4 || h > 21 ? 0 : (h * 37 + d * 11) % 10)),
    );
  }

  // The elite hidden and unranked (blackoutRules.ts), so the first board
  // stickers paint as the blackout does.
  const standings = Array.from({ length: SAMPLE_STANDINGS }, (_, i) => {
    const meters = Math.max(1_000, 118_000 - i * 900);
    const hidden = i < ELITE_N;
    return {
      name: `Rower ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? String(Math.floor(i / 26)) : ""}`,
      rowerNumber: 40 + i,
      meters: hidden ? Math.floor(meters / 10_000) * 10_000 : meters,
      masked: hidden || undefined,
      digits: hidden ? String(meters).length : undefined,
      unranked: hidden || undefined,
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
    rank: masked ? null : { place: 3, of: 91 },
    best: masked
      ? { label: "Fastest 5k", value: "", place: 1, shape: "##:##.#" }
      : { label: "Fastest 5k", value: "18:51.6", place: 1 },
    race: {
      title: "RACE DAY",
      sub: "A TIMED 5,000 M TRIAL",
      when: "SUN SEP 27 · 6 – 9 PM",
      where: "THE ENGINE ROOM",
      mark: {
        src: "/row100k/raceday/strip-barbell.png",
        ratio: 1170 / 466,
        alt: "The Strip Barbell",
      },
      mine: { wave: 3, time: "7:15 PM" },
    },
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

/* The two probe spans the painter reads the hashed font families off.
 * Render once, above the previews, and hand `fonts` to each of them. */
export function useShareFonts(): {
  fonts: React.RefObject<ShareFonts | null>;
  probes: React.ReactNode;
} {
  const fonts = useRef<ShareFonts | null>(null);
  const blackProbe = useRef<HTMLSpanElement | null>(null);
  const monoProbe = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    fonts.current = {
      black: blackProbe.current ? window.getComputedStyle(blackProbe.current).fontFamily : "sans-serif",
      mono: monoProbe.current ? window.getComputedStyle(monoProbe.current).fontFamily : "monospace",
    };
  }, []);
  const probes = (
    <>
      <span ref={blackProbe} aria-hidden className="share-probe blk" />
      <span ref={monoProbe} aria-hidden className="share-probe mono" />
    </>
  );
  return { fonts, probes };
}

export function CardPreview({
  card,
  fonts,
  masked = false,
  scale = 0.12,
  className = "sh-canvas",
}: {
  card: ShareCard;
  fonts: React.RefObject<ShareFonts | null>;
  masked?: boolean;
  scale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  const paint = useCallback(async () => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sample = sampleData(masked);
    try {
      await document.fonts.ready;
    } catch {
      /* older browsers just paint in the fallback */
    }
    // The race cards carry the house mark: same capped wait as the dialog.
    await prepareCard(card, sample);
    canvas.width = Math.round(card.width * scale);
    canvas.height = Math.round(card.height * scale);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    try {
      card.draw(ctx, sample, fonts.current ?? { black: "sans-serif", mono: "monospace" });
    } catch (err) {
      console.error(`shareables: ${card.id} failed to paint`, err);
    }
    ctx.restore();
  }, [card, fonts, masked, scale]);

  useEffect(() => {
    void paint();
  }, [paint]);

  return <canvas ref={ref} className={className} aria-label={`${card.label} preview`} />;
}
