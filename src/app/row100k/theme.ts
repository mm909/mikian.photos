import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";

/* Shared look for /row100k: same challenge-page language as /lasd26 (paper,
 * noise, Archivo trio) but water-blue where LASD is safety-orange, and — per
 * the owner — NO dark panel: the whole page stays on paper with ink borders.
 * Everything scoped under .row100k so nothing leaks into the rest of the
 * site. */

export const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--row-archivo",
});
export const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--row-archivo-black",
});
export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--row-mono",
});

/* Faint 2x2 noise tile carried over from /lasd26. */
const NOISE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP88vkdAwMDEwMDAwMDAwAiLALZuZcPKwAAAABJRU5ErkJggg==";

export const css = `
html:has(.row100k){scroll-behavior:smooth}
.row100k,.row100k *{margin:0;padding:0;box-sizing:border-box}
.row100k section[id]{scroll-margin-top:64px}
.row100k{
  --paper:#F4F3EE; --ink:#15171a; --ink-soft:#3b3e42; --gray:#8a8a85; --line:#c9c8c0;
  --water:#0077B6; --water-hover:#1a90d4; --water-pale:#e3eef5; --frame:#1c2b33;
  background:var(--paper) url(${NOISE}) repeat;
  color:var(--ink);
  font-family:var(--row-archivo),sans-serif;
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;
  min-height:100vh;width:100%;color-scheme:light;
}
@media (prefers-reduced-motion: reduce){ .row100k *{transition:none!important;animation:none!important} }
.row100k .mono{font-family:var(--row-mono),monospace}
.row100k .wrap{max-width:760px;margin:0 auto;padding:0 20px}
.row100k a{color:inherit}
.row100k :focus-visible{outline:2px solid var(--water);outline-offset:3px}

.row100k .bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 20px;border-bottom:2px solid var(--ink);position:sticky;top:0;background:var(--paper) url(${NOISE}) repeat;z-index:50}
.row100k .bar .mono{font-size:12px;letter-spacing:.08em}
.row100k .bar .tag{background:var(--water);color:#fff;padding:3px 8px}
/* Account chip + dropdown (top-right of the bar). */
.row100k .acct{position:relative;display:flex;align-items:center}
.row100k .acct-chip{border:2px solid var(--ink);background:transparent;color:var(--ink);font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;cursor:pointer}
.row100k .acct-chip:hover{border-color:var(--water);color:var(--water)}
.row100k .acct-overlay{position:fixed;inset:0;z-index:55}
.row100k .acct-panel{position:absolute;top:calc(100% + 12px);right:0;background:var(--paper);border:2px solid var(--ink);box-shadow:6px 6px 0 rgba(21,23,26,.14);padding:4px 16px;min-width:220px;z-index:60}
.row100k .acct-item{display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px dashed var(--line);font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:11px 2px;cursor:pointer;color:var(--ink);text-decoration:none}
.row100k .acct-item:last-child{border-bottom:none}
.row100k .acct-item:hover{color:var(--water)}
.row100k .acct-item.danger:hover{color:#b3400f}

.row100k .hero{padding:28px 20px 8px}
.row100k .hero h1{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(46px,13vw,110px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase}
.row100k .hero h1 .o{color:var(--water)}
.row100k .hero .sub{margin-top:16px;max-width:54ch;color:var(--ink-soft);font-size:15px}
.row100k .mark-row{display:flex;gap:14px;margin-top:22px;flex-wrap:wrap;align-items:center}
.row100k .cc-mark{display:inline-block;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5.6vw,32px);text-transform:uppercase;letter-spacing:.01em;color:#fff;background:var(--water);padding:7px 16px 6px;transform:rotate(-1.2deg) skewX(-2deg)}
.row100k a.cc-mark{text-decoration:none;cursor:pointer}
.row100k .cc-mark.btn-mark{background:var(--ink);transform:rotate(1deg) skewX(-2deg)}
.row100k .cc-mark.btn-mark:hover{background:var(--water)}

.row100k .frame{margin:26px auto 0;max-width:760px;padding:0 20px}
.row100k .frame .ph,.row100k .inter .ph{border:14px solid var(--frame);background:var(--frame)}
.row100k .frame img,.row100k .inter img{display:block;width:100%;height:auto}
.row100k .inter{margin:56px auto 0;max-width:760px;padding:0 20px}

.row100k .facts{border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);margin-top:34px}
.row100k .facts .in{display:grid;grid-template-columns:1fr;max-width:760px;margin:0 auto}
.row100k .facts .cell{padding:16px 20px;border-bottom:1px solid var(--ink)}
.row100k .facts .cell:last-child{border-bottom:none}
.row100k .facts .k{font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase}
.row100k .facts .v{font-family:var(--row-archivo-black),sans-serif;font-size:20px;text-transform:uppercase;line-height:1.15;margin-top:4px}
.row100k .facts .v.blue{color:var(--water)}
.row100k .facts .v small{font-family:var(--row-archivo),sans-serif;font-weight:600;font-size:12px;color:var(--ink-soft);display:block;text-transform:none}
@media(min-width:640px){
  .row100k .facts .in{grid-template-columns:repeat(3,1fr)}
  .row100k .facts .cell{border-bottom:none;border-right:1px solid var(--ink)}
  .row100k .facts .cell:last-child{border-right:none}
}

.row100k section{padding:52px 0 8px}
.row100k .sec-head{display:flex;align-items:baseline;gap:12px;border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:22px;flex-wrap:wrap}
.row100k .sec-head h2{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,6vw,40px);text-transform:uppercase;letter-spacing:-.01em}
.row100k .sec-head .mono{font-size:12px;color:var(--water)}

.row100k .step{display:grid;grid-template-columns:64px 1fr;gap:14px;padding:16px 0;border-bottom:1px dashed var(--line)}
.row100k .step:last-child{border-bottom:none}
.row100k .step .d{font-family:var(--row-mono),monospace;font-size:13px;font-weight:700;color:var(--water)}
.row100k .step h3{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.row100k .step p{font-size:14px;color:var(--ink-soft);margin-top:3px}

.row100k .count{display:grid;grid-template-columns:repeat(4,1fr);border:2px solid var(--ink)}
.row100k .count .c{padding:20px 8px 16px;text-align:center;border-right:1px solid var(--ink)}
.row100k .count .c:last-child{border-right:none}
.row100k .count .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,9vw,58px);line-height:1;font-variant-numeric:tabular-nums}
.row100k .count .c:first-child .n{color:var(--water)}
.row100k .count .l{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;color:var(--gray);text-transform:uppercase;margin-top:7px}
.row100k .count-done{border:2px solid var(--water);color:var(--water);text-align:center;padding:26px 18px;font-size:14px;font-weight:700;letter-spacing:.04em}

/* Join / dashboard panel — paper with a heavy ink border (no dark slab). */
.row100k .panel{border:2px solid var(--ink);padding:26px 22px 30px;margin-top:8px}
.row100k .panel .p-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px}
.row100k .panel .p-head h3{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5vw,28px);text-transform:uppercase}
.row100k .panel .p-head .mono{font-size:11px;color:var(--water)}
.row100k label.fl{display:block;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin:20px 0 6px}
.row100k .panel input[type=text],.row100k .panel input[type=date],.row100k .panel input[type=number]{width:100%;background:transparent;border:none;border-bottom:2px solid var(--line);color:var(--ink);font-family:var(--row-archivo),sans-serif;font-size:17px;padding:8px 2px;border-radius:0;appearance:none}
.row100k .panel input:focus{outline:none;border-bottom-color:var(--water)}
.row100k .panel ::placeholder{color:#a5a49d}
.row100k .pills{display:flex;flex-wrap:wrap;gap:8px}
.row100k .pill input{position:absolute;opacity:0}
.row100k .pill span{display:inline-block;border:2px solid var(--line);padding:9px 16px;font-family:var(--row-mono),monospace;font-size:13px;cursor:pointer;user-select:none;color:var(--ink-soft)}
.row100k .pill input:checked + span{border-color:var(--water);color:var(--water)}
.row100k .pill input:focus-visible + span{outline:2px solid var(--water);outline-offset:2px}
.row100k .send{display:block;width:100%;margin-top:30px;background:var(--water);color:#fff;border:none;font-family:var(--row-archivo-black),sans-serif;font-size:20px;text-transform:uppercase;letter-spacing:.04em;padding:18px;cursor:pointer;text-align:center;text-decoration:none}
.row100k .send:hover{background:var(--water-hover)}
.row100k .send:disabled{background:#b9c9d2;color:#f0f4f6;cursor:default}
.row100k .goog{display:flex;width:100%;align-items:center;justify-content:center;gap:12px;background:var(--ink);color:var(--paper);border:none;font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:16px;padding:16px;margin-top:22px;cursor:pointer}
.row100k .goog:hover{background:var(--water)}
.row100k .goog svg{flex:none}
.row100k .form-err{margin-top:14px;font-family:var(--row-mono),monospace;font-size:12px;color:#b3400f;line-height:1.7}
.row100k .form-ok{border:2px solid var(--water);color:var(--water);text-align:center;font-family:var(--row-mono),monospace;padding:14px;margin-top:18px;font-size:13px;line-height:1.8}
.row100k .quiet-btn{background:none;border:none;color:var(--gray);font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0}
.row100k .quiet-btn:hover{color:var(--water)}

/* Shareables: the picker modal and its preview stage. Cards are painted
 * white-on-transparent, so the stage goes dark to make them visible, and the
 * checker grid marks the see-through part without needing a caption.
 * NB this whole string is rendered as the text child of a style tag, so it
 * must contain no double quotes and no angle brackets: React escapes those
 * server-side only, and hydration then fails on the mismatch. */
.row100k .share-probe{position:absolute;width:0;height:0;overflow:hidden;visibility:hidden}
.row100k .share-probe.blk{font-family:var(--row-archivo-black),sans-serif}
.row100k .share-probe.mono{font-family:var(--row-mono),monospace}
.row100k .share-overlay{position:fixed;inset:0;background:rgba(21,23,26,.62);display:flex;align-items:center;justify-content:center;padding:20px;z-index:80}
.row100k .share-modal{background:var(--paper);border:2px solid var(--ink);box-shadow:8px 8px 0 rgba(21,23,26,.2);width:min(560px,100%);max-height:90vh;overflow-y:auto;padding:16px 18px 18px}
.row100k .share-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--ink);padding-bottom:10px}
.row100k .share-head .mono{font-size:12px;letter-spacing:.12em}
.row100k .share-x{background:none;border:none;font-size:26px;line-height:1;cursor:pointer;color:var(--ink);padding:0 2px}
.row100k .share-x:hover{color:var(--water)}
.row100k .share-stage{margin-top:14px;border:2px solid var(--ink);padding:14px;background:var(--paper);overflow:hidden;touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none}
.row100k .share-stage:active{cursor:grabbing}
.row100k .share-dots{display:flex;gap:9px;justify-content:center;margin-top:12px}
.row100k .share-dots button{width:11px;height:11px;border-radius:50%;border:2px solid var(--ink);background:transparent;padding:0;cursor:pointer}
.row100k .share-dots button.on{background:var(--water);border-color:var(--water)}
.row100k .share-dots button:hover:not(.on){border-color:var(--water)}
.row100k .share-stage.dark{background:#1c2b33;background-image:linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%),linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%);background-size:24px 24px;background-position:0 0,12px 12px}
.row100k .share-canvas{display:block;width:100%;height:auto}
.row100k .share-note{margin-top:10px;font-size:11px;letter-spacing:.08em;color:var(--gray)}
.row100k .share-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.row100k .share-btn{border:2px solid var(--ink);background:none;color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;padding:11px 16px;cursor:pointer;flex:1 1 auto}
.row100k .share-btn:hover{background:var(--water);border-color:var(--water);color:#fff}
.row100k .share-btn.primary{background:var(--water);border-color:var(--water);color:#fff}
.row100k .share-btn.primary:hover{background:var(--water-hover);border-color:var(--water-hover)}
.row100k .share-status{margin-top:10px;font-size:11px;letter-spacing:.08em;color:var(--water)}
.row100k .share-status.bad{color:#b3400f}
.row100k .signed-note{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:14px;letter-spacing:.04em}

/* Rower-number bib card (join confirmation + dashboard header). */
.row100k .bib{max-width:340px;margin:6px auto 0;border:3px solid var(--ink);background:#fff;padding:18px 20px 16px;text-align:center;box-shadow:6px 6px 0 rgba(21,23,26,.14)}
.row100k .bib-actions{text-align:center;margin-top:16px}
.row100k .bib .pins{display:flex;justify-content:space-between;margin-bottom:6px}
.row100k .bib .pins i{width:10px;height:10px;border-radius:50%;border:2px solid var(--line);display:block}
.row100k .bib .ev{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.22em;color:var(--gray);text-transform:uppercase}
.row100k .bib .num{font-family:var(--row-archivo-black),sans-serif;font-size:64px;line-height:1;margin:6px 0 2px}
.row100k .bib .nm{font-family:var(--row-mono),monospace;font-size:12px;color:var(--water);letter-spacing:.08em;text-transform:uppercase}

/* Personal stats row inside the dashboard (and profiles). */
.row100k .me-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}
.row100k .me-stats.four{grid-template-columns:repeat(4,1fr)}
@media(max-width:560px){.row100k .me-stats.four{grid-template-columns:1fr 1fr}}
.row100k .me-stat{border:2px solid var(--ink);padding:14px 12px 12px;text-align:center}
.row100k .me-stat .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(18px,5vw,30px);line-height:1;font-variant-numeric:tabular-nums}
.row100k .me-stat .l{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;margin-top:6px}
.row100k .me-bar{margin-top:16px;height:14px;border:2px solid var(--ink);background:transparent;position:relative;overflow:hidden}
.row100k .me-bar .fill{position:absolute;inset:0;width:0%;background:linear-gradient(90deg,var(--water),#63b6dc)}
.row100k .me-bar-label{display:flex;justify-content:space-between;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--gray);margin-top:8px}
/* The two big actions on the dashboard: log (blue, links to the profile
 * form) and share (ink outline, opens the card dialog). Same voice as .send. */
.row100k .act-row{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}
.row100k .big-act{flex:1 1 180px;display:block;text-align:center;border:2px solid var(--ink);background:none;color:var(--ink);font-family:var(--row-archivo-black),sans-serif;font-size:17px;text-transform:uppercase;letter-spacing:.04em;padding:15px 14px;cursor:pointer;text-decoration:none}
.row100k .big-act:hover{border-color:var(--water);color:var(--water)}
.row100k .big-act.primary{background:var(--water);border-color:var(--water);color:#fff}
.row100k .big-act.primary:hover{background:var(--water-hover);border-color:var(--water-hover)}
.row100k .split-live{font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray);margin-top:10px;min-height:18px}
.row100k .grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}
@media(max-width:560px){.row100k .grid2{grid-template-columns:1fr}}

/* My rows table. */
.row100k table.mine{width:100%;border-collapse:collapse;font-family:var(--row-mono),monospace;font-size:13px;margin-top:8px}
.row100k table.mine th{text-align:left;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);font-weight:400;padding:8px 6px;border-bottom:2px solid var(--ink)}
.row100k table.mine td{padding:9px 6px;border-bottom:1px dashed var(--line);vertical-align:top}
.row100k table.mine td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .del-btn{background:none;border:none;color:var(--gray);font-family:var(--row-mono),monospace;font-size:11px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0}
.row100k .del-btn:hover{color:#b3400f}
.row100k .del-btn.save:hover{color:var(--water)}
/* Inline fix-a-mistake inputs: same underline language as the big form,
 * shrunk to table scale. */
.row100k table.mine td input{width:100%;min-width:86px;background:transparent;border:none;border-bottom:2px solid var(--line);color:var(--ink);font-family:var(--row-mono),monospace;font-size:13px;padding:3px 2px;border-radius:0;appearance:none}
.row100k table.mine td input:focus{outline:none;border-bottom-color:var(--water)}

/* Leaderboards. */
.row100k .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.row100k .tabs button{background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;cursor:pointer}
.row100k .tabs button.on{background:var(--ink);color:var(--paper)}
.row100k .tabs button:hover:not(.on){border-color:var(--water);color:var(--water)}
.row100k table.board{width:100%;border-collapse:collapse;font-family:var(--row-mono),monospace;font-size:13px}
.row100k table.board th{text-align:left;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);font-weight:400;padding:8px 6px;border-bottom:2px solid var(--ink)}
.row100k table.board td{padding:10px 6px;border-bottom:1px dashed var(--line);vertical-align:middle}
.row100k table.board td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k table.board .rk{color:var(--gray);width:44px;font-variant-numeric:tabular-nums}
.row100k table.board .who{font-family:var(--row-archivo),sans-serif;font-weight:700}
.row100k table.board .who a{text-decoration:none}
.row100k table.board .who a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .dtag{display:inline-block;font-size:10px;border:1px solid var(--gray);color:var(--gray);padding:0 5px;margin-left:8px;vertical-align:1px;font-family:var(--row-mono),monospace}
.row100k .donebadge{display:inline-block;font-size:10px;background:var(--water);color:#fff;padding:1px 6px;margin-left:8px;vertical-align:1px;font-family:var(--row-mono),monospace}
.row100k .rowbar{height:5px;background:#e3e1d8;margin-top:6px}
.row100k .rowbar .f{height:100%;background:var(--water)}
.row100k .board-empty{font-family:var(--row-mono),monospace;font-size:13px;color:var(--gray);padding:18px 0;line-height:1.8}

/* Record callout cards — clickable: each one filters the table below it.
 * Hierarchy: blue digits biggest, unit quiet, holder name bold sans, meta
 * small mono, runners-up smallest. */
.row100k .rec-eyebrow{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;color:var(--gray);text-transform:uppercase;margin:26px 0 10px}
.row100k .rec-eyebrow:first-child{margin-top:0}
.row100k .records{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.row100k .records.vol{grid-template-columns:1fr 1fr}
@media(max-width:640px){.row100k .records,.row100k .records.vol{grid-template-columns:1fr}}
.row100k .rec{display:block;width:100%;text-align:left;background:transparent;border:2px solid var(--ink);padding:14px 16px 12px;font-family:var(--row-archivo),sans-serif;color:var(--ink)}
.row100k button.rec{cursor:pointer}
.row100k button.rec:hover{border-color:var(--water)}
.row100k button.rec[aria-pressed=true]{background:var(--water-pale);border-color:var(--water);box-shadow:4px 4px 0 var(--water)}
.row100k .rec .t{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase}
.row100k .rec .v{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(24px,6vw,32px);margin-top:6px;font-variant-numeric:tabular-nums;line-height:1.1;color:var(--water)}
.row100k .rec .v em{font-style:normal;font-size:.55em;color:var(--gray);font-family:var(--row-archivo),sans-serif;font-weight:700}
.row100k .rec .hold{font-weight:700;font-size:14px;color:var(--ink);margin-top:6px}
.row100k .rec .meta{font-family:var(--row-mono),monospace;font-size:10px;color:var(--gray);margin-top:2px}
.row100k .rec .also{margin-top:10px;border-top:1px dashed var(--line);padding-top:7px;font-family:var(--row-mono),monospace;font-size:10px;color:var(--gray);line-height:1.9}
.row100k .rec .also b{color:var(--ink-soft);font-weight:400}
.row100k .rec-empty{font-family:var(--row-mono),monospace;font-size:10px;color:var(--gray);margin-top:8px;line-height:1.7}
.row100k .rec-open{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;color:var(--water);margin-top:9px;text-transform:uppercase}
/* Stats page: every record card carries both boards at once. */
.row100k .records.solo{grid-template-columns:1fr}
.row100k .rec.headline .v{font-size:clamp(28px,7vw,40px)}
.row100k .rec .duo{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;margin-top:8px}
.row100k .rec .duo .side+.side{border-left:1px dashed var(--line);padding-left:16px}
.row100k .rec .duo .dv{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.18em;color:var(--water);text-transform:uppercase}
.row100k .rec .duo .v{margin-top:4px}
.row100k .stats-link{margin-top:22px;flex:none;width:100%}
@media(max-width:640px){.row100k .records .rec .duo{grid-template-columns:1fr 1fr}}

/* Movement arrows + finisher rows in the standings table. */
.row100k .mv{font-family:var(--row-mono),monospace;font-size:11px;white-space:nowrap}
.row100k .mv.up{color:var(--water)}
.row100k .mv.dn{color:#b3400f}
.row100k tr.fin td{background:var(--water-pale)}
.row100k tr.divrow td{border-bottom:2px solid var(--ink);padding:14px 6px 6px;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--water);text-transform:uppercase}
.row100k tr.divrow.rest td{color:var(--gray)}

/* The curve — cumulative community meters. */
.row100k .curve{border:2px solid var(--ink);padding:18px 16px 10px;margin-top:34px;position:relative}
.row100k .curve .t{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase;margin-bottom:8px}
.row100k .curve svg{display:block;width:100%;height:auto}
.row100k .curve .tip{position:absolute;pointer-events:none;background:var(--ink);color:var(--paper);font-family:var(--row-mono),monospace;font-size:11px;padding:5px 8px;white-space:nowrap;transform:translate(-50%,-130%);z-index:5}

/* Community strip above the boards. */
.row100k .comm{display:grid;grid-template-columns:repeat(4,1fr);border:2px solid var(--ink);margin-bottom:28px}
.row100k .comm .c{padding:16px 8px 13px;text-align:center;border-right:1px solid var(--ink)}
.row100k .comm .c:last-child{border-right:none}
.row100k .comm .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(17px,4.6vw,30px);line-height:1;font-variant-numeric:tabular-nums}
.row100k .comm .l{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;margin-top:6px}
@media(max-width:560px){.row100k .comm{grid-template-columns:1fr 1fr}.row100k .comm .c:nth-child(2){border-right:none}.row100k .comm .c:nth-child(-n+2){border-bottom:1px solid var(--ink)}}

.row100k .share-btn{background:var(--water);color:#fff;border:none;font-family:var(--row-archivo-black),sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:.04em;padding:12px 18px;cursor:pointer}
.row100k .share-btn:hover{background:var(--water-hover)}
.row100k .pace-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.06em;color:var(--gray);margin-top:12px;line-height:1.9;text-transform:uppercase}
.row100k .pace-note b{color:var(--water);font-weight:700}

/* Rower profile. */
.row100k .prof-name{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(28px,7vw,44px);text-transform:uppercase;line-height:1.02;letter-spacing:-.01em}
.row100k .prof-ig{font-family:var(--row-mono),monospace;font-size:13px;color:var(--water);text-decoration:none;letter-spacing:.04em}
.row100k .prof-ig:hover{text-decoration:underline;text-underline-offset:3px}
.row100k .back-link{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;text-decoration:none;color:var(--gray)}
.row100k .back-link:hover{color:var(--water)}

/* September heatmap (GitHub-commit style, one month, no day numbers). */
.row100k .hm{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.row100k .hm .dow{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;color:var(--gray);text-align:center;padding-bottom:3px}
.row100k .hm-cell{aspect-ratio:1;border:1px dashed var(--line)}
.row100k .hm-cell.b1{background:#d9e8f2;border:1px solid #d9e8f2}
.row100k .hm-cell.b2{background:#a5cde3;border:1px solid #a5cde3}
.row100k .hm-cell.b3{background:#4d9fc9;border:1px solid #4d9fc9}
.row100k .hm-cell.b4{background:var(--water);border:1px solid var(--water)}
.row100k .hm-legend{display:flex;align-items:center;gap:6px;margin-top:12px;font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase}
.row100k .hm-legend i{width:12px;height:12px;display:block}

/* Chinese-takeout-menu stat list (dotted leaders, number on the right). */
.row100k ul.menu{list-style:none;margin-top:4px}
.row100k .menu li{display:flex;align-items:baseline;gap:8px;padding:7px 0}
.row100k .menu .k{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;color:var(--ink-soft);text-transform:uppercase;white-space:nowrap}
.row100k .menu .dots{flex:1;border-bottom:2px dotted var(--line);transform:translateY(-3px);min-width:24px}
.row100k .menu .val{font-family:var(--row-mono),monospace;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k .menu .val.blue{color:var(--water)}
.row100k .menu .val.dim{color:var(--gray);font-weight:400}

.row100k footer{padding:44px 20px 64px;border-top:2px solid var(--ink);margin-top:56px}
.row100k footer .big{font-family:var(--row-archivo-black),sans-serif;font-size:13px;letter-spacing:.1em;margin-bottom:10px}
.row100k footer .mono{font-size:11px;color:var(--gray);line-height:1.9}
.row100k footer a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.row100k footer a:hover{color:var(--water)}

/* Stay light in dark mode, but take the glare off (same as /lasd26). */
@media (prefers-color-scheme: dark){
  .row100k{--paper:#E9E7DF}
  .row100k .frame img,.row100k .inter img{filter:brightness(.94)}
}
`;
