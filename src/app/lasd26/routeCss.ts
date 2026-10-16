/* /lasd26/route — the course on the cream paper (owner, 2026-10-16: "embed
 * this route into the site, make it the same color scheme as the rest of
 * the site"). Passed through LasdPage's extraCss; every rule sits under
 * .lasd26 .rt-* (and the MapLibre classes under .lasd26) so nothing leaks
 * into the other pages. The map takes the whole width, 60vh on a phone;
 * the route is the lime over an ink casing, the drive a dashed ink line;
 * popups and the attribution are redrawn as paper, ink and mono. Type and
 * thin borders on the paper use --safety-ink, never the lime (theme.ts). */

export const routeCss = `
.lasd26 .rt-top{padding:36px 0 18px}
.lasd26 .rt-top .sec-head{margin-bottom:14px}
.lasd26 .rt-lede{font-size:15px;color:var(--ink-soft);max-width:60ch}
.lasd26 .rt-lede a{text-decoration:underline;text-underline-offset:3px}
.lasd26 .rt-lede a:hover{color:var(--safety-ink)}

/* THE MAP — full width, between two ink rules. scroll-margin keeps the
 * sticky bar off it when a tap on the list scrolls it into view. */
.lasd26 .rt-map{position:relative;height:60vh;height:60dvh;min-height:320px;max-height:720px;background:#e9e8e1;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);scroll-margin-top:120px}
.lasd26 .rt-map .map-el{position:absolute;inset:0}
.lasd26 .rt-map canvas{outline:none}
.lasd26 .rt-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 20px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.lasd26 .rt-note{position:absolute;left:12px;top:12px;max-width:70%;background:var(--paper);border:2px solid var(--ink);padding:5px 9px;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
/* START / FINISH: ink tags with lime type, the finish inverted. */
.lasd26 .rt-mk{font-family:var(--lasd-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.14em;background:var(--ink);color:var(--safety);border:2px solid var(--ink);padding:4px 7px 3px;white-space:nowrap;box-shadow:3px 3px 0 rgba(17,17,16,.18);cursor:default;user-select:none}
.lasd26 .rt-mk.finish{background:var(--safety);color:#111}
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

/* THE CHIPS under the map: the bathroom layer's switch and the Google Maps
 * door. 44 px tall — thumbs in a van. Pressed = ink with lime type. */
.lasd26 .rt-chips{display:flex;flex-wrap:wrap;gap:8px;padding:14px 0 0}
.lasd26 .rt-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;border:2px solid var(--ink);background:transparent;color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:9px 14px;cursor:pointer;text-decoration:none}
.lasd26 .rt-chip:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .rt-chip[aria-pressed=true]{background:var(--ink);color:var(--safety);border-color:var(--ink)}
.lasd26 .rt-chip .dot{width:10px;height:10px;border-radius:50%;background:var(--safety-ink);flex:none}
.lasd26 .rt-chip[aria-pressed=true] .dot{background:var(--safety)}

/* The profile: lime under an ink line, the drive a dashed tick. */
.lasd26 .rt-profile{margin-top:30px}
.lasd26 .rt-profile svg{display:block;width:100%;height:auto;border-bottom:2px solid var(--ink)}
.lasd26 .rt-profile .k{display:flex;justify-content:space-between;gap:12px;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-top:6px}

.lasd26 .rt-sec{padding:40px 0 0}
/* THE LISTS: one row per call — the mile in mono, deep green, then the
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
.lasd26 .rt-tag{display:inline-block;vertical-align:middle;font-family:var(--lasd-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;border:1.5px solid var(--safety-ink);color:var(--safety-ink);padding:1px 6px 0;margin-left:8px;line-height:1.5}
.lasd26 .rt-bhead{font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);padding:18px 0 6px}
.lasd26 .rt-after{font-family:var(--lasd-mono),monospace;font-size:12px;color:var(--ink-soft);margin-top:18px;letter-spacing:.02em}
.lasd26 .rt-src{font-family:var(--lasd-mono),monospace;font-size:11px;color:var(--gray);margin-top:14px;line-height:1.8}

@media(min-width:960px){
  .lasd26 .rt-map{height:540px}
}
`;
