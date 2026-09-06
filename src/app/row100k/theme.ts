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
.row100k .bar-right{display:flex;align-items:center;gap:12px;margin-left:auto;flex:none}
/* LOG A ROW on the bar (owner call, 2026-09-05): the account chip idiom
 * inverted — solid ink, white mono, water on hover — so a joined rower can
 * always reach the form. One element (BarLog), moved by flex order: on
 * desktop it takes the auto margin and the chip group loses its own, so
 * the pair sits together at the far right, same height as the chip. Both
 * are flex none: at tablet widths the rail wraps to make room, the button
 * and the chip never get squeezed onto two lines. */
.row100k .bar-log{display:inline-block;flex:none;margin-left:auto;background:var(--ink);color:#fff;border:2px solid var(--ink);font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;line-height:16px;text-transform:uppercase;padding:6px 12px;text-decoration:none;white-space:nowrap;transition:background 160ms ease,border-color 160ms ease}
.row100k .bar-log:hover,.row100k .bar-log:focus-visible{background:var(--water);border-color:var(--water);color:#fff}
.row100k .bar-log + .bar-right{margin-left:0}
/* Phone widths (under 640px, the same seam as the front-page grids): an
 * intentional two-row bar — wordmark, ROWTEMBER and the account chip on
 * the masthead row, the section links on their own dashed-ruled row
 * beneath. The rail gives up its box (display contents) so ROWTEMBER can
 * sit up top with the wordmark while the rest drop past the break; the
 * pill then positions against the bar, which is why RowBar keeps the bar
 * positioned even when it is not sticky. Both link boxes are 25px here,
 * and so is LOG A ROW, which follows the links (order 3) and takes the
 * auto margin to the far right — directly under the chip; the chip group
 * gets its own auto margin back for the masthead row. Up to 639 rather
 * than 560 because with the button beside the chip the one-row bar has no
 * room left for the rail under 640: it stacked three and four lines. */
@media(max-width:639px){
  .row100k .bar{flex-wrap:wrap;gap:8px 4px;padding:10px 16px 12px}
  .row100k .bar-brand{font-size:11px;letter-spacing:.03em}
  .row100k .rail{display:contents}
  .row100k .rail a{font-size:11px;letter-spacing:.06em;padding:5px 6px 4px;order:2}
  .row100k .rail a.brand{font-size:12px;padding:5px 8px 4px;margin-left:6px;order:0}
  .row100k .rail-break{display:block;flex-basis:100%;height:0;border-top:1px dashed var(--line);order:1}
  .row100k .bar-log{order:3;margin-left:auto;font-size:11px;letter-spacing:.06em;line-height:16px;padding:3px 8px 2px}
  .row100k .bar-log + .bar-right{margin-left:auto}
}
/* The link row has to hold THE BOARD, STATS, FEED, PARTNERS and LOG A ROW
 * on one line: at 375px that is a fit by a hair, so from 389px down the
 * button alone gives up tracking and side padding (the links keep their
 * look at 375, the common phone; every box stays 25px). From 374px down
 * the links follow with a little less tracking and padding, keeping their
 * left edge, and the brand margin eases so the masthead row still holds
 * the chip at 360px. Under 360px (320px phones) the whole row steps to
 * 10px mono and the column gap tightens; the button never drops to a row
 * of its own. */
@media(max-width:389px){
  .row100k .bar-log{letter-spacing:.02em;padding:3px 6px 2px}
}
@media(max-width:374px){
  .row100k .rail a{letter-spacing:.03em;padding:5px 5px 4px}
  .row100k .rail a.brand{margin-left:2px}
}
@media(max-width:359px){
  .row100k .bar{gap:8px 2px}
  .row100k .rail a{font-size:10px;letter-spacing:.02em;padding:5px 4px 4px}
  .row100k .bar-log{font-size:10px;letter-spacing:.02em;padding:3px 6px 2px}
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
/* While a blackout window is open the two podiums give way to one
 * EliteList across the whole measure: the podium density kept, and the
 * heading rule as heavy as a podium heading. */
.row100k .front-elite{min-width:0}
.row100k .front-elite .elite-eye{border-bottom-width:2px}
.row100k .front-elite table.board td{padding:9px 6px}
/* The latest row, one mono line; also the one line on the board page for
 * a signed-out visitor. */
.row100k .front-latest{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);line-height:1.8}
.row100k .front-latest b{color:var(--ink);font-weight:700}
.row100k .front-latest .k,.row100k .front-latest .v{display:block}
/* The board link under the news column. */
.row100k .front-more{font-size:12px;letter-spacing:.1em;text-transform:uppercase;margin-top:14px}
.row100k .front-more a{color:var(--water);text-decoration:none;border-bottom:2px solid var(--water);padding-bottom:2px}
.row100k .front-more a:hover{color:var(--ink);border-color:var(--ink)}
/* The signed-in top: the meters of the rower in the landing counter, the
 * same geometry as .home .od (Home.tsx): Archivo Black digits are .667em
 * and the comma .333em, so the cells are .68em and .34em, and eight digits
 * plus two commas make 6.12em; the size formula is the landing one, so the
 * two counters are the same width on the same screen. Static digits, the
 * leading zeros dimmed; tapping it opens the profile. */
.row100k .my-od-link{display:block;text-decoration:none;color:inherit;margin-top:6px}
.row100k .my-od{--od-size:clamp(40px,min(calc(16.3vw - 10px),30vh),160px);--od-cw:.68em;--od-sw:.34em;display:flex;align-items:flex-start;font-family:var(--row-archivo-black),sans-serif;font-size:var(--od-size);line-height:1;color:var(--water);letter-spacing:0;font-variant-numeric:tabular-nums;transition:color 160ms ease}
.row100k .my-od-link:hover .my-od{color:var(--ink)}
/* The signed-in front page: seven wheels and two commas are 5.44em, sized
 * off the box itself (cqw) so the number can never run past the frame the
 * way the vw formula did on a wide screen; 180px is where it stops growing. */
.row100k .mine{container-type:inline-size}
.row100k .mine .my-od{--od-size:min(calc(100cqw / 5.44),30vh,180px)}
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
/* The post pack frame picker (POST 4:5 / STORY 9:16) is a .tabs group that
   goes quiet while the pack renders, since flipping the frame restarts every
   slide. Dimmed and unhovered like the pack buttons beside it, so a control
   that cannot act does not look live. */
.row100k .pp-size button:disabled{opacity:.45;cursor:default}
.row100k .pp-size button:disabled:hover:not(.on){border-color:var(--ink);color:var(--ink)}
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
/* Stats page, THE RECORDS (owner call, 2026-09-05): the record cards are
 * gone. The chosen record wears the board head — the big blue number one
 * step under the front page, the holder on the mono line — over the men
 * and women podiums (.front-top / .front-three, the front page markup).
 * The unit rides small and grey inside the number. */
.row100k .st-rec .bhead-n{font-size:clamp(40px,11vw,88px)}
.row100k .st-rec .bhead-n .u{font-size:.4em;color:var(--gray);font-family:var(--row-archivo),sans-serif;font-weight:700}
.row100k .st-podiums{margin-top:26px}
/* The Overall neighbourhood a division-X rower gets under the podiums. */
.row100k .st-overall{margin-top:22px}
/* The stats-page submenu (owner call, 2026-09-05, second look): the
 * record picker and the by-day / by-week switch are small mono links in
 * a row, the picked one in ink on a 2px water underline, the rest grey —
 * no border, no chip fill, so five of them wrap on a phone without
 * reading as buttons. The leaders and their numbers carry the section;
 * this is a submenu. Buttons and links share the look. .lead is the
 * variant that sits under a section head, ahead of what it switches. */
.row100k .st-sub{display:flex;flex-wrap:wrap;gap:2px 18px;margin:24px 0 0;padding:0}
.row100k .st-sub.lead{margin:-8px 0 14px}
.row100k .st-sub.tight{margin:12px 0 22px}
.row100k .st-sub button,.row100k .st-sub a{display:inline-block;background:none;border:0;border-bottom:2px solid transparent;margin:0;padding:6px 0 4px;cursor:pointer;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;line-height:1.4;text-transform:uppercase;color:var(--gray);text-decoration:none}
.row100k .st-sub .on{color:var(--ink);border-bottom-color:var(--water)}
.row100k .st-sub button:hover:not(.on),.row100k .st-sub a:hover:not(.on){color:var(--water)}
/* Records pick MOCK (dev/records — owner ask 2026-09-05: a picture, not
 * live): the record submenu folded into ONE control. Look A: the record
 * name under the holder line, ink on a water underline (the .st-sub .on
 * idiom) with a water caret. Look B: the name as a small mono chip pushed
 * to the right end of the holder line (margin-left auto keeps it on the
 * right edge even when the line wraps on a phone). Both open the same
 * inline list, hung off the same edge as its control: mono, dashed
 * hairlines, the current record in ink, the rest grey. No box, no
 * shadow, no radius. */
.row100k .st-pick-eyebrow{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gray);padding-bottom:8px;border-bottom:1px dashed var(--line);margin-bottom:14px}
.row100k .st-pick-name{display:inline-block;background:none;border:0;border-bottom:2px solid var(--water);margin:12px 0 0;padding:6px 0 4px;cursor:pointer;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;line-height:1.4;text-transform:uppercase;color:var(--ink)}
.row100k .st-pick-name:hover{color:var(--water)}
.row100k .st-pick-caret{color:var(--water);margin-left:2px;font-size:1.25em;line-height:1}
.row100k .st-pick-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px}
.row100k .st-pick-holder{min-width:0}
.row100k .st-pick-chip{margin-left:auto;background:none;border:1px solid var(--ink);padding:4px 8px;cursor:pointer;font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.12em;line-height:1.4;text-transform:uppercase;color:var(--ink);white-space:nowrap}
.row100k .st-pick-chip:hover{border-color:var(--water);color:var(--water)}
.row100k .st-pick-list{margin:10px 0 0;max-width:340px;border-top:1px dashed var(--line)}
.row100k .st-pick-list.right{margin-left:auto;text-align:right}
.row100k .st-pick-list button{display:block;width:100%;text-align:inherit;background:none;border:0;border-bottom:1px dashed var(--line);margin:0;padding:9px 0;cursor:pointer;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;line-height:1.4;text-transform:uppercase;color:var(--gray)}
.row100k .st-pick-list button.on{color:var(--ink)}
.row100k .st-pick-list button:hover:not(.on){color:var(--water)}
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
.row100k .bhead{margin:8px 0 0}
.row100k .bhead-n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(44px,13vw,110px);line-height:1;letter-spacing:-.01em;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .bhead-l{margin:10px 0 0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .bhead-l b{color:var(--ink);font-weight:700}
.row100k .bl{list-style:none;margin:18px 0 28px;padding:18px 0 0;border-top:2px solid var(--ink);display:grid;gap:12px 40px;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.row100k .bl li{display:flex;align-items:baseline;gap:10px;min-width:0}
.row100k .bl .k{color:var(--ink-soft);white-space:nowrap}
.row100k .bl .dots{flex:1 1 24px;min-width:24px;height:0;border-bottom:2px dotted var(--gray)}
.row100k .bl .v{font-weight:700;color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums}
@media(min-width:640px){.row100k .bl{grid-template-columns:1fr 1fr}}

.row100k .pace-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.06em;color:var(--gray);margin-top:12px;line-height:1.9;text-transform:uppercase}
.row100k .pace-note b{color:var(--water);font-weight:700}

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
.row100k .tierbadge.pace{background:var(--ink);letter-spacing:.02em}
/* THE ELITE FIFTEEN as a list (EliteList.tsx): the board idiom without a
 * place column; a one-letter division cell where the rank would sit, the
 * blocks on the right. The eyebrow is the profile one (.pf-eye). */
.row100k .elite{margin-top:4px}
.row100k .elite-eye{display:flex;justify-content:space-between;align-items:baseline;gap:6px 16px;flex-wrap:wrap;border-bottom:1px solid var(--ink);padding-bottom:8px;margin-bottom:10px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .elite-eye .r{color:var(--gray);font-weight:400}
.row100k table.board.elite-t td.dv{width:22px;color:var(--gray);font-size:11px;letter-spacing:.08em;padding-right:8px}
.row100k .elite-foot{font-size:10px;letter-spacing:.16em;color:var(--gray);text-transform:uppercase;margin-top:10px}
/* The same block INSIDE the standings (Boards.tsx): while they are hidden
 * the fifteen leave the tier ladder and lead the table under one heading —
 * ink, not a tier color, and the solid rule the elite eyebrow wears. */
.row100k tr.divrow.elite td{color:var(--ink);border-bottom:1px solid var(--ink);padding-top:0}
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
/* The ledger total that closes a period board: a solid rule over it, bold
 * ink, no dashed hairline under. The label cell drops a size so EVERYONE
 * and the rower count sit on one line at 375px. */
.row100k table.board tr.totrow td{border-top:2px solid var(--ink);border-bottom:0;color:var(--ink);font-weight:700;padding-top:11px}
.row100k table.board tr.totrow td.lbl{font-size:11px;letter-spacing:.08em}

/* ----------------------------------------------------------------------
 * Stats-page month block (MonthSection + the hour grid).
 * The per-day k labels inside heatmap cells: bold mono, sized to the cell.
 * Only b4 (#0077B6) is deep enough for white type (4.9:1); ink wins on
 * every lighter bucket — b3 puts white at 2.95:1, ink at 6.1:1. */
.row100k .hm-num{font-family:var(--row-mono),monospace;font-size:clamp(11px,2.6vw,17px);font-weight:700;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .hm-cell.b4 .hm-num{color:#fff}
/* The small share row tucked under a chart. */
.row100k .ms-actions{display:flex;justify-content:flex-end;margin-top:10px}
/* Hour grid: one row per September day, 24 square hour columns, and the
 * whole thing in the viewport — no horizontal pan (owner call,
 * 2026-09-05). A narrow mono day column (SEP over the day numbers), the
 * 12A 6A 12P 6P ticks over hours 0, 6, 12 and 18; a tick may hang past
 * its own column, whose neighbours are blank. Empty cells are a faint
 * wash rather than a dashed hairline, which at nine pixels reads as dots. */
.row100k .hg-box{border:2px solid var(--ink);padding:14px 12px 12px;margin-top:8px}
.row100k .hg{display:grid;grid-template-columns:auto repeat(24,minmax(0,1fr));gap:2px}
.row100k .hg-day{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.06em;color:var(--gray);text-transform:uppercase;align-self:center;white-space:nowrap;text-align:right;padding-right:4px}
.row100k .hg-tick{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.06em;color:var(--gray);text-transform:uppercase;padding-bottom:3px;white-space:nowrap;min-width:0;overflow:visible}
.row100k .hg-cell{aspect-ratio:1;min-width:0;background:rgba(21,23,26,.05)}
.row100k .hg-cell.b1{background:#d9e8f2}
.row100k .hg-cell.b2{background:#a5cde3}
.row100k .hg-cell.b3{background:#4d9fc9}
.row100k .hg-cell.b4{background:var(--water)}

/* ----------------------------------------------------------------------
 * THE FIELD on the stats page (owner ask, 2026-09-05): the front page
 * stat cells — bold number over a lighter mono descriptor, with a mono
 * eyebrow naming the figure — two across from 640px (two tiles, or a
 * two-by-two with the viewer on; three left a hole once the most-common
 * tile went, 2026-09-05 evening), one a line on a phone. The two tiles
 * that are the viewer go blue, the way every YOU mark on the charts does. */
.row100k .st-tiles{display:grid;grid-template-columns:1fr;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);margin-bottom:8px}
.row100k .st-tile{padding:14px 0 13px;border-bottom:1px solid var(--ink);min-width:0}
.row100k .st-tile:last-child{border-bottom:none}
.row100k .st-tile .k{font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase}
.row100k .st-tile .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(24px,5.6vw,36px);line-height:1;font-variant-numeric:tabular-nums;margin-top:6px;overflow-wrap:anywhere}
.row100k .st-tile .n .u{font-size:.5em;color:var(--gray);font-family:var(--row-archivo),sans-serif;font-weight:700}
.row100k .st-tile .l{font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;margin-top:7px;line-height:1.6}
.row100k .st-tile.you .n,.row100k .st-tile.you .l{color:var(--water)}
.row100k .st-tile.you .n .u{color:var(--water);opacity:.7}
@media(min-width:640px){
  .row100k .st-tiles{grid-template-columns:repeat(2,1fr)}
  .row100k .st-tile{border-bottom:none;border-right:1px solid var(--ink);padding-right:16px}
  .row100k .st-tile+.st-tile{padding-left:16px}
  .row100k .st-tile:nth-child(2n+1){padding-left:0}
  .row100k .st-tile:nth-child(2n),.row100k .st-tile:last-child{border-right:none}
  .row100k .st-tile:nth-child(n+3){border-top:1px solid var(--ink)}
}
/* The two densities under the tiles: a mono title and a dashed hairline
 * each, no 2px box — the owner asked for them set quietly at the bottom
 * rather than framed (.curve stays for the numbers page). */
.row100k .st-kde{margin-top:30px;padding-top:12px;border-top:1px dashed var(--line)}
.row100k .st-kde .t{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase;margin-bottom:8px}
.row100k .st-kde svg{display:block;width:100%;height:auto}
/* The scrub (owner ask, 2026-09-05 evening): the density is a slider you
 * read by hand — a finger, the mouse, the arrow keys — so the surface
 * keeps vertical page scroll (pan-y), gives up text selection and the
 * tap flash, and shows a dashed ring only to the keyboard. */
.row100k .st-kde .scrub{touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;outline:none;cursor:default}
.row100k .st-kde .scrub:focus-visible{outline:1px dashed var(--ink);outline-offset:6px}

/* ----------------------------------------------------------------------
 * The profile (r/[num], looks/Profile.tsx — the owner picked it from
 * three looks on 2026-09-05): the front page shape on one rower. A
 * nameplate one step under the front page masthead (number in gray, name
 * in ink, a hairline under both), the one big blue number (the landing
 * odometer on your own page, the board head on anyone else), LOG A ROW /
 * SHARE in the front page face, the mono identity line, the dotted board
 * ledger, and small mono eyebrows for every block below (the owner found
 * the stats page spent too much room on titles). No 2px boxes here; the
 * blackout line is a pair of dashed hairlines, not a frame. Sections sit
 * tighter than the inside pages (30px) — the eyebrows carry the spacing. */
.row100k section.pf-sec{padding:30px 0 0}
.row100k .pf-head{padding:26px 0 0}
.row100k .pf-name{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,6.6vw,64px);line-height:.95;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:.14em;overflow-wrap:anywhere}
.row100k .pf-name .num{color:var(--gray)}
.row100k .pf-date{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);padding-top:8px}
/* The odometer on the profile: seven digits and two commas (5.44em) sized
 * off its own column (cqw), so it fits the 760 measure and the narrower
 * left column of the two-column layout alike. */
.row100k .pf-od{margin-top:22px;container-type:inline-size}
.row100k .pf-od .my-od{--od-size:min(calc(100cqw / 5.44),30vh,130px)}
/* THE BESTS descriptor: PERSONAL — only on the phone (look A wording),
 * where the eyebrow has the room. */
.row100k .pf-ph{display:inline}
.row100k .pf-big{margin-top:22px}
/* LOG A ROW / SHARE (LogInPlace) a step under the front page size, so
 * both fit one line on the 760 column. */
.row100k .pf-act .act-row.front{margin-top:clamp(18px,3vh,30px)}
.row100k .pf-act .optin{font-size:clamp(34px,7.2vw,72px)}
.row100k .pf-act .front-share{font-size:clamp(18px,3.4vw,30px)}
/* An admin on someone else page: the same SHARE face, standing alone.
 * ProfileShare carries an inline 12px top margin on its button (inline
 * beats any rule here), so the wrapper gives those 12px back and the face
 * lands where LOG A ROW / SHARE lands on the rower own page. */
.row100k .pf-adm{margin-top:calc(clamp(18px,3vh,30px) - 12px)}
.row100k .pf-adm .outline-btn{margin-top:0;background:none;border:none;padding:0;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(18px,3.4vw,30px);line-height:1;letter-spacing:-.01em;color:var(--ink);text-decoration:underline;text-decoration-color:var(--water);text-decoration-thickness:.09em;text-underline-offset:.12em;text-decoration-skip-ink:none}
.row100k .pf-adm .outline-btn:hover{color:var(--water)}
.row100k .pf-id{margin-top:22px}
.row100k .pf-id a{color:var(--water);text-decoration:none}
.row100k .pf-id a:hover{text-decoration:underline;text-underline-offset:3px}
/* The eyebrow: one bold mono line over a hairline, a gray descriptor on
 * the right. */
.row100k .pf-eye{display:flex;justify-content:space-between;align-items:baseline;gap:6px 16px;flex-wrap:wrap;border-bottom:1px solid var(--ink);padding-bottom:8px;margin-bottom:14px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .pf-eye .r{color:var(--gray);font-weight:400}
/* The bests as two small boards, the front page top-three voice: a mono
 * title, the label bold with its date under it, the value on the right
 * with the place chip, SHARE in a narrow last cell for the rower. */
.row100k .pf-bests{display:grid;grid-template-columns:1fr;gap:22px}
@media(min-width:640px){.row100k .pf-bests{grid-template-columns:1fr 1fr}}
.row100k .pf-best{min-width:0}
.row100k .pf-best h3{font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gray);padding-bottom:6px}
.row100k .pf-best table.board td{padding:9px 6px}
.row100k .pf-best .k{font-family:var(--row-archivo),sans-serif;font-weight:700;text-decoration:none}
.row100k .pf-best .k:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .pf-best .sub{font-size:10px;color:var(--gray);margin-top:2px}
.row100k .pf-best td.num{font-weight:700}
.row100k .pf-best td.num .dtag{vertical-align:2px}
.row100k .pf-best td.sh{width:1%;text-align:right;padding-left:0}
/* The blackout line where the calendar would be. */
.row100k .pf-bo{border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);padding:14px 0;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);line-height:1.7}
/* The visitor log: the TABLE / PHOTOS switch as underlined mono words
 * (the ink word is the one on), and a photo card between dashed
 * hairlines — no 2px boxes (.tabs and .plog-card keep theirs elsewhere). */
.row100k .pf-log .tabs{gap:18px;margin-bottom:16px}
.row100k .pf-log .tabs button{border:0;padding:0 0 3px;background:none;color:var(--gray);text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--water)}
.row100k .pf-log .tabs button.on{background:none;color:var(--ink)}
.row100k .pf-log .tabs button:hover:not(.on){color:var(--water)}
.row100k .pf-log .plog-card{border:0;border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);padding:14px 0;margin-bottom:14px}
/* One DOM, two shapes (the owner pick, 2026-09-05: look C on a desktop,
 * look A on a phone). Under 720px the grid is one column in the phone
 * order — the rower, THE BESTS, THE MONTH: the right-hand column
 * (.pf-side) is display:contents there, so its two blocks are grid items
 * of their own and order puts the bests ahead of the month. From 720px
 * the column is a block again, on the right of the landing measure, the
 * month over the bests; the rower on the left is cut down to fit half the
 * measure: the odometer at 6.12em of its size, the nameplate, the two
 * buttons. */
.row100k .pf-two{display:grid;grid-template-columns:1fr;gap:34px}
.row100k .pf-side{display:contents}
.row100k .pf-bests-sec{order:1}
.row100k .pf-month{order:2}
@media(min-width:720px){
  .row100k .pf-two{grid-template-columns:11fr 9fr;gap:48px;align-items:start}
  .row100k .pf-side{display:block;padding-top:26px}
  .row100k .pf-side .pf-bests-sec{margin-top:28px}
  .row100k .pf-two .bl{grid-template-columns:1fr}
  .row100k .pf-two .pf-bests{grid-template-columns:1fr}
  .row100k .pf-two .pf-name{font-size:clamp(26px,4.6vw,52px)}
  .row100k .pf-two .bhead-n{font-size:clamp(40px,7vw,76px)}
  .row100k .pf-two .pf-od .my-od{--od-size:min(calc(100cqw / 5.44),30vh,90px)}
  .row100k .pf-ph{display:none}
  .row100k .pf-two .pf-act .optin{font-size:clamp(30px,4.4vw,46px)}
  .row100k .pf-two .pf-act .front-share{font-size:clamp(16px,2.2vw,24px)}
  .row100k .pf-two .pf-adm .outline-btn{font-size:clamp(16px,2.2vw,24px)}
}

/* ----------------------------------------------------------------------
 * The feed (feed/ — the strips, the owner pick of 2026-09-05): the
 * profile language on the ticker. THE FEED as a nameplate over a
 * hairline with a mono dateline that carries the blackout line, the one
 * big blue number (meters that landed today, Pacific — .bhead-n) with its
 * mono descriptor, then the rows under small mono day heads with a dashed
 * rule. No 2px boxes anywhere: rows part on dashed hairlines. .fd- is the
 * prefix. */
.row100k section.fd-sec{padding:30px 0 8px}
.row100k .fd-head{padding:26px 0 0}
.row100k .fd-name{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,6.6vw,64px);line-height:.95;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:.14em}
.row100k .fd-date{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);padding-top:8px;line-height:1.7}
.row100k .fd-big{margin-top:22px}
.row100k .fd-list{margin-top:30px}
/* The day head: ONE small mono line — the day, a dash, its whole total (a
 * blue figure in the strips) — over a dashed rule; the first sits tight to
 * the headline. Inline, not justified to the edges: 500px apart on the
 * column the two halves read as two labels. It still wraps on a narrow
 * phone. */
.row100k .fd-dayh{display:flex;align-items:baseline;gap:4px 8px;flex-wrap:wrap;margin:28px 0 0;padding-bottom:7px;border-bottom:1px dashed var(--gray);font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .fd-day:first-child .fd-dayh{margin-top:0}
.row100k .fd-dayh .r{color:var(--gray);font-weight:400;font-variant-numeric:tabular-nums}
.row100k .fd-dayh .r b{color:var(--water);font-weight:700}
/* A thumb is a bare button around a plain lazy img; a row with no photo
 * keeps a dashed square where one would go. */
.row100k .fd-pic{display:block;flex-shrink:0;appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;padding:0;margin:0;cursor:pointer;line-height:0;overflow:hidden}
.row100k .fd-pic img{display:block;width:100%;height:100%;object-fit:cover;transition:opacity 160ms ease}
.row100k .fd-pic:hover img{opacity:.82}
.row100k .fd-noph{display:flex;flex-shrink:0;align-items:center;justify-content:center;border:1px dashed var(--line);color:var(--gray);font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.row100k .fd-pics{display:flex;gap:4px}
/* The rower link everywhere: bold ink, blue underlined on hover. */
.row100k .fd-who{color:var(--ink);text-decoration:none}
.row100k .fd-who:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
/* THE STRIPS. The boxed photo ledger, unboxed: 96px thumbs left (72px
 * under 480px, so the 26px meters still fit a phone), the lead — the
 * session title on its own gray line ABOVE the number · NAME line (owner,
 * 2026-09-05; a row without a title has no title line; the two sit 3px
 * apart so they read as one lead) — then the meters in Archivo Black at
 * 26px, the time, the split and the clock in mono under it, dashed
 * hairlines between strips. The lead wraps inside its column; the thumbs
 * never move. */
.row100k .fd-strip{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center;padding:14px 0;border-bottom:1px dashed var(--line)}
.row100k .fd-strip .fd-pic,.row100k .fd-strip .fd-noph{width:96px;height:96px}
.row100k .fd-strip .fd-mid{display:flex;flex-direction:column;gap:6px;min-width:0}
.row100k .fd-strip .fd-lead{display:flex;flex-direction:column;gap:3px;min-width:0}
.row100k .fd-strip .fd-ttl{font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;letter-spacing:.04em;color:var(--gray);min-width:0;overflow-wrap:anywhere}
.row100k .fd-strip .fd-nm{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);display:flex;flex-wrap:wrap;gap:0 8px;align-items:baseline}
.row100k .fd-strip .fd-nm .fd-n{color:var(--gray);font-weight:400}
.row100k .fd-strip .fd-m{font-family:var(--row-archivo-black),sans-serif;font-size:26px;line-height:1;color:var(--water);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.row100k .fd-strip .fd-sub{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.04em;color:var(--ink);display:flex;flex-wrap:wrap;gap:2px 12px;font-variant-numeric:tabular-nums}
.row100k .fd-strip .fd-sub .fd-s,.row100k .fd-strip .fd-sub .fd-t{color:var(--gray)}
@media(max-width:479px){
  .row100k .fd-strip{gap:12px}
  .row100k .fd-strip .fd-pic,.row100k .fd-strip .fd-noph{width:72px;height:72px}
}
/* The pager under the feed: NEWER / OLDER as underlined mono words, no
 * boxes. */
.row100k .fd-pager{display:flex;justify-content:space-between;gap:10px;margin-top:30px;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em}
.row100k .fd-pager a{color:var(--ink);text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--water);padding:6px 0}
.row100k .fd-pager a:hover{color:var(--water)}
.row100k .fd-pager .fd-spacer{flex:1}

/* Stay light in dark mode, but take the glare off (same as /lasd26). */
@media (prefers-color-scheme: dark){
  .row100k{--paper:#E9E7DF}
  .row100k .frame img,.row100k .inter img{filter:brightness(.94)}
}
`;
