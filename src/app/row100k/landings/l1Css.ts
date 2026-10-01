/* THE DARE (L1.tsx), the signed-out front. One sheet, prefix .l1-; the bar
 * and the footer ride on theme.ts (.chrome-ink on the ink ground).
 *
 * EVERY COLOUR IS A VARIABLE the page sets on its root off the palette
 * (L1.tsx vars): --l1-bg the ground, --l1-fg the type on it, --l1-soft and
 * --l1-key the two lighter weights (the theme ink-soft and gray), --l1-hair
 * the hairline, --l1-accent the one accent cut for the ground and --l1-caps
 * the type a slab of it carries. Nothing here names a colour, so the ink
 * presets and the paper presets are the same sheet.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). Child combinators
 * are out for the same reason; every selector is a descendant one. */
export const l1Css = `
/* The ink ground runs past the page: what shows under an overscroll is
 * the ground, not white. Dark controls on it. */
html:has(.l1-ink),html:has(.l1-ink) body{background:#15171a}
.row100k.l1-ink{color-scheme:dark}
.row100k.l1 :focus-visible{outline-color:var(--l1-fg)}

/* The bar keeps its wordmark, its rail and the OPT IN chip in the top
 * right (owner, 2026-10-01): the same door as the slab under the sentence. */

/* A fact kept whole: a number never parts from its unit at a wrap. */
.row100k .l1-nb{white-space:nowrap}

/* ------------------------------------------------------------ THE FOLD
 * A poster, as tall as the screen less the bar, so OPT IN sits where a
 * thumb lands on the first screen. The bar is about 70px on a phone here
 * (two rows: the wordmark, then the section links; no chip), 100px with the
 * race day band, 57px from 640px. vh first for a browser with no svh.
 * Capped, so a tall window gets a poster and not a wall. */
.row100k .l1-fold{--l1-bar:70px;--l1-cap:860px;display:flex;flex-direction:column;min-height:min(calc(100vh - var(--l1-bar)),var(--l1-cap));min-height:min(calc(100svh - var(--l1-bar)),var(--l1-cap))}
.row100k:has(.rail-stamp) .l1-fold{--l1-bar:100px}
@media(min-width:640px){
  .row100k .l1-fold,.row100k:has(.rail-stamp) .l1-fold{--l1-bar:57px;--l1-cap:920px}
}
.row100k .l1-poster{flex:1;display:flex;flex-direction:column;width:100%;padding-top:16px;padding-bottom:26px}

/* THE DATELINE: the month left, the day of it right, a 2px rule, then one
 * cell per day with the days gone filled. */
.row100k .l1-date{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:8px;border-bottom:2px solid var(--l1-fg);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--l1-fg);white-space:nowrap}
.row100k .l1-days{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;margin-top:8px}
.row100k .l1-days i{display:block;height:8px;border:1px solid var(--l1-hair)}
.row100k .l1-days i.on{background:var(--l1-fg);border-color:var(--l1-fg)}

/* What this is, once. */
.row100k .l1-eye{margin-top:24px;font-size:11px;line-height:1.5;letter-spacing:.18em;text-transform:uppercase;color:var(--l1-soft)}

/* THE SENTENCE. The heading is the container and every line is a share of
 * its width: calc(100cqw / var(--k)), with --k the width of the line in
 * ems (L1.tsx fitK), so each line ends on the measure and the block steps
 * down ROW, 100,000, METERS, the month. The width is also held to a share
 * of the screen height, so a short or a sideways phone gets a smaller
 * poster and never a clipped one. A vw line stands in front of every cqw
 * line for a WebView without container units (the measure is the screen
 * less the gutters, and never more than the 1000px column).
 * The lines sit at line-height .8, so the padding-top is what parts them,
 * and the comma of 100,000 is the glyph that sets it. Measured off the
 * face: the cap is .6875em, the comma hangs .1875em under the baseline,
 * and with a content box of 1.347em the baseline sits .7615em under the
 * top of a .8 line box. On the phone METERS is .86 the size of 100,000
 * and .18em keeps 6px of air between the tail and the M at 390; from
 * 900px METERS IN OCTOBER is .6 the size of ROW 100,000, and the second
 * line wants .3em (11px at 1280; .2em left the tail 2px off the T).
 * The month is the one word in the accent. */
.row100k .l1-dare{container-type:inline-size;width:100%;max-width:min(100%,46vh);max-width:min(100%,46svh);margin-top:10px;font-family:var(--row-archivo-black),sans-serif;font-weight:400;line-height:.8;letter-spacing:-.02em;text-transform:uppercase;color:var(--l1-fg)}
.row100k .l1-dare em{font-style:normal;color:var(--l1-accent)}
.row100k .l1-ln{display:block}
.row100k .l1-w{display:block;font-size:calc(min(100vw - 40px,1000px) / var(--k));font-size:calc(100cqw / var(--k));white-space:nowrap;padding-top:.18em}
/* From 900px the four lines would stand taller than a laptop, so they pair
 * up: ROW 100,000 over METERS and the month, each pair fitted the same way. */
@media(min-width:900px){
  .row100k .l1-eye{font-size:13px}
  .row100k .l1-dare{max-width:min(100%,150vh);max-width:min(100%,150svh);margin-top:16px}
  .row100k .l1-ln{font-size:calc(min(100vw - 40px,1000px) / var(--kl));font-size:calc(100cqw / var(--kl));white-space:nowrap;padding-top:.1em}
  .row100k .l1-ln + .l1-ln{padding-top:.3em}
  .row100k .l1-w{display:inline;font-size:inherit;padding-top:0}
}

/* THE TWO LIVE FIGURES under OPT IN, side by side at every width (owner,
 * 2026-10-01): a mono cap label over a tabular figure, rowers a third of
 * the measure and meters the rest. The meters count up (MeterCount.tsx)
 * and the tabular figures keep the digits in their columns while they do. */
.row100k .l1-live{margin-top:22px;border-top:2px solid var(--l1-fg);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);column-gap:16px}
.row100k .l1-live div{min-width:0;padding:12px 16px 13px 0;border-right:1px dashed var(--l1-hair)}
.row100k .l1-live div:last-child{border-right:none;padding-right:0}
.row100k .l1-live dt{font-size:11px;font-weight:700;line-height:16px;letter-spacing:.16em;text-transform:uppercase;color:var(--l1-key);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row100k .l1-live dd{margin-top:6px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,8.2vw,40px);line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--l1-fg)}
@media(min-width:640px){
  .row100k .l1-live{column-gap:24px}
  .row100k .l1-live div{padding:14px 24px 15px 0}
  .row100k .l1-live dd{font-size:clamp(40px,6.4vw,72px)}
}

/* OPT IN, straight under the sentence so it is on the first screen of any
 * phone: a slab of the accent across the measure, the words in mono caps
 * at a size white holds on it, the arrow at the far end. Hover lifts it to
 * the lighter cut. */
.row100k .l1-act{padding-top:22px}
.row100k .l1-cta{display:flex;justify-content:space-between;align-items:center;gap:16px;background:var(--l1-accent);color:var(--l1-caps);font-size:clamp(18px,5vw,22px);font-weight:700;line-height:1;letter-spacing:.16em;text-transform:uppercase;padding:22px 20px 21px;text-decoration:none;transition:background 160ms ease}
.row100k .l1-cta .arr{font-weight:400;letter-spacing:0}
.row100k .l1-cta:hover,.row100k .l1-cta:focus-visible{background:var(--l1-accent-hover)}
.row100k .l1-cta:focus-visible{outline-offset:4px}
/* On a laptop the poster is its content, not the screen: OPT IN follows
 * the figures instead of being pinned 250px under them, and is a block
 * the width of a hand, not of the measure. The phone keeps the pinned foot. */
@media(min-width:640px){
  .row100k .l1-cta{display:inline-flex;min-width:320px;padding:24px 26px 23px;gap:40px}
}
@media(min-width:900px){
  .row100k .l1-fold{min-height:0}
  .row100k .l1-act{padding-top:clamp(28px,5vh,48px)}
}
/* A SHORT PHONE (an SE: 667px tall) has no room for the poster at full
 * stretch — OPT IN fell 120px under the first screen. The two figures go
 * side by side as they do from 640px, the sentence takes a smaller share
 * of the height, and the air between the blocks closes up. */
@media(max-width:639px) and (max-height:720px){
  .row100k .l1-poster{padding-top:12px;padding-bottom:18px}
  .row100k .l1-eye{margin-top:16px}
  .row100k .l1-dare{margin-top:6px;max-width:min(100%,42vh);max-width:min(100%,42svh)}
  .row100k .l1-live{margin-top:16px}
  .row100k .l1-live div{padding:10px 16px 11px 0}
  .row100k .l1-act{padding-top:16px}
  .row100k .l1-cta{padding:18px 20px 17px}
}

/* ------------------------------------------------------------ THE PAGE
 * The same ground. A section is a mono cap label on a 2px rule, the way
 * the top fives sit on the front page. */
.row100k .l1-body{padding-bottom:clamp(48px,9vh,84px)}
.row100k .l1-sec{padding:clamp(46px,9vh,80px) 0 0}
.row100k .l1-h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 14px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:17px;letter-spacing:.16em;text-transform:uppercase;color:var(--l1-fg);border-bottom:2px solid var(--l1-fg);padding-bottom:8px}
.row100k .l1-h span{color:var(--l1-key);font-weight:400}

/* HOW IT COUNTS: the numeral in the margin, the verb at poster weight, one
 * fact under it. Three across from 760px. */
.row100k .l1-steps{list-style:none}
.row100k .l1-steps li{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:baseline;padding:20px 0 19px;border-bottom:1px dashed var(--l1-hair)}
.row100k .l1-steps li:last-child{border-bottom:none;padding-bottom:0}
.row100k .l1-steps .n{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--l1-key)}
.row100k .l1-steps h3{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(32px,9.2vw,48px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase;color:var(--l1-fg)}
.row100k .l1-steps p{margin-top:9px;font-size:15px;line-height:1.4;color:var(--l1-soft)}
@media(min-width:760px){
  .row100k .l1-steps{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
  .row100k .l1-steps li{display:block;border-bottom:none;border-right:1px dashed var(--l1-hair);padding:24px 26px 4px}
  .row100k .l1-steps li:first-child{padding-left:0}
  .row100k .l1-steps li:last-child{border-right:none;padding-right:0}
  .row100k .l1-steps .n{display:block;margin-bottom:12px}
  .row100k .l1-steps h3{font-size:clamp(34px,4.2vw,48px)}
}

/* THE CARDS: the two the share dialog draws, each on an ink tile the way a
 * sticker sits on a story — the month (square) and the profile (1080 by
 * 700, letterboxed in the same square). L4Cards paints them into the .l4c
 * box, sized off the box and the device pixels; the tile holds its shape
 * from the first paint so nothing jumps when the bitmap lands. On the ink
 * ground a tile is told from the page by a hairline. The bare mark, when
 * there is no rower to draw, takes one tile. */
.row100k .l1-tiles{margin-top:18px}
.row100k .l1-tiles .l4c{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}
.row100k .l1-tiles .l4c-card{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:#15171a;border:1px solid var(--l1-hair)}
.row100k .l1-bare .l4c{grid-template-columns:minmax(0,1fr)}
.row100k .l1-bare .l4c-card{aspect-ratio:1080/620}
.row100k .l1-eg{margin-top:12px;font-size:11px;line-height:1.7;letter-spacing:.14em;text-transform:uppercase;color:var(--l1-key)}
.row100k .l1-eg b{color:var(--l1-fg)}
.row100k .l1-eg a{color:var(--l1-fg);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l1-eg a:hover{color:var(--l1-accent)}
@media(min-width:760px){
  .row100k .l1-tiles .l4c{grid-template-columns:repeat(2,minmax(0,320px));gap:18px}
  .row100k .l1-bare .l4c{grid-template-columns:minmax(0,480px)}
}

/* ------------------------------------------------------------ THE CLOSE
 * The number the next rower gets, OPT IN again, then the footer. */
.row100k .l1-close{padding:clamp(44px,9vh,84px) 0 clamp(40px,8vh,72px);border-top:2px solid var(--l1-fg)}
.row100k .l1-next{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8.4vw,60px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:var(--l1-fg)}
.row100k .l1-next span{display:block;color:var(--l1-key)}
.row100k .l1-close .l1-act{margin-top:0;padding-top:clamp(28px,6vh,48px)}
/* The footer rule sits straight under the close on paper too (the ink
 * chrome already does this). */
.row100k.l1-paper footer{margin-top:0}
`;
