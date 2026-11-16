/* The TSP team sites' own rules, appended after the LASD26 sheet by TspPage.
 *
 * THE BLUE RULE. The LASD26 sheet is written around two greens: --safety, a
 * FILL that carries ink type (the lime), and --safety-ink, the deep cut for
 * type and thin borders on the paper. Here they are the site's water blue
 * (CLAUDE.md: #0077B6 on cream, #1A90D4 where the accent sits on ink): the
 * fill is the lighter #1A90D4... which still carries ink type at 5.6:1, and
 * the type colour is #0077B6. Everything under .lasd26.tsp follows. */

export const tspCss = `
.lasd26.tsp{--safety:#4FB3EA;--safety-ink:#0077B6;--safety-hover:#7CC8F2}
.lasd26.tsp .wrap{max-width:760px}

.lasd26 .tsp-foot{border-top:2px solid var(--ink);margin-top:64px;padding:18px 0 28px}
.lasd26 .tsp-foot .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 16px;font-size:11px;letter-spacing:.12em;color:var(--gray)}
.lasd26 .tsp-foot a{color:var(--safety-ink);text-decoration:none}

/* THE HUB and the forms on paper. */
.lasd26 .tsp-hero{padding:34px 0 0}
.lasd26 .tsp-hero h1{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(38px,10vw,76px);line-height:.94;letter-spacing:-.02em;text-transform:uppercase}
.lasd26 .tsp-hero h1 .o{color:var(--safety-ink)}
.lasd26 .tsp-hero .sub{margin-top:14px;max-width:54ch;color:var(--ink-soft);font-size:15px}
.lasd26 .tsp-sec{padding:40px 0 0}
.lasd26 .tsp-teams{list-style:none;border-top:2px solid var(--ink)}
.lasd26 .tsp-teams li{border-bottom:1px dashed var(--line)}
.lasd26 .tsp-teams a{display:flex;align-items:baseline;gap:12px;min-height:56px;padding:14px 0;text-decoration:none}
.lasd26 .tsp-teams .n{font-family:var(--lasd-archivo-black),sans-serif;font-size:20px;text-transform:uppercase;line-height:1.1}
.lasd26 .tsp-teams .m{margin-left:auto;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);white-space:nowrap}
.lasd26 .tsp-teams a:hover .n{color:var(--safety-ink)}
.lasd26 .tsp-chip{display:inline-block;font-family:var(--lasd-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;border:2px solid var(--ink);padding:1px 6px;margin-left:8px;vertical-align:middle}
.lasd26 .tsp-chip.fill{background:var(--ink);color:var(--safety)}

.lasd26 .tsp-form{display:grid;gap:18px;max-width:520px}
.lasd26 .tsp-form label.k,.lasd26 .tsp-k{display:block;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-bottom:8px}
/* 16 px so an iPhone does not zoom into the field. */
.lasd26 .tsp-in{width:100%;min-height:48px;border:2px solid var(--ink);background:transparent;font-family:var(--lasd-archivo),sans-serif;font-size:16px;color:var(--ink);padding:8px 12px;border-radius:0;appearance:none}
.lasd26 .tsp-in:focus{outline:none;border-color:var(--safety-ink)}
.lasd26 select.tsp-in{background:transparent}
.lasd26 .tsp-pills{display:flex;flex-wrap:wrap;gap:8px}
.lasd26 .tsp-pill{position:relative;cursor:pointer}
.lasd26 .tsp-pill input{position:absolute;opacity:0}
.lasd26 .tsp-pill span{display:inline-flex;flex-direction:column;justify-content:center;min-height:48px;border:2px solid var(--line);padding:6px 16px;font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.lasd26 .tsp-pill span small{font-weight:400;font-size:10px;color:var(--gray);letter-spacing:.06em}
.lasd26 .tsp-pill input:checked + span{border-color:var(--ink);background:var(--ink);color:var(--safety)}
.lasd26 .tsp-pill input:checked + span small{color:#c9c8c0}
.lasd26 .tsp-pill input:focus-visible + span{outline:2px solid var(--safety-ink);outline-offset:3px}

/* THE ROSTER on the team page. */
.lasd26 .tsp-roster{list-style:none;border-top:2px solid var(--ink)}
.lasd26 .tsp-roster li{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;border-bottom:1px dashed var(--line);padding:12px 0}
.lasd26 .tsp-roster .who{min-width:0;flex:1 1 180px}
.lasd26 .tsp-roster .who b{display:block;font-size:15px}
.lasd26 .tsp-roster .who small{display:block;font-family:var(--lasd-mono),monospace;font-size:11px;color:var(--gray);letter-spacing:.06em;text-transform:uppercase}
.lasd26 .tsp-roster .acts{display:flex;flex-wrap:wrap;gap:6px}
.lasd26 .tsp-roster .rt-mini{min-height:36px}

/* ─── THE ROUTE PAGE ─────────────────────────────────────────────────── */
/* The map is the page: taller than the LASD26 one, most of a phone. */
.lasd26.tsp .rt-map{height:68vh;height:68dvh;max-height:820px}
@media(min-width:960px){ .lasd26.tsp .rt-map{height:640px} }
.lasd26.tsp .rt-top{padding:22px 0 0}
.lasd26 .tsp-share .tm-note{margin-top:8px;margin-bottom:14px}
.lasd26 .tsp-share .tsp-pill span{min-height:44px;padding:5px 12px}
.lasd26 .tsp-now{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:2px solid var(--ink);margin-bottom:14px}
.lasd26 .tsp-now > div{padding:10px 12px;border-left:1px dashed var(--line);min-width:0}
.lasd26 .tsp-now > div:first-child{border-left:none}
.lasd26 .tsp-now .k{font-family:var(--lasd-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.lasd26 .tsp-now .v{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(17px,4.6vw,26px);line-height:1.1;text-transform:uppercase;margin-top:3px;overflow-wrap:anywhere}
.lasd26 .tsp-now small{display:block;font-family:var(--lasd-mono),monospace;font-size:10px;color:var(--ink-soft);margin-top:4px;line-height:1.5}
@media(max-width:520px){ .lasd26 .tsp-now{grid-template-columns:1fr 1fr} .lasd26 .tsp-now > div:nth-child(3){grid-column:1/-1;border-left:none;border-top:1px dashed var(--line)} }
.lasd26 .tsp-who{display:flex;flex-wrap:wrap;align-items:end;gap:10px;margin-bottom:18px}
.lasd26 .tsp-who .tsp-k{flex:0 0 100%;margin-bottom:0}
.lasd26 .tsp-who .tsp-in{flex:1 1 220px;width:auto;min-height:44px}
.lasd26 .rt-chip.on{background:var(--ink);color:var(--safety)}
.lasd26 .tsp-people{margin-bottom:8px}
.lasd26 .tsp-facts{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
.lasd26 .tsp-facts b{color:var(--ink);font-size:15px}
/* The people on the map. RUNNER is the filled tag; a van is paper; crew is
 * small; another team's van is dashed. A phone gone quiet is greyed. */
.lasd26 .rt-mk.tsp-p{cursor:pointer;font-size:10px}
.lasd26 .rt-mk.tsp-p.runner{background:var(--safety-ink);color:#fff;border-color:var(--ink);font-size:11px;z-index:3}
.lasd26 .rt-mk.tsp-p.van{background:var(--paper);color:var(--ink)}
.lasd26 .rt-mk.tsp-p.crew{background:var(--paper);color:var(--ink-soft);border-width:1px;padding:2px 5px;box-shadow:none}
.lasd26 .rt-mk.tsp-p.other{background:var(--paper);color:var(--ink);border-style:dashed}
.lasd26 .rt-mk.tsp-p.stale{opacity:.55}
.lasd26 .rt-mk.tsp-p::after{content:"";position:absolute;left:50%;bottom:-8px;width:2px;height:6px;background:var(--ink);transform:translateX(-50%)}

/* ─── LEGS ───────────────────────────────────────────────────────────── */
.lasd26 .tsp-next{font-size:11px;letter-spacing:.08em;color:var(--ink-soft);margin:10px 0 0;line-height:1.7}
.lasd26 .tsp-next b{color:var(--safety-ink)}
.lasd26 .tsp-rot{border:2px solid var(--ink);padding:14px;margin-top:18px}
.lasd26 .tsp-rot .row{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}
.lasd26 .tsp-rot .tm-num{width:104px}
.lasd26 .tsp-ord{display:inline-flex;align-items:center;gap:8px;min-height:44px;border:2px solid var(--line);background:transparent;color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;cursor:pointer;border-radius:0}
.lasd26 .tsp-ord.on{border-color:var(--ink);background:var(--ink);color:var(--paper)}
.lasd26 .tsp-ord b{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;background:var(--safety);color:#111;font-size:11px}
.lasd26 .tsp-save{position:sticky;top:108px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;background:var(--paper);border:2px solid var(--ink);padding:10px 12px;margin-top:16px;box-shadow:4px 4px 0 rgba(17,17,16,.14)}
@media(min-width:960px){ .lasd26 .tsp-save{top:66px} }
.lasd26 .tsp-legs{list-style:none;margin-top:18px;border-top:2px solid var(--ink)}
.lasd26 .tsp-leg{border-bottom:1px dashed var(--line);padding:14px 0}
.lasd26 .tsp-leg.mine{box-shadow:inset 4px 0 0 var(--safety);padding-left:12px}
.lasd26 .tsp-leg.done{opacity:.55}
.lasd26 .tsp-leg .top{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.lasd26 .tsp-leg .mi{font-size:14px;font-weight:700;letter-spacing:.06em;color:var(--safety-ink)}
.lasd26 .tsp-leg .len{font-family:var(--lasd-archivo-black),sans-serif;font-size:24px;line-height:1;font-variant-numeric:tabular-nums}
.lasd26 .tsp-leg .meta{font-size:11px;letter-spacing:.06em;color:var(--ink-soft);margin-top:6px;line-height:1.7}
.lasd26 .tsp-leg .meta b{color:var(--ink)}
.lasd26 .tsp-leg .when{font-size:12px;font-weight:700;letter-spacing:.06em;margin-top:4px}
.lasd26 .tsp-leg .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.lasd26 .tsp-leg .acts a{text-decoration:none}
.lasd26 .tsp-leg .edit{margin-top:10px;display:grid;gap:10px}
.lasd26 .tsp-leg .ends{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:end}
.lasd26 .tsp-leg .ends .tsp-in{flex:1 1 180px;width:auto;min-height:40px}
.lasd26 .tsp-leg .end .tsp-k{margin-bottom:5px}
.lasd26 .tsp-leg .steps{display:flex;gap:4px}
.lasd26 .tsp-leg .steps .rt-mini{padding:0 9px;min-width:44px}
.lasd26 .tsp-leg .turns{list-style:none;margin-top:10px;border-top:1px dashed var(--line);padding-top:8px;font-size:14px}
.lasd26 .tsp-leg .turns li{display:flex;gap:10px;padding:4px 0}
.lasd26 .tsp-leg .turns .mono{flex:none;width:44px;text-align:right;font-size:12px;font-weight:700;color:var(--safety-ink);padding-top:2px}
.lasd26 .tsp-legs .list-empty{padding:22px 0;font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.1em;color:var(--gray)}
.lasd26 .tsp-routes{flex-direction:column}
.lasd26 .tsp-routes .tsp-pill span{align-items:flex-start;width:100%;padding:10px 14px}
.lasd26 .tsp-routes .tsp-pill span small{text-transform:none;letter-spacing:.02em;font-size:11px;line-height:1.5;margin-top:3px}

/* THE MAP PAGE (owner, 2026-11-16: "a dedicated page for just the route"): the frame is one screen, the bar on top, the map the rest. */
.lasd26.tsp-bare{height:100vh;height:100dvh;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.lasd26.tsp-bare .bar{position:relative;flex:0 0 auto}
.lasd26 .rt-map.tsp-full{flex:1 1 auto;height:auto;min-height:0;max-height:none;border-top:none;border-bottom:none}
.lasd26 .tsp-optbtn{position:absolute;left:12px;top:12px;z-index:3;display:inline-flex;align-items:center;gap:8px;width:auto;padding:0 12px;font-family:var(--lasd-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em}
.lasd26 .tsp-optbtn .dot{width:9px;height:9px;border-radius:50%;background:#2E933C;box-shadow:0 0 0 2px var(--paper)}
.lasd26 .tsp-sheet{position:absolute;left:12px;top:64px;z-index:3;width:min(360px,calc(100% - 24px));max-height:calc(100% - 76px);overflow-y:auto;background:var(--paper);border:2px solid var(--ink);box-shadow:6px 6px 0 rgba(17,17,16,.18);-webkit-overflow-scrolling:touch}
.lasd26 .tsp-sheet .grp{padding:12px 14px;border-bottom:1px dashed var(--line)}
.lasd26 .tsp-sheet .grp:last-child{border-bottom:none}
.lasd26 .tsp-sheet .tsp-k{display:block;margin-bottom:8px}
.lasd26 .tsp-sheet .tm-note{margin:8px 0 0}
.lasd26 .tsp-pills.four{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.lasd26 .tsp-pills.four .tsp-pill span{width:100%;align-items:center;min-height:44px;padding:4px 4px;font-size:11px}
.lasd26 .tsp-line{font-size:14px;line-height:1.5;margin:0}
.lasd26 .tsp-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.lasd26 .tsp-links .rt-chip{min-height:40px;cursor:pointer;background:transparent}
.lasd26 .tsp-legend{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.lasd26 .tsp-legend .who{display:flex;flex-wrap:wrap;align-items:center;gap:0 8px;min-height:44px;padding:5px 9px;border:2px solid var(--line);background:transparent;color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-align:left;cursor:pointer}
.lasd26 .tsp-legend .who.on{border-color:var(--ink);background:var(--ink);color:var(--paper)}
.lasd26 .tsp-legend .who i{flex:0 0 auto;width:14px;height:14px;border-radius:50%;border:2px solid var(--paper);box-shadow:0 0 0 1px var(--ink)}
.lasd26 .tsp-legend .who small{flex:0 0 100%;padding-left:22px;font-weight:400;font-size:10px;letter-spacing:.04em;color:var(--gray);text-transform:none}
.lasd26 .tsp-legend .who.on small{color:#c9c8c0}
.lasd26 .tsp-checks{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px}
.lasd26 .tsp-checks label{display:flex;align-items:center;gap:8px;min-height:40px;font-size:14px;cursor:pointer}
.lasd26 .tsp-checks input{width:20px;height:20px;accent-color:var(--safety-ink)}
.lasd26 .rt-mk.tsp-ho{background:#111110;color:#fff;border-color:#fff;border-radius:999px;padding:4px 8px 3px;cursor:pointer;letter-spacing:.06em;font-size:11px}
.lasd26 .rt-stage.z-far .rt-mk.tsp-ho{font-size:8px;padding:1px 4px 0;border-width:1px;box-shadow:none}
.lasd26 .tsp-fix{position:absolute;left:12px;right:66px;top:12px;z-index:3;background:var(--paper);border:2px solid #E4572E;box-shadow:6px 6px 0 rgba(17,17,16,.18);padding:10px 12px}
.lasd26 .tsp-fix .say{font-size:14px;line-height:1.45}
.lasd26 .tsp-fix .say b{display:block;font-family:var(--lasd-mono),monospace;font-size:10px;letter-spacing:.14em;color:#B8421F;margin-bottom:2px}
.lasd26 .tsp-fix .say em{font-style:normal;font-weight:700;color:#B8421F}
.lasd26 .tsp-fix .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.lasd26 .tsp-fix .rt-mini{min-height:40px}
.lasd26 .rt-row a{display:flex;align-items:flex-start;gap:12px;width:100%;min-height:48px;padding:11px 0;color:inherit;text-decoration:none}
.lasd26 .rt-row a:hover .tx{color:var(--safety-ink)}
/* THE PLAN PAGE: shifts and hand-offs. */
.lasd26 .tsp-hos{list-style:none;margin:10px 0 0;padding:0;border-top:2px solid var(--ink)}
.lasd26 .tsp-hos li{display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;align-items:baseline;padding:10px 0;border-bottom:1px dashed var(--line)}
.lasd26 .tsp-hos .n{font-family:var(--lasd-mono),monospace;font-weight:700;font-size:12px;background:#111110;color:#fff;border-radius:999px;padding:3px 9px}
.lasd26 .tsp-hos .t{font-weight:700}
.lasd26 .tsp-hos .t small{display:block;font-weight:400;font-size:13px;color:var(--ink-soft);line-height:1.5}
.lasd26 .tsp-hos .w{font-family:var(--lasd-mono),monospace;font-size:12px;text-align:right;white-space:nowrap}
.lasd26 .tsp-hos .acts{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:6px}
.lasd26 .tsp-squads{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}
.lasd26 .tsp-squads > div{border:2px solid var(--line);padding:8px 10px;font-size:14px;line-height:1.6}
.lasd26 .tsp-squads b{display:block;font-family:var(--lasd-mono),monospace;font-size:10px;letter-spacing:.12em;color:var(--gray)}
.lasd26 .tsp-leg .sw{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:7px;vertical-align:-1px;box-shadow:0 0 0 1px var(--ink)}
.lasd26 .tsp-sub{font-family:var(--lasd-archivo-black),sans-serif;text-transform:uppercase;font-size:16px;margin:26px 0 0}
`;
