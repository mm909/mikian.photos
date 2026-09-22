/* THE ERG PRODUCT SHEET (owner, 2026-09-17: the telemetry screen moves out
 * of Rowtember and the two things go disjoint). Its OWN tokens — nothing
 * here reaches into /row100k/theme.ts, and nothing here leaks out: every
 * rule is scoped under .eg, the class Shell.tsx puts on the page body. The
 * bar and the footer above and below it are the site chrome and are styled
 * by /row100k/theme.ts, not by this file.
 *
 * TWO GROUNDS, one skeleton. The skeleton (ergCss) colours itself entirely
 * off CSS variables; a surface picks which set it wants by wearing
 * .eg-ink or .eg-paper.
 *   .eg-ink   — the LIVE surfaces: monitors, one erg mid-piece. An ink
 *               ground and the grey ladder measured against it: #fff for
 *               values, .74 body copy, .62 eyebrows and keys, .5 the
 *               quietest live text, .3 and .18 rules and chart grids,
 *               never a letter.
 *   .eg-paper — the REVIEW surfaces: a saved session read after the fact.
 *               Paper, ink, water blue, the same line grey the rest of the
 *               site uses.
 *
 * HOUSE RULE: these strings are rendered as the text child of a style tag,
 * so NO double quotes, apostrophes, angle brackets or ampersands anywhere
 * in them, comments included. */

/* The ink ground: the live surfaces. */
export const ergInkCss = `
.eg-ink{
  --eg-bg:#0b0c0e;
  --eg-panel:#121417;
  --eg-fg:#ffffff;
  --eg-fg-2:rgba(255,255,255,.74);
  --eg-fg-3:rgba(255,255,255,.62);
  --eg-fg-4:rgba(255,255,255,.5);
  --eg-line:rgba(255,255,255,.3);
  --eg-line-soft:rgba(255,255,255,.18);
  --eg-accent:#ffffff;
  --eg-accent-fg:#0b0c0e;
  background:var(--eg-bg);
  color:var(--eg-fg);
}
`;

/* The paper set: the review surfaces, where a piece is read after it is
 * rowed. Water blue is the one colour, the way it is everywhere else on
 * the site. */
export const ergPaperCss = `
.eg-paper{
  --eg-bg:#f4f3ee;
  --eg-panel:#ffffff;
  --eg-fg:#15171a;
  --eg-fg-2:rgba(21,23,26,.78);
  --eg-fg-3:rgba(21,23,26,.66);
  --eg-fg-4:rgba(21,23,26,.54);
  --eg-line:#c9c8c0;
  --eg-line-soft:#e2e1da;
  --eg-accent:#0077b6;
  --eg-accent-fg:#ffffff;
  background:var(--eg-bg);
  color:var(--eg-fg);
}
`;

/* The skeleton every erg surface shares: type, buttons, the monitor rows,
 * the console, the tables, the log. Colours come from the variables above,
 * so one rule set reads on both grounds. */
export const ergCss = `
.eg,.eg *{margin:0;padding:0;box-sizing:border-box}
.eg{
  --eg-bg:#0b0c0e;--eg-panel:#121417;--eg-fg:#fff;
  --eg-fg-2:rgba(255,255,255,.74);--eg-fg-3:rgba(255,255,255,.62);--eg-fg-4:rgba(255,255,255,.5);
  --eg-line:rgba(255,255,255,.3);--eg-line-soft:rgba(255,255,255,.18);
  --eg-accent:#fff;--eg-accent-fg:#0b0c0e;
  min-height:100vh;
  background:var(--eg-bg);
  color:var(--eg-fg);
  font-family:var(--eg-archivo),system-ui,sans-serif;
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;
}
.eg .eg-mono{font-family:var(--eg-mono),ui-monospace,monospace}
.eg .eg-num{font-family:var(--eg-black),var(--eg-archivo),sans-serif;font-weight:400;font-variant-numeric:tabular-nums}
.eg .eg-wrap{max-width:1180px;margin:0 auto;padding:0 18px;width:100%}
.eg a{color:inherit;text-underline-offset:3px}
.eg b{font-weight:700}

/* THE BAR THIS SHEET USED TO CARRY IS GONE (owner, 2026-09-17: it does not
 * need to be its own page at the moment — we will leave it in the drop-down
 * menu for now, but when it goes live it will probably just be another
 * header on the Rowtember site). These pages wear the site bar and the site
 * footer now; see Shell.tsx. Only the body below them is .eg. */

.eg .eg-head{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;justify-content:space-between;border-bottom:1px solid var(--eg-line);padding-bottom:10px;margin:26px 0 18px}
.eg .eg-head h1{font-family:var(--eg-black),sans-serif;font-weight:400;font-size:30px;line-height:1.1;letter-spacing:-.01em}
.eg .eg-head .eg-eyebrow{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3)}

.eg .eg-note{font-family:var(--eg-mono),monospace;font-size:12px;color:var(--eg-fg-3)}
.eg .eg-bad{color:#ff8a7a}

.eg .eg-btn{
  display:inline-flex;align-items:center;gap:8px;
  font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;
  padding:9px 14px;border:1px solid var(--eg-fg);border-radius:2px;
  background:transparent;color:var(--eg-fg);cursor:pointer;text-decoration:none;
}
.eg .eg-btn:hover{background:var(--eg-accent);border-color:var(--eg-accent);color:var(--eg-accent-fg)}
.eg .eg-btn:disabled{opacity:.4;cursor:default}
.eg .eg-btn:disabled:hover{background:transparent;color:var(--eg-fg);border-color:var(--eg-fg)}
.eg .eg-btn-quiet{border-color:var(--eg-line);color:var(--eg-fg-3)}
.eg .eg-btn-quiet:hover{background:transparent;border-color:var(--eg-fg);color:var(--eg-fg)}
.eg .eg-btns{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:16px 0 22px}

/* ---- THE MONITORS LIST: ONE ROW PER ERG (owner, 2026-09-17, after using
 * the cards: I want them to be more horizontal than cards — horizontally
 * stacked rather than side by side like a card). A full-width line each,
 * stacked down the page: the erg, the four live numbers in the order he
 * reads them, and one quiet dot button. Six ergs read as six lines.
 *
 * The row is one anchor plus the one control beside it. The anchor carries
 * the erg and the numbers; the dot menu sits outside it, because a control
 * inside a link is not a control. Nothing else on the row sets anything
 * (owner, same day: I do not need the goal buttons here).
 *
 * ON A PHONE the numbers wrap UNDER the erg rather than squeezing, and the
 * side controls take their own line. Nothing here may scroll sideways, so
 * every flex child that holds text is min-width:0. ---- */

.eg .eg-rows{display:flex;flex-direction:column;gap:10px}
.eg .eg-r{
  border:1px solid var(--eg-line);border-radius:3px;background:var(--eg-panel);
  display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap;
  padding:10px 12px 10px 14px;
}
.eg .eg-r-open{
  flex:1 1 560px;min-width:0;
  display:flex;align-items:center;gap:12px 22px;flex-wrap:wrap;
  text-decoration:none;color:inherit;padding:4px 2px;border-radius:2px;
}
.eg .eg-r-open:hover .eg-r-name{text-decoration:underline}
.eg .eg-r-who{flex:1 1 200px;min-width:0}
.eg .eg-r-name{display:block;font-family:var(--eg-black),sans-serif;font-size:17px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eg .eg-r-sub{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;
  font-family:var(--eg-mono),monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--eg-fg-3);margin-top:3px;
}
/* FOUR COLUMNS, AND THE THIRD IS WIDER (review, 2026-09-17: the expected
 * finish was being clipped to a tilde and four digits — tilde 19 colon 3 —
 * because every column was an equal quarter of 464px while the goal control
 * beside it held 337px of the row. The goal has gone into the dot menu, and
 * the one column that can hold a clock over an hour long gets a little more
 * of what it left behind). minmax with a zero floor is what stops a grid
 * track refusing to shrink below its content on a narrow screen. */
.eg .eg-r-nums{flex:2 1 520px;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.35fr) minmax(0,1fr);gap:10px 14px}
.eg .eg-r-n{min-width:0;display:block}
/* The key WRAPS rather than clipping: EXPECTED 5,000 M FINISH is the
 * longest of the four and it has to read whole. Two lines of room on every
 * key, so the four numbers under them still line up. */
.eg .eg-r-n .k{display:block;font-family:var(--eg-mono),monospace;font-size:9px;line-height:1.25;letter-spacing:.13em;text-transform:uppercase;color:var(--eg-fg-3);min-height:23px;overflow:hidden}
.eg .eg-r-n .v{display:block;font-family:var(--eg-black),sans-serif;font-size:clamp(18px,2.1vw,24px);line-height:1.15;font-variant-numeric:tabular-nums;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* The line under a number WRAPS (review, 2026-09-17: at 9px, nowrap and an
 * ellipsis, the band on the expected finish was cut off mid-word for the
 * whole first kilometre of every piece, which left a bold clock with
 * nothing beside it saying it was a guess). Two lines of room, the same
 * grey as the keys rather than the quietest one on the sheet, and the long
 * version of the sentence lives in a title attribute. */
.eg .eg-r-n .s{display:block;font-family:var(--eg-mono),monospace;font-size:10.5px;line-height:1.3;letter-spacing:.1em;text-transform:uppercase;color:var(--eg-fg-3);margin-top:3px;min-height:28px;overflow-wrap:break-word}
.eg .eg-r-side{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-left:auto}
/* SAVED or UNSAVED, on the row (review, 2026-09-17). Quiet when the piece
 * is filed, outlined in full white when it is not. */
.eg .eg-pip{display:inline-block;border:1px solid var(--eg-line);border-radius:2px;padding:1px 6px;font-size:9px;font-weight:700;letter-spacing:.14em;color:var(--eg-fg-3)}
.eg .eg-pip-on{border-color:var(--eg-fg);color:var(--eg-fg)}
.eg .eg-r-note{
  flex:1 1 100%;border-top:1px dashed var(--eg-line-soft);padding-top:8px;
  font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-4);
}

/* THE GOAL CONTROL (owner, 2026-09-17: infer the goal distance to be a
 * five K always, but allow us to change it). Three chips and a box, on the
 * row and in the console head. */
.eg .eg-goal{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.eg .eg-goal-k{font-family:var(--eg-mono),monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-goal-box{
  width:88px;min-width:0;
  font-family:var(--eg-mono),monospace;font-size:12px;font-variant-numeric:tabular-nums;
  padding:6px 8px;border:1px solid var(--eg-line);border-radius:2px;
  background:transparent;color:var(--eg-fg);
}
.eg .eg-goal-box::placeholder{color:var(--eg-fg-4)}

/* THE DOT MENU (owner, 2026-09-17: the save, remove, disconnect options
 * should be like in a dot dot dot menu). A panel hung off one button, and
 * every control in the panel at thumb size.
 *
 * THE BUTTON IS DISCREET (owner, same day, after using it: the three dots
 * button is a little large, can be a little more discreet). A 44px
 * bordered box at the end of every row read as a fifth control competing
 * with four numbers. It is a small grey glyph now with no box around it
 * until it is hovered, focused or open. It keeps a 30px target on a mouse
 * and the media query below gives it the full 44px back under a finger,
 * where a small target is a miss rather than a subtlety. */
.eg .eg-menu-wrap{position:relative}
.eg .eg-dots{
  display:inline-flex;align-items:center;justify-content:center;
  width:30px;height:30px;padding:0;
  border:1px solid transparent;border-radius:2px;background:transparent;color:var(--eg-fg-4);
  font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.1em;line-height:1;cursor:pointer;
}
.eg .eg-dots:hover{border-color:var(--eg-line);color:var(--eg-fg)}
.eg .eg-dots:focus-visible{border-color:var(--eg-fg);color:var(--eg-fg)}
.eg .eg-dots[aria-expanded=true]{border-color:var(--eg-fg);color:var(--eg-fg)}
.eg .eg-menu{
  position:absolute;right:0;top:calc(100% + 6px);z-index:30;
  width:266px;max-width:76vw;
  display:flex;flex-direction:column;gap:8px;
  border:1px solid var(--eg-fg);border-radius:3px;background:var(--eg-panel);padding:12px;
  box-shadow:0 12px 34px rgba(0,0,0,.45);
}
.eg .eg-menu input{
  width:100%;min-height:44px;
  font-family:var(--eg-mono),monospace;font-size:12px;
  padding:9px 10px;border:1px solid var(--eg-line);border-radius:2px;
  background:transparent;color:var(--eg-fg);
}
.eg .eg-menu input::placeholder{color:var(--eg-fg-4)}
.eg .eg-menu .eg-btn{justify-content:center;min-height:44px}
.eg .eg-menu .eg-note{word-break:break-word}
/* THE GOAL, INSIDE THE PANEL, AT EVERY WIDTH (owner, 2026-09-17: he does
 * not want the goal buttons on the monitor row). It used to be displayed
 * only under 760px, with the row carrying an open copy above that; the row
 * carries nothing now, so this is the only copy on the monitors screen. A
 * rule under it separates setting the goal from the four things below that
 * act on the erg itself. */
.eg .eg-menu-goal{
  display:block;padding-bottom:10px;margin-bottom:2px;
  border-bottom:1px solid var(--eg-line-soft);
}
.eg .eg-menu-goal .eg-goal{gap:6px 8px}
.eg .eg-menu-goal .eg-chip{min-height:36px}
.eg .eg-menu-goal .eg-goal-box{min-height:36px;width:76px}
/* AND SO MUST THE TARGET BOX (review, 2026-09-17: .eg .eg-menu input is one
 * class plus an element, which outranks the two classes the rower sheet gives
 * .eg-tgt-box, so inside the dot menu the target went full width and a
 * different height from the goal box directly above it). Three classes
 * settles it. */
.eg .eg-menu-goal .eg-tgt{gap:6px 8px}
.eg .eg-menu-goal .eg-tgt-box{min-height:36px;width:76px;padding:6px 8px}

/* Said to a screen reader, never on screen. */
.eg .eg-away{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

.eg .eg-link-state{display:inline-flex;align-items:center;gap:6px;font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.eg .eg-dot{width:8px;height:8px;border-radius:50%;background:var(--eg-fg-4);display:inline-block}
.eg .eg-dot-live{background:#49d17a}
.eg .eg-dot-wait{background:#e6c34a}
.eg .eg-dot-gone{background:#ff8a7a}

.eg .eg-save{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.eg .eg-save input{
  flex:1 1 170px;min-width:0;
  font-family:var(--eg-mono),monospace;font-size:12px;
  padding:8px 10px;border:1px solid var(--eg-line);border-radius:2px;
  background:transparent;color:var(--eg-fg);
}
.eg .eg-save input::placeholder{color:var(--eg-fg-4)}
.eg .eg-row-actions{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}

.eg .eg-empty{border:1px dashed var(--eg-line);border-radius:3px;padding:26px 18px;color:var(--eg-fg-3);font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.eg .eg-block{border-left:2px solid var(--eg-line);padding:10px 0 10px 14px;margin:14px 0;color:var(--eg-fg-2);font-size:15px;max-width:74ch}

.eg .eg-foot{border-top:1px solid var(--eg-line-soft);margin-top:46px;padding:16px 0 40px;font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--eg-fg-4)}

/* WHAT EXPLAINS, AT THE FOOT (owner, 2026-09-17: whenever we have text that
 * explains something, let us put it on the bottom of the page rather than
 * the top). Under a quiet rule, in the mono voice the rest of the quiet
 * text on these pages uses — present for the reader who wants it, out of
 * the way of the reader who does not. */
.eg .eg-tail{border-top:1px solid var(--eg-line-soft);margin-top:40px;padding-top:16px;max-width:84ch}
.eg .eg-tail p{font-family:var(--eg-mono),monospace;font-size:12px;line-height:1.75;color:var(--eg-fg-3);margin-bottom:10px}
.eg .eg-tail p:last-child{margin-bottom:0}
.eg .eg-tail b{color:var(--eg-fg-2);font-weight:700}

/* INSIDE THE SITE SHELL the bar and the footer carry the page, so the erg
 * body no longer needs a screen of its own height — but it should still
 * hold the ground down a short page. */
.row100k .eg{min-height:70vh}
/* The live pages are ink from the bar to the footer: the site root is
 * cream, and the strip of it between the bar and this sheet, and again
 * above the footer, read as two white bars on the television (owner,
 * 2026-09-22). */
.row100k.eg-root-ink{background:#0b0c0e}

/* A DISCREET BUTTON IS STILL A TARGET. On a finger the dots go back to the
 * full 44px, because at 30px a small grey glyph stops being subtle and
 * starts being a miss. The box stays invisible until it is pressed. */
@media (pointer:coarse){
  .eg .eg-dots{width:44px;height:44px;font-size:13px}
  /* AND SO DOES THE GOAL, WHEREVER IT IS (review, 2026-09-17: moving the
   * monitors copy into the dot menu narrowed these two rules to the menu,
   * which quietly took the 44px off the OTHER copy — the one in the console
   * head, which is the one a rower actually sets a piece up with). Three
   * classes so they outrank the 36px the menu copy takes on a mouse, and
   * keyed to the pointer rather than the width, so a tablet gets them too. */
  .eg .eg-goal .eg-chip{min-height:44px;padding:5px 12px}
  .eg .eg-goal .eg-goal-box{min-height:44px}
}

/* ON A PHONE THE ROW STACKS (review, 2026-09-17: four numbers, a name and a
 * control band ran three ergs to three screens of scrolling — on the screen
 * whose whole point is that six ergs read as six lines). The name, then the
 * four numbers two by two, then the dots on their own line at the right.
 * The goal is inside the panel at every width now, so there is nothing else
 * on that line to balance against. */
@media (max-width:760px){
  .eg .eg-r-open{gap:10px}
  .eg .eg-r-who{flex:1 1 100%}
  .eg .eg-r-nums{flex:1 1 100%;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 12px}
  .eg .eg-r-side{width:100%;margin-left:0;justify-content:flex-end}
}
@media (max-width:560px){
  .eg .eg-head h1{font-size:24px}
  .eg .eg-wrap{padding:0 16px}
}
/* ---- THE RACE BOARD (owner, 2026-09-21: a live race board, one row per
 * lane, distance, pace, expected time, and who is in the lead). Built to be
 * read off a TV across a gym: one lane per line, the place in the largest
 * type on the row, four numbers that line up down the screen, and a bar to
 * the same 5,000 on every lane so the field reads as a field. ---- */
.eg .eg-board{padding-bottom:24px}
.eg .eg-board-head{display:flex;align-items:flex-end;gap:14px 18px;flex-wrap:wrap;border-bottom:1px solid var(--eg-line);padding-bottom:10px;margin:26px 0 16px}
.eg .eg-board-head h1{font-family:var(--eg-black),sans-serif;font-weight:400;font-size:30px;line-height:1.1;letter-spacing:-.01em}
.eg .eg-board-head .eg-eyebrow{margin-left:auto}
.eg .eg-lanes{display:flex;flex-direction:column;gap:8px}
.eg .eg-lane{
  display:grid;grid-template-columns:72px minmax(160px,1.6fr) repeat(4,minmax(0,1fr));gap:10px 18px;align-items:center;
  width:100%;text-align:left;border:1px solid var(--eg-line);border-radius:3px;background:var(--eg-panel);
  padding:14px 16px;color:inherit;cursor:pointer;
}
.eg .eg-lane:hover{border-color:var(--eg-fg)}
.eg .eg-lane-lead{border-color:var(--eg-fg)}
.eg .eg-lane-place{font-family:var(--eg-black),sans-serif;font-size:clamp(26px,3vw,40px);line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.eg .eg-lane-who{min-width:0;display:flex;flex-direction:column;gap:5px}
.eg .eg-lane-name{font-family:var(--eg-black),sans-serif;font-size:clamp(17px,1.7vw,22px);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .eg-lane-sub{font-family:var(--eg-mono),monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-lane-bar{display:block;height:6px;background:var(--eg-line-soft);border-radius:3px;overflow:hidden;margin-top:2px}
.eg .eg-lane-bar span{display:block;height:100%;background:var(--eg-fg)}
.eg .eg-lane-n{min-width:0}
.eg .eg-lane-n .k{display:block;font-family:var(--eg-mono),monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-lane-n .v{display:block;font-family:var(--eg-black),sans-serif;font-size:clamp(22px,2.4vw,34px);line-height:1.1;margin-top:3px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .eg-lane-n .s{display:block;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--eg-fg-4);margin-top:3px;min-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .eg-board-foot{margin-top:22px;max-width:84ch;font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.06em;line-height:1.7;color:var(--eg-fg-4)}
@media (max-width:900px){
  .eg .eg-lane{grid-template-columns:56px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)}
  .eg .eg-lane-who{grid-column:2 / -1}
  .eg .eg-lane-gap{display:none}
}

/* ---- ONE ERG: the console (owner, 2026-09-17: click on that erg and see
 * the telemetry for that person). The detail view swaps in over the list on
 * the same page, so it wears the same ground and adds only what a console
 * needs: a head, the big numbers, the charts, the tables and the raw feed.
 * Every colour is a variable, so all of it reads on ink and on paper. ---- */

.eg .eg-detail{padding-bottom:10px}

.eg .eg-dhead{
  border:1px solid var(--eg-line);border-radius:3px;background:var(--eg-panel);
  padding:14px 16px 16px;margin:22px 0 14px;
  display:flex;justify-content:space-between;gap:16px 28px;flex-wrap:wrap;
  font-family:var(--eg-mono),monospace;font-size:12px;
}
.eg .eg-dwho{min-width:0;flex:1 1 320px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.eg .eg-dname{font-family:var(--eg-black),sans-serif;font-weight:400;font-size:clamp(20px,4vw,28px);line-height:1.05;letter-spacing:-.01em}
.eg .eg-dfacts{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;margin:0}
.eg .eg-dfacts dt{color:var(--eg-fg-3);font-size:10px;letter-spacing:.14em;text-transform:uppercase;align-self:baseline}
.eg .eg-dfacts dd{margin:0;color:var(--eg-fg);font-variant-numeric:tabular-nums;word-break:break-word}
.eg .eg-dctl{display:flex;flex-direction:column;gap:10px;align-items:flex-start;flex:1 1 320px;min-width:0}
.eg .eg-dctl .eg-save{width:100%}
.eg .eg-dstate{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg)}
.eg .eg-dstate span{color:var(--eg-fg-3);margin-left:10px}
.eg .eg-loaded{
  display:inline-block;border:1px solid var(--eg-line);color:var(--eg-fg-2);
  font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  padding:3px 8px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}

/* The chips: the sample rate on the head, the speed on the transport. */
.eg .eg-chips{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.eg .eg-chip{
  font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
  padding:5px 9px;border:1px solid var(--eg-line);border-radius:2px;
  background:transparent;color:var(--eg-fg-2);cursor:pointer;
}
.eg .eg-chip:hover{border-color:var(--eg-fg);color:var(--eg-fg)}
.eg .eg-chip.on{background:var(--eg-accent);border-color:var(--eg-accent);color:var(--eg-accent-fg);font-weight:700}

/* THE BIG NUMBERS: what a console shows from across a gym. */
.eg .eg-bigs{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px;margin-bottom:8px}
.eg .eg-big{border:1px solid var(--eg-line-soft);border-radius:2px;padding:12px 14px 13px;min-width:0}
/* NOTHING IN A TILE LEAVES ITS TILE (owner, 2026-09-17, while playing a row
 * back: in the expected 5,000 metres the numbers go out of the box). The
 * value was nowrap with no overflow rule at all in a 168px column, so a
 * clock like tilde 1:02:05.4 simply walked out over the border of its
 * neighbour. It clips now, the way the same number on a monitors row always
 * has, and the floor of the clamp drops far enough that it rarely has to. */
.eg .eg-big .l{display:block;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .eg-big .v{display:block;font-family:var(--eg-black),sans-serif;font-size:clamp(22px,3.4vw,40px);line-height:1;margin-top:8px;color:var(--eg-fg);font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* A LONG VALUE TAKES A SMALLER SIZE RATHER THAN AN ELLIPSIS. Twelve tiles
 * auto-fill to about 180px each however wide the screen is, so the 40px the
 * clamp reaches on a desktop fits six characters and no more — and the
 * expected finish is eight, or ten once a piece runs over an hour. Every
 * other tile is untouched; the one that needs the room takes it out of its
 * own type. Tile picks the class from what it is about to print. */
.eg .eg-big .v.v-snug{font-size:clamp(20px,2.7vw,32px)}
.eg .eg-big .v.v-tight{font-size:clamp(17px,2.2vw,26px)}
.eg .eg-big .v .u{font-family:var(--eg-mono),monospace;font-size:11px;font-weight:400;letter-spacing:.12em;color:var(--eg-fg-3);margin-left:6px}
.eg .eg-big .s{display:block;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--eg-fg-3);margin-top:8px;min-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* A section of the console, and its rule. */
.eg .eg-sec{margin:26px 0 0}
.eg .eg-sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--eg-line);padding-bottom:8px;margin-bottom:12px}
.eg .eg-sec-head h3{font-family:var(--eg-black),sans-serif;font-weight:400;font-size:19px;line-height:1.1}

/* THE CHARTS: bordered panels, each an SVG that fills its width. */
.eg .eg-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
.eg .eg-charts.four{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.eg .eg-chart{border:1px solid var(--eg-line-soft);border-radius:2px;padding:10px 12px 8px;min-width:0}
/* TWO LINES TALL, ALWAYS (review, 2026-09-17: a reading that wraps on the
 * narrow four-up charts would push the plot down under the pointer that put
 * it there, and one that does not wrap loses the second series off the right
 * edge). The room is reserved whether or not anything is in it, so hovering
 * a chart never moves it or its neighbours. */
.eg .eg-chart .t{display:flex;justify-content:space-between;align-items:flex-start;gap:4px 10px;flex-wrap:wrap;min-height:31px;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3);margin-bottom:6px}
.eg .eg-chart .t b{color:var(--eg-fg);font-weight:700}
.eg .eg-chart .t .lg{letter-spacing:.1em}
.eg .eg-chart svg{display:block;width:100%;height:auto}
.eg .eg-svg .ax{fill:var(--eg-fg-3);font-family:var(--eg-mono),monospace;font-size:9px;letter-spacing:.04em}
.eg .eg-svg .axl{fill:var(--eg-fg-3);font-family:var(--eg-mono),monospace;font-size:8px;letter-spacing:.14em;text-transform:uppercase}
.eg .eg-svg .grid{stroke:var(--eg-line-soft);stroke-width:1}
.eg .eg-svg .axis{stroke:var(--eg-line);stroke-width:1}
.eg .eg-svg .ln{fill:none;stroke:var(--eg-fg);stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}
.eg .eg-svg .ln2{fill:none;stroke:var(--eg-fg-3);stroke-width:1.4;stroke-dasharray:4 3;stroke-linejoin:round}
.eg .eg-svg .ref{stroke:var(--eg-line);stroke-width:1;stroke-dasharray:2 3}
.eg .eg-svg .bar{fill:var(--eg-fg-3)}
.eg .eg-svg .area{fill:var(--eg-line-soft)}
.eg .eg-svg .dot{fill:var(--eg-fg)}
.eg .eg-svg .peak{fill:var(--eg-fg);font-family:var(--eg-mono),monospace;font-size:9px;letter-spacing:.06em}
.eg .eg-svg .empty{fill:var(--eg-fg-3);font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase}

/* THE CHART CURSOR, AND THE CHART OPENED (owner, 2026-09-17: let me click on
 * the charts on the live look on the erg to open them up and scrub through
 * them and make them bigger, kind of like how big the force curve is — and
 * my cursor should be able to go to a certain point and see the XY values on
 * it).
 *
 * The panel IS the button that opens: he said click on the charts, not click
 * a little word above them. The opened chart is a slider, the same shape the
 * stats scrub already is. Nothing here is portalled, because .eg is the only
 * place the variables above exist.
 *
 * The opened svg carries its width and height INLINE in pixels, so no rule in
 * this sheet fights it and nothing depends on the order of these blocks. The
 * type overrides name the svg by element as well as by class, so they beat
 * the base .eg .eg-svg rules on specificity rather than on being further
 * down the file. */
.eg .eg-chart-hit{display:block;width:100%;margin:0;padding:0;border:0;background:none;color:inherit;text-align:left;cursor:zoom-in;touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.eg .eg-chart-hit:focus{outline:none}
.eg .eg-chart-hit:focus-visible{outline:2px solid var(--eg-fg);outline-offset:3px}
.eg .eg-chart .t .lg{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eg .eg-chart .t .rd{flex:1 1 100%;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;color:var(--eg-fg);letter-spacing:.08em;font-variant-numeric:tabular-nums}
.eg .eg-svg .cur{stroke:var(--eg-fg);stroke-width:1;stroke-dasharray:3 3;opacity:.8;pointer-events:none}
.eg .eg-svg .cdot{fill:var(--eg-bg);stroke:var(--eg-fg);stroke-width:1.6;pointer-events:none}
.eg .eg-svg .bar-on{fill:var(--eg-fg)}

.eg .eg-zoom{position:fixed;inset:0;z-index:900;background:var(--eg-bg);display:flex;align-items:stretch;justify-content:center;padding:14px}
.eg .eg-zoom-card{flex:1 1 auto;max-width:1180px;min-width:0;min-height:0;display:flex;flex-direction:column;border:1px solid var(--eg-line);border-radius:3px;padding:12px 14px 10px}
.eg .eg-zoom-head{flex:0 0 auto;display:flex;align-items:baseline;gap:10px 14px;flex-wrap:wrap;border-bottom:1px solid var(--eg-line);padding-bottom:9px}
.eg .eg-zoom-title{font-family:var(--eg-black),sans-serif;font-size:19px;line-height:1.1;color:var(--eg-fg)}
.eg .eg-zoom-head .eg-btn{margin-left:auto}
.eg .eg-read{flex:0 0 auto;display:flex;align-items:baseline;gap:6px 22px;flex-wrap:wrap;min-height:38px;padding:9px 0 7px}
.eg .eg-read .c{display:flex;align-items:baseline;gap:7px;min-width:0}
.eg .eg-read .k{font-family:var(--eg-mono),monospace;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3);white-space:nowrap}
.eg .eg-read .v{font-family:var(--eg-black),sans-serif;font-size:17px;line-height:1;color:var(--eg-fg);font-variant-numeric:tabular-nums;white-space:nowrap}
.eg .eg-read .hint{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-4)}
.eg .eg-zoom-plot{flex:1 1 auto;min-height:0;min-width:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none;cursor:crosshair;user-select:none;-webkit-user-select:none}
.eg .eg-zoom-plot:focus{outline:none}
.eg .eg-zoom-plot:focus-visible{outline:2px solid var(--eg-fg);outline-offset:2px}
.eg .eg-zoom-plot svg.eg-svg .ax{font-size:11px;letter-spacing:.06em}
.eg .eg-zoom-plot svg.eg-svg .axl{font-size:10px;letter-spacing:.18em}
.eg .eg-zoom-plot svg.eg-svg .peak{font-size:11px}
.eg .eg-zoom-plot svg.eg-svg .empty{font-size:13px}
.eg .eg-zoom-plot svg.eg-svg .ln{stroke-width:2}
.eg .eg-zoom-plot svg.eg-svg .ln2{stroke-width:1.6;stroke-dasharray:5 4}
.eg .eg-zoom-plot svg.eg-svg .cdot{stroke-width:2}
.eg .eg-zoom-foot{flex:0 0 auto;display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;padding-top:9px;border-top:1px solid var(--eg-line-soft)}
/* THE SPREAD: the mean, one standard deviation, and the density of one KPI,
 * drawn on the chart own y scale (owner, 2026-09-17: when most of these
 * graphs I also want a KDE showing the results of each KPI and their mean
 * and sd). The rule and the slab draw on every panel that asks for them; the
 * hill itself only in an opened chart, where there is width to spend.
 *
 * THE LINE IS ITS OWN ROW. It is not a third span inside the title row,
 * which reserves exactly two lines and would grow every panel and push the
 * plot down under the pointer that asked for it.
 *
 * The fills are the foreground token at an explicit opacity rather than a
 * line token, because the same two weights have to separate on the ink
 * ground and on the paper one. */
.eg .eg-chart-stat{display:flex;align-items:baseline;gap:3px 14px;flex-wrap:wrap;min-height:13px;margin:0 0 6px;font-family:var(--eg-mono),monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-4);font-variant-numeric:tabular-nums}
.eg .eg-chart-stat.off{color:var(--eg-fg-4);opacity:.75}
.eg .eg-zoom-card .eg-chart-stat{flex:0 0 auto;font-size:11px;letter-spacing:.12em;color:var(--eg-fg-3);margin:0;padding-top:8px}
.eg .eg-chart-still{display:block;width:100%;cursor:default}
.eg .eg-svg .sdband{fill:var(--eg-fg);opacity:.055}
.eg .eg-svg .meanln{stroke:var(--eg-fg-3);stroke-width:1;stroke-dasharray:6 4;opacity:.9}
.eg .eg-svg .kd{fill:var(--eg-fg);opacity:.13}
.eg .eg-svg .kdln{fill:none;stroke:var(--eg-fg-3);stroke-width:1.2;stroke-linejoin:round}
.eg .eg-svg .kdax{stroke:var(--eg-line-soft);stroke-width:1}
.eg .eg-svg .kdot{fill:var(--eg-bg);stroke:var(--eg-fg);stroke-width:1.6;pointer-events:none}
.eg .eg-svg .kdlbl{fill:var(--eg-fg-3);font-family:var(--eg-mono),monospace;font-size:8px;letter-spacing:.12em;text-transform:uppercase}
.eg .eg-zoom-plot svg.eg-svg .kdln{stroke-width:1.6}
.eg .eg-zoom-plot svg.eg-svg .kdlbl{font-size:10px}
.eg .eg-zoom-plot svg.eg-svg .meanln{stroke-width:1.2;stroke-dasharray:8 5}

/* ---- THE CONSOLE, TIDIED (owner, 2026-09-21): the name is a field, the
 * settings are a drawer, each KPI is a pair of charts, the force curves are
 * a bundle, and the feed is a table that updates in place. ---- */
.eg .eg-dname-box{
  display:block;width:100%;max-width:520px;
  font-family:var(--eg-black),sans-serif;font-size:26px;line-height:1.1;letter-spacing:-.01em;
  padding:4px 8px;margin:6px 0 4px -8px;border:1px solid transparent;border-radius:2px;
  background:transparent;color:var(--eg-fg);
}
.eg .eg-dname-box:hover{border-color:var(--eg-line-soft)}
.eg .eg-dname-box:focus{outline:none;border-color:var(--eg-fg)}
.eg .eg-dname-box::placeholder{color:var(--eg-fg-4)}
.eg .eg-settings{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px 28px;
  border:1px solid var(--eg-line);border-radius:3px;background:var(--eg-panel);
  padding:14px 16px 16px;margin:-6px 0 14px;
}
.eg .eg-settings-col{display:flex;flex-direction:column;gap:12px;min-width:0}
.eg .eg-settings .eg-eyebrow{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3);border-bottom:1px solid var(--eg-line-soft);padding-bottom:6px}
.eg .eg-settings .eg-dfacts{margin:0}

/* A PAIR: what happened, and what it was made of. The line chart takes the
 * larger share; the distribution sits beside it at the same height. */
.eg .eg-pairs{display:flex;flex-direction:column;gap:10px}
.eg .eg-pair{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:10px}
.eg .eg-dist .eg-chart-hit{cursor:default}
@media (max-width:760px){
  .eg .eg-pair{grid-template-columns:minmax(0,1fr)}
}

/* THE BUNDLE: every stroke faint, the average dashed, the latest bright. */
.eg .eg-svg .fc-one{fill:none;stroke:var(--eg-fg);stroke-width:.8;opacity:.11;stroke-linejoin:round}
.eg .eg-svg .fc-avg{fill:none;stroke:var(--eg-fg-2);stroke-width:1.8;stroke-dasharray:6 4;stroke-linejoin:round}
.eg .eg-svg .fc-now{fill:none;stroke:var(--eg-fg);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}
.eg .eg-zoom-plot svg.eg-svg .fc-one{stroke-width:1}
.eg .eg-zoom-plot svg.eg-svg .fc-now{stroke-width:3}

/* THE FEED TABLE: one row per characteristic, the decoded fields as
 * key value chips that update in place. A row that has never arrived is
 * dim and empty, which is the honest way to show it is missing. */
.eg .eg-feedtab td{vertical-align:top}
.eg .eg-feed-none{opacity:.45}
.eg .eg-feed-dc{display:flex;flex-wrap:wrap;gap:4px 10px;max-width:760px}
.eg .eg-kv{display:inline-flex;align-items:baseline;gap:4px;font-family:var(--eg-mono),monospace;font-size:10.5px;white-space:nowrap}
.eg .eg-kv .k{color:var(--eg-fg-4);letter-spacing:.04em}
.eg .eg-kv .v{color:var(--eg-fg);font-variant-numeric:tabular-nums;min-width:2ch}

@media (max-width:640px){
  .eg .eg-zoom{padding:0}
  .eg .eg-zoom-card{max-width:none;border:0;border-radius:0}
  .eg .eg-read .v{font-size:15px}
  /* A phone leaves far more height than a square chart wants, and centring
   * the slack pushed the plot a third of a screen below the reading that
   * belongs to it. It sits under the strip instead, and the empty is all at
   * the bottom where the chips are. */
  .eg .eg-zoom-plot{align-items:flex-start}
}
@media (hover:none) and (pointer:coarse){
  .eg .eg-chart-hit{cursor:default}
}

/* The force curve panel when the monitor has no 0x3D to give. */
.eg .eg-none{border:1px dashed var(--eg-line);border-radius:3px;padding:22px 16px;text-align:center;line-height:1.8;font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-none b{display:block;color:var(--eg-fg);font-weight:700}

/* THE TABLES: splits, and the saved rows in the playback picker. */
.eg .eg-scroll{overflow-x:auto}
.eg table.eg-table{width:100%;min-width:640px;border-collapse:collapse;font-family:var(--eg-mono),monospace;font-size:12px;font-variant-numeric:tabular-nums;color:var(--eg-fg-2)}
.eg table.eg-table th{text-align:left;padding:6px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3);border-bottom:1px solid var(--eg-line);white-space:nowrap}
.eg table.eg-table td{padding:8px 6px;border-bottom:1px solid var(--eg-line-soft);white-space:nowrap}
.eg table.eg-table td.tt{max-width:260px;overflow:hidden;text-overflow:ellipsis}

/* THE SUMMARY: every field, keys quiet, values loud. */
.eg .eg-sum{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px 18px;font-family:var(--eg-mono),monospace;font-size:12px}
.eg .eg-sum div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--eg-line-soft);padding:5px 0}
.eg .eg-sum span{color:var(--eg-fg-3);font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.eg .eg-sum b{color:var(--eg-fg);font-weight:700;font-variant-numeric:tabular-nums;text-align:right}

/* THE RAW FEED and THE LOG, side by side once there is room. */
.eg .eg-two{display:grid;grid-template-columns:1fr;gap:12px}
.eg .eg-feed{border:1px solid var(--eg-line);border-radius:2px;font-family:var(--eg-mono),monospace;font-size:11px;line-height:1.6;padding:10px 12px;max-height:420px;overflow:auto;white-space:pre;color:var(--eg-fg-2)}
.eg .eg-feed .ts{color:var(--eg-fg-3);margin-right:8px}
.eg .eg-feed .id{color:var(--eg-fg);font-weight:700;margin-right:8px}
.eg .eg-feed .hx{color:var(--eg-fg-3)}
.eg .eg-feed .dc{color:var(--eg-fg-2);white-space:pre-wrap;word-break:break-word;padding-left:16px}
.eg .eg-log{border:1px solid var(--eg-line);border-radius:2px;font-family:var(--eg-mono),monospace;font-size:11px;line-height:1.7;padding:10px 12px;max-height:280px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;color:var(--eg-fg-2)}
.eg .eg-log .ts{color:var(--eg-fg-3);margin-right:8px}

/* ---- THE TRANSPORT (owner, 2026-09-17: play back a row like simulate
 * simulates data). It sits between the head and the tiles, and the word
 * PLAYBACK is the loudest thing on it: everything under this strip is the
 * ordinary live console, so the strip is the only thing saying that these
 * numbers already happened. ---- */

.eg .eg-pb{border:1px solid var(--eg-fg);border-radius:3px;padding:12px 14px 10px;margin:0 0 16px;display:flex;flex-direction:column;gap:10px}
.eg .eg-pb-top{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap}
.eg .eg-pb-mark{background:var(--eg-accent);color:var(--eg-accent-fg);font-family:var(--eg-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;padding:4px 9px}
.eg .eg-pb-title{font-family:var(--eg-black),sans-serif;font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eg .eg-pb-note{margin-left:auto;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-pb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.eg .eg-pb-speeds{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-left:auto}
.eg .eg-pb-k{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-pb-scrub{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.eg .eg-pb-scrub input{flex:1 1 220px;min-width:0;accent-color:var(--eg-fg);height:22px;cursor:pointer}
.eg .eg-pb-clock{font-family:var(--eg-black),sans-serif;font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap}
.eg .eg-pb-of{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-3);margin-left:4px}
.eg .eg-pb-bar{display:block;height:3px;background:var(--eg-line-soft);overflow:hidden}
.eg .eg-pb-bar span{display:block;height:100%;background:var(--eg-fg)}

/* The saved rows the playback picker opens over the list. */
.eg .eg-picker{border:1px solid var(--eg-line);border-radius:3px;background:var(--eg-panel);padding:12px 14px 14px;margin:0 0 20px}
.eg .eg-picker .eg-sec-head{margin-bottom:10px}

@media (min-width:900px){
  .eg .eg-two{grid-template-columns:3fr 2fr}
}
@media (max-width:560px){
  .eg .eg-chart-stat{gap:3px 10px;letter-spacing:.1em}
  .eg .eg-bigs{grid-template-columns:repeat(2,1fr)}
  .eg .eg-big .v{font-size:24px}
  .eg .eg-pb-note{margin-left:0}
  .eg .eg-pb-speeds{margin-left:0}
}
`;
