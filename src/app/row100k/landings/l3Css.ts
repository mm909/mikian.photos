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
 * viewport less that; capped, so a very tall screen does not open a hole.
 * Everything inside it is sized off the same small viewport (svh, with the
 * vh line before it as the fallback). */
.row100k .l3-fold{display:flex;flex-direction:column;padding-top:16px}
@media(max-width:899px){
  .row100k .l3-fold{min-height:min(calc(100vh - 98px),720px);min-height:min(calc(100svh - 98px),720px);padding-bottom:22px}
  /* With the RACE DAY band in the bar (theme.ts: 128px) the fold gives up
   * the same 30px, so OPT IN stays on the first screen in September. */
  .row100k:has(.rail-stamp) .l3-fold{min-height:min(calc(100vh - 128px),720px);min-height:min(calc(100svh - 128px),720px)}
}

/* The dateline: whose numbers these are, and the FINAL stamp flush right,
 * the way a box score is headed. Tracked at .14em, not .16, so LAST MONTH
 * · SEPTEMBER 2026 and the longer CLOSES OCT 3 stamp (the 1st to the 3rd)
 * still set on one line in a 350px measure; at 320px the month wraps under
 * LAST MONTH and the stamp sits centred beside the two lines. */
.row100k .l3-date{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:11px;font-weight:700;letter-spacing:.14em;line-height:18px;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .l3-date b{flex:none;background:var(--ink);color:#fff;font-weight:700;letter-spacing:.14em;padding:0 5px 0 7px}

/* THE THREE FIGURES, staggered: short, long, short. Each is sized off the
 * ledger (a container) over its own width in em (--l3-em, set by L3.tsx:
 * a digit is .667em, a comma .333em), so the long one fills the measure to
 * the pixel and the short ones stop at two thirds of it, their labels
 * sitting beside them on the foot of the numerals. 18svh keeps the stack
 * inside a short screen — the SMALL viewport, the same one the fold is
 * sized off, or in Safari and a Chrome custom tab (vh is the large
 * viewport there, 60 to 90px taller on arrival) the ledger is set for a
 * taller screen than the fold gives and the foot of the turn slips under
 * the first screen. Each vh line stays as the fallback. */
.row100k .l3-figs{container-type:inline-size}
.row100k .l3-fig{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 14px;padding:clamp(12px,3vh,30px) 0 clamp(11px,2.7vh,28px);padding:clamp(12px,3svh,30px) 0 clamp(11px,2.7svh,28px);border-bottom:1px dashed var(--line)}
.row100k .l3-fig:last-child{border-bottom:none}
.row100k .l3-n{flex:none;font-family:var(--row-archivo-black),sans-serif;font-size:min(34cqw,calc(64cqw / var(--l3-em,2)),18vh,170px);font-size:min(34cqw,calc(64cqw / var(--l3-em,2)),18svh,170px);line-height:.8;letter-spacing:0;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}
.row100k .l3-b .l3-n{font-size:min(calc(99cqw / var(--l3-em,6)),18vh,170px);font-size:min(calc(99cqw / var(--l3-em,6)),18svh,170px)}
.row100k .l3-l{flex:1 1 96px;min-width:0;font-size:11px;letter-spacing:.14em;line-height:1.5;text-transform:uppercase;color:var(--gray);padding-bottom:.2em}
.row100k .l3-l b{display:block;color:var(--ink);font-weight:700}
.row100k .l3-l span{display:block}
/* The long figure carries its label under it, clear of the commas, which
 * hang below the baseline. */
.row100k .l3-b .l3-l{flex-basis:100%;padding-bottom:0;margin-top:clamp(4px,1.6cqw,14px)}
.row100k .l3-b .l3-l b,.row100k .l3-b .l3-l span{display:inline}
.row100k .l3-b .l3-l b{margin-right:.7em}
/* The third figure is the point of the page, so its label is the only one
 * set in the display face, and the line that defines it (100,000 M IN 30
 * DAYS) is the one sub-line in ink and bold, not the grey the eye skips. */
.row100k .l3-c .l3-l b{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(19px,6.2cqw,40px);line-height:.98;letter-spacing:-.01em;margin-bottom:5px;text-wrap:balance}
.row100k .l3-c .l3-l span{color:var(--ink);font-weight:700}

/* THE TURN: the one water line on the screen (THE OCTOBER 100K IS OPEN,
 * two balanced lines on a phone), then OPT IN at poster size, then the
 * three facts. */
.row100k .l3-turn{container-type:inline-size;margin-top:auto;border-top:2px solid var(--ink);padding-top:clamp(14px,2.4vh,22px);padding-top:clamp(14px,2.4svh,22px)}
.row100k .l3-open{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(22px,8.4cqw,40px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--water);text-wrap:balance}
.row100k .l3-go{margin-top:clamp(10px,1.8vh,18px);margin-top:clamp(10px,1.8svh,18px)}
.row100k .l3-go .optin{font-size:clamp(44px,17cqw,96px)}
.row100k .l3-facts{margin-top:clamp(14px,2.2vh,20px);margin-top:clamp(14px,2.2svh,20px);font-size:11px;font-weight:700;letter-spacing:.14em;line-height:1.6;text-transform:uppercase;color:var(--ink-soft)}

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
.row100k .l3-note + .l3-note{margin-top:8px}

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
 * water, the rest still open; then one line under it (.l3-note). On a phone
 * the cells are about 8px wide, where a dashed border is two or three
 * dashes and the strip reads as a comb: solid hairlines and a 2px gap
 * there, the dashes from 640px where a cell is 30px. */
.row100k .l3-days{display:grid;grid-template-columns:repeat(var(--l3-days,31),minmax(0,1fr));gap:3px;margin-top:16px}
.row100k .l3-days i{display:block;height:22px;border:1px dashed var(--line)}
.row100k .l3-days i.gone{background:var(--ink);border:1px solid var(--ink)}
.row100k .l3-days i.today{background:var(--water);border:1px solid var(--water)}
@media(max-width:639px){.row100k .l3-days{gap:2px}.row100k .l3-days i{border-style:solid}}
.row100k .l3-empty{margin-top:16px;padding-bottom:16px;border-bottom:2px solid var(--ink);font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5.6vw,30px);line-height:1.05;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink);text-wrap:balance}

/* WHAT YOU GET, one rower as the example: the calendar, and beside it from
 * 640px the split (its axis type is 10 units of a 660 viewBox, about 5px in
 * a phone column, under the house floor, so the phone does not draw it);
 * the bests they have rowed under them, then two cards. */
@media(max-width:639px){.row100k .l3-story .pf-pace{display:none}}
.row100k .l3-eg{font-size:11px;letter-spacing:.14em;line-height:1.7;text-transform:uppercase;color:var(--gray);margin-top:12px}
.row100k .l3-eg b{color:var(--ink)}
.row100k .l3-eg a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .l3-eg a:hover{color:var(--water)}
.row100k .l3-story{display:grid;grid-template-columns:minmax(0,1fr);gap:26px;margin-top:18px}
.row100k .l3-story .st-kde{margin-top:0;padding-top:0;border-top:none}
.row100k .l3-story .hm-cell.hm-todo{opacity:.45}
.row100k .l3-cal .t,.row100k .l3-cards .t{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase;margin-bottom:8px}
@media(min-width:640px){.row100k .l3-story{grid-template-columns:1fr 1fr;gap:32px}}
/* The bests: two across on a phone, an odd last one across the measure;
 * from 640px as many as there are fill the row (auto-fit collapses the
 * tracks nothing sits in), so three bests are three columns, not a hole. */
.row100k .l3-bests{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;margin-top:22px;border-top:2px solid var(--ink)}
.row100k .l3-best:last-child:nth-child(odd){grid-column:1 / -1}
.row100k .l3-best{padding:12px 0 14px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .l3-best .k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:8px}
.row100k .l3-best .k .dtag{margin-left:0}
.row100k .l3-best .v{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,4.6vw,28px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l3-best .s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:6px;overflow-wrap:anywhere}
@media(min-width:640px){.row100k .l3-bests{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.row100k .l3-best:last-child:nth-child(odd){grid-column:auto}}
/* The cards are stickers — white ink on nothing, made for a story — so each
 * sits on an ink ground here (LandingCards.tsx draws them; its two classes
 * are dressed under this block). Two of the three it draws: THE MONTH and
 * THE PROFILE, side by side. THE LOGO is only the wordmark, drawn from no
 * number at all, so it is not shown; the canvases carry their
 * card as aria-label, which is how the sheet tells them apart without a
 * prop. Each slot holds the shape of its card (1080 square, 1080 by 700)
 * before the client has painted it, so the section does not grow by 200px
 * while it is being read and the empty slot is card-shaped, not 300 by 150.
 * From 640px the grid keeps three tracks, so the two cards sit at a third
 * of the measure each — about the 324px they are painted at, so they stay
 * sharp — and the third track is empty air, left-aligned like the rest. */
.row100k .l3-cards{margin-top:26px}
.row100k .l3-cards .ld-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;position:relative}
@media(min-width:640px){.row100k .l3-cards .ld-cards{grid-template-columns:repeat(3,1fr)}}
.row100k .l3-cards .ld-card{display:block;width:100%;height:auto;background:var(--ink)}
.row100k .l3-cards .ld-card[aria-label$=month]{aspect-ratio:1 / 1}
.row100k .l3-cards .ld-card[aria-label$=profile]{aspect-ratio:1080 / 700}
.row100k .l3-cards .ld-card[aria-label$=logo]{display:none}

/* THE END: the number they would be handed, and OPT IN once more. */
.row100k section.l3-end{container-type:inline-size;border-top:2px solid var(--ink);padding-top:clamp(18px,3vh,28px)}
`;
