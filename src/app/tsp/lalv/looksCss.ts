/* TRIAL LOOKS (owner, 2026-11-16: "Lets try a few different looks … i want
 * a new look"). The route page reads ?look=a|b|c and puts look-<x> on the
 * frame; the switch under the map flips between them. When he picks, the
 * winner is folded into tspCss and this file goes. */

export const looksCss = `
.lasd26 .tsp-looks{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:14px 0 0;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.lasd26 .tsp-looks span{color:var(--gray);margin-right:4px}
.lasd26 .tsp-looks a{display:inline-flex;align-items:center;min-height:36px;padding:0 10px;border:2px solid var(--line);text-decoration:none;font-weight:700}
.lasd26 .tsp-looks a[aria-current=page]{border-color:var(--ink);background:var(--ink);color:var(--paper)}

/* A: MAP FIRST. The map is the screen, like a nav app: it runs from the
 * bar to the bottom of the phone, the status is a slim strip over its top
 * and the share switch a row over its foot. */
.lasd26.look-a .rt-map{height:calc(100vh - 102px);height:calc(100dvh - 102px);max-height:none;min-height:420px;border-top:none}
@media(min-width:960px){ .lasd26.look-a .rt-map{height:calc(100dvh - 58px)} }
.lasd26.look-a .tsp-over{position:absolute;left:10px;z-index:2;pointer-events:none}
.lasd26.look-a .tsp-over > *{pointer-events:auto}
.lasd26.look-a .tsp-over.top{top:10px;right:66px}
.lasd26.look-a .tsp-over.bottom{bottom:30px;right:10px}
.lasd26.look-a .rt-notes{top:auto;bottom:96px}
.lasd26.look-a .tsp-now{margin:0;background:var(--paper);border-radius:14px;border-width:0;box-shadow:0 2px 14px rgba(17,17,16,.22);grid-template-columns:auto auto 1fr;overflow:hidden}
.lasd26.look-a .tsp-now > div{padding:8px 12px;border-left:1px solid var(--line)}
.lasd26.look-a .tsp-now > div:first-child{border-left:none}
.lasd26.look-a .tsp-now > div:nth-child(3){grid-column:auto;border-top:none;border-left:1px solid var(--line)}
.lasd26.look-a .tsp-now .v{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lasd26.look-a .tsp-now small{display:none}
.lasd26.look-a .tsp-now .k{font-size:9px;white-space:nowrap}
.lasd26.look-a .tsp-share{background:var(--paper);border-radius:14px;box-shadow:0 2px 14px rgba(17,17,16,.22);padding:8px}
.lasd26.look-a .tsp-share .tsp-k,.lasd26.look-a .tsp-share .tm-note{display:none}
.lasd26.look-a .tsp-share .tsp-pills{flex-wrap:nowrap;gap:4px}
.lasd26.look-a .tsp-share .tsp-pill{flex:1}
.lasd26.look-a .tsp-share .tsp-pill span{width:100%;align-items:center;border-radius:10px;border-width:0;background:#e9e8e1;min-height:44px;padding:4px 6px;font-size:11px}
.lasd26.look-a .tsp-share .tsp-pill span small{display:none}
.lasd26.look-a .tsp-share .tsp-pill input:checked + span{background:var(--safety-ink);color:#fff}
.lasd26.look-a .rt-btn{border-radius:12px;border-width:0;box-shadow:0 2px 10px rgba(17,17,16,.25)}

/* B: DASHBOARD. Dark, big numbers, race control: built to be read at 3 AM
 * in a van without lighting the cabin up. Ink and paper trade places; the
 * accent is a bright sky that holds on black. */
.lasd26.look-b{--paper:#0E0F11;--ink:#F2F1EC;--ink-soft:#B9B8B1;--gray:#8C8B85;--line:#2C2E33;--safety:#5CC8FF;--safety-ink:#5CC8FF;--safety-hover:#8AD8FF;background:#0E0F11;color-scheme:dark}
.lasd26.look-b .bar{background:#0E0F11}
.lasd26.look-b .bar .tag{background:var(--safety);color:#0E0F11}
.lasd26.look-b .acct-menu{background:#17181B}
.lasd26.look-b .acct-ini{color:#0E0F11}
.lasd26.look-b .rt-map,.lasd26.look-b .rt-stage{background:#17181B}
.lasd26.look-b .tsp-now{border:none;gap:8px;grid-template-columns:1fr 1fr}
.lasd26.look-b .tsp-now > div{background:#17181B;border:none;border-radius:6px;padding:14px}
.lasd26.look-b .tsp-now > div:nth-child(3){grid-column:1/-1;border-top:none}
.lasd26.look-b .tsp-now .v{font-size:clamp(28px,8.5vw,44px);color:var(--safety);font-variant-numeric:tabular-nums}
.lasd26.look-b .tsp-now > div:nth-child(3) .v{color:var(--ink)}
.lasd26.look-b .tsp-pill span{border-color:#2C2E33;background:#17181B}
.lasd26.look-b .tsp-pill input:checked + span{background:var(--safety);border-color:var(--safety);color:#0E0F11}
.lasd26.look-b .tsp-pill input:checked + span small{color:#0E0F11}
.lasd26.look-b .rt-btn,.lasd26.look-b .rt-note{background:#17181B;color:var(--ink);border-color:#3a3d44}
.lasd26.look-b .rt-btn.locate[data-state=follow],.lasd26.look-b .rt-btn.recenter,.lasd26.look-b .rt-btn.fs.is-on{background:var(--safety);color:#0E0F11;border-color:var(--safety)}
.lasd26.look-b .rt-mk{background:#F2F1EC;color:#0E0F11;border-color:#0E0F11}
.lasd26.look-b .rt-mk.finish,.lasd26.look-b .rt-mk.tsp-p.runner{background:var(--safety);color:#0E0F11}
.lasd26.look-b .rt-mk.tsp-p::after{background:#F2F1EC}
.lasd26.look-b .maplibregl-popup-content{background:#17181B;color:var(--ink);border-color:#3a3d44}
.lasd26.look-b .maplibregl-ctrl-attrib{background:rgba(14,15,17,.8)!important;color:#8C8B85}
.lasd26.look-b .maplibregl-ctrl-attrib a{color:#8C8B85}
.lasd26.look-b .rt-finish{border:none;background:#17181B;border-radius:6px}
.lasd26.look-b .rt-finish .n{color:var(--safety)}
.lasd26.look-b .tsp-in{background:#17181B;border-color:#3a3d44}
.lasd26.look-b .rt-chip.on,.lasd26.look-b .tsp-looks a[aria-current=page]{background:var(--safety);border-color:var(--safety);color:#0E0F11}

/* C: CLEAN. The cream and the blue, calmer: no slab capitals, hairlines
 * for rules, round corners; closer to an ordinary phone app. */
.lasd26.look-c{--paper:#FAF9F5;--line:#E4E2DA;--safety:#0077B6;--safety-ink:#0077B6;--safety-hover:#0A8AD0;background:#FAF9F5}
.lasd26.look-c .bar{background:#FAF9F5;border-bottom:1px solid var(--line)}
.lasd26.look-c .bar .tag{border-radius:6px}
.lasd26.look-c .bar-nav{border-top:1px solid var(--line)}
.lasd26.look-c .bar-nav a{text-transform:none;letter-spacing:0;font-family:var(--lasd-archivo),sans-serif;font-size:14px;font-weight:600;color:var(--ink-soft)}
.lasd26.look-c .bar-nav a[aria-current=page]{color:var(--safety-ink)}
.lasd26.look-c .acct-btn{border:1px solid var(--line);border-radius:999px}
.lasd26.look-c .acct-ini{border-radius:50%;color:#fff}
.lasd26.look-c .sec-head{border-bottom:1px solid var(--line)}
.lasd26.look-c .sec-head h2{font-family:var(--lasd-archivo),sans-serif;font-weight:700;text-transform:none;letter-spacing:-.01em;font-size:clamp(22px,5vw,30px)}
.lasd26.look-c .rt-map{border:none;border-radius:16px;overflow:hidden;margin:0 12px;height:62vh;height:62dvh}
.lasd26.look-c .tsp-now{border:1px solid var(--line);border-radius:14px;background:#fff}
.lasd26.look-c .tsp-now > div{border-left:1px solid var(--line)}
.lasd26.look-c .tsp-now > div:first-child{border-left:none}
.lasd26.look-c .tsp-now .v{font-family:var(--lasd-archivo),sans-serif;font-weight:700;text-transform:none;font-size:clamp(18px,4.8vw,24px)}
.lasd26.look-c .tsp-now .k,.lasd26.look-c .tsp-k{font-family:var(--lasd-archivo),sans-serif;text-transform:none;letter-spacing:0;font-size:12px;font-weight:600}
.lasd26.look-c .tsp-now small{font-family:var(--lasd-archivo),sans-serif;font-size:12px}
.lasd26.look-c .tsp-pills{gap:0;background:#EEEDE7;border-radius:12px;padding:4px;flex-wrap:nowrap}
.lasd26.look-c .tsp-pill{flex:1}
.lasd26.look-c .tsp-pill span{width:100%;align-items:center;border:none;border-radius:9px;font-family:var(--lasd-archivo),sans-serif;text-transform:none;letter-spacing:0;font-size:14px;font-weight:600;min-height:40px;padding:4px 6px}
.lasd26.look-c .tsp-pill span small{display:none}
.lasd26.look-c .tsp-pill input:checked + span{background:#fff;color:var(--safety-ink);box-shadow:0 1px 4px rgba(17,17,16,.14)}
.lasd26.look-c .tm-note{font-family:var(--lasd-archivo),sans-serif;font-size:13px}
.lasd26.look-c .rt-btn{border:none;border-radius:12px;background:#fff;box-shadow:0 1px 8px rgba(17,17,16,.2)}
.lasd26.look-c .rt-btn.locate[data-state=follow],.lasd26.look-c .rt-btn.recenter{background:var(--safety-ink);color:#fff}
.lasd26.look-c .rt-mk{border-radius:8px;border:none;box-shadow:0 1px 6px rgba(17,17,16,.25);background:#111;color:#fff}
.lasd26.look-c .rt-mk.finish,.lasd26.look-c .rt-mk.tsp-p.runner{background:var(--safety-ink);color:#fff}
.lasd26.look-c .rt-mk.tsp-p.van,.lasd26.look-c .rt-mk.tsp-p.crew,.lasd26.look-c .rt-mk.tsp-p.other{background:#fff;color:#111}
.lasd26.look-c .rt-list{border-top:1px solid var(--line)}
.lasd26.look-c .rt-row{border-bottom:1px solid var(--line)}
.lasd26.look-c .rt-row.start .tx{text-transform:none;letter-spacing:0}
.lasd26.look-c .rt-chip,.lasd26.look-c .tsp-in{border:1px solid var(--line);border-radius:12px;background:#fff}
.lasd26.look-c .rt-chip{text-transform:none;letter-spacing:0;font-family:var(--lasd-archivo),sans-serif;font-size:14px;font-weight:600}
.lasd26.look-c .tsp-facts{font-family:var(--lasd-archivo),sans-serif;text-transform:none;letter-spacing:0;font-size:14px}
.lasd26.look-c .rt-profile svg{border-bottom:1px solid var(--line)}
.lasd26.look-c .rt-finish{border:1px solid var(--line);border-radius:14px;background:#fff}
.lasd26.look-c .rt-finish .n{font-family:var(--lasd-archivo),sans-serif;font-weight:700;color:var(--safety-ink)}
.lasd26.look-c .tsp-looks a{border:1px solid var(--line);border-radius:999px}
.lasd26.look-c .tsp-foot{border-top:1px solid var(--line)}
`;
