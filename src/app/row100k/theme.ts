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

.row100k .bar{display:flex;align-items:center;gap:18px;padding:14px 20px;border-bottom:2px solid var(--ink);position:sticky;top:0;background:var(--paper) url(${NOISE}) repeat;z-index:50}
.row100k .bar .mono{font-size:12px;letter-spacing:.08em}
.row100k .bar .tag{background:var(--water);color:#fff;padding:3px 8px}
/* Who is putting this on, then what it is: the Mikian.Musser wordmark from
 * the landing page leads (kept, blue dot and all — owner call 2026-09-05),
 * the ROWTEMBER mark opens the nav rail beside it, so the bar reads as
 * Mikian Musser hosting Rowtember. */
.row100k .bar-lead{display:flex;align-items:center;gap:12px;flex:none;min-width:0}
.row100k .bar-brand{font-family:var(--row-archivo-black),sans-serif;font-size:12px;line-height:1;letter-spacing:.05em;text-transform:uppercase;color:var(--ink);text-decoration:none;white-space:nowrap;transition:color 160ms ease}
.row100k .bar-brand .dot{color:var(--water)}
.row100k .bar-brand:hover{color:var(--water)}
/* Nav rail + the one blue pill (owner call, 2026-09-05). ROWTEMBER and the
 * section links share a strip; one straight water-blue rectangle rests
 * under the current page and slides to whatever the pointer is over (BarNav
 * measures and moves it). Colour rules: the item under the pill is white;
 * ROWTEMBER off the pill is water-blue and stays Archivo Black; every other
 * item off the pill is the gray mono of .back-link. Until the client has
 * measured, the active link paints its own blue box (.on) so the server
 * markup already looks right; .live hands over to the pill. .jump switches
 * every transition off for one frame so the pill can be placed, not flown.
 * Both link boxes are 27px tall (16px line + padding) so the pill keeps
 * its height as it crosses from the mark to the mono links. No skew. */
.row100k .rail{position:relative;display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}
.row100k .rail a{position:relative;z-index:1;display:inline-block;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.08em;line-height:16px;text-transform:uppercase;text-decoration:none;color:var(--gray);padding:6px 9px 5px;white-space:nowrap;transition:color 160ms ease}
.row100k .rail a.brand{font-family:var(--row-archivo-black),sans-serif;font-size:13px;letter-spacing:.01em;color:var(--water);padding:6px 10px 5px}
.row100k .rail a.lit{color:#fff}
.row100k .rail:not(.live) a.on{background:var(--water)}
.row100k .rail-pill{position:absolute;z-index:0;left:0;top:0;width:0;height:0;background:var(--water);opacity:0;pointer-events:none;transition:left 220ms cubic-bezier(.2,.7,.2,1),top 220ms cubic-bezier(.2,.7,.2,1),width 220ms cubic-bezier(.2,.7,.2,1),height 220ms cubic-bezier(.2,.7,.2,1),opacity 160ms ease}
.row100k .rail.jump .rail-pill,.row100k .rail.jump a{transition:none}
.row100k .rail-break{display:none}
/* Right-hand chip group pushes itself to the far edge so the bar needs no
 * justify rule. */
.row100k .bar-right{display:flex;align-items:center;gap:12px;margin-left:auto}
/* Phone widths (560px and under): an intentional two-row bar — wordmark,
 * ROWTEMBER and the account chip on the masthead row, the section links on
 * their own dashed-ruled row beneath. The rail gives up its box (display
 * contents) so ROWTEMBER can sit up top with the wordmark while the rest
 * drop past the break; the pill then positions against the bar, which is
 * why RowBar keeps the bar positioned even when it is not sticky. Both link
 * boxes are 25px here. */
@media(max-width:560px){
  .row100k .bar{flex-wrap:wrap;gap:8px 4px;padding:10px 16px 12px}
  .row100k .bar-brand{font-size:11px;letter-spacing:.03em}
  .row100k .rail{display:contents}
  .row100k .rail a{font-size:11px;letter-spacing:.06em;padding:5px 6px 4px;order:2}
  .row100k .rail a.brand{font-size:12px;padding:5px 8px 4px;margin-left:6px;order:0}
  .row100k .rail-break{display:block;flex-basis:100%;height:0;border-top:1px dashed var(--line);order:1}
}
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
/* Phone masthead row has to hold wordmark + ROWTEMBER + this chip at 360px;
 * a tighter chip buys the room. Sits after the base rule so it wins. */
@media(max-width:560px){
  .row100k .acct-chip{letter-spacing:.06em;padding:6px 10px}
}

/* ----------------------------------------------------------------------
 * The front page (owner call, 2026-09-05: the front page of the newspaper
 * — the nameplate, then the news; nothing sells, the pitch is in pitch.ts).
 * The front page is set on the landing measure (1040 = 1000 + gutters) so
 * a signed-in rower gets their meters at exactly the landing counter width;
 * every inside page keeps the 760 column. Under 560px the year drops to
 * its own line so ROWTEMBER can be as big as the phone allows: 14.5vw - 6px
 * is (100vw - 40px) / 6.68em (the width of ROWTEMBER in Archivo Black);
 * one line from 561px is 10.2vw - 4px for the 9.65em of ROWTEMBER 2026,
 * and 100px is where 965px fills the 1000px measure. */
.row100k .wrap.front{max-width:1040px}
.row100k .front-head{padding:26px 0 0}
.row100k .front-head h1{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(24px,calc(10vw - 4px),100px);line-height:.9;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:.12em;white-space:nowrap}
.row100k .front-head .yr{display:inline}
.row100k .front-date{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);padding-top:8px}
@media(min-width:561px){
  .row100k .front-head h1{font-size:min(calc(10.2vw - 4px),100px)}
}
/* Front-page sections sit tighter than the inside pages (52px). */
.row100k section.fs{padding:28px 0 0}
.row100k section.front-cta{padding-top:clamp(34px,7vh,64px)}
/* Everyone together: bold number over a lighter descriptor, two tiles. */
.row100k .front-stats{display:grid;grid-template-columns:1fr;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.row100k .front-stats .cell{padding:16px 0 15px;border-bottom:1px solid var(--ink);min-width:0}
.row100k .front-stats .cell:last-child{border-bottom:none}
.row100k .front-stats .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,6.4vw,48px);line-height:1;font-variant-numeric:tabular-nums}
.row100k .front-stats .l{font-size:11px;letter-spacing:.14em;color:var(--gray);text-transform:uppercase;margin-top:7px}
@media(min-width:640px){
  .row100k .front-stats{grid-template-columns:1fr 1fr}
  .row100k .front-stats .cell{border-bottom:none;border-right:1px solid var(--ink);padding-right:18px}
  .row100k .front-stats .cell+.cell{border-right:none;padding-left:18px}
}
/* The leader headline and the clock: one box each, the same size, side by
 * side from 640px, stacked on a phone. The grid stretches both to the
 * taller one, and the clock cells centre themselves in the extra height. */
.row100k .front-duo{display:grid;grid-template-columns:1fr;gap:14px;align-items:stretch}
@media(min-width:640px){.row100k .front-duo{grid-template-columns:1fr 1fr}}
.row100k .front-box{border:2px solid var(--ink);padding:14px 16px 16px;min-width:0}
.row100k .front-box .eyebrow{font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase}
.row100k .front-box .head{font-size:12px;font-weight:700;letter-spacing:.12em;color:var(--water);text-transform:uppercase;margin-top:6px}
.row100k .front-box .v{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(24px,6vw,36px);line-height:1.05;margin-top:8px;font-variant-numeric:tabular-nums}
.row100k .front-box .nm{font-weight:700;font-size:14px;margin-top:6px}
.row100k .front-box .nm a{text-decoration:none}
.row100k .front-box .nm a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .front-box.clock{display:flex;flex-direction:column}
.row100k .front-box.clock .count,.row100k .front-box.clock .count-done{flex:1;margin-top:8px}
/* The corner clock (Countdown size small): the box is the parent, the
 * numerals a third of the big clock. */
.row100k .count.small{border:none}
.row100k .count.small .c{padding:8px 4px 6px;display:flex;flex-direction:column;justify-content:center}
.row100k .count.small .n{font-size:clamp(22px,5vw,34px)}
.row100k .count.small .l{font-size:9px;letter-spacing:.12em;margin-top:5px}
.row100k .count-done.small{padding:14px 10px;font-size:12px}
/* The top three men and women: two compact boards. */
.row100k .front-top{display:grid;grid-template-columns:1fr;gap:22px}
@media(min-width:640px){.row100k .front-top{grid-template-columns:1fr 1fr}}
.row100k .front-three{min-width:0}
.row100k .front-three h3{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .front-three table.board td{padding:9px 6px}
/* The latest row, one mono line; also the one line on the board page for
 * a signed-out visitor. */
.row100k .front-latest{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);line-height:1.8}
.row100k .front-latest b{color:var(--ink);font-weight:700}
/* The signed-in top: the meters of the rower in the landing counter, the
 * same geometry as .home .od (Home.tsx): Archivo Black digits are .667em
 * and the comma .333em, so the cells are .68em and .34em, and eight digits
 * plus two commas make 6.12em; the size formula is the landing one, so the
 * two counters are the same width on the same screen. Static digits, the
 * leading zeros dimmed; tapping it opens the profile. */
.row100k .my-od-link{display:block;text-decoration:none;color:inherit;margin-top:6px}
.row100k .my-od{--od-size:clamp(40px,min(calc(16.3vw - 10px),30vh),160px);--od-cw:.68em;--od-sw:.34em;display:flex;align-items:flex-start;font-family:var(--row-archivo-black),sans-serif;font-size:var(--od-size);line-height:1;color:var(--water);letter-spacing:0;font-variant-numeric:tabular-nums;transition:color 160ms ease}
.row100k .my-od-link:hover .my-od{color:var(--ink)}
.row100k .my-od .cell{flex:none;width:var(--od-cw);height:1em;text-align:center}
.row100k .my-od .sep{flex:none;width:var(--od-sw);height:1em;text-align:center}
.row100k .my-od .lead{opacity:.25}
.row100k .my-unit{margin-top:14px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
.row100k .my-unit b{color:var(--ink);font-weight:700}
/* LOG A ROW on the left (the OPT IN button, relabelled), SHARE on the
 * right in the same face, smaller and without the arrow; the log form
 * opens beneath them (LogInPlace). */
.row100k .act-row.front{justify-content:space-between;align-items:baseline;gap:10px 20px;margin-top:clamp(22px,4vh,40px)}
/* margin-left auto keeps SHARE on the right even when a 375px phone wraps
 * it under LOG A ROW (38px minimum type plus the arrow is wider than the
 * column with SHARE beside it). */
.row100k .front-share{margin-left:auto;background:none;border:none;padding:0;cursor:pointer;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(18px,4vw,34px);line-height:1;text-transform:uppercase;letter-spacing:-.01em;color:var(--ink);text-decoration:underline;text-decoration-color:var(--water);text-decoration-thickness:.09em;text-underline-offset:.12em;text-decoration-skip-ink:none;transition:color 160ms ease}
.row100k .front-share:hover{color:var(--water)}
/* The log form (LogRow, which carries its own flat panel) sits under the
 * act row, on a rule so it reads as opened, not as more page. */
.row100k .front-log{margin-top:18px;border-top:2px solid var(--ink);padding-top:6px}
.row100k .front-id{margin-top:22px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft)}
/* The join form, vertical: one field a line, one board pill a line, then
 * OPT IN as the submit. */
.row100k .join-v .fl:first-child{margin-top:0}
.row100k .join-v .pills.col{flex-direction:column;gap:8px}
.row100k .join-v .pills.col .pill{display:block}
.row100k .join-v .pills.col .pill span{display:block;width:100%;text-align:left}
.row100k .join-go{margin-top:28px}

.row100k .frame{margin:26px auto 0;max-width:760px;padding:0 20px}
.row100k .frame .ph,.row100k .inter .ph{border:14px solid var(--frame);background:var(--frame)}
.row100k .frame img,.row100k .inter img{display:block;width:100%;height:auto}
.row100k .inter{margin:56px auto 0;max-width:760px;padding:0 20px}

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
/* The log form drops the box (the owner found the 2px outline hard, like a
 * C# dialog, 2026-09-05): same underline inputs, no border, no padding,
 * dashed hairlines between its rows instead. The join form keeps the box. */
.row100k .panel.flat{border:none;padding:0;margin-top:0}
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
.row100k .share-head{position:relative;display:flex;justify-content:center;align-items:center;border-bottom:2px solid var(--ink);padding-bottom:10px;min-height:30px}
.row100k .share-mark{display:inline-block;font-family:var(--row-archivo-black),sans-serif;font-size:14px;line-height:1;letter-spacing:.01em;text-transform:uppercase;color:#fff;background:var(--water);padding:7px 12px 6px}
.row100k .share-x{position:absolute;right:0;top:0;background:none;border:none;font-size:26px;line-height:1;cursor:pointer;color:var(--ink);padding:0 2px}
.row100k .share-x:hover{color:var(--water)}
.row100k .share-picker{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.row100k .share-pick{border:2px solid var(--line);background:none;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:7px 11px;cursor:pointer;color:var(--ink-soft)}
.row100k .share-pick.on{border-color:var(--ink);color:var(--ink)}
.row100k .share-stage{margin-top:14px;border:2px solid var(--ink);padding:14px;background:var(--paper)}
.row100k .share-stage.dark{background:#1c2b33;background-image:linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%),linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%);background-size:24px 24px;background-position:0 0,12px 12px}
.row100k .share-canvas{display:block;width:100%;height:auto}
.row100k .share-note{margin-top:10px;font-size:11px;letter-spacing:.08em;color:var(--gray)}
.row100k .share-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
/* The ONE .share-btn rule set (a second, later definition used to override
 * this into a blue Archivo block; it is gone): outlined mono by default,
 * .primary filled water, .quiet a gray outline for the exit nobody on a
 * phone needs. .share-link is the phone DOWNLOAD — a text link under the
 * two filled buttons. */
.row100k .share-btn{border:2px solid var(--ink);background:none;color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:12px 16px;cursor:pointer;flex:1 1 auto;border-radius:0}
.row100k .share-btn:hover{background:var(--water);border-color:var(--water);color:#fff}
.row100k .share-btn.primary{background:var(--water);border-color:var(--water);color:#fff}
.row100k .share-btn.primary:hover{background:var(--water-hover);border-color:var(--water-hover)}
.row100k .share-btn.quiet{border-color:var(--line);color:var(--gray);flex:0 1 auto}
.row100k .share-btn.quiet:hover{background:none;border-color:var(--ink);color:var(--ink)}
.row100k .share-link{display:block;width:100%;margin-top:12px;background:none;border:none;padding:4px 0;text-align:center;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.row100k .share-link:hover{color:var(--water)}
.row100k .share-status{margin-top:10px;font-size:11px;letter-spacing:.08em;color:var(--water)}
.row100k .share-status.bad{color:#b3400f}
.row100k .signed-note{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:14px;letter-spacing:.04em}


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
/* Log-a-row form (LogRow.tsx). The owner wanted meters and time to be THE
 * numbers and the day and title to read as inferred, secondary information
 * (2026-09-05), so the form is two tiers: the big pair in Archivo Black at
 * stat size over a plain underline, the split readout beneath them, then a
 * dashed hairline and the small pair. The form styles its own inputs (the
 * front page mounts it outside any panel). No box, no skew. */
.row100k .logf-big{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}
.row100k .logf-big label.fl{margin-top:6px}
.row100k .logf input.logf-num{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8vw,52px);line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums;padding:4px 0 8px}
.row100k .logf input.logf-num::placeholder{color:var(--line)}
.row100k .logf .split-live{margin-top:12px;font-size:13px}
.row100k .logf .split-live b{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
.row100k .logf-small{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;border-top:1px dashed var(--line);margin-top:16px}
.row100k .logf-small input[type=text],.row100k .logf-small input[type=date]{font-size:15px;color:var(--ink-soft)}
.row100k .logf-photos{border-top:1px dashed var(--line);margin-top:24px}
.row100k .logf .send{margin-top:26px;font-size:18px;padding:16px}
.row100k .logf .form-ok{border:none;border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);text-align:left;padding:14px 0}
/* The second-look strip: sits between the photos and the button when a row
 * falls outside the band everyone else has logged. It asks, it never
 * blocks — both answers are plain outline buttons. */
.row100k .logf-ask{margin-top:22px;border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);padding:14px 0 16px}
.row100k .logf-ask .k{display:block;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--water)}
.row100k .logf-ask p{margin-top:6px;font-size:14px;line-height:1.5;color:var(--ink-soft)}
.row100k .logf-ask p b{color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .logf-ask-acts{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
@media(max-width:560px){.row100k .logf-big,.row100k .logf-small{grid-template-columns:1fr;gap:0}}

/* My rows — the photo ledger on the editable log (own profile + admin view).
 * Each row is an ink-bordered strip: photo pair at the left, numbers in the
 * middle, a vertical-ellipsis menu on a dashed rail. */
.row100k .mlg-strip{display:flex;align-items:stretch;border:2px solid var(--ink);margin-bottom:10px}
.row100k .mlg-pics{display:flex;flex-shrink:0;border-right:1px dashed var(--line)}
.row100k .mlg-pics a{display:block}
.row100k .mlg-pics img{display:block;width:64px;height:64px;object-fit:cover}
.row100k .mlg-pics a + a img{border-left:1px solid var(--frame)}
.row100k .mlg-noph{width:64px;min-height:64px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--gray);font-family:var(--row-mono),monospace;font-size:12px;border-right:1px dashed var(--line)}
.row100k .mlg-mid{flex:1;min-width:0;padding:8px 14px;display:flex;flex-direction:column;justify-content:center;gap:3px}
.row100k .mlg-meta{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);display:flex;gap:12px;flex-wrap:wrap}
.row100k .mlg-nums{display:flex;align-items:baseline;gap:12px;font-variant-numeric:tabular-nums;flex-wrap:wrap}
.row100k .mlg-m{font-family:var(--row-archivo-black),sans-serif;font-size:20px;line-height:1;color:var(--water)}
.row100k .mlg-t{font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink)}
.row100k .mlg-s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray)}
.row100k .mlg-rail{width:36px;flex-shrink:0;border-left:1px dashed var(--line);display:flex;align-items:center;justify-content:center}
.row100k .mlg-anchor{position:relative;display:inline-block}
.row100k .mlg-dots{background:none;border:none;color:var(--gray);font-family:var(--row-mono),monospace;font-size:15px;line-height:1;cursor:pointer;padding:6px}
.row100k .mlg-dots:hover,.row100k .mlg-dots.on{color:var(--ink)}
/* The ... options panel — acct-panel language, anchored to the button. The
 * click-away overlay sits under the panel, same layering as the acct menu. */
.row100k .mlg-overlay{position:fixed;inset:0;z-index:55}
.row100k .mlg-menu{position:absolute;top:calc(100% + 6px);right:0;background:var(--paper);border:2px solid var(--ink);box-shadow:6px 6px 0 rgba(21,23,26,.14);padding:2px 14px;min-width:132px;z-index:60;text-align:left}
.row100k .mlg-menu button{display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px dashed var(--line);color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:9px 0;cursor:pointer}
.row100k .mlg-menu button:last-child{border-bottom:none}
.row100k .mlg-menu button:hover{color:var(--water)}
.row100k .mlg-menu button.danger{color:#b3400f}
.row100k .mlg-menu button:disabled{color:var(--gray);cursor:default}
/* The in-place editor: the strip expands and the row content is replaced by
 * the same underline inputs the big form uses. */
.row100k .mlg-editor{flex:1;min-width:0;padding:12px 14px}
.row100k .mlg-edit-line{display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
.row100k .mlg-editor input{background:transparent;border:none;border-bottom:2px solid var(--line);color:var(--ink);font-family:var(--row-mono),monospace;font-size:13px;padding:3px 2px;border-radius:0;appearance:none}
.row100k .mlg-editor input:focus{outline:none;border-bottom-color:var(--water)}
.row100k .mlg-edit-split{font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray);font-variant-numeric:tabular-nums}
.row100k .mlg-edit-title{display:block;width:100%;margin-top:12px}
.row100k .mlg-edit-acts{display:flex;gap:14px;margin-top:12px}
.row100k .del-btn{background:none;border:none;color:var(--gray);font-family:var(--row-mono),monospace;font-size:11px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0}
.row100k .del-btn:hover{color:#b3400f}
.row100k .del-btn.save:hover{color:var(--water)}

/* Leaderboards. */
.row100k .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.row100k .tabs button{background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;cursor:pointer}
.row100k .tabs button.on{background:var(--ink);color:var(--paper)}
.row100k .tabs button:hover:not(.on){border-color:var(--water);color:var(--water)}
/* The board sits on a faint cream (the cream of a cream shirt, not a slab)
 * over the paper, and its rules are a single hair of ink: the thick bars
 * over each section came out (owner call, 2026-09-05). */
.row100k table.board{width:100%;border-collapse:collapse;font-family:var(--row-mono),monospace;font-size:13px;background:rgba(236,220,170,.22)}
.row100k table.board th{text-align:left;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);font-weight:400;padding:8px 6px;border-bottom:1px solid var(--ink)}
.row100k table.board td{padding:10px 6px;border-bottom:1px dashed var(--line);vertical-align:middle}
.row100k table.board td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k table.board .rk{color:var(--gray);width:44px;font-variant-numeric:tabular-nums}
.row100k table.board .who{font-family:var(--row-archivo),sans-serif;font-weight:700}
.row100k table.board .who a{text-decoration:none}
.row100k table.board .who a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .day-select{appearance:none;-webkit-appearance:none;background:var(--ink);color:var(--paper);border:2px solid var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;cursor:pointer}
.row100k .outline-btn{background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;cursor:pointer}
.row100k .outline-btn:hover{border-color:var(--water);color:var(--water)}
.row100k .plog-card{border:2px solid var(--ink);padding:16px 16px 15px;margin-bottom:14px}
.row100k .plog-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);letter-spacing:.08em}
.row100k .plog-title{margin:6px 0 0;font-weight:700;font-size:16px;line-height:1.35}
.row100k .plog-nums{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:8px}
.row100k .plog-m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(22px,5vw,30px);line-height:1;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .plog-time{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(15px,3.5vw,19px);line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .plog-photos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.row100k .plog-photos.one{grid-template-columns:1fr}
.row100k .plog-photos img{display:block;width:100%;max-width:100%;height:auto;border:6px solid var(--frame);background:var(--frame)}
.row100k .plog-nopics{margin-top:10px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--gray)}
.row100k .dtag{display:inline-block;font-size:10px;border:1px solid var(--gray);color:var(--gray);padding:0 5px;margin-left:8px;vertical-align:1px;font-family:var(--row-mono),monospace}
.row100k .dtag.m1{background:#D4AF37;border-color:#a8871e;color:#3a2c04}
.row100k .dtag.m2{background:#C0C0C0;border-color:#999;color:#2c3033}
.row100k .dtag.m3{background:#CD7F32;border-color:#a05e1c;color:#331b04}
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
/* Stats page: the total-meters headline card stands alone, full width. */
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
.row100k tr.divrow td{border-bottom:1px dashed var(--line);padding:14px 6px 6px;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--water);text-transform:uppercase}
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

.row100k .pace-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.06em;color:var(--gray);margin-top:12px;line-height:1.9;text-transform:uppercase}
.row100k .pace-note b{color:var(--water);font-weight:700}

/* Rower profile. */
.row100k .prof-name{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(28px,7vw,44px);text-transform:uppercase;line-height:1.02;letter-spacing:-.01em}
.row100k .prof-ig{font-family:var(--row-mono),monospace;font-size:13px;color:var(--water);text-decoration:none;letter-spacing:.04em}
.row100k .prof-ig:hover{text-decoration:underline;text-underline-offset:3px}
/* Blackout on a profile: the progress bar is not drawn at all (its width IS
 * the number), and the month section is one bordered note in place of the
 * calendar and the curve. */
.row100k .prof-bo{border:2px solid var(--ink);padding:16px 18px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);line-height:1.7}
/* Moderation page: the lede under a picked rower, and the remove control
 * under its own rule so it is never one stray tap from the edit menu. */
.row100k .mod-lede{margin-top:14px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.06em;color:var(--gray);line-height:1.8}
.row100k .mod-danger{margin-top:40px;border-top:2px solid var(--ink);padding-top:18px}
.row100k .mod-danger .k{display:block;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink)}
.row100k .mod-danger .mod-lede{margin:6px 0 12px}
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

/* OPT IN, ported from the landing page (src/components/home/Home.tsx .opt):
 * Archivo Black at poster size, water-blue underline, the blunt arrow. One
 * class for both the link and the button form (OptIn.tsx), so the button
 * resets its own chrome here. Size m is the panel cut. No skew. */
.row100k .optin{display:inline-block;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(38px,8.6vw,96px);line-height:1;text-transform:uppercase;letter-spacing:-.01em;color:var(--ink);white-space:nowrap;
  text-decoration:underline;text-decoration-color:var(--water);text-decoration-thickness:.09em;text-underline-offset:.12em;text-decoration-skip-ink:none;transition:color 160ms ease;
  background:none;border:none;padding:0;margin:0;cursor:pointer;text-align:left}
.row100k .optin.m{font-size:clamp(26px,5vw,48px)}
.row100k .optin:hover{color:var(--water)}
.row100k .optin:focus-visible{outline-offset:8px}
.row100k .optin .arr{display:inline-block;width:.8em;height:.8em;margin-left:.14em;vertical-align:-.06em}
.row100k .optin .arr svg{display:block;width:100%;height:100%}

/* ----------------------------------------------------------------------
 * Tier rarity, record-card links, and tab-chips-as-links (stats rebuild).
 * The main board is sectioned like item drops: 10K common (a plain black
 * tag, owner call 2026-09-05), 50K rare (green), 100K epic (the water blue
 * the 100K CLUB already wore), .25M legend (gold; the word never renders).
 * The -ink shade of each family carries the section text and the badge.
 * Rows are NOT tinted any more — the board stays on its cream and the
 * badge alone says the tier. */
.row100k{
  --tier-common-ink:var(--ink);
  --tier-rare-ink:#256e45;
  --tier-epic-ink:var(--water);
  --tier-legend-ink:#8a6508;
}
/* Badge chip IN FRONT of the name — same voice as .donebadge, colored by
 * rarity. .elite is the black ELITE 15 tag a blacked-out row wears in its
 * place. */
.row100k .tierbadge{display:inline-block;font-size:10px;color:#fff;padding:1px 6px;margin-right:8px;vertical-align:1px;font-family:var(--row-mono),monospace;letter-spacing:.04em}
.row100k .tierbadge.common{background:var(--tier-common-ink)}
.row100k .tierbadge.rare{background:var(--tier-rare-ink)}
.row100k .tierbadge.epic{background:var(--tier-epic-ink)}
.row100k .tierbadge.legend{background:var(--tier-legend-ink)}
.row100k .tierbadge.elite{background:var(--ink)}
/* Blackout blocks: one fat cursor per hidden digit, sized off the inherited
 * font so a run of them is exactly as wide as the number it stands in for
 * (Space Mono advances .6em a glyph: a .54em block with .03em either side).
 * The comma between thousands groups is a real glyph on the real baseline,
 * so you can see where the hundred-thousands start. */
.row100k .bo{display:inline;white-space:nowrap}
.row100k .bo i{display:inline-block;width:.54em;height:.92em;margin:0 .03em;background:var(--ink);border-radius:1px;vertical-align:-.04em}
.row100k .bo b{font-weight:400}
/* The line under the tabs while a blackout is on. */
.row100k .bo-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);margin:-6px 0 16px;line-height:1.7}
/* Section headers pick up their tier color; a locked tier goes quiet. */
.row100k tr.divrow.common td{color:var(--tier-common-ink)}
.row100k tr.divrow.rare td{color:var(--tier-rare-ink)}
.row100k tr.divrow.epic td{color:var(--tier-epic-ink)}
.row100k tr.divrow.legend td{color:var(--tier-legend-ink)}
.row100k tr.divrow.locked td{color:var(--gray)}
.row100k tr.lockrow td{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;color:var(--gray);padding:14px 6px;border-bottom:1px dashed var(--line)}
/* Record cards are links now (each opens its full-ranking page): same box
 * as button.rec, pointer, and the pressed shadow moves to hover. */
.row100k a.rec{text-decoration:none;cursor:pointer}
.row100k a.rec:hover,.row100k .rec.linked:hover{border-color:var(--water);box-shadow:4px 4px 0 var(--water)}
.row100k .rec .also div+div{margin-top:1px}
/* Tab chips as plain links (record switcher + division links on /records)
 * — mirror of .tabs button so server pages need no client state. */
.row100k .tabs a{display:inline-block;background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;text-decoration:none}
.row100k .tabs a.on{background:var(--ink);color:var(--paper)}
.row100k .tabs a:hover:not(.on){border-color:var(--water);color:var(--water)}

/* ----------------------------------------------------------------------
 * Cycle-2 polish, stats page (track B). The weekly board shows only the
 * top 10; a signed-in rower sitting deeper gets their neighborhood after
 * this gap row (their own row reuses the tr.fin tint). */
.row100k tr.gaprow td{padding:6px;border-bottom:1px dashed var(--line);color:var(--gray);text-align:center;font-family:var(--row-mono),monospace;font-size:13px;letter-spacing:.3em}

/* ----------------------------------------------------------------------
 * Stats-page month block (MonthSection + the hour grid + turnout).
 * The per-day k labels inside heatmap cells: bold mono, sized to the cell.
 * Only b4 (#0077B6) is deep enough for white type (4.9:1); ink wins on
 * every lighter bucket — b3 puts white at 2.95:1, ink at 6.1:1. */
.row100k .hm-num{font-family:var(--row-mono),monospace;font-size:clamp(11px,2.6vw,17px);font-weight:700;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .hm-cell.b4 .hm-num{color:#fff}
/* The small share row tucked under a chart. */
.row100k .ms-actions{display:flex;justify-content:flex-end;margin-top:10px}
/* Hour grid: one row per day, 24 hour columns, GitHub-commit style.
 * Fixed-ish column widths inside a horizontal scroller so phones pan. */
.row100k .hg-scroll{overflow-x:auto;border:2px solid var(--ink);padding:16px;margin-top:8px}
.row100k .hg{display:grid;grid-template-columns:52px repeat(24,minmax(18px,1fr));gap:4px;min-width:620px}
.row100k .hg-day{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.06em;color:var(--gray);text-transform:uppercase;align-self:center;white-space:nowrap}
.row100k .hg-tick{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.08em;color:var(--gray);text-transform:uppercase;padding-bottom:2px;white-space:nowrap}
.row100k .hg-cell{aspect-ratio:1;border:1px dashed var(--line)}
.row100k .hg-cell.b1{background:#d9e8f2;border:1px solid #d9e8f2}
.row100k .hg-cell.b2{background:#a5cde3;border:1px solid #a5cde3}
.row100k .hg-cell.b3{background:#4d9fc9;border:1px solid #4d9fc9}
.row100k .hg-cell.b4{background:var(--water);border:1px solid var(--water)}

/* Stay light in dark mode, but take the glare off (same as /lasd26). */
@media (prefers-color-scheme: dark){
  .row100k{--paper:#E9E7DF}
  .row100k .frame img,.row100k .inter img{filter:brightness(.94)}
}
`;
