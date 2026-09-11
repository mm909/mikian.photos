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
 *     right, hairline under (module `facts`) — which carries the closing
 *     time and the waiver on paper.
 *   · the date in the masthead (module `mast`, right-flush), so the WHEN
 *     sits where a crop never eats it and the city moves to the foot.
 *   · ONE row of the wave grid, never five: "five rows of eight is a
 *     40-place field stated as a picture, and a reader can count it."
 *   · MEN AND WOMEN SCORED APART on every frame (the `cta` small print).
 *   · FREE is printed ONCE — the bracket's third cell — and nowhere else.
 *
 * AND THE HOLE THE JUDGES WOULD NOT HAVE: the gig poster left 62 units of
 * nothing between its bracket and its foot rule, which "reads as a loading
 * failure on a phone". There is no dead band on any frame here — the head
 * is the grow row and takes back whatever nothing else needs, so every plan
 * closes on the footer with slack 0.
 *
 * THE GROUND SWITCH (types.ts PosterGround). Both grounds paint the same
 * solid ink; the OVERLAY plans then put a `window` row in the stack, and
 * that row cuts its own box back out of the canvas (destination-out). What
 * comes out is a transparent PNG whose alpha IS the bill — a hard-edged
 * slab of ink over the owner's own photograph of the room, every glyph on
 * solid black, no scrim anywhere. That is the winning design's answer to
 * white type over an unknown photograph: a scrim would dissolve the bill
 * into the wall and kill the picture, and a drop shadow is not this voice.
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
    const below = tk.small * 1.5;
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
    // The grow row: a third of the extra above the block, the leading takes
    // a little, the rest falls under the hairline.
    const extra = Number.isFinite(box.h) ? Math.max(0, box.h - natural) : 0;
    const spread = lines.length > 1 ? Math.min(extra * 0.5, blockH * 0.12) : 0;
    let y = box.y + (extra - spread) * 0.34;
    lines.forEach((t, i) => {
      paint.drawText(ctx, t, x, y + caps[i], fonts[i], WHITE, -0.02 * sizes[i]);
      y += caps[i] + (i < lines.length - 1 ? lead + spread / (lines.length - 1) : 0);
    });
    y += under;
    paint.rule(ctx, x, y, w, tk.hair, HAIR);
    return Number.isFinite(box.h) ? box.h : natural;
  });
}

/* THE PIECE. What it is, in three falling weights: the trial fitted to the
 * same measure as the head (which is what makes the stack read as a bill),
 * the wave sentence under it in Archivo 700, and the one time the owner
 * asked for out loud — "maybe we could just say first wave starts at six
 * thirty" — in mono. `piece.short` drops the middle line on a 1:1, where
 * the bracket's own sub already says the waves run every half hour. */
function pieceMod(id: string, short: boolean): Mod {
  return mod(id, 40, (ctx, box, d, paint) => {
    const tk = paint.tk;
    const { x, w } = colOf(box, paint);
      const size = paint.fitSize(ctx, d.race.piece, "black", 400, 12, w, -0.02);
    const f = paint.font("black", size);
    let y = box.y + tk.small * 0.3;
    y += capOf(ctx, f, size);
    paint.drawText(ctx, d.race.piece, x, y, f, WHITE, -0.02 * size);
    if (!short) {
      const s2 = size * 0.72;
      const f2 = paint.font("archivoBold", s2);
      y += s2 * 0.34 + capOf(ctx, f2, s2);
      paint.drawText(ctx, d.race.waves, x, y, f2, BONE, -0.005 * s2);
    }
    const s3 = tk.datel * 1.25;
    const f3 = paint.font("monoBold", s3);
    const met3 = paint.metricsOf(ctx, f3, s3);
    const top3 = y + s3 * 0.55;
    paint.drawText(ctx, d.race.firstWave, x, paint.baselineOf(top3, met3.lh, met3), f3, WHITE, s3 * 0.12);
    return top3 + met3.lh + tk.small * 1.3 - box.y;
  });
}

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
 * that goes off at 6:30) and the rest are outlines, so the frame says "you
 * go in a heat of eight" without promising a field size nobody has sold. */
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
 * value mono white flush right, a hairline under each. This is where the
 * two facts every stream left off its artwork live — when registration
 * closes, and that the waiver is signed at the gym — and it is what fills
 * the empty paste field the winning design left above its foot rule. A
 * fit:"lines" slot: it draws the rows that fit, two at least, or nothing. */
const factRows = (d: RaceDayPoster): { k: string; v: string }[] => {
  const rows = [{ k: "ENTER BY", v: d.race.closes }];
  if (d.race.waiver) rows.push({ k: "WAIVER", v: d.race.waiver });
  if (d.field) rows.push({ k: "IN SO FAR", v: `${d.field.racers} RACERS` });
  return rows;
};

const FACT_MIN = 2;

const facts: Mod = {
  id: "facts",
  /* Two rows and their air, in the widest family metric — the floor a
   * lines slot is cut to. */
  minH: 2 * 30 * 0.86 + 12,
  measure: (ctx, box, d, _fonts, paint) => silently(ctx, () => drawFacts(ctx, box, d, paint)),
  draw: (ctx, box, d, _fonts, paint) => drawFacts(ctx, box, d, paint),
};

function drawFacts(ctx: Ctx, box: PosterBox, d: RaceDayPoster, paint: PosterPaint): number {
  const tk = paint.tk;
  const { x, w } = colOf(box, paint);
  const rows = factRows(d);
  const pitch = tk.rowPitch * 0.86;
  const air = tk.small * 0.6;
  const room = Number.isFinite(box.h) ? box.h - air : Number.POSITIVE_INFINITY;
  const n = Math.max(FACT_MIN, Math.min(rows.length, Math.floor(room / pitch)));
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
 * under a quiet label, with the room and the town right-aligned opposite it
 * — a promoter credit, never a co-brand. This is also where THE ENGINE ROOM
 * and "new this September" land without spending a sentence on them. The
 * mark is white on transparent, so it needs no treatment on ink and none
 * over a photograph; when the image has not loaded the block keeps its
 * height and the gym's name is set in type instead. It is on every frame
 * but one — the 1:1 OVERLAY drops it, because on that frame the choice is
 * between the venue and saying what the event is (see the overlay plans). */
const host = mod("host", 60, (ctx, box, d, paint) => {
  const tk = paint.tk;
  const { x, w } = colOf(box, paint);
  // The foot opens on a thick rule with air above it, the way the bill's
  // masthead opens on one: a hairline here landed a few units under the
  // bracket's own closing rule and the two read as one railroad track.
  let y = box.y + tk.small * 1.3;
  paint.rule(ctx, x, y, w, tk.thick, WHITE);
  y += tk.thick + tk.small * 1.2;
  const ls = tk.small * 0.95;
  const fl = paint.font("mono", ls);
  const metL = paint.metricsOf(ctx, fl, ls);
  paint.drawText(ctx, "THE HOUSE", x, paint.baselineOf(y, metL.lh, metL), fl, QUIET, ls * 0.22);
  y += metL.lh + tk.small * 0.8;
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
    const note = `${d.race.roomNote} · ${d.race.city}`;
    paint.drawRight(
      ctx,
      paint.ellipsize(ctx, note, room, fq, rs * 0.13),
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
 * re-compressed frame has to keep it. The small print above it is on every
 * frame: a short line that materially changes whether a woman enters. */
function ctaMod(id: string, deadline: boolean): Mod {
  return mod(id, 60, (ctx, box, d, paint) => {
    const tk = paint.tk;
    const m = inset(paint);
    const { x, w } = colOf(box, paint);
    const ss = tk.small;
    const fs = paint.font("mono", ss);
    const metS = paint.metricsOf(ctx, fs, ss);
    const small = deadline ? d.race.smallPrint : d.race.scoring;
    let y = box.y;
    paint.drawText(ctx, small, x, paint.baselineOf(y, metS.lh, metS), fs, QUIET, ss * 0.14);
    y += metS.lh + tk.small * 0.9;
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
}

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

const windowMod: Mod = {
  id: "window",
  minH: 40,
  measure: (_ctx, _box, _d, _fonts, paint) => paint.format.h * WINDOW_SHARE,
  draw: (ctx, box) => {
    if (!Number.isFinite(box.h) || box.h <= 0) return 0;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
    return box.h;
  },
};

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
 * house and the SIGN UP block — spends every one of them. So the wave grid,
 * the fact table and the two ways in are PRINT: a flyer on the gym wall is
 * read standing still and has the room for them. The phone frames carry the
 * deadline on the CTA small print instead, which is the same fact in one
 * line rather than four. */
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
const adRows = (head: string, piece: string): PosterRow[] => [
  one("A", "mast"),
  one("B", head, { grow: 1 }),
  one("C", piece),
  one("D", "bracket"),
  one("H", "host"),
];

/* The printed bill: the same stack with the wave row, the two ways in and
 * the fact table between the bracket and the house. `ways` goes first when
 * a sheet cannot hold it, then the wave row; the facts yield lines before
 * either (the engine trims a lines slot first) and two rows is their
 * floor. */
const printRows = (): PosterRow[] => [
  one("A", "mast"),
  one("B", "head", { grow: 1 }),
  one("C", "piece"),
  one("D", "bracket"),
  one("E", "waves"),
  one("F", "ways"),
  lines("G", "facts"),
  one("H", "host"),
];

const inkStory = inkPlan("story", adRows("head", "piece"), "cta", []);
/* The 4:5 takes the STACKED head, not the one-liner. A one-line head is
 * already flush at 60 units of cap and cannot grow into what the grow row
 * hands it, so the 4:5's 105 units of surplus fell under the hairline as a
 * 184 px band — 13.6 % of the frame, the same hole this file's header says
 * was designed out. RACE over DAY eats that surplus as TYPE (a 173-unit
 * block where the one-liner drew 60), which is what the 9:16 already does.
 * The 1:1 keeps the one-liner: it has six units of slack, not a hundred. */
const inkPost = inkPlan("post", adRows("head", "piece"), "cta", []);
const inkSquare = inkPlan("square", adRows("head.one", "piece.short"), "cta", []);
/* The drop order on paper: the wave row first (the bracket already says the
 * waves run every half hour), then the two ways in, then the facts yield to
 * their two-line floor. TWO WAYS IN outranks the picture because signing up
 * as a spectator is an owner decision, not a nicety. */
const inkPrint = (key: PosterPlanKey): PosterPlan =>
  inkPlan(key, printRows(), "cta.print", ["waves", "ways", "facts"]);

/* THE OVERLAY. The same bill with the ground taken out and a window put in.
 * On 9:16 the window sits under the headline — the torn bill, two bands —
 * because a story is looked at from the top; on 4:5 and 1:1 the bill is
 * pasted at the foot and the subject keeps the top of the frame, which is
 * the shape that held up over the real photographs.
 *
 * THE WINDOW IS THE GROW ROW AND THE YIELDING ROW AT ONCE: fit "cap" so a
 * frame that cannot hold the bill takes the picture back rather than
 * overflowing, `grow` so every unit the bill does not need is picture. The
 * bill itself is LEANER than the ad — one-line head, the short piece — for
 * the same reason. Measured, on the visible frame:
 *   story  36 % window (the band between the two bills)
 *   post   23 %
 *   square 28 %, and it buys that by dropping THE VENUE — a 1:1 cannot hold
 *          the whole bill AND a photograph, which is what every stream
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

const windowSlot = { id: "W", slots: [{ module: "window", span: 1 as const, fit: "cap" as const }], grow: 1 };

const overTorn = (key: PosterPlanKey, head: string, piece: string): PosterPlan =>
  overlayPlan(key, [
    one("A", "mast"),
    one("B", head),
    windowSlot,
    one("C", piece),
    one("D", "bracket"),
    one("H", "host"),
  ]);

const overPasted = (key: PosterPlanKey, head: string, piece: string, drop: string[]): PosterPlan =>
  overlayPlan(
    key,
    [
      windowSlot,
      one("A", "mast.tight"),
      one("B", head),
      one("C", piece),
      one("D", "bracket"),
      one("H", "host"),
    ],
    drop,
  );

/* ------------------------------------------------------------- the layouts */

const modules: Record<string, Mod> = {
  mast: mastMod("mast", true),
  "mast.tight": mastMod("mast.tight", false),
  cta: ctaMod("cta", true),
  /* The print plans carry a fact table with the closing MINUTE in it, so
   * their foot line is the scoring alone rather than the deadline twice. */
  "cta.print": ctaMod("cta.print", false),
  head: headMod("head", true),
  "head.one": headMod("head.one", false),
  piece: pieceMod("piece", false),
  "piece.short": pieceMod("piece.short", true),
  bracket,
  waves,
  facts,
  ways,
  host,
  window: windowMod,
};

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

export const raceDayOverlayLayout: PosterLayout<RaceDayPoster> = {
  subject: "raceday",
  modules,
  plans: {
    /* Paper has room for the whole head and the whole piece around its
     * window; the phone frames do not. */
    tall: overTorn("tall", "head", "piece"),
    short: overTorn("short", "head", "piece"),
    squat: overTorn("squat", "head", "piece"),
    core: overTorn("core", "head", "piece"),
    hand: overTorn("hand", "head", "piece"),
    story: overTorn("story", "head.one", "piece.short"),
    post: overPasted("post", "head.one", "piece.short", ["mast.tight"]),
    square: overPasted("square", "head.one", "piece.short", ["host"]),
  },
};

export const raceLayoutFor = (ground: PosterGround): PosterLayout<RaceDayPoster> =>
  ground === "overlay" ? raceDayOverlayLayout : raceDayLayout;
