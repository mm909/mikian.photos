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

/* The selector every rule of the ink look hangs off (the .row-ink block at
 * the foot of the sheet): the wrapper class the layout adds, the page root,
 * and NOT one of the two pages that are ink already, nor the cast wall —
 * .rr-wall on its root, a class and not :has(), so a gym television with
 * no :has() never gets the wall inverted (review, 2026-09-16). */
const INK = ".row-ink .row100k:not(.chrome-ink):not(.rr-wall)";

/* BOTH INK GROUNDS AT ONCE: a page under the ink look, and a page that is
 * ink on its own (.chrome-ink — the landing, race day, the results board).
 * The bar, the raffle strip and the account menu are one chrome on either,
 * so their rules are written once and read the --bar-* variables each
 * ground sets (the ink look flips --paper and --ink; .chrome-ink does not,
 * so it names its black and its white). */
const dark = (...sels: string[]) => sels.flatMap((x) => [`${INK} ${x}`, `.row100k.chrome-ink ${x}`]).join(",");

export const css = `
html:has(.row100k){scroll-behavior:smooth}
.row100k,.row100k *{margin:0;padding:0;box-sizing:border-box}
/* Anchor targets have to clear the sticky bar: 62px across a desktop, and
 * 50px on a phone now that the bar is one row at every width (2026-10-01;
 * it was two rows, and three with the RACE DAY band, and this carried 106
 * and 136). Measured, plus 8px of air on the phone. */
.row100k section[id]{scroll-margin-top:64px}
@media (max-width:639px){
  .row100k section[id]{scroll-margin-top:58px}
}
.row100k{
  --paper:#F4F3EE; --ink:#15171a; --ink-soft:#3b3e42; --gray:#8a8a85; --line:#c9c8c0;
  --water:#B04506; --water-hover:#D2580F; --water-pale:#FBE7D6; --on-water:#fff; --frame:#1f2226;
  background:var(--paper) url(${NOISE}) repeat;
  color:var(--ink);
  font-family:var(--row-archivo),sans-serif;
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;
  min-height:100vh;width:100%;color-scheme:light;
}
@media (prefers-reduced-motion: reduce){ .row100k *{transition:none!important;animation:none!important} }
/* THE ACCENT IS THE PALETTE (src/lib/rowPalette.ts): RowSite writes the
 * preset into --water, --water-hover, --water-pale and --on-water (the type
 * a filled slab of it carries) for the ground the look gives the page.
 * What the root above and this rule hold is October orange, the default
 * preset, for a page outside the /row100k layout (the rowing machine
 * pages wear this sheet with no RowSite over them): the burnt cut on
 * paper, the pumpkin on either ink ground. --frame, the mat a photo sits
 * on, was a blue-black and is a plain one. */
.row100k.chrome-ink,.row-ink .row100k{--water:#FF7A1A;--water-hover:#FF9A4D;--water-pale:#2E1C0E;--on-water:#15171a}
.row100k .mono{font-family:var(--row-mono),monospace}
.row100k .wrap{max-width:760px;margin:0 auto;padding:0 20px}
.row100k a{color:inherit}
.row100k :focus-visible{outline:2px solid var(--water);outline-offset:3px}

.row100k .bar{display:flex;align-items:center;gap:18px;padding:14px 20px;border-bottom:2px solid var(--ink);position:sticky;top:0;background:var(--paper) url(${NOISE}) repeat;z-index:50}
.row100k .bar .mono{font-size:12px;letter-spacing:.08em}
/* THE TAP LANDED (NavProgress.tsx): a line of the accent along the top edge
 * of the viewport from the moment a link is pressed until the next page
 * paints. */
.row100k .bar-go{position:fixed;left:0;top:0;height:3px;width:0;background:var(--water);z-index:60;opacity:0;pointer-events:none}
.row100k .bar-go.on{opacity:1;animation:row-go 9s cubic-bezier(.08,.6,.2,1) forwards}
@keyframes row-go{from{width:0}to{width:94%}}
@media (prefers-reduced-motion:reduce){.row100k .bar-go.on{animation:none;width:100%}}
.row100k .bar .tag{background:var(--water);color:var(--on-water);padding:3px 8px}
/* The ROWTEMBER wordmark leads (owner, 2026-09-30: ROWTEMBER, never
 * Mikian Musser — the Mikian.Musser wordmark of 2026-09-05 is gone, and
 * with it the ROWTEMBER the rail carried, which this now is; same 13px Archivo
 * Black the rail mark wore), the nav rail opens beside it. */
.row100k .bar-lead{display:flex;align-items:center;gap:12px;flex:none;min-width:0}
.row100k .bar-brand{display:inline-flex;align-items:center;min-height:32px;font-family:var(--row-archivo-black),sans-serif;font-size:13px;line-height:1;letter-spacing:.01em;text-transform:uppercase;color:var(--ink);text-decoration:none;white-space:nowrap;transition:color 160ms ease}
.row100k .bar-brand:hover{color:var(--water)}
/* Nav rail + the one accent pill (owner call, 2026-09-05). The section
 * links share a strip; one straight rectangle in the accent rests under
 * the current page and slides to whatever the pointer is over (BarNav
 * measures and moves it). Colour rules: the item under the pill carries the
 * slab type; every other item off the pill is the gray mono of .back-link
 * (the .brand rules stay for a rail that carries a mark). Until the client
 * has measured, the active link paints its own box (.on) so the server
 * markup already looks right; .live hands over to the pill. .jump switches
 * every transition off for one frame so the pill can be placed, not flown.
 * Both link boxes are 32px tall (16px line in 8px of padding) so the pill
 * keeps its height as it crosses from the mark to the mono links, and every
 * word on the bar is the 32px the two chips are, at every width (review,
 * 2026-10-01: from 640px up the rail words were 27px, a short target on a
 * tablet, while the phone cut was already 32). No skew.
 * ON AN INK GROUND THE PILL IS A RULE, not a slab (2026-10-01, the .bar
 * block under the footer rules): the word in the accent on a 2px line of
 * it, the same element sliding the same way. */
.row100k .rail{position:relative;display:flex;align-items:center;gap:4px;flex:none;min-width:0}
.row100k .rail a{position:relative;z-index:1;display:inline-block;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.08em;line-height:16px;text-transform:uppercase;text-decoration:none;color:var(--gray);padding:8px 9px;white-space:nowrap;transition:color 160ms ease}
.row100k .rail a.brand{font-family:var(--row-archivo-black),sans-serif;font-size:13px;letter-spacing:.01em;color:var(--water);padding:8px 10px}
.row100k .rail a.lit{color:var(--on-water)}
.row100k .rail:not(.live) a.on{background:var(--water)}
.row100k .rail-pill{position:absolute;z-index:0;left:0;top:0;width:0;height:0;background:var(--water);opacity:0;pointer-events:none;transition:left 220ms cubic-bezier(.2,.7,.2,1),top 220ms cubic-bezier(.2,.7,.2,1),width 220ms cubic-bezier(.2,.7,.2,1),height 220ms cubic-bezier(.2,.7,.2,1),opacity 160ms ease}
.row100k .rail.jump .rail-pill,.row100k .rail.jump a{transition:none}
/* RACE DAY: the one item on the rail that is already on (owner, 2026-09-11 —
 * a race day header link, the leftmost one, in that white on black font). The
 * rail answers in the accent; race day answers in black and white. So this
 * item never borrows the pill. It carries its own ground, it is inverted at
 * rest, and it inverts AGAIN under the pointer and on its own page — the same
 * flip the SIGN UP slab makes on the page it leads to.
 * THE BOX IS A RAIL LINK TO THE PIXEL: 2px of ink border traded for 2px of
 * padding on every side, so it measures the same 32px as the mono links and
 * the pill keeps its height sliding past it (27 until the rail words grew to
 * 32, review 2026-10-01: 6px of padding over and under, 16px of line and the
 * 2px edge twice). The border is invisible on ink and becomes the edge of the white
 * slab on cream — the trade .bar-log and .outline-btn already make here.
 * Tracking widens to .16em because that is the register of the page itself
 * (rd-mast .22em, rd-stamp .2em, rd-room .14em): a letterspaced mono cap line
 * on black is what that world sounds like. The right padding gives 2px back,
 * since letter-spacing hangs after the last glyph and a short word in a black
 * box shows it. Six pixels of margin each side keeps the black off a pill
 * resting on the next word.
 * IT SNAPS. The rail eases colour over 160ms and nothing else, so an eased
 * inversion is a blank white box for a tenth of a second if only the colour
 * eases, and grey on grey halfway through if both do. A stamp does not fade —
 * and transition none also puts this rule out of reach of the .jump tie, which
 * it would otherwise win on source order alone.
 * Whether it is here at all is BarNav and RowBar, never CSS: when race day is
 * shut it is not in the markup. Under 900px it leaves the rail with the
 * other September words (.rail-x, below). */
.row100k .rail a.rail-stamp{background:var(--ink);border:2px solid var(--ink);color:#fff;font-weight:700;letter-spacing:.16em;padding:6px 5px 6px 7px;margin:0 6px;transition:none}
.row100k .rail a.rail-stamp:hover,.row100k .rail a.rail-stamp:focus-visible,.row100k .rail a.rail-stamp[aria-current=page]{background:#fff;color:var(--ink)}
/* Right-hand chip group pushes itself to the far edge so the bar needs no
 * justify rule.
 * A PAGE TAG IN IT GIVES WAY (review, 2026-10-01). A page can hand the bar a
 * tag (RowBar children: PREVIEW, NOT REAL DATA on the dev pages); that lands
 * here, ahead of the chip. While the bar wrapped, a long tag took a second
 * row; on one line it pushed OPT IN 90px past the edge of a 390 phone and
 * the whole page scrolled sideways. So the group may shrink, the chip and
 * LOG never do, and the tag is what gives: one line, cut with an ellipsis,
 * as much of it as the bar has room for. Under 640px there is room for a
 * letter or three, so it leaves the bar (the 640 block below): only the
 * dev pages hand one in, and most of them say it again in their own head
 * (SAMPLE DATA, FAKE DATA, PREVIEW over the table). Every tag a page
 * hands in is a span.mono; nothing in the account panel is one (its
 * eyebrows are divs). */
.row100k .bar-right{display:flex;align-items:center;gap:12px;margin-left:auto;flex:0 1 auto;min-width:0}
.row100k .bar-right .acct,.row100k .bar-right .acct-chip{flex:none}
.row100k .bar-right span.mono{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* LOG A ROW on the bar (owner call, 2026-09-05): the account chip idiom
 * inverted — solid ink, white mono, the accent on hover — so a joined rower
 * can always reach the form. One element (BarLog): it takes the auto margin
 * and the chip group loses its own, so the pair sits together at the far
 * right, same height as the chip. Both are flex none. */
.row100k .bar-log{display:inline-block;flex:none;margin-left:auto;background:var(--ink);color:#fff;border:2px solid var(--ink);font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;line-height:16px;text-transform:uppercase;padding:6px 12px;text-decoration:none;white-space:nowrap;transition:background 160ms ease,border-color 160ms ease}
.row100k .bar-log:hover,.row100k .bar-log:focus-visible{background:var(--water);border-color:var(--water);color:var(--on-water)}
.row100k .bar-log + .bar-right{margin-left:0}
/* MORE (BarNav): the word a signed-out phone gets in place of the rail
 * words that do not fit one line. A rail link to look at, a button; its
 * list is the account panel hung from the left. */
.row100k .rail-more{position:relative;display:flex;align-items:center}
.row100k .rail-more-btn{all:unset;box-sizing:border-box;cursor:pointer;display:inline-block;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.08em;line-height:16px;text-transform:uppercase;color:var(--gray);padding:8px 9px;white-space:nowrap}
.row100k .rail-more-btn:hover{color:var(--water)}
.row100k .rail-more-btn:focus-visible{outline:2px solid var(--water);outline-offset:-2px}
.row100k .rail-more .acct-panel{left:auto;right:0;min-width:180px}
/* Its items are account-menu items, but they sit inside the rail, where
 * every link is cut as a rail word: grey, inline, 32px of box. One more
 * class than those rules puts the menu item back. */
.row100k .rail .rail-more a.acct-item{display:block;z-index:auto;color:var(--ink);font-size:12px;letter-spacing:.08em;line-height:inherit;padding:11px 2px;white-space:nowrap}
.row100k .rail .rail-more a.acct-item:hover{color:var(--water)}
/* ONE LINE AT EVERY WIDTH (owner, 2026-10-01: look at the header, we need
 * to condense it into one line — on his phone the bar was two rows, the
 * wordmark over THE BOARD and STATS). The two-row phone bar of 2026-09-05
 * is gone and so is the black RACE DAY band that made it three: the bar
 * never wraps, the rail never dissolves into it, and what a narrow screen
 * cannot hold is shortened or moved, never stacked.
 *   - Under 900px the words that are only sometimes there (.rail-x: the
 *     RACE DAY stamp while a race is announced, FEED and PARTNERS in
 *     September) leave the rail. A signed-in rower finds them at the head
 *     of the account menu (.acct-more); a visitor, who has no menu, gets
 *     the word MORE on the rail in their place (.rail-more). From 900px
 *     both of those are gone and the words are on the rail.
 *   - Under 640px LOG A ROW is LOG and ROWER 095 is 095 (the .x spans are
 *     the words dropped), the wordmark steps down to 12px, and every
 *     control is 32px tall: the links 16px of line in 8px of padding, the
 *     two chips 16px in 6px and a 2px edge. The bar is 50px.
 *   - Under 360px (320px phones) the gutters, the gaps and the tracking
 *     tighten once more and the wordmark is 11px.
 * Measured at 390, 360 and 320, signed in and out: one row, no scroll. */
@media(max-width:899px){
  .row100k .rail .rail-x{display:none}
}
@media(min-width:900px){
  .row100k .rail-more,.row100k .acct-more{display:none}
}
@media(max-width:639px){
  .row100k .bar{gap:10px;padding:8px 16px}
  .row100k .bar-brand{font-size:12px}
  .row100k .rail{gap:0}
  .row100k .rail a,.row100k .rail-more-btn{font-size:11px;letter-spacing:.06em;padding:8px 6px}
  .row100k .bar-right{gap:8px}
  .row100k .bar-log{letter-spacing:.06em;padding:6px 8px}
  .row100k .bar-log .x,.row100k .acct-chip .x{display:none}
  .row100k .bar-right span.mono{display:none}
}
@media(max-width:359px){
  .row100k .bar{gap:6px;padding:8px 12px}
  .row100k .bar-brand{font-size:11px}
  .row100k .rail a,.row100k .rail-more-btn{letter-spacing:.03em;padding:8px 4px}
  .row100k .bar-right{gap:6px}
  .row100k .bar-log{letter-spacing:.03em;padding:6px}
}
/* Account chip + dropdown (top-right of the bar). 16px of line so the chip
 * and LOG A ROW are the same 32px. */
.row100k .acct{position:relative;display:flex;align-items:center}
.row100k .acct-chip{border:2px solid var(--ink);background:transparent;color:var(--ink);font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;line-height:16px;text-transform:uppercase;padding:6px 12px;cursor:pointer;white-space:nowrap}
.row100k .acct-chip:hover{border-color:var(--water);color:var(--water)}
.row100k .acct-overlay{position:fixed;inset:0;z-index:55}
/* The admin menu has grown a group at a time and is now longer than a
   phone (owner, 2026-09-11: the options menu is getting pretty long, and on
   mobile he needs to be able to scroll through it). So it is capped at what
   fits under the bar and scrolls inside itself rather than running off the
   bottom of the screen: the cap is the viewport minus the bar and a margin,
   momentum scrolling on iOS, and the panel keeps its own overscroll so the
   page behind it does not move with it.
   IT HANGS FROM THE RULE (review, 2026-10-01): its top edge lies on the
   2px rule under the bar, so the two lines are one. The gap is the bar
   padding under the chip: 14px from 640px, 8px on a phone. At 12px it sat
   2px above the rule on a desktop, edge on rule, one fat white line. */
.row100k .acct-panel{position:absolute;top:calc(100% + 14px);right:0;background:var(--paper);border:2px solid var(--ink);box-shadow:6px 6px 0 rgba(21,23,26,.14);padding:4px 16px;min-width:220px;z-index:60;max-height:calc(100vh - 120px);max-height:calc(100dvh - 120px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.row100k .acct-item{display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px dashed var(--line);font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:11px 2px;cursor:pointer;color:var(--ink);text-decoration:none}
.row100k .acct-item:last-child{border-bottom:none}
.row100k .acct-more .acct-item:last-child{border-bottom:1px dashed var(--line)}
.row100k .acct-item:hover{color:var(--water)}
.row100k .acct-item.danger:hover{color:#b3400f}
/* The phone chips: a tighter chip buys the room. Sits after the base rule
 * so it wins. */
@media(max-width:639px){
  .row100k .acct-chip{letter-spacing:.06em;padding:6px 8px}
  .row100k .acct-panel{top:calc(100% + 8px)}
}
@media(max-width:359px){
  .row100k .acct-chip{letter-spacing:.03em;padding:6px}
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
/* The top five men and women: two compact boards. */
.row100k .front-top{display:grid;grid-template-columns:1fr;gap:22px}
@media(min-width:640px){.row100k .front-top{grid-template-columns:1fr 1fr}}
.row100k .front-three{min-width:0}
.row100k .front-three h3{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px}
.row100k .front-three table.board td{padding:9px 6px}
/* While a blackout window is open the two podiums give way to one
 * EliteList across the whole measure: the podium density kept, and the
 * heading rule as heavy as a podium heading. */
.row100k .front-elite{min-width:0;scroll-margin-top:64px}
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
.row100k .send{display:block;width:100%;margin-top:30px;background:var(--water);color:var(--on-water);border:none;font-family:var(--row-archivo-black),sans-serif;font-size:20px;text-transform:uppercase;letter-spacing:.04em;padding:18px;cursor:pointer;text-align:center;text-decoration:none}
.row100k .send:hover{background:var(--water-hover)}
.row100k .send:disabled{background:var(--line);color:var(--paper);cursor:default}
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
.row100k .share-mark{display:inline-block;font-family:var(--row-archivo-black),sans-serif;font-size:14px;line-height:1;letter-spacing:.01em;text-transform:uppercase;color:var(--on-water);background:var(--water);padding:7px 12px 6px}
.row100k .share-x{position:absolute;right:0;top:0;background:none;border:none;font-size:26px;line-height:1;cursor:pointer;color:var(--ink);padding:0 2px}
.row100k .share-x:hover{color:var(--water)}
.row100k .share-picker{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.row100k .share-pick{border:2px solid var(--line);background:none;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:7px 11px;cursor:pointer;color:var(--ink-soft)}
.row100k .share-pick.on{border-color:var(--ink);color:var(--ink)}
.row100k .share-stage{margin-top:14px;border:2px solid var(--ink);padding:14px;background:var(--paper)}
.row100k .share-stage.dark{background:var(--frame);background-image:linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%),linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%);background-size:24px 24px;background-position:0 0,12px 12px}
.row100k .share-canvas{display:block;width:100%;height:auto}
.row100k .share-note{margin-top:10px;font-size:11px;letter-spacing:.08em;color:var(--gray)}
.row100k .share-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
/* The ONE .share-btn rule set (a second, later definition used to override
 * this into a blue Archivo block; it is gone): outlined mono by default,
 * .primary filled water, .quiet a gray outline for the exit nobody on a
 * phone needs. .share-link is the phone DOWNLOAD — a text link under the
 * two filled buttons. */
.row100k .share-btn{border:2px solid var(--ink);background:none;color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:12px 16px;cursor:pointer;flex:1 1 auto;border-radius:0}
.row100k .share-btn:hover{background:var(--water);border-color:var(--water);color:var(--on-water)}
.row100k .share-btn.primary{background:var(--water);border-color:var(--water);color:var(--on-water)}
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
.row100k .big-act.primary{background:var(--water);border-color:var(--water);color:var(--on-water)}
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
/* THE LOG FORM, to the mock the owner picked (2026-10-01: I like this
 * version of the log a row screen, but the main button stays LOG IT):
 * a mono dateline, the two figures big over their rules, the split line,
 * the day and title on a dashed rule, the photos, and LOG IT as one big
 * word underlined in the accent rather than a filled slab. The two pairs
 * stay side by side on a phone, as drawn. */
.row100k .logf-head{font-family:var(--row-mono),monospace;font-size:12px;line-height:18px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin:0 0 4px}
.row100k .logf-big{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 28px}
.row100k .logf-big label.fl{margin-top:6px}
.row100k .logf input.logf-num{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(34px,11vw,64px);line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums;padding:4px 0 8px}
.row100k .logf input.logf-num::placeholder{color:var(--line)}
.row100k .logf .split-live{margin-top:14px;font-size:13px;letter-spacing:.1em;text-transform:uppercase}
.row100k .logf .split-live b{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
.row100k .logf-small{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 28px;border-top:1px dashed var(--line);margin-top:18px}
.row100k .logf-small input[type=text],.row100k .logf-small input[type=date]{font-size:17px;color:var(--ink-soft)}
.row100k .logf-photos{border-top:1px dashed var(--line);margin-top:24px}
.row100k .logf .send{display:inline-block;width:auto;margin-top:30px;padding:0;background:none;color:var(--ink);font-size:clamp(44px,13vw,64px);line-height:1.1;letter-spacing:-.01em;text-decoration:underline;text-decoration-color:var(--water);text-decoration-thickness:.09em;text-underline-offset:.12em;text-decoration-skip-ink:none;transition:color 160ms ease}
.row100k .logf .send:hover{background:none;color:var(--water)}
.row100k .logf .send:disabled{background:none;color:var(--gray);text-decoration-color:var(--line)}
.row100k .logf .form-ok{border:none;border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);text-align:left;padding:14px 0}
/* The second-look strip: sits between the photos and the button when a row
 * falls outside the band everyone else has logged. It asks, it never
 * blocks — both answers are plain outline buttons. */
.row100k .logf-ask{margin-top:22px;border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);padding:14px 0 16px}
.row100k .logf-ask .k{display:block;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--water)}
.row100k .logf-ask p{margin-top:6px;font-size:14px;line-height:1.5;color:var(--ink-soft)}
.row100k .logf-ask p b{color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .logf-ask-acts{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
@media(max-width:560px){.row100k .logf-big,.row100k .logf-small{gap:0 18px}}

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
.row100k .donebadge{display:inline-block;font-size:10px;background:var(--water);color:var(--on-water);padding:1px 6px;margin-left:8px;vertical-align:1px;font-family:var(--row-mono),monospace}
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
.row100k .rec .duo{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;margin-top:8px}
.row100k .rec .duo .side+.side{border-left:1px dashed var(--line);padding-left:16px}
.row100k .rec .duo .dv{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.18em;color:var(--water);text-transform:uppercase}
.row100k .rec .duo .v{margin-top:4px}
.row100k .stats-link{margin-top:22px;flex:none;width:100%}
@media(max-width:640px){.row100k .records .rec .duo{grid-template-columns:1fr 1fr}}

/* Movement arrows + finisher rows in the standings table. */
.row100k .mv{font-family:var(--row-mono),monospace;font-size:11px;white-space:nowrap}
/* Up is the accent; down is the key grey. Down was a rust (#b3400f), which
 * sat fine beside the water blue and is the same colour as the burnt
 * orange the paper look wears now — two arrows told apart by shape alone. */
.row100k .mv.up{color:var(--water)}
.row100k .mv.dn{color:var(--gray)}
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

/* The rowers page (/row100k/signups, admin only; rowers/RowersTable.tsx):
 * one .board of every rower with a ... menu on the right end of each row
 * (the ledger menu idiom, .mlg-menu), the row opening in place to show
 * that log as a nested .board with EDIT / REMOVE on every row. Instagram
 * and joined leave the table under 640px (the open panel prints them) and
 * a title moves under its day. Sort chips are the .tabs group; the find
 * box is the underline input the forms use. */
.row100k .rw-tools{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin-bottom:20px}
.row100k .rw-tools .tabs{margin-bottom:0}
.row100k .rw-find{flex:1;min-width:140px;background:transparent;border:0;border-bottom:2px solid var(--line);color:var(--ink);font-family:var(--row-mono),monospace;font-size:13px;letter-spacing:.06em;padding:8px 2px;border-radius:0;appearance:none;-webkit-appearance:none}
.row100k .rw-find:focus{outline:none;border-bottom-color:var(--water)}
.row100k .rw-find::placeholder{color:var(--gray);text-transform:uppercase;letter-spacing:.12em;font-size:11px}
.row100k table.board.rw-t th.rw-c,.row100k table.board.rw-t td.rw-c{width:34px;padding-left:0;padding-right:0;text-align:right}
.row100k .rw-r{cursor:pointer}
.row100k .rw-r:hover td{background:color-mix(in srgb,var(--water-pale) 45%,transparent)}
.row100k .rw-r.on td{background:var(--water-pale)}
.row100k .rw-name{appearance:none;-webkit-appearance:none;background:none;border:0;padding:0;margin:0;color:var(--ink);font:inherit;font-weight:700;text-align:left;cursor:pointer}
.row100k .rw-name:hover{color:var(--water)}
.row100k .rw-caret{display:inline-block;width:14px;color:var(--gray);font-family:var(--row-mono),monospace;font-size:11px}
.row100k .rw-r.on .rw-caret{color:var(--water)}
.row100k .rw-anchor{position:relative;display:inline-block}
.row100k .rw-dots{background:none;border:0;color:var(--gray);font-family:var(--row-mono),monospace;font-size:16px;line-height:1;cursor:pointer;padding:4px 6px}
.row100k .rw-dots:hover,.row100k .rw-dots.on{color:var(--ink)}
.row100k .rw-overlay{position:fixed;inset:0;z-index:55}
.row100k .rw-menu{position:absolute;top:calc(100% + 6px);right:0;background:var(--paper);border:2px solid var(--ink);box-shadow:6px 6px 0 rgba(21,23,26,.14);padding:2px 14px;min-width:172px;z-index:60;text-align:left}
.row100k .rw-menu a,.row100k .rw-menu button{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px dashed var(--line);color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:9px 0;cursor:pointer;text-decoration:none;white-space:nowrap}
.row100k .rw-menu a:last-child,.row100k .rw-menu button:last-child{border-bottom:0}
.row100k .rw-menu a:hover,.row100k .rw-menu button:hover{color:var(--water)}
.row100k .rw-menu .danger{color:#b3400f}
.row100k .rw-menu button:disabled{color:var(--gray);cursor:default}
.row100k table.board td.rw-panel{padding:8px 0 20px 44px;cursor:default}
.row100k .rw-head{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);line-height:1.8;margin-bottom:10px;overflow-wrap:anywhere}
.row100k .rw-head b{color:var(--ink);font-weight:400}
.row100k table.board.rw-rows{font-size:12px;background:transparent}
.row100k table.board.rw-rows th{padding:6px}
.row100k table.board.rw-rows td{padding:8px 6px}
.row100k table.board.rw-rows th.rw-c,.row100k table.board.rw-rows td.rw-c{width:auto;white-space:nowrap;text-align:right;padding-left:16px;padding-right:0}
.row100k .rw-ttl{color:var(--gray);overflow-wrap:anywhere}
.row100k .rw-m{display:none}
.row100k .rw-acts{display:inline-flex;gap:12px;justify-content:flex-end}
.row100k .rw-act{appearance:none;-webkit-appearance:none;background:none;border:0;padding:0;color:var(--gray);font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.row100k .rw-act:hover{color:var(--water)}
.row100k .rw-act.danger:hover{color:#b3400f}
.row100k .rw-act:disabled{color:var(--line);cursor:default}
.row100k table.board tr.rw-edit td{padding:12px 6px 14px;cursor:default}
.row100k .rw-edit-line{display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
.row100k .rw-edit input{background:transparent;border:0;border-bottom:2px solid var(--line);color:var(--ink);font-family:var(--row-mono),monospace;font-size:13px;padding:3px 2px;border-radius:0;appearance:none;-webkit-appearance:none}
.row100k .rw-edit input:focus{outline:none;border-bottom-color:var(--water)}
.row100k .rw-edit-split{font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray);font-variant-numeric:tabular-nums}
.row100k .rw-edit-title{display:block;width:100%;margin-top:12px}
.row100k .rw-edit .tabs{margin:14px 0 0}
.row100k .rw-edit .tabs button{padding:7px 14px;font-size:11px}
.row100k .rw-edit .tabs button:disabled{opacity:.5;cursor:default}
.row100k table.board tr.rw-err td{padding:0 0 10px;border-bottom:0;cursor:default}
.row100k tr.rw-err .form-err{margin-top:8px}
.row100k .rw-edit .form-err{margin-top:12px}
.row100k table.board.rw-rows tr.rw-err td{padding:0 6px 10px}
@media(max-width:640px){
  .row100k .rw-x{display:none}
  .row100k .rw-m{display:block}
  .row100k table.board.rw-t td,.row100k table.board.rw-t th{padding-left:4px;padding-right:4px}
  .row100k table.board td.rw-panel{padding:6px 0 16px}
  .row100k .rw-acts{display:inline-grid;gap:4px;justify-items:end}
}
.row100k .back-link{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;text-decoration:none;color:var(--gray)}
.row100k .back-link:hover{color:var(--water)}

/* September heatmap (GitHub-commit style, one month, no day numbers).
 * ONE HUE (owner, 2026-10-01: the colors on some of these charts are a
 * little funky, like they are blue and also red or orange): the four heats
 * were fixed blues and stayed blue whatever the palette put beside them.
 * They are steps of the accent over the ground now — 14, 38 and 68 parts
 * in a hundred, then the accent itself — so a chart is the type colour
 * and one accent. The hour grid and the year grid wear the same steps. */
.row100k .hm{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.row100k .hm .dow{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;color:var(--gray);text-align:center;padding-bottom:3px}
.row100k .hm-cell{aspect-ratio:1;border:1px dashed var(--line)}
.row100k .hm-cell.b1{background:color-mix(in srgb,var(--water) 14%,var(--paper));border:1px solid transparent}
.row100k .hm-cell.b2{background:color-mix(in srgb,var(--water) 38%,var(--paper));border:1px solid transparent}
.row100k .hm-cell.b3{background:color-mix(in srgb,var(--water) 68%,var(--paper));border:1px solid transparent}
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

/* No side padding of its own: the .wrap inside carries the page gutter, so
 * the wordmark starts where the content above it starts (owner,
 * 2026-09-25: the footer on the main page is a different width than the
 * page — with 20px here AND the wrap stripped of its gutter, the footer
 * sat 20px left of the measure on every desktop page). RowFooter.tsx. */
.row100k footer{padding:44px 0 64px;border-top:2px solid var(--ink);margin-top:56px}
/* THE FOOTER AT THE FOOT (owner, 2026-10-01: when a page is short, the
 * footer still sits at the bottom of the screen). A page root that holds
 * the footer spacer (RowFooter.tsx .foot-push) is a flex column at least a
 * screen tall; the spacer grows into what the content leaves. A .wrap
 * straight under the root keeps its full measure (auto side margins would
 * otherwise shrink it to its content). Nothing shrinks: the root is only
 * ever as tall as its content or the screen, never shorter than the
 * content, so no flex-shrink rule is needed.
 * NO CHILD COMBINATOR IN THESE RULES. React escapes the greater-than sign
 * in a style tag on the server, so the rules arrived broken and every page
 * fell back to client rendering on the text mismatch. The spacer is only
 * ever a child of the page root (RowFooter.tsx), so a root that holds it
 * anywhere is the root that holds it as a child, and a .wrap followed by
 * the spacer is a .wrap beside it. */
.row100k:has(.foot-push){display:flex;flex-direction:column}
.row100k .wrap:has(~ .foot-push){width:100%}
.row100k .foot-push{flex:1 0 0}
.row100k footer .big{font-family:var(--row-archivo-black),sans-serif;font-size:13px;letter-spacing:.1em;margin-bottom:10px}
.row100k footer .mono{font-size:11px;color:var(--gray);line-height:1.9}
.row100k footer a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.row100k footer a:hover{color:var(--water)}

/* ----------------------------------------------------------------------
 * THE CHROME ON AN INK GROUND — the bar, the raffle strip, the account
 * menu and the footer. Two kinds of page are ink: one under the ink look
 * (.row-ink, at the foot of this sheet, which flips the palette under
 * everything), and one that is ink on its own and wears .chrome-ink on its
 * wrapper — the landing, race day, the results board (owner, 2026-09-12:
 * make the header and footer black and white on the race day sign up page;
 * and the day before, that the way the header changes on the results board
 * is the kind of change that should happen everywhere).
 *
 * ONE BLOCK FOR BOTH. Until 2026-10-01 each ground had its own copy of
 * these rules and both were monochrome: a white pill, a white LOG A ROW,
 * no hue anywhere. The ink look is the site now and it wears the palette
 * accent (owner, 2026-10-01: instead of red, let us pick like October
 * orange), so the two copies are one, written through dark() and four
 * --bar-* variables: .chrome-ink names its black and its paper here, the
 * ink look hands over its flipped --paper and --ink (the INK root).
 *
 * WHAT IS THE ACCENT UP HERE AND WHAT IS NOT. The word of the page you are
 * on and the 2px rule under it; OPT IN; the hover of every word and chip.
 * The wordmark, the rule under the bar, the RACE DAY stamp and LOG A ROW
 * are the type colour.
 *
 * THE PILL IS A RULE. On cream the indicator is a slab of the accent with
 * the word knocked out of it. On black that slab beside the OPT IN slab is
 * two blocks of orange in one bar, so the same element (BarNav still
 * measures it and slides it) keeps its box, drops its fill and draws only
 * its bottom edge, and the word it sits under goes to the accent. Before
 * the client has measured, the active link draws the same rule itself
 * (.on, an inset line, so its box does not grow).
 *
 * THE STAMP FLIPS WITH THE GROUND. On cream RACE DAY is the one black thing
 * on the rail; on ink it has to be the one white thing, or it is a black
 * chip on a black bar. REST IS THE HOLLOW ONE: ink ground, white edge,
 * white letters — a box that is plainly not LOG A ROW, which rests filled.
 * The flip, on pointer, keyboard focus and its own page, fills white with
 * ink type. Both of its rules end in a.rail-stamp on purpose — the plain
 * rail colour above ties with the base stamp rule and wins on source order,
 * which was the bug of 2026-09-12. The border colour is set once, at rest,
 * and holds through the flip.
 *
 * THE MENU IS INK TOO. The account panel was left a cream panel on a
 * .chrome-ink page (its type is ink, and a white focus ring vanished on
 * it). With the whole site on black a cream sheet falling out of a black
 * bar is the odd one, so it takes the ground, a white edge and no shadow.
 *
 * ONLY FOR A PAGE THAT IS INK TOP TO BOTTOM. .chrome-ink inverts the
 * chrome, not the body: on a cream page it would hang a black bar over a
 * cream article. A dark body paints its own focus ring (rd-dark, rr-dark).
 *
 * It sits after every rule it re-cuts, because several tie on specificity
 * and source order is what settles a tie. */
.row100k.chrome-ink{--bar-bg:#15171a;--bar-fg:#F4F3EE;--bar-dim:rgba(244,243,238,.62);--bar-hair:rgba(244,243,238,.24)}
${dark(".bar")}{background:var(--bar-bg);border-bottom-color:var(--bar-fg)}
${dark(".bar-brand")}{color:var(--bar-fg)}
${dark(".bar-brand:hover")}{color:var(--water)}
${dark(".bar .mono")}{color:var(--bar-dim)}
${dark(".rail a", ".rail-more-btn")}{color:var(--bar-dim)}
${dark(".rail a.brand")}{color:var(--bar-fg)}
${dark(".rail a.lit", ".rail-more-btn:hover")}{color:var(--water)}
${dark(".rail-pill")}{background:none;border-bottom:2px solid var(--water)}
${dark(".rail:not(.live) a.on")}{background:none;color:var(--water);box-shadow:inset 0 -2px 0 var(--water)}
${dark(".rail a.rail-stamp")}{background:transparent;border-color:var(--bar-fg);color:var(--bar-fg)}
${dark(".rail a.rail-stamp:hover", ".rail a.rail-stamp:focus-visible", ".rail a.rail-stamp[aria-current=page]")}{background:var(--bar-fg);color:var(--bar-bg)}
${dark(".acct-chip")}{border-color:var(--bar-fg);color:var(--bar-fg)}
${dark(".acct-chip:hover")}{background:none;border-color:var(--water);color:var(--water)}
/* OPT IN, the signed-out chip: a block of the accent on any ground, in the
 * type a slab of it carries (ink on the pumpkin, white on a red). The
 * landing hands in its own cut of both (--l1-accent, --l1-caps). */
.row100k .acct-chip.opt,${dark(".acct-chip.opt")}{background:var(--l1-accent,var(--water));border-color:var(--l1-accent,var(--water));color:var(--l1-caps,var(--on-water))}
.row100k .acct-chip.opt:hover,${dark(".acct-chip.opt:hover")}{background:var(--l1-accent-hover,var(--water-hover));border-color:var(--l1-accent-hover,var(--water-hover));color:var(--l1-caps,var(--on-water))}
${dark(".bar-log")}{background:var(--bar-fg);border-color:var(--bar-fg);color:var(--bar-bg)}
${dark(".bar-log:hover", ".bar-log:focus-visible")}{background:var(--water);border-color:var(--water);color:var(--on-water)}
${dark(".acct-panel")}{background:var(--bar-bg);border-color:var(--bar-fg);box-shadow:none}
${dark(".acct-item", ".rail .rail-more a.acct-item")}{color:var(--bar-fg);border-bottom-color:var(--bar-hair)}
${dark(".acct-item:hover", ".rail .rail-more a.acct-item:hover")}{color:var(--water)}
/* A danger item says so with an underline, not a rust. */
${dark(".acct-item.danger:hover")}{color:var(--bar-fg);text-decoration:underline;text-underline-offset:3px}
/* The raffle strip was an ink band already: it takes the ground, a white
 * rule under it, plain white type, and its button is the white slab LOG A
 * ROW is, with the same accent under the pointer. */
${dark(".rfb")}{background:var(--bar-bg);color:var(--bar-fg);border-bottom-color:var(--bar-fg)}
${dark(".rfb-k", ".rfb-t", ".rfb-t b", ".rfb-x")}{color:var(--bar-fg)}
${dark(".rfb-cta")}{background:var(--bar-fg);border-color:var(--bar-fg);color:var(--bar-bg)}
${dark(".rfb-cta.in")}{background:transparent;color:var(--bar-fg)}
${dark(".rfb-cta:hover", ".rfb-cta:focus-visible")}{background:var(--water);border-color:var(--water);color:var(--on-water)}
/* The footer under the ink look comes through the flipped variables; a
 * .chrome-ink page names its own. */
.row100k.chrome-ink footer{background:var(--bar-bg);color:var(--bar-fg);border-top-color:var(--bar-fg);margin-top:0}
.row100k.chrome-ink footer .mono,.row100k.chrome-ink footer a{color:var(--bar-fg)}
.row100k.chrome-ink footer a:hover{color:var(--water)}
.row100k.chrome-ink .bar :focus-visible,.row100k.chrome-ink .rfb :focus-visible,.row100k.chrome-ink footer :focus-visible{outline-color:var(--bar-fg)}

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
 * badge alone says the tier.
 * THE .25M IS PREMIUM, NOT MUSTARD (owner, 2026-09-16: it should look more
 * elite). The legend ink is a deep gold now — 4.9:1 on the cream, so the
 * divider row still reads — and the badge itself is a matte ink slab with
 * champagne type and a champagne hairline, tracked wide. It is told from the
 * black ELITE tag by the gold; under the ink look ELITE goes hollow with a
 * white ring and the .25M keeps its gold on a lifted slab. */
.row100k{
  --tier-common-ink:var(--ink);
  --tier-rare-ink:#256e45;
  --tier-epic-ink:var(--water);
  --tier-legend-ink:#85661a;
}
/* Badge chip IN FRONT of the name — same voice as .donebadge, colored by
 * rarity. .elite is the black ELITE tag a blacked-out row wears in its
 * place. */
.row100k .tierbadge{display:inline-block;font-size:10px;color:#fff;padding:1px 6px;margin-right:8px;vertical-align:1px;font-family:var(--row-mono),monospace;letter-spacing:.04em}
.row100k .tierbadge.common{background:var(--tier-common-ink)}
.row100k .tierbadge.rare{background:var(--tier-rare-ink)}
.row100k .tierbadge.epic{background:var(--tier-epic-ink);color:var(--on-water)}
/* The border is traded for padding (1px for 1px, top and bottom; 1px of the
 * 6px each side) so the badge measures the same as its neighbours. */
.row100k .tierbadge.legend{background:#15171a;color:#E6C46B;border:1px solid #E6C46B;padding:0 5px;letter-spacing:.12em}
.row100k .tierbadge.elite{background:var(--ink)}
.row100k .tierbadge.pace{background:var(--ink);letter-spacing:.02em}
/* THE DOG TAG (DogTag.tsx): one of the elite, seen by anybody else while
 * a window is open. White on black, and nothing on it but who they are and
 * the one figure that stays public — the average split (owner, 2026-09-06:
 * rower dog tag vibes, the pace as the identity). Ink is the ground, so no
 * new colour enters the palette; the inner rule is the stamped edge.
 * Every line names its own colour: the site stylesheet paints every p in
 * ink (globals.css), and a line left to inherit the white went dark. The
 * name and the pace are full white; the rest is deliberately dimmed. The
 * number sits on the name line at the name size, grey, as it does on the
 * profile nameplate (owner, 2026-09-08). */
.row100k .dt{background:var(--ink);color:#fff;padding:10px;margin-top:26px}
.row100k .dt-in{border:1px solid rgba(255,255,255,.28);padding:clamp(26px,7vw,54px) clamp(18px,5vw,44px)}
.row100k .dt-eye{font-size:10px;letter-spacing:.22em;color:rgba(255,255,255,.55);text-transform:uppercase;margin:0}
.row100k .dt-name{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(28px,7vw,60px);line-height:1;letter-spacing:-.02em;text-transform:uppercase;color:#fff;margin:22px 0 0;overflow-wrap:anywhere}
.row100k .dt-name .num{color:var(--gray)}
.row100k .dt-pace{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(64px,18vw,150px);line-height:.92;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:#fff;margin:clamp(24px,5vw,44px) 0 0}
.row100k .dt-unit{font-size:11px;letter-spacing:.2em;color:rgba(255,255,255,.62);text-transform:uppercase;margin:10px 0 0}
.row100k .dt-foot{font-size:10px;letter-spacing:.18em;color:rgba(255,255,255,.45);text-transform:uppercase;margin:clamp(26px,6vw,46px) 0 0;border-top:1px solid rgba(255,255,255,.22);padding-top:14px}
.row100k .dt-find{margin-top:26px}
/* THE PACE and THE FIELD on the profile: two eyebrowed blocks, full width.
 * .pf-tag is the elite rower s own dog tag under their stats (owner,
 * 2026-09-08: what everyone else sees) — the eyebrow carries the gap. */
.row100k .pf-block{margin-top:34px}
/* A WORD THAT IS A MENU (TextMenu.tsx): the label in the type it sits in
 * with a dotted rule under it, the list in the house panel. */
.row100k .tm{position:relative;display:inline-block}
.row100k .tm-btn{all:unset;cursor:pointer;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .tm-btn:hover{color:var(--water)}
.row100k .tm-btn:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .tm-list{position:absolute;left:0;top:calc(100% + 8px);z-index:45;min-width:200px;margin:0;padding:6px 0;list-style:none;background:var(--paper);border:2px solid var(--ink);box-shadow:0 10px 30px rgba(0,0,0,.12);font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;line-height:1.3;text-align:left}
.row100k .tm-list.right{left:auto;right:0}
.row100k .tm-list a{display:block;padding:9px 14px;color:var(--ink);text-decoration:none;white-space:nowrap}
.row100k .tm-list a:hover,.row100k .tm-list a:focus-visible{background:var(--water-pale);outline:none}
.row100k .tm-list a.on{color:var(--water)}
/* THE OFF-SEASON FRONT (owner, 2026-09-24): the month as a subtitle, the
 * stats as the main object. */
.row100k .front-head.off{padding:22px 0 0}
.row100k .front-kicker{font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:10px}
.row100k .front-kicker .dim{color:var(--ink-soft)}
.row100k .front-stats.big .n{font-size:clamp(30px,7vw,56px)}
@media(min-width:640px){.row100k .front-stats.big .n{font-size:clamp(28px,4.2vw,52px)}}
@media(min-width:640px){
  .row100k .front-stats.three{grid-template-columns:1fr 1fr 1fr}
  .row100k .front-stats.three .cell+.cell{border-right:1px solid var(--ink);padding-right:18px}
  .row100k .front-stats.three .cell:last-child{border-right:none;padding-right:0}
}
/* THE ERG table on the profile (ErgRows.tsx): mono, ruled, scrolls
 * sideways on a phone rather than squeezing six columns. */
.row100k .pf-erg-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.row100k .pf-erg-tab{width:100%;border-collapse:collapse;font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink)}
.row100k .pf-erg-tab th{text-align:left;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);padding:0 14px 8px 0;border-bottom:1px solid var(--ink);white-space:nowrap}
.row100k .pf-erg-tab td{padding:10px 14px 10px 0;border-bottom:1px solid var(--line);vertical-align:middle;white-space:nowrap}
.row100k .pf-erg-tab td.num{font-variant-numeric:tabular-nums}
.row100k .pf-erg-tab td.tt{white-space:normal;min-width:140px}
.row100k .pf-erg-act{display:inline-flex;gap:14px}
.row100k .pf-erg-act a{color:var(--water);font-weight:700;letter-spacing:.12em;font-size:10px;text-decoration:none}
.row100k .pf-erg-act a:hover{text-decoration:underline}
.row100k .pf-block:first-child{margin-top:0}
.row100k .pf-tag .dt{margin-top:0}
.row100k .pf-pace{margin-top:0;padding-top:0;border-top:none;position:relative}
.row100k .pf-pace .tip{position:absolute;pointer-events:none;background:var(--ink);color:var(--paper);font-family:var(--row-mono),monospace;font-size:11px;padding:5px 8px;white-space:nowrap;transform:translate(-50%,-130%);z-index:5}
.row100k .pf-block .st-tiles{margin-top:0}
/* THE SHIRT (dev/shirts): one product photo at a time with a stepper,
 * centred in the measure, the price as a headline, and the sizes SIDE BY
 * SIDE as black boxes with big white letters (owner, 2026-09-08) — the
 * boxes are the size picker, one line on each (left, or pre-ordered), one
 * button under them that becomes a YES / KEEP pair on a size change.
 * Pick-up only, so no address. */
.row100k .sh-photo{position:relative;aspect-ratio:4/5;max-width:520px;margin:6px auto 0;overflow:hidden;background:var(--paper);border:1px solid var(--line)}
.row100k .sh-photo img{width:100%;height:100%;object-fit:cover;display:block}
.row100k .sh-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border:none;background:rgba(21,23,26,.72);color:#fff;font-family:var(--row-mono),monospace;font-size:18px;cursor:pointer}
.row100k .sh-nav.prev{left:0}
.row100k .sh-nav.next{right:0}
.row100k .sh-nav:hover{background:var(--ink)}
.row100k .sh-dots{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.2em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.row100k .sh-pitch{border-top:2px solid var(--ink);margin-top:26px;padding-top:18px}
.row100k .sh-kick{font-size:10px;letter-spacing:.2em;color:var(--gray);text-transform:uppercase;margin:0}
.row100k .sh-price{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(34px,9vw,72px);line-height:1;letter-spacing:-.02em;margin:10px 0 0;color:var(--water)}
.row100k .sh-price .or{font-size:.42em;color:var(--gray);font-family:var(--row-archivo),sans-serif;font-weight:700;letter-spacing:0;margin:0 .1em}
.row100k .sh-line{font-size:12px;letter-spacing:.18em;color:var(--ink);text-transform:uppercase;font-weight:700;margin:12px 0 0}
.row100k .sh-copy{font-size:16px;line-height:1.55;color:var(--ink-soft);max-width:56ch;margin:12px 0 0}
.row100k .sh-due{font-size:11px;letter-spacing:.12em;color:var(--water);text-transform:uppercase;margin:14px 0 0}
.row100k .sh-pick{font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;margin:10px 0 0;line-height:1.7}
/* The size boxes: a row that scrolls sideways on a phone rather than
 * wrapping, so the five stay side by side at every width. */
.row100k .sh-sizes{display:flex;gap:8px;margin-top:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
.row100k .sh-sizes::-webkit-scrollbar{display:none}
.row100k .sh-size{flex:1 0 116px;min-width:116px;background:var(--ink);color:#fff;border:2px solid var(--ink);padding:14px 8px 12px;text-align:center;cursor:pointer;transition:background 160ms ease,border-color 160ms ease}
.row100k .sh-size:hover:not(:disabled){border-color:var(--water)}
.row100k .sh-size.on{background:var(--water);border-color:var(--water)}
.row100k .sh-size.on .sh-sz,.row100k .sh-size.on .sh-cnt .hot{color:var(--on-water)}
.row100k .sh-size.on .sh-cnt{color:var(--on-water);opacity:.8}
.row100k .sh-size:disabled{cursor:default}
.row100k .sh-size.mine{outline:2px solid var(--water);outline-offset:2px}
.row100k .sh-sz{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,7vw,44px);line-height:1;color:#fff}
.row100k .sh-cnt{display:block;margin-top:8px;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.72);line-height:1.6;white-space:nowrap}
.row100k .sh-cnt .hot{color:#fff;font-weight:700}
.row100k .sh-buy{margin-top:16px;width:100%;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(18px,4.6vw,24px);text-transform:uppercase;letter-spacing:.02em;padding:16px 18px;border:2px solid var(--ink);background:var(--ink);color:#fff;cursor:pointer;transition:background 160ms ease,border-color 160ms ease}
.row100k .sh-buy:hover:not(:disabled){background:var(--water);border-color:var(--water);color:var(--on-water)}
.row100k .sh-buy:disabled{opacity:.45;cursor:default}
.row100k a.sh-buy{display:block;text-align:center;text-decoration:none}
.row100k .sh-confirm{display:flex;gap:8px;margin-top:16px}
.row100k .sh-confirm .sh-buy{margin-top:0;flex:1 1 0;min-width:0;padding-left:10px;padding-right:10px}
.row100k .sh-buy.keep{background:transparent;color:var(--ink)}
.row100k .sh-buy.keep:hover:not(:disabled){background:transparent;border-color:var(--water);color:var(--water)}
.row100k .sh-buy-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;margin:10px 0 0;line-height:1.7}
.row100k .sh-pay{margin-top:18px;max-width:420px}
.row100k .sh-settle{margin-top:40px}
.row100k .dt-find .pf-date{padding-top:0}
/* THE ELITE as a list (EliteList.tsx): the board idiom without a place
 * column; a one-letter division cell where the rank would sit, the blocks
 * on the right. The eyebrow is the profile one (.pf-eye). */
.row100k .elite{margin-top:4px}
.row100k .elite-eye{display:flex;justify-content:space-between;align-items:baseline;gap:6px 16px;flex-wrap:wrap;border-bottom:1px solid var(--ink);padding-bottom:8px;margin-bottom:10px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .elite-eye .r{color:var(--gray);font-weight:400}
.row100k table.board.elite-t td.dv{width:22px;color:var(--gray);font-size:11px;letter-spacing:.08em;padding-right:8px}
.row100k .elite-foot{font-size:10px;letter-spacing:.16em;color:var(--gray);text-transform:uppercase;margin-top:10px}
/* The same block INSIDE the standings (Boards.tsx): while they are hidden
 * the elite leave the tier ladder and lead the table under one heading —
 * ink, not a tier color, on the solid rule the elite eyebrow wears. Cream
 * and ink like the rest of the board (owner, 2026-09-08: the white-on-black
 * of 09-06 came out — keep the paper and the black pace tags, and keep them
 * apart from the rest). The rows are ordinary board rows; the block is
 * bracketed by two solid rules, one under the heading and one under its
 * last row, where every other section has a dashed hairline. The closing
 * rule is two rules, not one list: a browser without :has() drops a whole
 * list, and the :last-child half must survive on its own. The heading
 * keeps the 14px of top air every tier divider has (owner, 2026-09-25 pm:
 * missing margin between the rule and LIGHTS OUT). */
.row100k tr.divrow.elite{scroll-margin-top:64px}
.row100k tr.divrow.elite td{color:var(--ink);border-bottom:1px solid var(--ink);padding-top:14px}
.row100k tr.divrow.elite .by{color:var(--gray);letter-spacing:.14em;margin-left:10px}
.row100k tr.elite-row:last-child td{border-bottom:1px solid var(--ink)}
.row100k tr.elite-row:has(+ tr:not(.elite-row)) td{border-bottom:1px solid var(--ink)}
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
 * Only b4, the accent itself, takes the slab type (--on-water); ink wins
 * on every lighter step. */
.row100k .hm-num{font-family:var(--row-mono),monospace;font-size:clamp(11px,2.6vw,17px);font-weight:700;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .hm-cell.b4 .hm-num{color:var(--on-water)}
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
.row100k .hg-cell.b1{background:color-mix(in srgb,var(--water) 14%,var(--paper))}
.row100k .hg-cell.b2{background:color-mix(in srgb,var(--water) 38%,var(--paper))}
.row100k .hg-cell.b3{background:color-mix(in srgb,var(--water) 68%,var(--paper))}
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
/* THE HEAD SITS CLOSE UNDER THE BAR and the dateline and big number sit
 * further under the name (owner, 2026-09-25: less space between the name
 * and the header; more between the big number / the date selection and
 * the name): the first section keeps its 30px, the head adds none, the
 * dateline and the odometer each take a step more air. */
.row100k section.pf-sec{padding:30px 0 0}
.row100k .pf-head{padding:0}
.row100k .pf-name{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,6.6vw,64px);line-height:.95;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:.14em;overflow-wrap:anywhere}
/* THE NAME ON ONE LINE (owner, 2026-09-24: fit my name on one line). The
 * h1 carries its own width in ems as --pf-w (looks/nameFit.ts) and sits in
 * a query container, so the size is the column divided by the name — never
 * larger than the viewport size above, and on a phone never under 22px,
 * where a long name is allowed to wrap instead. A browser without cqw
 * drops this line and keeps the size above. */
.row100k .pf-fit{container-type:inline-size}
.row100k .pf-name{font-size:max(22px,min(clamp(26px,6.6vw,64px),calc(100cqw / var(--pf-w,12))))}
.row100k .pf-name .num{color:var(--gray)}
.row100k .pf-date{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);padding-top:18px}
/* The odometer on the profile: seven digits and two commas (5.44em) sized
 * off its own column (cqw), so it fits the 760 measure and the narrower
 * left column of the two-column layout alike. */
.row100k .pf-od{margin-top:30px;container-type:inline-size}
.row100k .pf-od .my-od{--od-size:min(calc(100cqw / 5.44),30vh,130px)}
.row100k .pf-big{margin-top:30px}
/* LOG A ROW (LogInPlace) a step under the front page size, so it fits
 * one line on the 760 column. It stands alone since 2026-09-25 (owner:
 * SHARE moved up onto the dateline — looks/profileCss.ts .pf-share). The
 * air above it sits on the .pf-act wrapper, not the act row inside it, so
 * the #log element the form scrolls to starts AT the word: opening the
 * form puts LOG A ROW just under the sticky bar (owner, same day), with no
 * margin of its own between the bar and the word. */
.row100k .pf-act{margin-top:clamp(18px,3vh,30px)}
.row100k .pf-act .act-row.front{margin-top:0}
.row100k .pf-act .optin{font-size:clamp(34px,7.2vw,72px)}
.row100k .pf-id{margin-top:22px}
.row100k .pf-id a{color:var(--water);text-decoration:none}
.row100k .pf-id a:hover{text-decoration:underline;text-underline-offset:3px}
/* The eyebrow: one bold mono line over a hairline, a gray descriptor on
 * the right. */
.row100k .pf-eye{display:flex;justify-content:space-between;align-items:baseline;gap:6px 16px;flex-wrap:wrap;border-bottom:1px solid var(--ink);padding-bottom:8px;margin-bottom:14px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .pf-eye .r{color:var(--gray);font-weight:400}
/* The bests as ONE small board (owner, 2026-09-25: one list, no PACE
 * RECORDS / DISTANCE RECORDS subheaders — the two-board grid and its mono
 * titles went with them), the front page top-three voice: the label bold
 * with its date under it, the value on the right with the place chip,
 * SHARE in a narrow last cell for the rower. */
.row100k .pf-best{min-width:0}
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
  /* From 720px the nameplate never wraps (owner, 2026-09-24): the fit
   * has no floor here, so the longest name still lands on one line. */
  .row100k .pf-two .pf-name{font-size:clamp(26px,4.6vw,52px);white-space:nowrap}
  .row100k .pf-two .pf-name{font-size:min(clamp(26px,4.6vw,52px),calc(100cqw / var(--pf-w,12)))}
  .row100k .pf-two .bhead-n{font-size:clamp(40px,7vw,76px)}
  .row100k .pf-two .pf-od .my-od{--od-size:min(calc(100cqw / 5.44),30vh,90px)}
  .row100k .pf-two .pf-act .optin{font-size:clamp(30px,4.4vw,46px)}
}

/* ----------------------------------------------------------------------
 * FIND A ROWER, off the nameplate (looks/RowerSearch.tsx — owner ask,
 * 2026-09-06: tap the name and search for someone). The NUMBER AND THE
 * NAME are the control, in the headline face they already had: no box, no
 * button chrome, no rule under them (owner, 2026-09-25: remove the dotted
 * line under the name, too cluttered, I will know it is clickable) — just
 * water on hover, the grey number turning with the name (owner, same day:
 * give the bib number the same hover and click behaviour as the name).
 * No caret (owner, 2026-09-24: remove the down arrow).
 *
 * The panel is the account menu (BarAccount.tsx) hung under the head:
 * paper, a 2px ink border, over a full-screen overlay so a click anywhere
 * else shuts it. Square and flat, no shadow.
 *
 * Both sit UNDER the sticky bar (z-index 50), which is why the panel has
 * its own overlay instead of borrowing .acct-overlay: 55 is right for a
 * menu that hangs off the bar and wrong for a panel that belongs to the
 * page — that one has to scroll behind the masthead the way the page does,
 * not paint over the wordmark on the way past (review, 2026-09-06).
 *
 * Inside, a mono field on a 2px ink underline — 16px, because anything
 * under 16 makes iOS Safari zoom the whole page the moment the field takes
 * focus, and this field focuses itself — then the matches as board rows:
 * grey mono number, name in bold sans, dashed hairlines. */
.row100k .pf-head{position:relative}
.row100k .pf-find-btn{cursor:pointer;overflow-wrap:anywhere}
.row100k .pf-find-btn:hover,.row100k .pf-find-btn:hover .num{color:var(--water)}
.row100k .pf-find-btn:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .pf-find-overlay{position:fixed;inset:0;z-index:30}
.row100k .pf-find{position:absolute;top:100%;left:0;width:100%;max-width:420px;margin-top:12px;padding:14px 16px 8px;background:var(--paper);border:2px solid var(--ink);max-height:min(460px,max(180px,calc(100vh - 260px)));overflow-y:auto;z-index:40}
.row100k .pf-find[hidden]{display:none}
.row100k .pf-find-in{width:100%;background:transparent;border:0;border-bottom:2px solid var(--ink);padding:4px 0 8px;font-family:var(--row-mono),monospace;font-size:16px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink)}
.row100k .pf-find-in::placeholder{color:var(--gray);font-size:13px;letter-spacing:.12em;text-transform:uppercase}
.row100k .pf-find-in:focus{outline:0;border-bottom-color:var(--water)}
.row100k .pf-find-list{list-style:none;margin-top:6px}
.row100k .pf-find-row{display:flex;align-items:baseline;gap:12px;padding:10px 2px;border-bottom:1px dashed var(--line);color:var(--ink);text-decoration:none}
.row100k .pf-find-list li:last-child .pf-find-row{border-bottom:0}
.row100k .pf-find-row .n{font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray);font-variant-numeric:tabular-nums}
.row100k .pf-find-row .nm{font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:15px;line-height:1.3;overflow-wrap:anywhere}
.row100k a.pf-find-row:hover .nm{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k a.pf-find-row:focus-visible{outline:2px solid var(--water);outline-offset:-2px}
.row100k .pf-find-row.self .nm{color:var(--ink-soft)}
.row100k .pf-find-row .tag{margin-left:auto;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);white-space:nowrap}
.row100k .pf-find-note,.row100k .pf-find-more{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);line-height:1.7;padding:12px 2px}
.row100k .pf-find-more{border-top:1px dashed var(--line);padding:10px 2px}
/* The count, for a screen reader only: the list swaps in silently as you
 * type, so the live region says how many came back. Off-screen rather than
 * printed — on the page the list IS the answer (review, 2026-09-06). */
.row100k .pf-find-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;white-space:nowrap;clip-path:inset(50%)}

/* ----------------------------------------------------------------------
 * The feed (feed/ — the strips, the owner pick of 2026-09-05): the
 * profile language on the ticker. The head (name, dateline, the meters
 * that landed today) is PageHead.tsx + headCss.ts since 2026-09-16; here,
 * the rows under small mono day heads with a dashed rule. No 2px boxes
 * anywhere: rows part on dashed hairlines. .fd- is the prefix. */
.row100k section.fd-sec{padding:30px 0 8px}
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
/* THE ELITE mark (owner, 2026-09-08): a hidden rower keeps no photos on
 * the feed — one ink block on the footprint of the two thumbs (196 by 96,
 * 148 by 72 on a phone, whatever the row had), THE ELITE in white mono
 * with the two squares of the brand after it, paper on ink the way the
 * elite table flips its blocks, linking to the elite list on the board.
 * Hover: the word underlines and the squares go water. */
.row100k .fd-elite{display:flex;flex-shrink:0;align-items:center;justify-content:center;gap:0 .45em;width:196px;height:96px;background:var(--ink);color:#fff;text-decoration:none;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap;line-height:1}
.row100k .fd-elite .sq{display:inline-flex;gap:.3em}
.row100k .fd-elite .sq i{display:block;width:.7em;height:.7em;background:var(--paper)}
.row100k .fd-elite:hover .w{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--water)}
.row100k .fd-elite:hover .sq i{background:var(--water)}
/* The same footprint bare: a row hidden by the fail-closed rule (the board
 * could not be read during a window) — ink, no word, no link. */
.row100k .fd-hid{display:block;flex-shrink:0;width:196px;height:96px;background:var(--ink)}
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
  .row100k .fd-elite{width:148px;height:72px;font-size:11px}
  .row100k .fd-hid{width:148px;height:72px}
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

/* ----------------------------------------------------------------------
 * .row-ink — THE WHOLE SITE, WHITE ON BLACK (owner, 2026-09-16: show me
 * what the whole rowtember page can look like in a white on black color
 * scheme). The segment layout (row100k/layout.tsx) wraps every page in a
 * div that carries this class when the site look is ink or the LOOK_COOKIE
 * says so. Paper adds nothing: nothing outside these selectors changes.
 *
 * IT IS THE SITE NOW, AND IT HAS ONE ACCENT (owner, 2026-10-01: now that
 * the page is white on black we need the other pages to follow, all of the
 * other pages are light mode; and: instead of red, let us pick like
 * October orange, a month theme color, like Halloween orange). From
 * 2026-09-16 to then this block was FULLY MONOCHROME — the water was
 * white, no hue at all — because the owner was still on paper and wanted
 * the mono chrome worked on. The look is the default now
 * (rowSettings.ts) and the accent is the palette one (rowPalette.ts,
 * written into --water by RowSite for the ground: the pumpkin on ink).
 *
 * THE GROUND AND THE TYPE are the landing ones (rowPalette.ts INK and
 * PAPER): #15171a under #F4F3EE. The first cut sat on #0b0c0e with pure
 * white, the race day steps; the landing went ink on 2026-09-30 on the
 * theme ink, and the pages behind it have to be the same black.
 *
 * WHERE THE ACCENT GOES, AND WHERE IT DOES NOT. It is for the accent role
 * only:
 *   - the rule under a word that is a control (OPT IN, LOG A ROW, SHARE,
 *     the submenu word that is on, a link that goes somewhere), and that
 *     word under the pointer;
 *   - the word of the page you are on, in the bar;
 *   - the OPT IN chip and the submit slab, which carry the slab type
 *     (--on-water: ink on the pumpkin, white on a red);
 *   - you: your own row on a board, your tile, your mark on a chart;
 *   - a fill that measures something: the progress bar, the heats of the
 *     month, the hours and the year, the curve, the 100K tier.
 * It is NOT for a figure or for body type. On paper the odometer, the
 * board head, a record, the meters of a row and the price all printed in
 * the water; here every one of them is white, and so are the small mono
 * words that were water for emphasis. Each of those is named below.
 *
 * THE LADDER, the type colour over the ground:
 *   #F4F3EE                 1     headlines, figures, values, filled
 *                                 slabs, the .25M tier, the gold medal
 *                                 ring, the error line
 *   rgba(244,243,238,.74)   bone  body copy (ink-soft), the silver ring,
 *                                 the 50K tier (#babab7 opaque)
 *   rgba(244,243,238,.62)   key   mono eyebrows, keys, table heads (gray)
 *   rgba(244,243,238,.5)    quiet the 10K tier (#858584 opaque), the
 *                                 bronze ring, the down arrow, a
 *                                 placeholder
 *   rgba(244,243,238,.24)   dash  the hairline (line): dashed rules,
 *                                 input underlines, pill outlines
 *   rgba(244,243,238,.18)   faint the progress track (#3d3f40 opaque)
 *   rgba(244,243,238,.06)   wash  an empty hour cell
 *   #23262b                 lift  a slab one step off the ground: the
 *                                 photo frame, the dark card stage
 *   --water-pale            tint  the accent at its darkest (the palette
 *                                 pale cut for ink): your row, the row
 *                                 that is open, a pressed card
 * Nothing under .5 ever carries a letter.
 *
 * HOW. The palette is flipped at the root — paper is the black, ink is
 * the white, the greys and the hairline re-cut for a black ground — and
 * everything above that is drawn in the variables comes along for free.
 * What is left is every rule that named a colour outright (a white on a
 * fill, an ink drop shadow, the cream board tint, the medal chips, the
 * rust of an error), every figure that printed in the water, and the tier
 * colours, which were a green and a gold.
 *
 * FLAT. No drop shadows on black: the menus, the dialog and the pressed
 * card were lifted by an offset ink shadow on cream, and a white-cast
 * copy of it here read as a second border. They are a 2px edge and
 * nothing else.
 *
 * NOT FOR A PAGE THAT IS INK ALREADY. Race day and the results board wear
 * .chrome-ink and paint their own black in rules that mean black when they
 * say var(--ink); flipping the palette under them would have inverted them
 * back to white. Every selector here excludes .chrome-ink, so those pages
 * render under ink exactly as they render on their own — and the :not() is
 * also what lifts these rules over the page-local sheets, which are a
 * second style tag, later in source, at the same specificity. The cast
 * wall wears .rr-wall on its root and is excluded the same way. Their bar
 * is the block above the OPT IN rules (dark()).
 *
 * WHAT IS NOT REACHED FROM HERE: the analysis charts (analysis/charts.tsx)
 * draw their washes as the water at low alpha through color-mix, so they
 * take the accent on their own — their gridline, pip stroke and dot halo
 * keep paper literals and read the --an-* variables set at the root
 * below; the share cards (share/cards.ts) and the poster engine paint
 * canvases in colours of their own; the partner slabs on /partners wear
 * the partner brand green and gold, which is theirs. */
/* The ground runs past the page: what shows under an overscroll, and while
 * the page is still arriving, is the black and not the cream of the site
 * sheet. Only where a .row100k page is under the look — the print flyer
 * (raceday/print, root .pr) is ink on white for a sheet of paper and keeps
 * its own grey desk. */
html:has(.row-ink .row100k),html:has(.row-ink .row100k) body{background:#15171a}
.row-ink:has(.row100k){background:#15171a;min-height:100vh}
${INK}{--paper:#15171a;--ink:#F4F3EE;--ink-soft:rgba(244,243,238,.74);--gray:rgba(244,243,238,.62);--line:rgba(244,243,238,.24);--frame:#23262b;--tier-common-ink:#858584;--tier-rare-ink:#babab7;--tier-epic-ink:var(--water);--tier-legend-ink:var(--ink);--an-grid:rgba(244,243,238,.24);--an-paper:#15171a;--an-halo:#15171a;--bar-bg:var(--paper);--bar-fg:var(--ink);--bar-dim:var(--gray);--bar-hair:var(--line);--fg:var(--ink);--fg-muted:var(--gray);--fg-faint:rgba(244,243,238,.5);background:var(--paper);color-scheme:dark}
/* THE SITE SHEET UNDER THIS ONE (globals.css) paints every p in its own
 * --fg and every .mono in its --fg-muted, both resolved at the document
 * root to the warm ink of the photo site. On cream nobody could tell; on
 * black a paragraph or a mono line that names no colour of its own — the
 * how-to-enter line of the raffle, a note under a table — was dark type
 * on a dark page. The three --fg variables are re-pointed at the flipped
 * ink in the root rule above, so those lines come up white and key grey
 * with no rule naming them. */

/* FIGURES ARE WHITE. Each of these printed in the water on paper: the
 * odometer, the board head, a record, the meters of a row on the ledger,
 * the profile log and the feed, the first cell of the clock, the price,
 * and the number on a tile that is you (its label keeps the accent — that
 * is the you mark). The odometer is a link: it takes the accent under the
 * pointer, where on paper it went from water to ink. */
${INK} .my-od,${INK} .bhead-n,${INK} .rec .v,${INK} .plog-m,${INK} .mlg-m,${INK} .fd-strip .fd-m,${INK} .count .c:first-child .n,${INK} .sh-price,${INK} .st-tile.you .n{color:var(--ink)}
${INK} .st-tile.you .n .u{color:var(--gray);opacity:1}
${INK} .my-od-link:hover .my-od{color:var(--water)}
/* AND SO ARE THE SMALL WORDS that were water for emphasis and are not a
 * control: the head of a front box, the step number, the ask on the log
 * form, the figure in a pace note and in a feed day head, the due line,
 * the share status, the opens-here line of a record card, the OK box. The
 * descriptor beside a section head drops to the key grey, since the head
 * it sits next to is white already. */
${INK} .front-box .head,${INK} .step .d,${INK} .rec .duo .dv,${INK} .logf-ask .k,${INK} .pace-note b,${INK} .fd-dayh .r b,${INK} .sh-due,${INK} .share-status,${INK} .rec-open,${INK} .form-ok,${INK} .count-done{color:var(--ink)}
${INK} .sec-head .mono,${INK} .panel .p-head .mono{color:var(--gray)}
/* A WORD THAT GOES SOMEWHERE is white on a rule of the accent, and the
 * accent under the pointer: the board link under the front page news, the
 * full rankings link on the stats page, the handle on a profile, the
 * actions on the rowing machine table. On paper the first two were water
 * words that went ink on hover, and the last two had no rule at all. */
${INK} .front-more a,${INK} .st-all-line .st-all{color:var(--ink)}
${INK} .front-more a:hover,${INK} .st-all-line .st-all:hover{color:var(--water);border-color:var(--water)}
${INK} .pf-id a,${INK} .pf-erg-act a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--water);text-underline-offset:3px}
${INK} .pf-id a:hover,${INK} .pf-erg-act a:hover{color:var(--water)}

/* FORMS AND BUTTONS. The ink-filled ones (.goog, .tabs .on, .day-select)
 * flip through the variables and the accent-filled ones (.send, the
 * primary buttons) carry --on-water from the base rules; these named a
 * white or a rust. An error is the race day one: white, bold, a white bar
 * down its side. */
${INK} .send:disabled{background:var(--water-pale);color:var(--gray)}
${INK} .logf .send,${INK} .logf .send:hover,${INK} .logf .send:disabled{background:none}
${INK} .form-err{color:var(--ink);font-weight:700;border-left:3px solid var(--ink);padding-left:11px}
${INK} .panel ::placeholder{color:rgba(244,243,238,.5)}
${INK} .del-btn:hover{color:var(--ink)}
${INK} .mv.dn{color:rgba(244,243,238,.5)}

/* THE SHARE DIALOG: a dimmer that is darker than the page, no shadow, the
 * mark a white slab with ink type (the wordmark is not the accent), and
 * the dark card stage on the lift grey. */
${INK} .share-overlay{background:rgba(0,0,0,.72)}
${INK} .share-modal{box-shadow:none}
${INK} .share-mark{background:var(--ink);color:var(--paper)}
${INK} .share-status.bad{font-weight:700}

/* THE MENUS, THE LEDGER AND THE ROWERS TABLE: flat, danger as an
 * underline, the hover wash. */
${INK} .mlg-menu,${INK} .rw-menu,${INK} .tm-list{box-shadow:none}
${INK} .mlg-menu button.danger:not(:disabled),${INK} .rw-menu .danger:not(:disabled){color:var(--ink);text-decoration:underline;text-underline-offset:3px}
${INK} .rw-act.danger:hover{color:var(--ink)}
${INK} .rw-r:hover td{background:rgba(244,243,238,.05)}
${INK} button.rec[aria-pressed=true],${INK} a.rec:hover,${INK} .rec.linked:hover{box-shadow:none}

/* THE BOARD. Bare on the black, as it is on race day: the cream tint was
 * a hue, and the tinted row that is you needs the ground under it to
 * read. The medals go hollow — a white ring for gold, bone for silver,
 * quiet for bronze, the type in the ring colour — so no filled chip
 * fights the tier slabs beside it. The progress bar is the accent on a
 * faint track. */
${INK} table.board{background:transparent}
${INK} .dtag.m1{background:transparent;border-color:var(--ink);color:var(--ink)}
${INK} .dtag.m2{background:transparent;border-color:rgba(244,243,238,.74);color:rgba(244,243,238,.74)}
${INK} .dtag.m3{background:transparent;border-color:rgba(244,243,238,.5);color:rgba(244,243,238,.5)}
${INK} .rowbar{background:#3d3f40}
/* Tier badges, a ladder with ink type on every slab: 10K quiet grey, 50K
 * bone, then the 100K — the goal the site is named for — in the accent
 * with its slab type. The .25M is the one inversion: a black slab in a
 * white ring with white letterspaced type, no champagne. ELITE and the
 * pace tag are white slabs (the paper rule, flipped). The divider rows of
 * the board take the same four through the --tier variables at the root. */
${INK} .tierbadge{color:var(--paper)}
${INK} .tierbadge.epic,${INK} .tierbadge.you,${INK} .donebadge{color:var(--on-water)}
${INK} .tierbadge.legend{background:var(--paper);color:var(--ink);border-color:var(--ink)}
/* The blackout page state chip. */
${INK} .bo-state.on{color:var(--paper)}

/* THE HEATMAP, THE HOUR GRID, THE YEAR: the same steps of the accent over
 * the ground as on paper, re-cut for black — 20, 40 and 60 parts in a
 * hundred, then the accent. The third heat stops at 60 so the white day
 * figure still clears 4.5:1 on it; the fourth takes the slab type from
 * the base rule. An empty hour is a faint wash. */
${INK} .hm-cell.b1,${INK} .hg-cell.b1{background:color-mix(in srgb,var(--water) 20%,var(--paper))}
${INK} .hm-cell.b2,${INK} .hg-cell.b2{background:color-mix(in srgb,var(--water) 40%,var(--paper))}
${INK} .hm-cell.b3,${INK} .hg-cell.b3{background:color-mix(in srgb,var(--water) 60%,var(--paper))}
${INK} .hg-cell{background:rgba(244,243,238,.06)}
${INK} .hg-cell.b4{background:var(--water)}

/* LIGHTS OUT. The censor blocks are white squares on this ground (owner,
 * 2026-10-01: on this color scheme we censor with white squares instead of
 * black squares). The digit blocks (.bo i) and the bare feed footprint
 * (.fd-hid) are drawn in var(--ink) and so flip on their own; they are
 * named here so the rule is on the page and not an accident of the
 * variables. THE DOG TAG is white on black by design; on a black page it
 * needs an edge, so the slab lifts a step and takes a ring at its rim,
 * outside the stamped rule .dt-in already draws. */
${INK} .bo i,${INK} .fd-hid{background:var(--ink)}
${INK} .dt{background:#1d2023;box-shadow:inset 0 0 0 1px rgba(244,243,238,.28)}
/* THE LIGHTS OUT mark on the feed: a white block now, ink type; under the
 * pointer the word underlines in ink and the two squares take the accent. */
${INK} .fd-elite{color:var(--paper)}
${INK} .fd-elite:hover .w{text-decoration-color:var(--paper)}

/* THE SHIRT (dev/shirts): the size boxes and the buy slab are white now,
 * so their type goes black; the photo stepper keeps a black ground under
 * the pointer. The picked size is the accent box among the white ones and
 * BUY takes the accent under the pointer (the base rules, with the slab
 * type); KEEP stays hollow. */
${INK} .sh-nav:hover{background:#000}
${INK} .sh-size,${INK} .sh-sz,${INK} .sh-cnt .hot{color:var(--paper)}
${INK} .sh-cnt{color:rgba(21,23,26,.72)}
${INK} .sh-size.on .sh-sz,${INK} .sh-size.on .sh-cnt .hot,${INK} .sh-size.on .sh-cnt{color:var(--on-water)}
${INK} .sh-buy{color:var(--paper)}
${INK} .sh-buy:hover:not(:disabled){color:var(--on-water)}
${INK} .sh-buy.keep{color:var(--ink)}
${INK} .sh-buy.keep:hover:not(:disabled){color:var(--water)}

/* PAGE-LOCAL SHEETS that named a white, an ink shadow, a cream or a rust:
 * the raffle ticket and the win box (partners/Raffle.tsx), the raffle
 * admin win box (raffles/page.tsx), the partner slabs, the post pack and
 * poster studio buttons and the studio render log, the race console
 * warning (race-admin/page.tsx). */
${INK} .rf-ticket,${INK} .rf-win,${INK} .rf-adm-win,${INK} .ptn-logos,${INK} .ptn-brand{box-shadow:none}
${INK} .rf-call.go,${INK} .rf-cta:hover{color:var(--on-water)}
${INK} .rf-call.go .mono{color:var(--on-water);opacity:.8}
/* The IN slab and the win box are white slabs now, so the sub-lines that
 * named a literal cream go ink at the same wash (review, 2026-09-16). */
${INK} .rf-call.in .mono,${INK} .rf-win .t,${INK} .rf-win .meta{color:rgba(21,23,26,.7)}
${INK} .rf-win .who a:hover{color:var(--paper)}
${INK} .rf-adm-win .k,${INK} .rf-adm-win .l{color:rgba(21,23,26,.7)}
${INK} .pk-btn.primary,${INK} .pk-btn.primary:hover,${INK} .po-btn.primary,${INK} .po-btn.primary:hover{color:var(--on-water)}
/* The one rust left on a public page: a failed step in the poster render
 * log. White, and the weight it already has (review, 2026-09-16). */
${INK} .po-log .neg{color:var(--ink)}
${INK} .ra-warn{color:var(--ink);font-weight:700}
/* Figures in the page-local sheets that printed in the water: the reserved
 * count on the shirts page, a share count and the action word on the
 * shareables table. White, like every other figure here. */
${INK} .sp-count b,${INK} table.board td.sh-n.on,${INK} table.board td.sh-act,${INK} .sh-missing{color:var(--ink)}
/* PERFECT ATTENDANCE (2026-09-21): a plain roll of names, three across on a
 * desk and one on a phone. No numbers, so nothing here is ever masked. */
.row100k .pa-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 22px}
.row100k .pa-list li{display:flex;justify-content:space-between;align-items:baseline;gap:10px;border-bottom:1px dashed var(--line);padding:7px 0}
.row100k .pa-list a{color:var(--ink);text-decoration:none;font-weight:700}
.row100k .pa-list a:hover{color:var(--water)}
.row100k .pa-list .mono{font-size:10px;letter-spacing:.14em;color:var(--ink-soft)}
.row100k .pa-none{font-size:11px;letter-spacing:.14em;color:var(--ink-soft)}
`;
