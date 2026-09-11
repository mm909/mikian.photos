/* Race day styles — .rd- prefix, theme.ts untouched.
 *
 * RACE DAY IS MONOCHROME (owner, 2026-09-11: "on the race day sign up, let
 * us stick with monochromatic — just black and whites, whites on black").
 * The first cut of this page was white on black but still spent the water
 * blue as its accent; the blue is now OFF race day entirely. The rest of
 * the site keeps it — this one surface does not. Everything between the bar
 * and the footer sits inside .rd-dark, which paints the ink ground full
 * bleed and re-colours the theme classes it contains for that ground. The
 * bar and the footer stay the site's, so the black reads as a panel the
 * page is printed on.
 *
 * WHAT CARRIES THE EMPHASIS NOW that no hue does: SIZE (the day and the
 * wave are the two biggest things on the page), WEIGHT (a value is 700, its
 * key is not), RULE (the block a rower is IN wears a heavy white bar across
 * its top; an error wears a white bar down its side) and above all the
 * INVERSION — a filled button is white with ink type, a quiet one is an
 * outline that fills white on hover.
 *
 * THE GREY LADDER, all four steps measured against the ink ground #15171a
 * (scratchpad/rd-contrast.mjs, alpha composited first, then WCAG):
 *   #fff                    17.96:1  headlines, values, links, filled type
 *   rgba(255,255,255,.74)   10.17:1  body copy
 *   rgba(255,255,255,.62)    7.45:1  mono eyebrows, keys, table heads
 *   rgba(255,255,255,.5)     5.27:1  the quietest live text, dashes, ranks
 * Nothing below .5 ever carries type: .2 to .28 are rules, hairlines and
 * the ground of a disabled button, never a letter.
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
.row100k .rd-dark .sec-head .mono{color:rgba(255,255,255,.62)}
.row100k .rd-dark .board-empty{color:rgba(255,255,255,.62)}
/* An error is white and bold with a rule down its side: on a monochrome
 * page trouble is said by weight, not by turning something red. */
.row100k .rd-dark .form-err{color:#fff;font-weight:700;border-left:3px solid #fff;padding-left:11px}
/* THE INVERSION. Filled is white paper with ink type; the quiet one is an
 * outline that becomes the filled one under the pointer. */
.row100k .rd-dark .send{background:#fff;color:var(--ink)}
.row100k .rd-dark .send:hover{background:rgba(255,255,255,.84)}
.row100k .rd-dark .send:disabled{background:rgba(255,255,255,.2);color:rgba(255,255,255,.5)}
.row100k .rd-dark .outline-btn{border-color:#fff;color:#fff;background:transparent}
.row100k .rd-dark .outline-btn:hover{background:#fff;border-color:#fff;color:var(--ink)}
.row100k .rd-dark .quiet-btn{color:rgba(255,255,255,.62)}
.row100k .rd-dark .quiet-btn:hover{color:#fff}
.row100k .rd-dark :focus-visible{outline-color:#fff}
.row100k .rd-dark table.board{background:transparent;color:rgba(255,255,255,.82)}
.row100k .rd-dark table.board th{color:rgba(255,255,255,.62);border-bottom-color:rgba(255,255,255,.55)}
.row100k .rd-dark table.board td{border-bottom-color:rgba(255,255,255,.2)}
.row100k .rd-dark table.board .rk{color:rgba(255,255,255,.5)}
.row100k .rd-dark table.board .who a{color:#fff}
.row100k .rd-dark table.board .who a:hover{text-decoration:underline;text-underline-offset:3px}

.row100k .rd-dev{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.5);border-bottom:1px dashed rgba(255,255,255,.24);padding-bottom:12px;margin-bottom:22px}

.row100k .rd-stub{border:2px solid #fff;padding:clamp(24px,5vw,38px) clamp(18px,4vw,32px) clamp(26px,5vw,34px)}
.row100k .rd-eye{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:0}
/* The day was blue and is now simply the biggest thing on the page. */
.row100k .rd-when{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(36px,11vw,66px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:#fff;margin:12px 0 0}
.row100k .rd-facts{list-style:none;margin:22px 0 0;padding:18px 0 0;border-top:2px solid #fff;display:grid;gap:11px 26px;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.row100k .rd-facts li{display:flex;align-items:baseline;gap:10px;min-width:0}
.row100k .rd-facts .k{flex:none;width:62px;color:rgba(255,255,255,.62)}
.row100k .rd-facts .v{font-weight:700;color:#fff;min-width:0;letter-spacing:.06em;overflow-wrap:anywhere}
.row100k .rd-facts .v a{color:#fff;text-decoration:underline;text-underline-offset:3px}
.row100k .rd-facts .v a:hover{text-decoration-thickness:2px}
@media(min-width:640px){.row100k .rd-facts{grid-template-columns:1fr 1fr}}

/* THE HOST — the owner asked on 2026-09-11 that we see if we can tastefully
 * add in some Strip Barbell branding. TASTEFULLY is the whole brief, so the
 * mark is placed
 * ONCE, at the foot of the stub under a hairline, the way a venue signs the
 * bottom of a race poster — never a lockup beside the Rowtember mark as an
 * equal, and never wider than the day above it. It is keyed white on
 * transparent already, so it needs no treatment on the ink ground: the
 * width is capped and the height follows the file. Beside it, the room. */
.row100k .rd-host{display:flex;align-items:center;gap:clamp(14px,4vw,22px);flex-wrap:wrap;margin-top:24px;padding-top:20px;border-top:1px dashed rgba(255,255,255,.24)}
.row100k .rd-host a{display:block;line-height:0;flex:none}
.row100k .rd-host a:hover{opacity:.8}
.row100k .rd-mark{display:block;width:clamp(112px,29vw,146px);height:auto}
.row100k .rd-room{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:0;line-height:1.8;min-width:0}
.row100k .rd-room b{display:block;color:#fff;font-weight:700;letter-spacing:.13em;font-size:12px}

.row100k .rd-act{border:2px solid #fff;padding:clamp(22px,5vw,30px) clamp(18px,4vw,26px) clamp(24px,5vw,30px);margin-top:24px}
/* IN. The block used to say so in blue; now a heavy white bar says it. */
.row100k .rd-act.in{border-top-width:9px}
.row100k .rd-lede{font-size:15px;line-height:1.7;color:rgba(255,255,255,.74);max-width:52ch;margin:10px 0 0}
.row100k .rd-act .send{margin-top:22px}
.row100k .rd-you{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8.4vw,58px);line-height:1;letter-spacing:-.02em;text-transform:uppercase;color:#fff;margin:12px 0 0}
.row100k .rd-wave{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#fff;font-weight:700;margin:14px 0 0}
.row100k .rd-small{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:12px 0 0;line-height:1.8}
.row100k .rd-two{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:22px;padding-top:18px;border-top:1px dashed rgba(255,255,255,.24)}
.row100k .rd-two .mono{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.74)}
.row100k .rd-two .outline-btn{margin:0}

/* THE SECOND WAY IN (owner, 2026-09-11: a way to sign up as a spectator
 * versus as just a racer). The racer is the filled button above; this is
 * the same .rd-two rail, so the spectator sits in plain sight one line
 * under it without ever competing with it. */
.row100k .rd-roleline{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:11px 0 0;line-height:1.8}

/* THE WAIVER: the tick that rides with the entry, and the strip that asks
 * again afterwards for anyone who has not got to it (owner sent the link
 * 2026-09-11). Never a gate, so it is never styled as an error. Only a
 * racer is ever asked — a spectator does not pull. */
.row100k .rd-check{display:flex;align-items:flex-start;gap:10px;margin-top:20px;font-size:14px;line-height:1.6;color:rgba(255,255,255,.74);cursor:pointer}
.row100k .rd-check input{flex:none;width:18px;height:18px;margin:2px 0 0;accent-color:#fff}
.row100k .rd-check a{color:#fff;text-decoration:underline;text-underline-offset:3px}
.row100k .rd-check a:hover{text-decoration-thickness:2px}
.row100k .rd-waiver{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px dashed rgba(255,255,255,.24)}
.row100k .rd-wlink{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff;text-decoration:underline;text-underline-offset:4px}
.row100k .rd-wlink:hover{text-decoration-thickness:2px}

/* THE FIELD: one table, the bracket marked on the row rather than split
 * into two brackets (owner, 2026-09-11). The wave is the one figure that
 * has to jump off a row, so it is the only cell in solid white and bold. */
.row100k table.board.rd-t td.wv{color:#fff;font-weight:700}
.row100k table.board.rd-t td.t5{font-variant-numeric:tabular-nums}
.row100k table.board.rd-t td.br{color:rgba(255,255,255,.62);letter-spacing:.14em}
.row100k table.board.rd-t .none{color:rgba(255,255,255,.5);font-weight:400}
@media(max-width:520px){
  .row100k table.board.rd-t td,.row100k table.board.rd-t th{padding-left:4px;padding-right:4px}
  .row100k .rd-facts .k{width:52px}
}
`;
