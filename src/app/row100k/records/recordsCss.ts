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
.row100k .rec-shell .rec-lead-empty{margin:14px 0 14px;padding:12px 0}
.row100k .rec-shell .rec-note{margin:0 0 14px}

/* THE ROWER HEAD IS THE SEARCH (owner, 2026-09-25: the FIND A ROWER field
 * looked out of place; make the NAME the search — click on the name and
 * search a rower from there; BoardFind.tsx). Idle, the head is its word in
 * the type every column head wears — 10px mono caps, grey — on the dotted
 * rule a word that opens something wears (.tm-btn), water on hover. Open,
 * the same cell holds the input in the same type, ink for what is typed,
 * the rule under it water, the column as wide as it was. No box, no
 * button: typing is the search. The table sits 22px under the leader,
 * the gap the field used to be (owner, 2026-09-25: reduce the gap between
 * the header and the first item). */
.row100k .rec-shell .st-rec{margin-bottom:22px}
.row100k .rec-find-w{all:unset;cursor:pointer;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .rec-find-w:hover{color:var(--water)}
.row100k .rec-find-w:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .rec-find{display:block;width:100%;min-width:0;box-sizing:border-box;background:transparent;border:0;border-bottom:1px dotted var(--water);border-radius:0;appearance:none;margin:0;padding:0 0 1px;font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--ink);line-height:inherit}
.row100k .rec-find::placeholder{color:var(--gray);opacity:1}
.row100k .rec-find:focus{outline:0}

/* THE DAY OR THE WEEK on a period board (owner, 2026-09-25: the same day
 * and week picker as the stats page): the stats page line (.st-day,
 * statsCss.ts) under the three words, a little air over it and none
 * under — the leader block keeps its own distance. */
.row100k .rec-head .rec-when{margin:10px 0 0}

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
  .row100k .rec-shell .st-rec{margin-bottom:14px}
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
