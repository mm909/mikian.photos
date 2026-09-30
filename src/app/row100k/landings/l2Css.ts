/* LANDING 2, THE MATH (landings/L2.tsx). One sheet, prefix .l2- ; the bar,
 * the footer, OPT IN, the board tables and the pace chart ride on theme.ts
 * and paceCss.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const l2Css = `
/* ------------------------------------------------------------ THE FOLD
 * The division set as a poster. The sum block is its own size container,
 * so every line in it is sized off the block and not the viewport: on a
 * phone the block is the measure, on a desktop it is the left column.
 * ROW 100,000 M is about 8.3em of Archivo Black at this tracking and the
 * four digits and comma of the answer about 2.95em, so the headline and
 * the figure both run the full width of the block at every size. */
.row100k section.l2-fold{padding:clamp(16px,3vh,40px) 0 0}
.row100k .l2-top{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(28px,5vh,48px)}
.row100k .l2-sum{container-type:inline-size;min-width:0}
.row100k .l2-eye{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
.row100k .l2-h1{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:min(calc(100cqw / 8.7),76px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);margin-top:.28em;padding-bottom:.34em;border-bottom:2px solid var(--ink)}
/* The divisor, under the rule the way a sum is written. */
.row100k .l2-work{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);margin-top:10px}
/* THE ONE GIANT FIGURE, and the one thing in water on the screen. */
.row100k .l2-fig{font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / 3.06),280px);line-height:.86;letter-spacing:-.02em;color:var(--water);font-variant-numeric:tabular-nums;white-space:nowrap;margin-left:-.035em}
.row100k .l2-say{font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / 8.7),76px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);margin-top:.12em}
/* ABOUT 16 MINUTES. is about 10.4em, so it is set at .74 of the line over
 * it and runs the same measure: three lines, one width. */
.row100k .l2-min{display:inline-block;font-size:.74em;line-height:1;color:var(--gray);white-space:nowrap;margin-top:.1em}
.row100k .l2-at{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);margin-top:14px}
/* OPT IN, a size up from the front page cut: on this page it is the only
 * thing to press. */
.row100k .l2-act .optin{font-size:clamp(46px,13.4vw,96px)}
.row100k .l2-facts{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);margin-top:16px}
/* DESKTOP: the same poster with the action beside it, sat on its foot. */
@media(min-width:900px){
  .row100k .l2-top{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:64px;align-items:end}
  .row100k .l2-top .l2-act{padding-bottom:4px}
  .row100k .l2-act .optin{font-size:min(7.2vw,96px)}
}

/* ------------------------------------------------------ UNDER THE FOLD
 * A section is a 2px rule, a statement in Archivo Black, then the thing. */
.row100k section.l2-sec{padding:clamp(44px,8vh,76px) 0 0}
.row100k .l2-h{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(24px,6.6vw,38px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink);border-top:2px solid var(--ink);padding-top:14px;text-wrap:balance}
.row100k .l2-nb{display:inline-block;white-space:nowrap}
.row100k .l2-note{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin-top:12px;line-height:1.7}
.row100k .l2-duo{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(44px,8vh,76px)}
.row100k .l2-blk{min-width:0}
@media(min-width:900px){.row100k .l2-duo{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:64px}}

/* THE TABLE: a later start is the same sum with fewer days under it. The
 * meters are the figure of each line; today is the one in water. */
.row100k .l2-tab{width:100%;border-collapse:collapse;margin-top:18px;font-family:var(--row-mono),monospace;font-size:13px}
.row100k .l2-tab th{text-align:right;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);font-weight:400;padding:0 0 8px 10px;border-bottom:1px solid var(--ink);white-space:nowrap}
.row100k .l2-tab td{text-align:right;padding:13px 0 12px 10px;border-bottom:1px dashed var(--line);vertical-align:middle;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink-soft)}
.row100k .l2-tab th:first-child,.row100k .l2-tab td:first-child{text-align:left;padding-left:0}
.row100k .l2-when{display:block;font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:14px;line-height:1.2;letter-spacing:.02em;text-transform:uppercase;color:var(--ink)}
.row100k .l2-date{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-top:3px}
.row100k .l2-m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(22px,6.2vw,32px);line-height:1;color:var(--ink)}
.row100k .l2-tab tr.l2-on .l2-m{color:var(--water)}
.row100k .l2-tab tr.l2-on td{color:var(--ink)}

/* THE CALENDAR: seven across, a square a day. The water in a cell stands
 * as high as the running total it has to reach (the second shade of the
 * site calendar, theme.ts .hm-cell.b2, so ink stays readable on it); the
 * last day is full and in water, the days already gone are empty and
 * dashed, today wears the ink frame. No line along the top of the water:
 * it struck through whatever figure it crossed. */
.row100k .l2-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:18px}
.row100k .l2-dow{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;color:var(--gray);text-align:center;padding-bottom:2px}
.row100k .l2-day{position:relative;aspect-ratio:1;min-width:0;border:1px solid var(--line);overflow:hidden}
.row100k .l2-day.l2-past{border-style:dashed}
.row100k .l2-day.l2-now{border:2px solid var(--ink)}
.row100k .l2-fill{position:absolute;left:0;right:0;bottom:0;display:block;background:#a5cde3}
.row100k .l2-dn{position:absolute;left:4px;top:4px;font-family:var(--row-mono),monospace;font-size:9px;line-height:1;color:var(--gray)}
.row100k .l2-k{position:absolute;left:4px;bottom:4px;font-family:var(--row-mono),monospace;font-weight:700;font-size:clamp(10px,2.9vw,13px);line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .l2-day.l2-goal{border-color:var(--water)}
.row100k .l2-goal .l2-fill{background:var(--water)}
.row100k .l2-goal .l2-dn,.row100k .l2-goal .l2-k{color:#fff}

/* WHAT THE SITE KEEPS: whose month it is on one mono line, the pace line
 * and the four bests side by side on a desktop, the cards under them. */
.row100k .l2-eg{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin-top:22px;padding-top:12px;border-top:1px dashed var(--line);line-height:1.7}
.row100k .l2-eg b{color:var(--ink)}
.row100k .l2-kept{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;margin-top:18px}
.row100k .l2-kept .st-kde{margin-top:0;padding-top:0;border-top:none}
@media(min-width:900px){.row100k .l2-kept{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:48px;align-items:start}}
.row100k .l2-bests{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;border-top:2px solid var(--ink)}
.row100k .l2-best{padding:12px 0 14px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .l2-bk{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:8px}
.row100k .l2-bk .dtag{margin-left:0}
.row100k .l2-bv{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5.4vw,28px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .l2-bs{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:6px;overflow-wrap:anywhere}
/* The cards are stickers, white ink on nothing, so each sits on ink. Two
 * across on a phone with the short logo card under them, three on desktop. */
.row100k .l2-cards{margin-top:26px}
.row100k .l2-cap{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gray);margin-bottom:10px}
.row100k .l2-cards .ld-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;position:relative}
.row100k .l2-cards .ld-card{display:block;width:100%;height:auto;background:var(--ink)}
.row100k .l2-cards .ld-card:nth-child(3){grid-column:1/-1}
@media(min-width:640px){
  .row100k .l2-cards .ld-cards{grid-template-columns:repeat(3,1fr)}
  .row100k .l2-cards .ld-card:nth-child(3){grid-column:auto}
}

/* THE BOARD SO FAR: the front page top fives (theme.ts .front-top). */
.row100k .l2-boards{margin-top:20px}
.row100k .l2-hidden{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);padding:16px 0 0}

/* THE END: today as one number, and OPT IN again. */
.row100k section.l2-end{padding:clamp(52px,10vh,96px) 0 0}
.row100k .l2-last{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8.8vw,76px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);margin-top:.28em;padding-bottom:.34em;border-bottom:2px solid var(--ink)}
/* The figure never breaks inside itself: on a narrow phone late in the
 * month (TODAY IS 12,500 M.) it takes the second line whole. */
.row100k .l2-last b{display:inline-block;font-weight:400;color:var(--water);white-space:nowrap}
.row100k .l2-end .l2-act{margin-top:clamp(26px,5vh,44px)}
`;
