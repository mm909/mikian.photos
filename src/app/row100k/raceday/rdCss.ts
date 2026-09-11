/* Race day styles — .rd- prefix, theme.ts untouched.
 *
 * RACE DAY IS WHITE ON BLACK (owner, 2026-09-11: "the colour scheme here is
 * going to be white on black — we can still use this blue wherever it makes
 * sense"). The rest of the site is newspaper on cream; race day is the one
 * surface that inverts, the way the dog tag does (theme.ts .dt), because it
 * is an event rather than a page of the challenge. Everything between the
 * bar and the footer sits inside .rd-dark, which paints the ink ground full
 * bleed and re-colours the theme classes it contains — the section heads,
 * the board table, the buttons — for that ground. The bar and the footer
 * stay the site's, so the black reads as a panel the page is printed on.
 *
 * THE BLUE on ink is --water-hover (#1a90d4), not --water: the lead blue is
 * mixed for cream and falls to about 3:1 on ink, which is under the line for
 * the small mono it would carry. The brighter one clears 5:1.
 *
 * Rendered as the text child of a style tag, so the string carries NO
 * double quotes, no apostrophes, no angle brackets and no ampersands —
 * React escapes those server-side only and hydration then fails on the
 * mismatch (the note in theme.ts). Its own module so the page and the
 * scratchpad render harness style the same markup from one copy. */
export const rdCss = `
.row100k .rd-dark{background:var(--ink);color:#fff;padding:6px 0 46px}
.row100k .rd-dark section{padding:40px 0 8px}
.row100k .rd-dark section:first-child{padding-top:30px}

/* The theme classes, re-cut for the ink ground. */
.row100k .rd-dark .sec-head{border-bottom-color:#fff}
.row100k .rd-dark .sec-head h2{color:#fff}
.row100k .rd-dark .sec-head .mono{color:var(--water-hover)}
.row100k .rd-dark .board-empty{color:rgba(255,255,255,.6)}
.row100k .rd-dark .form-err{color:#ff9270}
.row100k .rd-dark .send{background:var(--water-hover);color:#fff}
.row100k .rd-dark .send:hover{background:#38a6e4}
.row100k .rd-dark .send:disabled{background:rgba(255,255,255,.22);color:rgba(255,255,255,.5)}
.row100k .rd-dark .outline-btn{border-color:#fff;color:#fff}
.row100k .rd-dark .outline-btn:hover{border-color:var(--water-hover);color:var(--water-hover)}
.row100k .rd-dark .quiet-btn{color:rgba(255,255,255,.62)}
.row100k .rd-dark .quiet-btn:hover{color:var(--water-hover)}
.row100k .rd-dark table.board{background:transparent;color:#fff}
.row100k .rd-dark table.board th{color:rgba(255,255,255,.6);border-bottom-color:rgba(255,255,255,.55)}
.row100k .rd-dark table.board td{border-bottom-color:rgba(255,255,255,.2)}
.row100k .rd-dark table.board .rk{color:rgba(255,255,255,.5)}
.row100k .rd-dark table.board .who a{color:#fff}
.row100k .rd-dark table.board .who a:hover{color:var(--water-hover)}

.row100k .rd-dev{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.5);border-bottom:1px dashed rgba(255,255,255,.24);padding-bottom:12px;margin-bottom:22px}

.row100k .rd-stub{border:2px solid #fff;padding:clamp(24px,5vw,38px) clamp(18px,4vw,32px) clamp(26px,5vw,34px)}
.row100k .rd-eye{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.6);margin:0}
.row100k .rd-when{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(36px,11vw,66px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:var(--water-hover);margin:12px 0 0}
.row100k .rd-facts{list-style:none;margin:22px 0 0;padding:18px 0 0;border-top:2px solid #fff;display:grid;gap:11px 26px;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.row100k .rd-facts li{display:flex;align-items:baseline;gap:10px;min-width:0}
.row100k .rd-facts .k{flex:none;width:62px;color:rgba(255,255,255,.6)}
.row100k .rd-facts .v{font-weight:700;color:#fff;min-width:0;letter-spacing:.06em;overflow-wrap:anywhere}
.row100k .rd-facts .v a{color:var(--water-hover);text-decoration:underline;text-underline-offset:3px}
.row100k .rd-facts .v a:hover{color:#fff}
@media(min-width:640px){.row100k .rd-facts{grid-template-columns:1fr 1fr}}

.row100k .rd-act{border:2px solid #fff;padding:clamp(22px,5vw,30px) clamp(18px,4vw,26px) clamp(24px,5vw,30px);margin-top:24px}
.row100k .rd-act.in{border-color:var(--water-hover)}
.row100k .rd-lede{font-size:15px;line-height:1.7;color:rgba(255,255,255,.78);max-width:52ch;margin:10px 0 0}
.row100k .rd-act .send{margin-top:22px}
.row100k .rd-you{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8.4vw,58px);line-height:1;letter-spacing:-.02em;text-transform:uppercase;color:var(--water-hover);margin:12px 0 0}
.row100k .rd-wave{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#fff;font-weight:700;margin:14px 0 0}
.row100k .rd-small{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6);margin:12px 0 0;line-height:1.8}
.row100k .rd-two{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:22px;padding-top:18px;border-top:1px dashed rgba(255,255,255,.24)}
.row100k .rd-two .mono{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.78)}

/* THE WAIVER: the tick that rides with the entry, and the strip that asks
 * again afterwards for anyone who has not got to it (owner sent the link
 * 2026-09-11). Never a gate, so it is never styled as an error. */
.row100k .rd-check{display:flex;align-items:flex-start;gap:10px;margin-top:20px;font-size:14px;line-height:1.6;color:rgba(255,255,255,.78);cursor:pointer}
.row100k .rd-check input{flex:none;width:18px;height:18px;margin:2px 0 0;accent-color:var(--water-hover)}
.row100k .rd-check a{color:var(--water-hover);text-decoration:underline;text-underline-offset:3px}
.row100k .rd-check a:hover{color:#fff}
.row100k .rd-waiver{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px dashed rgba(255,255,255,.24)}
.row100k .rd-wlink{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--water-hover);text-decoration:underline;text-underline-offset:4px}
.row100k .rd-wlink:hover{color:#fff}

/* THE FIELD: one table, the bracket marked on the row rather than split
 * into two brackets (owner, 2026-09-11). */
.row100k table.board.rd-t td.wv{color:var(--water-hover);font-weight:700}
.row100k table.board.rd-t td.t5{font-variant-numeric:tabular-nums}
.row100k table.board.rd-t td.br{color:rgba(255,255,255,.6);letter-spacing:.14em}
.row100k table.board.rd-t .none{color:rgba(255,255,255,.45);font-weight:400}
@media(max-width:520px){
  .row100k table.board.rd-t td,.row100k table.board.rd-t th{padding-left:4px;padding-right:4px}
  .row100k .rd-facts .k{width:52px}
}
`;
