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
 * there is more, so nothing on the poster has to. The bar is 98px on a
 * phone (two rows), 128px with the race day band, 62px from 640px: the
 * figures theme.ts measured for its anchor offsets. vh first for a browser
 * with no svh. Capped, so a tall window gets a poster and not a wall. */
.row100k .l1-fold{--l1-bar:98px;--l1-peek:50px;--l1-cap:820px;display:flex;flex-direction:column;background:var(--ink);color:#fff;min-height:min(calc(100vh - var(--l1-bar) - var(--l1-peek)),var(--l1-cap));min-height:min(calc(100svh - var(--l1-bar) - var(--l1-peek)),var(--l1-cap))}
.row100k:has(.rail-stamp) .l1-fold{--l1-bar:128px}
@media(min-width:640px){
  .row100k .l1-fold,.row100k:has(.rail-stamp) .l1-fold{--l1-bar:62px;--l1-peek:60px;--l1-cap:920px}
}
.row100k .l1-poster{flex:1;display:flex;flex-direction:column;width:100%;padding-top:18px;padding-bottom:26px}
.row100k .l1-fold :focus-visible,.row100k .l1-close :focus-visible{outline-color:#fff}

/* What this is, once, small. */
.row100k .l1-eye{font-size:10px;line-height:1.5;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.62)}

/* THE SENTENCE. The heading is the container and every line is a share of
 * its width: calc(100cqw / var(--k)), with --k the width of the line in
 * ems (L1.tsx fitK), so each line ends on the measure and the block steps
 * down ROW, 100,000, METERS, the month. The width is also held to a share
 * of the screen height, so a short or a sideways phone gets a smaller
 * poster and never a clipped one. */
.row100k .l1-dare{container-type:inline-size;width:100%;max-width:min(100%,58vh);max-width:min(100%,58svh);margin-top:12px;font-family:var(--row-archivo-black),sans-serif;font-weight:400;line-height:.8;letter-spacing:-.02em;text-transform:uppercase;color:#fff}
.row100k .l1-ln{display:block}
.row100k .l1-w{display:block;font-size:calc(100cqw / var(--k));white-space:nowrap;padding-top:.1em}
/* From 900px the four lines would stand taller than a laptop, so they pair
 * up: ROW 100,000 over METERS and the month, each pair fitted the same way. */
@media(min-width:900px){
  .row100k .l1-dare{max-width:min(100%,150vh);max-width:min(100%,150svh);margin-top:18px}
  .row100k .l1-ln{font-size:calc(100cqw / var(--kl));white-space:nowrap;padding-top:.1em}
  .row100k .l1-w{display:inline;font-size:inherit;padding-top:0}
}

/* OPT IN, pushed to the foot of the poster where a thumb is, as wide as the
 * measure: the word and its arrow are 4.71em of Archivo Black. White on
 * ink; the water underline is the one colour on the screen. */
.row100k .l1-act{margin-top:auto;padding-top:30px}
.row100k .l1-go{container-type:inline-size;max-width:min(100%,58vh);max-width:min(100%,58svh)}
/* The underline hangs .21em under the baseline, so the word keeps that
 * much box beneath itself and the facts line sits clear of the rule. */
.row100k .l1-fold .optin,.row100k .l1-close .optin{font-size:min(calc(100cqw / 4.76),104px);color:#fff;padding-bottom:.3em}
.row100k .l1-fold .optin:hover,.row100k .l1-close .optin:hover{color:var(--water-hover)}
.row100k .l1-facts{font-size:11px;font-weight:700;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.74)}
@media(min-width:900px){
  .row100k .l1-go{max-width:none}
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
/* On a wide screen the ladder keeps a column: a count a thousand pixels
 * from its rung is not on the same rung. */
@media(min-width:900px){
  .row100k .l1-ladder{max-width:680px}
}

/* WHAT YOU GET: four figures off one real month, lettered, one to a row
 * on a phone and two by two from 760px. The pace chart and the calendar
 * carry their own sheets; the caption here replaces the chart title. */
.row100k .l1-eg{margin-top:12px;font-size:11px;line-height:1.7;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .l1-eg b{color:var(--ink)}
.row100k .l1-eg a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l1-eg a:hover{color:var(--water)}
.row100k .l1-get{display:grid;grid-template-columns:minmax(0,1fr);gap:34px;margin-top:22px}
.row100k .l1-fig{min-width:0}
.row100k .l1-fig figcaption{display:flex;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px dashed var(--line);font-family:var(--row-mono),monospace;font-size:10px;line-height:1.5;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft)}
.row100k .l1-fig figcaption b{color:var(--ink);font-weight:700}
.row100k .l1-fig .st-kde{margin-top:0;padding-top:0;border-top:none}
.row100k .l1-fig .st-kde .t{display:none}
.row100k .l1-fig .hm-cell.hm-todo{opacity:.45}
.row100k .l1-bests{display:grid;grid-template-columns:1fr 1fr;column-gap:18px}
.row100k .l1-best{padding:0 0 13px;margin-bottom:12px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .l1-best:nth-last-child(-n+2){border-bottom:none;margin-bottom:0;padding-bottom:0}
.row100k .l1-best .k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray)}
.row100k .l1-best .v{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(22px,6vw,30px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l1-best .s{font-family:var(--row-mono),monospace;font-size:11px;line-height:1.45;color:var(--gray);margin-top:6px;overflow-wrap:anywhere}
/* The cards are stickers, white ink on nothing, so each sits on ink here:
 * two across with the short logo card under them. */
.row100k .l1-fig .ld-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start;position:relative}
.row100k .l1-fig .ld-card{display:block;width:100%;height:auto;background:var(--ink)}
.row100k .l1-fig .ld-card:nth-child(3){grid-column:1/-1}
@media(min-width:760px){
  .row100k .l1-get{grid-template-columns:repeat(2,minmax(0,1fr));gap:44px 52px}
}

/* THE MONTH SO FAR: the total fitted to the measure the way the poster
 * lines are (L1.tsx hands it --k), then four cells, two across on a phone
 * and four from 640px. */
.row100k .l1-month{container-type:inline-size}
.row100k .l1-total{padding-top:20px;font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / var(--k)),150px);line-height:.84;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}
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
