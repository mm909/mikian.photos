/* Race day styles — .rd- prefix, theme.ts untouched.
 *
 * THE PAGE IS THE FLYER (owner, 2026-09-11, looking at the story ad: "I
 * really like the flyer — the first flyer, with RACE DAY that are on top of
 * each other. Let us see if that can be the UI that we show when we are
 * signing up"). So the stub of facts this file used to dress is gone and
 * the bill is here instead, in the ad's own order: thick rule, promoter
 * line with the date flush right, RACE over DAY jammed to the measure, a
 * hairline, the piece, the first wave, the bracketed strip between two
 * rules, THE HOUSE, and then — where the ad prints its OPT IN slab — the
 * ACT. The canvas source is poster/raceday.ts; this is that composition
 * translated to HTML, not imported from it.
 *
 * HOW THE DISPLAY LINES FIT. The bill sets each line FLUSH to the measure,
 * which is why RACE and DAY are different sizes — a four-letter word and a
 * three-letter word that span the same column cannot be one size, and that
 * stepped block is the whole look. The canvas measures the face to do it;
 * a page cannot, so page.tsx does the arithmetic off the face metrics and
 * hands the answer down as --k, and every fitted line is sized
 * calc(100cqw / var(--k)). That is what .rd-bill is a container for: cqw is
 * the MEASURE, never the viewport, so a scrollbar cannot push the ink past
 * the column.
 *
 * RACE DAY IS MONOCHROME (owner, 2026-09-11: "on the race day sign up, let
 * us stick with monochromatic — just black and whites, whites on black").
 * The rest of the site keeps the water blue; this one surface does not.
 * Everything between the bar and the footer sits inside .rd-dark, which
 * paints the ink ground full bleed and re-colours the theme classes it
 * contains for that ground. The bar and the footer stay the site's, so the
 * black reads as a bill the page is printed on.
 *
 * WHAT CARRIES THE EMPHASIS NOW that no hue does: SIZE (the head and the
 * wave are the two biggest things on the page), WEIGHT (a value is 700, its
 * label is not), RULE (the bill is built out of rules; the block a rower is
 * IN wears the heaviest one on the page across its top; an error wears a
 * white bar down its side) and above all the INVERSION — the act is a white
 * slab with ink type in it, exactly the OPT IN block of the ad, and it is
 * the only white rectangle on the page.
 *
 * THE GREY LADDER, all four steps measured against the ink ground #15171a
 * (scratchpad/rd-contrast.mjs, alpha composited first, then WCAG):
 *   #fff                    17.96:1  headlines, values, links, filled type
 *   rgba(255,255,255,.74)   10.17:1  body copy
 *   rgba(255,255,255,.62)    7.45:1  mono eyebrows, keys, table heads
 *   rgba(255,255,255,.5)     5.27:1  the quietest live text, dashes, ranks
 * Nothing below .5 ever carries type: .18 to .3 are rules and hairlines,
 * never a letter.
 *
 * Rendered as the text child of a style tag, so the string carries NO
 * double quotes, no apostrophes, no angle brackets and no ampersands —
 * React escapes those server-side only and hydration then fails on the
 * mismatch (the note in theme.ts). Child combinators are out for the same
 * reason; every selector here is a descendant one. Its own module so the
 * page and the scratchpad render harness style the same markup from one
 * copy. */
export const rdCss = `
.row100k .rd-dark{background:var(--ink);color:#fff;padding:6px 0 46px}
.row100k .rd-dark section{padding:40px 0 8px}
.row100k .rd-dark section:first-child{padding-top:30px}

/* The theme classes, re-cut for the ink ground. */
.row100k .rd-dark .sec-head{border-bottom-color:#fff}
.row100k .rd-dark .sec-head h2{color:#fff}
.row100k .rd-dark .sec-head .mono{color:rgba(255,255,255,.62)}
.row100k .rd-dark .board-empty{color:rgba(255,255,255,.62)}
/* globals.css underlines every link in --line, a warm grey off the paper
 * palette (201,200,192). It is the one hue that had got onto this surface:
 * a computed-style walk of the bill found it on the venue link and it would
 * have drawn the waiver and the start list underlines warm against white
 * type. On race day an underline is the colour of its own letters. */
.row100k .rd-dark a{text-decoration-color:currentColor}
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

/* THE BILL. The column is the container, so every fitted line is a share
 * of the MEASURE and nothing is sized off the viewport. --r is the thick
 * rule of the bill, which opens the sheet and then parts it three more
 * times; --g is the gutter the bracket cells keep off their dividers. */
.row100k .rd-bill{container-type:inline-size;--r:clamp(5px,.9cqw,7px);--g:3cqw}
.row100k .rd-rule{height:var(--r);background:#fff}

/* THE MASTHEAD: the promoter left, the day flush right, where a crop or a
 * story chip never eats it. */
.row100k .rd-mast{display:flex;align-items:baseline;justify-content:space-between;gap:10px 18px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-weight:700;font-size:clamp(11px,2.2cqw,15px);letter-spacing:.22em;text-transform:uppercase;color:#fff;margin-top:clamp(9px,2cqw,15px)}
.row100k .rd-mast span:last-child{color:rgba(255,255,255,.62)}

/* The stamp a bill wears once it is over: the only place the page says
 * REGISTRATION CLOSED before the act does. It exists in no other phase. */
.row100k .rd-stamp{display:inline-block;background:#fff;color:var(--ink);font-family:var(--row-mono),monospace;font-weight:700;font-size:clamp(10px,2cqw,13px);letter-spacing:.2em;text-transform:uppercase;padding:6px 12px 5px;margin-top:clamp(12px,2.6cqw,18px)}

/* THE HEAD. RACE over DAY, each line fitted flush to the measure by --k.
 * line-height is set under the cap so the two lines jam into one block the
 * way the ad stacks them on their cap rather than on their em box. */
.row100k .rd-head{margin-top:clamp(6px,1.4cqw,12px)}
.row100k .rd-head span{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(56px,22cqw,150px);font-size:calc(100cqw / var(--k));line-height:.74;letter-spacing:-.02em;text-transform:uppercase;color:#fff}
.row100k .rd-hair{height:1px;background:rgba(255,255,255,.3);margin-top:clamp(10px,2.2cqw,18px)}

/* THE PIECE: what it is, fitted to the same measure as the head — which is
 * what makes the stack read as one bill — and the one time the owner asked
 * for out loud under it, in mono. */
.row100k .rd-piece{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(18px,7cqw,60px);font-size:calc(100cqw / var(--k));line-height:1.06;letter-spacing:-.02em;text-transform:uppercase;color:#fff;margin-top:clamp(12px,2.6cqw,20px)}
.row100k .rd-first{font-family:var(--row-mono),monospace;font-weight:700;font-size:clamp(11px,2.4cqw,17px);letter-spacing:.14em;text-transform:uppercase;color:#fff;margin-top:clamp(8px,1.8cqw,14px)}

/* THE BRACKET — the landing page s chip row inverted onto ink, and the one
 * block that carries the WHEN at display weight. Three cells between two
 * rules, parted by hairlines. All three values take the SAME size, the
 * largest at which the longest of them fits a cell (--kb), because a
 * bracket of unequal numbers reads as three separate things. It stays three
 * ACROSS at every width: the labels wrap, the strip does not break, and at
 * 375 the cap lands where the cap on the ad lands against its own measure. */
.row100k .rd-brk{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);border-top:var(--r) solid #fff;border-bottom:2px solid #fff;margin-top:clamp(16px,3.4cqw,26px)}
/* Half a gutter on each inside edge, so all three cells clear their
 * dividers by the same amount and the narrowest of them is one whole
 * gutter under the column third — which is the width the size below is
 * fitted to. Giving one cell a gutter on both sides is what wrapped
 * 6 – 9 PM onto two lines the first time this was drawn. */
.row100k .rd-brk li{min-width:0;padding:clamp(9px,2cqw,16px) calc(var(--g) / 2) clamp(9px,2cqw,15px)}
.row100k .rd-brk li:first-child{padding-left:0}
.row100k .rd-brk li:last-child{padding-right:0}
.row100k .rd-brk li+li{border-left:1px solid rgba(255,255,255,.18)}
/* nowrap because a value that breaks is not a value: the size is fitted to
 * the cell, and the 1 % left over absorbs sub-pixel rounding. */
.row100k .rd-brk b{display:block;white-space:nowrap;font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(17px,7cqw,52px);font-size:calc(30cqw / var(--kb));line-height:1;letter-spacing:-.02em;text-transform:uppercase;color:#fff}
.row100k .rd-brk span{display:block;font-family:var(--row-mono),monospace;font-size:clamp(8.5px,2.2cqw,12px);line-height:1.5;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-top:clamp(5px,1.2cqw,10px);overflow-wrap:anywhere}

/* THE HOUSE — the owner asked on 2026-09-11 that we see if we can
 * tastefully add in some Strip Barbell branding. TASTEFULLY is the whole
 * brief, so the mark is placed ONCE, at the foot of the bill under a thick
 * rule, the way a venue signs the bottom of a race poster — never a lockup
 * beside a Rowtember mark as an equal, and never wider than the head above
 * it. It is keyed white on transparent already, so it needs no treatment on
 * the ink ground. Beside it: the room, the town, and the waiver, which is
 * signed at the gym and so is named beside the gym.
 *
 * NO LABEL OVER IT (owner, same day: remove the house on race day ads). The
 * mono eyebrow that read THE HOUSE is gone from the ads and from here, and
 * .rd-lab went with it — it dressed nothing else on the page. The row keeps
 * NO margin of its own now: the padding under the rule is the whole gap, so
 * the mark hangs off the rule the way it does on the ad instead of floating
 * where a caption used to be. */
.row100k .rd-house{border-top:var(--r) solid #fff;margin-top:clamp(20px,4.4cqw,34px);padding-top:clamp(12px,2.8cqw,20px)}
.row100k .rd-houseRow{display:flex;align-items:center;justify-content:space-between;gap:clamp(12px,3cqw,26px);flex-wrap:wrap}
.row100k .rd-houseRow a.rd-marklink{display:block;line-height:0;flex:none}
.row100k .rd-houseRow a.rd-marklink:hover{opacity:.8}
.row100k .rd-mark{display:block;width:clamp(112px,30cqw,200px);height:auto}
.row100k .rd-room{font-family:var(--row-mono),monospace;font-size:clamp(10px,2cqw,13px);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5);text-align:right;line-height:1.7;min-width:0}
.row100k .rd-room b,.row100k .rd-room span{display:block}
.row100k .rd-room b{color:#fff;font-weight:700;font-size:clamp(11px,2.3cqw,15px);letter-spacing:.13em}
.row100k .rd-room a{display:block;margin-top:6px;color:rgba(255,255,255,.62);text-decoration:underline;text-underline-offset:3px}
.row100k .rd-room a:hover{color:#fff;text-decoration-thickness:2px}

/* THE ACT — where the ad prints its OPT IN slab, and the reason the page
 * exists. It opens on the bill s thick rule rather than sitting in a box of
 * its own, so it reads as the foot of the same sheet; the filled button is
 * the slab itself, white paper with a verb on it flush left. */
.row100k .rd-act{border-top:var(--r) solid #fff;margin-top:clamp(22px,5cqw,36px);padding-top:clamp(14px,3cqw,22px)}
/* IN. The heaviest rule on the page says so, and the wave says it louder. */
.row100k .rd-act.in{border-top-width:clamp(9px,2cqw,16px)}
.row100k .rd-eye{font-family:var(--row-mono),monospace;font-size:clamp(10px,2cqw,13px);letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:0}
.row100k .rd-lede{font-size:15px;line-height:1.7;color:rgba(255,255,255,.74);max-width:52ch;margin:10px 0 0}
.row100k .rd-act .send{margin-top:clamp(14px,3cqw,22px);text-align:left;font-size:clamp(20px,5.2cqw,34px);letter-spacing:-.01em;padding:clamp(15px,3cqw,21px) clamp(14px,2.8cqw,24px)}
.row100k .rd-you{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,10cqw,66px);line-height:1;letter-spacing:-.02em;text-transform:uppercase;color:#fff;margin:10px 0 0}
.row100k .rd-wave{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#fff;font-weight:700;margin:14px 0 0}
.row100k .rd-small{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:12px 0 0;line-height:1.8}
.row100k .rd-two{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:22px;padding-top:18px;border-top:1px dashed rgba(255,255,255,.24)}
.row100k .rd-two .mono{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.74)}
.row100k .rd-two .outline-btn{margin:0}

/* THE SECOND WAY IN (owner, 2026-09-11: a way to sign up as a spectator
 * versus as just a racer). The racer is the slab above; this is the same
 * .rd-two rail, so the spectator sits in plain sight one line under it
 * without ever competing with it. */
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
}
`;
