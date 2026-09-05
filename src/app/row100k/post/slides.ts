/* The Rowtember Instagram carousel, painted on canvas.
 *
 * These eight slides were designed and approved as HTML/CSS (the laptop
 * script the owner ran by hand) and are ported here one-for-one: same fonts,
 * sizes, weights, letter-spacing, colours, margins and alignment. Nothing in
 * here is a redesign — when a number below looks arbitrary it is the CSS
 * value from that design.
 *
 * The port keeps the CSS box model rather than eyeballing baselines: every
 * block advances a `y` cursor by its line-box height, and the baseline
 * inside a line box comes from the family's own metrics — line-height:normal
 * and the baseline's offset inside it, measured off the live DOM and handed
 * in as PostFonts.box. That is the box the browser stacks lines with, so a
 * heading with line-height .98 lands where it landed in the HTML.
 *
 * Fonts are passed in, never hardcoded: next/font hashes the family names at
 * build time, so the caller reads the real names off probe spans in the live
 * DOM (same trick as share/ShareMenu.tsx) and hands them over.
 *
 * Slide size is 1080x1350 — Instagram 4:5, not the 1080x1080 the share
 * stickers use.
 */

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;

/* Palette, lifted straight from the approved design. The photo slides are
 * black and white through and through: the accent that used to be a matte
 * blue (#8FB3CC) went back to white on the owner's call (2026-09-05, "change
 * the color back to black and white"), so emphasis comes from size and
 * weight alone. The name stays so every call site reads as the accent. */
const MATTE = "#ffffff";
const RULE = "rgba(255,255,255,0.85)";
const DOT_LINE = "rgba(255,255,255,0.34)";
const GREEN = "#0c2015";
const GOLD = "#d3ab5d";
const CREAM = "#f2ead7";
const CREAM_DIM = "#e3d9bf";
const SAGE = "#a9bba6";
const MEDAL_GOLD = "#D4AF37";
const MEDAL_SILVER = "#C0C0C0";
const MEDAL_BRONZE = "#CD7F32";
const WHITE_DIM = "rgba(255,255,255,0.72)";
const WHITE_SOFT = "rgba(255,255,255,0.75)";
const WHITE_TEXT = "rgba(255,255,255,0.82)";

/* ------------------------------------------------------------------ data */

export type PostRow = {
  name: string;
  num: number;
  meters: number;
  /** Blackout (lib/blackoutRules.ts): the number is hidden — `meters` is a
   * tier floor and `digits` says how many blocks the board slide draws. */
  masked?: boolean;
  digits?: number;
};
export type PostRecord = {
  label: string;
  value: string;
  who: string;
  /** Blackout (lib/blackoutRules.ts): the holder is one of the hidden
   * fifteen — `value` is "" and `shape` is its silhouette ("#:##.#" for a
   * split, "##,### m" for a distance), drawn as blocks on the stats slide. */
  masked?: boolean;
  shape?: string;
};

export type PostData = {
  /** "Sep 3" — the Pacific day the numbers were read. */
  asOfDay: string;
  /** "2026-09-03" — the same day, for filenames. */
  asOfIso: string;
  /** September days still to come, Pacific. */
  daysLeft: number;
  totalMeters: number;
  /** Total time on the erg, "115h 30m". */
  totalTime: string;
  totalSessions: number;
  rowersLogged: number;
  /** Everyone with meters, best first. */
  standings: PostRow[];
  /** The record list on the stats slide, in render order. */
  records: PostRecord[];
  club50: PostRow[];
  /** First rower over 100,000 m, by the crossing rule in ../firstToGoal. */
  first100k: PostRow | null;
  /** Sessions logged per [September day][Pacific hour]. */
  hourGrid: number[][];
  /** Newest gallery photos, as stable public CDN URLs. */
  photos: string[];
};

/* How a family lays out, per 1px of font-size: `lh` is what CSS
 * line-height:normal resolves to, `baseline` is how far the baseline sits
 * below the top of that line box. Measured off the live DOM (see PostPack),
 * because canvas fontBoundingBox* reports the ink box of the glyphs, which
 * is not the box the browser stacks lines with — using it puts every block
 * on a paper slide about a line-tenth too high. */
export type FontBox = { lh: number; baseline: number };

export type PostFonts = {
  black: string;
  mono: string;
  archivo: string;
  box?: { black?: FontBox; mono?: FontBox; archivo?: FontBox };
};

export type SlideAssets = {
  /** The gallery photo for this slide, or null when it could not load. */
  photo: HTMLImageElement | null;
  /** Grizzly Health marks, for the partner slide. */
  bear: HTMLImageElement | null;
  wordmark: HTMLImageElement | null;
};

export type Slide = {
  id: string;
  /** Menu label under the preview. */
  label: string;
  /** Filename inside the zip / share sheet. */
  file: string;
  /** True when the slide paints a gallery photo full-bleed. */
  usesPhoto: boolean;
  draw: (ctx: Ctx, data: PostData, fonts: PostFonts, assets: SlideAssets) => void;
};

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------ formatting */

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const meters = (v: number) => `${n(v)} m`;
const pad2 = (v: number) => String(v).padStart(2, "0");

const medalColor = (place: number): string | null =>
  place === 1 ? MEDAL_GOLD : place === 2 ? MEDAL_SILVER : place === 3 ? MEDAL_BRONZE : null;

/* -------------------------------------------------------------- type box */

type Metrics = { asc: number; desc: number; lh: number };

/* Which family a font shorthand names — the ratios are per family, the font
 * strings carry a weight and a size in front. Black is checked first: its
 * family name contains the plain Archivo one. */
function boxFor(fonts: PostFonts, font: string): FontBox | undefined {
  const box = fonts.box;
  if (!box) return undefined;
  if (font.includes(fonts.black)) return box.black;
  if (font.includes(fonts.mono)) return box.mono;
  if (font.includes(fonts.archivo)) return box.archivo;
  return undefined;
}

/* The font's own box, at this size. `lh` is what CSS line-height:normal
 * resolves to. Prefers the DOM-measured ratios; falls back to the canvas
 * font bounding box, and then to rough Space-Mono-ish ratios on the (old)
 * browsers that report neither. */
function metricsOf(ctx: Ctx, fonts: PostFonts, font: string, size: number): Metrics {
  const ratio = boxFor(fonts, font);
  if (ratio) {
    const asc = ratio.baseline * size;
    const lh = ratio.lh * size;
    return { asc, desc: lh - asc, lh };
  }
  ctx.font = font;
  const m = ctx.measureText("Hxdgp");
  const rawAsc = m.fontBoundingBoxAscent;
  const rawDesc = m.fontBoundingBoxDescent;
  const asc = Number.isFinite(rawAsc) && rawAsc > 0 ? rawAsc : size * 1.05;
  const desc = Number.isFinite(rawDesc) && rawDesc > 0 ? rawDesc : size * 0.32;
  return { asc, desc, lh: asc + desc };
}

/* Where the baseline sits inside a line box of height `lh` whose top edge is
 * at `top` — the glyph box is centred in the line box (half-leading), which
 * is how a heading with line-height under 1 still sits where CSS put it. */
function baselineOf(top: number, lh: number, m: Metrics): number {
  return top + (lh - (m.asc + m.desc)) / 2 + m.asc;
}

/* Letter-spacing: use the canvas property where it exists (kerning survives),
 * otherwise draw character by character. Both include the trailing space
 * after the last glyph, exactly like CSS — which is what keeps centred
 * tracked lines sitting where the HTML put them. */
function hasLetterSpacing(ctx: Ctx): boolean {
  return typeof ctx.letterSpacing === "string";
}

function measure(ctx: Ctx, text: string, font: string, tracking = 0): number {
  ctx.font = font;
  if (!tracking) return ctx.measureText(text).width;
  if (hasLetterSpacing(ctx)) {
    ctx.letterSpacing = `${tracking}px`;
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = "0px";
    return w;
  }
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return w;
}

function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  baseline: number,
  font: string,
  color: string,
  tracking = 0,
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (!tracking) {
    ctx.fillText(text, x, baseline);
    return;
  }
  if (hasLetterSpacing(ctx)) {
    ctx.letterSpacing = `${tracking}px`;
    ctx.fillText(text, x, baseline);
    ctx.letterSpacing = "0px";
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, baseline);
    cx += ctx.measureText(ch).width + tracking;
  }
}

function drawCentered(
  ctx: Ctx,
  text: string,
  cx: number,
  baseline: number,
  font: string,
  color: string,
  tracking = 0,
): void {
  drawText(ctx, text, cx - measure(ctx, text, font, tracking) / 2, baseline, font, color, tracking);
}

function drawRight(
  ctx: Ctx,
  text: string,
  right: number,
  baseline: number,
  font: string,
  color: string,
  tracking = 0,
): void {
  drawText(ctx, text, right - measure(ctx, text, font, tracking), baseline, font, color, tracking);
}

/* A line built from differently coloured pieces — the headlines that carry
 * one water-blue word. */
type Run = { text: string; color: string; font?: string };

function runsWidth(ctx: Ctx, runs: Run[], font: string, tracking = 0): number {
  return runs.reduce((w, r) => w + measure(ctx, r.text, r.font ?? font, tracking), 0);
}

function drawRuns(
  ctx: Ctx,
  runs: Run[],
  x: number,
  baseline: number,
  font: string,
  tracking = 0,
): void {
  let cx = x;
  for (const r of runs) {
    const f = r.font ?? font;
    drawText(ctx, r.text, cx, baseline, f, r.color, tracking);
    cx += measure(ctx, r.text, f, tracking);
  }
}

function drawRunsCentered(
  ctx: Ctx,
  runs: Run[],
  cx: number,
  baseline: number,
  font: string,
  tracking = 0,
): void {
  drawRuns(ctx, runs, cx - runsWidth(ctx, runs, font, tracking) / 2, baseline, font, tracking);
}

/* text-overflow: ellipsis, for the names that can run long. */
function ellipsize(ctx: Ctx, text: string, maxW: number, font: string): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/* Blackout digits: one fat block per hidden digit with a real comma between
 * thousands groups, right-aligned on `right` like the meters text it stands
 * in for. Same geometry as share/cards.ts drawBlockDigits (a 0.6-size cell
 * per digit, the block 0.54 wide and 0.92 tall on the baseline) — ported
 * rather than imported so this module keeps its own font helpers. Returns
 * the width so the name can yield to it. */
function drawBlocks(
  ctx: Ctx,
  right: number,
  baseline: number,
  digits: number,
  size: number,
  font: string,
  color: string,
): number {
  const count = Math.max(1, Math.floor(digits));
  const cell = size * 0.6;
  const gap = size * 0.06;
  const block = cell - gap;
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  const commaW = ctx.measureText(",").width;
  const width = count * cell + Math.floor((count - 1) / 3) * commaW;
  let x = right - width;
  for (let i = 0; i < count; i++) {
    ctx.fillRect(x + gap / 2, baseline - size * 0.88, block, size * 0.92);
    x += cell;
    if (i < count - 1 && (count - i - 1) % 3 === 0) {
      ctx.fillText(",", x, baseline);
      x += commaW;
    }
  }
  return width;
}

/* Blackout blocks for a number of any shape (blackoutRules.ts shapeOf): a
 * block per `#` cell, every other character — a colon, a point, a comma,
 * a unit — as the real glyph, left-aligned at `x`. The stats slide's
 * record list needs this because its values are splits and distances, not
 * bare digit runs. Same cell geometry as drawBlocks. Returns the width. */
function drawBlockShape(
  ctx: Ctx,
  x: number,
  baseline: number,
  shape: string,
  size: number,
  font: string,
  color: string,
): number {
  const cell = size * 0.6;
  const gap = size * 0.06;
  const block = cell - gap;
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of shape || "#") {
    if (ch === "#") {
      ctx.fillRect(cx + gap / 2, baseline - size * 0.88, block, size * 0.92);
      cx += cell;
    } else {
      ctx.fillText(ch, cx, baseline);
      cx += ctx.measureText(ch).width;
    }
  }
  return cx - x;
}

function shadow(ctx: Ctx, color: string, blur: number, offsetY: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = offsetY;
}

function noShadow(ctx: Ctx): void {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/* A stack of blocks with CSS margin-top, centred in the slide — the three
 * slides whose content is vertically centred rather than flowing from the
 * top. */
type Block = { gap: number; h: number; draw: (top: number) => void };

function drawCenteredStack(blocks: Block[]): void {
  const total = blocks.reduce((sum, b, i) => sum + (i === 0 ? 0 : b.gap) + b.h, 0);
  let y = (SLIDE_H - total) / 2;
  blocks.forEach((b, i) => {
    if (i > 0) y += b.gap;
    b.draw(y);
    y += b.h;
  });
}

/* --------------------------------------------------------------- photos */

/* object-fit: cover. */
function drawCover(ctx: Ctx, img: HTMLImageElement): void {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(SLIDE_W / iw, SLIDE_H / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(img, (SLIDE_W - w) / 2, (SLIDE_H - h) / 2, w, h);
}

/* filter: grayscale(1) contrast(1.04) brightness(1.32), applied by hand
 * rather than through ctx.filter — the pixel math is identical everywhere,
 * where ctx.filter is missing on older Safari. Reading the pixels back is
 * only safe because gallery images are loaded with crossOrigin=anonymous
 * against a bucket that allows GET; a tainted canvas would throw here rather
 * than later at toBlob(). */
function toBlackAndWhite(ctx: Ctx): void {
  const image = ctx.getImageData(0, 0, SLIDE_W, SLIDE_H);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    // Rec.709 luminance, the sRGB matrix CSS grayscale() uses.
    const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    // contrast(1.04) about the 0.5 midpoint, then brightness(1.32).
    const v = (lum * 1.04 - 0.02 * 255) * 1.32;
    const c = v < 0 ? 0 : v > 255 ? 255 : v;
    px[i] = c;
    px[i + 1] = c;
    px[i + 2] = c;
  }
  ctx.putImageData(image, 0, 0);
}

function scrim(ctx: Ctx, stops: [number, number][]): void {
  const grad = ctx.createLinearGradient(0, 0, 0, SLIDE_H);
  for (const [at, alpha] of stops) grad.addColorStop(at, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
}

/* Photo bed: the picture in black and white under its scrim. With no photo
 * (none uploaded, or the load failed) the slide keeps its dark ground so the
 * white type still reads. */
function photoBed(ctx: Ctx, photo: HTMLImageElement | null, stops: [number, number][]): void {
  ctx.fillStyle = "#23272b";
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
  if (photo) {
    drawCover(ctx, photo);
    toBlackAndWhite(ctx);
  }
  scrim(ctx, stops);
}

const BOARD_SCRIM: [number, number][] = [
  [0, 0.42],
  [0.46, 0.26],
  [0.72, 0.1],
  [1, 0.22],
];
const STATS_SCRIM: [number, number][] = [
  [0, 0.66],
  [0.45, 0.58],
  [1, 0.64],
];
const CONGRATS_SCRIM: [number, number][] = [
  [0, 0.64],
  [0.45, 0.56],
  [1, 0.66],
];
const CTA_SCRIM: [number, number][] = [
  [0, 0.34],
  [0.3, 0.66],
  [0.62, 0.7],
  [1, 0.52],
];
const HOURS_SCRIM: [number, number][] = [
  [0, 0.55],
  [0.5, 0.62],
  [1, 0.7],
];

/* ----------------------------------------------------------- text columns */

const M = 70; // every slide keeps a 70px side margin
const CONTENT_L = M;
const CONTENT_R = SLIDE_W - M;
const CONTENT_W = CONTENT_R - CONTENT_L;

/* A solid rule. Borders carry no text-shadow, so it is cleared first. */
function rule(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.save();
  noShadow(ctx);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/* A dotted 2px rule — the separator inside the record and club lists. */
function dottedRule(ctx: Ctx, y: number, left: number, right: number, color: string): void {
  ctx.save();
  noShadow(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(left, y + 1);
  ctx.lineTo(right, y + 1);
  ctx.stroke();
  ctx.restore();
}

/* --------------------------------------------------------- 1-3: the board */

/* Ten places over a photo: bold mono title, dim section label, then a
 * place / name / meters list in white mono, each line carrying a soft shadow
 * so it stays legible on a bright frame. */
function drawBoardSlide(
  ctx: Ctx,
  data: PostData,
  fonts: PostFonts,
  assets: SlideAssets,
  start: number,
): void {
  photoBed(ctx, assets.photo, BOARD_SCRIM);
  const rows = data.standings.slice(start - 1, start + 9);

  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.65)", 16, 3);

  const titleFont = `700 46px ${fonts.mono}`;
  const titleM = metricsOf(ctx, fonts, titleFont, 46);
  let y = 96;
  drawText(
    ctx,
    `Rowtember · ${data.asOfDay}`,
    CONTENT_L,
    baselineOf(y, titleM.lh, titleM),
    titleFont,
    "#ffffff",
    46 * 0.01,
  );
  y += titleM.lh + 22;

  const secFont = `29px ${fonts.mono}`;
  const secM = metricsOf(ctx, fonts, secFont, 29);
  drawText(
    ctx,
    `The board · ${start}–${start + 9}`,
    CONTENT_L,
    baselineOf(y, secM.lh, secM),
    secFont,
    "rgba(255,255,255,0.66)",
    0,
  );
  y += secM.lh + 52;

  // Rows are 88px flex lines aligned on the baseline of their tallest item.
  const rowFont = `42px ${fonts.mono}`;
  const placeFont = `31px ${fonts.mono}`;
  const rowM = metricsOf(ctx, fonts, rowFont, 42);
  const nameX = CONTENT_L + 56 + 24; // place column (56) + flex gap (24)
  rows.forEach((r, i) => {
    const place = start + i;
    const baseline = y + i * 88 + rowM.asc;
    // A blacked-out row gets blocks where the digits would go, the " m"
    // unit kept: the carousel leaves the site, so it hides what the board
    // hides.
    let metersW: number;
    if (r.masked) {
      const unit = " m";
      drawRight(ctx, unit, CONTENT_R, baseline, rowFont, "#ffffff");
      const unitW = measure(ctx, unit, rowFont);
      const digits = r.digits ?? String(Math.max(0, Math.round(r.meters))).length;
      metersW =
        unitW + drawBlocks(ctx, CONTENT_R - unitW, baseline, digits, 42, rowFont, "#ffffff");
    } else {
      const metersText = meters(r.meters);
      drawRight(ctx, metersText, CONTENT_R, baseline, rowFont, "#ffffff");
      metersW = measure(ctx, metersText, rowFont);
    }
    drawText(
      ctx,
      pad2(place),
      CONTENT_L,
      baseline,
      placeFont,
      medalColor(place) ?? "rgba(255,255,255,0.55)",
    );
    const maxW = CONTENT_R - metersW - 24 - nameX;
    drawText(ctx, ellipsize(ctx, r.name, maxW, rowFont), nameX, baseline, rowFont, "#ffffff");
  });

  ctx.restore();
  noShadow(ctx);
}

/* ----------------------------------------------------------- 4: the stats */

/* The month so far, over a photo: the kick line, the big matte-blue total,
 * the trio under white rules, then the record list with dotted leaders. */
function drawStatsSlide(ctx: Ctx, data: PostData, fonts: PostFonts, assets: SlideAssets): void {
  photoBed(ctx, assets.photo, STATS_SCRIM);
  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.7)", 18, 3);

  const kickFont = `700 25px ${fonts.mono}`;
  const kickM = metricsOf(ctx, fonts, kickFont, 25);
  let y = 92;
  drawText(
    ctx,
    `ROWTEMBER 2026 · ${data.asOfDay}`.toUpperCase(),
    CONTENT_L,
    baselineOf(y, kickM.lh, kickM),
    kickFont,
    WHITE_DIM,
    25 * 0.18,
  );
  y += kickM.lh + 26;

  const bigFont = `122px ${fonts.black}`;
  const bigM = metricsOf(ctx, fonts, bigFont, 122);
  drawText(
    ctx,
    `${n(data.totalMeters)} m`,
    CONTENT_L,
    baselineOf(y, 122, bigM),
    bigFont,
    MATTE,
    -122 * 0.01,
  );
  y += 122 + 16;

  const labFont = `24px ${fonts.mono}`;
  const labM = metricsOf(ctx, fonts, labFont, 24);
  drawText(
    ctx,
    "METERS ROWED · EVERYONE TOGETHER",
    CONTENT_L,
    baselineOf(y, labM.lh, labM),
    labFont,
    WHITE_TEXT,
    24 * 0.16,
  );
  y += labM.lh + 54;

  // The trio: three columns under 3px rules.
  const colW = (CONTENT_W - 48) / 3;
  const valueFont = `52px ${fonts.black}`;
  const valueM = metricsOf(ctx, fonts, valueFont, 52);
  const capFont = `19px ${fonts.mono}`;
  const capM = metricsOf(ctx, fonts, capFont, 19);
  const capLh = 19 * 1.4;
  const trio: { value: string; caption: string[] }[] = [
    { value: data.totalTime, caption: ["ON THE ERG"] },
    { value: n(data.totalSessions), caption: ["SESSIONS", "LOGGED"] },
    { value: n(data.rowersLogged), caption: ["ROWERS ON", "THE BOARD"] },
  ];
  let trioBottom = y;
  trio.forEach((col, i) => {
    const x = CONTENT_L + i * (colW + 24);
    rule(ctx, x, y, colW, 3, RULE);
    let cy = y + 3 + 16;
    drawText(ctx, col.value, x, baselineOf(cy, 52, valueM), valueFont, "#ffffff", 0);
    cy += 52 + 10;
    for (const line of col.caption) {
      drawText(ctx, line, x, baselineOf(cy, capLh, capM), capFont, WHITE_SOFT, 19 * 0.12);
      cy += capLh;
    }
    trioBottom = Math.max(trioBottom, cy);
  });
  y = trioBottom + 54;

  // The record list.
  rule(ctx, CONTENT_L, y, CONTENT_W, 3, RULE);
  y += 3 + 10;
  const labelFont = `21px ${fonts.mono}`;
  const recValueFont = `700 28px ${fonts.mono}`;
  const whoFont = `26px ${fonts.mono}`;
  const recM = metricsOf(ctx, fonts, recValueFont, 28);
  const rows = data.records;
  rows.forEach((rec, i) => {
    const baseline = y + 14 + recM.asc;
    drawText(ctx, rec.label.toUpperCase(), CONTENT_L, baseline, labelFont, WHITE_DIM, 21 * 0.1);
    // A hidden holder's value is blocks in the shape of the number — the
    // page sent no value, only the silhouette.
    if (rec.masked) {
      drawBlockShape(ctx, CONTENT_L + 296, baseline, rec.shape ?? "#", 28, recValueFont, MATTE);
    } else {
      drawText(ctx, rec.value, CONTENT_L + 296, baseline, recValueFont, MATTE, 0);
    }
    const whoX = CONTENT_L + 492; // 280 + 16 + 180 + 16
    drawText(
      ctx,
      ellipsize(ctx, rec.who, CONTENT_R - whoX, whoFont),
      whoX,
      baseline,
      whoFont,
      "#ffffff",
      0,
    );
    y += 14 + recM.lh + 14;
    if (i < rows.length - 1) {
      dottedRule(ctx, y, CONTENT_L, CONTENT_R, DOT_LINE);
      y += 2;
    }
  });

  ctx.restore();
  noShadow(ctx);
}

/* -------------------------------------------------------- 5: the congrats */

/* Who finished, over a photo: the headline, the matte-blue hero box for the
 * first rower to 100,000 m, then the 50k club. */
function drawCongratsSlide(ctx: Ctx, data: PostData, fonts: PostFonts, assets: SlideAssets): void {
  photoBed(ctx, assets.photo, CONGRATS_SCRIM);
  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.7)", 18, 3);

  const kickFont = `700 25px ${fonts.mono}`;
  const kickM = metricsOf(ctx, fonts, kickFont, 25);
  let y = 92;
  drawText(
    ctx,
    "ROWTEMBER 2026",
    CONTENT_L,
    baselineOf(y, kickM.lh, kickM),
    kickFont,
    WHITE_DIM,
    25 * 0.18,
  );
  y += kickM.lh + 22;

  const headFont = `96px ${fonts.black}`;
  const headM = metricsOf(ctx, fonts, headFont, 96);
  drawText(
    ctx,
    "CONGRATS.",
    CONTENT_L,
    baselineOf(y, 96, headM),
    headFont,
    "#ffffff",
    -96 * 0.02,
  );
  y += 96;

  // The hero box: who got to 100k first.
  const hero = data.first100k;
  if (hero) {
    y += 38;
    const kFont = `22px ${fonts.mono}`;
    const kM = metricsOf(ctx, fonts, kFont, 22);
    const whoFont = `70px ${fonts.black}`;
    const whoM = metricsOf(ctx, fonts, whoFont, 70);
    const whoLh = 70 * 1.05;
    const subFont = `24px ${fonts.mono}`;
    const subM = metricsOf(ctx, fonts, subFont, 24);
    const boxH = 4 + 30 + kM.lh + 12 + whoLh + 14 + subM.lh + 30 + 4;

    ctx.save();
    noShadow(ctx);
    ctx.strokeStyle = MATTE;
    ctx.lineWidth = 4;
    ctx.strokeRect(CONTENT_L + 2, y + 2, CONTENT_W - 4, boxH - 4);
    ctx.restore();

    const innerL = CONTENT_L + 4 + 28;
    const innerW = CONTENT_W - (4 + 28) * 2;
    let hy = y + 4 + 30;
    drawText(
      ctx,
      "FIRST TO 100,000 M",
      innerL,
      baselineOf(hy, kM.lh, kM),
      kFont,
      WHITE_SOFT,
      22 * 0.16,
    );
    hy += kM.lh + 12;
    const whoText = `${hero.name} · ${pad2(hero.num)}`.toUpperCase();
    drawText(
      ctx,
      ellipsize(ctx, whoText, innerW, whoFont),
      innerL,
      baselineOf(hy, whoLh, whoM),
      whoFont,
      MATTE,
      0,
    );
    hy += whoLh + 14;
    // The first to 100k is all but certainly one of the elite fifteen, so
    // under a blackout the line says only that the prize is claimed — the
    // board slide just blocked this same number out.
    drawText(
      ctx,
      hero.masked
        ? "the Grizzly Health prize is claimed"
        : `${meters(hero.meters)} · the Grizzly Health prize is claimed`,
      innerL,
      baselineOf(hy, subM.lh, subM),
      subFont,
      WHITE_TEXT,
      0,
    );
    y += boxH;
  }

  // The 50k club.
  y += 44;
  const headingFont = `22px ${fonts.mono}`;
  const headingM = metricsOf(ctx, fonts, headingFont, 22);
  rule(ctx, CONTENT_L, y, CONTENT_W, 3, RULE);
  y += 3 + 16;
  drawText(
    ctx,
    `THE 50K CLUB · ${data.club50.length} IN`,
    CONTENT_L,
    baselineOf(y, headingM.lh, headingM),
    headingFont,
    WHITE_SOFT,
    22 * 0.16,
  );
  y += headingM.lh;

  const nameFont = `30px ${fonts.mono}`;
  const clubValueFont = `700 28px ${fonts.mono}`;
  const nameM = metricsOf(ctx, fonts, nameFont, 30);
  const rowH = 12 + nameM.lh + 12;
  // The design listed everyone; keep it honest as the club grows by drawing
  // only the rows that fit on the slide and counting the rest.
  const room = SLIDE_H - 40 - y;
  const fits = Math.max(1, Math.floor(room / (rowH + 2)));
  const showAll = data.club50.length <= fits;
  const shown = showAll ? data.club50 : data.club50.slice(0, Math.max(0, fits - 1));
  shown.forEach((r, i) => {
    const baseline = y + 12 + nameM.asc;
    // A blacked-out member gets blocks here too: their `meters` is the tier
    // floor, and printing it as-is would put a made-up exact figure next to
    // a name on a public carousel.
    let metersW: number;
    if (r.masked) {
      const unit = " m";
      drawRight(ctx, unit, CONTENT_R, baseline, clubValueFont, MATTE);
      const unitW = measure(ctx, unit, clubValueFont);
      const digits = r.digits ?? String(Math.max(0, Math.round(r.meters))).length;
      metersW =
        unitW + drawBlocks(ctx, CONTENT_R - unitW, baseline, digits, 28, clubValueFont, MATTE);
    } else {
      const metersText = meters(r.meters);
      drawRight(ctx, metersText, CONTENT_R, baseline, clubValueFont, MATTE);
      metersW = measure(ctx, metersText, clubValueFont);
    }
    const maxW = CONTENT_R - metersW - 18 - CONTENT_L;
    drawText(
      ctx,
      ellipsize(ctx, `${r.name} · ${pad2(r.num)}`, maxW, nameFont),
      CONTENT_L,
      baseline,
      nameFont,
      "#ffffff",
      0,
    );
    y += rowH;
    const last = showAll && i === shown.length - 1;
    if (!last) {
      dottedRule(ctx, y, CONTENT_L, CONTENT_R, DOT_LINE);
      y += 2;
    }
  });
  if (!showAll) {
    const rest = data.club50.length - shown.length;
    drawText(ctx, `+ ${rest} MORE`, CONTENT_L, y + 12 + nameM.asc, nameFont, WHITE_SOFT, 0);
  }

  ctx.restore();
  noShadow(ctx);
}

/* --------------------------------------------------------- 6: the partner */

function drawPartnerSlide(ctx: Ctx, fonts: PostFonts, assets: SlideAssets): void {
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
  const cx = SLIDE_W / 2;

  const topFont = `24px ${fonts.mono}`;
  const topM = metricsOf(ctx, fonts, topFont, 24);
  const lineFont = `34px ${fonts.archivo}`;
  const lineBold = `700 34px ${fonts.archivo}`;
  const lineM = metricsOf(ctx, fonts, lineFont, 34);
  const lineLh = 34 * 1.45;
  const codeKFont = `24px ${fonts.mono}`;
  const codeKM = metricsOf(ctx, fonts, codeKFont, 24);
  const codeWFont = `96px ${fonts.black}`;
  const codeWM = metricsOf(ctx, fonts, codeWFont, 96);
  const codeDFont = `26px ${fonts.mono}`;
  const codeDM = metricsOf(ctx, fonts, codeDFont, 26);
  const urlFont = `25px ${fonts.mono}`;
  const urlM = metricsOf(ctx, fonts, urlFont, 25);

  const marksH = 104;
  const hasMarks = !!assets.bear || !!assets.wordmark;
  const lines: Run[][] = [
    [
      { text: "Grizzly Health", color: CREAM, font: lineBold },
      { text: " put five free meals on the line for", color: CREAM_DIM },
    ],
    [{ text: "the men’s board, the women’s board,", color: CREAM_DIM }],
    [{ text: "and the first rower to 100,000 m.", color: CREAM_DIM }],
  ];
  const codeH = 4 + 40 + codeKM.lh + 16 + 96 + 22 + codeDM.lh + 40 + 4;

  const blocks: Block[] = [
    {
      gap: 0,
      h: topM.lh,
      draw: (top) =>
        drawCentered(
          ctx,
          "ROWTEMBER 2026 · PARTNER",
          cx,
          baselineOf(top, topM.lh, topM),
          topFont,
          SAGE,
          24 * 0.2,
        ),
    },
  ];

  if (hasMarks) {
    blocks.push({
      gap: 40,
      h: marksH,
      draw: (top) => {
        const bear = assets.bear;
        const word = assets.wordmark;
        const bearW = bear ? (bear.naturalWidth / bear.naturalHeight) * 104 : 0;
        const wordW = word ? (word.naturalWidth / word.naturalHeight) * 52 : 0;
        const gap = bear && word ? 26 : 0;
        let x = cx - (bearW + gap + wordW) / 2;
        if (bear) {
          ctx.drawImage(bear, x, top, bearW, 104);
          x += bearW + gap;
        }
        if (word) ctx.drawImage(word, x, top + (marksH - 52) / 2, wordW, 52);
      },
    });
  }

  blocks.push({
    gap: 46,
    h: lineLh * lines.length,
    draw: (top) => {
      let y = top;
      for (const line of lines) {
        drawRunsCentered(ctx, line, cx, baselineOf(y, lineLh, lineM), lineFont, 0);
        y += lineLh;
      }
    },
  });

  blocks.push({
    gap: 52,
    h: codeH,
    draw: (top) => {
      // The box is an outline only — the slide green shows through.
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 4;
      ctx.strokeRect(CONTENT_L + 2, top + 2, CONTENT_W - 4, codeH - 4);
      let y = top + 4 + 40;
      drawCentered(ctx, "THE CODE", cx, baselineOf(y, codeKM.lh, codeKM), codeKFont, SAGE, 24 * 0.2);
      y += codeKM.lh + 16;
      drawCentered(ctx, "ROWTEMBER", cx, baselineOf(y, 96, codeWM), codeWFont, GOLD, 0);
      y += 96 + 22;
      drawCentered(
        ctx,
        "10% OFF MEALS AT GRIZZLYHEALTH.ORG",
        cx,
        baselineOf(y, codeDM.lh, codeDM),
        codeDFont,
        CREAM,
        26 * 0.1,
      );
    },
  });

  blocks.push({
    gap: 52,
    h: urlM.lh,
    draw: (top) =>
      drawCentered(
        ctx,
        "MIKIANMUSSER.COM/ROW100K/PARTNERS",
        cx,
        baselineOf(top, urlM.lh, urlM),
        urlFont,
        SAGE,
        25 * 0.14,
      ),
  });

  drawCenteredStack(blocks);
}

/* ------------------------------------------------------------- 7: the end */

/* Black and white only — no accent colour anywhere on this one. */
function drawEndSlide(ctx: Ctx, fonts: PostFonts, assets: SlideAssets): void {
  photoBed(ctx, assets.photo, CTA_SCRIM);
  const cx = SLIDE_W / 2;

  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.7)", 20, 3);

  const headFont = `104px ${fonts.black}`;
  const headM = metricsOf(ctx, fonts, headFont, 104);
  const headLh = 104 * 0.96;
  const tailFont = `700 30px ${fonts.mono}`;
  const tailM = metricsOf(ctx, fonts, tailFont, 30);
  const headLines = ["FOR YOURSELF", "AND OTHERS."];

  drawCenteredStack([
    {
      gap: 0,
      h: headLh * headLines.length,
      draw: (top) => {
        let y = top;
        for (const line of headLines) {
          drawCentered(
            ctx,
            line,
            cx,
            baselineOf(y, headLh, headM),
            headFont,
            "#ffffff",
            -104 * 0.02,
          );
          y += headLh;
        }
      },
    },
    {
      gap: 38,
      h: 4,
      draw: (top) => {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(cx - 60, top, 120, 4);
      },
    },
    {
      gap: 40,
      h: tailM.lh,
      draw: (top) =>
        drawCentered(
          ctx,
          "MIKIANMUSSER.COM",
          cx,
          baselineOf(top, tailM.lh, tailM),
          tailFont,
          "rgba(255,255,255,0.86)",
          30 * 0.16,
        ),
    },
  ]);

  ctx.restore();
  noShadow(ctx);
}

/* ----------------------------------------------------------- 8: the hours */

/* The commit graph: one row per September day so far, 24 hour columns, cell
 * alpha by how many SESSIONS were logged in that hour. */
function drawHoursSlide(ctx: Ctx, data: PostData, fonts: PostFonts, assets: SlideAssets): void {
  photoBed(ctx, assets.photo, HOURS_SCRIM);
  const cx = SLIDE_W / 2;
  const grid = data.hourGrid.length > 0 ? data.hourGrid : [new Array<number>(24).fill(0)];
  const days = grid.length;
  const peak = Math.max(1, ...grid.map((row) => Math.max(0, ...row)));
  const alphaFor = (v: number) =>
    v <= 0 ? 0 : v < peak * 0.25 ? 0.32 : v < peak * 0.5 ? 0.58 : v < peak * 0.75 ? 0.8 : 1;

  const kickFont = `700 24px ${fonts.mono}`;
  const kickM = metricsOf(ctx, fonts, kickFont, 24);
  const headFont = `88px ${fonts.black}`;
  const headM = metricsOf(ctx, fonts, headFont, 88);
  const headLh = 88 * 0.98;
  const hourFont = `20px ${fonts.mono}`;
  const hourM = metricsOf(ctx, fonts, hourFont, 20);
  const dayFont = `21px ${fonts.mono}`;
  const dayM = metricsOf(ctx, fonts, dayFont, 21);

  // Grid geometry: 86px label gutter, 28px cells on a 33px pitch. The design
  // was drawn three days in; late in the month the rows have to thin or the
  // block would run off the slide, so the cell height shrinks to fit.
  const labelW = 86;
  const cellW = 28;
  const colGap = 5;
  const pitch = cellW + colGap;
  const blockW = labelW + 24 * pitch; // the trailing hour label spans a full pitch
  const blockL = cx - blockW / 2;
  const cellsL = blockL + labelW;
  const headBlock = kickM.lh + 18 + headLh + 52;
  const avail = SLIDE_H - 80 - headBlock;
  let cellH = 46;
  let rowGap = 7;
  if (hourM.lh + 12 + days * (cellH + rowGap) > avail) {
    rowGap = 4;
    cellH = Math.max(6, Math.floor((avail - hourM.lh - 12) / days - rowGap));
  }
  const gridH = hourM.lh + 12 + days * (cellH + rowGap);

  drawCenteredStack([
    {
      gap: 0,
      h: kickM.lh,
      draw: (top) => {
        ctx.save();
        shadow(ctx, "rgba(0,0,0,0.7)", 20, 3);
        drawCentered(
          ctx,
          `ROWTEMBER 2026 · ${data.asOfDay}`.toUpperCase(),
          cx,
          baselineOf(top, kickM.lh, kickM),
          kickFont,
          "rgba(255,255,255,0.72)",
          24 * 0.2,
        );
        ctx.restore();
      },
    },
    {
      gap: 18,
      h: headLh,
      draw: (top) => {
        ctx.save();
        shadow(ctx, "rgba(0,0,0,0.7)", 20, 3);
        drawCentered(
          ctx,
          `${n(data.totalMeters)} M`,
          cx,
          baselineOf(top, headLh, headM),
          headFont,
          MATTE,
          -88 * 0.02,
        );
        ctx.restore();
      },
    },
    {
      // The grid itself carries no text shadow.
      gap: 52,
      h: gridH,
      draw: (top) => {
        const labels: [number, string][] = [
          [0, "12A"],
          [6, "6A"],
          [12, "12P"],
          [18, "6P"],
        ];
        for (const [h, label] of labels) {
          drawText(
            ctx,
            label,
            cellsL + h * pitch,
            baselineOf(top, hourM.lh, hourM),
            hourFont,
            "rgba(255,255,255,0.7)",
            0,
          );
        }
        const rowsTop = top + hourM.lh + 12;
        for (let di = 0; di < days; di++) {
          const y = rowsTop + di * (cellH + rowGap);
          const labelTop = y + (cellH - dayM.lh) / 2;
          drawRight(
            ctx,
            `Sep ${di + 1}`,
            cellsL - 18,
            baselineOf(labelTop, dayM.lh, dayM),
            dayFont,
            "rgba(255,255,255,0.75)",
            0,
          );
          for (let h = 0; h < 24; h++) {
            const x = cellsL + h * pitch;
            const a = alphaFor(grid[di][h] ?? 0);
            if (a === 0) {
              ctx.strokeStyle = "rgba(255,255,255,0.26)";
              ctx.lineWidth = 2;
              ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
            } else {
              ctx.fillStyle = `rgba(255,255,255,${a})`;
              ctx.fillRect(x, y, cellW, cellH);
            }
          }
        }
      },
    },
  ]);
}

/* ----------------------------------------------------------------- slides */

function boardSlide(start: number): Slide {
  const end = start + 9;
  return {
    id: `board-${start}-${end}`,
    label: `Board ${start}–${end}`,
    file: `${pad2(Math.ceil(start / 10))}-board-${start}-${end}.png`,
    usesPhoto: true,
    draw: (ctx, data, fonts, assets) => drawBoardSlide(ctx, data, fonts, assets, start),
  };
}

const STATS_SLIDE: Slide = {
  id: "stats",
  label: "The month so far",
  file: "04-stats.png",
  usesPhoto: true,
  draw: (ctx, data, fonts, assets) => drawStatsSlide(ctx, data, fonts, assets),
};

const CONGRATS_SLIDE: Slide = {
  id: "congrats",
  label: "Congrats",
  file: "05-congrats.png",
  usesPhoto: true,
  draw: (ctx, data, fonts, assets) => drawCongratsSlide(ctx, data, fonts, assets),
};

const PARTNER_SLIDE: Slide = {
  id: "partner",
  label: "The partner",
  file: "06-partner.png",
  usesPhoto: false,
  draw: (ctx, _data, fonts, assets) => drawPartnerSlide(ctx, fonts, assets),
};

const END_SLIDE: Slide = {
  id: "end",
  label: "For yourself and others",
  file: "07-end.png",
  usesPhoto: true,
  draw: (ctx, _data, fonts, assets) => drawEndSlide(ctx, fonts, assets),
};

const HOURS_SLIDE: Slide = {
  id: "hours",
  label: "The hours",
  file: "08-hours.png",
  usesPhoto: true,
  draw: (ctx, data, fonts, assets) => drawHoursSlide(ctx, data, fonts, assets),
};

/* The carousel, in post order. Board pages with nobody on them drop out, so
 * a thin board makes a shorter pack rather than an empty slide; the congrats
 * slide waits for someone to be worth congratulating. */
export function slidesFor(data: PostData): Slide[] {
  const boards = [1, 11, 21].filter((start) => data.standings.length >= start).map(boardSlide);
  const middle: Slide[] = [STATS_SLIDE];
  if (data.first100k || data.club50.length > 0) middle.push(CONGRATS_SLIDE);
  return [...boards, ...middle, PARTNER_SLIDE, END_SLIDE, HOURS_SLIDE];
}
