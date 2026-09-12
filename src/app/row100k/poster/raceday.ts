/* poster/raceday.ts — RACE DAY: the third subject, and the only one that is
 * an AD rather than a summary.
 *
 * The ask (owner, 2026-09-11): "I also need some race day branding —
 * overlays to put on an insta post, basically ads for the event. There
 * should be some explaining that it is a 5k time challenge, compete in
 * waves, 6-9 pm on the 27th ... see what overlays, what images we can come
 * up with to advertise the race day."
 *
 * THE DESIGN IS THE GIG POSTER (three were drawn and judged; this one won
 * 9 / 9 / 8). The frame is a bill posted on a wall: a heavy stacked
 * wordmark jammed flush to the measure, the piece and the waves under it at
 * falling weights, a bracketed date strip, the venue mark at the foot as a
 * promoter credit. The Rowtember broadsheet inverted — flush left, thick
 * rules, mono eyebrows, Archivo Black falling to Archivo 700 to Space Mono
 * down the stack.
 *
 * MONOCHROME (owner, same day): "on the race day sign up, let us stick with
 * monochromatic — just black and whites, whites on black." The blue is off
 * race day entirely, here and on /raceday. The ground is the site's own
 * --ink #15171A, so the ad and the page it links to are the same black, and
 * the grey ladder below is rdCss.ts's, measured against that ground.
 *
 * WHAT THE JUDGES GRAFTED ON, all of it built here:
 *   · the SIGN UP block from the monitor design — a white slab with a verb
 *     in it, the one element that survives any photograph at any brightness
 *     (module `cta`, and it is the pinned footer of every plan).
 *   · the fact table from the monitor design — label grey left, value white
 *     right, hairline under (module `facts`) — which carries the waiver on
 *     paper, and the field once enough names are in.
 *   · the date in the masthead (module `mast`, right-flush), so the WHEN
 *     sits where a crop never eats it and the city moves to the foot.
 *   · ONE row of the wave grid, never five: "five rows of eight is a
 *     40-place field stated as a picture, and a reader can count it."
 *   · FREE is printed ONCE — the bracket's third cell — and nowhere else.
 *
 * WHAT THE OWNER TOOK BACK OFF IT, 2026-09-11, reading the story ad and its
 * overlay: "rowed in waves of eight", "new this September", "men and women
 * scored apart", and the sign-up deadline. Four lines off every frame. The
 * modules did not keep holes where they were — the piece is two lines now
 * instead of three, the call to action is the slab alone, the house block
 * sets the town where the note was, and every unit that came free went into
 * the grow row, which is the headline on an ad and the PICTURE on an
 * overlay. Nothing moved sideways to fill a gap.
 *
 * AND THE LABEL OFF THE HOUSE, later the same day: "Remove the house on
 * race day ads." A fifth line, by the same rule. The mark stays — it IS
 * the credit — and so do the room, the town and the waiver; what went is
 * the mono eyebrow that named the block above them. Its line and the blank
 * under it came out of the module's own height (22 units on a phone, 27 on
 * a hand sheet, 22 on a wall one) and went where the other four went, and
 * /raceday dropped its own "The house" in the same pass: the sign-up page
 * is the flyer now, so a label on one and not the other would split them.
 *
 * AND THE HOLE THE JUDGES WOULD NOT HAVE: the gig poster left 62 units of
 * nothing between its bracket and its foot rule, which "reads as a loading
 * failure on a phone". There is no dead band on any frame here — the head
 * is the grow row and takes back whatever nothing else needs, so every plan
 * closes on the footer with slack 0. Taking the room is not the same as
 * PLACING it: a 2:3 head is already flush at the measure and cannot spend a
 * surplus on type, so the head splits what it cannot use evenly above and
 * below the block and draws its hairline at the foot of its row (headMod).
 * The first cut dumped all of it under that hairline and the 24x36 came back
 * with the same hole in a new place, 10.85 % of the sheet (review).
 *
 * THE GROUND SWITCH (types.ts PosterGround). All three grounds paint the
 * same solid ink; the OVERLAY and PHOTO plans then put a `window` row in the
 * stack. On an overlay that row cuts its own box back out of the canvas
 * (destination-out) and what comes out is a transparent PNG whose alpha IS
 * the bill — a hard-edged slab of ink over the owner's own photograph of the
 * room, every glyph on solid black, no scrim anywhere. That is the winning
 * design's answer to white type over an unknown photograph: a scrim would
 * dissolve the bill into the wall and kill the picture, and a drop shadow is
 * not this voice. On the PHOTO ground the same row DRAWS his picture into
 * the same box instead, so the identical artwork comes off the studio as one
 * finished PNG — which is what makes his black-and-white switch true of a
 * file rather than of a preview (review, 2026-09-11).
 *
 * The composition runs FULL BLEED — poster/raceGround.ts hands the engine
 * zero margins and gap 0 — so a module's box is a slice of the frame and
 * the bill has no floating edges. Every module therefore carries its OWN
 * air and insets its type by the format's real margins.
 *
 * NO COPY LIVES IN THIS FILE. Every word is built out of the RaceDef by
 * poster/raceAssemble.ts, so the ad cannot drift from /raceday. */

import { silently } from "./charts";
import { FORMATS } from "./formats";
import type {
  PosterBox,
  PosterGround,
  PosterLayout,
  PosterModule,
  PosterPaint,
  PosterPlan,
  PosterPlanKey,
  PosterRow,
  RaceDayPoster,
} from "./types";

type Ctx = CanvasRenderingContext2D;
type Mod = PosterModule<RaceDayPoster>;
type Draw = (ctx: Ctx, box: PosterBox, d: RaceDayPoster, paint: PosterPaint) => number;

/* ------------------------------------------------------------ the values */

/* The site's own ink, so the ad and its landing page are the same black.
 * The four greys are rdCss.ts's ladder, measured against it (WCAG, alpha
 * composited first): white 17.96:1, .74 10.17:1, .62 7.45:1, .5 5.27:1.
 * Nothing under .5 ever carries a letter — .18 and .3 are rules. */
export const RACE_INK = "#15171A";
const WHITE = "#ffffff";
const BONE = "rgba(255,255,255,.74)";
const KEY = "rgba(255,255,255,.62)";
const QUIET = "rgba(255,255,255,.5)";
const HAIR = "rgba(255,255,255,.3)";
const FAINT = "rgba(255,255,255,.18)";

/* The venue mark's share of the measure. The sizing study behind the
 * winning design put the floor at about 150 logical units — BARBELL stops
 * reading under it — and every frame here measures 468 or more, so 34 % is
 * 159 on a phone and more on paper. It is never wider than this, never
 * centred (centred reads as a logo lockup; flush reads as a credit), never
 * above the fold, and never paired with a Rowtember mark as an equal:
 * Rowtember is hosting something at their gym, and the frame reads that
 * way. */
const MARK_SHARE = 0.34;

/* What the headline BLOCK asks for, as a share of the frame height. It is a
 * budget on the block rather than a cap per line, because a cap per line
 * clips the long word only and leaves one line flush and one short, which
 * reads as a mistake; a budget scales both by one factor and keeps the
 * ratio the flush fit gave them.
 *
 * It is what the head MEASURES, not what it draws: a sheet with room to
 * spare hands the row more through `grow` and the head takes it (up to the
 * flush fit), so lowering the number on paper does not shrink a 24x36's
 * headline — it only stops the headline outbidding the rest of the bill on
 * a sheet that is short. At 0.22 the 11x17 keeps the wave row, the two ways
 * in AND the fact table; at 0.30 it dropped two of the three, and the 24x36
 * draws exactly the same headline either way because it grows back.
 *
 * THE PHONE ADS HAVE NO DROP LIST AT ALL, so there is nothing for the head
 * to outbid there and the ask only needs to be small enough to fit: on the
 * 4:5 the rest of the bill is 378 units of a 578-unit region, which leaves
 * the head 200, and 0.30 asked 229 — the ask overflowed the frame the
 * moment the 4:5 took the two-line head. 0.24 asks 189, fits, and `grow`
 * hands back the same 200, so the 9:16 still draws RACE and DAY FLUSH with
 * no scaling at all — the signature — and the 4:5 spends its whole surplus
 * on type instead of leaving a band of nothing under the hairline. */
const HEAD_SHARE: Record<string, number> = { phone: 0.24, printS: 0.22, printL: 0.22 };
const headShare = (paint: PosterPaint): number => HEAD_SHARE[paint.format.family] ?? 0.24;

/* THE AIR AROUND THE PICTURE (owner, 2026-09-11: "put a little bit of blank
 * space between the photo and A TIMED 5,000 M TRIAL — the same amount of
 * space that is above the photo"). The window had air above it, left under
 * the head's own hairline, and none at all below: the piece began 0.3 of a
 * small under the cut, so the photograph read as if it had been pasted on
 * top of the line.
 *
 * ONE number, read by three modules, so the two gaps cannot drift: the head
 * leaves WINDOW_AIR under its hairline, and the window gives WINDOW_AIR back
 * below itself — less the lead the piece already carries, which is part of
 * the same blank. The air comes out of the PICTURE, never out of the bill,
 * because the window is the grow row. */
const WINDOW_AIR = (tk: PosterPaint["tk"]): number => tk.small * 1.5;
const PIECE_LEAD = (tk: PosterPaint["tk"]): number => tk.small * 0.3;

/* --------------------------------------------------------- the mechanics */

/* The format's REAL margins. raceGround.ts composes at zero margins so a
 * module's box is full bleed and can ink the band behind it; the type is
 * then inset by what the format actually asks for — including the story's
 * Instagram safe bands (formats.ts STORY_SAFE, 125 / 135), which the
 * masthead spends above itself and the CTA below. */
const inset = (paint: PosterPaint) => FORMATS[paint.format.key].margins;

/* A display line sits on its CAP, not on its em box: the ink extent read
 * off the face itself, which is what lets RACE and DAY stack tight enough
 * to read as one block. Falls back to Archivo Black's ratio. */
function capOf(ctx: Ctx, font: string, size: number): number {
  ctx.font = font;
  const a = ctx.measureText("H").actualBoundingBoxAscent;
  return Number.isFinite(a) && a > 0 ? a : size * 0.72;
}

/* A hairline box drawn as four fills — paint.ts has no strokeRect, and a
 * stroked rect would straddle the pixel anyway. */
function frameRect(
  ctx: Ctx,
  paint: PosterPaint,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  color: string,
): void {
  paint.rule(ctx, x, y, w, t, color);
  paint.rule(ctx, x, y + h - t, w, t, color);
  paint.rule(ctx, x, y + t, t, h - 2 * t, color);
  paint.rule(ctx, x + w - t, y + t, t, h - 2 * t, color);
}

/* A module whose measure is its draw under an empty clip (community.ts's
 * idiom), so the budget and the ink can never disagree by a unit. measure()
 * runs with box.h = Infinity; every draw below reads box.h only through
 * Number.isFinite. */
function mod(id: string, minH: number, draw: Draw): Mod {
  return {
    id,
    minH,
    measure: (ctx, box, d, _fonts, paint) => silently(ctx, () => draw(ctx, box, d, paint)),
    draw: (ctx, box, d, _fonts, paint) => draw(ctx, box, d, paint),
  };
}

/* The measure inside a full-bleed box. */
const colOf = (box: PosterBox, paint: PosterPaint) => {
  const m = inset(paint);
  return { x: box.x + m.left, w: box.w - m.left - m.right };
};

/* ------------------------------------------------------------- the modules */

/* THE MASTHEAD. A thick white rule, the promoter line under it, and the
 * clock flush right — "SUN SEP 27 puts the WHEN in the one place a story
 * chip or a crop never eats". ROWTEMBER is type and only type: there is no
 * logo file and none is invented. */
function mastMod(id: string, lead: boolean): Mod {
  return mod(id, 40, (ctx, box, d, paint) => {
    const tk = paint.tk;
    const m = inset(paint);
    const { x, w } = colOf(box, paint);
    // The format's top margin belongs to whatever is at the TOP of the frame:
    // on an ad and on the torn bill that is this rule, and on a story it is
    // Instagram's profile chip, 125 units of it. `mast.tight` is the same
    // masthead sitting UNDER the window on a pasted bill, where that margin
    // would be a hole in the picture. (A module cannot work this out for
    // itself — measure() is called at y 0 whatever row it lands in — so the
    // plan says which it wants, the way the head says one line or two.)
    let y = box.y + (lead ? m.top : tk.small * 1.4);
    paint.rule(ctx, x, y, w, tk.thick, WHITE);
    y += tk.thick;
    const size = tk.datel * 1.05;
    const f = paint.font("monoBold", size);
    const met = paint.metricsOf(ctx, f, size);
    const top = y + size * 0.9;
    const base = paint.baselineOf(top, met.lh, met);
    const tr = size * 0.22;
    paint.drawText(ctx, `ROWTEMBER ${d.year}`, x, base, f, WHITE, tr);
    paint.drawRight(ctx, d.race.stamp, x + w, base, f, KEY, tr);
    return top + met.lh + size * 1.4 - box.y;
  });
}

/* THE HEAD. RACE over DAY on a tall frame, RACE DAY on one line on a short
 * one — each line FITTED FLUSH to the measure, which is why the two words
 * are different sizes: a three-letter word and a four-letter word that both
 * span the same column cannot be the same size, and that stepped block is
 * the whole look. Budgeted at HEAD_SHARE of the frame so a wall sheet keeps
 * its lower half. This is the plans' grow row on the solid ad: the room
 * nothing else needed goes into the TYPE first (up to the flush fit), then
 * into the leading, then around the block — so the bill never leaves a hole
 * somewhere else and never floats its headline in a field of air. */
function headMod(id: string, split: boolean): Mod {
  const linesOf = (d: RaceDayPoster) => (split ? d.race.head : [d.race.head.join(" ")]);
  return mod(id, 60, (ctx, box, d, paint) => {
    const tk = paint.tk;
    const { x, w } = colOf(box, paint);
    const lines = linesOf(d);
    // Flush first: the size at which each word spans the measure on its own,
    // which is why a three-letter word is set bigger than a four-letter one.
    const flush = lines.map((t) => paint.fitSize(ctx, t, "black", 900, 18, w, -0.02));
    const capsAt = (ss: number[]) => ss.map((s) => capOf(ctx, paint.font("black", s), s));
    const leadAt = (cs: number[]) => Math.max(...cs) * 0.055;
    const blockAt = (cs: number[]) => cs.reduce((a, b) => a + b, 0) + leadAt(cs) * (lines.length - 1);
    const wanted = blockAt(capsAt(flush));
    const under = tk.small * 1.1;
    // The blank under the hairline. On an overlay it is the gap ABOVE the
    // window, which is why it is a shared number and not a local one.
    const below = WINDOW_AIR(tk);
    const air = under + tk.hair + below;
    // MEASURE asks for HEAD_SHARE of the frame; DRAW takes the room the
    // grow row actually handed it, up to the flush fit and never under what
    // it measured. So a 24x36, which has room to spare, gets RACE and DAY
    // FLUSH — the signature — instead of the same block floating in 350
    // units of air, and a 9:16 gets exactly what it measured.
    const room = Number.isFinite(box.h) ? Math.max(0, box.h - air) : 0;
    const budget = Math.min(wanted, Math.max(paint.format.h * headShare(paint), room));
    const k = wanted > budget ? budget / wanted : 1;
    const sizes = flush.map((s) => Math.max(18, Math.floor(s * k)));
    const fonts = sizes.map((s) => paint.font("black", s));
    const caps = capsAt(sizes);
    const lead = leadAt(caps);
    const blockH = blockAt(caps);
    const natural = blockH + air;
    // THE GROW ROW, and where its surplus goes. The leading takes a little,
    // and what is left is split EVENLY above and below the block.
    //
    // It used to be a third above and two thirds below, with the hairline
    // drawn tight under the block — which put every spare unit in one band
    // BELOW A RULE, and a rule with nothing after it is the loading failure
    // this file's header says was designed out. Measured on the 24x36: 233
    // px, 10.85 % of the sheet, against 2 to 4 % on every other frame
    // (review, 2026-09-11). A 2:3 head is already at its flush fit and
    // cannot eat the surplus as type, so the fix is where the air LANDS, not
    // how much of it there is: half over the headline, half under it, and
    // the hairline moved to the foot of the row so the whole band reads as
    // the head's own air and the rule still closes it against the piece.
    const extra = Number.isFinite(box.h) ? Math.max(0, box.h - natural) : 0;
    const spread = lines.length > 1 ? Math.min(extra * 0.5, blockH * 0.12) : 0;
    let y = box.y + (extra - spread) * 0.5;
    lines.forEach((t, i) => {
      paint.drawText(ctx, t, x, y + caps[i], fonts[i], WHITE, -0.02 * sizes[i]);
      y += caps[i] + (i < lines.length - 1 ? lead + spread / (lines.length - 1) : 0);
    });
    // At the foot of the row, less the blank the next module is owed — which
    // on an overlay is the gap above the window. With no surplus (every
    // phone overlay, where the head does not grow) that is the same unit the
    // rule has always been drawn on, so nothing moves on those frames.
    const ruleY = Number.isFinite(box.h)
      ? Math.max(y + under, box.y + box.h - below - tk.hair)
      : y + under;
    paint.rule(ctx, x, ruleY, w, tk.hair, HAIR);
    return Number.isFinite(box.h) ? box.h : natural;
  });
}

/* THE PIECE. What it is, in two falling weights: the trial fitted to the
 * same measure as the head (which is what makes the stack read as a bill),
 * and the one time the owner asked for out loud — "maybe we could just say
 * first wave starts at six thirty", six fifteen now and read off
 * waveTime(race, 1) rather than typed — in mono under it.
 *
 * There were THREE weights until 2026-09-11: an Archivo 700 line between
 * these two that said ROWED IN WAVES OF EIGHT. The owner took it off
 * ("remove rowed in waves of eight" — entirely), and the `piece.short`
 * variant went with it: it existed only to drop that line on a 1:1. One
 * module now, on every frame, so the two lines a story carries are the two
 * lines a 24x36 carries. */
const piece = mod("piece", 40, (ctx, box, d, paint) => {
  const tk = paint.tk;
  const { x, w } = colOf(box, paint);
  const size = paint.fitSize(ctx, d.race.piece, "black", 400, 12, w, -0.02);
  const f = paint.font("black", size);
  // The same lead the window hands back below itself: the blank over the
  // trial is one number wherever the trial sits.
  let y = box.y + PIECE_LEAD(tk);
  y += capOf(ctx, f, size);
  paint.drawText(ctx, d.race.piece, x, y, f, WHITE, -0.02 * size);
  const s3 = tk.datel * 1.25;
  const f3 = paint.font("monoBold", s3);
  const met3 = paint.metricsOf(ctx, f3, s3);
  const top3 = y + s3 * 0.55;
  paint.drawText(ctx, d.race.firstWave, x, paint.baselineOf(top3, met3.lh, met3), f3, WHITE, s3 * 0.12);
  return top3 + met3.lh + tk.small * 1.3 - box.y;
});

/* THE BRACKET — the landing page's chip row inverted onto ink, and the one
 * block that carries the WHEN at display weight so it survives a grid
 * thumbnail. Three cells under a thick rule, parted by hairlines, closed by
 * a thin one: the date, the window, and the entry. FREE is printed here and
 * on no other module. All three values take the SAME size — the largest at
 * which the longest of them fits its cell — because a bracket of unequal
 * numbers reads as three separate things. */
const bracket = mod("bracket", 60, (ctx, box, d, paint) => {
  const tk = paint.tk;
  const { x, w } = colOf(box, paint);
  const cells = [
    { v: d.race.date, s: d.race.dayWord },
    { v: d.race.hours, s: d.race.every },
    { v: d.race.entry, s: d.race.entrySub },
  ];
  const cellW = w / cells.length;
  const pad = tk.small * 1.15;
  const inner = cellW - pad * 1.5;
  const size = Math.min(
    ...cells.map((c) => paint.fitSize(ctx, c.v, "black", tk.statN * 1.3, tk.statN * 0.5, inner, -0.02)),
  );
  const f = paint.font("black", size);
  const cap = capOf(ctx, f, size);
  const ls = tk.statL * 0.98;
  const fl = paint.font("mono", ls);
  const metL = paint.metricsOf(ctx, fl, ls);
  let y = box.y;
  paint.rule(ctx, x, y, w, tk.thick, WHITE);
  const top = y + tk.thick;
  y = top + tk.small * 0.7;
  const labelTop = y + cap + tk.small * 0.75;
  cells.forEach((c, i) => {
    const cx = x + i * cellW + (i === 0 ? 0 : pad);
    paint.drawText(ctx, c.v, cx, y + cap, f, WHITE, -0.02 * size);
    const room = cellW - (i === 0 ? 0 : pad) - pad * 0.6;
    const label = paint.ellipsize(ctx, c.s, room, fl, ls * 0.14);
    paint.drawText(ctx, label, cx, paint.baselineOf(labelTop, metL.lh, metL), fl, QUIET, ls * 0.14);
  });
  const close = labelTop + metL.lh + tk.small * 0.75;
  for (let i = 1; i < cells.length; i++) {
    paint.rule(ctx, x + i * cellW, top + tk.small * 0.35, tk.hair, close - top - tk.small * 0.7, FAINT);
  }
  paint.rule(ctx, x, close, w, tk.hair * 1.2, WHITE);
  return close + tk.hair * 1.2 + tk.small * 1.2 - box.y;
});

/* THE WAVES — a picture of the format for somebody who has never rowed one.
 * ONE row of ergs, never a grid of them: the first cell is solid (the wave
 * that goes off first — waveTime is the only thing that says when, and a
 * time is never typed in this file) and the rest are outlines, so the frame
 * says "you go in a heat of eight" without promising a field size nobody has
 * sold.
 *
 * NO PLAN DRAWS IT since 2026-09-11 — see `blocks` below. It says the wave
 * size the owner struck, in a picture instead of a sentence. */
const waves = mod("waves", 40, (ctx, box, d, paint) => {
  const tk = paint.tk;
  const { x, w } = colOf(box, paint);
  const ls = tk.small * 1.05;
  const fl = paint.font("monoBold", ls);
  const metL = paint.metricsOf(ctx, fl, ls);
  const top = box.y + tk.small * 0.2;
  paint.drawText(ctx, d.race.waveLabel, x, paint.baselineOf(top, metL.lh, metL), fl, KEY, ls * 0.16);
  const n = Math.max(1, Math.min(12, d.race.waveSize));
  const gap = tk.small * 0.5;
  const cellW = (w - gap * (n - 1)) / n;
  const cellH = Math.min(tk.row * 1.7, cellW * 1.25);
  const y = top + metL.lh + tk.small * 0.9;
  const ns = Math.min(tk.small * 1.05, cellH * 0.55);
  const fn = paint.font("monoBold", ns);
  const metN = paint.metricsOf(ctx, fn, ns);
  for (let i = 0; i < n; i++) {
    const cx = x + i * (cellW + gap);
    if (i === 0) paint.rule(ctx, cx, y, cellW, cellH, WHITE);
    else frameRect(ctx, paint, cx, y, cellW, cellH, tk.hair, HAIR);
    paint.drawCentered(
      ctx,
      String(i + 1),
      cx + cellW / 2,
      paint.baselineOf(y + (cellH - metN.lh) / 2, metN.lh, metN),
      fn,
      i === 0 ? RACE_INK : QUIET,
      0,
    );
  }
  return y + cellH + tk.small * 1.2 - box.y;
});

/* THE FACTS — the monitor design's split rows: key mono grey flush left,
 * value mono white flush right, a hairline under each. It carried the
 * closing minute until the owner took the deadline off the artwork
 * (2026-09-11); closesAt still refuses a late entry, it just no longer
 * announces itself. What is left is the fact no other module carries — the
 * waiver is signed at the gym, before you row — and the field, once enough
 * names are in to be worth printing. A fit:"lines" slot: it draws the rows
 * that fit, one at least, or nothing at all when the race has neither. */
const factRows = (d: RaceDayPoster): { k: string; v: string }[] => {
  const rows: { k: string; v: string }[] = [];
  if (d.race.waiver) rows.push({ k: "WAIVER", v: d.race.waiver });
  if (d.field) rows.push({ k: "IN SO FAR", v: `${d.field.racers} RACERS` });
  return rows;
};

/* One row is a whole table now that the deadline is off it. */
const FACT_MIN = 1;

const facts: Mod = {
  id: "facts",
  /* One row and its air, in the widest family metric — the floor a lines
   * slot is cut to. */
  minH: 30 * 0.86 + 12,
  measure: (ctx, box, d, _fonts, paint) => silently(ctx, () => drawFacts(ctx, box, d, paint)),
  draw: (ctx, box, d, _fonts, paint) => drawFacts(ctx, box, d, paint),
};

function drawFacts(ctx: Ctx, box: PosterBox, d: RaceDayPoster, paint: PosterPaint): number {
  const tk = paint.tk;
  const { x, w } = colOf(box, paint);
  const rows = factRows(d);
  // A race with no waiver and no field draws no hairline and takes no air.
  if (rows.length === 0) return 0;
  const pitch = tk.rowPitch * 0.86;
  const air = tk.small * 0.6;
  const room = Number.isFinite(box.h) ? box.h - air : Number.POSITIVE_INFINITY;
  // THE EPSILON, and it is not decoration. measure() returns exactly
  // `air + n × pitch`, the engine hands that same number back as box.h, and
  // room / pitch then comes out at 1.9999999999999998 on a printS sheet
  // (51.6 / 25.8) — so the floor cut the last row off the table it had just
  // asked room for, and the sheet drew a 26-unit hole under the waiver.
  // That was masked while the floor was two rows; it showed the moment the
  // deadline came off and a two-row table became the common case.
  const n = Math.max(FACT_MIN, Math.min(rows.length, Math.floor(room / pitch + 1e-6)));
  const ks = tk.row * 0.82;
  const vs = tk.row * 0.92;
  const fk = paint.font("mono", ks);
  const fv = paint.font("monoBold", vs);
  const metV = paint.metricsOf(ctx, fv, vs);
  let y = box.y + air;
  for (let i = 0; i < Math.min(n, rows.length); i++) {
    const base = paint.baselineOf(y + (pitch - metV.lh) / 2 - tk.hair, metV.lh, metV);
    paint.drawText(ctx, rows[i].k, x, base, fk, KEY, ks * 0.16);
    paint.drawRight(ctx, rows[i].v, x + w, base, fv, WHITE, vs * 0.05);
    y += pitch;
    paint.rule(ctx, x, y - tk.hair, w, tk.hair, FAINT);
  }
  return y - box.y;
}

/* THE TWO WAYS IN (owner, 2026-09-11: "we need there to be a way to sign up
 * as a spectator versus as just a racer"). Both sentences are RACE_ROLES
 * verbatim through the assembler, so the ad and the sign-up say the same
 * words. */
const ways = mod("ways", 50, (ctx, box, d, paint) => {
  const tk = paint.tk;
  const { x, w } = colOf(box, paint);
  const ls = tk.small * 1.05;
  const fl = paint.font("monoBold", ls);
  const metL = paint.metricsOf(ctx, fl, ls);
  const top = box.y + tk.small * 0.2;
  paint.drawText(ctx, "TWO WAYS IN", x, paint.baselineOf(top, metL.lh, metL), fl, KEY, ls * 0.2);
  let y = top + metL.lh + tk.small * 0.7;
  const ks = tk.row * 1.05;
  const fk = paint.font("black", ks);
  const fs = paint.font("archivo", ks);
  const cap = capOf(ctx, fk, ks);
  const keyW = Math.max(w * 0.3, paint.measure(ctx, "SPECTATOR", fk, 0) + tk.small * 1.6);
  for (const r of d.race.roles) {
    y += tk.small * 0.75;
    paint.drawText(ctx, r.label, x, y + cap, fk, WHITE, -0.01 * ks);
    paint.drawText(ctx, paint.ellipsize(ctx, r.line, w - keyW, fs, 0), x + keyW, y + cap, fs, BONE, 0);
    y += cap + tk.small * 0.75;
    paint.rule(ctx, x, y, w, tk.hair, FAINT);
  }
  return y + tk.small * 1.1 - box.y;
});

/* THE HOUSE. The venue mark placed exactly once, flush left at the foot,
 * with the room and the town right-aligned opposite it — a promoter credit,
 * never a co-brand. This is where THE ENGINE ROOM lands without spending a
 * sentence on it; the note that used to ride under it is gone (owner,
 * 2026-09-11: "remove the phrase new this September"), so the second line
 * is the town on its own. The mark is white on transparent, so it needs no
 * treatment on ink and none over a photograph; when the image has not
 * loaded the block keeps its height and the gym's name is set in type
 * instead. It is on every frame but one — the 1:1 OVERLAY drops it, because
 * on that frame the choice is between the venue and saying what the event
 * is (see the overlay plans).
 *
 * IT HAS NO LABEL (owner, 2026-09-11: "Remove the house on race day ads").
 * A mono eyebrow reading THE HOUSE used to sit between the rule and the
 * mark, and it was the one sentence this block spent on itself — a credit
 * that has to caption itself is not a credit. The block is the rule, the
 * mark and the lines opposite it now, and NOTHING was left where the
 * eyebrow was: its line and the blank under it are out of the height the
 * module returns, so the bill closes up by that much and the grow row (the
 * headline on an ad, the picture on an overlay) takes the units. The mark
 * hangs off the rule on the same 1.2 smalls the eyebrow sat on, answered by
 * the 1.1 under the mark, so the foot is a block with its own air rather
 * than a line that lost its caption. */
const host = mod("host", 60, (ctx, box, d, paint) => {
  const tk = paint.tk;
  const { x, w } = colOf(box, paint);
  // The foot opens on a thick rule with air above it, the way the bill's
  // masthead opens on one: a hairline here landed a few units under the
  // bracket's own closing rule and the two read as one railroad track.
  let y = box.y + tk.small * 1.3;
  paint.rule(ctx, x, y, w, tk.thick, WHITE);
  y += tk.thick + tk.small * 1.2;
  const markW = w * MARK_SHARE;
  const ratio = d.race.venueMark?.ratio ?? 1170 / 466;
  const markH = markW / ratio;
  if (d.race.venueMark && paint.assets.venue) {
    paint.image(ctx, paint.assets.venue, x, y, markW, markH);
  } else {
    const vs = Math.min(markH * 0.62, paint.fitSize(ctx, d.race.venue, "black", 200, 10, markW, -0.02));
    const fv = paint.font("black", vs);
    paint.drawText(ctx, d.race.venue, x, y + (markH + capOf(ctx, fv, vs)) / 2, fv, WHITE, -0.02 * vs);
  }
  const rs = tk.small * 1.02;
  const fr = paint.font("monoBold", rs);
  const fq = paint.font("mono", rs * 0.94);
  const metR = paint.metricsOf(ctx, fr, rs);
  const room = w - markW - tk.small * 1.6;
  const two = markH > metR.lh * 2.4;
  const rTop = y + (markH - metR.lh * (two ? 2 : 1)) / 2;
  paint.drawRight(
    ctx,
    paint.ellipsize(ctx, d.race.room, room, fr, rs * 0.14),
    x + w,
    paint.baselineOf(rTop, metR.lh, metR),
    fr,
    WHITE,
    rs * 0.14,
  );
  if (two) {
    paint.drawRight(
      ctx,
      paint.ellipsize(ctx, d.race.city, room, fq, rs * 0.13),
      x + w,
      paint.baselineOf(rTop + metR.lh, metR.lh, metR),
      fq,
      QUIET,
      rs * 0.13,
    );
  }
  return y + markH + tk.small * 1.1 - box.y;
});

/* THE CALL TO ACTION — the monitor design's white slab, grafted whole. It
 * is the one element in the whole review that survives any photograph at
 * any brightness, it is the only place any frame says a verb, and it is the
 * difference between a bill and an ad. The URL is set as large as the block
 * will take rather than at a mono footnote's size, because a reposted,
 * re-compressed frame has to keep it.
 *
 * IT IS THE SLAB ALONE NOW. A line of grey small print sat above it on
 * every frame — MEN AND WOMEN SCORED APART, and the deadline behind a
 * middle dot on the phone frames — and the owner took both off (2026-09-11).
 * Nothing was moved up to take the line's place: the slab is pinned to the
 * bottom margin either way, so the room it freed went to the grow row, and
 * the two variants of this module (`cta` and `cta.print`, which differed
 * only in whether that line carried the deadline) collapsed into one. */
const cta = mod("cta", 60, (ctx, box, d, paint) => {
  const tk = paint.tk;
  const m = inset(paint);
  const { x, w } = colOf(box, paint);
  const y = box.y;
  const blockH = tk.footer * 3.4;
  paint.rule(ctx, x, y, w, blockH, WHITE);
  const pad = tk.small * 1.2;
  const gs = blockH * 0.4;
  const fg = paint.font("black", gs);
  const cap = capOf(ctx, fg, gs);
  const base = y + (blockH + cap) / 2;
  const gw = paint.drawText(ctx, "SIGN UP", x + pad, base, fg, RACE_INK, -0.01 * gs);
  const us = Math.min(
    tk.footer * 1.2,
    paint.fitSize(ctx, d.url, "monoBold", 40, 7, w - gw - pad * 3, 0.04),
  );
  const fu = paint.font("monoBold", us);
  const metU = paint.metricsOf(ctx, fu, us);
  paint.drawRight(
    ctx,
    d.url,
    x + w - pad,
    paint.baselineOf(y + (blockH - metU.lh) / 2, metU.lh, metU),
    fu,
    RACE_INK,
    us * 0.04,
  );
  return y + blockH + m.bottom - box.y;
});

/* THE WINDOW — the overlay hole, and the only module that CUTS instead of
 * drawing. Both grounds paint the same solid ink (raceGround.ts); on an
 * overlay this row then ERASES its own box with destination-out, so the
 * photograph comes through at full strength and the alpha channel of the
 * PNG is the bill itself.
 *
 * Why an erase rather than a band of ink painted behind every module: the
 * engine clips each module to a box whose edges land on fractional pixels,
 * so two bands meeting at one of those edges each cover that row PARTLY and
 * the seam comes out at about 76 percent alpha — six hairlines of
 * photograph straight through the middle of the ink. That is how the first
 * cut of this file failed, measured off the exported bytes with
 * scratchpad alpha.mjs. One erase has one antialiased edge at each end of
 * the window, which is what an edge is supposed to have.
 *
 * The share below is the window FLOOR (the winning design took 32 to 36 per
 * cent); `grow` on the row is what usually decides how big it gets, and fit
 * "cap" is what makes it give the room back on a frame that cannot hold the
 * bill. */
const WINDOW_SHARE = 0.22;

/* THE PHOTOGRAPH IN BLACK AND WHITE, done as pixels rather than as
 * ctx.filter — slides.ts's reasoning, and the same Rec.709 matrix CSS
 * grayscale() uses: the pixel math is identical in every browser where
 * ctx.filter is missing on older Safari, and a switch the owner set to BLACK
 * AND WHITE must never silently export colour. No contrast or brightness
 * curve: unlike the post pack's beds, nothing is set over this picture — it
 * sits in a window beside the bill, so it is the photograph as shot.
 *
 * Reading the pixels back is only safe because the studio arms crossOrigin
 * on the gallery URL (PosterStudio loadImage); a tainted image never gets
 * this far, because it never loads at all. One grey copy per image, kept on
 * a WeakMap so the preview and the full-res render share it and it goes when
 * the image does. */
const GREY = new WeakMap<HTMLImageElement, HTMLCanvasElement | null>();

function greyOf(img: HTMLImageElement): HTMLCanvasElement | null {
  const had = GREY.get(img);
  if (had !== undefined) return had;
  let out: HTMLCanvasElement | null = null;
  try {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext("2d");
    if (x) {
      x.drawImage(img, 0, 0);
      const image = x.getImageData(0, 0, c.width, c.height);
      const px = image.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        px[i] = lum;
        px[i + 1] = lum;
        px[i + 2] = lum;
      }
      x.putImageData(image, 0, 0);
      out = c;
    }
  } catch (err) {
    // Impossible on a CORS-loaded image, and loud if it ever happens: the
    // frame then draws no picture at all rather than a colour one.
    console.error("row100k/poster: the race photo could not be made black and white", err);
    out = null;
  }
  GREY.set(img, out);
  return out;
}

/* `air` is the blank the window keeps BELOW itself, inside its own row, so
 * the picture does not sit on the line under it (owner, 2026-09-11). It is
 * WINDOW_AIR less the lead the next module already carries, which makes the
 * gap under the window the same blank as the gap over it — the head leaves
 * exactly WINDOW_AIR under its hairline.
 *
 * The PASTED plans pass false: there the window is the first row and bleeds
 * off the top of the frame, so it has no gap above to match, and what
 * follows is `mast.tight`, which carries its own air over its rule by
 * design. Adding this one on top would stack two blanks and push the bill
 * down the sheet.
 *
 * `fill` is which of the two things this row does with its box. FALSE cuts
 * it out (destination-out) and the export is a transparent PNG to lay over a
 * photograph at post time. TRUE draws the owner's picture into it, and that
 * export is the finished ad — the review's point, 2026-09-11: the black and
 * white switch was a CSS filter on a preview backdrop, so a grey frame could
 * be approved and a colour one posted. The picture is cover-cropped to the
 * WHOLE FRAME and then clipped to this box, not cover-cropped to the box, so
 * the crop is the same one the studio shows behind the overlay preview —
 * what he judges is what the file is. */
function windowMod(id: string, air: boolean, fill: boolean): Mod {
  return {
    id,
    minH: 40,
    measure: (_ctx, _box, _d, _fonts, paint) => paint.format.h * WINDOW_SHARE,
    draw: (ctx, box, d, _fonts, paint) => {
      if (!Number.isFinite(box.h) || box.h <= 0) return 0;
      const pad = air ? Math.max(0, WINDOW_AIR(paint.tk) - PIECE_LEAD(paint.tk)) : 0;
      const h = box.h - pad;
      if (h <= 0) return box.h;
      if (!fill) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "#000";
        ctx.fillRect(box.x, box.y, box.w, h);
        ctx.restore();
        // The row keeps its whole height: the pad is ink, and the module
        // that follows starts where the engine put it.
        return box.h;
      }
      const img = paint.assets.photo;
      // No picture is not this module's call to make — raceGround.ts has
      // already dropped the frame back to the solid ad — so this is only
      // ever the belt: draw nothing rather than a stretched nothing.
      if (!img || !img.naturalWidth || !img.naturalHeight) return box.h;
      const src = d.photo.bw ? greyOf(img) : img;
      if (!src) return box.h;
      // object-fit: cover over the frame, the way the preview lays it.
      const fw = paint.format.w;
      const fh = paint.format.h;
      const s = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
      const w = img.naturalWidth * s;
      const ph = img.naturalHeight * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, h);
      ctx.clip();
      ctx.drawImage(src, (fw - w) / 2, (fh - ph) / 2, w, ph);
      ctx.restore();
      return box.h;
    },
  };
}

/* --------------------------------------------------------------- the plans */

const one = (id: string, module: string, extra: Partial<PosterRow> = {}): PosterRow => ({
  id,
  slots: [{ module, span: 1 }],
  ...extra,
});

const lines = (id: string, module: string, extra: Partial<PosterRow> = {}): PosterRow => ({
  id,
  slots: [{ module, span: 1, fit: "lines" }],
  ...extra,
});

/* THE SOLID AD. The head is the grow row: whatever the frame has spare goes
 * into the headline and around it, never into a band of nothing above the
 * foot — "62 logical units of nothing reads as a loading failure on a
 * phone", which is the hole this design left and the judges would not have.
 *
 * WHAT FITS WHERE, measured rather than argued. A 9:16 has 700 live units
 * and the bill — masthead, RACE over DAY flush, the piece, the bracket, the
 * house and the SIGN UP block — spends every one of them. So the fact table
 * and the two ways in are PRINT: a flyer on the gym wall is read standing
 * still and has the room for them. The phone frames carry NEITHER, and no
 * deadline either — the CTA is the slab alone since the owner took that line
 * off (2026-09-11), and what comes off the frames is in the caption. */
const inkPlan = (key: PosterPlanKey, rows: PosterRow[], footer: string, drop: string[]): PosterPlan => ({
  key,
  cols: 1,
  rows,
  footer,
  drop,
  shrink: ["cap"],
});

/* The phone bill: nothing between the bracket and the house, because the
 * head takes that room. */
const adRows = (head: string): PosterRow[] => [
  one("A", "mast"),
  one("B", head, { grow: 1 }),
  one("C", "piece"),
  one("D", "bracket"),
  one("H", "host"),
];

/* The printed bill: the same stack with the two ways in and the fact table
 * between the bracket and the house. `ways` goes first when a sheet cannot
 * hold it; the facts yield lines before it (the engine trims a lines slot
 * first) and one row is their floor.
 *
 * THE WAVE ROW CAME OFF, 2026-09-11 (review). The owner struck ROWED IN
 * WAVES OF EIGHT off the bill and the sentence went, but this row drew the
 * same claim as a picture — `8 ERGS A WAVE · EVERY 30 MIN` over eight
 * numbered cells — on the three print sheets he never reviewed. The head is
 * the grow row and takes the units back, so nothing opened where it was. */
const printRows = (): PosterRow[] => [
  one("A", "mast"),
  one("B", "head", { grow: 1 }),
  one("C", "piece"),
  one("D", "bracket"),
  one("F", "ways"),
  lines("G", "facts"),
  one("H", "host"),
];

const inkStory = inkPlan("story", adRows("head"), "cta", []);
/* The 4:5 takes the STACKED head, not the one-liner. A one-line head is
 * already flush at 60 units of cap and cannot grow into what the grow row
 * hands it, so the 4:5's 105 units of surplus fell under the hairline as a
 * 184 px band — 13.6 % of the frame, the same hole this file's header says
 * was designed out. RACE over DAY eats that surplus as TYPE (a 173-unit
 * block where the one-liner drew 60), which is what the 9:16 already does.
 * The 1:1 keeps the one-liner: it has six units of slack, not a hundred. */
const inkPost = inkPlan("post", adRows("head"), "cta", []);
const inkSquare = inkPlan("square", adRows("head.one"), "cta", []);
/* The drop order on paper: the two ways in, then the facts. TWO WAYS IN is
 * last to go of the two because signing up as a spectator is an owner
 * decision, not a nicety — and the wave row that used to head this list is
 * not drawn at all any more (printRows). */
const inkPrint = (key: PosterPlanKey): PosterPlan =>
  inkPlan(key, printRows(), "cta", ["ways", "facts"]);

/* THE OVERLAY. The same bill with the ground taken out and a window put in.
 * On 9:16 the window sits under the headline — the torn bill, two bands —
 * because a story is looked at from the top; on 4:5 and 1:1 the bill is
 * pasted at the foot and the subject keeps the top of the frame, which is
 * the shape that held up over the real photographs.
 *
 * THE WINDOW IS THE GROW ROW AND THE YIELDING ROW AT ONCE: fit "cap" so a
 * frame that cannot hold the bill takes the picture back rather than
 * overflowing, `grow` so every unit the bill does not need is picture. The
 * bill itself is LEANER than the ad — it takes the ONE-LINE head on the
 * phone frames, and there is no short piece to take any more (that variant
 * died with the wave sentence, 2026-09-11) — for the same reason. Measured
 * off the exported alpha, as a share of the whole frame:
 *   story  25.9 % window (the band between the two bills)
 *   post   27.5 %
 *   square 32.4 %, and it buys that by dropping THE VENUE — a 1:1 cannot
 *          hold the whole bill AND a photograph, which is what every stream
 *          found; the caption carries what comes off.
 *
 * WHAT COMES OFF THE 1:1 IS THE HOST BLOCK, AND ONLY THE HOST BLOCK. The
 * first cut dropped the masthead and the piece instead, and the frame that
 * came back said RACE DAY over a date with The Strip Barbell as the only
 * mark on it: no ROWTEMBER 2026, and nowhere did it say what the event
 * WAS. The venue is the biggest row on the sheet (124 units against the
 * masthead's 61 and the piece's 70) and the least load-bearing — it is on
 * the other nine formats, in the caption, and on the page the CTA points
 * at — so ONE drop clears the whole 91-unit overflow with 33 units to
 * spare, and those 33 grow the photograph instead of shrinking it. That is
 * also why the list is one entry long: a second entry would fire before
 * the `cap` step ever ran and take a row the frame could afford. */
const overlayPlan = (key: PosterPlanKey, rows: PosterRow[], drop: string[] = []): PosterPlan => ({
  key,
  cols: 1,
  rows,
  footer: "cta",
  drop,
  shrink: ["cap"],
});

const windowSlot = (module: string) => ({
  id: "W",
  slots: [{ module, span: 1 as const, fit: "cap" as const }],
  grow: 1,
});

const overTorn = (key: PosterPlanKey, head: string): PosterPlan =>
  overlayPlan(key, [
    one("A", "mast"),
    one("B", head),
    windowSlot("window"),
    one("C", "piece"),
    one("D", "bracket"),
    one("H", "host"),
  ]);

const overPasted = (key: PosterPlanKey, head: string, drop: string[]): PosterPlan =>
  overlayPlan(
    key,
    [
      windowSlot("window.top"),
      one("A", "mast.tight"),
      one("B", head),
      one("C", "piece"),
      one("D", "bracket"),
      one("H", "host"),
    ],
    drop,
  );

/* ------------------------------------------------------------- the layouts */

const blocks: Record<string, Mod> = {
  mast: mastMod("mast", true),
  "mast.tight": mastMod("mast.tight", false),
  cta,
  head: headMod("head", true),
  "head.one": headMod("head.one", false),
  piece,
  bracket,
  /* PARKED, not drawn: no plan carries the wave grid since 2026-09-11. The
   * owner struck ROWED IN WAVES OF EIGHT as a sentence, and the grid is the
   * same claim drawn as a picture (review) — eight numbered cells and
   * `waveLabel` over them — so it came off the print sheets he had not
   * reviewed. It is kept here because putting it back is one row in
   * printRows(), and because the question to ask him is whether a reader who
   * has never rowed a 5k wants the picture, not whether the code can. */
  waves,
  facts,
  ways,
  host,
};

/* The two window modules, per ground. The torn window keeps a blank under
 * itself; the pasted one bleeds off the top of the frame and the masthead
 * under it carries its own. `fill` is the whole difference between the
 * overlay and the photo ground — same plans, same bill, one cuts and one
 * draws. */
const windows = (fill: boolean): Record<string, Mod> => ({
  window: windowMod("window", true, fill),
  "window.top": windowMod("window.top", false, fill),
});

const modules: Record<string, Mod> = { ...blocks, ...windows(false) };
const photoModules: Record<string, Mod> = { ...blocks, ...windows(true) };

export const raceDayLayout: PosterLayout<RaceDayPoster> = {
  subject: "raceday",
  modules,
  plans: {
    tall: inkPrint("tall"),
    short: inkPrint("short"),
    squat: inkPrint("squat"),
    core: inkPrint("core"),
    hand: inkPrint("hand"),
    story: inkStory,
    post: inkPost,
    square: inkSquare,
  },
};

/* Paper has room for the head on two lines around its window; the phone
 * frames set it on one. ONE set of plans, two layouts: the photo ground is
 * the overlay's composition with the picture drawn into the hole instead of
 * cut out of it, so a frame the owner judged as an overlay and a frame he
 * downloads finished are the same artwork. */
const overlayPlans = {
  tall: overTorn("tall", "head"),
  short: overTorn("short", "head"),
  squat: overTorn("squat", "head"),
  core: overTorn("core", "head"),
  hand: overTorn("hand", "head"),
  story: overTorn("story", "head.one"),
  post: overPasted("post", "head.one", ["mast.tight"]),
  square: overPasted("square", "head.one", ["host"]),
};

export const raceDayOverlayLayout: PosterLayout<RaceDayPoster> = {
  subject: "raceday",
  modules,
  plans: overlayPlans,
};

export const raceDayPhotoLayout: PosterLayout<RaceDayPoster> = {
  subject: "raceday",
  modules: photoModules,
  plans: overlayPlans,
};

export const raceLayoutFor = (ground: PosterGround): PosterLayout<RaceDayPoster> =>
  ground === "overlay" ? raceDayOverlayLayout : ground === "photo" ? raceDayPhotoLayout : raceDayLayout;
