/* THE ROWER VIEW SHEET (owner, 2026-09-17: "I do not see the rower view
 * that I can look at while I am rowing").
 *
 * A phone propped on the erg, read from about seventy centimetres by
 * somebody at a hundred and seventy five. One column, one graph, and
 * nothing that moves except the five hundred metre card — which lands in
 * the chart box and gives it back, so the two numbers at the top never
 * shift under his eye mid-stroke.
 *
 * EVERY SIZE IS A CLAMP ON VW, so the same column reads on a 360 wide phone
 * and on a laptop. Nothing is portalled: the eg variables live under .eg,
 * and this sheet is always mounted so switching views is not a style tag
 * appearing and the screen never flashes.
 *
 * HOUSE RULE, the same as ergTheme.ts: this string is the text child of a
 * style tag, so NO double quotes, apostrophes, angle brackets or ampersands
 * anywhere in it, comments included. */

export const rowerCss = `
/* CAPPED AT ABOUT A PHONE (review, 2026-09-17: the two SVGs here are drawn
 * in 360 units and stretched to their column, so on a laptop the one chart
 * came out six hundred pixels tall and the column jumped by four hundred
 * when the five hundred metre card took its place). Centred, so a wide
 * screen reads it as a column and not as a strip hugging the left. */
.eg .eg-rw{display:flex;flex-direction:column;gap:10px;padding-bottom:28px;max-width:460px;margin:0 auto}
/* A dropped link means the numbers are frozen. Saying so is not enough on
 * its own: the whole screen goes quiet so it cannot be mistaken for live. */
.eg .eg-rw-stale{opacity:.55}

/* IT HAS TO CLEAR THE SITE BAR (review, 2026-09-17: at top 0 it slid
 * straight under the sticky bar above it the moment the page scrolled).
 * These are the site bar heights, not its scroll margins — eight pixels of
 * air would leave a strip of the page showing through above this one. */
.eg .eg-rw-bar{
  position:sticky;top:62px;z-index:20;
  display:flex;align-items:center;gap:8px 12px;min-height:44px;
  background:var(--eg-bg);border-bottom:1px solid var(--eg-line-soft);
}
.eg .eg-rw-name{
  flex:1 1 auto;min-width:0;
  font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--eg-fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.eg .eg-rw-views{display:flex;gap:6px;flex:0 0 auto}
/* The one warning this screen must never swallow. Its own row, wrapping. */
.eg .eg-rw-drop{
  border-left:3px solid #ff8a7a;padding-left:10px;
  font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;
  color:#ff8a7a;line-height:1.5;
}
.eg .eg-rw-views .eg-chip{min-height:38px;padding:5px 14px;font-size:12px}

/* THE TWO NUMBERS THE MONITOR DOES NOT SAY IN THESE WORDS. Stacked rather
 * than columned: eight characters of clock at this size want the width. */
.eg .eg-rw-now{display:flex;flex-direction:column;gap:2px;margin-top:6px}
.eg .eg-rw-k{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3);margin-top:10px}
.eg .eg-rw-k:first-child{margin-top:0}
/* NEVER ELLIPSISED. The two numbers this screen exists for step a size down
 * or they are wrong; they are not cut. */
.eg .eg-rw-v{
  display:block;font-family:var(--eg-black),sans-serif;font-size:clamp(52px,16vw,72px);line-height:1;
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;color:var(--eg-fg);
}
.eg .eg-rw-v.long{font-size:clamp(40px,12vw,56px)}
.eg .eg-rw-u{font-family:var(--eg-mono),monospace;font-size:14px;letter-spacing:.1em;color:var(--eg-fg-3);margin-left:8px}
.eg .eg-rw-prog{display:block;height:4px;background:var(--eg-line-soft);margin-top:8px;border-radius:2px;overflow:hidden}
.eg .eg-rw-prog span{display:block;height:100%;background:var(--eg-fg)}
.eg .eg-rw-s{
  display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:6px;
  font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-3);
}
.eg .eg-rw-fin{
  display:block;font-family:var(--eg-black),sans-serif;font-size:clamp(32px,9.5vw,44px);line-height:1;
  font-variant-numeric:tabular-nums;letter-spacing:-.01em;color:var(--eg-fg);
}
.eg .eg-rw-fin.long{font-size:clamp(26px,7.6vw,36px)}

/* THE BAND, drawn closing. It is an svg on the same sheet as every chart,
 * so it inverts with the ground like everything else. */
.eg .eg-rw-band{margin-top:2px}
.eg .eg-rw-band svg{display:block;width:100%;height:auto}
.eg .eg-svg .rwseg{fill:var(--eg-fg);opacity:.16}
.eg .eg-svg .rwseg-prior{fill:none;stroke:var(--eg-fg-3);stroke-width:1;stroke-dasharray:4 4}
.eg .eg-svg .rwtick{stroke:var(--eg-fg);stroke-width:2}
.eg .eg-svg .rwtgt{stroke:var(--eg-fg);stroke-width:1.4}
.eg .eg-svg .rwbase{stroke:var(--eg-line-soft);stroke-width:1}
.eg .eg-svg .rwend{fill:var(--eg-fg-3);font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
.eg .eg-svg .rwlbl{fill:var(--eg-fg);font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase}

/* THE ONE LINE OF COACHING. A pace you can row to, never a verdict: the
 * wording comes out of predict.ts verbatim and the shouting is done here.
 * The box reserves two lines so a change of state moves nothing. */
.eg .eg-rw-cue{
  display:block;width:100%;text-align:left;min-height:calc(2.44em + 24px);
  border:0;border-left:3px solid var(--eg-line-soft);background:transparent;
  padding:2px 0 2px 12px;
  font-family:var(--eg-archivo),sans-serif;font-size:clamp(18px,5.2vw,24px);line-height:1.22;
  text-transform:uppercase;letter-spacing:.01em;color:var(--eg-fg);
}
.eg .eg-rw-cue.on{border-left-color:var(--eg-line)}
.eg .eg-rw-cue.ahead{border-left-color:var(--eg-fg)}
.eg .eg-rw-cue.behind{border-left-color:var(--eg-fg);font-weight:700}
.eg .eg-rw-cue.gone{border-left-color:#ff8a7a;color:#ff8a7a}
.eg .eg-rw-cue.none{color:var(--eg-fg-3);cursor:pointer}
.eg .eg-rw-cuek{display:block;margin-top:6px;font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.12em;color:var(--eg-fg-3);min-height:14px}

/* THE ONE GRAPH, and the three blocks that take its place. All four are the
 * same height, so the column never reflows when the piece moves on. */
/* THE FOUR THINGS THAT CAN BE IN THE ONE SLOT ARE THE SAME HEIGHT at every
 * width, which is what stops the numbers above moving when a card lands. The
 * SVG is bounded by HEIGHT rather than by width, because width alone leaves
 * it varying between a 360 phone and the cap. */
.eg .eg-rw-chart{min-height:210px}
.eg .eg-rw-chart svg.eg-svg{max-height:184px}
.eg .eg-rw-band svg.eg-svg{max-height:74px}
.eg .eg-rw-chart .eg-chart{border:0;padding:0}
.eg .eg-rw-chart .eg-chart .t{font-size:11px;min-height:20px}
.eg .eg-rw-chart svg.eg-svg .ax{font-size:13px;letter-spacing:.04em}
.eg .eg-rw-chart svg.eg-svg .axl{font-size:11px}
.eg .eg-rw-chart svg.eg-svg .ln{stroke-width:2.2}
.eg .eg-rw-chart .eg-chart-stat{font-size:11px;letter-spacing:.1em;color:var(--eg-fg-3)}
.eg .eg-rw-chart svg.eg-svg .kdlbl{font-size:11px}
.eg .eg-rw-settle,.eg .eg-rw-last{
  min-height:210px;display:flex;flex-direction:column;justify-content:center;gap:10px;
  border:1px solid var(--eg-line-soft);border-radius:2px;padding:14px;
}
.eg .eg-rw-settle .m,.eg .eg-rw-last .m{font-family:var(--eg-black),sans-serif;font-size:clamp(34px,10vw,48px);line-height:1;font-variant-numeric:tabular-nums}
.eg .eg-rw-settle .k,.eg .eg-rw-last .k{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3)}

/* THE FIVE HUNDRED. It lands in the chart box and gives it back, so the two
 * numbers above it do not move while he is looking at them. */
.eg .eg-rw-flash{
  min-height:210px;display:flex;flex-direction:column;justify-content:center;gap:12px;
  border:1px solid var(--eg-fg);border-radius:2px;padding:14px;
  background:transparent;color:inherit;text-align:left;width:100%;cursor:pointer;
}
.eg .eg-rw-flash .m{display:block;font-family:var(--eg-black),sans-serif;font-size:32px;line-height:1}
.eg .eg-rw-flash .sp{display:block;font-family:var(--eg-black),sans-serif;font-size:clamp(40px,13vw,56px);line-height:1;font-variant-numeric:tabular-nums}
.eg .eg-rw-flash .two{display:flex;justify-content:space-between;gap:12px}
.eg .eg-rw-flash .two b{display:block;font-family:var(--eg-black),sans-serif;font-weight:400;font-size:22px;line-height:1;font-variant-numeric:tabular-nums}
.eg .eg-rw-flash .two span span{display:block;margin-top:4px;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3)}

/* THE LADDER. Every finished five hundred, newest first, each carrying what
 * the finish looked like when it landed rather than what it is now. */
.eg .eg-rw-splits{display:flex;flex-direction:column;gap:2px}
.eg .eg-rw-row{
  display:grid;grid-template-columns:auto auto 1fr auto auto;gap:10px;align-items:baseline;
  padding:9px 2px;border-bottom:1px dashed var(--eg-line-soft);
  font-family:var(--eg-mono),monospace;font-size:14px;font-variant-numeric:tabular-nums;
}
.eg .eg-rw-row .t{color:var(--eg-fg-3)}
.eg .eg-rw-row .m{color:var(--eg-fg-3)}
.eg .eg-rw-row .v{color:var(--eg-fg);font-weight:700}
.eg .eg-rw-row .d{color:var(--eg-fg-3)}
.eg .eg-rw-row .f{color:var(--eg-fg-3);text-align:right}
.eg .eg-rw-splits .eg-btn{margin-top:10px;align-self:flex-start}

/* The quietest slot on the screen, and it keeps its height whether or not
 * anything is in it, so its arrival moves nothing. */
.eg .eg-rw-note{min-height:18px;font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--eg-fg-4)}
.eg .eg-rw-setupbtn{min-height:44px;align-self:flex-start}
.eg .eg-rw-setup{border:1px solid var(--eg-line);border-radius:3px;padding:12px 14px;display:flex;flex-direction:column;gap:12px}
.eg .eg-rw-foot{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-4);line-height:1.6}

/* THE TARGET TIME, the one control this whole screen adds. It sits beside
 * the goal distance everywhere the goal distance already sits: the dot menu
 * on a monitors row, the console head, and the setup drawer here. */
.eg .eg-tgt{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.eg .eg-tgt-k{font-family:var(--eg-mono),monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-tgt-box{
  width:92px;min-width:0;
  font-family:var(--eg-mono),monospace;font-size:12px;font-variant-numeric:tabular-nums;
  padding:6px 8px;border:1px solid var(--eg-line);border-radius:2px;
  background:transparent;color:var(--eg-fg);
}
.eg .eg-tgt-box::placeholder{color:var(--eg-fg-4)}

@media (pointer:coarse){
  .eg .eg-tgt .eg-chip{min-height:44px;padding:5px 12px}
  .eg .eg-tgt .eg-tgt-box{min-height:44px}
  .eg .eg-rw-views .eg-chip{min-height:44px}
}
/* The site bar is taller when it wraps, and taller again with the stamp. */
@media (max-width:639px){
  .eg .eg-rw-bar{top:98px}
}
@media (max-width:430px){
  .eg .eg-rw-row{grid-template-columns:auto auto 1fr auto;font-size:13px}
  .eg .eg-rw-row .f{grid-column:1 / -1;text-align:left;padding-left:2px}
}
`;
