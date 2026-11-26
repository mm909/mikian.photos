import type { BgId } from "@/app/erg/reel/paint";
import type { Painter } from "@/app/erg/reel/serverReel";
import { both } from "./m2d";

/* THE M2D COUNT-UPS (owner, 2026-11-26: "I definitely need an animated
 * meters rolling up for my total meters rowed during M2D ... an animation
 * for a reel for animating the money and meters going up for M2D"). Reels
 * for the Holiday Challenge, filmed by the same pipeline as a row's reel
 * (erg/reel/serverReel.ts): the figure rolls up from zero, eases in to the
 * real one and holds it.
 *
 * The stickers' rule holds here (share/cards.ts, the M2D stickers): at most
 * two lines of type, both bold, then the M2D mark. Never "for charity";
 * no address. Four clips:
 *
 *   me-m      my M2D meters, then the mark
 *   me-both   my dollars, my meters under them, then the mark
 *   all-m     everyone's M2D meters, then the mark
 *   all-both  everyone's dollars, their meters under them, then the mark
 *
 * MY DOLLARS ARE WORKED OUT FROM THE METERS ON SCREEN at every frame (m2d.ts
 * `both`), so Concept2's part comes in on the frame the count passes 100K,
 * as it does on the erg. Everyone's dollars are many rowers' sums, so they
 * roll up alongside the meters, in step, to the real total.
 *
 * As on a row's reel, a key ground (green, blue) and the clear GIF give the
 * type a hard ink edge, since nothing there may be half-clear. */

export const M2D_CLIPS = ["me-m", "me-both", "all-m", "all-both"] as const;
export type M2dClip = (typeof M2D_CLIPS)[number];

export type M2dReelAsk = {
  clip: M2dClip;
  /* The meters the count ends on, and the dollars it ends on. */
  meters: number;
  dollars: number;
  /* Cents a kilometer past Concept2's part (m2dTotals perKm), for my own
   * dollars frame by frame. */
  perKm: number;
};

const INK = "#15171a";
const BLUE = "#1A90D4";
const FACE = '"Archivo Black"';

type Look = { ground: string | null; fg: string; two: string; edge: string | null };
const LOOKS: Record<BgId, Look> = {
  green: { ground: "#00ff00", fg: "#ffffff", two: BLUE, edge: INK },
  /* A blue 2 on a blue key goes out with the key. */
  blue: { ground: "#0000ff", fg: "#ffffff", two: "#ffffff", edge: INK },
  clear: { ground: null, fg: "#ffffff", two: BLUE, edge: INK },
  black: { ground: "#000000", fg: "#ffffff", two: BLUE, edge: null },
  ink: { ground: INK, fg: "#ffffff", two: BLUE, edge: null },
  cream: { ground: "#f3ecdd", fg: INK, two: "#0077B6", edge: null },
};

type Ctx = Parameters<Painter>[0];

/* The roll: an ease out over the first four fifths of the clip, then the
 * figure held, so it can be read before the clip ends. */
export function rolled(clipS: number, lengthS: number): number {
  const t = Math.min(1, Math.max(0, clipS / Math.max(0.1, lengthS * 0.8)));
  return 1 - Math.pow(1 - t, 3);
}

const usd = (d: number) => `$${d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mFig = (m: number) => `${Math.round(m).toLocaleString("en-US")} M`;

/* Digits in equal cells, so a number that is counting does not shiver
 * (erg/reel/paint.ts does the same). */
function cells(ctx: Ctx, s: string): number[] {
  const cell = ctx.measureText("0").width;
  return Array.from(s).map((ch) => (ch >= "0" && ch <= "9" ? cell : ctx.measureText(ch).width));
}
function fitSize(ctx: Ctx, s: string, size: number, maxW: number): number {
  ctx.font = `${size}px ${FACE}`;
  const w = cells(ctx, s).reduce((a, b) => a + b, 0);
  return w > maxW ? (size * maxW) / w : size;
}
/* One bold line, centred on cx, its edge first where the ground wants one. */
function line(ctx: Ctx, L: Look, s: string, cx: number, y: number, size: number, color: string) {
  ctx.font = `${size}px ${FACE}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const w = cells(ctx, s);
  const total = w.reduce((a, b) => a + b, 0);
  const chars = Array.from(s);
  const pass = (fn: (ch: string, x: number) => void) => {
    let x = cx - total / 2;
    chars.forEach((ch, i) => {
      fn(ch, x + w[i] / 2);
      x += w[i];
    });
  };
  if (L.edge) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, size * 0.11);
    ctx.strokeStyle = L.edge;
    pass((ch, x) => ctx.strokeText(ch, x, y));
  }
  ctx.fillStyle = color;
  pass((ch, x) => ctx.fillText(ch, x, y));
}
/* THE M2D MARK, as the stickers draw it (share/cards.ts drawM2d): M and D
 * in white, the 2 in the blue. */
function mark(ctx: Ctx, L: Look, cx: number, y: number, size: number) {
  ctx.font = `${size}px ${FACE}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const parts: [string, string][] = [["M", L.fg], ["2", L.two], ["D", L.fg]];
  const kern = -size * 0.03;
  const widths = parts.map(([t]) => ctx.measureText(t).width);
  const x0 = cx - (widths.reduce((a, b) => a + b, 0) + kern * 2) / 2;
  const run = (fn: (t: string, color: string, x: number) => void) => {
    let x = x0;
    parts.forEach(([t, color], i) => {
      fn(t, color, x);
      x += widths[i] + kern;
    });
  };
  if (L.edge) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, size * 0.09);
    ctx.strokeStyle = L.edge;
    run((t, _c, x) => ctx.strokeText(t, x, y));
  }
  run((t, color, x) => {
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
  });
}

export function m2dPainter(a: M2dReelAsk): Painter {
  const mine = a.clip.startsWith("me");
  const withDollars = a.clip.endsWith("both");
  const meters = Math.max(0, Math.round(a.meters));
  const dollarsAt = (m: number, p: number) => (mine ? both(m, a.perKm) : Math.round(a.dollars * p * 100) / 100);
  /* The sizes are set by the figures the count ends on, so the type does
   * not grow as it counts. */
  const bigEnd = withDollars ? usd(a.dollars) : mFig(meters);
  const subEnd = mFig(meters);
  return (ctx, W, H, clipS, lengthS, bg) => {
    const L = LOOKS[bg];
    ctx.clearRect(0, 0, W, H);
    if (L.ground) {
      ctx.fillStyle = L.ground;
      ctx.fillRect(0, 0, W, H);
    }
    const s = W / 1080;
    const cx = W / 2;
    const cy = H / 2;
    const maxW = W - 120 * s;
    const p = rolled(clipS, lengthS);
    const m = Math.round(meters * p);
    const big = withDollars ? usd(p >= 1 ? a.dollars : dollarsAt(m, p)) : mFig(m);
    const bigSize = fitSize(ctx, bigEnd, 230 * s, maxW);
    if (withDollars) {
      const subSize = fitSize(ctx, subEnd, 96 * s, maxW);
      line(ctx, L, big, cx, cy - 20 * s, bigSize, L.fg);
      line(ctx, L, mFig(m), cx, cy - 20 * s + 40 * s + subSize, subSize, L.fg);
      mark(ctx, L, cx, cy + 300 * s, 150 * s);
    } else {
      line(ctx, L, big, cx, cy + 40 * s, bigSize, L.fg);
      mark(ctx, L, cx, cy + 250 * s, 150 * s);
    }
  };
}
