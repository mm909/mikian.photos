/* THE ERG PRODUCT SHEET (owner, 2026-09-17: the telemetry screen moves out
 * of Rowtember and the two things go disjoint). Its OWN tokens — nothing
 * here reaches into /row100k/theme.ts, and nothing here leaks out: every
 * rule is scoped under .eg, the class the layout puts on the page.
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

/* The skeleton every erg surface shares: type, the bar, buttons, cards,
 * tiles, the log. Colours come from the variables above, so one rule set
 * reads on both grounds. */
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

.eg .eg-bar{
  position:sticky;top:0;z-index:40;
  display:flex;align-items:center;gap:18px;flex-wrap:wrap;
  padding:12px 18px;
  background:var(--eg-bg);
  border-bottom:1px solid var(--eg-line);
}
.eg .eg-bar .eg-mark{font-family:var(--eg-black),sans-serif;font-size:15px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none}
.eg .eg-bar nav{display:flex;gap:16px;align-items:center}
.eg .eg-bar nav a{font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3);text-decoration:none}
.eg .eg-bar nav a:hover{color:var(--eg-fg)}
.eg .eg-bar nav a.on{color:var(--eg-fg);text-decoration:underline}
.eg .eg-bar .eg-who{margin-left:auto;font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-bar .eg-who a{color:var(--eg-fg)}

.eg .eg-head{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;justify-content:space-between;border-bottom:1px solid var(--eg-line);padding-bottom:10px;margin:26px 0 18px}
.eg .eg-head h1{font-family:var(--eg-black),sans-serif;font-weight:400;font-size:30px;line-height:1.1;letter-spacing:-.01em}
.eg .eg-head .eg-eyebrow{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3)}

.eg .eg-copy{color:var(--eg-fg-2);max-width:74ch;font-size:15px;margin-bottom:14px}
.eg .eg-copy b{color:var(--eg-fg)}
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

.eg .eg-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.eg .eg-card{border:1px solid var(--eg-line);border-radius:3px;background:var(--eg-panel);padding:0;display:flex;flex-direction:column}
.eg .eg-card-open{
  display:block;width:100%;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--eg-line-soft);
  padding:14px 16px 12px;cursor:pointer;color:inherit;text-decoration:none;
}
.eg .eg-card-open:hover{background:rgba(127,127,127,.08)}
.eg .eg-card-name{font-family:var(--eg-black),sans-serif;font-size:17px;letter-spacing:.01em;display:block}
.eg .eg-card-sub{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--eg-fg-3);display:block;margin-top:3px}
.eg .eg-card-body{padding:12px 16px 14px;display:flex;flex-direction:column;gap:12px}

.eg .eg-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.eg .eg-tile{border:1px solid var(--eg-line-soft);border-radius:2px;padding:8px 9px}
.eg .eg-tile .k{display:block;font-family:var(--eg-mono),monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-tile .v{display:block;font-family:var(--eg-black),sans-serif;font-size:19px;line-height:1.2;font-variant-numeric:tabular-nums;margin-top:2px}

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

@media (max-width:560px){
  .eg .eg-head h1{font-size:24px}
  .eg .eg-tiles{grid-template-columns:repeat(2,1fr)}
  .eg .eg-bar{gap:10px;padding:10px 14px}
  .eg .eg-wrap{padding:0 16px}
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
.eg .eg-big .l{display:block;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .eg-big .v{display:block;font-family:var(--eg-black),sans-serif;font-size:clamp(26px,3.4vw,40px);line-height:1;margin-top:8px;color:var(--eg-fg);font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}
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
.eg .eg-chart .t{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3);margin-bottom:6px}
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
  .eg .eg-bigs{grid-template-columns:repeat(2,1fr)}
  .eg .eg-big .v{font-size:24px}
  .eg .eg-pb-note{margin-left:0}
  .eg .eg-pb-speeds{margin-left:0}
}
`;
