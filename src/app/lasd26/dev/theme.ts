import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";

/* Shared look for the team site — the dev copy at /lasd26/dev and its
 * sub-pages (the-list, expenses, team, pay, join): fonts, the noise tile,
 * and the full scoped stylesheet under the .lasd26 wrapper. Page-only rules
 * live with their page and reach the sheet through LasdPage's extraCss.
 * The live /lasd26 page keeps its own theme.ts one folder up. */

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

/* THE GREEN RULE (owner, 2026-10-15: "rebrand this orange to a green").
 * --safety is the Just Friends LV lime and stays wherever the orange was a
 * FILL or sat on dark ground: the crew-call mark, the send button, the race
 * day row, checked pills and the sent box inside the dark form block, the
 * hero's big dot (huge, so it reads). Lime TYPE on cream fails contrast, so
 * every place lime would be text or a thin border on the paper — hovers,
 * eyebrows, the countdown's seconds, errors, focus rings — takes
 * --safety-ink, the deep cut of the same green. */

export const css = `
.lasd26,.lasd26 *{margin:0;padding:0;box-sizing:border-box}
.lasd26{
  --paper:#F4F3EE; --ink:#111110; --ink-soft:#3d3d3a; --gray:#8a8a85; --line:#c9c8c0; --safety:#D0F858; --safety-ink:#3C7A0B; --safety-hover:#DFFF78; --frame:#000;
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
.lasd26 :focus-visible{outline:2px solid var(--safety-ink);outline-offset:3px}
/* On the dark blocks the lime ring is the one that shows. */
.lasd26 .form-sec :focus-visible,.lasd26 .day.race :focus-visible{outline-color:var(--safety)}

/* ─── THE BAR (owner, 2026-10-15: crew call, live, expenses, a profile
 * button "just like we have on the other sites"). Two rows on a phone: the
 * wordmark and the account button, then the three doors. One row from
 * 960px, doors in the middle. Sticky on the paper. ─── */
.lasd26 .bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:2px solid var(--ink);position:sticky;top:0;background:var(--paper) url(${NOISE}) repeat;z-index:50}
.lasd26 .bar .wm{order:1;display:inline-flex;align-items:center;gap:10px;min-height:56px;text-decoration:none;white-space:nowrap}
.lasd26 .bar .wm:hover .wm-t{color:var(--safety-ink)}
.lasd26 .bar .tag{background:var(--ink);color:var(--paper);padding:3px 8px;font-size:12px;font-weight:700;letter-spacing:.08em}
.lasd26 .bar .wm-t{font-size:11px;letter-spacing:.1em}
/* The DEV pill beside the wordmark (the tracker's bar has one too): this
 * is the dev copy under /lasd26/dev, admin-only in production. Deep green
 * outline on the paper — lime type fails contrast there. Goes with the
 * gate when the site goes live (lib/lasd26/paths.ts). */
.lasd26 .bar .dev-pill{border:1.5px solid var(--safety-ink);color:var(--safety-ink);border-radius:999px;padding:2px 7px;font-size:9px;font-weight:700;letter-spacing:.14em;line-height:1.2}
.lasd26 .bar-acct{order:2;position:relative;display:flex;align-items:center;min-height:56px}
/* THE DOORS (owner, 2026-10-16: "Change the color of the link on the main
 * header to that green", "Remove closed from the header", "Make the live
 * page closer to the crew call and expenses page"). Three words, nothing
 * after them — CREW CALL · LIVE · EXPENSES — 18 px apart, one tight group.
 * The link text is --safety-ink, the deep cut of the lime: plain lime
 * (#D0F858) on the cream paper is unreadable (about 1.4:1), so the lime
 * itself is kept for the 3 px underline under the current page and under a
 * hover. Without the small words the row is ~220 px, so it holds all three
 * at 360 px (and at 320) without scrolling; overflow stays auto as a
 * belt-and-braces for a zoomed font. */
.lasd26 .bar-nav{order:3;flex:0 0 100%;display:flex;gap:18px;border-top:1px dashed var(--line);margin:0 -20px;padding:0 20px;overflow-x:auto;scrollbar-width:none}
.lasd26 .bar-nav::-webkit-scrollbar{display:none}
.lasd26 .bar-nav a,.lasd26 .bar-nav .off{display:inline-flex;align-items:center;min-height:44px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;color:var(--safety-ink);text-decoration-line:none;text-underline-offset:7px;text-decoration-thickness:3px;text-decoration-color:var(--safety)}
/* -line, not the shorthand: text-decoration:underline would reset the
 * lime colour and the 3 px thickness set above. */
.lasd26 .bar-nav a:hover,.lasd26 .bar-nav a[aria-current=page]{text-decoration-line:underline}
/* LIVE for a non-owner: greyed and unclickable until the tracker goes
 * public; the hover-only title says "Race day" in place of the small word. */
.lasd26 .bar-nav .off{color:var(--gray);cursor:default}
/* The first row must stay ONE row on a 360–375 px phone (the review,
 * 2026-10-15, finding #7: the wordmark text plus a long first name wrapped
 * the account button onto a third row). Under 400 px the tag stands alone
 * — the link's aria-label still says the whole name — and the first name
 * is clipped at 72 px. */
/* Up to 440px (a 401px pane still wrapped the account button under the
 * wordmark): the wordmark text goes, the tag and the DEV pill stay. */
@media(max-width:440px){ .lasd26 .bar .wm-t{display:none} .lasd26 .acct-name{max-width:72px} }

/* The account button (owner, 2026-10-16: "I don't like the round buttons
 * for the profile"): SQUARE, like the LASD26 tag beside it. Signed out it is
 * SIGN IN, a solid ink block with paper type; signed in, a 2 px ink border
 * around the member's initial in a square lime block and a first name in
 * mono caps. No radius anywhere, the panel included. 44 px tall — a thumb
 * target in the van, same as the doors. */
.lasd26 .acct{position:relative}
.lasd26 .acct-btn{display:inline-flex;align-items:center;gap:10px;min-height:44px;border:2px solid var(--ink);border-radius:0;background:transparent;color:var(--ink);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px 5px 5px;cursor:pointer;white-space:nowrap}
.lasd26 .acct-btn.in{background:var(--ink);color:var(--paper);padding:6px 16px}
.lasd26 .acct-btn:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .acct-btn.in:hover{background:var(--safety-ink);border-color:var(--safety-ink);color:var(--paper)}
.lasd26 .acct-ini{width:26px;height:26px;border-radius:0;background:var(--safety);color:#111;display:inline-flex;align-items:center;justify-content:center;font-size:12px;line-height:1;flex:none}
.lasd26 .acct-name{max-width:110px;overflow:hidden;text-overflow:ellipsis}
.lasd26 .acct-menu{position:absolute;top:calc(100% + 8px);right:0;background:var(--paper) url(${NOISE}) repeat;border:2px solid var(--ink);box-shadow:6px 6px 0 rgba(17,17,16,.14);padding:4px 16px;min-width:250px;z-index:60;max-height:calc(100vh - 120px);max-height:calc(100dvh - 120px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.lasd26 .acct-who{display:flex;flex-direction:column;gap:2px;padding:12px 2px 10px;border-bottom:1px dashed var(--line)}
.lasd26 .acct-who strong{font-size:14px;line-height:1.3}
.lasd26 .acct-who .mono{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--safety-ink)}
.lasd26 .acct-eyebrow{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--gray);padding:12px 2px 2px}
.lasd26 .acct-item{display:flex;align-items:center;width:100%;min-height:44px;text-align:left;background:none;border:none;border-bottom:1px dashed var(--line);font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:11px 2px;cursor:pointer;color:var(--ink);text-decoration:none}
.lasd26 .acct-item:last-child{border-bottom:none}
.lasd26 .acct-item:hover{color:var(--safety-ink)}
.lasd26 .acct-item.danger:hover{color:#b3400f}

.lasd26 .hero{padding:28px 20px 8px}
.lasd26 .hero h1{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(46px,13vw,110px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase}
/* The big dot after COAST (owner, 2026-10-16: "Make the . on the front page
 * a circle instead of a square") — Archivo Black's period is a square, so
 * the glyph is drawn instead: an empty inline-block lime disc sized to the
 * type. An empty inline-block's baseline is its bottom edge, so with
 * vertical-align:baseline the disc sits on the line like the period would.
 * aria-hidden in the markup; a visually hidden "." keeps the sentence
 * whole for a screen reader. */
.lasd26 .hero h1 .o{display:inline-block;width:.18em;height:.18em;margin-left:.03em;border-radius:50%;background:var(--safety);vertical-align:baseline}
.lasd26 .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.lasd26 .hero .sub{margin-top:16px;max-width:52ch;color:var(--ink-soft);font-size:15px}
/* "No Shortcuts × Just Friends LV" — text only (owner, 2026-10-16: "Remove
 * the JF logo here"). */
.lasd26 .with{margin-top:18px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft)}

.lasd26 .cc-mark{display:inline-block;margin-top:22px;max-width:100%;font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(18px,5.6vw,32px);line-height:1.15;text-transform:uppercase;letter-spacing:.01em;color:#111;background:var(--safety);padding:7px 16px 6px;transform:rotate(-1.2deg) skewX(-2deg)}

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
.lasd26 .facts a{text-decoration:underline;text-underline-offset:3px}
.lasd26 .facts a:hover{color:var(--safety-ink)}

.lasd26 section{padding:52px 0 8px}
.lasd26 .sec-head{display:flex;align-items:baseline;gap:12px;border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:22px;flex-wrap:wrap}
.lasd26 .sec-head h2{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(26px,6vw,40px);text-transform:uppercase;letter-spacing:-.01em}
.lasd26 .sec-head .mono{font-size:12px;color:var(--safety-ink)}

.lasd26 .day{display:grid;grid-template-columns:86px 1fr;gap:14px;padding:16px 0;border-bottom:1px dashed var(--line)}
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
.lasd26 .count .c:last-child .n{color:var(--safety-ink)}
.lasd26 .count .l{font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.14em;color:var(--gray);text-transform:uppercase;margin-top:7px}
.lasd26 .count-done{border:2px solid var(--safety-ink);color:var(--safety-ink);text-align:center;padding:26px 18px;font-size:14px;font-weight:700;letter-spacing:.04em}

/* The dark block: once the crew-call form, now the CLOSED notice on the
 * landing and the form ground for the team pages (join, expenses). Lime is
 * at home here — it is on ink. */
.lasd26 .form-sec{background:#111;color:#F4F3EE;margin-top:56px;padding:56px 0 72px}
.lasd26 .form-sec .sec-head{border-color:#F4F3EE}
.lasd26 .form-sec .sec-head h2{color:#F4F3EE}
.lasd26 .form-sec .sec-head .mono{color:var(--safety)}
.lasd26 .form-sec label.fl{display:block;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9a9a94;margin:22px 0 7px}
.lasd26 .form-sec input[type=text],.lasd26 .form-sec input[type=email]{width:100%;background:transparent;border:none;border-bottom:2px solid #444;color:#F4F3EE;font-family:var(--lasd-archivo),sans-serif;font-size:17px;padding:8px 2px;border-radius:0;appearance:none}
.lasd26 .form-sec input[type=text]:focus,.lasd26 .form-sec input[type=email]:focus{outline:none;border-bottom-color:var(--safety)}
.lasd26 .pills{display:flex;flex-wrap:wrap;gap:8px}
.lasd26 .pill input{position:absolute;opacity:0}
.lasd26 .pill span{display:inline-block;border:2px solid #555;padding:9px 16px;font-family:var(--lasd-mono),monospace;font-size:13px;cursor:pointer;user-select:none}
.lasd26 .pill input:checked + span{border-color:var(--safety);color:var(--safety)}
.lasd26 .pill input:focus-visible + span{outline:2px solid var(--safety);outline-offset:2px}
.lasd26 .send{display:block;width:100%;margin-top:34px;background:var(--safety);color:#111;border:none;font-family:var(--lasd-archivo-black),sans-serif;font-size:22px;text-transform:uppercase;letter-spacing:.04em;padding:20px;cursor:pointer;text-align:center;text-decoration:none}
.lasd26 .send:hover{background:var(--safety-hover)}
.lasd26 .send:disabled{background:#3d3d3a;color:#9a9a94;cursor:default}
.lasd26 .sent{border:2px solid var(--safety);color:var(--safety);text-align:center;font-family:var(--lasd-mono),monospace;padding:26px 18px;margin-top:34px;font-size:13px;line-height:1.8}
.lasd26 .sent a{color:var(--safety)}
/* The one line at the foot of the landing (owner, 2026-10-16: "Reduce the
 * bottom copy to just 'On the team -> Sign in'"): ON THE TEAM → SIGN IN,
 * where SIGN IN is a button dressed as the link, or → EXPENSES once signed
 * in. Lime on the ink block, so it reads; the padding makes the word a
 * thumb target without turning it into a button. */
.lasd26 .team-line{font-size:14px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#F4F3EE;display:flex;flex-wrap:wrap;align-items:center;gap:0 .6em}
.lasd26 .team-line a,.lasd26 .team-line button{display:inline-block;background:none;border:none;font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--safety);text-decoration:underline;text-underline-offset:5px;text-decoration-thickness:2px;padding:12px 0;cursor:pointer}
.lasd26 .team-line a:hover,.lasd26 .team-line button:hover{color:var(--safety-hover)}

.lasd26 table.pile{width:100%;border-collapse:collapse;font-family:var(--lasd-mono),monospace;font-size:13px}
.lasd26 table.pile th{text-align:left;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);font-weight:400;padding:8px 6px;border-bottom:2px solid var(--ink)}
.lasd26 table.pile td{padding:9px 6px;border-bottom:1px dashed var(--line);word-break:break-word;vertical-align:top}
.lasd26 table.pile a{text-decoration:underline;text-underline-offset:3px}
.lasd26 table.pile a:hover{color:var(--safety-ink)}
.lasd26 .list-empty{font-family:var(--lasd-mono),monospace;font-size:13px;color:var(--gray);padding:18px 0}
.lasd26 .clear-btn{margin-top:22px;background:transparent;border:2px solid var(--ink);color:var(--ink);font-size:13px;font-weight:700;letter-spacing:.06em;padding:11px 20px;cursor:pointer}
.lasd26 .clear-btn:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .clear-btn:disabled{opacity:.5;cursor:default}
.lasd26 .clear-err{margin-top:12px;font-size:12px;color:var(--safety-ink)}

.lasd26 footer{padding:44px 20px 64px;border-top:2px solid var(--ink)}
.lasd26 footer .big{font-family:var(--lasd-archivo-black),sans-serif;font-size:13px;letter-spacing:.1em;margin-bottom:10px}
.lasd26 footer .mono{font-size:11px;color:var(--gray);line-height:1.9}
.lasd26 footer a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.lasd26 footer a:hover{color:var(--safety-ink)}

/* The one-row bar: the wordmark, the three doors centred as one group
 * between them, the account button. The 960 px break dates from when the
 * doors carried small words and needed ~900 px (at 800 px the single row
 * clipped "CREW CALL" to "CALL"); the words are gone but the break is kept
 * as is, so a tablet shows the same two rows it did. */
@media(min-width:960px){
  .lasd26 .bar{flex-wrap:nowrap;gap:28px;min-height:60px}
  .lasd26 .bar .wm,.lasd26 .bar-acct{min-height:60px}
  .lasd26 .bar-nav{order:2;flex:1 1 auto;justify-content:center;border-top:none;margin:0;padding:0;gap:18px}
  .lasd26 .bar-acct{order:3}
}
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
