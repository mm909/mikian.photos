import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";

/* Shared look for /lasd26 and its sub-pages (/lasd26/the-list): fonts, the
 * noise tile, and the full scoped stylesheet under the .lasd26 wrapper. */

export const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--lasd-archivo",
});
export const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--lasd-archivo-black",
});
export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--lasd-mono",
});

/* Faint 2x2 noise tile carried over from the original one-pager. */
const NOISE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP88vkdAwMDEwMDAwMDAwAiLALZuZcPKwAAAABJRU5ErkJggg==";

export const css = `
.lasd26,.lasd26 *{margin:0;padding:0;box-sizing:border-box}
.lasd26{
  --paper:#F4F3EE; --ink:#111110; --ink-soft:#3d3d3a; --gray:#8a8a85; --safety:#FF4B00; --frame:#000;
  background:var(--paper) url(${NOISE}) repeat;
  color:var(--ink);
  font-family:var(--lasd-archivo),sans-serif;
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;
  min-height:100vh;width:100%;color-scheme:light;
}
@media (prefers-reduced-motion: reduce){ .lasd26 *{transition:none!important;animation:none!important} }
.lasd26 .mono{font-family:var(--lasd-mono),monospace}
.lasd26 .wrap{max-width:720px;margin:0 auto;padding:0 20px}
.lasd26 a{color:inherit}
.lasd26 :focus-visible{outline:2px solid var(--safety);outline-offset:3px}

.lasd26 .bar{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:2px solid var(--ink);position:sticky;top:0;background:var(--paper) url(${NOISE}) repeat;z-index:50}
.lasd26 .bar .mono{font-size:12px;letter-spacing:.08em}
.lasd26 .bar .tag{background:var(--ink);color:var(--paper);padding:3px 8px}
.lasd26 .bar a{text-decoration:underline;text-underline-offset:3px}
.lasd26 .bar a:hover{color:var(--safety)}

.lasd26 .hero{padding:28px 20px 8px}
.lasd26 .hero h1{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(46px,13vw,110px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase}
.lasd26 .hero h1 .o{color:var(--safety)}
.lasd26 .hero .sub{margin-top:16px;max-width:52ch;color:var(--ink-soft);font-size:15px}

.lasd26 .cc-mark{display:inline-block;margin-top:22px;font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(22px,6.4vw,36px);text-transform:uppercase;letter-spacing:.01em;color:#111;background:var(--safety);padding:7px 16px 6px;transform:rotate(-1.2deg) skewX(-2deg)}

.lasd26 .frame{margin:26px auto 0;max-width:720px;padding:0 20px}
.lasd26 .frame .ph,.lasd26 .inter .ph{border:14px solid var(--frame);background:var(--frame)}
.lasd26 .frame img,.lasd26 .inter img{display:block;width:100%;height:auto}
.lasd26 .inter{margin:56px auto 0;max-width:720px;padding:0 20px}

.lasd26 .facts{border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);margin-top:34px}
.lasd26 .facts .in{display:grid;grid-template-columns:1fr 1fr;max-width:720px;margin:0 auto}
.lasd26 .facts .cell{padding:16px 20px;border-bottom:1px solid var(--ink)}
.lasd26 .facts .cell:nth-child(odd){border-right:1px solid var(--ink)}
.lasd26 .facts .cell:nth-last-child(-n+2){border-bottom:none}
.lasd26 .facts .k{font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase}
.lasd26 .facts .v{font-family:var(--lasd-archivo-black),sans-serif;font-size:20px;text-transform:uppercase;line-height:1.15;margin-top:4px}
.lasd26 .facts .v small{font-family:var(--lasd-archivo),sans-serif;font-weight:600;font-size:12px;color:var(--ink-soft);display:block;text-transform:none}

.lasd26 section{padding:52px 0 8px}
.lasd26 .sec-head{display:flex;align-items:baseline;gap:12px;border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:22px;flex-wrap:wrap}
.lasd26 .sec-head h2{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(26px,6vw,40px);text-transform:uppercase;letter-spacing:-.01em}
.lasd26 .sec-head .mono{font-size:12px;color:var(--safety)}

.lasd26 .day{display:grid;grid-template-columns:86px 1fr;gap:14px;padding:16px 0;border-bottom:1px dashed #c9c8c0}
.lasd26 .day:last-child{border-bottom:none}
.lasd26 .day .d{font-family:var(--lasd-mono),monospace;font-size:13px;font-weight:700}
.lasd26 .day .d span{display:block;color:var(--gray);font-weight:400;font-size:11px}
.lasd26 .day h3{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.lasd26 .day p{font-size:14px;color:var(--ink-soft);margin-top:3px}
.lasd26 .day.race{background:#111;color:#F4F3EE;margin:0 -20px;padding:18px 20px;border-bottom:none}
.lasd26 .day.race .d,.lasd26 .day.race .d span{color:var(--safety)}
.lasd26 .day.race p{color:#c9c8c0}

.lasd26 .count{display:grid;grid-template-columns:repeat(4,1fr);border:2px solid var(--ink)}
.lasd26 .count .c{padding:20px 8px 16px;text-align:center;border-right:1px solid var(--ink)}
.lasd26 .count .c:last-child{border-right:none}
.lasd26 .count .n{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(30px,9vw,58px);line-height:1;font-variant-numeric:tabular-nums}
.lasd26 .count .c:last-child .n{color:var(--safety)}
.lasd26 .count .l{font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.14em;color:var(--gray);text-transform:uppercase;margin-top:7px}
.lasd26 .count-done{border:2px solid var(--safety);color:var(--safety);text-align:center;padding:26px 18px;font-size:14px;font-weight:700;letter-spacing:.04em}

.lasd26 .form-sec{background:#111;color:#F4F3EE;margin-top:56px;padding:56px 0 72px}
.lasd26 .form-sec .sec-head{border-color:#F4F3EE}
.lasd26 .form-sec .sec-head h2{color:#F4F3EE}
.lasd26 .form-sec label.fl{display:block;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9a9a94;margin:22px 0 7px}
.lasd26 .form-sec input[type=text],.lasd26 .form-sec input[type=email]{width:100%;background:transparent;border:none;border-bottom:2px solid #444;color:#F4F3EE;font-family:var(--lasd-archivo),sans-serif;font-size:17px;padding:8px 2px;border-radius:0;appearance:none}
.lasd26 .form-sec input[type=text]:focus,.lasd26 .form-sec input[type=email]:focus{outline:none;border-bottom-color:var(--safety)}
.lasd26 .pills{display:flex;flex-wrap:wrap;gap:8px}
.lasd26 .pill input{position:absolute;opacity:0}
.lasd26 .pill span{display:inline-block;border:2px solid #555;padding:9px 16px;font-family:var(--lasd-mono),monospace;font-size:13px;cursor:pointer;user-select:none}
.lasd26 .pill input:checked + span{border-color:var(--safety);color:var(--safety)}
.lasd26 .pill input:focus-visible + span{outline:2px solid var(--safety);outline-offset:2px}
.lasd26 .send{display:block;width:100%;margin-top:34px;background:var(--safety);color:#111;border:none;font-family:var(--lasd-archivo-black),sans-serif;font-size:22px;text-transform:uppercase;letter-spacing:.04em;padding:20px;cursor:pointer;text-align:center;text-decoration:none}
.lasd26 .send:hover{background:#ff6a2b}
.lasd26 .send:disabled{background:#3d3d3a;color:#9a9a94;cursor:default}
.lasd26 .sent{border:2px solid var(--safety);color:var(--safety);text-align:center;font-family:var(--lasd-mono),monospace;padding:26px 18px;margin-top:34px;font-size:13px;line-height:1.8}
.lasd26 .sent a{color:var(--safety)}
.lasd26 .sim-btn{display:block;width:100%;margin-top:12px;background:transparent;border:2px dashed #555;color:#9a9a94;font-size:12px;letter-spacing:.08em;padding:12px;cursor:pointer}
.lasd26 .sim-btn:hover{border-color:var(--safety);color:var(--safety)}
.lasd26 .sim-btn:disabled{opacity:.5;cursor:default}
.lasd26 .sim-note{margin-top:12px;font-size:11px;color:#9a9a94;text-align:center;letter-spacing:.08em}
.lasd26 .sim-note button{background:none;border:none;color:var(--safety);font-family:inherit;font-size:inherit;letter-spacing:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0}

.lasd26 table.pile{width:100%;border-collapse:collapse;font-family:var(--lasd-mono),monospace;font-size:13px}
.lasd26 table.pile th{text-align:left;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);font-weight:400;padding:8px 6px;border-bottom:2px solid var(--ink)}
.lasd26 table.pile td{padding:9px 6px;border-bottom:1px dashed #c9c8c0;word-break:break-word;vertical-align:top}
.lasd26 table.pile a{text-decoration:underline;text-underline-offset:3px}
.lasd26 table.pile a:hover{color:var(--safety)}
.lasd26 .list-empty{font-family:var(--lasd-mono),monospace;font-size:13px;color:var(--gray);padding:18px 0}
.lasd26 .clear-btn{margin-top:22px;background:transparent;border:2px solid var(--ink);color:var(--ink);font-size:13px;font-weight:700;letter-spacing:.06em;padding:11px 20px;cursor:pointer}
.lasd26 .clear-btn:hover{border-color:var(--safety);color:var(--safety)}
.lasd26 .clear-btn:disabled{opacity:.5;cursor:default}
.lasd26 .clear-err{margin-top:12px;font-size:12px;color:var(--safety)}
.lasd26 .owner-link{max-width:720px;margin:34px auto 0;padding:0 20px;font-size:12px}

.lasd26 footer{padding:44px 20px 64px;border-top:2px solid var(--ink)}
.lasd26 footer .big{font-family:var(--lasd-archivo-black),sans-serif;font-size:13px;letter-spacing:.1em;margin-bottom:10px}
.lasd26 footer .mono{font-size:11px;color:var(--gray);line-height:1.9}
.lasd26 footer a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.lasd26 footer a:hover{color:var(--safety)}

@media(min-width:720px){
  .lasd26 .facts .in{grid-template-columns:repeat(4,1fr)}
  .lasd26 .facts .cell{border-bottom:none;border-right:1px solid var(--ink)}
  .lasd26 .facts .cell:last-child{border-right:none}
}

/* Stay light in dark mode, but take the glare off (dm-dim treatment). */
@media (prefers-color-scheme: dark){
  .lasd26{--paper:#E9E7DF}
  .lasd26 .frame img,.lasd26 .inter img{filter:brightness(.94)}
}
`;
