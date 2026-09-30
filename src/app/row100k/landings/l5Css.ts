/* LANDING 5, THE CLOCK. One sheet, every class prefixed .l5- ; the bar,
 * the footer, OPT IN, the board tables, the calendar and the pace chart
 * ride on theme.ts and paceCss, and the ticking cells are Countdown.tsx
 * restyled from a box into a ruled scoreboard row.
 *
 * Phone first: the rules outside a media query ARE the 390px page, and
 * the two queries at the foot only give the same page more air.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const l5Css = `
/* THE FOLD: four groups in a column, spread over the first screen — the
 * dateline, the figure, the ask with the clock, OPT IN at the foot where
 * a thumb is. The height is the viewport less the bar (two rows on a
 * phone) and less a strip, so the first ruled label of the page below
 * shows at the bottom edge. Capped, so a tall monitor does not pull the
 * groups apart. */
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

/* THE FIGURE: everyone together this month, the one water-blue thing on
 * the screen. Sized off its own box and its own length (the --l5-em the
 * page sets: the width of the digits in ems), so 0 and 12,345,678 both
 * sit on one line, and never taller than a fifth of the screen. */
.row100k .l5-fig{container-type:inline-size}
.row100k .l5-n{font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / var(--l5-em,5.4)),21vh,190px);line-height:.84;color:var(--water);font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l5-cap{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin-top:12px;line-height:1.5}
.row100k .l5-cap b{color:var(--ink);font-weight:700}

/* THE ASK and the clock under it: ROW 100,000 M at poster size, then the
 * time left as four ruled cells between two ink rules, left-justified,
 * all ink — the blue on this screen belongs to the figure above.
 *
 * Each cell is a window one line tall over a strip of values (L5.tsx
 * Clock): the strip is moved down one value per step by l5-tick, and its
 * resting transform reads the same --l5-k the animation starts from, so
 * with animations off (the theme, under prefers-reduced-motion) the cell
 * still shows the value that was true when the page was made. */
.row100k .l5-ask{border-top:1px dashed var(--line);padding-top:clamp(14px,2.6vh,26px)}
.row100k .l5-hw{container-type:inline-size}
.row100k .l5-h{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:min(calc(100cqw / var(--l5-em,8.6)),88px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);white-space:nowrap}
.row100k .l5-clock{margin-top:clamp(10px,1.8vh,16px)}
.row100k .l5-count{display:grid;grid-template-columns:repeat(4,1fr);border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.row100k .l5-count .c{padding:10px 0 8px 12px;min-width:0;border-right:1px dashed var(--line)}
.row100k .l5-count .c:first-child{padding-left:0}
.row100k .l5-count .c:last-child{border-right:none}
.row100k .l5-count .l{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);margin-top:6px}
.row100k .l5-tk{height:.9em;overflow:hidden;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,10vw,60px);line-height:.9;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .l5-tk .st{transform:translateY(calc(var(--l5-k,0) * -100% / var(--l5-c,1)));animation-name:l5-tick;animation-fill-mode:both;will-change:transform}
.row100k .l5-tk i{display:block;height:.9em;font-style:normal;white-space:nowrap}
@keyframes l5-tick{from{transform:translateY(0)}to{transform:translateY(-100%)}}
.row100k .l5-left{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin-top:8px}

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
 * The figure is sized off its cell and its own length, like the big one. */
.row100k .l5-plan{display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid var(--ink)}
.row100k .l5-plan .c{padding:14px 12px 14px 0;min-width:0;container-type:inline-size}
.row100k .l5-plan .c.late{padding:14px 0 14px 14px;border-left:1px dashed var(--line)}
.row100k .l5-plan .k{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .l5-plan .late .k{color:var(--gray);font-weight:400}
.row100k .l5-plan .v{font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / var(--l5-em,5.6)),60px);line-height:1;margin-top:10px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}
.row100k .l5-plan .late .v{color:var(--ink-soft)}
.row100k .l5-plan .s{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);margin-top:8px;line-height:1.6}

/* THE LATEST ROWS: a wire list. Who over the split, the meters over how
 * long ago, a dashed rule between rows. */
.row100k .l5-rows{list-style:none}
.row100k .l5-rows li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 14px;align-items:baseline;padding:11px 0 10px;border-bottom:1px dashed var(--line)}
.row100k .l5-who{font-weight:700;font-size:15px;line-height:1.3;min-width:0;overflow-wrap:anywhere}
.row100k .l5-who .no{font-family:var(--row-mono),monospace;font-weight:400;font-size:12px;color:var(--gray)}
.row100k .l5-who a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l5-who a:hover{color:var(--water)}
.row100k .l5-m{font-family:var(--row-archivo-black),sans-serif;font-size:19px;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.row100k .l5-sp,.row100k .l5-ago{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);white-space:nowrap}
.row100k .l5-ago{text-align:right}

/* THE BOARD SO FAR: the front page top fives (theme.ts .front-top), and
 * last month as one line under them. */
.row100k .l5-top{margin-top:18px}
.row100k .l5-prev{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);margin-top:16px;padding-top:12px;border-top:1px dashed var(--line);line-height:1.7}
.row100k .l5-prev b{color:var(--ink);font-weight:700}

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
.row100k .l5-curve{margin-top:14px;max-width:640px}
.row100k .l5-curve .st-kde{margin-top:0;padding-top:0;border-top:none}
.row100k .l5-bests{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;margin-top:12px;border-top:1px solid var(--ink)}
.row100k .l5-best{padding:11px 0 12px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .l5-best:nth-last-child(-n+2){border-bottom:none}
.row100k .l5-best .bk{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:8px}
.row100k .l5-best .bk .dtag{margin-left:0}
.row100k .l5-best .bv{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5.6vw,28px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l5-best .bs{font-size:11px;color:var(--gray);margin-top:6px;overflow-wrap:anywhere}
/* The cards are stickers, white ink on nothing, so each sits on ink. The
 * two personal ones; the logo card LandingCards also paints stays off. */
.row100k .l5-cards{position:relative}
.row100k .l5-cards .ld-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start;margin-top:14px;max-width:420px}
.row100k .l5-cards canvas{display:block;width:100%;height:auto;background:#15171a}
.row100k .l5-cards .ld-card:nth-child(3){display:none}

/* HOW IT COUNTS: three numbered lines. */
.row100k .l5-how{list-style:none;counter-reset:l5how}
.row100k .l5-how li{counter-increment:l5how;display:grid;grid-template-columns:2.4em minmax(0,1fr);align-items:baseline;padding:14px 0 13px;border-bottom:1px dashed var(--line)}
.row100k .l5-how li::before{content:counter(l5how,decimal-leading-zero);font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray)}
.row100k .l5-how b{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(24px,7vw,36px);line-height:1;text-transform:uppercase;letter-spacing:-.01em}
.row100k .l5-how span{grid-column:2;font-size:15px;line-height:1.4;color:var(--ink-soft);margin-top:5px}

/* THE END: the dateline again, the sum again, OPT IN again. */
.row100k .l5-end{padding-top:clamp(48px,9vh,88px)}
.row100k .l5-end .l5-hw{margin-top:clamp(18px,3vh,30px)}
.row100k .l5-end .l5-h{line-height:1}
.row100k .l5-end .l5-go{margin-top:clamp(24px,4.4vh,44px)}

/* MORE AIR from 700px: the ask beside its clock, the facts beside OPT IN,
 * the plan beside the latest rows, the ledger with its labels in a left
 * column. Same page. */
@media(min-width:700px){
  .row100k .l5-fold{min-height:min(calc(100svh - 82px),700px)}
  .row100k .l5-date{font-size:13px}
  .row100k .l5-days{gap:4px}
  .row100k .l5-days i{height:11px}
  .row100k .l5-ask{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 clamp(28px,4vw,56px);align-items:end}
  .row100k .l5-clock{margin-top:0}
  .row100k .l5-tk{font-size:min(5.4vw,60px)}
  .row100k .l5-go{display:flex;align-items:baseline;gap:clamp(24px,3vw,44px);flex-wrap:wrap}
  .row100k .l5-go .optin{font-size:min(9vw,96px)}
  .row100k .l5-facts{font-size:12px;letter-spacing:.14em;margin-top:0}
  .row100k .l5-duo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 clamp(28px,4vw,56px);align-items:start}
  .row100k .l5-item{display:grid;grid-template-columns:180px minmax(0,1fr);gap:0 24px;padding:20px 0 22px}
  .row100k .l5-item .k{grid-row:1 / span 4;padding-top:3px}
  .row100k .l5-item .v{margin-top:0}
  .row100k .l5-item .l5-cal,.row100k .l5-item .l5-eg,.row100k .l5-item .l5-curve,.row100k .l5-item .l5-bests,.row100k .l5-item .l5-cards{grid-column:2}
  .row100k .l5-bests{grid-template-columns:repeat(4,1fr)}
  .row100k .l5-best{border-bottom:none}
  .row100k .l5-how{display:grid;grid-template-columns:repeat(3,1fr);gap:0 clamp(20px,3vw,40px)}
  .row100k .l5-end .l5-hw{max-width:760px}
}
`;
