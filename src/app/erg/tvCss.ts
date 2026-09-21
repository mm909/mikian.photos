/* THE TELEVISION SHEET (owner, 2026-09-21: "this will be on a full screen
 * monitor, give me a view that would go on a TV. Give me 3 different looks
 * for what this page could look like").
 *
 * Text child of a style tag: NO double quotes, apostrophes, angle brackets
 * or ampersands anywhere in here, comments included.
 *
 * EVERYTHING IS IN vh AND vw. A television is one fixed frame at one
 * distance, so the type is sized against the screen and not against the
 * pixel: a 4 k set and a 720p projector draw the same picture. Row heights
 * flex to fill the height, capped so two lanes do not become two slabs.
 *
 * THREE LOOKS, one root class each — .eg-tv-a, .eg-tv-b, .eg-tv-c — and
 * the strip of controls that shows only under the mouse, since a wall has
 * no mouse. */
export const tvCss = `
.eg .eg-tv{
  position:fixed;inset:0;z-index:60;overflow:hidden;
  background:#000;color:#fff;
  --tv-line:rgba(255,255,255,.28);--tv-soft:rgba(255,255,255,.14);--tv-dim:rgba(255,255,255,.55);--tv-fill:rgba(255,255,255,.4);
  font-family:var(--eg-archivo),sans-serif;
}
.eg .eg-tv *{box-sizing:border-box;min-width:0}
.eg .eg-tv b,.eg .eg-tv i{font-style:normal;font-weight:400}
.eg .tv-mono{font-family:var(--eg-mono),monospace;letter-spacing:.14em;text-transform:uppercase}
.eg .tv-black{font-family:var(--eg-black),sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.01em;line-height:1}
.eg .tv-empty{height:100vh;display:grid;place-items:center;text-align:center;padding:6vw}
.eg .tv-empty b{display:block;font-family:var(--eg-black),sans-serif;font-size:7vh;line-height:1.05}
.eg .tv-empty span{display:block;margin-top:3vh;font-family:var(--eg-mono),monospace;font-size:2vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}

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
.eg .tv-a{height:100vh;display:flex;flex-direction:column;padding:3vh 3.2vw 3vh}
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
.eg .tv-a-rows li.lead .s,.eg .tv-a-rows li.lead .tv-a-sub{color:rgba(0,0,0,.6)}
.eg .tv-a-rows .p{font-family:var(--eg-black),sans-serif;font-size:7.4vh;line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-a-rows .who{display:flex;flex-direction:column;gap:1.1vh}
.eg .tv-a-rows .nm{font-family:var(--eg-black),sans-serif;font-size:3.8vh;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-a-sub{font-family:var(--eg-mono),monospace;font-size:1.6vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-a-bar{display:block;height:1.1vh;background:var(--tv-soft);overflow:hidden}
.eg .tv-a-bar span{display:block;height:100%;background:#fff;transition:width .6s linear}
.eg .tv-a-rows .v{font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.eg .tv-a-rows .v .s{display:block;font-family:var(--eg-mono),monospace;font-size:1.5vh;letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim);margin-top:.9vh}
.eg .tv-a-rows .gap{font-size:4.2vh}

/* ==== LOOK B — THE LANES ================================================ */
.eg .tv-b{height:100vh;display:flex;flex-direction:column;padding:2.6vh 3vw 3vh;--tv-who:24vw;--tv-nums:15vw;--tv-gap:2vw}
.eg .tv-b-head{display:flex;align-items:baseline;gap:2vw;padding-bottom:1.2vh}
.eg .tv-b-head .t{font-family:var(--eg-black),sans-serif;font-size:4.6vh;line-height:1}
.eg .tv-b-head .m{font-family:var(--eg-mono),monospace;font-size:1.8vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-b-head .c{margin-left:auto;font-family:var(--eg-black),sans-serif;font-size:4.6vh;line-height:1;font-variant-numeric:tabular-nums}
.eg .tv-b-track{position:relative;flex:1;display:flex;flex-direction:column;min-height:0;padding-top:3.4vh}
/* The distance rules run behind every lane, over the run column only. */
.eg .tv-b-grid{position:absolute;top:0;bottom:0;left:calc(var(--tv-who) + var(--tv-gap));right:calc(var(--tv-nums) + var(--tv-gap));pointer-events:none}
.eg .tv-b-grid span{position:absolute;top:0;bottom:0;border-left:1px dashed var(--tv-line);transform:translateX(-.5px)}
.eg .tv-b-grid span b{position:absolute;top:0;left:.6vw;font-family:var(--eg-mono),monospace;font-size:1.7vh;letter-spacing:.14em;color:var(--tv-dim);white-space:nowrap}
.eg .tv-b-grid span.fin{border-left:.4vw solid #fff;transform:translateX(-.4vw)}
.eg .tv-b-grid span.fin b{left:auto;right:.6vw;color:#fff}
.eg .tv-b-grid span.zero{border-left-style:solid}
.eg .tv-b-lane{flex:1;max-height:15vh;display:grid;grid-template-columns:var(--tv-who) minmax(0,1fr) var(--tv-nums);gap:0 var(--tv-gap);align-items:center;position:relative}
.eg .tv-b-who{display:flex;align-items:center;gap:1.2vw;min-width:0}
.eg .tv-b-who b{font-family:var(--eg-black),sans-serif;font-size:5.4vh;line-height:1;font-variant-numeric:tabular-nums;width:2.2ch;flex:none}
.eg .tv-b-who span{font-family:var(--eg-black),sans-serif;font-size:3.2vh;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-b-run{position:relative;height:100%;min-height:6vh}
.eg .tv-b-fill{position:absolute;left:0;top:28%;bottom:28%;background:var(--tv-fill);transition:width .6s linear}
.eg .tv-b-lane.lead .tv-b-fill{background:#fff}
.eg .tv-b-lane.done .tv-b-fill{background:#fff}
.eg .tv-b-m{position:absolute;top:50%;transform:translate(.8vw,-50%);font-family:var(--eg-black),sans-serif;font-size:3.6vh;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;transition:left .6s linear}
.eg .tv-b-m.in{transform:translate(calc(-100% - .8vw),-50%);color:#000}
.eg .tv-b-lane:not(.lead):not(.done) .tv-b-m.in{color:#fff}
.eg .tv-b-nums{text-align:right;line-height:1}
.eg .tv-b-nums b{display:block;font-family:var(--eg-black),sans-serif;font-size:4.2vh;font-variant-numeric:tabular-nums}
.eg .tv-b-nums i{display:block;margin-top:.9vh;font-family:var(--eg-mono),monospace;font-size:1.7vh;letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim);white-space:nowrap}
.eg .tv-b-foot{display:grid;grid-template-columns:var(--tv-who) minmax(0,1fr) var(--tv-nums);gap:0 var(--tv-gap);padding-top:1.2vh;border-top:1px solid var(--tv-line);font-family:var(--eg-mono),monospace;font-size:1.6vh;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-b-foot span:last-child{text-align:right}

/* ==== LOOK C — THE BROADCAST ============================================ */
.eg .tv-c{height:100vh;display:grid;grid-template-columns:54vw minmax(0,1fr)}
.eg .tv-c-hero{padding:5vh 4vw 4vh;display:flex;flex-direction:column;border-right:1px solid var(--tv-line)}
.eg .tv-c-eyebrow{font-family:var(--eg-mono),monospace;font-size:2vh;letter-spacing:.18em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-c-hero h2{margin:1.6vh 0 0;font-family:var(--eg-black),sans-serif;font-weight:400;font-size:8.4vh;line-height:.98;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eg .tv-c-big{margin-top:auto;display:flex;align-items:baseline;gap:1.6vw}
.eg .tv-c-big b{font-family:var(--eg-black),sans-serif;font-size:22vh;line-height:.9;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
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
.eg .tv-c-list li{flex:1;max-height:14vh;display:grid;grid-template-columns:3.2vw minmax(0,1fr) auto;grid-template-rows:auto auto;gap:.6vh 1.4vw;align-items:end;border-bottom:1px solid var(--tv-line);padding:1.2vh 0}
.eg .tv-c-list li .p{grid-row:1 / 3;align-self:center;font-family:var(--eg-black),sans-serif;font-size:4.6vh;line-height:1;font-variant-numeric:tabular-nums;color:var(--tv-dim)}
.eg .tv-c-list li.lead .p{color:#fff}
.eg .tv-c-list li .nm{font-family:var(--eg-black),sans-serif;font-size:3.6vh;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eg .tv-c-list li .g{font-family:var(--eg-black),sans-serif;font-size:3.6vh;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.eg .tv-c-list li .g i{display:block;margin-top:.5vh;font-family:var(--eg-mono),monospace;font-size:1.4vh;letter-spacing:.14em;text-transform:uppercase;color:var(--tv-dim)}
.eg .tv-c-list li .bar{grid-column:2 / 4;display:block;height:.8vh;background:var(--tv-soft);overflow:hidden}
.eg .tv-c-list li .bar span{display:block;height:100%;background:#fff;transition:width .6s linear}
.eg .tv-c-list li:not(.lead) .bar span{background:var(--tv-fill)}
`;
