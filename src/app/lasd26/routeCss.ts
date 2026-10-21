/* /lasd26/route — the course on the cream paper (owner, 2026-10-16: "embed
 * this route into the site, make it the same color scheme as the rest of
 * the site"). Passed through LasdPage's extraCss; every rule sits under
 * .lasd26 .rt-* (and the MapLibre classes under .lasd26) so nothing leaks
 * into the other pages. The map takes the whole width, 60vh on a phone;
 * the route is the lime over an ink casing, the drive a dashed ink line
 * along the road; popups and the attribution are redrawn as paper, ink and
 * mono. Type and thin borders on the paper use --safety-ink, never the lime
 * (theme.ts). */

export const routeCss = `
/* The head sits right on the map: no intro under it (owner, 2026-10-16:
 * "Remove the copy at the top of the routes page"), and its rule IS the
 * map's top rule, so the two 2 px lines do not stack. */
.lasd26 .rt-top{padding:36px 0 0}
.lasd26 .rt-top .sec-head{margin-bottom:0;border-bottom:none;padding-bottom:12px}

/* THE MAP — full width, between two ink rules. scroll-margin keeps the
 * sticky bar off it when a tap on the list scrolls it into view. */
.lasd26 .rt-map{position:relative;height:60vh;height:60dvh;min-height:320px;max-height:720px;background:#e9e8e1;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);scroll-margin-top:120px}
/* The stage is what goes full screen: the map, the buttons and the notes
 * together, so they all come along. */
.lasd26 .rt-stage{position:absolute;inset:0;background:#e9e8e1}
.lasd26 .rt-stage .map-el{position:absolute;inset:0}
.lasd26 .rt-map canvas{outline:none}
.lasd26 .rt-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 20px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.lasd26 .rt-notes{position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:6px;max-width:calc(100% - 84px);pointer-events:none}
.lasd26 .rt-note{background:var(--paper);border:2px solid var(--ink);padding:5px 9px;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase}

/* THE BUTTONS on the map, top right (owner, 2026-10-16: "Show the user's
 * location on the map", "Give a button to full screen the map"): 44 px
 * squares of paper with an ink border and the landing's hard shadow.
 * LOCATE following = ink with the lime crosshair; watching but let go of =
 * paper with the deep-green crosshair. In full screen the button turns
 * into CLOSE and grows a word. */
.lasd26 .rt-ctl{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:8px;z-index:2}
.lasd26 .rt-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:44px;min-height:44px;padding:0;border:2px solid var(--ink);border-radius:0;background:var(--paper);color:var(--ink);box-shadow:3px 3px 0 rgba(17,17,16,.18);cursor:pointer;font-family:var(--lasd-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.lasd26 .rt-btn svg{display:block;flex:none}
.lasd26 .rt-btn:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .rt-btn.fs.is-on{padding:0 12px 0 10px;background:var(--ink);color:var(--safety)}
.lasd26 .rt-btn.fs.is-on:hover{background:var(--safety-ink);color:var(--paper)}
.lasd26 .rt-btn.locate[data-state=watch]{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .rt-btn.locate[data-state=follow]{background:var(--ink);color:var(--safety);border-color:var(--ink)}
/* NORTH (owner, 2026-10-16: "Let me rotate it"): under LOCATE, only while
 * the map is turned — the [hidden] attribute needs saying, since .rt-btn's
 * display would beat the browser's own rule. The needle's dark half points
 * north. */
.lasd26 .rt-btn[hidden]{display:none}
.lasd26 .rt-btn.compass{color:var(--ink)}
/* THE VAN (owner, 2026-10-21): team only; ink with the lime van once a pin
 * is down. The ask under the notes takes taps (the notes column does not). */
.lasd26 .rt-btn.van[data-state=set]{background:var(--ink);color:var(--safety);border-color:var(--ink)}
.lasd26 .rt-btn.van[data-state=set]:hover{background:var(--safety-ink);color:var(--paper);border-color:var(--safety-ink)}
.lasd26 .rt-ask{pointer-events:auto;background:var(--paper);border:2px solid var(--ink);box-shadow:3px 3px 0 rgba(17,17,16,.18);padding:10px 12px;max-width:260px}
.lasd26 .rt-ask .q{font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.lasd26 .rt-ask .acts{display:flex;flex-wrap:wrap;gap:6px}
/* A small square button: the ask's PIN / CLEAR / CANCEL, the pace row's
 * EDIT, the form's SAVE / CANCEL. 36 px — a thumb still finds it. */
.lasd26 .rt-mini{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:2px solid var(--ink);border-radius:0;background:var(--paper);color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:0 12px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.lasd26 .rt-mini.fill{background:var(--ink);color:var(--safety)}
.lasd26 .rt-mini:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .rt-mini.fill:hover{background:var(--safety-ink);color:var(--paper);border-color:var(--safety-ink)}
.lasd26 .rt-mini:disabled{opacity:.5;cursor:default}

/* FULL SCREEN. The API way: the browser pins the stage itself; keep the
 * paper behind the tiles and the box from clipping. The CSS way (iPhone
 * Safari): the stage is fixed over the whole viewport, above the sticky bar
 * (z 50) and the account menu (z 60); the buttons drop under the notch. */
.lasd26 .rt-stage:fullscreen{background:#e9e8e1}
.lasd26 .rt-stage.is-fs{position:fixed;inset:0;z-index:100;height:100vh;height:100dvh}
.lasd26 .rt-stage.is-fs .rt-ctl{top:calc(12px + env(safe-area-inset-top,0px));right:calc(12px + env(safe-area-inset-right,0px))}
.lasd26 .rt-stage.is-fs .rt-notes{top:calc(12px + env(safe-area-inset-top,0px));left:calc(12px + env(safe-area-inset-left,0px))}

/* START / FINISH: ink tags with lime type, the finish inverted. */
.lasd26 .rt-mk{font-family:var(--lasd-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.14em;background:var(--ink);color:var(--safety);border:2px solid var(--ink);padding:4px 7px 3px;white-space:nowrap;box-shadow:3px 3px 0 rgba(17,17,16,.18);cursor:default;user-select:none}
.lasd26 .rt-mk.finish{background:var(--safety);color:#111}
/* The VAN tag over its dot: paper, a tap opens who / when / where. */
.lasd26 .rt-mk.van{background:var(--paper);color:var(--ink);cursor:pointer}
.lasd26 .rt-mk.van:hover{color:var(--safety-ink);border-color:var(--safety-ink)}
/* MapLibre's popup and attribution, in the site's clothes. */
.lasd26 .maplibregl-popup{max-width:260px!important}
.lasd26 .maplibregl-popup-content{background:var(--paper);color:var(--ink);border:2px solid var(--ink);border-radius:0;box-shadow:4px 4px 0 rgba(17,17,16,.16);padding:8px 12px;font-family:var(--lasd-mono),monospace;font-size:12px;line-height:1.5}
.lasd26 .maplibregl-popup-content .m{color:var(--safety-ink);font-weight:700;letter-spacing:.08em;margin-right:8px}
.lasd26 .maplibregl-popup-content .a{display:block;color:var(--gray);font-size:11px;margin-top:2px}
.lasd26 .maplibregl-popup-anchor-bottom .maplibregl-popup-tip,.lasd26 .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,.lasd26 .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip{border-top-color:var(--ink)}
.lasd26 .maplibregl-popup-anchor-top .maplibregl-popup-tip,.lasd26 .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,.lasd26 .maplibregl-popup-anchor-top-right .maplibregl-popup-tip{border-bottom-color:var(--ink)}
.lasd26 .maplibregl-popup-anchor-left .maplibregl-popup-tip{border-right-color:var(--ink)}
.lasd26 .maplibregl-popup-anchor-right .maplibregl-popup-tip{border-left-color:var(--ink)}
.lasd26 .maplibregl-ctrl-attrib{background:rgba(244,243,238,.85)!important;font-family:var(--lasd-archivo),sans-serif;font-size:10px;color:var(--ink-soft)}
.lasd26 .maplibregl-ctrl-attrib a{color:var(--ink-soft)}
.lasd26 .maplibregl-ctrl-bottom-left{bottom:0}

/* THE CHIP at the foot of the page, after the turn list: the Google Maps
 * door (owner, 2026-10-16: "Move the open in google maps button to the
 * bottom of the page after the turn by turn"). 44 px tall — thumbs in a van. */
.lasd26 .rt-chips{display:flex;flex-wrap:wrap;gap:8px;padding:28px 0 56px}
.lasd26 .rt-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;border:2px solid var(--ink);background:transparent;color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:9px 14px;cursor:pointer;text-decoration:none}
.lasd26 .rt-chip:hover{border-color:var(--safety-ink);color:var(--safety-ink)}

/* The profile: lime under an ink line, the drive a dashed tick. */
.lasd26 .rt-profile{margin-top:30px}
.lasd26 .rt-profile svg{display:block;width:100%;height:auto;border-bottom:2px solid var(--ink)}
.lasd26 .rt-profile .k{display:flex;justify-content:space-between;gap:12px;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-top:6px}

.lasd26 .rt-sec{padding:40px 0 0}
/* THE LIST: one row per call — the mile in mono, deep green, then the
 * instruction; a tap flies the map there. The van row is the ink block
 * the landing's race day wears. */
.lasd26 .rt-list{list-style:none;border-top:2px solid var(--ink)}
.lasd26 .rt-row{border-bottom:1px dashed var(--line)}
.lasd26 .rt-row button{display:flex;align-items:flex-start;gap:12px;width:100%;min-height:48px;text-align:left;background:none;border:none;padding:11px 0;cursor:pointer;color:inherit;font:inherit}
.lasd26 .rt-row .mi{flex:none;width:52px;font-family:var(--lasd-mono),monospace;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--safety-ink);text-align:right;padding-top:2px}
.lasd26 .rt-row .tx{font-size:15px;line-height:1.4;min-width:0}
.lasd26 .rt-row .tx small{display:block;font-family:var(--lasd-mono),monospace;font-size:11px;color:var(--gray);margin-top:2px;letter-spacing:.02em;line-height:1.6}
.lasd26 .rt-row button:hover .tx{color:var(--safety-ink)}
.lasd26 .rt-row.is-on{box-shadow:inset 4px 0 0 var(--safety)}
.lasd26 .rt-row.is-on button{padding-left:12px}
.lasd26 .rt-row.start .tx,.lasd26 .rt-row.finish .tx,.lasd26 .rt-row.restart .tx{font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.lasd26 .rt-row.drive{background:#111;color:#F4F3EE;margin:0 -20px;padding:0 20px;border-bottom:none}
.lasd26 .rt-row.drive .mi{color:var(--safety)}
.lasd26 .rt-row.drive .tx{font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.lasd26 .rt-row.drive .tx small{color:#c9c8c0;text-transform:none;font-weight:400;letter-spacing:.02em}
.lasd26 .rt-row.drive button:hover .tx{color:var(--safety)}
.lasd26 .rt-row.drive.is-on{box-shadow:inset 4px 0 0 var(--safety)}

/* THE ETAs (owner, 2026-10-21: "etas added to the route page … on the turn
 * by turn area … an expected finish time at the bottom"). The PACE row over
 * the list says what the times run on — PLANNED at the default pace, or
 * FROM THE VAN once a check-in counts — with EDIT for the team; each call
 * carries its clock time at the right in mono; a call the clock has passed
 * goes grey; the van's own row is a lime block where it sits in the list;
 * EXPECTED FINISH is a boxed figure under the list. */
.lasd26 .rt-pace{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);padding:0 0 12px;margin-top:-8px}
.lasd26 .rt-pace b{color:var(--safety-ink);font-weight:700}
.lasd26 .rt-pace .note{flex:0 0 100%;color:var(--gray);text-transform:none;letter-spacing:.02em}
.lasd26 .rt-pace .rt-mini{margin-left:auto;min-height:32px}
.lasd26 .rt-eta-form{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;border:2px solid var(--ink);padding:14px;margin-bottom:14px}
.lasd26 .rt-eta-form label{display:flex;flex-direction:column;gap:6px;min-width:0}
.lasd26 .rt-eta-form .k{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
/* 16 px so an iPhone does not zoom into the field. */
.lasd26 .rt-eta-form input{width:100%;min-height:44px;border:none;border-bottom:2px solid var(--ink);background:transparent;font-family:var(--lasd-mono),monospace;font-size:16px;padding:6px 2px;border-radius:0;appearance:none;color:var(--ink)}
.lasd26 .rt-eta-form input:focus{outline:none;border-bottom-color:var(--safety-ink)}
.lasd26 .rt-eta-form .acts{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.lasd26 .rt-eta-form .err{font-size:11px;color:var(--safety-ink)}
@media(max-width:520px){ .lasd26 .rt-eta-form{grid-template-columns:1fr 1fr} }
.lasd26 .rt-row .eta{flex:none;margin-left:auto;font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink);padding-top:3px;white-space:nowrap;text-align:right}
.lasd26 .rt-row.drive .eta{color:var(--safety)}
.lasd26 .rt-row.passed .eta,.lasd26 .rt-row.passed .mi,.lasd26 .rt-row.passed .tx{color:var(--gray)}
.lasd26 .rt-row.van{background:var(--safety);color:#111;margin:0 -20px;padding:0 20px;border-bottom:none}
.lasd26 .rt-row.van .mi,.lasd26 .rt-row.van .eta{color:#111}
.lasd26 .rt-row.van .tx{font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.lasd26 .rt-row.van .tx small{color:#2f3a16;text-transform:none;font-weight:400;letter-spacing:.02em}
.lasd26 .rt-row.van button:hover .tx{color:var(--safety-ink)}
.lasd26 .rt-finish{border:2px solid var(--ink);margin-top:24px;padding:18px 20px}
.lasd26 .rt-finish .k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.lasd26 .rt-finish .n{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(34px,9vw,58px);line-height:1;margin-top:6px;font-variant-numeric:tabular-nums;text-transform:uppercase}
.lasd26 .rt-finish .s{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-top:10px;line-height:1.7}
/* The Google Maps chip (.rt-chips, above) is the last thing on the page
 * before the footer's rule; its 56 px bottom padding is the breathing room. */

@media(min-width:960px){
  .lasd26 .rt-map{height:540px}
}
`;
