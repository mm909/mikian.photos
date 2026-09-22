/* THE TELEVISION SHEET (owner, 2026-09-21: "this will be on a full screen
 * monitor, give me a view that would go on a TV"; 2026-09-22: twelve
 * racers, a screen saver; then "keep the tower look and the broadcast
 * look … build 3 more new ones … make sure the bar at the bottom can be
 * hidden or hides when inactive").
 *
 * Text child of a style tag: NO double quotes, apostrophes, angle brackets
 * or ampersands anywhere in here, comments included.
 *
 * EVERYTHING IS IN vh AND vw. A television is one fixed frame at one
 * distance, so the type is sized against the screen and not against the
 * pixel: a 4 k set and a 720p projector draw the same picture.
 *
 * IT FITS TWELVE. The root carries --n, the lane count, and every look
 * derives --rowh, the height one lane may take. A row is that tall and its
 * type is the SMALLER of its wall size and a share of the row, so eight
 * lanes get big rows and twelve get rows that still read. Past eight lanes
 * the root wears .dense and the small second lines come off.
 *
 * FIVE LOOKS, one root class each — .eg-tv-a to .eg-tv-e — and the strip
 * of controls that shows for a few seconds after the pointer moves and
 * hides again (.ctl on the root), since a wall has no mouse. */
export const tvCss = `
.eg .eg-tv{
  position:fixed;inset:0;z-index:60;overflow:hidden;
  background:#000;color:#fff;
  --n:8;
  --tv-line:rgba(255,255,255,.28);--tv-soft:rgba(255,255,255,.14);--tv-dim:rgba(255,255,255,.55);--tv-fill:rgba(255,255,255,.4);
  font-family:var(--eg-archivo),sans-serif;
}
.eg .eg-tv *{box-sizing:border-box;min-width:0}
.eg .eg-tv b,.eg .eg-tv i{font-style:normal;font-weight:400}
.eg .tv-empty{height:100vh;display:grid;place-items:center;text-align:center;padding:6vw}
.eg .tv-empty b{display:block;font-family:var(--eg-black),sans-serif;font-size:7vh;line-height:1.05}
.eg .tv-empty span{display:block;margin-top:3vh;font-family:var(--eg-mono),monospace;font-size:2vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}

/* The head every full-width look shares. */
.eg .tv-head{display:flex;align-items:baseline;gap:2.4vw;border-bottom:.5vh solid #fff;padding-bottom:1.6vh}
.eg .tv-head .t{font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;letter-spacing:-.01em}
.eg .tv-head .m{font-family:var(--eg-mono),monospace;font-size:1.9vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-head .c{margin-left:auto;font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-eye{font-family:var(--eg-mono),monospace;font-size:1.7vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim)}

/* ---- the charts: an SVG each, drawn in viewBox units ------------------- */
.eg .tv-chart{display:block;width:100%;height:100%}
.eg .tv-chart .ax{stroke:var(--tv-line);stroke-width:1;vector-effect:non-scaling-stroke}
.eg .tv-chart .gr{stroke:var(--tv-soft);stroke-width:1;stroke-dasharray:3 4;vector-effect:non-scaling-stroke}
.eg .tv-chart .ln{fill:none;stroke:var(--tv-fill);stroke-width:1.6;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.eg .tv-chart .ln.lead{stroke:#fff;stroke-width:3}
.eg .tv-chart .lbl{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.1em;fill:var(--tv-dim);text-transform:uppercase}
.eg .tv-chart .bar{fill:var(--tv-fill)}
.eg .tv-chart .bar.now{fill:#fff}
.eg .tv-chart .bv{font-family:var(--eg-mono),monospace;font-size:11px;fill:#fff;text-anchor:middle}
.eg .tv-chart .dot{fill:#fff}

/* ---- the controls: shown while the pointer moves, hidden otherwise ----- */
.eg .eg-tv-ctl{
  position:fixed;left:50%;bottom:2.4vh;transform:translateX(-50%);z-index:2;
  display:flex;align-items:center;gap:8px;padding:8px;border-radius:4px;
  background:rgba(0,0,0,.82);border:1px solid var(--tv-line);
  opacity:0;pointer-events:none;transition:opacity .25s ease;
}
.eg .eg-tv.ctl .eg-tv-ctl{opacity:1;pointer-events:auto}
.eg .eg-tv-ctl .eg-btn{white-space:nowrap}
.eg .eg-tv-ctl .eg-btn.on{background:#fff;color:#000;border-color:#fff}
.eg .eg-tv-ctl .k{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim);padding:0 6px}

/* ==== LOOK A — THE BROADCAST ============================================ */
.eg .tv-c{height:100vh;display:grid;grid-template-columns:54vw minmax(0,1fr);--rowh:calc(82vh / var(--n))}
.eg .tv-c-hero{padding:4vh 3vw 3vh 4vw;display:flex;flex-direction:column;border-right:1px solid var(--tv-line);min-height:0}
.eg .tv-c-eyebrow{font-family:var(--eg-mono),monospace;font-size:2vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-c-hero h2{margin:1.2vh 0 0;font-family:var(--eg-black),sans-serif;font-weight:400;font-size:7vh;line-height:.98;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* THE CHARTS in the room the hero had to spare (owner, 2026-09-22: show
 * the pace chart on the left side, use that empty space to show some live
 * updating charts): the field on pace over metres, and the leader by
 * their splits. */
.eg .tv-c-charts{flex:1;min-height:0;display:grid;grid-template-rows:minmax(0,3fr) minmax(0,2fr);gap:2vh;margin-top:2.4vh}
.eg .tv-c-charts figure{margin:0;display:flex;flex-direction:column;min-height:0}
.eg .tv-c-charts figcaption{display:flex;justify-content:space-between;font-family:var(--eg-mono),monospace;font-size:1.6vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim);padding-bottom:.8vh}
.eg .tv-c-charts .tv-chart{flex:1;min-height:0}
.eg .tv-c-big{margin-top:2vh;display:flex;align-items:baseline;gap:1.6vw}
.eg .tv-c-big b{font-family:var(--eg-black),sans-serif;font-size:13vh;line-height:.9;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.eg .tv-c-big span{font-family:var(--eg-mono),monospace;font-size:2vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-c-bar{height:1.2vh;background:var(--tv-soft);margin-top:2vh;overflow:hidden}
.eg .tv-c-bar span{display:block;height:100%;background:#fff;transition:width .6s linear}
.eg .tv-c-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.4vw;margin-top:2.2vh;padding-top:2vh;border-top:1px solid var(--tv-line)}
.eg .tv-c-kv span{display:block;font-family:var(--eg-mono),monospace;font-size:1.6vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-c-kv b{display:block;margin-top:.8vh;font-family:var(--eg-black),sans-serif;font-size:4.2vh;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-c-list{padding:5vh 3vw 4vh;display:flex;flex-direction:column;min-height:0}
.eg .tv-c-lh{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--eg-mono),monospace;font-size:2vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim);padding-bottom:1.4vh;border-bottom:.4vh solid #fff}
.eg .tv-c-lh b{font-family:var(--eg-black),sans-serif;font-size:4.4vh;letter-spacing:-.01em;text-transform:none;color:#fff;font-variant-numeric:tabular-nums}
.eg .tv-c-list ol{list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;min-height:0}
/* The list bar is .tv-c-lbar, not .bar: the site sheet styles .bar as the
 * page header (padding, a rule, sticky) and it reached in here once. */
.eg .tv-c-list li{flex:1;min-height:0;max-height:14vh;overflow:hidden;display:grid;grid-template-columns:3.2vw minmax(0,1fr) auto;grid-template-rows:auto auto;gap:min(.6vh,calc(var(--rowh) * .06)) 1.4vw;align-items:end;align-content:center;border-bottom:1px solid var(--tv-line);padding:min(1.2vh,calc(var(--rowh) * .1)) 0}
.eg .tv-c-list li .p{grid-row:1 / 3;align-self:center;font-family:var(--eg-black),sans-serif;font-size:min(4.6vh,calc(var(--rowh) * .44));line-height:1;font-variant-numeric:tabular-nums;color:var(--tv-dim)}
.eg .tv-c-list li.lead .p{color:#fff}
.eg .tv-c-list li .nm{font-family:var(--eg-black),sans-serif;font-size:min(3.6vh,calc(var(--rowh) * .34));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-c-list li .g{font-family:var(--eg-black),sans-serif;font-size:min(3.6vh,calc(var(--rowh) * .34));line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.eg .tv-c-list li .g i{display:block;margin-top:.5vh;font-family:var(--eg-mono),monospace;font-size:min(1.4vh,calc(var(--rowh) * .15));letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim)}
.eg .dense .tv-c-list li .g i{display:none}
.eg .tv-c-list li .tv-c-lbar{grid-column:2 / 4;display:block;height:min(.8vh,calc(var(--rowh) * .08));background:var(--tv-soft);overflow:hidden}
.eg .tv-c-list li .tv-c-lbar span{display:block;height:100%;background:#fff;transition:width .6s linear}
.eg .tv-c-list li:not(.lead) .tv-c-lbar span{background:var(--tv-fill)}

/* ==== LOOK B — THE TOWER ================================================ */
.eg .tv-d{height:100vh;display:flex;flex-direction:column;padding:3vh 3.2vw 3vh;--rowh:calc(84vh / var(--n))}
.eg .tv-d-rows{list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;min-height:0}
.eg .tv-d-rows li{flex:1;max-height:16vh;display:grid;grid-template-columns:8vw minmax(0,1fr) 16vw 26vw 12vw;gap:0 1.6vw;align-items:center;border-bottom:1px solid var(--tv-line)}
.eg .tv-d-rows li.lead{background:#fff;color:#000;border-bottom-color:#fff;padding:0 1vw;margin:0 -1vw}
.eg .tv-d-rows li.lead .u,.eg .tv-d-rows li.lead .pc,.eg .tv-d-rows li.lead .pc i{color:rgba(0,0,0,.6)}
.eg .tv-d-rows .p{font-family:var(--eg-black),sans-serif;font-size:min(7vh,calc(var(--rowh) * .66));line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-d-rows .nm{font-family:var(--eg-black),sans-serif;font-size:min(4.2vh,calc(var(--rowh) * .42));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-d-rows .pc{font-family:var(--eg-black),sans-serif;font-size:min(3.4vh,calc(var(--rowh) * .34));line-height:1;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.eg .tv-d-rows .pc i{display:block;margin-top:.5vh;font-family:var(--eg-mono),monospace;font-size:min(1.4vh,calc(var(--rowh) * .15));letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim)}
.eg .dense .tv-d-rows .pc i{display:none}
.eg .tv-d-rows .gap{font-family:var(--eg-black),sans-serif;font-size:min(7vh,calc(var(--rowh) * .66));line-height:1;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.eg .tv-d-rows .u{font-family:var(--eg-mono),monospace;font-size:min(1.7vh,calc(var(--rowh) * .18));letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim);text-align:left;padding-left:.4vw}

/* ==== LOOK C — THE CHART ================================================= */
.eg .tv-f{height:100vh;display:flex;flex-direction:column;padding:3vh 3.2vw 3vh;--rowh:calc(78vh / var(--n))}
.eg .tv-f-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 26vw;gap:3vw;padding-top:2vh}
.eg .tv-f-plot{display:flex;flex-direction:column;min-height:0}
.eg .tv-f-plot figcaption{display:flex;justify-content:space-between;font-family:var(--eg-mono),monospace;font-size:1.7vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim);padding-bottom:1vh}
.eg .tv-f-plot .tv-chart{flex:1;min-height:0}
.eg .tv-f-key{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;min-height:0}
.eg .tv-f-key li{flex:1;max-height:12vh;display:grid;grid-template-columns:2.4vw minmax(0,1fr) auto;gap:0 1vw;align-items:center;border-bottom:1px solid var(--tv-line)}
.eg .tv-f-key li.lead .nm,.eg .tv-f-key li.lead .p{color:#fff}
.eg .tv-f-key .p{font-family:var(--eg-black),sans-serif;font-size:min(3.2vh,calc(var(--rowh) * .4));line-height:1;color:var(--tv-dim);font-variant-numeric:tabular-nums}
.eg .tv-f-key .nm{font-family:var(--eg-black),sans-serif;font-size:min(2.8vh,calc(var(--rowh) * .36));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--tv-dim)}
.eg .tv-f-key .v{font-family:var(--eg-black),sans-serif;font-size:min(3vh,calc(var(--rowh) * .38));line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}

/* ==== LOOK D — THE PODIUM ================================================ */
.eg .tv-g{height:100vh;display:flex;flex-direction:column;padding:3vh 3.2vw 3vh;--rowh:calc(30vh / max(1, var(--n) - 3))}
.eg .tv-g-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2vw;margin-top:2.4vh;align-items:end}
.eg .tv-g-step{border-top:.5vh solid #fff;padding:2vh 1.6vw 2.4vh;display:flex;flex-direction:column;gap:1vh;min-height:0}
.eg .tv-g-step.first{background:#fff;color:#000;border-top-color:#fff;padding-top:3vh}
.eg .tv-g-step.first .tv-eye,.eg .tv-g-step.first .k{color:rgba(0,0,0,.6)}
.eg .tv-g-step .p{font-family:var(--eg-black),sans-serif;font-size:8vh;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.eg .tv-g-step.first .p{font-size:12vh}
.eg .tv-g-step .nm{font-family:var(--eg-black),sans-serif;font-size:4.2vh;line-height:1.02;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-g-step .big{margin-top:1vh;font-family:var(--eg-black),sans-serif;font-size:7vh;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.eg .tv-g-step.first .big{font-size:9vh}
.eg .tv-g-step .kv{display:grid;grid-template-columns:1fr 1fr;gap:1vw;margin-top:1vh}
.eg .tv-g-step .kv b{display:block;font-family:var(--eg-black),sans-serif;font-size:3.2vh;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.eg .tv-g-step .kv .k{display:block;font-family:var(--eg-mono),monospace;font-size:1.4vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim);margin-top:.5vh}
.eg .tv-g-rest{list-style:none;margin:2.4vh 0 0;padding:0;flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;column-gap:3vw;grid-auto-rows:minmax(0,1fr);align-content:start}
.eg .tv-g-rest li{display:grid;grid-template-columns:3vw minmax(0,1fr) auto;gap:0 1vw;align-items:center;border-bottom:1px solid var(--tv-line);min-height:0;max-height:8vh}
.eg .tv-g-rest .p{font-family:var(--eg-black),sans-serif;font-size:min(3.2vh,calc(var(--rowh) * .5));line-height:1;color:var(--tv-dim);font-variant-numeric:tabular-nums}
.eg .tv-g-rest .nm{font-family:var(--eg-black),sans-serif;font-size:min(2.8vh,calc(var(--rowh) * .44));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-g-rest .v{font-family:var(--eg-black),sans-serif;font-size:min(3vh,calc(var(--rowh) * .46));line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}

/* ==== LOOK E — THE GAPS ================================================== */
.eg .tv-h{height:100vh;display:flex;flex-direction:column;padding:3vh 3.2vw 3vh;--rowh:calc(82vh / var(--n))}
.eg .tv-h-rows{list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;min-height:0;padding-top:1vh}
.eg .tv-h-rows li{flex:1;max-height:15vh;display:grid;grid-template-columns:6vw 22vw minmax(0,1fr) 16vw;gap:0 1.4vw;align-items:center;border-bottom:1px solid var(--tv-line)}
.eg .tv-h-rows .p{font-family:var(--eg-black),sans-serif;font-size:min(6vh,calc(var(--rowh) * .6));line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-h-rows .nm{font-family:var(--eg-black),sans-serif;font-size:min(3.6vh,calc(var(--rowh) * .38));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-h-rows .trk{position:relative;height:min(4vh,calc(var(--rowh) * .5));background:var(--tv-soft);overflow:hidden}
.eg .tv-h-rows .trk span{position:absolute;left:0;top:0;bottom:0;background:var(--tv-fill);transition:width .6s linear}
.eg .tv-h-rows li.lead .trk span{background:#fff}
.eg .tv-h-rows .g{font-family:var(--eg-black),sans-serif;font-size:min(5vh,calc(var(--rowh) * .55));line-height:1;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.eg .tv-h-rows .g i{display:block;margin-top:.5vh;font-family:var(--eg-mono),monospace;font-size:min(1.5vh,calc(var(--rowh) * .15));letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim)}
.eg .dense .tv-h-rows .g i{display:none}
`;
