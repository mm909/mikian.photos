/* THE STATS PAGE, its own rules (owner review, 2026-09-24). Kept out of
 * theme.ts so the packages working the site tonight do not collide there:
 * rendered as one more style child under the theme on stats/page.tsx.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). Prefix .st-. */
export const statsCss = `
/* THE HEADLINE FIGURES under the odometer (owner, 2026-09-24: total meters
 * biggest, then hours rowed, then rowers and sessions, in that order of
 * importance). A dotted rule, then hours in the display face at the size
 * of a section title, then the two smaller numbers on the same baseline
 * row. On a phone the three stack two and one. */
.row100k .st-figs{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px 34px;margin-top:22px;padding-top:16px;border-top:1px dotted var(--ink)}
.row100k .st-fig{min-width:0}
.row100k .st-fig .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,6vw,40px);line-height:1;letter-spacing:-.01em;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .st-fig.hours .n{font-size:clamp(34px,8vw,56px);color:var(--water)}
.row100k .st-fig .n .u{font-size:.42em;color:var(--gray);font-family:var(--row-archivo),sans-serif;font-weight:700;margin-left:.1em}
.row100k .st-fig .l{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);margin-top:8px}
.row100k .st-fig.hours .l{color:var(--ink)}

/* ONE share button for every card on the page, near the top (owner,
 * 2026-09-24): right-aligned on the same line as the figures end. */
.row100k .st-share{margin-top:14px}

/* THE STAT BLOCK: two words that are menus on one mono line — the month
 * and the stat (TextMenu.tsx) — above the big figure. Bold and ink, the
 * way chips are, the dotted rule under each word saying it opens. */
.row100k .st-pick{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);line-height:1.8;margin:0}
.row100k .st-pick .dot{color:var(--gray);margin:0 6px}
.row100k .st-pick .tm-list{min-width:220px}

/* The line under each top five: the whole ranking, one link. */
.row100k .st-foot{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin:12px 0 0}
.row100k .st-foot a{color:var(--water);text-decoration:none;border-bottom:2px solid var(--water);padding-bottom:2px}
.row100k .st-foot a:hover{color:var(--ink);border-color:var(--ink)}

/* THE DAY WORD on meters by day: the arrows either side are plain glyphs
 * in the same type, no box; the list of days scrolls inside the panel
 * when a month has more days than the screen has room for. */
.row100k .st-day{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);line-height:1.8;margin:0 0 18px;display:flex;align-items:center;gap:14px}
.row100k .st-day .st-arrow{all:unset;cursor:pointer;color:var(--ink);font:inherit;padding:0 4px;line-height:1}
.row100k .st-day .st-arrow:hover{color:var(--water)}
.row100k .st-day .st-arrow:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .st-day .st-arrow.off{opacity:.3;cursor:default}
.row100k .st-day .st-arrow.off:hover{color:var(--ink)}
.row100k .st-days .tm-list{max-height:min(60vh,440px);overflow-y:auto;min-width:220px}
.row100k .st-days .tm-list a.step{color:var(--gray);border-bottom:1px dotted var(--line)}
.row100k .st-days .tm-list a.step.last{border-bottom:0;border-top:1px dotted var(--line)}
.row100k .st-days .tm-list a.step:hover{color:var(--water)}

/* The viewer on a period board, appended under the ten (owner,
 * 2026-09-24: top ten and then me on the next row): the fin tint marks
 * the row and a small ink tag says YOU. */
.row100k .tierbadge.you{background:var(--water);letter-spacing:.12em}
`;
