/* THE DETAILS BLOCK on the rowers table (owner, 2026-09-30: "I need a way
 * to view this information, like a summary on the rowers panel, I can see
 * more of their details, if they have entered their height and weight and
 * stuff like that"). A mono DETAILS word at the end of every rower row
 * opens one ruled block of label / value pairs under it: who they are,
 * what they entered on settings, what they have rowed. Kept out of
 * theme.ts, the way settingsCss.ts is: one more style child under the
 * theme on signups/page.tsx (and the dev preview). Prefix .rw-d.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const rowersCss = `
/* The DETAILS column, just left of the ... menu: as wide as its word,
 * gone under 640px with the other .rw-x columns (the menu has the same
 * item there). The word lights water while its block is open. */
.row100k table.board.rw-t th.rw-dc,.row100k table.board.rw-t td.rw-dc{width:1%;white-space:nowrap;text-align:right;padding-right:10px}
.row100k .rw-act.on{color:var(--water)}
/* The block: a panel cell like the log, two lists side by side from
 * 720px, one under the other on a phone. */
.row100k table.board td.rw-dp{padding:6px 0 18px 44px;cursor:default}
.row100k .rw-dls{display:grid;grid-template-columns:1fr;gap:0 48px;max-width:860px}
@media(min-width:720px){.row100k .rw-dls{grid-template-columns:1fr 1fr}}
/* Label / value pairs on dashed rules, the board face. The last pair in
 * each list drops its rule: the cell under it already draws one. */
.row100k .rw-dl{display:grid;grid-template-columns:max-content 1fr;gap:0 18px;margin:0;font-family:var(--row-mono),monospace}
.row100k .rw-dl dt,.row100k .rw-dl dd{margin:0;padding:7px 0;border-bottom:1px dashed var(--line);align-self:baseline}
.row100k .rw-dl dt{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);white-space:nowrap}
.row100k .rw-dl dd{font-size:12px;color:var(--ink);overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.row100k .rw-dl dd a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .rw-dl dd a:hover{color:var(--water)}
.row100k .rw-dl dt:last-of-type,.row100k .rw-dl dd:last-of-type{border-bottom:0}
@media(max-width:640px){
  .row100k table.board td.rw-dp{padding:4px 0 14px}
  .row100k .rw-dls{gap:0}
  /* One list on a phone: the first list keeps its last rule, since the
   * second list carries on under it. */
  .row100k .rw-dl:first-child dt:last-of-type,.row100k .rw-dl:first-child dd:last-of-type{border-bottom:1px dashed var(--line)}
}
`;
