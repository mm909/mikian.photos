/* THE SETTINGS PAGE after the owner second look (2026-09-25): one block,
 * every field saving itself, no SAVE CHANGES button. Kept out of theme.ts
 * so the packages working the site tonight do not collide there: rendered
 * as one more style child under the theme on settings/page.tsx. Prefix
 * .se-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const settingsCss = `
/* A field label with a word at its far right: SAVED for a moment after
 * the field lands (owner, 2026-09-25: make the settings save
 * automatically on change, no SAVE CHANGES button), SAVING while it is
 * in flight. The label keeps the .fl face from theme.ts; this only lays
 * the two words out on one line — written as label.se-lab so it outranks
 * the display:block on label.fl there. */
.row100k label.se-lab{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.row100k .se-flash{color:var(--water);font-weight:700;opacity:0;transition:opacity 160ms ease}
.row100k .se-flash.on{opacity:1}
.row100k .se-flash.wait{color:var(--gray);font-weight:400;opacity:1}
/* The error line under the field it belongs to, tighter than the form
 * foot version in theme.ts. */
.row100k .se-form .form-err{margin-top:8px}
/* The first name and the last name side by side from 480px up; one under
 * the other on a phone. */
.row100k .se-pair{display:grid;grid-template-columns:1fr;gap:0 18px}
@media(min-width:480px){.row100k .se-pair{grid-template-columns:1fr 1fr}}
/* HEIGHT as FT and IN, WEIGHT as LB (owner, 2026-09-30: could not type
 * the apostrophe for five foot eleven on a phone; everyone is American).
 * Small mono boxes on the panel underline, each unit word after its box
 * in the label face; the weight box is the same shape, its unit in the
 * label. Written under .panel so it outranks the full-width input rule
 * in theme.ts. */
.row100k .se-units{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.row100k .panel .se-units input[type=text]{width:4.5ch;flex:none;font-family:var(--row-mono),monospace;font-size:17px;font-variant-numeric:tabular-nums;text-align:center;padding:8px 2px}
.row100k .se-unit{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-right:14px}
.row100k .se-unit:last-child{margin-right:0}
/* HOME GYM: the join-form chips (.pills, theme.ts) in a row, OTHER
 * opening the free-text field beneath them. */
.row100k .panel .se-other{margin-top:12px}
/* A quiet mono line when a group of fields is not available yet. */
.row100k .se-off{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-top:24px;line-height:1.7}
/* MY PROFILE under the block: the month word idiom, a dotted rule. */
.row100k .se-foot{margin-top:18px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
.row100k .se-foot a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .se-foot a:hover{color:var(--water)}
`;
