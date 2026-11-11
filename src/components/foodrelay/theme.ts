import { Barlow, Barlow_Condensed } from "next/font/google";

/* THE FOOD RELAY LOOK (2026-11-10) — one kit for the sibling pages: the
 * Vegas Glizzy Gauntlet (/glizzy-gauntlet), Ring Every Bell
 * (/ring-every-bell) and Animal Style (/animal-style). A race poster on cream: heavy italic condensed caps,
 * ink rules, hard offset shadows, and one loud colour per event. The cream
 * and the left-set bold chips are the site's own habits (the landing is
 * the reference); the reds and purples are the events'. Scoped under .fr,
 * classes .fr- (page) and .m- / .p- (the chart and the profile); the
 * palette is a second class on the root (fr-glizzy / fr-bells / fr-animal,
 * and fr-seapdx for the Seattle to Portland page, which wears the kit
 * without the food: emerald for the Emerald City, rose for the Rose City)
 * and everything below reads the variables.
 *
 * The font is claimed with inherit on every descendant: globals.css styles
 * h1/h2/p/a by element, and a scoped universal rule is what beats it (the
 * Dam to Dam lesson, 2026-11-04) while still letting a span inside a
 * heading keep the heading face.
 *
 * Rendered as the text child of a style tag: no double quotes, no
 * apostrophes, no angle brackets and no ampersands in this string. */

export const frDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--fr-display",
});

export const frBody = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--fr-body",
});

export const css = `
.fr,.fr *{margin:0;padding:0;box-sizing:border-box;font-family:inherit}
.fr{
  --ground:#fbf4e6;--paper:#fffdf8;--ink:#1c1a17;--dim:rgba(28,26,23,.74);--mute:rgba(28,26,23,.64);--rule:rgba(28,26,23,.16);
  background:var(--ground);color:var(--ink);
  font-family:var(--fr-body),system-ui,sans-serif;font-size:17px;line-height:1.55;font-weight:400;
  min-height:100vh;min-height:100dvh;width:100%;overflow-x:hidden;-webkit-font-smoothing:antialiased;color-scheme:light;
}
.fr.fr-glizzy{--a:#d0202c;--a-ink:#ffffff;--b:#0b5cab;--c:#f4b400;--c-ink:#1c1a17}
.fr.fr-bells{--a:#5c2d91;--a-ink:#ffffff;--b:#c41d72;--c:#f6b91a;--c-ink:#1c1a17}
.fr.fr-animal{--a:#d6281b;--a-ink:#ffffff;--b:#1c7c46;--c:#ffc61a;--c-ink:#1c1a17}
.fr.fr-seapdx{--a:#0b7a53;--a-ink:#ffffff;--b:#b4245d;--c:#ff9eb8;--c-ink:#1c1a17}
.fr p,.fr li,.fr td,.fr th,.fr summary{font-size:inherit;line-height:inherit;color:inherit;text-wrap:pretty}
.fr a{color:inherit;text-decoration:underline;text-decoration-color:var(--a);text-decoration-thickness:2px;text-underline-offset:3px;transition:none}
.fr a:hover{color:var(--a)}
.fr :focus-visible{outline:3px solid var(--b);outline-offset:3px}
.fr [id]{scroll-margin-top:18px}
.fr h1,.fr h2,.fr h3{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;letter-spacing:0;line-height:.92;color:inherit;text-wrap:balance}
.fr .wrap{max-width:1120px;margin:0 auto;padding:0 24px}

/* THE BAR */
.fr .fr-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 24px;border-bottom:2px solid var(--ink);background:var(--paper)}
.fr .fr-wm{display:flex;align-items:center;gap:10px;font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:22px;letter-spacing:.01em;line-height:1;white-space:nowrap}
.fr .fr-wm svg{flex:none}
.fr .fr-nav{display:flex;gap:22px}
.fr .fr-nav a{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-size:15px;text-decoration:none;white-space:nowrap}
@media (max-width:760px){.fr .fr-nav{display:none}}

/* THE HERO */
.fr .fr-hero{padding:52px 0 48px;border-bottom:2px solid var(--ink)}
.fr .fr-hero-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:28px;align-items:center}
.fr .fr-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
.fr .fr-chip{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:15px;letter-spacing:.09em;text-transform:uppercase;padding:5px 12px;border:2px solid var(--ink);border-radius:999px;background:var(--paper);line-height:1.2;white-space:nowrap}
.fr .fr-chip.on{background:var(--a);color:var(--a-ink)}
.fr .fr-chip.alt{background:var(--c);color:var(--c-ink)}
.fr h1{font-size:clamp(62px,12.4vw,164px);line-height:.84}
.fr h1 span{display:block}
.fr h1 .hl{color:var(--a)}
.fr .fr-sub{font-family:var(--fr-display),Impact,sans-serif;font-weight:800;font-style:italic;text-transform:uppercase;font-size:clamp(24px,3.6vw,40px);line-height:1.02;margin-top:20px;color:var(--b)}
.fr .fr-lede{max-width:58ch;margin-top:14px;font-size:19px;color:var(--dim)}
.fr .fr-art{display:flex;justify-content:center;align-items:center}
.fr .fr-art svg{width:100%;max-width:400px;height:auto;transform:rotate(-13deg);filter:drop-shadow(8px 10px 0 rgba(28,26,23,.16))}
@media (max-width:860px){
  .fr .fr-hero{padding:32px 0 40px}
  .fr .fr-hero-grid{grid-template-columns:1fr;gap:18px}
  .fr .fr-art{order:-1;justify-content:flex-start;padding-left:6px}
  .fr .fr-art svg{max-width:150px}
}
.fr .fr-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:36px;border:2px solid var(--ink);background:var(--paper);border-radius:14px;overflow:hidden}
.fr .fr-stat{padding:16px 18px;border-left:2px solid var(--ink)}
.fr .fr-stat:first-child{border-left:0}
.fr .fr-stat .n{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:clamp(36px,5vw,58px);line-height:.95;color:var(--a);white-space:nowrap}
.fr .fr-stat .l{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-size:14px;line-height:1.25;color:var(--dim);margin-top:5px}
@media (max-width:640px){
  .fr .fr-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .fr .fr-stat:nth-child(3){border-left:0}
  .fr .fr-stat:nth-child(n+3){border-top:2px solid var(--ink)}
}
.fr .fr-start{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px 28px;align-items:center;margin-top:16px;padding:20px 22px;background:var(--ink);color:#ffffff;border-radius:14px}
.fr .fr-start .when{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:clamp(23px,3vw,31px);line-height:1}
.fr .fr-start .where{color:rgba(255,255,255,.74);margin-top:6px;font-size:15px}
.fr .fr-count{display:flex;gap:8px}
.fr .fr-count-cell{min-width:66px;text-align:center;background:rgba(255,255,255,.1);border-radius:10px;padding:9px 8px 7px}
.fr .fr-count-n{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:34px;line-height:1;color:var(--c);font-variant-numeric:tabular-nums}
.fr .fr-count-l{font-family:var(--fr-display),Impact,sans-serif;font-weight:600;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-top:3px}
.fr .fr-count-done{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:30px;line-height:1;text-transform:uppercase;color:var(--c)}
@media (max-width:760px){.fr .fr-start{grid-template-columns:1fr}.fr .fr-count-cell{flex:1;min-width:0}}
.fr .fr-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
.fr .fr-btn{display:inline-flex;align-items:center;gap:8px;font-family:var(--fr-display),Impact,sans-serif;font-weight:800;font-style:italic;text-transform:uppercase;letter-spacing:.04em;font-size:19px;line-height:1;padding:14px 22px;border-radius:12px;border:2px solid var(--ink);background:var(--a);color:var(--a-ink);text-decoration:none;box-shadow:4px 4px 0 var(--ink)}
.fr .fr-btn:hover{color:var(--a-ink);transform:translate(1px,1px);box-shadow:3px 3px 0 var(--ink)}
.fr .fr-btn.ghost{background:var(--paper);color:var(--ink)}
.fr .fr-btn.ghost:hover{color:var(--ink)}
.fr .fr-fine{font-size:13px;line-height:1.45;color:var(--mute);margin-top:12px;max-width:80ch}

/* SECTIONS */
.fr .fr-sec{padding:64px 0;border-bottom:2px solid var(--ink)}
.fr .fr-sec.tint{background:var(--paper)}
.fr .fr-kick{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:15px;color:var(--a);margin-bottom:10px}
.fr h2{font-size:clamp(38px,6vw,66px);max-width:20ch}
.fr h3{font-size:26px;line-height:1}
.fr .fr-intro{max-width:64ch;margin-top:14px;color:var(--dim);font-size:18px}
.fr .fr-intro + .fr-intro{margin-top:10px}
@media (max-width:640px){.fr .fr-sec{padding:44px 0}}

/* THE COURSE: chart, profile, stops */
.fr .fr-course{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(0,1fr);gap:40px;align-items:start;margin-top:32px}
.fr .fr-course.wide{grid-template-columns:1fr;gap:0}
@media (max-width:900px){.fr .fr-course{grid-template-columns:1fr;gap:28px}}
/* A long stop list beside the chart: the chart rides along while the
 * list scrolls past it. */
.fr .fr-course.long{align-items:stretch}
.fr .fr-course.long .fr-map{position:sticky;top:18px}
@media (max-width:900px){.fr .fr-course.long .fr-map{position:static}}
.fr .fr-map{border:2px solid var(--ink);border-radius:16px;overflow:hidden;background:var(--paper);box-shadow:6px 6px 0 var(--ink)}
.fr .fr-map svg{display:block;width:100%;height:auto}
.fr .m-bg{fill:var(--paper)}
.fr .m-road{fill:none;stroke:rgba(28,26,23,.15);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.fr .m-area{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:19px;letter-spacing:.16em;fill:#8f8a80;text-anchor:middle;paint-order:stroke;stroke:var(--paper);stroke-width:6px;stroke-linejoin:round}
.fr .m-shield rect{fill:var(--paper);stroke:rgba(28,26,23,.42);stroke-width:1.5}
.fr .m-shield text{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:15px;fill:rgba(28,26,23,.62);text-anchor:middle;dominant-baseline:central}
.fr .m-case{fill:none;stroke:var(--paper);stroke-width:11;stroke-linecap:round;stroke-linejoin:round}
.fr .m-route{fill:none;stroke:var(--a);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.fr .m-arrow{fill:var(--ink);stroke:var(--paper);stroke-width:2;stroke-linejoin:round}
.fr .m-stop circle{fill:var(--a);stroke:var(--ink);stroke-width:3;r:16px}
.fr .m-stop text{font-family:var(--fr-display),Impact,sans-serif;font-weight:800;font-size:19px;fill:var(--a-ink);text-anchor:middle;dominant-baseline:central}
.fr .m-stop.end circle{fill:var(--c)}
.fr .m-stop.end text{fill:var(--c-ink)}
.fr .m-name{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:34px;fill:var(--ink);paint-order:stroke;stroke:var(--paper);stroke-width:7px;stroke-linejoin:round}
.fr .m-mile{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:20px;letter-spacing:.1em;fill:var(--b);paint-order:stroke;stroke:var(--paper);stroke-width:6px;stroke-linejoin:round}
.fr .m-scale line{stroke:var(--ink);stroke-width:3}
.fr .m-scale text{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;font-size:16px;letter-spacing:.12em;fill:var(--ink)}
/* A chart that names its stops (m-large: five Costcos) is drawn big at
 * every width, so the offsets its labels were placed with still hold on a
 * phone. A chart of numbered dots only (two dozen bells) is shown wide on
 * a desktop and grows its dots on a phone instead. */
.fr .m-large .m-stop circle{r:23px;stroke-width:4}
.fr .m-large .m-stop text{font-size:28px}
.fr .m-large .m-name{font-size:44px;stroke-width:9px}
.fr .m-large .m-mile{font-size:25px;stroke-width:8px}
.fr .m-large .m-area{font-size:23px}
.fr .m-large .m-shield{display:none}
.fr .m-large .m-route{stroke-width:6}
.fr .m-large .m-case{stroke-width:13}
.fr .m-large .m-road{stroke-width:6}
.fr .m-large .m-scale text{font-size:23px}
@media (max-width:640px){
  .fr .m-regular .m-stop circle{r:25px;stroke-width:4}
  .fr .m-regular .m-stop text{font-size:29px}
  .fr .m-regular .m-name{font-size:50px;stroke-width:10px}
  .fr .m-regular .m-mile{font-size:31px;stroke-width:9px}
  .fr .m-regular .m-area{font-size:27px}
  .fr .m-regular .m-shield{display:none}
  .fr .m-regular .m-scale text{font-size:27px}
  .fr .m-regular .m-route{stroke-width:7}
  .fr .m-regular .m-case{stroke-width:15}
}
.fr .fr-cap{font-size:13px;color:var(--mute);margin-top:14px;line-height:1.45;max-width:86ch}
.fr .fr-profile{margin-top:20px;border:2px solid var(--ink);border-radius:16px;background:var(--paper);padding:14px 16px 10px}
.fr .fr-profile svg{display:block;width:100%;height:auto;overflow:visible}
.fr .fr-profile-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 24px;margin-bottom:8px;font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-size:14px;color:var(--dim)}
.fr .fr-profile-head b{color:var(--ink);font-weight:700}
.fr .p-area{fill:var(--a);opacity:.16}
.fr .p-line{fill:none;stroke:var(--a);stroke-width:3;stroke-linejoin:round}
.fr .p-tick{stroke:rgba(28,26,23,.34);stroke-width:1.5;stroke-dasharray:3 4}
.fr .p-dot{fill:var(--a);stroke:var(--ink);stroke-width:2}
.fr .p-dot.end{fill:var(--c)}
.fr .p-num{font-family:var(--fr-display),Impact,sans-serif;font-weight:800;font-size:15px;fill:var(--a-ink);text-anchor:middle;dominant-baseline:central}
.fr .p-num.end{fill:var(--c-ink)}
.fr .p-ax{font-family:var(--fr-display),Impact,sans-serif;font-weight:600;font-size:15px;letter-spacing:.08em;fill:rgba(28,26,23,.62)}
.fr .p-base{stroke:var(--ink);stroke-width:2}
@media (max-width:640px){.fr .p-ax{font-size:26px}.fr .p-num{font-size:0}.fr .p-line{stroke-width:5}}

.fr .fr-rail{list-style:none}
.fr .fr-rail li{display:grid;grid-template-columns:52px minmax(0,1fr) auto;column-gap:16px;align-items:start}
.fr .fr-rail-n{width:52px;height:52px;border-radius:50%;background:var(--a);color:var(--a-ink);border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;font-family:var(--fr-display),Impact,sans-serif;font-weight:800;font-style:italic;font-size:26px;line-height:1}
.fr .fr-rail li.end .fr-rail-n{background:var(--c);color:var(--c-ink)}
.fr .fr-rail-name{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:28px;line-height:1;margin-top:4px}
.fr .fr-rail-tag{display:inline-block;margin-left:10px;font-style:normal;font-size:13px;font-weight:700;letter-spacing:.12em;padding:3px 9px;border-radius:999px;background:var(--ink);color:#ffffff;vertical-align:5px}
.fr .fr-rail-addr{font-size:15px;color:var(--dim);margin-top:5px}
.fr .fr-rail-mi{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:15px;color:var(--dim);margin-top:6px;white-space:nowrap;text-align:right}
.fr .fr-rail-mi b{font-size:28px;font-style:italic;font-weight:800;color:var(--ink);letter-spacing:0;margin-right:4px}
.fr .fr-rail-leg{grid-column:1 / -1;display:grid;grid-template-columns:52px minmax(0,1fr);column-gap:16px;align-items:center;min-height:58px}
.fr .fr-rail-leg i{justify-self:center;width:0;height:100%;min-height:58px;border-left:3px dashed rgba(28,26,23,.5)}
.fr .fr-rail-leg span{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-size:15px;color:var(--b)}

.fr .fr-bellgrid{list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:28px}
@media (max-width:900px){.fr .fr-bellgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.fr .fr-bellgrid{grid-template-columns:1fr}}
.fr .fr-bellgrid.one{grid-template-columns:1fr;margin-top:0}
.fr .fr-bellgrid li{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:12px;align-items:center;padding:10px 14px 10px 10px;border:2px solid var(--ink);border-radius:12px;background:var(--paper)}
.fr .fr-bellgrid .n{width:44px;height:44px;border-radius:50%;background:var(--a);color:var(--a-ink);display:flex;align-items:center;justify-content:center;font-family:var(--fr-display),Impact,sans-serif;font-weight:800;font-style:italic;font-size:21px;line-height:1;border:2px solid var(--ink)}
.fr .fr-bellgrid li.end .n{background:var(--c);color:var(--c-ink)}
.fr .fr-bellgrid .name{font-family:var(--fr-display),Impact,sans-serif;font-weight:800;font-style:italic;text-transform:uppercase;font-size:21px;line-height:1.05}
.fr .fr-bellgrid .addr{display:block;font-size:14px;color:var(--dim);line-height:1.3;margin-top:2px}
.fr .fr-bellgrid .meta{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.07em;font-size:13px;line-height:1.3;color:var(--dim);margin-top:3px}
.fr .fr-bellgrid .meta b{color:var(--b);font-weight:700}

/* CARDS, RULES, TABLES, FAQ */
.fr .fr-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:28px}
@media (max-width:900px){.fr .fr-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.fr .fr-cards{grid-template-columns:1fr}}
.fr .fr-card{border:2px solid var(--ink);border-radius:14px;background:var(--paper);padding:18px 18px 20px}
.fr .tint .fr-card{background:var(--ground)}
.fr .fr-card h3{margin-bottom:8px}
.fr .fr-card p{color:var(--dim);font-size:16px}
.fr .fr-card .tag{display:inline-block;font-family:var(--fr-display),Impact,sans-serif;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px;line-height:1.3;padding:3px 9px;border-radius:999px;background:var(--c);color:var(--c-ink);border:2px solid var(--ink);margin-bottom:12px}
.fr .fr-rules{list-style:none;margin-top:28px;border-top:2px solid var(--ink)}
.fr .fr-rules li{display:grid;grid-template-columns:60px minmax(0,1fr);column-gap:8px;padding:16px 0;border-bottom:2px solid var(--rule);align-items:baseline}
.fr .fr-rules .n{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:38px;line-height:.9;color:var(--a)}
.fr .fr-rules p{max-width:70ch}
.fr b,.fr strong{font-weight:600}
.fr .fr-tablewrap{margin-top:28px;border:2px solid var(--ink);border-radius:14px;overflow:hidden;overflow-x:auto;background:var(--paper)}
.fr table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.fr th,.fr td{border:0}
.fr th{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-size:14px;text-align:left;padding:12px 16px;background:var(--ink);color:#ffffff;white-space:nowrap}
.fr td{padding:12px 16px;border-top:2px solid var(--rule);font-size:16px}
.fr td.big{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;font-size:22px;text-transform:uppercase;line-height:1;white-space:nowrap}
.fr tr.hot td{background:rgba(244,180,0,.2)}
.fr .num{text-align:right;white-space:nowrap}
.fr .fr-faq{margin-top:28px;border-top:2px solid var(--ink)}
.fr .fr-q{border-bottom:2px solid var(--rule)}
.fr .fr-q summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:16px;align-items:center;padding:18px 0;font-family:var(--fr-display),Impact,sans-serif;font-weight:800;font-style:italic;text-transform:uppercase;font-size:24px;line-height:1.05}
.fr .fr-q summary::-webkit-details-marker{display:none}
.fr .fr-q .pm{flex:none;width:30px;height:30px;border-radius:50%;border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:22px;line-height:1;background:var(--paper)}
.fr .fr-q[open] .pm{background:var(--a);color:var(--a-ink);transform:rotate(45deg)}
.fr .fr-q .a{padding:0 0 20px;max-width:70ch;color:var(--dim)}
.fr .fr-q .a p + p{margin-top:10px}

/* THE BAND, THE FINE PRINT, THE FOOT */
.fr .fr-band{background:var(--a);color:var(--a-ink);padding:56px 0;border-bottom:2px solid var(--ink)}
.fr .fr-band h2{max-width:none}
.fr .fr-band p{margin-top:12px;max-width:60ch;font-size:19px}
.fr .fr-band a{text-decoration-color:currentColor}
.fr .fr-band a:hover{color:var(--c)}
.fr .fr-band .fr-btn{background:var(--c);color:var(--c-ink)}
.fr .fr-band .fr-btn:hover{color:var(--c-ink)}
.fr .fr-fineprint{padding:44px 0;font-size:14px;color:var(--dim);line-height:1.6}
.fr .fr-fineprint h3{font-size:20px;color:var(--ink);margin:22px 0 6px}
.fr .fr-fineprint h3:first-child{margin-top:0}
.fr .fr-fineprint p{max-width:88ch}
.fr .fr-fineprint ul{margin:6px 0 0 18px;max-width:88ch}
.fr .fr-foot{border-top:2px solid var(--ink);background:var(--ink);color:rgba(255,255,255,.8);padding:36px 0 48px;font-size:15px}
.fr .fr-foot a{color:#ffffff;text-decoration-color:var(--c)}
.fr .fr-foot a:hover{color:var(--c)}
.fr .fr-sibs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:28px}
@media (max-width:900px){.fr .fr-sibs{grid-template-columns:1fr}}
.fr .fr-sib{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:20px 22px;border:2px solid rgba(255,255,255,.3);border-radius:14px}
.fr .fr-sib .k{font-family:var(--fr-display),Impact,sans-serif;font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px;color:var(--c)}
.fr .fr-sib .t{font-family:var(--fr-display),Impact,sans-serif;font-style:italic;font-weight:800;text-transform:uppercase;font-size:32px;line-height:1;color:#ffffff;margin-top:4px}
.fr .fr-sib .s{margin-top:5px}
.fr .fr-sib .fr-btn{background:var(--c);color:var(--c-ink);border-color:#ffffff;box-shadow:none}
.fr .fr-foot p + p{margin-top:8px}
@media (prefers-reduced-motion: reduce){.fr *{transition:none!important;animation:none!important}}
`;
