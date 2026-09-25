/* THE STATS PAGE, its own rules (owner review, 2026-09-24; the swap-in-place
 * pass, 2026-09-25). Kept out of theme.ts so the packages working the site
 * tonight do not collide there: rendered as one more style child under the
 * theme on stats/page.tsx.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). Prefix .st-. */
export const statsCss = `
/* SHARE A CARD on the dateline (owner, 2026-09-25: same line as the
 * DECEMBER 2026 word, on the right). The line becomes a flex row with the
 * month word left and the button right, both on the mono baseline; the
 * share button keeps its own quiet look and loses the margin it wears
 * under a chart. */
/* THE STAMP at the head of the stats (owner, 2026-09-25): a newspaper
 * dateline, not a headline. The word is the month menu, the figure is the
 * community total in ink, the rest grey. */
.row100k .st-stamp{display:flex;align-items:baseline;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin:0;padding:22px 0 8px;border-bottom:1px solid var(--ink);font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);line-height:1.7}
.row100k .st-stamp-l{display:inline-flex;align-items:baseline;flex-wrap:wrap;gap:0 6px}
.row100k .st-stamp .dot{color:var(--gray);margin:0 4px}
.row100k .st-stamp-n{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
.row100k .ph-line.has-aside{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap}
.row100k .ph-aside{margin-left:auto}
.row100k .ph-aside .ms-actions{margin:0}

/* THE STAT BLOCK: two words that are menus on one mono line — the month
 * and the stat (TextMenu.tsx) — above the big figure. Bold and ink, the
 * way chips are, the dotted rule under each word saying it opens. */
.row100k .st-pick{display:flex;align-items:baseline;gap:8px 20px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);line-height:1.8;margin:0}
.row100k .st-pick .dot{color:var(--gray);margin:0 6px}
.row100k .st-pick .tm-list{min-width:220px}

/* THE ONE LINK TO THE FULL RANKINGS, in two places by width (owner,
 * 2026-09-25: on desktop BELOW the two tables; on mobile just under the
 * holder line, above the tables). Stats.tsx draws both lines and this
 * shows one: the phone line up to 639px, the desktop line from 640px,
 * the width at which the two top fives sit side by side (theme.ts
 * .front-top). A small water word on a water rule, the way it was on the
 * pick line; under the tables it sits at the right edge so it closes the
 * block the way it used to close the line. */
.row100k .st-all-line{margin:14px 0 0;line-height:1.8}
.row100k .st-all-line .st-all{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--water);text-decoration:none;border-bottom:2px solid var(--water);padding-bottom:2px;white-space:nowrap}
.row100k .st-all-line .st-all:hover{color:var(--ink);border-color:var(--ink)}
.row100k .st-all-desk{display:none;text-align:right;margin-top:22px}
@media(min-width:640px){
  .row100k .st-all-phone{display:none}
  .row100k .st-all-desk{display:block}
}

/* THE VIEWER APPENDED under a top five or the top ten — their own place
 * when they are not in it — is a phone thing (owner, 2026-09-25: on
 * desktop do not show it; on mobile DO show where the viewer is). The row
 * (and the Overall block a division-X rower gets) is always drawn; from
 * the desktop breakpoint up it is simply not displayed. */
@media(min-width:640px){.row100k .st-me{display:none}}

/* The leader block never changes height between stats (owner, 2026-09-25:
 * no jump): the pace rides on the holder line (LeadBlock paceInline), the
 * figure keeps one line, and on a phone the holder line reserves two so
 * a long name with a pace and a short one without sit the same. */
.row100k .st-rec .bhead-n{min-height:1em}
.row100k .st-rec .bhead-l{line-height:1.7}
@media(max-width:560px){.row100k .st-rec .bhead-l{min-height:3.4em}}

/* THE DAY WORD and THE WEEK WORD on the period boards: the arrows either
 * side of the day are plain glyphs in the same type, no box. */
.row100k .st-day{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);line-height:1.8;margin:0 0 18px;display:flex;align-items:center;gap:14px}
.row100k .st-day .st-arrow{all:unset;cursor:pointer;color:var(--ink);font:inherit;padding:0 4px;line-height:1}
.row100k .st-day .st-arrow:hover{color:var(--water)}
.row100k .st-day .st-arrow:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .st-day .st-arrow.off{opacity:.3;cursor:default}
.row100k .st-day .st-arrow.off:hover{color:var(--ink)}
.row100k .st-weeks .tm-list{min-width:240px}

/* THE CALENDAR under the day word (owner, 2026-09-25: a calendar picker,
 * not a list). The house panel holds a month grid in the heatmap idiom:
 * weekday letters, dashed cells, the picked day filled ink, today ringed
 * water, the days still to come dim. Sized to sit inside a 375 phone
 * from where the word starts. The head is the month word between two
 * arrows that step the month. */
.row100k .tm-panel{padding:0}
.row100k .st-cal{padding:12px 14px 14px;width:min(300px,calc(100vw - 64px));box-sizing:border-box}
.row100k .st-cal-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px dotted var(--ink)}
.row100k .st-cal-month{font-size:11px;letter-spacing:.14em;color:var(--ink)}
.row100k .tm-list .st-cal-arrow{display:inline-block;padding:0 6px;font-size:16px;line-height:1;color:var(--ink);text-decoration:none;white-space:nowrap}
.row100k .tm-list a.st-cal-arrow:hover,.row100k .tm-list a.st-cal-arrow:focus-visible{background:none;color:var(--water);outline:none}
.row100k .st-cal-arrow.off{opacity:.3}
.row100k .st-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.row100k .st-cal-grid .dow{font-size:9px;letter-spacing:.1em;color:var(--gray);text-align:center;padding-bottom:2px}
.row100k .tm-list .st-cal-cell{display:flex;align-items:center;justify-content:center;aspect-ratio:1;padding:0;border:1px dashed var(--line);font-size:11px;font-weight:700;letter-spacing:0;color:var(--ink);text-decoration:none;white-space:nowrap;font-variant-numeric:tabular-nums}
.row100k .tm-list a.st-cal-cell:hover,.row100k .tm-list a.st-cal-cell:focus-visible{background:var(--water-pale);border-style:solid;border-color:var(--water);outline:none}
.row100k .tm-list .st-cal-cell.today{border:1px solid var(--water);color:var(--water)}
.row100k .tm-list .st-cal-cell.on,.row100k .tm-list a.st-cal-cell.on:hover{background:var(--ink);border:1px solid var(--ink);color:var(--paper)}
.row100k .tm-list .st-cal-cell.off{color:var(--gray);opacity:.45;cursor:default}

/* A month on its way (StatsShell.tsx): the page dims a touch so the tap is
 * seen to land — no bar, no page (owner, 2026-09-25). */
.row100k .st-swap{transition:opacity .15s ease}
.row100k .st-swap[aria-busy=true]{opacity:.55}

/* The viewer on a period board, appended under the ten (owner,
 * 2026-09-24: top ten and then me on the next row): the fin tint marks
 * the row and a small ink tag says YOU. */
.row100k .tierbadge.you{background:var(--water);letter-spacing:.12em}
`;
