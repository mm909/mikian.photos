/* LANDING 3, THE PROOF (L3.tsx). Prefix .l3- on everything; the board
 * tables, the calendar, the pace chart and OPT IN ride on theme.ts.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const l3Css = `
/* THE FOLD. On a phone it is exactly the first screen: the ledger at the
 * top, the turn and OPT IN pushed to the foot of it, where a thumb is. The
 * bar above is 98px on a phone (theme.ts), so the fold is the small
 * viewport less that; capped, so a very tall screen does not open a hole. */
.row100k .l3-fold{display:flex;flex-direction:column;padding-top:16px}
@media(max-width:899px){
  .row100k .l3-fold{min-height:min(calc(100vh - 98px),720px);min-height:min(calc(100svh - 98px),720px);padding-bottom:22px}
  /* With the RACE DAY band in the bar (theme.ts: 128px) the fold gives up
   * the same 30px, so OPT IN stays on the first screen in September. */
  .row100k:has(.rail-stamp) .l3-fold{min-height:min(calc(100vh - 128px),720px);min-height:min(calc(100svh - 128px),720px)}
}

/* The dateline: whose numbers these are, and the FINAL stamp flush right,
 * the way a box score is headed. */
.row100k .l3-date{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:11px;font-weight:700;letter-spacing:.16em;line-height:18px;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .l3-date b{flex:none;background:var(--ink);color:#fff;font-weight:700;letter-spacing:.2em;padding:0 5px 0 7px}

/* THE THREE FIGURES, staggered: short, long, short. Each is sized off the
 * ledger (a container) over its own width in em (--l3-em, set by L3.tsx:
 * a digit is .667em, a comma .333em), so the long one fills the measure to
 * the pixel and the short ones stop at two thirds of it, their labels
 * sitting beside them on the foot of the numerals. 18vh keeps the stack
 * inside a short screen. */
.row100k .l3-figs{container-type:inline-size}
.row100k .l3-fig{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 14px;padding:clamp(12px,3vh,30px) 0 clamp(11px,2.7vh,28px);border-bottom:1px dashed var(--line)}
.row100k .l3-fig:last-child{border-bottom:none}
.row100k .l3-n{flex:none;font-family:var(--row-archivo-black),sans-serif;font-size:min(34cqw,calc(64cqw / var(--l3-em,2)),18vh,170px);line-height:.8;letter-spacing:0;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}
.row100k .l3-b .l3-n{font-size:min(calc(99cqw / var(--l3-em,6)),18vh,170px)}
.row100k .l3-l{flex:1 1 96px;min-width:0;font-size:11px;letter-spacing:.14em;line-height:1.5;text-transform:uppercase;color:var(--gray);padding-bottom:.2em}
.row100k .l3-l b{display:block;color:var(--ink);font-weight:700}
.row100k .l3-l span{display:block}
/* The long figure carries its label under it, clear of the commas, which
 * hang below the baseline. */
.row100k .l3-b .l3-l{flex-basis:100%;padding-bottom:0;margin-top:clamp(4px,1.6cqw,14px)}
.row100k .l3-b .l3-l b,.row100k .l3-b .l3-l span{display:inline}
.row100k .l3-b .l3-l b{margin-right:.7em}
/* The third figure is the point of the page, so its label is the only one
 * set in the display face. */
.row100k .l3-c .l3-l b{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(19px,6.2cqw,40px);line-height:.98;letter-spacing:-.01em;margin-bottom:5px;text-wrap:balance}

/* THE TURN: the one water line on the screen, then OPT IN at poster size,
 * then the three facts. */
.row100k .l3-turn{container-type:inline-size;margin-top:auto;border-top:2px solid var(--ink);padding-top:clamp(14px,2.4vh,22px)}
.row100k .l3-open{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(22px,8.4cqw,40px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--water)}
.row100k .l3-go{margin-top:clamp(10px,1.8vh,18px)}
.row100k .l3-go .optin{font-size:clamp(44px,17cqw,96px)}
.row100k .l3-facts{margin-top:clamp(14px,2.2vh,20px);font-size:11px;font-weight:700;letter-spacing:.14em;line-height:1.6;text-transform:uppercase;color:var(--ink-soft)}

/* DESKTOP: the same page with more air. The ledger on the left, the turn in
 * its own box on the right — a left-justified block in the middle of the
 * box, the way the front page cells sit — one rule over both and one under. */
@media(min-width:900px){
  .row100k .l3-fold{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);grid-template-rows:auto 1fr;padding-top:26px;border-bottom:2px solid var(--ink)}
  .row100k .l3-date{grid-column:1 / -1}
  .row100k .l3-figs{padding-right:36px}
  .row100k .l3-turn{margin-top:0;border-top:none;border-left:1px solid var(--ink);padding:0 0 0 36px;display:flex;flex-direction:column;justify-content:center}
  .row100k .l3-turn .l3-go .optin{font-size:clamp(44px,21cqw,96px)}
}

/* A SECTION under the fold: a mono cap label over a 2px rule, what it is on
 * the left and whose it is, grey, on the right. theme.ts pads every section
 * 52px; these carry their own air. */
.row100k section.l3-sec{padding:0;margin-top:clamp(36px,7vh,64px)}
.row100k .l3-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .l3-h i{font-style:normal;font-weight:400;color:var(--gray);text-align:right}
.row100k .l3-note{margin-top:14px;font-size:11px;letter-spacing:.14em;line-height:1.6;text-transform:uppercase;color:var(--ink-soft)}
.row100k .l3-note b{color:var(--ink);font-weight:700}

/* THE BOARD: the front page top fives (theme.ts .front-top, .front-three),
 * and one quiet link to everyone under them. */
.row100k .l3-tops{margin-top:18px}
.row100k .l3-more{margin-top:14px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.row100k .l3-more a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l3-more a:hover{color:var(--water)}

/* THE RUNGS: one line a rung — its name, a bar that is its share of
 * everyone who rowed, the count. Ink, except the 100K. */
.row100k .l3-rung{display:grid;grid-template-columns:3.3em minmax(0,1fr) 2.5em;align-items:center;gap:0 12px;padding:13px 0 12px;border-bottom:1px dashed var(--line);font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5.6vw,30px);line-height:1;color:var(--ink)}
.row100k .l3-rung:last-child{border-bottom:2px solid var(--ink)}
.row100k .l3-rung .k{letter-spacing:-.01em}
.row100k .l3-rung .v{text-align:right;font-variant-numeric:tabular-nums}
.row100k .l3-track{height:.62em;background:#e3e1d8}
.row100k .l3-fill{height:100%;background:var(--ink)}
.row100k .l3-rung.goal{color:var(--water)}
.row100k .l3-rung.goal .l3-fill{background:var(--water)}

/* THIS MONTH SO FAR: the month as a strip of days, gone in ink, today in
 * water, the rest still open; then what has been rowed in it. */
.row100k .l3-days{display:grid;grid-template-columns:repeat(var(--l3-days,31),minmax(0,1fr));gap:3px;margin-top:16px}
.row100k .l3-days i{display:block;height:22px;border:1px dashed var(--line)}
.row100k .l3-days i.gone{background:var(--ink);border:1px solid var(--ink)}
.row100k .l3-days i.today{background:var(--water);border:1px solid var(--water)}
.row100k .l3-now{container-type:inline-size;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:6px;border-bottom:2px solid var(--ink)}
.row100k .l3-now .c{min-width:0;padding:14px 10px 13px 0;border-right:1px dashed var(--line)}
.row100k .l3-now .c.wide{grid-column:1 / -1;border-right:none;border-bottom:1px dashed var(--line)}
.row100k .l3-now .c + .c + .c{padding-left:12px}
.row100k .l3-now .c:last-child{border-right:none;padding-right:0}
.row100k .l3-now .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,9cqw,48px);line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}
.row100k .l3-now .wide .n{font-size:min(calc(99cqw / var(--l3-em,6)),64px)}
.row100k .l3-now .l{font-size:11px;letter-spacing:.14em;line-height:1.4;color:var(--gray);text-transform:uppercase;margin-top:7px}
.row100k .l3-empty{margin-top:16px;padding-bottom:16px;border-bottom:2px solid var(--ink);font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5.6vw,30px);line-height:1.05;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink);text-wrap:balance}

/* WHAT YOU GET, one rower as the example: the calendar and the split side
 * by side on desktop, the four bests under them, then the cards. */
.row100k .l3-eg{font-size:11px;letter-spacing:.14em;line-height:1.7;text-transform:uppercase;color:var(--gray);margin-top:12px}
.row100k .l3-eg b{color:var(--ink)}
.row100k .l3-eg a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l3-eg a:hover{color:var(--water)}
.row100k .l3-story{display:grid;grid-template-columns:minmax(0,1fr);gap:26px;margin-top:18px}
.row100k .l3-story .st-kde{margin-top:0;padding-top:0;border-top:none}
.row100k .l3-story .hm-cell.hm-todo{opacity:.45}
.row100k .l3-cal .t,.row100k .l3-cards .t{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase;margin-bottom:8px}
@media(min-width:640px){.row100k .l3-story{grid-template-columns:1fr 1fr;gap:32px}}
.row100k .l3-bests{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;margin-top:22px;border-top:2px solid var(--ink)}
.row100k .l3-best{padding:12px 0 14px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .l3-best .k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:8px}
.row100k .l3-best .k .dtag{margin-left:0}
.row100k .l3-best .v{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,4.6vw,28px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l3-best .s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:6px;overflow-wrap:anywhere}
@media(min-width:640px){.row100k .l3-bests{grid-template-columns:repeat(4,1fr)}}
/* The cards are stickers — white ink on nothing, made for a story — so each
 * sits on an ink ground here (LandingCards.tsx draws them; its two classes
 * are dressed under this block). */
.row100k .l3-cards{margin-top:26px}
.row100k .l3-cards .ld-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;position:relative}
.row100k .l3-cards .ld-card{display:block;width:100%;height:auto;background:var(--ink)}
.row100k .l3-cards .ld-card:nth-child(3){grid-column:1 / -1}
@media(min-width:640px){.row100k .l3-cards .ld-cards{grid-template-columns:repeat(3,1fr)}.row100k .l3-cards .ld-card:nth-child(3){grid-column:auto}}

/* THE END: the number they would be handed, and OPT IN once more. */
.row100k section.l3-end{container-type:inline-size;border-top:2px solid var(--ink);padding-top:clamp(18px,3vh,28px)}
`;
