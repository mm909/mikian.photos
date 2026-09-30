/* LANDING 1, THE DARE (L1.tsx). One sheet, prefix .l1-; the bar, the
 * footer, OPT IN, the calendar and the pace chart ride on theme.ts.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). Child combinators
 * are out for the same reason; every selector is a descendant one. */
export const l1Css = `
/* ------------------------------------------------------------ THE FOLD
 * A poster in ink, full bleed, as tall as the screen less the bar and a
 * strip of the cream page under it — the strip is the only thing that says
 * there is more, so nothing on the poster has to. The bar is 91px on a
 * phone here (two rows, and without the SIGN IN chip the masthead row is
 * as tall as the wordmark — theme.ts measures 98px with the chip), 121px
 * with the race day band, 62px from 640px. vh first for a browser with no
 * svh. Capped, so a tall window gets a poster and not a wall. */
.row100k .l1-fold{--l1-bar:91px;--l1-peek:50px;--l1-cap:820px;display:flex;flex-direction:column;background:var(--ink);color:#fff;min-height:min(calc(100vh - var(--l1-bar) - var(--l1-peek)),var(--l1-cap));min-height:min(calc(100svh - var(--l1-bar) - var(--l1-peek)),var(--l1-cap))}
.row100k:has(.rail-stamp) .l1-fold{--l1-bar:121px}
@media(min-width:640px){
  .row100k .l1-fold,.row100k:has(.rail-stamp) .l1-fold{--l1-bar:62px;--l1-peek:60px;--l1-cap:920px}
}
.row100k .l1-poster{flex:1;display:flex;flex-direction:column;width:100%;padding-top:18px;padding-bottom:26px}
.row100k .l1-fold :focus-visible,.row100k .l1-close :focus-visible{outline-color:#fff}

/* OPT IN is the one door on this page: the bar keeps its wordmark and its
 * rail, but the signed-out SIGN IN chip (the only boxed thing on the ink,
 * and it opens the same sign-in) stays off. A signed-in account chip sits
 * inside .acct and keeps its menu. */
.row100k.l1 .acct-chip{display:none}
.row100k.l1 .acct .acct-chip{display:inline-block}

/* A fact kept whole: a number never parts from its unit at a wrap. */
.row100k .l1-nb{white-space:nowrap}

/* What this is, once: the one line on the fold that says rowing MACHINE. */
.row100k .l1-eye{font-size:12px;line-height:1.5;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.8)}

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
 * line wants .3em (11px at 1280; .2em left the tail 2px off the T). */
.row100k .l1-dare{container-type:inline-size;width:100%;max-width:min(100%,58vh);max-width:min(100%,58svh);margin-top:12px;font-family:var(--row-archivo-black),sans-serif;font-weight:400;line-height:.8;letter-spacing:-.02em;text-transform:uppercase;color:#fff}
.row100k .l1-ln{display:block}
.row100k .l1-w{display:block;font-size:calc(min(100vw - 40px,1000px) / var(--k));font-size:calc(100cqw / var(--k));white-space:nowrap;padding-top:.18em}
/* From 900px the four lines would stand taller than a laptop, so they pair
 * up: ROW 100,000 over METERS and the month, each pair fitted the same way. */
@media(min-width:900px){
  .row100k .l1-eye{font-size:13px}
  .row100k .l1-dare{max-width:min(100%,150vh);max-width:min(100%,150svh);margin-top:18px}
  .row100k .l1-ln{font-size:calc(min(100vw - 40px,1000px) / var(--kl));font-size:calc(100cqw / var(--kl));white-space:nowrap;padding-top:.1em}
  .row100k .l1-ln + .l1-ln{padding-top:.3em}
  .row100k .l1-w{display:inline;font-size:inherit;padding-top:0}
}

/* What the 100K asks of a day, right under the dare: the fact that makes
 * it doable, on the fold and not a thousand pixels under it. */
.row100k .l1-day{margin-top:18px;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62)}

/* OPT IN, pushed to the foot of the poster where a thumb is, as wide as the
 * measure: the word and its arrow are 4.71em of Archivo Black. White on
 * ink; the water underline is the one colour on the screen. */
.row100k .l1-act{margin-top:auto;padding-top:30px}
.row100k .l1-go{container-type:inline-size;max-width:min(100%,58vh);max-width:min(100%,58svh)}
/* The underline hangs .21em under the baseline, so the word keeps that
 * much box beneath itself and the facts line sits clear of the rule. */
.row100k .l1-fold .optin,.row100k .l1-close .optin{font-size:min(calc(min(100vw - 40px,1000px) / 4.76),104px);font-size:min(calc(100cqw / 4.76),104px);color:#fff;padding-bottom:.3em}
.row100k .l1-fold .optin:hover,.row100k .l1-close .optin:hover{color:var(--water-hover)}
.row100k .l1-facts{font-size:11px;font-weight:700;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.74)}
/* On a laptop the poster is its content, not the screen: OPT IN follows
 * the sentence instead of being pinned 250px under it, and the cream
 * starts under the facts line. The phone keeps the pinned foot. */
@media(min-width:900px){
  .row100k .l1-fold{min-height:0}
  .row100k .l1-go{max-width:none}
  .row100k .l1-act{margin-top:clamp(40px,8vh,80px)}
}

/* ------------------------------------------------------------ THE PAGE
 * Cream from here. A section is a mono cap label on a 2px rule, the way
 * the top fives sit on the front page; the first one is cut to show its
 * label and its rule in the strip under the poster. */
.row100k .l1-body{padding-bottom:clamp(48px,9vh,84px)}
.row100k .l1-sec{padding:clamp(46px,9vh,80px) 0 0}
.row100k .l1-sec.first{padding-top:16px}
.row100k .l1-h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 14px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:17px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .l1-h span{color:var(--gray);font-weight:400}

/* HOW IT COUNTS: the numeral in the margin, the verb at poster weight, one
 * fact under it. Three across from 760px. */
.row100k .l1-steps{list-style:none}
.row100k .l1-steps li{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:baseline;padding:20px 0 19px;border-bottom:1px dashed var(--line)}
.row100k .l1-steps li:last-child{border-bottom:none;padding-bottom:0}
.row100k .l1-steps .n{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--gray)}
.row100k .l1-steps h3{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(32px,9.2vw,48px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase}
.row100k .l1-steps p{margin-top:9px;font-size:15px;line-height:1.4;color:var(--ink-soft)}
@media(min-width:760px){
  .row100k .l1-steps{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
  .row100k .l1-steps li{display:block;border-bottom:none;border-right:1px dashed var(--line);padding:24px 26px 4px}
  .row100k .l1-steps li:first-child{padding-left:0}
  .row100k .l1-steps li:last-child{border-right:none;padding-right:0}
  .row100k .l1-steps .n{display:block;margin-bottom:12px}
  .row100k .l1-steps h3{font-size:clamp(34px,4.2vw,48px)}
}

/* THE RUNGS. A row a rung: the distance and the count at the same weight,
 * the name and last month under them in mono, then the bar — the count
 * against every rower on the board, so the five bars step back like a
 * stair. The 100K rung is the one between two ink rules, in water. */
.row100k .l1-ladder{list-style:none}
.row100k .l1-rung{padding:16px 0 17px;border-bottom:1px dashed var(--line)}
.row100k .l1-rung:last-child{border-bottom:none;padding-bottom:0}
.row100k .l1-rung .top{display:flex;align-items:baseline;justify-content:space-between;gap:14px}
.row100k .l1-rung .m,.row100k .l1-rung .c{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,7.4vw,40px);line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l1-rung .m em{font-style:normal;font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:.5em;letter-spacing:0;text-transform:uppercase;color:var(--gray)}
.row100k .l1-rung .sub{display:flex;justify-content:space-between;gap:14px;min-height:15px;margin-top:7px;font-family:var(--row-mono),monospace;font-size:10px;line-height:15px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);white-space:nowrap}
.row100k .l1-rung .fill{height:6px;margin-top:12px;background:#e3e1d8}
.row100k .l1-rung .fill i{display:block;height:100%;background:var(--ink)}
.row100k .l1-rung.goal{border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);padding:20px 0 19px;margin-top:-1px}
.row100k .l1-rung.goal .m,.row100k .l1-rung.goal .c{font-size:clamp(34px,10vw,56px);color:var(--water)}
.row100k .l1-rung.goal .m em{color:var(--water)}
.row100k .l1-rung.goal .sub{color:var(--ink)}
.row100k .l1-rung.goal .fill i{background:var(--water)}
.row100k .l1-rung .day{margin-top:13px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
/* The rungs above the club nobody has stood on, this month or last: one
 * grey line where those rows would be, so the ladder opens on the 100K. */
.row100k .l1-rung.above{padding:14px 0 13px}
.row100k .l1-rung.above .sub{display:block;margin-top:0;white-space:normal;line-height:16px}
/* On a wide screen the ladder keeps a column: a count a thousand pixels
 * from its rung is not on the same rung. */
@media(min-width:900px){
  .row100k .l1-ladder{max-width:680px}
}

/* WHAT YOU GET: two figures off one real month, lettered, one to a row on
 * a phone and side by side from 760px. The calendar carries its own sheet;
 * the caption here is the figure title. */
.row100k .l1-eg{margin-top:12px;font-size:11px;line-height:1.7;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .l1-eg b{color:var(--ink)}
.row100k .l1-eg a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l1-eg a:hover{color:var(--water)}
.row100k .l1-get{display:grid;grid-template-columns:minmax(0,1fr);gap:34px;margin-top:22px}
.row100k .l1-fig{min-width:0}
.row100k .l1-fig figcaption{display:flex;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px dashed var(--line);font-family:var(--row-mono),monospace;font-size:10px;line-height:1.5;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft)}
.row100k .l1-fig figcaption b{color:var(--ink);font-weight:700}
.row100k .l1-fig .hm-cell.hm-todo{opacity:.45}
/* The bests, four facts under the calendar, two to a row: the label grey,
 * the figure ink, each pair one unbreakable span. */
.row100k .l1-bests{display:grid;grid-template-columns:repeat(auto-fit,minmax(164px,1fr));gap:6px 18px;margin-top:16px;padding-top:12px;border-top:1px dashed var(--line);font-size:11px;line-height:1.5;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .l1-bests b{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
/* The cards are stickers, white ink on nothing, so each sits on ink here,
 * two across: the month (square) and the profile (1080 by 700). Each holds
 * its shape from the first paint — the canvas is painted client-side once
 * the fonts are in, and without a ratio it is a 2:1 block that jumps. The
 * third card the painter draws is the bare logo; it says nothing here. */
.row100k .l1-fig .ld-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start;position:relative}
.row100k .l1-fig .ld-card{display:block;width:100%;height:auto;background:var(--ink);aspect-ratio:1/1}
.row100k .l1-fig .ld-card:nth-child(2){aspect-ratio:1080/700}
.row100k .l1-fig .ld-card:nth-child(3){display:none}
@media(min-width:760px){
  .row100k .l1-get{grid-template-columns:repeat(2,minmax(0,1fr));gap:44px 52px}
}

/* THE MONTH SO FAR: the total fitted to the measure the way the poster
 * lines are (L1.tsx hands it --k), then four cells, two across on a phone
 * and four from 640px. */
.row100k .l1-month{container-type:inline-size}
.row100k .l1-total{padding-top:20px;font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(min(100vw - 40px,1000px) / var(--k)),150px);font-size:min(calc(100cqw / var(--k)),150px);line-height:.84;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}
.row100k .l1-total-l{margin-top:12px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
.row100k .l1-cells{display:grid;grid-template-columns:1fr 1fr;margin-top:22px;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.row100k .l1-cells .c{padding:15px 12px 14px 0;min-width:0;border-bottom:1px dashed var(--line)}
.row100k .l1-cells .c:nth-child(odd){border-right:1px dashed var(--line)}
.row100k .l1-cells .c:nth-child(even){padding-left:14px}
.row100k .l1-cells .c:nth-last-child(-n+2){border-bottom:none}
.row100k .l1-cells .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(28px,8vw,44px);line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l1-cells .l{margin-top:7px;font-family:var(--row-mono),monospace;font-size:10px;line-height:1.5;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
@media(min-width:640px){
  .row100k .l1-cells{grid-template-columns:repeat(4,1fr)}
  .row100k .l1-cells .c{border-bottom:none;border-right:1px dashed var(--line);padding-left:18px}
  .row100k .l1-cells .c:first-child{padding-left:0}
  .row100k .l1-cells .c:last-child{border-right:none}
}

/* ------------------------------------------------------------ THE CLOSE
 * Ink again, into the ink footer: the number the next rower gets, OPT IN
 * at the poster size, the facts, and when the board resets. */
.row100k .l1-close{background:var(--ink);color:#fff;padding:clamp(44px,9vh,84px) 0 clamp(40px,8vh,72px)}
.row100k .l1-next{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8.4vw,60px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:#fff}
.row100k .l1-next span{display:block;color:rgba(255,255,255,.62)}
.row100k .l1-close .l1-act{margin-top:0;padding-top:clamp(34px,7vh,56px)}
.row100k .l1-reset{margin-top:10px;font-size:11px;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62)}
`;
