/* LANDING 4, THE CARD (owner brief, 2026-09-30). One sheet, prefix .l4-;
 * OPT IN, the pace chart and the place chips ride on theme.ts and paceCss.
 * The cards are painted by landings/L4Cards (canvases in a .l4c box, each
 * tagged data-card with its id); this sheet decides how they sit.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const l4Css = `
/* One size container for the page: type and tiles are cut off the measure,
 * not the viewport. */
.row100k .l4-page{container-type:inline-size}

/* The bar wears no SIGN IN chip on this landing: OPT IN is the one call,
 * and the chip was the only boxed control on the fold. The landing is
 * served signed out only, so the chip is always that one. */
.row100k .bar .acct-chip{display:none}

/* THE FOLD, a phone first: the line saying what this is, the headline, then
 * the tile with its ledger beside it, then OPT IN where a thumb is. The
 * tile is the width the viewport HEIGHT leaves for it (4 by 5 on a phone,
 * so the height is the width over .8): everything else on the fold is about
 * 360px tall, and the ledger column keeps at least 100px. */
.row100k .l4-fold{--l4-tw:clamp(150px,min(calc((100vh - 358px) * .8),calc(100cqw - 112px)),270px);
  display:grid;grid-template-columns:var(--l4-tw) minmax(0,1fr);column-gap:12px;padding-top:14px}
@supports(height:1svh){
  .row100k .l4-fold{--l4-tw:clamp(150px,min(calc((100svh - 358px) * .8),calc(100cqw - 112px)),270px)}
}
.row100k .l4-eye{grid-column:1 / -1;grid-row:1;font-size:min(11px,calc(100cqw / 31));font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}

/* THE HEADLINE: three lines, one to a span, cut so the longest (POST THE
 * PROOF., about ten em of Archivo Black) fills the measure. All ink: the
 * one thing in water on the fold is the OPT IN underline. */
.row100k .l4-h{grid-column:1 / -1;grid-row:2;margin-top:8px;font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:calc(100cqw / 10.1);line-height:.95;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);white-space:nowrap}
.row100k .l4-h span{display:block}
.row100k .l4-h b{font-weight:inherit}

/* THE TILE: ink, the 4 by 5 post frame on a phone (the 9 by 16 story on a
 * desktop, where it stands as a column), the month card sat in the middle
 * of it the way a sticker sits on a story. Under the canvas, until it is
 * painted, the server prints the two words the card carries. */
.row100k .l4-tile{grid-column:1;grid-row:3;position:relative;width:var(--l4-tw);aspect-ratio:4 / 5;margin-top:12px;background:var(--ink);overflow:hidden}
.row100k .l4-tile .l4c{position:absolute;top:0;left:0;width:100%;height:100%;display:block}
.row100k .l4-tile .l4c-card{display:block;width:100%;height:100%;object-fit:contain}
.row100k .l4-tile-ssr{position:absolute;inset:0;display:grid;place-content:center;text-align:center;color:#fff;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase}
.row100k .l4-tile-ssr b{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:28px;line-height:1;margin:6px 0 4px}

/* THE LEDGER beside the tile: what is on the card, as five ruled cells the
 * height of the tile. Mono key, Archivo Black figure, the name in plain
 * Archivo (no link: nothing on the fold leads off it but OPT IN). */
.row100k .l4-side{grid-column:2;grid-row:3;margin-top:12px;display:grid;grid-auto-rows:minmax(0,1fr);border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);min-width:0}
.row100k .l4-led{display:flex;flex-direction:column;justify-content:center;min-width:0;border-bottom:1px dashed var(--line)}
.row100k .l4-led:last-child{border-bottom:none}
.row100k .l4-led dt{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gray);line-height:1.2}
.row100k .l4-led dd{font-family:var(--row-archivo-black),sans-serif;font-size:min(19px,calc(100cqw / 19));line-height:1.05;margin-top:4px;text-transform:uppercase;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l4-led dd.s{font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:11px;line-height:1.2;margin-top:3px;text-transform:none;white-space:normal;overflow-wrap:anywhere}
/* A short phone (an SE inside the Instagram browser): the five cells still
 * fit at 39px each once the name goes. */
@media(max-height:600px){.row100k .l4-led dd.s{display:none}}

/* OPT IN, poster size, the facts under it, and the in-app line (L4InApp)
 * under those, only inside the Instagram browser. */
.row100k .l4-cta{grid-column:1 / -1;grid-row:4;margin-top:clamp(14px,4vh,40px)}
@supports(height:1svh){.row100k .l4-cta{margin-top:clamp(14px,4svh,40px)}}
.row100k .l4-cta .optin,.row100k .l4-end .optin{font-size:clamp(44px,13.4cqw,88px)}
.row100k .l4-facts{grid-column:1 / -1;grid-row:5;margin-top:12px;font-size:min(11px,calc(100cqw / 31));font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}
.row100k .l4-inapp{grid-column:1 / -1;grid-row:6;margin-top:10px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);line-height:1.5;border-top:1px dashed var(--line);padding-top:8px}

/* A DESKTOP: the same fold with more air. The words take the left of the
 * measure, the tile stands on the right as tall as the window allows, the
 * ledger lies down as one ruled row and OPT IN sits on the tile baseline. */
@media(min-width:860px){
  .row100k .l4-fold{--l4-tw:clamp(250px,calc((100vh - 176px) * .5625),400px);--l4-gap:clamp(36px,6cqw,72px);
    grid-template-columns:minmax(0,1fr) var(--l4-tw);grid-template-rows:auto auto minmax(0,1fr) auto auto auto;column-gap:var(--l4-gap);padding-top:clamp(22px,4.5vh,48px)}
  .row100k .l4-eye{grid-column:1;font-size:12px}
  .row100k .l4-h{grid-column:1;margin-top:14px;font-size:calc((100cqw - var(--l4-tw) - var(--l4-gap)) / 10.1)}
  .row100k .l4-tile{grid-column:2;grid-row:1 / span 6;margin-top:0;aspect-ratio:9 / 16}
  .row100k .l4-tile-ssr{font-size:12px}
  .row100k .l4-tile-ssr b{font-size:40px}
  .row100k .l4-side{grid-column:1;grid-row:3;align-self:center;margin-top:0;grid-auto-flow:column;grid-auto-columns:auto;grid-auto-rows:auto;justify-content:space-between;column-gap:18px}
  .row100k .l4-led{border-bottom:none;padding:14px 0 13px;justify-content:flex-start}
  .row100k .l4-led dt{font-size:10px}
  .row100k .l4-led dd{font-size:22px}
  .row100k .l4-cta{grid-column:1;margin-top:0}
  .row100k .l4-cta .optin{font-size:clamp(56px,8.4cqw,88px)}
  .row100k .l4-facts{grid-column:1;font-size:12px;margin-top:16px}
  .row100k .l4-inapp{grid-column:1;font-size:12px}
}

/* A SECTION under the fold: a mono cap label over a 2px rule, the way the
 * top fives sit on the front page. */
.row100k .l4-sec{margin-top:clamp(40px,8vh,72px)}
.row100k .l4-sec h2{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .l4-sec h2 span{color:var(--gray);font-weight:400}
.row100k .l4-note{margin-top:12px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft)}
.row100k .l4-note a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l4-note a:hover{color:var(--water)}
.row100k .l4-line{margin-top:10px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);line-height:1.5}

/* HOW IT COUNTS: five ruled lines, a mono word and a fact. */
.row100k .l4-how{margin-top:4px}
.row100k .l4-step{display:grid;grid-template-columns:88px minmax(0,1fr);column-gap:12px;align-items:baseline;padding:13px 0;border-bottom:1px dashed var(--line)}
.row100k .l4-step .d{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.row100k .l4-step p{font-family:var(--row-archivo),sans-serif;font-weight:600;font-size:16px;line-height:1.35;color:var(--ink)}

/* THE STRIP: the other cards, each on an ink square, side by side, sliding
 * under a thumb on a phone and sitting on the measure on a desktop. Two
 * rows of one grid: the canvases (L4Cards, dissolved with contents so they
 * are cells of THIS grid) and a caption under each. Which canvas goes in
 * which column is decided here, off the card id. */
.row100k .l4-strip{margin-top:14px;margin-right:-20px;padding-right:20px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.row100k .l4-strip::-webkit-scrollbar{display:none}
.row100k .l4-strip-in{display:grid;grid-template-columns:repeat(4,min(64cqw,241px));column-gap:12px;row-gap:8px;width:max-content;position:relative}
.row100k .l4-strip-in.l4-one{grid-template-columns:repeat(2,min(64cqw,241px))}
.row100k .l4-seta,.row100k .l4-setb,.row100k .l4-strip .l4c{display:contents}
.row100k .l4-strip .l4c-card{display:block;grid-row:1;width:100%;aspect-ratio:1;object-fit:contain;background:var(--ink)}
.row100k .l4-seta .l4c-card[data-card=rowtember-profile]{grid-column:1}
.row100k .l4-setb .l4c-card[data-card=rowtember-month]{grid-column:2}
.row100k .l4-setb .l4c-card[data-card=rowtember-profile]{grid-column:3}
.row100k .l4-seta .l4c-card[data-card=rowtember-logo]{grid-column:4}
.row100k .l4-one .l4-seta .l4c-card[data-card=rowtember-logo]{grid-column:2}
.row100k .l4-capt{grid-row:2;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);min-width:0}
.row100k .l4-capt b{color:var(--ink);font-weight:700}
.row100k .l4-c1{grid-column:1}
.row100k .l4-c2{grid-column:2}
.row100k .l4-c3{grid-column:3}
.row100k .l4-c4{grid-column:4}

/* BEHIND THE CARD: the bests alone on a phone, the split line beside them
 * on a desktop (at phone width the chart is a 660 unit drawing shown at
 * half size, its labels specks). */
.row100k .l4-behind{display:grid;grid-template-columns:minmax(0,1fr);gap:30px;margin-top:18px}
.row100k .l4-blk{min-width:0}
.row100k .l4-blk .st-kde{margin-top:0;padding-top:0;border-top:none}
.row100k .l4-pace{display:none}
.row100k .l4-bests{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0 18px;border-top:2px solid var(--ink);align-content:start}
.row100k .l4-best{padding:12px 0 14px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .l4-best .k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:8px}
.row100k .l4-best .k .dtag{margin-left:0}
.row100k .l4-best .v{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,6cqw,28px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l4-best .s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:6px;overflow-wrap:anywhere}
@media(min-width:760px){
  .row100k .l4-behind{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:start}
  .row100k .l4-pace{display:block}
  .row100k .l4-bests{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
  .row100k .l4-best .v{font-size:clamp(20px,2.4cqw,28px)}
}

/* THE GOAL: the number at poster size, then the rungs as ruled rows. The
 * club rung is the one in water. */
.row100k .l4-goal{margin-top:18px}
.row100k .l4-goal .g{font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / 6.1),150px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums}
.row100k .l4-rungs{margin-top:22px;border-top:2px solid var(--ink)}
.row100k .l4-rung{display:grid;grid-template-columns:3.6em minmax(0,1fr) auto;align-items:baseline;column-gap:10px;padding:11px 0 10px;border-bottom:1px dashed var(--line)}
.row100k .l4-rung .r{font-family:var(--row-archivo-black),sans-serif;font-size:22px;line-height:1;font-variant-numeric:tabular-nums}
.row100k .l4-rung .d{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray)}
.row100k .l4-rung .d b{color:var(--ink);font-weight:700}
.row100k .l4-rung .c{font-size:12px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--ink)}
.row100k .l4-club .r{color:var(--water)}

/* OPT IN again, the last thing on the page. */
.row100k .l4-end{margin-top:clamp(40px,8vh,72px);border-top:2px solid var(--ink);padding-top:clamp(22px,4vh,36px)}
`;
