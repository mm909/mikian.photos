import { MI, type CourseFile } from "../route/course";
import { RACE_DAY } from "../route/eta";

/* THE LASD26 STICKERS (owner, 2026-10-21: "I need to generate a bunch of
 * stickers for Just Friends and No Shortcuts and a combo of the 2 lets
 * start w/ stand alone then lets generate some combined and then lets make
 * others like a shareable of the route and maybe a few others").
 *
 * The same bones as the Hyrox stickers (src/app/hyrox/[event]/
 * stickerPaint.ts): a 1080-wide canvas, a padding, a fitter that shrinks a
 * line until it holds, card painters that lay out from a y and paint when
 * asked, and no React, so a harness can paint a card on its own. Three
 * FAMILIES, each with its own four looks: JUST FRIENDS (paper type on ink
 * with the lime dot, the way their "we saved you a spot" reads), NO
 * SHORTCUTS (their red on black, with the arrow their mark carries) and the
 * COMBINED cards (paper on ink with both: the lime dot and the red arrow).
 *
 * THE MARKS ARE TYPE (owner, 2026-10-21: "Type now, swap in the marks
 * later") — "justfriends." with a lime disc for the period, "NO SHORTCUTS"
 * with an arrow — set in the site's own faces; jfMark() and nsMark() are
 * the seam: when the owner sends hi-res files, those two paint images and
 * every card follows. NO HANDLES, NO ADDRESS (owner, same day: "No
 * handles"; CLAUDE.md: no address on a sticker). The course is 115 MI, the
 * measured line, not the poster's 120. */

export type Fonts = { display: string; body: string; mono: string };

export const W = 1080;
export const PAD = 72;
export const INNER = W - PAD * 2;

export const INK = "#111110";
export const PAPER = "#F4F3EE";
export const LIME = "#D0F858";
export const GREEN = "#3C7A0B";
export const NS_BLACK = "#0A0A0A";
/* The red of the No Shortcuts mark (sampled from their avatar, ~rgb(192,28,44)). */
export const NS_RED = "#C81E2E";

export type Family = "jf" | "ns" | "x";

/* A look: the ground an opaque look fills (null for a clear one), the type,
 * the lime (the JF dot) and the red (the NS arrow) as they read on that
 * ground. On the cream paper the lime stays a FILL (the dot is a shape) —
 * only type and thin lines would need the deep green. */
export type Look = { id: string; label: string; ground: string | null; ink: string; dim: string; lime: string; red: string };

export const LOOKS: Record<Family, Look[]> = {
  jf: [
    { id: "jf-ink", label: "Paper on ink", ground: INK, ink: PAPER, dim: "rgba(244,243,238,.62)", lime: LIME, red: NS_RED },
    { id: "jf-lime", label: "Ink on lime", ground: LIME, ink: INK, dim: "rgba(17,17,16,.62)", lime: PAPER, red: NS_RED },
    { id: "jf-clear-paper", label: "Paper on clear", ground: null, ink: PAPER, dim: "rgba(244,243,238,.62)", lime: LIME, red: NS_RED },
    { id: "jf-clear-ink", label: "Ink on clear", ground: null, ink: INK, dim: "rgba(17,17,16,.62)", lime: GREEN, red: NS_RED },
  ],
  ns: [
    { id: "ns-black", label: "Red on black", ground: NS_BLACK, ink: NS_RED, dim: "rgba(232,35,43,.7)", lime: LIME, red: NS_RED },
    { id: "ns-red", label: "Black on red", ground: NS_RED, ink: NS_BLACK, dim: "rgba(10,10,10,.66)", lime: LIME, red: NS_BLACK },
    { id: "ns-clear-red", label: "Red on clear", ground: null, ink: NS_RED, dim: "rgba(232,35,43,.7)", lime: LIME, red: NS_RED },
    { id: "ns-clear-black", label: "Black on clear", ground: null, ink: NS_BLACK, dim: "rgba(10,10,10,.66)", lime: LIME, red: NS_RED },
  ],
  x: [
    { id: "x-ink", label: "Paper on ink", ground: INK, ink: PAPER, dim: "rgba(244,243,238,.62)", lime: LIME, red: NS_RED },
    { id: "x-paper", label: "Ink on paper", ground: PAPER, ink: INK, dim: "rgba(17,17,16,.62)", lime: LIME, red: NS_RED },
    { id: "x-clear-paper", label: "Paper on clear", ground: null, ink: PAPER, dim: "rgba(244,243,238,.62)", lime: LIME, red: NS_RED },
    { id: "x-clear-ink", label: "Ink on clear", ground: null, ink: INK, dim: "rgba(17,17,16,.62)", lime: GREEN, red: NS_RED },
  ],
};

/* ─── Type ───────────────────────────────────────────────────────────────── */

/* The largest size, stepping down by 2 to `min`, at which `text` fits
 * `width`. Leaves ctx.font set to it. */
export function fit(ctx: CanvasRenderingContext2D, text: string, family: string, max: number, min: number, width: number, weight = 400, track = 0): number {
  let size = max;
  ctx.letterSpacing = `${track}px`;
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = "0px";
  return size;
}

/* One line of type from the left edge; returns the y after it. */
export function line(ctx: CanvasRenderingContext2D, draw: boolean, y: number, text: string, family: string, weight: number, size: number, color: string, gapAfter: number, track = 0, x = PAD): number {
  if (draw) {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    if (track) ctx.letterSpacing = `${track}px`;
    ctx.fillText(text, x, y + size * 0.86);
    if (track) ctx.letterSpacing = "0px";
  }
  return y + size + gapAfter;
}

/* Width of a run of type at a size, with tracking. */
function widthOf(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, size: number, track = 0): number {
  ctx.font = `${weight} ${size}px ${family}`;
  if (track) ctx.letterSpacing = `${track}px`;
  const w = ctx.measureText(text).width;
  if (track) ctx.letterSpacing = "0px";
  return w;
}

/* A filled disc — the Just Friends period, the dot after COAST. */
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/* An arrow, →, from (x, y) `w` wide, the No Shortcuts way: a bar with an
 * open head. */
export function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string, thick: number) {
  const head = Math.min(w * 0.45, thick * 3.2);
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - thick / 2, y);
  ctx.stroke();
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(x + w - head, y - head);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - head, y + head);
  ctx.stroke();
}

/* ─── The marks (type today; the seam for the real files) ────────────────── */

/* "justfriends." — lowercase display type, the period a lime disc. Draws
 * at (x, y) with the type `size`; returns the width used. */
export function jfMark(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, x: number, y: number, size: number): number {
  const word = "justfriends";
  const track = -size * 0.02;
  const w = widthOf(ctx, word, fonts.display, 400, size, track);
  const r = size * 0.11;
  if (draw) {
    line(ctx, true, y, word, fonts.display, 400, size, look.ink, 0, track, x);
    disc(ctx, x + w + r * 1.3, y + size * 0.86 - r, r, look.lime);
  }
  return w + r * 2.6;
}

/* "NO SHORTCUTS" with the arrow after it, one line, display caps. Returns
 * the width used. */
export function nsMark(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, x: number, y: number, size: number): number {
  const word = "NO SHORTCUTS";
  const track = size * 0.01;
  const w = widthOf(ctx, word, fonts.display, 400, size, track);
  const aw = size * 0.62;
  if (draw) {
    line(ctx, true, y, word, fonts.display, 400, size, look.ink, 0, track, x);
    arrow(ctx, x + w + size * 0.18, y + size * 0.86 - size * 0.34, aw, look.red, Math.max(3, size * 0.085));
  }
  return w + size * 0.18 + aw;
}

/* The two names together, small, for the foot of the combined cards:
 * NO SHORTCUTS → × justfriends. Returns the y after. */
export function lockupLine(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, y: number, size = 34): number {
  const nsW = nsMark(ctx, fonts, look, false, PAD, y, size);
  const xW = widthOf(ctx, "×", fonts.body, 700, size * 0.9);
  const gap = size * 0.5;
  nsMark(ctx, fonts, look, draw, PAD, y, size);
  if (draw) line(ctx, true, y + size * 0.02, "×", fonts.body, 700, size * 0.9, look.dim, 0, 0, PAD + nsW + gap);
  jfMark(ctx, fonts, look, draw, PAD + nsW + gap + xW + gap, y, size);
  return y + size + 0;
}

/* "LA → SD" as one lockup, as big as the width allows; returns the y after.
 * The arrow takes the family's colour — the lime on a Just Friends card, the
 * red on a No Shortcuts one. */
function laToSd(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, y: number, maxSize: number, arrowColor: string): number {
  // Size against "LA  SD" plus an arrow 0.9 em wide.
  let size = maxSize;
  const gap = () => size * 0.14;
  const aw = () => size * 0.9;
  for (; size > 80; size -= 4) {
    const w = widthOf(ctx, "LA", fonts.display, 400, size) + gap() + aw() + gap() + widthOf(ctx, "SD", fonts.display, 400, size);
    if (w <= INNER) break;
  }
  const laW = widthOf(ctx, "LA", fonts.display, 400, size);
  if (draw) {
    line(ctx, true, y, "LA", fonts.display, 400, size, look.ink, 0, 0, PAD);
    arrow(ctx, PAD + laW + gap(), y + size * 0.86 - size * 0.3, aw(), arrowColor, Math.max(6, size * 0.09));
    line(ctx, true, y, "SD", fonts.display, 400, size, look.ink, 0, 0, PAD + laW + gap() + aw() + gap());
  }
  return y + size;
}

/* ─── Cards ──────────────────────────────────────────────────────────────── */

/* A card painter: lays out from `y0`, paints when `draw`, returns the y it
 * ended at. */
export type CardPainter = (ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, y0: number) => number;

/* Paints a card either at its own height (frame = null: the canvas is the
 * card plus the padding) or at the top of a frame of a fixed height (a
 * story or a post). Returns the canvas height. */
export function placeCard(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, frame: number | null, card: CardPainter): number {
  if (draw) card(ctx, fonts, look, true, PAD);
  if (frame !== null) return frame;
  return card(ctx, fonts, look, false, 0) + PAD * 2;
}

/* Whole days from the viewer's today to race day. */
export function daysUntilRace(now = new Date()): number {
  const [y, m, d] = RACE_DAY.split("-").map(Number);
  const first = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((first - today) / 86_400_000);
}

const DATE = "10.23.26";
const COAST = "SANTA MONICA → SAN DIEGO";
const FINISH_LINE = "SANTA MONICA → PACIFIC BEACH";
const RUN_MI = "115 MI";

/* A mono eyebrow / caption line in the dimmed cut. */
const small = (ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, y: number, text: string, size = 30, gap = 0, dim = true) =>
  line(ctx, draw, y, text, fonts.mono, 700, fit(ctx, text, fonts.mono, size, 18, INNER, 700, size * 0.1), dim ? look.dim : look.ink, gap, size * 0.1);

/* ── Just Friends ── */

/* 1. THE MARK: "justfriends." as wide as the card. */
export const jfMarkCard: CardPainter = (ctx, fonts, look, draw, y0) => {
  let size = 220;
  for (; size > 60; size -= 4) if (jfMark(ctx, fonts, look, false, PAD, y0, size) <= INNER) break;
  jfMark(ctx, fonts, look, draw, PAD, y0, size);
  return y0 + size * 0.92;
};

/* 2. RUN IT DOWN THE COAST. — the landing's line, the lime disc as the full stop. */
export const jfCoastCard: CardPainter = (ctx, fonts, look, draw, y0) => {
  const lines = ["RUN IT", "DOWN THE", "COAST"];
  const size = Math.min(...lines.map((t) => fit(ctx, t, fonts.display, 230, 80, INNER - 40)));
  let y = y0;
  lines.forEach((t, i) => {
    const last = i === lines.length - 1;
    if (last && draw) {
      const w = widthOf(ctx, t, fonts.display, 400, size);
      const r = size * 0.1;
      disc(ctx, PAD + w + r * 1.5, y + size * 0.86 - r, r, look.lime);
    }
    y = line(ctx, draw, y, t, fonts.display, 400, size, look.ink, last ? 0 : -size * 0.08);
  });
  y += 36;
  jfMark(ctx, fonts, look, draw, PAD, y, 54);
  return y + 54;
};

/* 3. LA → SD, the coast line and the date, the mark. */
export const jfLaSdCard: CardPainter = (ctx, fonts, look, draw, y0) => {
  let y = laToSd(ctx, fonts, look, draw, y0, 300, look.lime);
  y += 22;
  y = small(ctx, fonts, look, draw, y, COAST, 32, 10);
  y = small(ctx, fonts, look, draw, y, DATE, 32, 36);
  jfMark(ctx, fonts, look, draw, PAD, y, 54);
  return y + 54;
};

/* 4. DAYS AWAY: the mark, the count huge, from the phone's own calendar. */
export const jfDaysCard: CardPainter = (ctx, fonts, look, draw, y0) => {
  let y = y0;
  jfMark(ctx, fonts, look, draw, PAD, y, 54);
  y += 54 + 26;
  const n = daysUntilRace();
  const big = n > 0 ? String(n) : n === 0 ? "TODAY" : "DONE";
  const under = n > 1 ? "DAYS AWAY" : n === 1 ? "DAY AWAY" : n === 0 ? "RUN IT DOWN THE COAST." : "WE RAN IT DOWN THE COAST.";
  const bs = fit(ctx, big, fonts.display, 360, 90, INNER);
  y = line(ctx, draw, y, big, fonts.display, 400, bs, look.ink, 4);
  y = line(ctx, draw, y, under, fonts.display, 400, fit(ctx, under, fonts.display, 64, 30, INNER), look.ink, 0);
  return y;
};

/* ── No Shortcuts ── */

/* 5. THE MARK: NO / SHORTCUTS stacked, the arrow on the first line. */
export const nsMarkCard: CardPainter = (ctx, fonts, look, draw, y0) => {
  const size = fit(ctx, "SHORTCUTS", fonts.display, 230, 80, INNER);
  let y = y0;
  const noW = widthOf(ctx, "NO", fonts.display, 400, size);
  y = line(ctx, draw, y, "NO", fonts.display, 400, size, look.ink, -size * 0.1);
  if (draw) arrow(ctx, PAD + noW + size * 0.2, y0 + size * 0.86 - size * 0.32, Math.min(INNER - noW - size * 0.2, size * 1.6), look.red, Math.max(6, size * 0.085));
  y = line(ctx, draw, y, "SHORTCUTS", fonts.display, 400, size, look.ink, 0);
  return y;
};

/* 6. THE RACE: NO SHORTCUTS / TIME TRIAL / 7TH EDITION / LA → SD · the date. */
export const nsRaceCard: CardPainter = (ctx, fonts, look, draw, y0) => {
  let y = y0;
  let size = 140;
  for (; size > 60; size -= 4) if (nsMark(ctx, fonts, look, false, PAD, y, size) <= INNER) break;
  nsMark(ctx, fonts, look, draw, PAD, y, size);
  y += size - size * 0.08;
  y = line(ctx, draw, y, "TIME TRIAL", fonts.display, 400, size, look.ink, 24);
  y = small(ctx, fonts, look, draw, y, "7TH EDITION", 34, 10, false);
  y = small(ctx, fonts, look, draw, y, `LA → SD · ${DATE}`, 34, 0);
  return y;
};

/* 7. THE MILES: 115 MILES. / the finish line / the mark. No "one van, one
 * long Friday" (owner, 2026-10-21: "Lets remove 'one van. one long friday'"). */
export const nsMilesCard: CardPainter = (ctx, fonts, look, draw, y0) => {
  let y = y0;
  const t = "115 MILES.";
  y = line(ctx, draw, y, t, fonts.display, 400, fit(ctx, t, fonts.display, 220, 80, INNER), look.ink, 22);
  y = small(ctx, fonts, look, draw, y, FINISH_LINE, 32, 34, false);
  let ms = 48;
  for (; ms > 24; ms -= 2) if (nsMark(ctx, fonts, look, false, PAD, y, ms) <= INNER) break;
  nsMark(ctx, fonts, look, draw, PAD, y, ms);
  return y + ms;
};

/* ── Combined ── */

/* 8. THE LOCKUP: both names, LASD26 huge, the date. */
export const xLockupCard: CardPainter = (ctx, fonts, look, draw, y0) => {
  let y = y0;
  let ms = 64;
  for (; ms > 28; ms -= 2) if (nsMark(ctx, fonts, look, false, PAD, y, ms) <= INNER) break;
  nsMark(ctx, fonts, look, draw, PAD, y, ms);
  y += ms + 6;
  if (draw) line(ctx, true, y, "×", fonts.body, 700, ms * 0.8, look.dim, 0);
  y += ms * 0.8 + 6;
  jfMark(ctx, fonts, look, draw, PAD, y, ms);
  y += ms + 40;
  const t = "LASD26";
  y = line(ctx, draw, y, t, fonts.display, 400, fit(ctx, t, fonts.display, 260, 90, INNER), look.ink, 16);
  y = small(ctx, fonts, look, draw, y, `${COAST} · ${DATE}`, 32, 0);
  return y;
};

/* ── 11. THE ROUTE ── the course line from the real coordinates: the coast
 * shape, START and FINISH tags, the drive dashed, a tick every 25 miles,
 * then the miles and the line under it. The map is as tall as the width
 * allows at the course's own proportions. */
export const xRouteCard =
  (course: CourseFile | null): CardPainter =>
  (ctx, fonts, look, draw, y0) => {
    let y = y0;
    const boxW = INNER;
    const boxH = Math.round(INNER * 1.02);
    if (course && course.coords.length > 1) {
      const [minLon, minLat, maxLon, maxLat] = course.bbox;
      const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
      const spanX = (maxLon - minLon) * kx;
      const spanY = maxLat - minLat;
      const inset = 70;
      const s = Math.min((boxW - inset * 2) / spanX, (boxH - inset * 2) / spanY);
      const ox = PAD + (boxW - spanX * s) / 2;
      const oy = y + (boxH - spanY * s) / 2;
      const X = (lon: number) => ox + (lon - minLon) * kx * s;
      const Y = (lat: number) => oy + (maxLat - lat) * s;
      if (draw) {
        // The run legs, split at the drive.
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        const drives = [...course.drives].sort((a, b) => a.at - b.at);
        let start = 0;
        const legs: [number, number][][] = [];
        for (const d of drives) {
          legs.push(course.coords.slice(start, d.at + 1));
          start = d.at + 1;
        }
        legs.push(course.coords.slice(start));
        const stroke = (coords: [number, number][], color: string, width: number, dash: number[]) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.setLineDash(dash);
          ctx.beginPath();
          coords.forEach(([lon, lat], i) => (i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat))));
          ctx.stroke();
          ctx.setLineDash([]);
        };
        for (const leg of legs) if (leg.length > 1) stroke(leg, look.ink, 9, []);
        for (const d of drives) stroke(d.coords && d.coords.length > 1 ? d.coords : [d.from, d.to], look.dim, 4, [10, 12]);
        // A tick every 25 miles, numbered.
        for (let mile = 25; mile * MI < course.length_m; mile += 25) {
          const target = mile * MI;
          let i = 1;
          while (i < course.coords.length - 1 && course.cum_m[i] < target) i++;
          const [lon, lat] = course.coords[i];
          disc(ctx, X(lon), Y(lat), 11, look.lime);
          ctx.strokeStyle = look.ink;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(X(lon), Y(lat), 11, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = `700 26px ${fonts.mono}`;
          ctx.fillStyle = look.ink;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(String(mile), X(lon) + 20, Y(lat));
          ctx.textBaseline = "alphabetic";
        }
        // START and FINISH as tags, hanging inward (the course runs NW → SE).
        const tagAt = (text: string, lon: number, lat: number, right: boolean, fill: string, type: string) => {
          ctx.font = `700 24px ${fonts.mono}`;
          ctx.letterSpacing = "3px";
          const w = ctx.measureText(text).width + 28;
          const h = 42;
          const x = right ? X(lon) + 18 : X(lon) - 18 - w;
          const yy = right ? Y(lat) - h - 12 : Y(lat) + 12;
          ctx.fillStyle = fill;
          ctx.fillRect(x, yy, w, h);
          ctx.fillStyle = type;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(text, x + 14, yy + h / 2 + 1);
          ctx.letterSpacing = "0px";
          ctx.textBaseline = "alphabetic";
          disc(ctx, X(lon), Y(lat), 12, fill);
          ctx.strokeStyle = look.ink;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(X(lon), Y(lat), 12, 0, Math.PI * 2);
          ctx.stroke();
        };
        const first = course.coords[0];
        const last = course.coords[course.coords.length - 1];
        const onInk = look.ground === INK || look.ground === NS_BLACK || look.ink === PAPER;
        tagAt("START", first[0], first[1], true, look.ink, onInk ? INK : PAPER);
        tagAt("FINISH", last[0], last[1], false, look.lime, INK);
      }
    }
    y += boxH + 30;
    y = line(ctx, draw, y, RUN_MI, fonts.display, 400, fit(ctx, RUN_MI, fonts.display, 150, 60, INNER), look.ink, 14);
    y = small(ctx, fonts, look, draw, y, `${FINISH_LINE} · ${DATE}`, 30, 40, false);
    y = lockupLine(ctx, fonts, look, draw, y, 34);
    return y;
  };
