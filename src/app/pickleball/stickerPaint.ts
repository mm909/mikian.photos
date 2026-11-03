import { COURT, DARK, LINE, NEON } from "./theme";
import type { BracketState, MatchState } from "./bracket";
import { matchLabel } from "./bracket";

/* WHAT EVERY PICKLEBALL STICKER SHARES: the canvas width, the four looks,
 * the fitter, the header — PICKLEBALL huge, the year in a box, a rule —
 * and the two cards (owner, 2026-11-02): the OPTED IN team card ("use the
 * tone opted in instead of we're in") and the whole bracket as one image.
 * No React here, the hyrox way. NO ADDRESS on any of it (owner,
 * 2026-10-14: "never put mikianmusser.com on any stickers"). */

export type Fonts = { display: string; cond: string };

/* court: neon-and-white type on the court blue. ball: dark type on the
 * ball's neon. The clear pair puts each set of type on nothing. */
export type Look = "court" | "ball" | "clear-light" | "clear-dark";

export const LOOKS: { id: Look; label: string }[] = [
  { id: "court", label: "On the court" },
  { id: "ball", label: "On the ball" },
  { id: "clear-light", label: "Light on clear" },
  { id: "clear-dark", label: "Dark on clear" },
];

export const W = 1080;
export const PAD = 72;
export const INNER = W - PAD * 2;

const YEAR = 130;
const YEAR_PAD = 26;

export function palette(look: Look): { ink: string; hot: string; box: string; onBox: string; dim: string; ground: string | null } {
  const lightType = look === "court" || look === "clear-light";
  return {
    ink: lightType ? LINE : DARK,
    hot: lightType ? NEON : DARK,
    box: lightType ? NEON : DARK,
    onBox: lightType ? DARK : NEON,
    dim: lightType ? "rgba(244,247,242,.68)" : "rgba(11,30,51,.68)",
    ground: look === "court" ? COURT : look === "ball" ? NEON : null,
  };
}

export function fit(ctx: CanvasRenderingContext2D, text: string, family: string, max: number, min: number, width: number, weight = 400): number {
  let size = max;
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

export function line(
  ctx: CanvasRenderingContext2D,
  draw: boolean,
  y: number,
  text: string,
  family: string,
  weight: number,
  size: number,
  color: string,
  gapAfter: number,
  track = 0,
): number {
  if (draw) {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    if (track) ctx.letterSpacing = `${track}px`;
    ctx.fillText(text, PAD, y + size * 0.86);
    if (track) ctx.letterSpacing = "0px";
  }
  return y + size + gapAfter;
}

/* A word in a filled box (OPTED IN, the year). Returns the box width. */
export function tag(ctx: CanvasRenderingContext2D, draw: boolean, x: number, y: number, text: string, fonts: Fonts, look: Look, size = 26): number {
  const { box, onBox } = palette(look);
  ctx.font = `700 ${size}px ${fonts.cond}`;
  ctx.letterSpacing = "4px";
  const w = ctx.measureText(text).width + 4 + size * 0.9;
  const h = size * 1.5;
  if (draw) {
    ctx.fillStyle = box;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = onBox;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x + size * 0.45, y + size * 0.86 + (h - size) / 2);
  }
  ctx.letterSpacing = "0px";
  return w;
}

/* PICKLEBALL huge, the year in a box, a rule — nothing else (owner,
 * 2026-11-02: no "doubles · double elimination" line on a sticker unless
 * a singles category exists one day). Returns the y under it. */
export function paintHeader(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, year: number, draw: boolean, y0 = PAD, rule = true): number {
  const { ink, box, onBox } = palette(look);
  let y = y0;

  const yr = `’${String(year).slice(-2)}`;
  ctx.font = `400 ${YEAR}px ${fonts.display}`;
  const yw = ctx.measureText(yr).width + 36;
  const size = fit(ctx, "PICKLEBALL", fonts.display, YEAR, 60, INNER - yw - 24);
  const baseline = y + YEAR_PAD + YEAR * 0.86;
  const boxTop = y;
  const boxH = YEAR_PAD + YEAR * 0.86 + YEAR_PAD;
  if (draw) {
    ctx.fillStyle = ink;
    ctx.font = `400 ${size}px ${fonts.display}`;
    ctx.fillText("PICKLEBALL", PAD, baseline);
    ctx.fillStyle = box;
    ctx.fillRect(W - PAD - yw, boxTop, yw, boxH);
    ctx.fillStyle = onBox;
    ctx.font = `400 ${YEAR}px ${fonts.display}`;
    ctx.fillText(yr, W - PAD - yw + 18, baseline);
  }
  y = boxTop + boxH + 26;
  if (!rule) return y;
  if (draw) {
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, y, INNER, 6);
  }
  return y + 6 + 26;
}

/* ---------------------------------------------------------- the cards */

type CardPainter = (ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, y0: number) => number;

export function placeCard(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, card: CardPainter): number {
  if (draw) card(ctx, fonts, look, true, PAD);
  return card(ctx, fonts, look, false, 0) + PAD * 2;
}

/* OPTED IN (owner, 2026-11-02: that tone, not "we're in"): the mark, the
 * stamp, the two names huge. No skill level on it (owner, same day). */
export const optedInCard =
  (facts: { player1: string; player2: string; year: number }): CardPainter =>
  (ctx, fonts, look, draw, y0) => {
    const { ink } = palette(look);
    const up = (s: string) => s.toUpperCase();
    let y = paintHeader(ctx, fonts, look, facts.year, draw, y0);
    y += 10;
    /* The stamp: OPTED IN boxed big, tilted a touch. */
    if (draw) {
      ctx.save();
      ctx.translate(PAD, y);
      ctx.rotate(-0.035);
      tag(ctx, true, 0, 0, "OPTED IN", fonts, look, 52);
      ctx.restore();
    }
    y += 52 * 1.5 + 34;
    const names = [facts.player1, facts.player2];
    names.forEach((n, i) => {
      const text = (i === 0 ? "" : "& ") + up(n);
      const ns = fit(ctx, text, fonts.display, 108, 44, INNER);
      y = line(ctx, draw, y, text, fonts.display, 400, ns, ink, 8);
    });
    return y;
  };

/* THE BRACKET, whole, as one tall image: winners rounds as columns, the
 * losers rounds under them, the grand final last. First names only — the
 * boxes are small. */
export type TeamNames = Map<string, { short: string }>;

const BOX_H = 86;
const GAP = 14;

function paintMatchBox(
  ctx: CanvasRenderingContext2D,
  fonts: Fonts,
  look: Look,
  draw: boolean,
  x: number,
  y: number,
  w: number,
  m: MatchState,
  names: TeamNames,
): void {
  if (!draw) return;
  const { ink, hot, dim } = palette(look);
  ctx.strokeStyle = dim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, BOX_H);
  const rowOf = (team: string | null, from: string, score: number | null, won: boolean, ry: number) => {
    const label = team ? names.get(team)?.short ?? "?" : from || "—";
    ctx.fillStyle = team ? (won ? hot : ink) : dim;
    const size = team ? fit(ctx, label.toUpperCase(), fonts.cond, 28, 16, w - 70, 700) : 16;
    ctx.font = team ? `700 ${size}px ${fonts.cond}` : `500 16px ${fonts.cond}`;
    ctx.textBaseline = "middle";
    ctx.fillText(team ? label.toUpperCase() : label, x + 12, ry);
    if (score !== null) {
      ctx.font = `400 26px ${fonts.display}`;
      ctx.textAlign = "right";
      ctx.fillText(String(score), x + w - 12, ry);
      ctx.textAlign = "left";
    }
  };
  const aWon = m.winner !== null && m.winner === m.a;
  const bWon = m.winner !== null && m.winner === m.b;
  rowOf(m.a, m.aFrom, m.scoreA, aWon, y + BOX_H * 0.27);
  ctx.fillStyle = palette(look).dim;
  ctx.fillRect(x + 10, y + BOX_H / 2 - 1, w - 20, 1);
  rowOf(m.b, m.bFrom, m.scoreB, bWon, y + BOX_H * 0.74);
  ctx.textBaseline = "alphabetic";
}

/* Lays the bracket out; returns the height used. One section per side,
 * columns per round, boxes vertically centered against round one. */
export const bracketCard =
  (state: BracketState, names: TeamNames, year: number, championName: string | null): CardPainter =>
  (ctx, fonts, look, draw, y0) => {
    const { ink, dim } = palette(look);
    let y = paintHeader(ctx, fonts, look, year, draw, y0);
    y += 4;

    const section = (title: string, rounds: MatchState[][], extraCol?: { title: string; m: MatchState }) => {
      const cols = rounds.length + (extraCol ? 1 : 0);
      if (cols === 0) return;
      const colGap = 22;
      const colW = Math.floor((INNER - colGap * (cols - 1)) / cols);
      const baseRows = Math.max(...rounds.map((r) => r.length), 1);
      const colH = baseRows * (BOX_H + GAP) - GAP;
      y = line(ctx, draw, y + 16, title, fonts.cond, 700, 30, ink, 14, 8);
      rounds.forEach((round, c) => {
        const x = PAD + c * (colW + colGap);
        const span = colH / round.length;
        round.forEach((m, i) => {
          const by = y + i * span + (span - BOX_H) / 2;
          paintMatchBox(ctx, fonts, look, draw, x, by, colW, m, names);
        });
      });
      if (extraCol) {
        const x = PAD + rounds.length * (colW + colGap);
        if (draw) {
          ctx.font = `700 18px ${fonts.cond}`;
          ctx.fillStyle = dim;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(extraCol.title.toUpperCase(), x, y + (colH - BOX_H) / 2 - 10);
        }
        paintMatchBox(ctx, fonts, look, draw, x, y + (colH - BOX_H) / 2, colW, extraCol.m, names);
      }
      y += colH + 10;
    };

    section("WINNERS", state.winners, { title: matchLabel(state.final), m: state.final });
    if (state.losers.length) section("LOSERS", state.losers);

    if (championName) {
      y += 18;
      const t = `CHAMPIONS: ${championName.toUpperCase()}`;
      const ts = fit(ctx, t, fonts.display, 64, 30, INNER);
      y = line(ctx, draw, y, t, fonts.display, 400, ts, palette(look).hot, 0);
    }
    return y;
  };
