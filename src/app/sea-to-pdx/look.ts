/* SEA TO PDX, on top of the relay kit (src/components/foodrelay/theme.ts):
 * the strip chart (.s-), the list of legs and the street map (.sp-). Kept
 * beside the page so the three food pages do not carry rules they never
 * use. Appended to the kit's stylesheet inside one style tag, under the
 * same .fr scope and the same rule: no double quotes, no apostrophes, no
 * angle brackets and no ampersands in this string.
 *
 * Leaflet's stylesheet loads before the kit's, and the kit hands every
 * descendant margin 0, padding 0 and the body face. The few Leaflet
 * controls this page shows (zoom, credit, tooltip) get theirs back at the
 * foot of this string. */

export const seaCss = `
.fr .fr-art svg.sp-ticket{max-width:270px;transform:rotate(-9deg)}
@media (max-width:860px){.fr .fr-art svg.sp-ticket{max-width:96px}}

/* THE ROUTE: the strip beside its legs. On a wide screen the strip is
 * sized to the height of the window and rides along while the legs scroll
 * past it, so the whole line is always in view. The kit clips the page
 * sideways with overflow-x hidden, which would make the page root the
 * scroller the strip sticks to (and it never scrolls): clip does the same
 * job without that. */
.fr.fr-seapdx{overflow-x:clip}
.fr .sp-route{display:grid;grid-template-columns:auto minmax(0,1fr);gap:34px;align-items:start;margin-top:32px}
.fr .sp-stick{position:sticky;top:14px}
.fr .sp-stick .fr-map svg{width:auto;height:max(calc(100vh - 40px),700px);max-height:1180px}
@media (max-width:980px){
  .fr .sp-route{grid-template-columns:1fr;gap:26px}
  .fr .sp-stick{position:static}
  .fr .sp-stick .fr-map svg{width:100%;height:auto;max-height:none}
}
.fr .s-water{fill:#cde3e8}
.fr .s-land{fill:var(--paper);stroke:rgba(28,26,23,.22);stroke-width:1.5;stroke-linejoin:round}
.fr .s-lake{fill:#cde3e8;stroke:rgba(28,26,23,.22);stroke-width:1.5;stroke-linejoin:round}
.fr .s-river{fill:none;stroke:#a6cdd7;stroke-linecap:round;stroke-linejoin:round}
.fr .s-i5{fill:none;stroke:rgba(28,26,23,.17);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.fr .s-shield rect{fill:var(--paper);stroke:rgba(28,26,23,.42);stroke-width:2}
.fr .s-shield text{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:25px;fill:rgba(28,26,23,.62);text-anchor:middle;dominant-baseline:central}
.fr .s-area{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:27px;letter-spacing:.22em;fill:#8f8a80}
.fr .s-area.sm{font-size:22px;letter-spacing:.14em}
.fr .s-wet{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:600;font-size:26px;letter-spacing:.06em;fill:#4f8795}
.fr .s-peak path{fill:#ddd6c6;stroke:rgba(28,26,23,.5);stroke-width:2.5;stroke-linejoin:round}
.fr .s-peak path.snow{fill:#ffffff;stroke-width:2}
.fr .s-case{fill:none;stroke:var(--paper);stroke-width:16;stroke-linecap:round;stroke-linejoin:round}
.fr .s-route{fill:none;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}
.fr .s-dot{fill:var(--paper);stroke:var(--ink);stroke-width:4}
.fr .s-dot.start{fill:var(--a);stroke-width:5}
.fr .s-dot.finish{fill:var(--c);stroke-width:5}
.fr .s-name{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:40px;fill:var(--ink);paint-order:stroke;stroke:var(--paper);stroke-width:8px;stroke-linejoin:round}
.fr .s-name .mi{font-style:normal;font-weight:700;font-size:28px;letter-spacing:.04em;fill:var(--b)}
.fr .s-tag{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:25px;letter-spacing:.1em;fill:var(--b);paint-order:stroke;stroke:var(--paper);stroke-width:7px;stroke-linejoin:round}
.fr .s-scale line{stroke:var(--ink);stroke-width:3}
.fr .s-scale text,.fr .s-key{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:23px;letter-spacing:.12em;fill:var(--ink)}
.fr .s-key{fill:var(--b)}
/* A phone shows the sheet at a third of its drawn size: the small type
 * steps up so it is still type. The labels all hang off the right of
 * their dots, so they grow into the margin kept for them. */
@media (max-width:640px){
  .fr .s-name{font-size:45px;stroke-width:9px}
  .fr .s-name .mi{font-size:33px}
  .fr .s-tag{font-size:30px}
  .fr .s-area{font-size:31px}
  .fr .s-area.sm{font-size:28px}
  .fr .s-wet{font-size:31px}
  .fr .s-scale text,.fr .s-key{font-size:29px}
  .fr .s-route{stroke-width:9}
}

/* THE LEGS */
.fr .sp-legs{list-style:none;border:2px solid var(--ink);border-radius:16px;background:var(--paper);overflow:hidden}
.fr .sp-legs li{display:grid;grid-template-columns:42px minmax(0,1fr) auto;column-gap:14px;align-items:start;padding:13px 16px 13px 12px;border-top:2px solid var(--rule)}
.fr .sp-legs li:first-child{border-top:0}
.fr .sp-legs .n{width:42px;height:42px;border-radius:50%;border:2px solid var(--ink);background:var(--a);color:#ffffff;display:flex;align-items:center;justify-content:center;font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:20px;line-height:1}
.fr .sp-legs .n.or{background:var(--b)}
.fr .sp-legs .name{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:23px;line-height:1.05}
.fr .sp-legs .name i{font-style:normal;font-weight:700;color:var(--mute);padding:0 3px}
.fr .sp-legs .via{font-size:15px;line-height:1.35;color:var(--dim);margin-top:3px}
.fr .sp-legs .meta{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.07em;font-size:13px;line-height:1.45;color:var(--mute);margin-top:4px}
.fr .sp-legs .mi{text-align:right;white-space:nowrap;font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:13px;line-height:1.2;color:var(--dim)}
.fr .sp-legs .mi b{display:block;font-style:italic;font-weight:800;font-size:27px;line-height:1;color:var(--ink);letter-spacing:0}
.fr .sp-legs svg{display:block;width:92px;height:26px;margin-top:7px;margin-left:auto;overflow:visible}
.fr .sp-legs .sk-a{fill:var(--a);opacity:.16}
.fr .sp-legs .sk-l{fill:none;stroke:var(--a);stroke-width:2;stroke-linejoin:round;vector-effect:non-scaling-stroke}
@media (max-width:420px){
  .fr .sp-legs li{grid-template-columns:36px minmax(0,1fr) auto;column-gap:10px;padding:12px 12px 12px 10px}
  .fr .sp-legs .n{width:36px;height:36px;font-size:17px}
  .fr .sp-legs .name{font-size:21px}
  .fr .sp-legs svg{width:70px}
}

.fr .sp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* THE WHOLE LINE, PROFILE WIDE */
.fr .sp-wide{margin-top:34px}
.fr .sp-wide .fr-profile{margin-top:0}

/* THE STREET MAP */
.fr .sp-street{margin-top:28px;border:2px solid var(--ink);border-radius:16px;overflow:hidden;background:var(--paper);box-shadow:6px 6px 0 var(--ink);scroll-margin-top:14px}
.fr .sp-street-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:11px 12px;border-bottom:2px solid var(--ink)}
.fr .sp-street-bar .what{flex:1 1 260px;min-width:0;font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:22px;line-height:1.05}
.fr .sp-street-bar .what small{display:block;font-style:normal;font-weight:700;font-size:13px;letter-spacing:.08em;line-height:1.35;color:var(--dim);margin-top:3px}
.fr .sp-street-bar button{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:14px;line-height:1;padding:10px 12px;border:2px solid var(--ink);border-radius:10px;background:var(--paper);color:var(--ink);cursor:pointer;white-space:nowrap}
.fr .sp-street-bar button:disabled{opacity:.38;cursor:default}
.fr .sp-street-bar button.on{background:var(--ink);color:#ffffff;opacity:1}
.fr .sp-street-map{position:relative;height:min(74vh,660px);min-height:440px;background:#e9e5da}
.fr .sp-street-map .wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 24px;text-align:center;font-family:var(--fr-display),Impact,sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:15px;color:var(--dim)}

/* THREE LINES OF RULES */
.fr .sp-rules{list-style:none;margin-top:26px;border-top:2px solid var(--ink)}
.fr .sp-rules li{display:grid;grid-template-columns:64px minmax(0,1fr);column-gap:8px;align-items:baseline;padding:16px 0;border-bottom:2px solid var(--rule)}
.fr .sp-rules .n{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:44px;line-height:.9;color:var(--a)}
.fr .sp-rules p{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:clamp(24px,3.4vw,34px);line-height:1.02;max-width:32ch}
.fr .sp-small{font-size:14px;line-height:1.55;color:var(--mute);margin-top:18px;max-width:86ch}

/* LEAFLET, GIVEN BACK WHAT THE KIT TOOK */
.fr .leaflet-container{background:#e9e5da;font-size:12px}
.fr .leaflet-tile-pane{filter:saturate(.5) contrast(.95) brightness(1.03)}
.fr .leaflet-bar a{text-decoration:none;color:#1c1a17}
.fr .leaflet-bar a:hover{color:#1c1a17}
.fr .leaflet-control-attribution{padding:1px 6px;font-size:11px;line-height:1.4}
.fr .leaflet-control-attribution a{text-decoration:none}
.fr .leaflet-tooltip{padding:4px 9px;border:2px solid #1c1a17;border-radius:8px;box-shadow:none;color:#1c1a17;font-family:var(--fr-display),Impact,sans-serif;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:14px;line-height:1.2}
.fr .leaflet-tooltip::before{display:none}
`;
