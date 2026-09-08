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
 * stickers use. The story (1080x1920) is the SAME composition on a taller
 * photo: the FRAME grows, the 1080x1350 box of type and decals does not, and
 * the renderer drops that box into the middle of the taller frame. Nothing
 * below is re-laid-out for it — only the photo bed, the ground and the scrim
 * know the real frame, and they paint it edge to edge. Even there the scrim
 * keeps the composition: it covers the frame, but its gradient is anchored to
 * the 1350 band, so the darkening stays under the type it was drawn for.
 */

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;

/* The two frames the pack renders into (owner, 2026-09-05: "crop to story
 * size and put the decals on those as well"). `suffix` goes on the filename
 * so a story is never mistaken for a post; the post keeps the name it has
 * always had. */
export type SizeKey = "post" | "story";
export type SlideSize = { key: SizeKey; label: string; w: number; h: number; suffix: string };
export const SIZES: Record<SizeKey, SlideSize> = {
  post: { key: "post", label: "Post 4:5", w: SLIDE_W, h: SLIDE_H, suffix: "" },
  story: { key: "story", label: "Story 9:16", w: 1080, h: 1920, suffix: "-story" },
};

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
  /** Blackout, the places half: one of the hidden elite, who carries no
   * place at all — the board slide prints no number and no medal for the
   * row (maskBoards has already reordered them by average split, then
   * name, so their order on the slide is not a ranking either). */
  unranked?: boolean;
};
export type PostRecord = {
  label: string;
  value: string;
  who: string;
  /** Blackout (lib/blackoutRules.ts): the holder is one of the hidden
   * elite — `value` is "" and `shape` is its silhouette ("#:##.#" for a
   * split, "##,### m" for a distance), drawn as blocks on the stats slide. */
  masked?: boolean;
  shape?: string;
};

/* One club somebody joined in the last 24 hours (../post/clubJoins.ts). The
 * label and threshold are a TIER's, so ".25M" and "500K" read the way the
 * boards say them. `rowers` is never empty — a club nobody joined does not
 * reach here, and a slide is never built for one. */
export type PostClubJoin = {
  /** The TIERS label: "50K", "100K", ".25M". */
  label: string;
  /** That tier's threshold, so the slide can order clubs without TIERS. */
  meters: number;
  /** Who crossed it in the window, BIGGEST TOTAL FIRST (owner, 2026-09-06:
   * "sort it in order of meters rowed"). ./clubJoins does the sorting, on the
   * public meters — a hidden rower sorts on their tier floor, never on a real
   * number. */
  rowers: PostRow[];
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
  /** Clubs joined in the last 24 hours, highest club first — empty when
   * nobody crossed one, and then no welcome slide is built (./clubJoins). */
  clubJoins: PostClubJoin[];
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

/* WHAT THE SLIDE SITS ON.
 *   photo   — the gallery picture, black and white, under its scrim.
 *   plain   — the same slide with no picture: the dark bed and the scrim.
 *   sticker — nothing at all. No bed, no scrim, no flat fill, so the PNG
 *             keeps its alpha channel and drops onto a photograph of the
 *             owner's own (2026-09-06: "if I have a different photo I want to
 *             put them on, I can put them on it. Even if it is plain, it
 *             still has that black background, and I need it to NOT have
 *             that black background").
 *
 * Nothing is restyled for the sticker, because nothing needs to be: the type
 * is already white under a soft shadow, the treatment this composition was
 * given so it would survive a picture nobody has seen, and the blackout
 * blocks are matte ink with nothing behind them (owner, 2026-09-08).
 *
 * What it survives is a DARK picture. White under a soft shadow is a
 * dark-ground treatment: composited over a bright photograph the type
 * measures about 1.6:1 and all but disappears (review, 2026-09-06); the
 * matte blocks are the other way about and want the light. So the sticker
 * is the composition as composed, and the CARD says the truth about it —
 * the preview is half a light checkerboard and half a dark one
 * (post/page.tsx), which is where a sticker that will not read on a bright
 * picture looks as faint as it will in the post. */
export type Ground = "photo" | "plain" | "sticker";

export type SlideAssets = {
  /** The gallery photo for this slide, or null when it could not load. */
  photo: HTMLImageElement | null;
  /** Grizzly Health marks, for the partner slide. */
  bear: HTMLImageElement | null;
  wordmark: HTMLImageElement | null;
  /** What to paint under the type. The caller always says. */
  ground: Ground;
};

export type Slide = {
  id: string;
  /** Menu label under the preview. */
  label: string;
  /** Filename inside the zip / share sheet. */
  file: string;
  /** True when the slide paints a gallery photo full-bleed. */
  usesPhoto: boolean;
  /** Set when the type on this slide carries NO shadow, so its sticker wants
   * a dark picture under it — only the partner slide, whose green was always
   * its contrast. The card marks it; nothing is restyled for it. */
  needsDarkGround?: true;
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
/* Blocks are BLOCK_INK on these slides too (owner, 2026-09-05: black, not
 * white, anywhere a hidden number shows), and MATTE — flat ink, nothing
 * behind it (owner, 2026-09-08: the white glow that used to sit under the
 * squares and their commas is gone), the same treatment share/cards.ts
 * gives them. The blocks inherit whatever shadow the slide has set for its
 * type, like every other mark on the line. A caller that asks for another
 * colour keeps it. */
const BLOCK_INK = "#15171A";

function drawBlocks(
  ctx: Ctx,
  right: number,
  baseline: number,
  digits: number,
  size: number,
  font: string,
  color: string = BLOCK_INK,
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
  color: string = BLOCK_INK,
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

/* The frame, not the composition box. Everything above lays out inside
 * 1080x1350; the canvas underneath may be taller (the story). The ground,
 * the picture and the scrim have to reach all four edges of the REAL canvas,
 * so they paint in canvas space: the transform is reset for the duration,
 * which undoes the renderer's translate of the composition box and puts them
 * back on the corners.
 *
 * When the frame IS the composition box — the post, 1080x1350 — there is
 * nothing to undo: the renderer's translate is (0,0) and canvas space is
 * already frame space. That case runs straight through with no save /
 * setTransform / restore around it, so the 4:5 slide executes the exact
 * sequence of canvas calls it executed before the story existed. Not a
 * micro-optimisation: with the pair in place the post render came back a
 * shade off the old one along every shadowed edge (review, 2026-09-05), and
 * "the 4:5 output is untouched" has to be true to the byte, not to the eye. */
function inFrame(ctx: Ctx, run: (w: number, h: number) => void): void {
  const w = ctx.canvas.width || SLIDE_W;
  const h = ctx.canvas.height || SLIDE_H;
  if (w === SLIDE_W && h === SLIDE_H) {
    run(w, h);
    return;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  run(w, h);
  ctx.restore();
}

/* A flat ground over the whole frame — the slides with no photograph. */
function fillFrame(ctx: Ctx, color: string): void {
  inFrame(ctx, (w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  });
}

/* object-fit: cover, on the frame it is handed — a portrait photo fills the
 * taller story frame by losing its sides, which is the crop. */
function drawCover(ctx: Ctx, img: HTMLImageElement, fw: number, fh: number): void {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(fw / iw, fh / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(img, (fw - w) / 2, (fh - h) / 2, w, h);
}

/* filter: grayscale(1) contrast(1.04) brightness(1.32), applied by hand
 * rather than through ctx.filter — the pixel math is identical everywhere,
 * where ctx.filter is missing on older Safari. Reading the pixels back is
 * only safe because gallery images are loaded with crossOrigin=anonymous
 * against a bucket that allows GET; a tainted canvas would throw here rather
 * than later at toBlob(). */
function toBlackAndWhite(ctx: Ctx, fw: number, fh: number): void {
  const image = ctx.getImageData(0, 0, fw, fh);
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

/* The scrim COVERS the whole frame but is ANCHORED to the composition band.
 * Its stops were chosen against the type they sit under — the board's 0.10
 * window is where the list is lightest, the 0.42 at the top is what holds the
 * title — and the type does not move when the frame grows, so the darkening
 * must not either. Stretched over 1920 instead, the last board rows lost
 * about a third of their scrim and the heaviest part of the vignette landed
 * on the empty band above the title, where nothing needs contrast (review,
 * 2026-09-05).
 *
 * So the gradient line runs the 1350 band and the fill runs the frame: canvas
 * clamps a gradient to its first and last stop beyond the line, so the extra
 * picture above and below keeps the composed end alphas (0.42 / 0.22 on the
 * board) with no seam. At 4:5 `top` is 0 and this is the old call exactly. */
function scrim(ctx: Ctx, stops: [number, number][], fw: number, fh: number): void {
  const top = (fh - SLIDE_H) / 2;
  const grad = ctx.createLinearGradient(0, top, 0, top + SLIDE_H);
  for (const [at, alpha] of stops) grad.addColorStop(at, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, fw, fh);
}

/* Photo bed: the picture in black and white under its scrim. With no photo
 * (none uploaded, or the load failed) the slide keeps its dark ground so the
 * white type still reads.
 *
 * On the STICKER ground it paints nothing whatsoever and returns — no bed, no
 * picture, no scrim — so the canvas is still transparent when the type goes
 * down and the PNG comes out with a real alpha channel. The picture is read
 * off the assets only on the photo ground, so a stale image can never end up
 * under a plain slide. */
function photoBed(ctx: Ctx, assets: SlideAssets, stops: [number, number][]): void {
  if (assets.ground === "sticker") return;
  const photo = assets.ground === "photo" ? assets.photo : null;
  inFrame(ctx, (w, h) => {
    ctx.fillStyle = "#23272b";
    ctx.fillRect(0, 0, w, h);
    if (photo) {
      drawCover(ctx, photo, w, h);
      toBlackAndWhite(ctx, w, h);
    }
    scrim(ctx, stops, w, h);
  });
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

/* THE ELITE as the section line sets it — sentence case, like "The board ·
 * 11–20" it stands in for (same words as ELITE_LABEL in
 * lib/blackoutRules.ts, which shouts them where the page shouts). */
const ELITE_SECTION = "The elite";

/* The dim line under the title. Twin of boardSectionLabel in
 * share/cards.ts, kept here so the post pack does not pull the whole card
 * registry into its bundle: an all-hidden page says the elite — with a
 * part number ("The elite · 1/2") when the hidden rows run past one slide
 * of ten, which twenty of them do, so two slides never wear the same line;
 * a page that mixes hidden rows with real places says nothing about places
 * (no range is true of all ten lines, and "11–20" over blank places would
 * be the ranking the rule just took away); everything else is the range.
 * `hidden` is how many rows the whole board hides; left out, the page
 * counts its own. */
export function boardSlideSection(
  rows: { unranked?: boolean }[],
  start: number,
  hidden: number = rows.filter((r) => r.unranked).length,
): string {
  if (rows.length > 0 && rows.every((r) => r.unranked)) {
    const parts = Math.ceil(hidden / 10);
    const part = Math.floor((start - 1) / 10) + 1;
    return `The board · ${ELITE_SECTION}${parts > 1 ? ` · ${part}/${parts}` : ""}`;
  }
  if (rows.some((r) => r.unranked)) return "The board";
  return `The board · ${start}–${start + 9}`;
}

/* The place column: blank for one of the hidden elite (they carry no
 * place), the padded number otherwise. */
export function boardSlidePlace(row: { unranked?: boolean }, place: number): string {
  return row.unranked ? "" : pad2(place);
}

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
  photoBed(ctx, assets, BOARD_SCRIM);
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
    boardSlideSection(rows, start, data.standings.filter((r) => r.unranked).length),
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
        unitW + drawBlocks(ctx, CONTENT_R - unitW, baseline, digits, 42, rowFont);
    } else {
      const metersText = meters(r.meters);
      drawRight(ctx, metersText, CONTENT_R, baseline, rowFont, "#ffffff");
      metersW = measure(ctx, metersText, rowFont);
    }
    // The place — nothing at all for a hidden row, and no medal on it
    // either, whatever index it landed on after the reorder. The column
    // stays, so the names keep their line down the slide.
    const placeText = boardSlidePlace(r, place);
    if (placeText) {
      drawText(
        ctx,
        placeText,
        CONTENT_L,
        baseline,
        placeFont,
        medalColor(place) ?? "rgba(255,255,255,0.55)",
      );
    }
    const maxW = CONTENT_R - metersW - 24 - nameX;
    drawText(ctx, ellipsize(ctx, r.name, maxW, rowFont), nameX, baseline, rowFont, "#ffffff");
  });

  ctx.restore();
  noShadow(ctx);
}

/* --------------------------------------------------- 3b: the club welcome */

/* Who joined a club in the last 24 hours, over a photo — the owner's ask
 * (2026-09-05 late): "if you just hit 50k I want a picture that is shareable
 * to tag you in, same style as the others". So it is the congrats slide's
 * idiom exactly: the same photo bed and scrim, the same kick line, a big
 * Archivo Black headline, and the congrats hero's 4px matte box — repeated,
 * once per rower, instead of once for the first to 100k.
 *
 * One slide per club (the headline names it), highest club first, six rowers
 * to a slide. A seventh gets a slide of their own rather than smaller type. */
const CLUB_PER_SLIDE = 6;

/* Greedy word wrap for the headline, dropping a size step when the words need
 * more than two lines. The ONLY type on this slide that resizes: the rower
 * rows below keep theirs whatever happens, which is what the overflow slide
 * is for. */
function headlineLines(
  ctx: Ctx,
  words: string[],
  fonts: PostFonts,
  sizes: number[],
  maxW: number,
): { size: number; lines: string[] } {
  let out = { size: sizes[sizes.length - 1] ?? 96, lines: [words.join(" ")] };
  for (const size of sizes) {
    const font = `${size}px ${fonts.black}`;
    const tracking = -size * 0.02;
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && measure(ctx, next, font, tracking) > maxW) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    out = { size, lines };
    if (lines.length <= 2 && lines.every((l) => measure(ctx, l, font, tracking) <= maxW)) {
      return out;
    }
  }
  return out;
}

/* Who a welcome slide actually names. The first rower to 100,000 m is the
 * congrats slide's hero a couple of cards later, under the same photo and the
 * same matte box, so they are not ALSO welcomed into the 100K club: one
 * event, one slide, and the carousel stops repeating itself (review,
 * 2026-09-05). Any other club that rower joins later — .25M — is news the
 * congrats slide does not carry, so that welcome stands. A club this empties
 * out builds no slide at all, which clubSlides already handles. */
/* The threshold the congrats slide celebrates — the same 100,000 m its hero
 * heading prints two hundred lines down, and lib/row100k's GOAL_METERS. It is
 * written out here rather than imported so this module keeps drawing in a
 * bare canvas with no app config behind it (importing lib/row100k drags in
 * its env-dependent namespace switch, which a plain harness has to shim). */
const CONGRATS_GOAL = 100_000;

function clubRowers(data: PostData, club: PostClubJoin): PostRow[] {
  const hero = data.first100k;
  if (!hero || club.meters !== CONGRATS_GOAL) return club.rowers;
  return club.rowers.filter((r) => r.num !== hero.num);
}

/* The slide's top edge when it flows from the top — the same 92 the congrats
 * and board slides start their kick line on. */
const CLUB_TOP = 92;

function drawClubSlide(
  ctx: Ctx,
  data: PostData,
  fonts: PostFonts,
  assets: SlideAssets,
  clubIndex: number,
  part: number,
): void {
  photoBed(ctx, assets, CONGRATS_SCRIM);
  const club = data.clubJoins[clubIndex];
  if (!club) return;
  const rows = clubRowers(data, club).slice(part * CLUB_PER_SLIDE, (part + 1) * CLUB_PER_SLIDE);
  // The numbers moved under the slide list (a refresh mid-render): the bed is
  // already painted, and an empty welcome is never drawn.
  if (rows.length === 0) return;

  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.7)", 18, 3);

  const kickFont = `700 25px ${fonts.mono}`;
  const kickM = metricsOf(ctx, fonts, kickFont, 25);
  const kickText = `ROWTEMBER 2026 · ${data.asOfDay}`.toUpperCase();

  // "WELCOME TO THE 50K CLUB." — the club's own label, so ".25M" and "500K"
  // read the way the boards say them. The label and CLUB. stay on one line
  // together; the rest wraps.
  const head = headlineLines(
    ctx,
    ["WELCOME", "TO", "THE", `${club.label} CLUB.`],
    fonts,
    [96, 84, 72],
    CONTENT_W,
  );
  const headFont = `${head.size}px ${fonts.black}`;
  const headM = metricsOf(ctx, fonts, headFont, head.size);
  const headLh = head.size * 0.98;

  // ONE LINE PER ROWER: the name and rower number in black, the total on the
  // same baseline at the right edge of the box.
  //
  // The line that used to sit under the name and repeat the club is gone
  // (owner, 2026-09-06: "on the NEW TO 50K CLUB one, we do not need to write
  // NEW IN THE 50K CLUB underneath their name — it is obvious"). The headline
  // over the boxes names the club once, which is all a reader needs. So the
  // box closes up around the single line it has left — 26px of padding either
  // side of the name — rather than standing at its old height with a hole in
  // it.
  const whoFont = `46px ${fonts.black}`;
  const whoM = metricsOf(ctx, fonts, whoFont, 46);
  const whoLh = 46 * 1.05;
  // The total moved up onto the name's baseline, so it takes the size the
  // congrats slide gives the same figure in its club list (700 28px) instead
  // of the 24 it wore on a line of its own.
  const valueFont = `700 28px ${fonts.mono}`;
  const padY = 26;
  const boxH = 4 + padY + whoLh + padY + 4;
  const innerL = CONTENT_L + 4 + 28;
  const innerR = CONTENT_R - 4 - 28;
  const innerW = innerR - innerL;

  // Six boxes fit the room the headline leaves when the slide flows from the
  // top; the gap between them takes up whatever slack is left, and tightens
  // (never below 6px) rather than letting the last box hang off the slide on
  // a family with a taller line box. Measured against the TOP-ANCHORED
  // layout, which is the crowded one — a centred slide has room to spare.
  const boxesTop = CLUB_TOP + kickM.lh + 22 + headLh * head.lines.length + 38;
  const room = SLIDE_H - 40 - boxesTop;
  const gap =
    rows.length > 1
      ? Math.max(6, Math.min(16, (room - rows.length * boxH) / (rows.length - 1)))
      : 0;

  const drawRow = (r: PostRow, top: number) => {
    ctx.save();
    noShadow(ctx);
    ctx.strokeStyle = MATTE;
    ctx.lineWidth = 4;
    ctx.strokeRect(CONTENT_L + 2, top + 2, CONTENT_W - 4, boxH - 4);
    ctx.restore();

    const baseline = baselineOf(top + 4 + padY, whoLh, whoM);
    // The total goes down first, because the name yields to it: one of the
    // hidden elite gets blocks where their number would be — a welcome names
    // the club they just joined, never their number (blackout rule,
    // 2026-09-05). The board slide blocks the same figure out.
    let valueW: number;
    if (r.masked) {
      const unit = " m";
      drawRight(ctx, unit, innerR, baseline, valueFont, MATTE);
      const unitW = measure(ctx, unit, valueFont);
      const digits = r.digits ?? String(Math.max(0, Math.round(r.meters))).length;
      valueW = unitW + drawBlocks(ctx, innerR - unitW, baseline, digits, 28, valueFont);
    } else {
      const metersText = meters(r.meters);
      drawRight(ctx, metersText, innerR, baseline, valueFont, MATTE);
      valueW = measure(ctx, metersText, valueFont);
    }
    // The rower number rides with the name so the post can be tagged.
    const whoText = `${r.name} · ${pad2(r.num)}`.toUpperCase();
    drawText(
      ctx,
      ellipsize(ctx, whoText, innerW - valueW - 24, whoFont),
      innerL,
      baseline,
      whoFont,
      MATTE,
      0,
    );
  };

  const blocks: Block[] = [
    {
      gap: 0,
      h: kickM.lh,
      draw: (top) =>
        drawText(
          ctx,
          kickText,
          CONTENT_L,
          baselineOf(top, kickM.lh, kickM),
          kickFont,
          WHITE_DIM,
          25 * 0.18,
        ),
    },
    {
      gap: 22,
      h: headLh * head.lines.length,
      draw: (top) => {
        head.lines.forEach((line, i) => {
          drawText(
            ctx,
            line,
            CONTENT_L,
            baselineOf(top + i * headLh, headLh, headM),
            headFont,
            "#ffffff",
            -head.size * 0.02,
          );
        });
      },
    },
    ...rows.map((r, i) => ({
      gap: i === 0 ? 38 : gap,
      h: boxH,
      draw: (top: number) => drawRow(r, top),
    })),
  ];

  // One or two rowers is the ordinary day, not the exception. Flowed from the
  // top, that slide stops dead a third of the way down with 800px of picture
  // and nothing under it — it reads as cut off rather than composed. So a
  // small welcome is CENTRED and the photo frames it, the move three other
  // slides in this file already make. From three rowers up the flow from the
  // top is what fits (review, 2026-09-05).
  if (rows.length <= 2) {
    drawCenteredStack(blocks);
  } else {
    let top = CLUB_TOP;
    blocks.forEach((b, i) => {
      if (i > 0) top += b.gap;
      b.draw(top);
      top += b.h;
    });
  }

  ctx.restore();
  noShadow(ctx);
}

/* ----------------------------------------------------------- 4: the stats */

/* The month so far, over a photo: the kick line, the big matte-blue total,
 * the trio under white rules, then the record list with dotted leaders. */
function drawStatsSlide(ctx: Ctx, data: PostData, fonts: PostFonts, assets: SlideAssets): void {
  photoBed(ctx, assets, STATS_SCRIM);
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
      drawBlockShape(ctx, CONTENT_L + 296, baseline, rec.shape ?? "#", 28, recValueFont);
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
  photoBed(ctx, assets, CONGRATS_SCRIM);
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
    // The first to 100k is all but certainly one of the elite, so under a
    // blackout the line says only that the prize is claimed — the
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
        unitW + drawBlocks(ctx, CONTENT_R - unitW, baseline, digits, 28, clubValueFont);
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
  // The one slide with no photograph: its green is the frame's ground, so it
  // fills the real canvas (the story frame included) rather than the
  // composition box. Same colour, same everything else.
  //
  // On the sticker ground even that green stays off, the way the photo bed
  // stays off everywhere else: the marks, the gold code box and the type come
  // out on transparency. That one is cream on nothing, so it wants a dark
  // picture under it — the type on this slide carries no shadow, because the
  // green was always its contrast.
  if (assets.ground !== "sticker") fillFrame(ctx, GREEN);
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
  photoBed(ctx, assets, CTA_SCRIM);
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
  photoBed(ctx, assets, HOURS_SCRIM);
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
  // Cream type with no shadow: on transparency it needs a dark picture, and
  // the card says so rather than offering the sticker as if it worked on any
  // photograph (review, 2026-09-06).
  needsDarkGround: true,
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

/* The welcome slides: one per club joined in the last day, highest club
 * first, split at six rowers. They sit between the board and the stats, so
 * their filenames sort there too — "03-club-01-50k.png" lands after the last
 * board page and before "04-stats.png". Nothing is built for a club nobody
 * joined, or for a 100K club whose only new member is the congrats hero; an
 * empty clubJoins makes no slide at all. */
function clubSlides(data: PostData): Slide[] {
  const out: Slide[] = [];
  data.clubJoins.forEach((club, clubIndex) => {
    // clubRowers, not club.rowers: the congrats hero is dropped from the 100K
    // welcome, and a club that leaves empty makes no slide.
    const members = clubRowers(data, club);
    if (members.length === 0) return;
    const slug = club.label.toLowerCase().replace(/[^a-z0-9]+/g, "") || `t${club.meters}`;
    const parts = Math.ceil(members.length / CLUB_PER_SLIDE);
    for (let part = 0; part < parts; part++) {
      // NOT `n` — that is this module's number formatter (line ~170), and
      // shadowing it here would turn the next n(...) inside this block into a
      // runtime error inside a try/catch (review, 2026-09-05).
      const seq = out.length + 1;
      out.push({
        id: `club-${slug}-${part + 1}`,
        label:
          parts > 1
            ? `New to the ${club.label} club · ${part + 1}/${parts}`
            : `New to the ${club.label} club`,
        file: `03-club-${pad2(seq)}-${slug}.png`,
        usesPhoto: true,
        draw: (ctx, live, fonts, assets) =>
          drawClubSlide(ctx, live, fonts, assets, clubIndex, part),
      });
    }
  });
  return out;
}

/* The carousel, in post order. Board pages with nobody on them drop out, so
 * a thin board makes a shorter pack rather than an empty slide; the welcome
 * slides exist only while somebody has just joined a club; the congrats
 * slide waits for someone to be worth congratulating. */
export function slidesFor(data: PostData): Slide[] {
  const boards = [1, 11, 21].filter((start) => data.standings.length >= start).map(boardSlide);
  const middle: Slide[] = [STATS_SLIDE];
  if (data.first100k || data.club50.length > 0) middle.push(CONGRATS_SLIDE);
  return [...boards, ...clubSlides(data), ...middle, PARTNER_SLIDE, END_SLIDE, HOURS_SLIDE];
}
