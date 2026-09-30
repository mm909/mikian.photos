/* LANDING 5, THE CLOCK. One sheet, every class prefixed .l5- ; the bar,
 * the footer, OPT IN, the board tables, the calendar and the pace chart
 * ride on theme.ts and paceCss, and the ticking cells are Countdown.tsx
 * restyled from a box into a ruled scoreboard row.
 *
 * Phone first: the rules outside a media query ARE the 390px page, and
 * the one query at the foot only gives the same page more air.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const l5Css = `
/* ONE call on this screen: the bar loses its SIGN IN chip here (review,
 * 2026-09-30: the one box-shaped control on the fold went to the same
 * place as OPT IN). A returning rower gets in through OPT IN. */
.row100k .bar .bar-right .acct-chip{display:none}

/* THE FOLD: four groups in a column, spread over the first screen — the
 * dateline, the ask, the clock, OPT IN at the foot where a thumb is. The
 * height is the viewport less the bar (two rows on a phone) and less a
 * strip, so the first ruled label of the page below shows at the bottom
 * edge. Capped, so a tall monitor does not pull the groups apart. */
.row100k .l5-fold{display:flex;min-height:min(calc(100svh - 176px),680px);padding-top:clamp(14px,2.4vh,26px)}
.row100k .l5-fold .wrap{flex:1;width:100%;display:flex;flex-direction:column;justify-content:space-between;gap:clamp(16px,3vh,34px)}

/* THE DATELINE, the way a scoreboard says it: the month on the left, the
 * day of it on the right, a 2px rule, then one cell per day with the days
 * gone in ink. */
.row100k .l5-date{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);padding-bottom:8px;border-bottom:2px solid var(--ink);white-space:nowrap}
.row100k .l5-date b{font-weight:700}
.row100k .l5-days{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;margin-top:8px}
.row100k .l5-days i{display:block;height:9px;border:1px solid var(--line)}
.row100k .l5-days i.on{background:var(--ink);border-color:var(--ink)}

/* THE ASK: ROW / 100,000 M. at poster size, the biggest thing on the
 * screen, in ink. Sized off its own box and its own length (the --l5-em
 * the page sets: the width of the longer line in ems), so it fills the
 * measure on a 360px phone and stops at the cap on a monitor. Under it
 * the live line — everyone together this month, the one water-blue
 * thing on the screen, a third the size — and its caption. */
.row100k .l5-fig,.row100k .l5-hw{container-type:inline-size}
.row100k .l5-h{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:min(calc(100cqw / var(--l5-em,5.8)),120px);line-height:.94;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);white-space:nowrap}
.row100k .l5-tot{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,7.4vw,40px);line-height:1;color:var(--water);font-variant-numeric:tabular-nums;white-space:nowrap;margin-top:clamp(12px,2vh,18px)}
.row100k .l5-cap{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);margin-top:8px;line-height:1.5}
.row100k .l5-cap b{color:var(--ink);font-weight:700}

/* THE CLOCK: the time left as four ruled cells between two ink rules,
 * left-justified, all ink, and under it the same time as meters a day.
 *
 * Each cell is a window one line tall over a strip of values (L5.tsx
 * Clock): the strip is moved down one value per step by l5-tick, and its
 * resting transform reads the same --l5-k the animation starts from, so
 * with animations off (the theme, under prefers-reduced-motion) the cell
 * still shows the value that was true when the page was made. */
.row100k .l5-count{display:grid;grid-template-columns:repeat(4,1fr);border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.row100k .l5-count .c{padding:10px 0 8px 12px;min-width:0;border-right:1px dashed var(--line)}
.row100k .l5-count .c:first-child{padding-left:0}
.row100k .l5-count .c:last-child{border-right:none}
.row100k .l5-count .l{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);margin-top:6px}
.row100k .l5-tk{height:.9em;overflow:hidden;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,10vw,60px);line-height:.9;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .l5-tk .st{transform:translateY(calc(var(--l5-k,0) * -100% / var(--l5-c,1)));animation-name:l5-tick;animation-fill-mode:both;will-change:transform}
.row100k .l5-tk i{display:block;height:.9em;font-style:normal;white-space:nowrap}
@keyframes l5-tick{from{transform:translateY(0)}to{transform:translateY(-100%)}}
.row100k .l5-left{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);margin-top:10px;line-height:1.5}

/* OPT IN, the theme word at the size the measure allows: the word and
 * its arrow are about 4.5em, so 17vw fills a phone. One line of facts
 * under it. */
.row100k .l5-go .optin{font-size:clamp(44px,17vw,104px)}
.row100k .l5-facts{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin-top:clamp(14px,2.4vh,20px);line-height:1.6}

/* BELOW THE FOLD. A section: a mono cap label over a 2px rule, the way
 * the top fives are headed on the front page. */
.row100k .l5-sec{padding-top:clamp(34px,6vh,60px);min-width:0}
.row100k .l5-sec h2{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .l5-sec h2 span{color:var(--gray);font-weight:400}
.row100k .l5-note{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);margin-top:12px;line-height:1.7}
.row100k .l5-note b{color:var(--ink);font-weight:700}

/* START TODAY: two cells, the day you start and what each day then costs.
 * Both figures at one size (the page sets --l5-em off the longer one), so
 * the cells stay level however many digits each has. */
.row100k .l5-plan{display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid var(--ink)}
.row100k .l5-plan .c{padding:14px 12px 14px 0;min-width:0;container-type:inline-size}
.row100k .l5-plan .c.late{padding:14px 0 14px 14px;border-left:1px dashed var(--line)}
.row100k .l5-plan .k{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .l5-plan .late .k{color:var(--gray);font-weight:400}
.row100k .l5-plan .v{font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / var(--l5-em,5.6)),60px);line-height:1;margin-top:10px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}
.row100k .l5-plan .late .v{color:var(--ink-soft)}
.row100k .l5-plan .s{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);margin-top:8px;line-height:1.6}

/* HOW IT COUNTS: three numbered lines. */
.row100k .l5-how{list-style:none;counter-reset:l5how}
.row100k .l5-how li{counter-increment:l5how;display:grid;grid-template-columns:2.4em minmax(0,1fr);align-items:baseline;padding:14px 0 13px;border-bottom:1px dashed var(--line)}
.row100k .l5-how li::before{content:counter(l5how,decimal-leading-zero);font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray)}
.row100k .l5-how b{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(24px,7vw,36px);line-height:1;text-transform:uppercase;letter-spacing:-.01em}
.row100k .l5-how span{grid-column:2;font-size:15px;line-height:1.4;color:var(--ink-soft);margin-top:5px}

/* WHAT YOU GET: a ledger. The thing, one line about it, and the thing
 * itself off one real rower. A dashed rule between entries. */
.row100k .l5-item{padding:16px 0 18px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .l5-item .k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .l5-item .v{font-size:15px;line-height:1.4;color:var(--ink-soft);margin-top:3px}
.row100k .l5-big{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(44px,13vw,76px);line-height:.9;color:var(--ink);font-variant-numeric:tabular-nums;margin-right:.18em}
.row100k .l5-cal{margin-top:14px;max-width:320px}
.row100k .l5-cal .hm-cell.hm-todo{opacity:.45}
.row100k .l5-eg{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);margin-top:12px;line-height:1.7}
.row100k .l5-eg b{color:var(--ink)}
.row100k .l5-eg a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l5-eg a:hover{color:var(--water)}
/* The split: the running average as one number on a phone, the curve
 * (paceCss) from 700px, where its axis text is readable. */
.row100k .l5-now{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:12px}
.row100k .l5-now .l5-big{margin-right:0}
.row100k .l5-now span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray)}
.row100k .l5-curve{display:none;margin-top:14px;max-width:640px}
.row100k .l5-curve .st-kde{margin-top:0;padding-top:0;border-top:none}
.row100k .l5-bests{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;margin-top:12px;border-top:1px solid var(--ink)}
.row100k .l5-best{padding:11px 0 12px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .l5-best:nth-last-child(-n+2){border-bottom:none}
.row100k .l5-best .bk{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:8px}
.row100k .l5-best .bk .dtag{margin-left:0}
.row100k .l5-best .bv{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5.6vw,28px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l5-best .bs{font-size:11px;color:var(--gray);margin-top:6px;overflow-wrap:anywhere}

/* THE BOARD SO FAR: the front page top fives (theme.ts .front-top), and
 * last month as one line under them. */
.row100k .l5-top{margin-top:18px}
.row100k .l5-prev{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);margin-top:16px;padding-top:12px;border-top:1px dashed var(--line);line-height:1.7}
.row100k .l5-prev b{color:var(--ink);font-weight:700}

/* THE END: the dateline again, the sum as dates, OPT IN again. The
 * headline is two lines sized off the longer, capped under the fold. */
.row100k .l5-end{padding-top:clamp(48px,9vh,88px)}
.row100k .l5-end .l5-hw{margin-top:clamp(18px,3vh,30px)}
.row100k .l5-end .l5-h{font-size:min(calc(100cqw / var(--l5-em,10)),88px);line-height:1}
.row100k .l5-end .l5-go{margin-top:clamp(24px,4.4vh,44px)}

/* MORE AIR from 700px: the ask on one line, the clock under it at a
 * readable width, the facts beside OPT IN, the ledger with its labels in
 * a left column, the split as its curve. Same page. The fold leaves
 * room for the first section head to show on an 800px screen. */
@media(min-width:700px){
  .row100k .l5-fold{min-height:min(calc(100svh - 150px),700px)}
  .row100k .l5-date{font-size:13px}
  .row100k .l5-days{gap:4px}
  .row100k .l5-days i{height:11px}
  .row100k .l5-br{display:none}
  .row100k .l5-fold .l5-h{font-size:min(calc(100cqw / var(--l5-em-d,var(--l5-em,8.6))),120px)}
  .row100k .l5-cap{letter-spacing:.16em}
  .row100k .l5-clock{max-width:560px}
  .row100k .l5-tk{font-size:min(5.4vw,60px)}
  .row100k .l5-go{display:flex;align-items:baseline;gap:clamp(24px,3vw,44px);flex-wrap:wrap}
  .row100k .l5-go .optin{font-size:min(9vw,96px)}
  .row100k .l5-facts{font-size:12px;letter-spacing:.14em;margin-top:0}
  .row100k .l5-item{display:grid;grid-template-columns:180px minmax(0,1fr);gap:0 24px;padding:20px 0 22px}
  .row100k .l5-item .k{grid-row:1 / span 4;padding-top:3px}
  .row100k .l5-item .v{margin-top:0}
  .row100k .l5-item .l5-cal,.row100k .l5-item .l5-eg,.row100k .l5-item .l5-curve,.row100k .l5-item .l5-bests{grid-column:2}
  .row100k .l5-now{display:none}
  .row100k .l5-curve{display:block}
  .row100k .l5-bests{grid-template-columns:repeat(4,1fr)}
  .row100k .l5-best{border-bottom:none}
  .row100k .l5-how{display:grid;grid-template-columns:repeat(3,1fr);gap:0 clamp(20px,3vw,40px)}
  .row100k .l5-end .l5-hw{max-width:760px}
}
`;
