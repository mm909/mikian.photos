/* THE 100K BOARD (page.tsx, Board100k.tsx), a real page in the site chrome
 * (owner, 2026-10-01, on the first version, a 640px phone frame with a bar
 * of its own: "I feel like I am looking at a preview of a mobile screen on
 * desktop. I should see the full page ... it better not look like this").
 * So: the site bar and footer, the front measure (.wrap.front, 1040), and
 * the board as a ruled table across it. Prefix .bd-.
 *
 * EVERY COLOUR IS A SITE VARIABLE: --paper the ground, --ink the type,
 * --water the one accent, --line / --gray / --ink-soft the rules and the
 * quiet type (theme.ts). Nothing here names a colour, so the page is paper
 * with the paper look, black with the ink look, and takes whatever accent
 * the palette hands it. The two washes are the ink and the accent thinned
 * through color-mix, the way the analysis charts thin the water.
 *
 * THE BAR BEHIND THE ROW (owner, 2026-10-01: "I really like those progress
 * bars, how they are hovering over the name"): every row carries its share
 * of 100,000 m as a wash from the left edge, a faint neutral for the field
 * and the accent for the viewer, and it fills when the row lands. The row
 * is two boxes: the outer one hangs past the measure and holds the wash,
 * the inner one is the grid and draws the hairline ON the measure, so the
 * type and the rules line up with the dateline while the wash has air
 * round the words. On a phone the outer box runs to the screen edges.
 * THE TRACK STOPS AT THE FIGURES: 100,000 m is the left edge of the meters
 * column (--bd-figs is everything right of it, the hang included), so the
 * end of a bar never cuts through a number.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). Child combinators
 * are out for the same reason; every selector is a descendant one. */
export const board100kCss = `
.row100k .bd{padding:16px 0 8px}

/* THE DATELINE, the landing one (owner, 2026-10-01: bring over the day
 * counter with one square per day as the header here): the month left,
 * the day of it right, a 2px rule, then one cell per day with the days
 * gone filled. The h1 is this line. */
.row100k .bd-date{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:8px;border-bottom:2px solid var(--ink);font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);white-space:nowrap}
.row100k .bd-date b,.row100k .bd-date span{font-weight:700}
.row100k .bd-days{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;margin-top:8px}
.row100k .bd-days i{display:block;height:8px;border:1px solid var(--line)}
.row100k .bd-days i.on{background:var(--ink);border-color:var(--ink)}

/* THE STRIP: which challenge and how many are in, in ordinary mono caps
 * (owner, 2026-10-01: no bold YOU ARE IN), and OPT IN at its right for
 * anyone who is not. Its rule is the top of the table. */
.row100k .bd-strip{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-top:30px;padding-bottom:9px;border-bottom:2px solid var(--ink)}
.row100k .bd-strip .t{font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);min-width:0}
.row100k .bd-say{margin-top:10px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:1.6;letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}

/* TEXT CONTROLS: a word in mono caps on a rule of the accent. The rule
 * thickens under the pointer, so the hover says something on a palette
 * whose accent is the type colour as well. */
.row100k .bd-ctl{display:inline-block;flex:none;background:none;border:0;border-bottom:2px solid var(--water);border-radius:0;padding:0 0 2px;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;white-space:nowrap;color:var(--ink);cursor:pointer;-webkit-tap-highlight-color:transparent}
.row100k .bd-ctl:hover{color:var(--water);border-bottom-width:4px;padding-bottom:0}
.row100k .bd-ctl:disabled{color:var(--gray);cursor:default}
.row100k .bd-ctl.big{font-size:16px}
.row100k .bd-quiet{display:inline-block;background:none;border:0;border-radius:0;padding:0;font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);cursor:pointer;-webkit-tap-highlight-color:transparent}
.row100k .bd-quiet:hover{color:var(--ink);text-decoration:underline;text-underline-offset:4px}

/* THE TABLE: place, rower, meters, and from 640px what is left of the
 * 100,000. One grid for the column heads, the rows and the dashed line. */
.row100k .bd-table{font-family:var(--row-mono),monospace;font-size:13px;color:var(--ink)}
.row100k .bd-cols,.row100k .bd-in{display:grid;grid-template-columns:30px minmax(0,1fr) 72px;column-gap:10px;align-items:center}
.row100k .bd-cols{padding:9px 0 8px;border-bottom:1px solid var(--ink);font-size:10px;line-height:1.5;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .bd-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .bd-togo{display:none;color:var(--gray)}

/* A tier, printed only once somebody on the board is in it (owner,
 * 2026-10-01: if nobody is in that tier yet, we do not show the tier). */
.row100k .bd-tier{padding:26px 0 9px;border-bottom:1px solid var(--ink);font-family:var(--row-archivo-black),sans-serif;font-size:17px;font-weight:400;line-height:1;letter-spacing:.01em;text-transform:uppercase;color:var(--ink)}

.row100k .bd-row{--bd-figs:102px;position:relative;margin:0 -20px;padding:0 20px}
.row100k .bd-in{position:relative;padding:11px 0 10px;border-bottom:1px solid var(--line);line-height:20px}
.row100k .bd-bar{position:absolute;left:0;top:0;bottom:1px;background:color-mix(in srgb,var(--ink) 9%,transparent);pointer-events:none;animation:bd-fill 800ms cubic-bezier(.2,.7,.2,1)}
@keyframes bd-fill{from{width:0}}
.row100k .bd-rk{color:var(--gray);font-variant-numeric:tabular-nums}
/* The name cell is padded and pulled back by the same 4px so the focus
 * ring on the link is not cut by the clip that makes the ellipsis. */
.row100k .bd-who{min-width:0;margin:-4px;padding:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--row-archivo),sans-serif;font-size:15px;font-weight:700}
.row100k .bd-who .n{font-family:var(--row-mono),monospace;font-size:12px;font-weight:400;color:var(--gray)}
.row100k .bd-who a{color:inherit;text-decoration:none}
.row100k .bd-who a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .bd-who a:focus-visible{outline-offset:1px}

/* YOUR ROW: the place and the rower number in the accent, the bar in the
 * accent. No words. */
.row100k .bd-row.me .bd-bar{background:color-mix(in srgb,var(--water) 30%,transparent)}
.row100k .bd-row.me .bd-rk,.row100k .bd-row.me .bd-who .n{color:var(--water);font-weight:700}

/* THE DASHED LINE where the row of a rower who is not in would sit. The
 * whole line is the control; the words sit in the rower column. Its top
 * dash lies on the hairline of the row above, so that row gives its
 * hairline up and the line is drawn over whatever else is there (review,
 * 2026-10-01: on paper the hairline covered the top dash and the line was
 * dashed below only). */
.row100k .bd-row:has(+ .bd-ask) .bd-in{border-bottom-color:transparent}
.row100k .bd-gap{position:relative;display:grid;grid-template-columns:30px minmax(0,1fr);column-gap:10px;align-items:center;width:100%;margin-top:-1px;padding:11px 0 10px;background:none;border:0;border-top:1px dashed var(--ink);border-bottom:1px dashed var(--ink);border-radius:0;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:20px;letter-spacing:.16em;text-transform:uppercase;text-align:left;color:var(--ink);cursor:pointer;-webkit-tap-highlight-color:transparent}
.row100k .bd-gap span{grid-column:2;justify-self:start;border-bottom:2px solid var(--water);line-height:1.5;padding-bottom:2px}
.row100k .bd-gap.solo span{grid-column:1 / -1}
.row100k .bd-gap:hover span{color:var(--water);border-bottom-width:4px;padding-bottom:0}
.row100k .bd-gap:disabled{color:var(--gray);cursor:default}
.row100k .bd-gap:focus-visible{outline-offset:-2px}
/* A refusal, under the dashed line it was pressed on. */
.row100k .bd-say.at{margin-top:0;padding:10px 0 9px;border-bottom:1px solid var(--line)}

/* Nobody in: one plain line. */
.row100k .bd-none{padding:14px 0 13px;border-bottom:1px solid var(--line);font-size:11px;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:var(--gray)}

@media(min-width:640px){
  .row100k .bd{padding-top:26px}
  .row100k .bd-strip{margin-top:38px}
  .row100k .bd-table{font-size:14px}
  .row100k .bd-cols,.row100k .bd-in{grid-template-columns:48px minmax(0,1fr) 140px 140px;column-gap:16px}
  .row100k .bd-gap{grid-template-columns:48px minmax(0,1fr);column-gap:16px}
  .row100k .bd-togo{display:block}
  .row100k .bd-tier{padding-top:34px;font-size:22px}
  .row100k .bd-row{--bd-figs:324px;margin:0 -12px;padding:0 12px}
  .row100k .bd-in{padding:12px 0 11px}
  .row100k .bd-who{font-size:16px}
  .row100k .bd-who .n{font-size:13px}
  .row100k .bd-gap{padding:12px 0 11px}
}

/* THE SHEET, the first-visit ask: a bottom sheet on a phone, a centred
 * ruled panel from 640px, over the ground thinned to a scrim. Hidden, it
 * is out of the tab order (visibility). */
.row100k .bd-scrim{position:fixed;inset:0;z-index:70;background:color-mix(in srgb,var(--paper) 80%,transparent);opacity:0;pointer-events:none;transition:opacity 240ms ease}
.row100k .bd-scrim.on{opacity:1;pointer-events:auto}
.row100k .bd-sheet{position:fixed;left:0;right:0;bottom:0;z-index:71;background:var(--paper);border-top:2px solid var(--ink);padding:26px 20px calc(30px + env(safe-area-inset-bottom,0px));overscroll-behavior:contain;transform:translateY(102%);visibility:hidden;transition:transform 320ms cubic-bezier(.2,.7,.2,1),visibility 0s linear 320ms}
.row100k .bd-sheet.on{transform:none;visibility:visible;transition:transform 320ms cubic-bezier(.2,.7,.2,1),visibility 0s}
.row100k .bd-sheet:focus{outline:none}
.row100k .bd-sheet h2{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(28px,8.6vw,40px);font-weight:400;line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink)}
.row100k .bd-sheet h2 i{font-style:normal;color:var(--water)}
.row100k .bd-sheet p{margin-top:14px;font-size:15px;line-height:1.5;color:var(--ink-soft)}
.row100k .bd-acts{display:flex;flex-wrap:wrap;align-items:baseline;gap:14px 32px;margin-top:26px}
@media(min-width:640px){
  .row100k .bd-sheet{left:50%;right:auto;top:50%;bottom:auto;width:min(560px,calc(100vw - 40px));border:2px solid var(--ink);padding:32px 32px 30px;transform:translate(-50%,-50%);opacity:0;transition:opacity 240ms ease,visibility 0s linear 240ms}
  .row100k .bd-sheet.on{transform:translate(-50%,-50%);opacity:1;transition:opacity 240ms ease,visibility 0s}
}
`;
