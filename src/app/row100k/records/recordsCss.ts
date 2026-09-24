/* THE FULL RANKINGS (owner, 2026-09-24: the board is reduced into the
 * records page; no FULL RANKINGS heading; the time period we are looking
 * at as the month word. 2026-09-25: no chips at all — the category and
 * the bracket are words that are menus beside the month word; the board
 * must fit a phone: a smaller gap under the head, names on one line,
 * FIND A ROWER over every table).
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). Prefix .rec-. */
export const recordsCss = `
/* The head: 26px off the bar, the front page nameplate distance. Three
 * words that are menus on one mono line — the month, the category, the
 * bracket (TextMenu.tsx) — the stats page .st-pick line, the same type, so
 * the two heads read alike. The first two words never part (.rec-w is
 * nowrap; DECEMBER 2026 · TOTAL METERS fits 375). The leader (LeadBlock.tsx,
 * .bhead) sits straight under it. */
.row100k .rec-head{padding:26px 0 0}
.row100k .rec-period{margin:0;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);line-height:1.8}
.row100k .rec-period .dot{color:var(--gray);margin:0 6px}
.row100k .rec-period .rec-w{white-space:nowrap}
.row100k .rec-period .tm-list{min-width:220px}

/* The leader block never changes height between categories (owner,
 * 2026-09-25: the pace on the holder line, no jump): the figure keeps one
 * line, and on a phone the holder line reserves two so a long name with a
 * pace and a short one without sit the same. */
.row100k .rec-shell .st-rec .bhead-n{min-height:1em}
.row100k .rec-shell .st-rec .bhead-l{line-height:1.7}
.row100k .rec-shell .rec-lead-empty{margin:14px 0 0;padding:12px 0}
.row100k .rec-shell .rec-note{margin:14px 0 0}

/* FIND A ROWER (owner, 2026-09-25: a search field, not ugly; on every
 * category). Text, not a box: the house mono caps on a dotted rule, the
 * same rule a menu word wears (.tm-btn), on the far right of its own line
 * over the table, water blue when it has focus. No button — typing is the
 * search. This line is the whole gap between the leader and the first row
 * (owner, 2026-09-25: reduce the gap between the header and the first
 * item). Under 560px the field runs the measure, its rule a full-width
 * baseline. */
.row100k .rec-findline{display:flex;justify-content:flex-end;margin:22px 0 10px}
.row100k .rec-find{flex:0 1 210px;width:210px;min-width:0;background:transparent;border:0;border-bottom:2px dotted var(--ink);border-radius:0;appearance:none;padding:7px 0 5px;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);line-height:16px}
.row100k .rec-find::placeholder{color:var(--gray);font-weight:400;letter-spacing:.12em;text-transform:uppercase;opacity:1}
.row100k .rec-find:focus{outline:0;border-bottom-color:var(--water)}

/* A NAME IS ONE LINE (owner, 2026-09-25: some names get split over two
 * lines, first name then last name). The name cell (.wc, Boards.tsx and
 * the flat table) takes whatever room the place, the arrow and the value
 * leave — width 100 percent asks for every spare pixel, max-width 0 lets
 * the cell be narrower than its text so the ellipsis can cut it — and the
 * other cells never wrap, so they sit at the width of their content and
 * the name is the only thing that gives. The progress bar under the
 * meters is a fixed width (it has no content of its own to size the
 * column), 180px on a wide screen; on a phone it goes under the meters at
 * the width of the number (owner, 2026-09-25). */
.row100k .rec-shell table.board td.wc{width:100%;max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row100k .rec-shell table.board td.wc .who{white-space:nowrap}
.row100k .rec-shell table.board th,.row100k .rec-shell table.board td.rk,.row100k .rec-shell table.board td.num{white-space:nowrap}
.row100k .rec-shell table.board td.num .rowbar{width:180px;margin-left:auto}

/* The day of a record: a column from 561px; under it, a grey line under
 * the value in the same cell (the way the progress bar sits under the
 * meters on the board), so a phone keeps the name column wide. */
.row100k .rec-flat .rec-dsub{display:none}

/* A month on its way (RecordsShell.tsx): the page dims a touch so the tap
 * is seen to land — no bar, no page (owner, 2026-09-25). */
.row100k .rec-swap{transition:opacity .15s ease}
.row100k .rec-swap[aria-busy=true]{opacity:.55}

@media(max-width:560px){
  /* The bracket word on its own line, its dot with it (owner, 2026-09-25:
   * the bracket word may drop to its own line on a phone). */
  .row100k .rec-head{padding-top:18px}
  .row100k .rec-period .rec-w2{display:block}
  .row100k .rec-period .rec-w2 .dot{display:none}
  .row100k .rec-shell .st-rec .bhead-l{min-height:3.4em}
  /* Less air under the head (owner, 2026-09-25: the board looks cramped;
   * reduce the gap between the header and the first item). */
  .row100k .rec-findline{margin:14px 0 6px}
  .row100k .rec-find{flex:1 1 100%;width:auto}
  /* The table, tighter: a narrower place column and less cell padding buy
   * the name its line. */
  .row100k .rec-shell table.board th,.row100k .rec-shell table.board td{padding-left:4px;padding-right:4px}
  .row100k .rec-shell table.board .rk{width:30px}
  .row100k .rec-shell table.board td.rk{padding-left:0}
  .row100k .rec-shell table.board td.num:last-child,.row100k .rec-shell table.board th:last-child{padding-right:0}
  .row100k .rec-shell table.board td.num .rowbar{width:auto;min-width:64px}
  .row100k .rec-flat .rec-dcol{display:none}
  .row100k .rec-flat .rec-dsub{display:block;font-size:11px;color:var(--gray);margin-top:3px}
}
`;
