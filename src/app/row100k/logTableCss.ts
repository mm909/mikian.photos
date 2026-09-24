/* THE LOG as one table (owner, 2026-09-24: "Combine the ledger and the
 * table on the profile: one log, keep the table view, show the photos on
 * the table"): the sortable numbers table (table.board, theme.ts) with the
 * photo pair as a strip of 40px squares under the day, and on the rower
 * own page a dots menu in a last column — SHARE / EDIT / DELETE, the
 * ledger menu idiom (.mlg-menu, theme.ts) — with the editor opening in
 * place as a row of its own (.mlg-editor, theme.ts, for the inputs).
 *
 * Rendered as a style child by MyRows and ProfileLog. No double quotes,
 * apostrophes, angle brackets or ampersands in the string. */
export const logTableCss = `
.row100k table.board.lgt td.lgt-day{vertical-align:middle}
.row100k .lgt-title{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:2px}
.row100k .lgt-pics{display:flex;gap:4px;margin-top:6px}
.row100k .lgt-pics button{appearance:none;-webkit-appearance:none;display:block;padding:0;margin:0;border:0;border-radius:0;background:none;cursor:pointer}
.row100k .lgt-pics img{display:block;width:40px;height:40px;object-fit:cover;border:1px solid var(--line)}
.row100k .lgt-pics button:hover img{border-color:var(--water)}
.row100k table.board.lgt th.lgt-c,.row100k table.board.lgt td.lgt-c{width:30px;padding-left:0;padding-right:0;text-align:right}
.row100k table.board.lgt td.lgt-c .mlg-dots{padding:6px 2px}
.row100k table.board.lgt tr.lgt-edit td{padding:4px 0 14px;cursor:default}
.row100k .lgt-edit .mlg-editor{padding:8px 0 0}
/* A phone: the four columns and the rail have to fit 343px with no
 * overflow wrapper (the dots menu would be clipped by one), so the type
 * and the cell padding come in a step and the squares shrink. */
@media (max-width:560px){
  .row100k table.board.lgt{font-size:12px}
  .row100k table.board.lgt td,.row100k table.board.lgt th{padding-left:4px;padding-right:4px}
  .row100k table.board.lgt .lg-th button{padding-left:4px;padding-right:4px}
  .row100k table.board.lgt td.lgt-day,.row100k table.board.lgt th:first-child,.row100k table.board.lgt th:first-child button{padding-left:0}
  .row100k table.board.lgt th.lgt-c,.row100k table.board.lgt td.lgt-c{width:22px}
  .row100k .lgt-title{font-size:10px}
  .row100k .lgt-pics img{width:34px;height:34px}
}
`;
