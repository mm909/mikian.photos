/* THE THREE SIGNED-OUT LANDINGS behind ?land=a|b|c (owner, 2026-09-25:
 * three different landing pages designed at getting sign-ups; the numbers,
 * the progress, the board). One sheet, prefix .ld-; the board tables,
 * the calendar, the pace chart and OPT IN ride on theme.ts and paceCss.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const landingCss = `
/* LAND A B C, the switcher line — only on a page that asked for a look. */
.row100k .ld-switch{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);padding-top:14px}
.row100k .ld-switch a{color:var(--gray);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .ld-switch a:hover{color:var(--water)}
.row100k .ld-switch a.on{color:var(--ink);font-weight:700;border-bottom:2px solid var(--ink)}

/* THE ONE HEADLINE: the sentence, Archivo Black caps, allowed to wrap. */
.row100k .ld-head{padding-top:26px}
.row100k .ld-head h1{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(28px,5.6vw,64px);line-height:.98;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);text-wrap:balance}
.row100k .ld-head h1 b{color:var(--water);font-weight:inherit}

/* OPT IN, the poster size the front page uses (theme.ts .optin). */
.row100k .ld-opt{margin-top:clamp(22px,4vh,40px)}
.row100k .ld-opt.tight{margin-top:14px}

/* A section: a mono cap label over a 2px rule, the way the top fives sit
 * on the front page (.front-three h3). */
.row100k .ld-sec{margin-top:clamp(30px,6vh,56px)}
.row100k .ld-sec h2{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .ld-sec h2 span{color:var(--gray);font-weight:400}

/* THE TOTALS as big cells: two across on a phone, four on desktop, dashed
 * rules between, the 2px ink rules top and bottom the front cells wear. */
.row100k .ld-cells{display:grid;grid-template-columns:1fr 1fr;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.row100k .ld-cells .c{padding:16px 12px 15px 0;min-width:0;border-bottom:1px dashed var(--line);container-type:inline-size}
.row100k .ld-cells .c:nth-child(odd){border-right:1px dashed var(--line)}
.row100k .ld-cells .c:nth-child(even){padding-left:12px}
.row100k .ld-cells .c:nth-last-child(-n+2){border-bottom:none}
/* Eight digits and two commas are about 5.6em of Archivo Black: the number
 * is sized off its own cell (a container) so it never runs into the next
 * one, capped at the front cells size. */
.row100k .ld-cells .n{font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / 5.9),44px);line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .ld-cells .l{font-size:11px;letter-spacing:.14em;color:var(--gray);text-transform:uppercase;margin-top:7px}
.row100k .ld-cells.all .n{font-size:min(calc(100cqw / 5.9),32px);color:var(--ink-soft)}
.row100k .ld-cells.all{border-top:none}
@media(min-width:640px){
  .row100k .ld-cells{grid-template-columns:repeat(4,1fr)}
  .row100k .ld-cells .c{border-bottom:none;border-right:1px dashed var(--line);padding-left:18px}
  .row100k .ld-cells .c:first-child{padding-left:0}
  .row100k .ld-cells .c:last-child{border-right:none}
}

/* THE BOARDS: the front page top fives (theme.ts .front-top, .front-three)
 * plus the fastest pieces, the same tables. YOUR NAME HERE is the row a
 * stranger is invited into. */
.row100k .ld-boards{margin-top:18px}
.row100k table.board tr.ld-you td{color:var(--gray);border-bottom:none;padding-top:12px}
.row100k table.board tr.ld-you td.who{font-family:var(--row-archivo-black),sans-serif;letter-spacing:.02em;text-transform:uppercase;color:var(--water)}
.row100k .ld-hidden{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);padding:14px 0}

/* THE PROGRESS STRIP, one rower as the example: the calendar and the pace
 * line side by side on desktop, the bests under them in a row of four. */
.row100k .ld-eg{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin-top:12px}
.row100k .ld-eg b{color:var(--ink)}
.row100k .ld-eg a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .ld-eg a:hover{color:var(--water)}
.row100k .ld-story{display:grid;grid-template-columns:1fr;gap:26px;margin-top:18px}
.row100k .ld-story .st-kde{margin-top:0;padding-top:0;border-top:none}
.row100k .ld-story .hm-cell.hm-todo{opacity:.45}
.row100k .ld-story .ld-cal .t{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase;margin-bottom:8px}
@media(min-width:640px){.row100k .ld-story{grid-template-columns:1fr 1fr;gap:32px}}
.row100k .ld-bests{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;margin-top:22px;border-top:2px solid var(--ink)}
.row100k .ld-best{padding:12px 0 14px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .ld-best .k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:8px}
.row100k .ld-best .k .dtag{margin-left:0}
.row100k .ld-best .v{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,4.6vw,28px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .ld-best .s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:6px;overflow-wrap:anywhere}
@media(min-width:640px){.row100k .ld-bests{grid-template-columns:repeat(4,1fr)}}

/* WHAT YOU GET: the cards, painted small. They are stickers — white ink
 * on nothing, made for a story — so each sits on an ink ground here. Two
 * across on a phone with the short logo card under them, three on desktop. */
.row100k .ld-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;margin-top:18px;position:relative}
.row100k .ld-card{display:block;width:100%;height:auto;background:var(--ink)}
.row100k .ld-card:nth-child(3){grid-column:1/-1}
@media(min-width:640px){.row100k .ld-cards{grid-template-columns:repeat(3,1fr)}.row100k .ld-card:nth-child(3){grid-column:auto}}

/* THE MARKS: the partner logos in ink, small, on a dotted rule. */
.row100k .ld-marks{display:flex;flex-wrap:wrap;align-items:center;gap:18px 32px;margin-top:clamp(30px,6vh,56px);padding-top:18px;border-top:1px dashed var(--line)}
.row100k .ld-marks img{height:26px;width:auto;opacity:.75}
.row100k .ld-marks .l{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gray);width:100%}
`;
