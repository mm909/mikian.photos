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

/* THE ONE LINK TO THE FULL RANKINGS, under the tables at every width
 * (owner, 2026-09-25, third look: on mobile put the FULL RANKINGS link
 * below both tables again — the phone placement under the holder line is
 * gone). A small water word on a water rule at the right edge, closing
 * the block. */
.row100k .st-all-line{margin:22px 0 0;line-height:1.8;text-align:right}
.row100k .st-all-line .st-all{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--water);text-decoration:none;border-bottom:2px solid var(--water);padding-bottom:2px;white-space:nowrap}
.row100k .st-all-line .st-all:hover{color:var(--ink);border-color:var(--ink)}

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

/* ONE READING LINE under the two words on METERS BY DAY / BY WEEK
 * (owner, 2026-09-25: put BY DAY, BY WEEK and the picker on the same
 * line — one reading line — easier to read on mobile): BY DAY · BY WEEK
 * · ‹ DEC 15 ›. One step down from the pick line (11px) so the whole
 * line, week dates included, fits a 375 phone in one row; it may still
 * wrap at the last dot on a long month word. The mode words are words:
 * the one up in ink, the other the control, grey on a dotted rule. The
 * arrows either side of the picker word are plain glyphs in the same
 * type, no box. */
.row100k .st-day{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);line-height:1.8;margin:10px 0 0;display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px}
.row100k .st-day .dot{color:var(--gray)}
.row100k .st-day .st-mode{color:var(--gray);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px;white-space:nowrap}
.row100k .st-day .st-mode:hover{color:var(--water)}
.row100k .st-day .st-mode.on{color:var(--ink);border-bottom-color:transparent;cursor:default}
.row100k .st-day .st-mode:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .st-day .st-step{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.row100k .st-day .st-arrow{all:unset;cursor:pointer;color:var(--ink);font:inherit;font-size:14px;padding:0 2px;line-height:1}
.row100k .st-day .st-arrow:hover{color:var(--water)}
.row100k .st-day .st-arrow:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .st-day .st-arrow.off{opacity:.3;cursor:default}
.row100k .st-day .st-arrow.off:hover{color:var(--ink)}
/* The one ranked table for the day or the week, where the men and women
 * pair sits on a record. */
.row100k .st-period{margin-top:26px}

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
/* WEEK MODE (owner, 2026-09-25: hovering a week highlights days 1 to 7,
 * 8 to 14 and so on, and a tap picks that week): the week under the
 * pointer is lit as one block — every cell of it in the pale water wash
 * with a solid water rule, the way a single day lights under the pointer
 * — and the picked week is the block in ink. The cells of one week touch
 * so the block reads as one. */
.row100k .st-cal-weeks .st-cal-grid{column-gap:0}
.row100k .tm-list .st-cal-weeks .st-cal-cell.lit,.row100k .tm-list .st-cal-weeks a.st-cal-cell.lit:hover{background:var(--water-pale);border-style:solid;border-color:var(--water)}
.row100k .tm-list .st-cal-weeks .st-cal-cell.on.lit,.row100k .tm-list .st-cal-weeks a.st-cal-cell.on:hover{background:var(--ink);border-color:var(--ink)}

/* A month on its way (StatsShell.tsx): the page dims a touch so the tap is
 * seen to land — no bar, no page (owner, 2026-09-25). */
.row100k .st-swap{transition:opacity .15s ease}
.row100k .st-swap[aria-busy=true]{opacity:.55}

/* The viewer on a period board, appended under the ten (owner,
 * 2026-09-24: top ten and then me on the next row): the fin tint marks
 * the row and a small ink tag says YOU. */
.row100k .tierbadge.you{background:var(--water);letter-spacing:.12em}

/* THE SECTION TITLES as mono eyebrows (owner, 2026-09-25: he does not like
 * the big bold black section titles (THE MONTH, THE HOURS, THE FIELD,
 * PERFECT ATTENDANCE): the profile idiom, .pf-eye in theme.ts — a
 * left word and a right word on a hairline — and the sections sit
 * tighter now that no display word carries them. */
.row100k section.st-sec{padding:40px 0 8px}
.row100k .st-eye{margin-bottom:18px}

/* THE MONTH drawn whole (owner, 2026-09-25: give THE MONTH calendar all
 * its squares back for the whole month): the days to come are the same
 * dashed cells, a touch dimmer, so the month reads as a month and today
 * can still be found. */
.row100k .hm-cell.todo{opacity:.45}
`;
