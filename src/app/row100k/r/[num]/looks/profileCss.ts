/* THE PROFILE after the owner second look (2026-09-25): the dateline with
 * SHARE at its far right, and LOG A ROW as a toggle whose arrow turns down
 * while the form is open. Kept out of theme.ts so the packages working the
 * site tonight do not collide there: rendered as one more style child
 * under the theme on r/[num]/page.tsx, after paceCss. Prefix .pf-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const profileCss = `
/* THE DATELINE (pieces.tsx Dateline): the month word on the left, SHARE
 * at the far right of the same line (owner, 2026-09-25: move the SHARE
 * button onto the same line as the DECEMBER 2026 date selection, right
 * side; best on mobile). A flex row on the baseline, so the two words sit
 * on one line at any width; the dog tag FIND ANOTHER ROWER line is the
 * same element with one child and is left where it was. */
.row100k .pf-date{display:flex;justify-content:space-between;align-items:baseline;gap:16px}
/* SHARE in the quiet face it wore beside LOG A ROW (owner, 2026-09-24:
 * keep LOG A ROW prominent, the share button quieter): the month word
 * idiom — mono caps, the dotted rule, water on hover. */
.row100k .pf-share{all:unset;cursor:pointer;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:1.3;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:1px dotted currentColor;padding-bottom:1px;white-space:nowrap}
.row100k .pf-share:hover{color:var(--water)}
.row100k .pf-share:focus-visible{outline:2px solid var(--water);outline-offset:3px}
/* LOG A ROW as a toggle (owner, 2026-09-25: it should open the form and
 * the arrow should tilt down): the front page turn, LogInPlace puts .open
 * on the word while the form is open. */
.row100k .pf-act .optin .arr{transition:transform 220ms cubic-bezier(.2,.7,.2,1)}
.row100k .pf-act .optin.open .arr{transform:rotate(90deg)}
@media(prefers-reduced-motion:reduce){.row100k .pf-act .optin .arr{transition:none}}
/* THE THREE CELLS under the identity line (pieces.tsx Cells; owner,
 * 2026-09-25: TIME ROWED, SESSIONS and AVERAGE SPLIT in box cells like the
 * landing stats, not the dotted receipt lines): the landing sheet (Home.tsx
 * .stats) and the front page counter cells (theme.ts .front-stats) once
 * more — a 2px ink rule above and below, 1px rules between, the figure in
 * Archivo Black, the mono label under it, everything left-justified. Three
 * across at every width, so the block is one line of cells on a phone
 * too; each cell is its own size container and the figure is sized off
 * the cell, never the viewport: the widest figure (123.4 h, or 2:07 with
 * its /500m) is about four em of Archivo Black and must fit the cell less
 * its padding. The unit after the split is set small in Archivo, the
 * stats tiles way (theme.ts .st-tile .u). */
.row100k .pf-cells{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);margin-top:22px}
.row100k .pf-cells .cell{container-type:inline-size;min-width:0;padding:14px 12px 13px;border-right:1px solid var(--ink)}
.row100k .pf-cells .cell:first-child{padding-left:0}
.row100k .pf-cells .cell:last-child{border-right:none;padding-right:0}
.row100k .pf-cells .n{font-family:var(--row-archivo-black),sans-serif;font-size:min(clamp(20px,5.6vw,40px),calc(100cqw / 4.3));line-height:1;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .pf-cells .n .u{font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:.42em;color:var(--gray);margin-left:.3em}
.row100k .pf-cells .l{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;color:var(--gray);text-transform:uppercase;margin-top:7px;white-space:nowrap}
/* THE WHOLE MONTH (owner, 2026-09-25: all its boxes back): the days still
 * to come are drawn by Heatmap.tsx as empty dashed cells wearing .hm-todo,
 * faded a step so the month reads as a shape and the rest days that have
 * passed keep the full dash. */
.row100k .pf-month .hm-cell.hm-todo{opacity:.45}
`;
