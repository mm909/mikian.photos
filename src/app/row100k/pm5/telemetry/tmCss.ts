/* Telemetry styles — .tm- prefix, theme.ts untouched (owner, 2026-09-17: a
 * live telemetry screen like a rocket launch). Ink top to bottom: page.tsx
 * wears chrome-ink for the bar and the footer, .tm-dark paints the middle
 * and re-cuts the theme classes it holds (sec-head, tabs, outline-btn,
 * quiet-btn, table.board) for the black ground, the way raceday/rdCss.ts
 * does for race day. Monochrome, mono type, numbers in Archivo Black.
 *
 * THE GREY LADDER is rdCss.ts's, measured against #15171a: #fff for values
 * and headlines, .74 for body copy, .62 for eyebrows, keys and table heads,
 * .5 for the quietest live text; .18 to .3 are rules and chart grids, never
 * a letter.
 *
 * Rendered as the text child of a style tag, so NO double quotes,
 * apostrophes, angle brackets or ampersands anywhere in the string. */
export const tmCss = `
.row100k .tm-dark{background:var(--ink);color:#fff;padding:6px 0 46px}
.row100k .tm-dark section{padding:34px 0 8px}
.row100k .tm-dark section:first-child{padding-top:26px}
.row100k .tm-wrap{max-width:1180px}

.row100k .tm-dark .sec-head{border-bottom-color:#fff}
.row100k .tm-dark .sec-head h2{color:#fff}
.row100k .tm-dark .sec-head .mono{color:rgba(255,255,255,.62)}
.row100k .tm-dark a{color:#fff;text-decoration-color:currentColor}
.row100k .tm-dark .outline-btn{border-color:#fff;color:#fff;background:transparent}
.row100k .tm-dark .outline-btn:hover{background:#fff;border-color:#fff;color:var(--ink)}
.row100k .tm-dark .outline-btn:disabled{opacity:.4;cursor:default}
.row100k .tm-dark .outline-btn:disabled:hover{background:transparent;color:#fff}
.row100k .tm-dark .quiet-btn{color:rgba(255,255,255,.62)}
.row100k .tm-dark .quiet-btn:hover{color:#fff}
.row100k .tm-dark .tabs{margin-bottom:0}
.row100k .tm-dark .tabs button{border-color:rgba(255,255,255,.62);color:rgba(255,255,255,.74);padding:6px 11px;font-size:11px}
.row100k .tm-dark .tabs button.on{background:#fff;border-color:#fff;color:var(--ink)}
.row100k .tm-dark .tabs button:hover:not(.on){border-color:#fff;color:#fff}
.row100k .tm-dark .tabs button:disabled{opacity:.4;cursor:default}
.row100k .tm-dark table.board{background:transparent;color:rgba(255,255,255,.82)}
.row100k .tm-dark table.board th{color:rgba(255,255,255,.62);border-bottom-color:rgba(255,255,255,.55)}
.row100k .tm-dark table.board td{border-bottom-color:rgba(255,255,255,.2)}
.row100k .tm-dark :focus-visible{outline-color:#fff}

/* The copy at the top: what the page is and the three things that have
 * to be true before a monitor shows up on it. */
.row100k .tm-copy{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:rgba(255,255,255,.74);line-height:1.8;margin:0 0 20px;max-width:88ch}
.row100k .tm-copy b{color:#fff;font-weight:700}
.row100k .tm-nope{border:2px solid #fff;padding:18px 20px;font-family:var(--row-mono),monospace;font-size:13px;line-height:1.8;color:#fff}
.row100k .tm-nope b{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:20px;text-transform:uppercase;margin-bottom:6px}

/* THE HEAD: the erg, the link, the controls. One bordered block, facts on
 * the left, buttons on the right, both wrapping on a phone. */
.row100k .tm-head{border:2px solid #fff;padding:14px 16px 16px;display:flex;justify-content:space-between;gap:16px 28px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-size:12px}
.row100k .tm-erg{min-width:0;flex:1 1 320px}
.row100k .tm-erg .nm{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,4vw,28px);line-height:1;text-transform:uppercase;letter-spacing:-.01em;color:#fff;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.row100k .tm-erg dl{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;margin:12px 0 0;padding:0}
.row100k .tm-erg dt{color:rgba(255,255,255,.62);font-size:10px;letter-spacing:.14em;text-transform:uppercase;align-self:baseline}
.row100k .tm-erg dd{margin:0;color:#fff;font-variant-numeric:tabular-nums;word-break:break-word}
.row100k .tm-erg dd.q{color:rgba(255,255,255,.5)}
.row100k .tm-ctl{display:flex;flex-direction:column;gap:12px;align-items:flex-start;flex:0 1 auto}
.row100k .tm-btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.row100k .tm-rate{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.row100k .tm-rate .k{color:rgba(255,255,255,.62);font-size:10px;letter-spacing:.14em;text-transform:uppercase}

/* The link word: LIVE is white and bold, CONNECTING is the quiet grey,
 * DROPPED wears the rule down its side that an error wears on race day. */
.row100k .tm-link{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62);padding:2px 0}
.row100k .tm-link.live{color:#fff}
.row100k .tm-link.dropped{color:#fff;border-left:3px solid #fff;padding-left:10px}
/* THE INVERSION: the one white slab in the head, and it says SIMULATED. */
.row100k .tm-sim{display:inline-block;background:#fff;color:var(--ink);font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;padding:4px 9px 3px}
.row100k .tm-state{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#fff;margin-top:10px}
.row100k .tm-state span{color:rgba(255,255,255,.5);margin-left:10px}

/* THE TILES: the numbers a launch console shows big. */
.row100k .tm-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px;margin-top:14px}
.row100k .tm-tile{border:1px solid rgba(255,255,255,.3);padding:12px 14px 13px;min-width:0}
.row100k .tm-tile .l{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62)}
.row100k .tm-tile .v{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,3.4vw,40px);line-height:1;margin-top:8px;color:#fff;font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}
.row100k .tm-tile .v .u{font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;letter-spacing:.12em;color:rgba(255,255,255,.62);margin-left:6px}
.row100k .tm-tile .s{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-top:8px;min-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* THE CHARTS: a grid of bordered panels, each an SVG that fills its
 * width. The stroke panel is four smaller ones. */
.row100k .tm-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
.row100k .tm-charts.four{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.row100k .tm-chart{border:1px solid rgba(255,255,255,.3);padding:10px 12px 8px;min-width:0}
.row100k .tm-chart .t{display:flex;justify-content:space-between;gap:10px;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62);margin-bottom:6px;flex-wrap:wrap}
.row100k .tm-chart .t b{color:#fff;font-weight:700}
.row100k .tm-chart .t .lg{color:rgba(255,255,255,.5);letter-spacing:.1em}
.row100k .tm-chart svg{display:block;width:100%;height:auto}
.row100k .tm-svg .ax{fill:rgba(255,255,255,.62);font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.04em}
.row100k .tm-svg .axl{fill:rgba(255,255,255,.5);font-family:var(--row-mono),monospace;font-size:8px;letter-spacing:.14em;text-transform:uppercase}
.row100k .tm-svg .grid{stroke:rgba(255,255,255,.14);stroke-width:1}
.row100k .tm-svg .axis{stroke:rgba(255,255,255,.4);stroke-width:1}
.row100k .tm-svg .ln{fill:none;stroke:#fff;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}
.row100k .tm-svg .ln2{fill:none;stroke:rgba(255,255,255,.55);stroke-width:1.4;stroke-dasharray:4 3;stroke-linejoin:round}
.row100k .tm-svg .ref{stroke:rgba(255,255,255,.3);stroke-width:1;stroke-dasharray:2 3}
.row100k .tm-svg .bar{fill:rgba(255,255,255,.55)}
.row100k .tm-svg .area{fill:rgba(255,255,255,.22)}
.row100k .tm-svg .dot{fill:#fff}
.row100k .tm-svg .peak{fill:#fff;font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.06em}
.row100k .tm-svg .empty{fill:rgba(255,255,255,.5);font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase}

/* The force curve block when the monitor has no 0x3D to give. */
.row100k .tm-none{border:1px dashed rgba(255,255,255,.4);padding:22px 16px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62);text-align:center;line-height:1.8}
.row100k .tm-none b{display:block;color:#fff;font-weight:700}

/* THE SUMMARY: every field, keys quiet, values white. */
.row100k .tm-sum{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px 18px;font-family:var(--row-mono),monospace;font-size:12px}
.row100k .tm-sum div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed rgba(255,255,255,.2);padding:5px 0}
.row100k .tm-sum span{color:rgba(255,255,255,.62);font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.row100k .tm-sum b{color:#fff;font-weight:700;font-variant-numeric:tabular-nums;text-align:right}
.row100k .tm-empty{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5);line-height:1.8;padding:6px 0}
.row100k .tm-scroll{overflow-x:auto}
.row100k table.board.tm-t{min-width:640px;font-size:12px}
.row100k table.board.tm-t td{padding:8px 6px}

/* THE FEED and THE LOG: black on black, so the raw panel is a bordered
 * pre with the quiet grey for the clock and the hex. */
.row100k .tm-feed{border:1px solid rgba(255,255,255,.4);font-family:var(--row-mono),monospace;font-size:11px;line-height:1.6;padding:10px 12px;max-height:420px;overflow:auto;white-space:pre;color:rgba(255,255,255,.82)}
.row100k .tm-feed .ts{color:rgba(255,255,255,.5);margin-right:8px}
.row100k .tm-feed .id{color:#fff;font-weight:700;margin-right:8px}
.row100k .tm-feed .hx{color:rgba(255,255,255,.5)}
.row100k .tm-feed .dc{color:rgba(255,255,255,.74);white-space:pre-wrap;word-break:break-word;padding-left:16px}
.row100k .tm-log{border:1px solid rgba(255,255,255,.4);font-family:var(--row-mono),monospace;font-size:11px;line-height:1.7;padding:10px 12px;max-height:260px;overflow-y:auto;white-space:pre-wrap;word-break:break-word;color:rgba(255,255,255,.82)}
.row100k .tm-log .ts{color:rgba(255,255,255,.5);margin-right:8px}
/* SAVE and SAVED ROWS (owner, 2026-09-17: the option to save the live
 * telemetry of a row). The title box is the underline input the forms
 * use, cut for the black ground; the note under the block is the quiet
 * grey, a refusal wears the rule down its side that DROPPED wears; the
 * LOADED word is the quiet inversion next to the link word. */
.row100k .tm-save{display:flex;gap:14px 24px;flex-wrap:wrap;align-items:flex-end}
.row100k .tm-title{display:flex;flex-direction:column;gap:6px;flex:1 1 320px;min-width:0}
.row100k .tm-title .k{font-family:var(--row-mono),monospace;color:rgba(255,255,255,.62);font-size:10px;letter-spacing:.14em;text-transform:uppercase}
.row100k .tm-title input{width:100%;background:transparent;border:0;border-bottom:2px solid rgba(255,255,255,.55);color:#fff;font-family:var(--row-mono),monospace;font-size:13px;padding:6px 2px;border-radius:0;appearance:none;-webkit-appearance:none}
.row100k .tm-title input::placeholder{color:rgba(255,255,255,.4)}
.row100k .tm-title input:focus{outline:none;border-bottom-color:#fff}
.row100k .tm-title input:disabled{color:rgba(255,255,255,.5);border-bottom-color:rgba(255,255,255,.25)}
.row100k .tm-msg{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;line-height:1.7;margin:12px 0 0;color:#fff}
.row100k .tm-msg.quiet{color:rgba(255,255,255,.5)}
.row100k .tm-msg.ok{color:#fff;font-weight:700}
.row100k .tm-msg.no{color:#fff;border-left:3px solid #fff;padding-left:10px;text-transform:none;letter-spacing:.06em}
.row100k .tm-loaded{display:inline-block;border:1px solid rgba(255,255,255,.62);color:rgba(255,255,255,.82);font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;padding:3px 8px 2px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row100k table.board.tm-rows{min-width:900px}
.row100k table.board.tm-rows td.tt{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row100k table.board.tm-rows tr.here td{color:#fff;font-weight:700}
.row100k table.board.tm-rows .rn{color:rgba(255,255,255,.5);font-variant-numeric:tabular-nums;margin-right:6px}
.row100k .tm-simb{display:inline-block;background:#fff;color:var(--ink);font-family:var(--row-mono),monospace;font-size:9px;font-weight:700;letter-spacing:.16em;padding:2px 5px 1px;margin-left:8px;vertical-align:1px}
.row100k .tm-act{white-space:nowrap}
.row100k .tm-act .quiet-btn{margin-right:12px;text-transform:uppercase;letter-spacing:.12em;font-size:10px}
.row100k .tm-act .quiet-btn:last-child{margin-right:0}
.row100k .tm-act .quiet-btn.sure{color:#fff;font-weight:700}
.row100k .tm-act .quiet-btn:disabled{opacity:.4;cursor:default;text-decoration:none}
.row100k .tm-two{display:grid;grid-template-columns:1fr;gap:14px}
.row100k .tm-tools{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.row100k .tm-tools .n{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.62)}
@media (min-width:900px){.row100k .tm-two{grid-template-columns:3fr 2fr}}
@media (max-width:560px){.row100k .tm-tiles{grid-template-columns:repeat(2,1fr)}.row100k .tm-tile .v{font-size:24px}}
`;
