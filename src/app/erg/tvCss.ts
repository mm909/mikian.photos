/* THE TELEVISION SHEET (owner, 2026-09-21: "this will be on a full screen
 * monitor, give me a view that would go on a TV"; 2026-09-22: twelve
 * racers, five looks, a screen saver).
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
 * of controls that shows only under the mouse, since a wall has no mouse. */
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

/* The head every look shares the shape of. */
.eg .tv-head{display:flex;align-items:baseline;gap:2.4vw;padding-bottom:1.4vh}
.eg .tv-head .t{font-family:var(--eg-black),sans-serif;font-size:5vh;line-height:1;letter-spacing:-.01em}
.eg .tv-head .m{font-family:var(--eg-mono),monospace;font-size:1.8vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-head .c{margin-left:auto;font-family:var(--eg-black),sans-serif;font-size:5vh;line-height:1;font-variant-numeric:tabular-nums}

/* ---- the controls, under the mouse only ------------------------------- */
.eg .eg-tv-ctl{
  position:fixed;left:50%;bottom:2.4vh;transform:translateX(-50%);z-index:2;
  display:flex;align-items:center;gap:8px;padding:8px;border-radius:4px;
  background:rgba(0,0,0,.82);border:1px solid var(--tv-line);
  opacity:0;transition:opacity .18s ease;
}
.eg .eg-tv:hover .eg-tv-ctl,.eg .eg-tv-ctl:focus-within{opacity:1}
.eg .eg-tv-ctl .eg-btn{white-space:nowrap}
.eg .eg-tv-ctl .eg-btn.on{background:#fff;color:#000;border-color:#fff}
.eg .eg-tv-ctl .k{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim);padding:0 6px}

/* ==== LOOK A — THE SCOREBOARD =========================================== */
.eg .tv-a{height:100vh;display:flex;flex-direction:column;padding:3vh 3.2vw 3vh;--rowh:calc(82vh / var(--n))}
.eg .tv-a-head{display:flex;align-items:baseline;gap:2.4vw;border-bottom:.5vh solid #fff;padding-bottom:1.6vh}
.eg .tv-a-title{font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;letter-spacing:-.01em}
.eg .tv-a-meta{font-family:var(--eg-mono),monospace;font-size:1.9vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-a-clock{margin-left:auto;font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-a-cols,.eg .tv-a-rows li{display:grid;grid-template-columns:6vw minmax(0,1fr) 14vw 13vw 15vw 12vw;gap:0 1.6vw;align-items:center}
.eg .tv-a-cols{padding:1.4vh 0 1vh;font-family:var(--eg-mono),monospace;font-size:1.7vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-a-cols span:nth-child(n+3),.eg .tv-a-rows li .v{text-align:right}
.eg .tv-a-rows{list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;min-height:0}
.eg .tv-a-rows li{flex:1;max-height:21vh;border-top:1px solid var(--tv-line);padding:0 .6vw}
.eg .tv-a-rows li.lead{background:#fff;color:#000;border-top-color:#fff}
.eg .tv-a-rows li.lead .tv-a-bar{background:rgba(0,0,0,.18)}
.eg .tv-a-rows li.lead .tv-a-bar span{background:#000}
.eg .tv-a-rows li.lead .s{color:rgba(0,0,0,.6)}
.eg .tv-a-rows .p{font-family:var(--eg-black),sans-serif;font-size:min(7.4vh,calc(var(--rowh) * .62));line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-a-rows .who{display:flex;flex-direction:column;gap:min(1.1vh,calc(var(--rowh) * .1))}
.eg .tv-a-rows .nm{font-family:var(--eg-black),sans-serif;font-size:min(3.8vh,calc(var(--rowh) * .38));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-a-bar{display:block;height:min(1.1vh,calc(var(--rowh) * .09));background:var(--tv-soft);overflow:hidden}
.eg .tv-a-bar span{display:block;height:100%;background:#fff;transition:width .6s linear}
.eg .tv-a-rows .v{font-family:var(--eg-black),sans-serif;font-size:min(5.4vh,calc(var(--rowh) * .5));line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.eg .tv-a-rows .v .s{display:block;font-family:var(--eg-mono),monospace;font-size:min(1.5vh,calc(var(--rowh) * .14));letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim);margin-top:.9vh}
.eg .tv-a-rows .gap{font-size:min(4.2vh,calc(var(--rowh) * .42))}

/* ==== LOOK B — THE LANES ================================================ */
.eg .tv-b{height:100vh;display:flex;flex-direction:column;padding:2.6vh 3vw 3vh;--tv-who:24vw;--tv-nums:15vw;--tv-gap:2vw;--rowh:calc(82vh / var(--n))}
.eg .tv-b-head{display:flex;align-items:baseline;gap:2vw;padding-bottom:1.2vh}
.eg .tv-b-head .t{font-family:var(--eg-black),sans-serif;font-size:4.6vh;line-height:1}
.eg .tv-b-head .m{font-family:var(--eg-mono),monospace;font-size:1.8vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-b-head .c{margin-left:auto;font-family:var(--eg-black),sans-serif;font-size:4.6vh;line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-b-track{position:relative;flex:1;display:flex;flex-direction:column;min-height:0;padding-top:3.4vh}
.eg .tv-b-grid{position:absolute;top:0;bottom:0;left:calc(var(--tv-who) + var(--tv-gap));right:calc(var(--tv-nums) + var(--tv-gap));pointer-events:none}
.eg .tv-b-grid span{position:absolute;top:0;bottom:0;border-left:1px dashed var(--tv-line);transform:translateX(-.5px)}
.eg .tv-b-grid span b{position:absolute;top:0;left:.6vw;font-family:var(--eg-mono),monospace;font-size:1.7vh;letter-spacing:.14em;color:var(--tv-dim);white-space:nowrap}
.eg .tv-b-grid span.fin{border-left:.4vw solid #fff;transform:translateX(-.4vw)}
.eg .tv-b-grid span.fin b{left:auto;right:.6vw;color:#fff}
.eg .tv-b-grid span.zero{border-left-style:solid}
.eg .tv-b-lane{flex:1;max-height:15vh;display:grid;grid-template-columns:var(--tv-who) minmax(0,1fr) var(--tv-nums);gap:0 var(--tv-gap);align-items:center;position:relative}
.eg .tv-b-who{display:flex;align-items:center;gap:1.2vw;min-width:0}
.eg .tv-b-who b{font-family:var(--eg-black),sans-serif;font-size:min(5.4vh,calc(var(--rowh) * .6));line-height:1;font-variant-numeric:tabular-nums;width:2.2ch;flex:none}
.eg .tv-b-who span{font-family:var(--eg-black),sans-serif;font-size:min(3.2vh,calc(var(--rowh) * .36));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-b-run{position:relative;height:100%;min-height:4vh}
.eg .tv-b-fill{position:absolute;left:0;top:28%;bottom:28%;background:var(--tv-fill);transition:width .6s linear}
.eg .tv-b-lane.lead .tv-b-fill,.eg .tv-b-lane.done .tv-b-fill{background:#fff}
.eg .tv-b-m{position:absolute;top:50%;transform:translate(.8vw,-50%);font-family:var(--eg-black),sans-serif;font-size:min(3.6vh,calc(var(--rowh) * .4));line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;transition:left .6s linear}
.eg .tv-b-m.in{transform:translate(calc(-100% - .8vw),-50%);color:#000}
.eg .tv-b-lane:not(.lead):not(.done) .tv-b-m.in{color:#fff}
.eg .tv-b-nums{text-align:right;line-height:1}
.eg .tv-b-nums b{display:block;font-family:var(--eg-black),sans-serif;font-size:min(4.2vh,calc(var(--rowh) * .46));font-variant-numeric:tabular-nums}
.eg .tv-b-nums i{display:block;margin-top:.7vh;font-family:var(--eg-mono),monospace;font-size:min(1.7vh,calc(var(--rowh) * .17));letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim);white-space:nowrap}
.eg .dense .tv-b-nums i{display:none}
.eg .tv-b-foot{display:grid;grid-template-columns:var(--tv-who) minmax(0,1fr) var(--tv-nums);gap:0 var(--tv-gap);padding-top:1.2vh;border-top:1px solid var(--tv-line);font-family:var(--eg-mono),monospace;font-size:1.6vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-b-foot span:last-child{text-align:right}

/* ==== LOOK C — THE BROADCAST ============================================ */
/* The list bar is .tv-c-lbar, not .bar: the site sheet styles .bar as the
 * page header (padding, a rule, sticky) and it reached in here once. */
.eg .tv-c{height:100vh;display:grid;grid-template-columns:54vw minmax(0,1fr);--rowh:calc(82vh / var(--n))}
.eg .tv-c-hero{padding:5vh 4vw 4vh;display:flex;flex-direction:column;border-right:1px solid var(--tv-line)}
.eg .tv-c-eyebrow{font-family:var(--eg-mono),monospace;font-size:2vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-c-hero h2{margin:1.6vh 0 0;font-family:var(--eg-black),sans-serif;font-weight:400;font-size:8.4vh;line-height:.98;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eg .tv-c-big{margin-top:auto;display:flex;align-items:baseline;gap:1.6vw}
.eg .tv-c-big b{font-family:var(--eg-black),sans-serif;font-size:20vh;line-height:.9;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.eg .tv-c-big span{font-family:var(--eg-mono),monospace;font-size:2.2vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-c-bar{height:1.6vh;background:var(--tv-soft);margin-top:3vh;overflow:hidden}
.eg .tv-c-bar span{display:block;height:100%;background:#fff;transition:width .6s linear}
.eg .tv-c-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.4vw;margin-top:3.4vh;padding-top:2.6vh;border-top:1px solid var(--tv-line)}
.eg .tv-c-kv span{display:block;font-family:var(--eg-mono),monospace;font-size:1.7vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-c-kv b{display:block;margin-top:1vh;font-family:var(--eg-black),sans-serif;font-size:4.6vh;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-c-list{padding:5vh 3vw 4vh;display:flex;flex-direction:column;min-height:0}
.eg .tv-c-lh{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--eg-mono),monospace;font-size:2vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim);padding-bottom:1.4vh;border-bottom:.4vh solid #fff}
.eg .tv-c-lh b{font-family:var(--eg-black),sans-serif;font-size:4.4vh;letter-spacing:-.01em;text-transform:none;color:#fff;font-variant-numeric:tabular-nums}
.eg .tv-c-list ol{list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;min-height:0}
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

/* ==== LOOK D — THE TOWER ================================================ */
.eg .tv-d{height:100vh;display:flex;flex-direction:column;padding:3vh 3.2vw 3vh;--rowh:calc(84vh / var(--n))}
.eg .tv-d-head{display:flex;align-items:baseline;gap:2.4vw;border-bottom:.5vh solid #fff;padding-bottom:1.6vh}
.eg .tv-d-head .t{font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;letter-spacing:-.01em}
.eg .tv-d-head .m{font-family:var(--eg-mono),monospace;font-size:1.9vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-d-head .c{margin-left:auto;font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-d-rows{list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;min-height:0}
.eg .tv-d-rows li{flex:1;max-height:16vh;display:grid;grid-template-columns:8vw minmax(0,1fr) 14vw 26vw 12vw;gap:0 1.6vw;align-items:center;border-bottom:1px solid var(--tv-line)}
.eg .tv-d-rows li.lead{background:#fff;color:#000;border-bottom-color:#fff;padding:0 1vw;margin:0 -1vw}
.eg .tv-d-rows li.lead .u,.eg .tv-d-rows li.lead .pc{color:rgba(0,0,0,.6)}
.eg .tv-d-rows .p{font-family:var(--eg-black),sans-serif;font-size:min(7vh,calc(var(--rowh) * .66));line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-d-rows .nm{font-family:var(--eg-black),sans-serif;font-size:min(4.2vh,calc(var(--rowh) * .42));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-d-rows .pc{font-family:var(--eg-mono),monospace;font-size:min(2.4vh,calc(var(--rowh) * .26));letter-spacing:.08em;color:var(--tv-dim);text-align:right;font-variant-numeric:tabular-nums}
.eg .tv-d-rows .gap{font-family:var(--eg-black),sans-serif;font-size:min(7vh,calc(var(--rowh) * .66));line-height:1;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.eg .tv-d-rows .u{font-family:var(--eg-mono),monospace;font-size:min(1.7vh,calc(var(--rowh) * .18));letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim);text-align:left;padding-left:.4vw}

/* ==== LOOK E — THE SPLITS ================================================ */
.eg .tv-e{height:100vh;display:flex;flex-direction:column;padding:3vh 3.2vw 3vh;--rowh:calc(80vh / (var(--n) + 1))}
.eg .tv-e-head{display:flex;align-items:baseline;gap:2.4vw;border-bottom:.5vh solid #fff;padding-bottom:1.6vh}
.eg .tv-e-head .t{font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;letter-spacing:-.01em}
.eg .tv-e-head .m{font-family:var(--eg-mono),monospace;font-size:1.9vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-e-head .c{margin-left:auto;font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-e-grid{flex:1;display:flex;flex-direction:column;min-height:0;padding-top:1vh}
.eg .tv-e-row{flex:1;max-height:9vh;display:grid;grid-template-columns:4vw 18vw repeat(var(--cols),minmax(0,1fr));gap:0 .6vw;align-items:center;border-bottom:1px solid var(--tv-line)}
.eg .tv-e-row.lead{background:#fff;color:#000;border-bottom-color:#fff;padding:0 .6vw;margin:0 -.6vw}
.eg .tv-e-row.lead .cell{color:rgba(0,0,0,.6)}
.eg .tv-e-row.lead .cell.now,.eg .tv-e-row.lead .cell.live{color:#000}
.eg .tv-e-cols{flex:none;max-height:none;border-bottom:1px solid var(--tv-line);padding:1vh 0}
.eg .tv-e-cols .cell,.eg .tv-e-cols .nm{font-family:var(--eg-mono),monospace;font-size:1.6vh;letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-e-row .p{font-family:var(--eg-black),sans-serif;font-size:min(4vh,calc(var(--rowh) * .5));line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-e-row .nm{font-family:var(--eg-black),sans-serif;font-size:min(3vh,calc(var(--rowh) * .4));line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-e-row .cell{font-family:var(--eg-mono),monospace;font-size:min(3vh,calc(var(--rowh) * .42));font-variant-numeric:tabular-nums;text-align:center;color:var(--tv-dim);white-space:nowrap}
.eg .tv-e-row .cell.now{color:#fff;font-weight:700}
.eg .tv-e-row .cell.live{color:var(--tv-dim);font-style:italic;opacity:.8}
`;
