/* THE RESULTS BOARD styles — .rr- prefix, theme.ts untouched.
 *
 * RACE DAY IS MONOCHROME (owner, 2026-09-11: on the race day sign up, let
 * us stick with monochromatic, just black and whites, whites on black). The
 * gym brand is white on black and the board obeys it: white, four greys of
 * white, and ink. No hue anywhere, which is why a podium here cannot use a
 * gold medal and has to say first, second and third some other way.
 *
 * THE IDIOMS ARE COPIED, NOT IMPORTED. The ink band, the grey ladder and
 * the inversion are lifted from raceday/rdCss.ts (another workflow owns that
 * file right now, so nothing here imports it): .rr-dark paints the ground
 * and re-cuts the theme classes it contains, exactly as .rd-dark does. If
 * the two ever merge, this is the file to fold in.
 *
 * WHAT CARRIES HIERARCHY WITH NO COLOUR:
 *   FILL    a filled white block is the loudest mark on the page, and it
 *           means ONE thing everywhere: a SETTLED FACT. A wave that is in.
 *           First place on a final sheet. The fastest piece of the night.
 *           It is never spent on something still happening.
 *   RULE    9px white bar = LIVE, or yours — the wave on the ergs, the cell
 *           counting it, the box a rower is in. 2px outline = a real
 *           result. 1px hairline = a quieter one. 4px bar down a side =
 *           somebody still to row who can take the lead.
 *   SIZE    the podium clock steps 86 / 52 / 38 (50 / 36 / 31 on a phone).
 *   GREY    #fff / .74 / .62 / .5, measured on the ink ground in rdCss.ts.
 *           Nothing under .5 ever carries a letter; .2 to .28 are rules.
 *
 * THE CAST VIEW HAS A HIGHER FLOOR: nothing under .62 white inside
 * .rr-cast, because .5 crushes on a cheap TV in a bright gym.
 *
 * THE BAR AND THE FOOTER ARE INVERTED HERE. Every judge said the same
 * thing: the cream site bar with its blue wordmark was the only colour in
 * the mocks and it sat directly above a monochrome board. Under .rr-mono
 * the shared chrome is re-cut for ink. Nothing outside this page changes.
 *
 * WIDTH IS 1120px, not the site 760 — a results board is read from across a
 * room.
 *
 * Rendered as the text child of a style tag, so the string carries NO
 * double quotes, no apostrophes, no angle brackets and no ampersands (React
 * escapes those server-side only and hydration then fails on the mismatch —
 * the note in theme.ts). That includes these comments, and it is why there
 * is no child combinator anywhere below. */
export const rrCss = `
.row100k .rr-dark{background:var(--ink);color:#fff;padding:6px 0 46px}
.row100k .rr-dark section{padding:38px 0 6px}
.row100k .rr-dark section:first-child{padding-top:26px}
.row100k .rr-wrap{max-width:1120px;margin:0 auto;padding:0 20px}

/* The theme classes, re-cut for the ink ground (copied from rdCss.ts). */
.row100k .rr-dark .sec-head{border-bottom-color:#fff}
.row100k .rr-dark .sec-head h2{color:#fff}
.row100k .rr-dark .sec-head .mono{color:rgba(255,255,255,.62)}

/* THE CHROME, inverted for this page only. */
.row100k.rr-mono .bar{background:var(--ink);border-bottom-color:#fff}
.row100k.rr-mono .bar-brand,.row100k.rr-mono .bar-brand .dot{color:#fff}
.row100k.rr-mono .bar-brand:hover{color:rgba(255,255,255,.7)}
.row100k.rr-mono .rail a{color:rgba(255,255,255,.62)}
.row100k.rr-mono .rail a.brand{color:#fff}
.row100k.rr-mono .rail a.lit{color:var(--ink)}
.row100k.rr-mono .rail-pill{background:#fff}
.row100k.rr-mono .rail:not(.live) a.on{background:#fff;color:var(--ink)}
.row100k.rr-mono .acct-chip{border-color:#fff;color:#fff}
.row100k.rr-mono .acct-chip:hover{border-color:#fff;color:var(--ink);background:#fff}
.row100k.rr-mono .bar-log{background:#fff;border-color:#fff;color:var(--ink)}
.row100k.rr-mono .bar .mono{color:rgba(255,255,255,.62)}
.row100k.rr-mono .rfb-k,.row100k.rr-mono .rfb-t,.row100k.rr-mono .rfb-x{color:#fff}
.row100k.rr-mono .rfb-cta{background:#fff;border-color:#fff;color:var(--ink)}
.row100k.rr-mono .rfb-cta.in{background:transparent;color:#fff}
.row100k.rr-mono .rfb-cta:hover,.row100k.rr-mono .rfb-cta:focus-visible{background:#fff;border-color:#fff;color:var(--ink)}
.row100k.rr-mono footer{background:var(--ink);color:#fff;border-top-color:#fff;margin-top:0}
.row100k.rr-mono footer .mono,.row100k.rr-mono footer a{color:#fff}
.row100k.rr-mono :focus-visible{outline-color:#fff}

/* The sample note, same shape as the other dev pages. */
.row100k .rr-dev{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.5);border-bottom:1px dashed rgba(255,255,255,.24);padding-bottom:12px;margin-bottom:20px;line-height:1.9}
.row100k .rr-dev b{color:#fff}
.row100k .rr-dev a{color:#fff;text-decoration:underline;text-underline-offset:3px}

/* ---- the dateline ---- */
.row100k .rr-line{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.4);padding-bottom:12px}
.row100k .rr-date{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62);line-height:1.9;min-width:0}
.row100k .rr-date b{display:block;color:#fff;font-weight:700;letter-spacing:.14em;font-size:12px}
.row100k .rr-now{display:flex;align-items:center;gap:10px;flex:none;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,4vw,28px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:#fff}
.row100k .rr-sq{width:13px;height:13px;background:#fff;flex:none}
.row100k .rr-fresh{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5);margin:10px 0 0}
.row100k .rr-fresh b{color:#fff;font-weight:700}
/* A FROZEN BOARD MUST LOOK LOUDER, NOT QUIETER. Dimming the stale line was
 * backwards: a board nobody has typed into for ten minutes is the one thing
 * on the page a reader has to be told, so it takes the bar. */
.row100k .rr-fresh.stale{border-left:3px solid #fff;padding-left:11px;color:rgba(255,255,255,.74)}
.row100k .rr-fresh.stale b{color:#fff}

/* ---- YOU ---- */
.row100k .rr-you{border:2px solid #fff;border-left-width:9px;padding:14px 18px;margin-top:20px;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.62);line-height:2;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.row100k .rr-you b{color:#fff;font-weight:700}
.row100k .rr-you .nm{font-family:var(--row-archivo-black),sans-serif;font-size:17px;letter-spacing:0;color:#fff}

/* ---- boxes ---- */
.row100k .rr-three{display:grid;gap:14px;margin-top:20px}
.row100k .rr-box{border:2px solid #fff;padding:16px 18px 18px;min-width:0}
.row100k .rr-box.lead{border-top-width:9px}
.row100k .rr-eye{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:0}
.row100k .rr-eye .rt{margin-left:auto;letter-spacing:.14em}
.row100k .rr-chip{font-family:var(--row-mono),monospace;font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;border:1px solid rgba(255,255,255,.62);color:rgba(255,255,255,.8);padding:2px 6px 1px}
.row100k .rr-chip.fill{background:#fff;border-color:#fff;color:var(--ink)}
.row100k .rr-big{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(46px,7.4vw,64px);line-height:.94;letter-spacing:-.03em;text-transform:uppercase;color:#fff;font-variant-numeric:tabular-nums;margin:12px 0 0}
.row100k .rr-who{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(19px,2.4vw,24px);line-height:1.1;text-transform:uppercase;letter-spacing:-.01em;color:#fff;margin:8px 0 0}
.row100k .rr-who span{color:rgba(255,255,255,.5)}
.row100k .rr-meta{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:9px 0 0;line-height:1.9}
.row100k .rr-meta b{color:#fff;font-weight:700}
.row100k .rr-foot{margin:14px 0 0;padding-top:12px;border-top:1px dashed rgba(255,255,255,.3);font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.62);line-height:2}
.row100k .rr-foot b{color:#fff;font-weight:700}
.row100k .rr-foot .thr{display:block;color:rgba(255,255,255,.74)}
.row100k .rr-foot .thr b{letter-spacing:.1em}

/* ---- the lane strip ---- */
.row100k .rr-lanes{display:grid;grid-template-columns:1fr 1fr;gap:1px;margin-top:14px;background:rgba(255,255,255,.24)}
.row100k .rr-lane{background:var(--ink);padding:10px 12px 12px;min-width:0}
.row100k .rr-ln{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.5);margin:0}
.row100k .rr-lname{font-family:var(--row-archivo-black),sans-serif;font-size:15px;line-height:1.15;text-transform:uppercase;color:#fff;margin:5px 0 0;overflow-wrap:anywhere}
.row100k .rr-lsub{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5);margin:4px 0 0}
/* .5, not .4 — the grey floor this file sets, and the open lane is where the
 * no-show is NAMED. The lane still reads quieter than a rowing one because
 * the typeface and the size change on the line below. */
.row100k .rr-lane.open .rr-lname,.row100k .rr-lane.open .rr-lsub{color:rgba(255,255,255,.5)}
.row100k .rr-lane.open .rr-lname{font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:14px}

/* ---- the counter strip ---- */
.row100k .rr-count{display:flex;border:2px solid #fff;margin-top:16px}
.row100k .rr-cell{flex:1 1 0;padding:12px 16px 14px;min-width:0;border-left:1px solid rgba(255,255,255,.3)}
.row100k .rr-cell:first-child{border-left:0}
.row100k .rr-cell.fill{background:#fff;color:var(--ink)}
.row100k .rr-cell.live{border-top:9px solid #fff;padding-top:8px}
.row100k .rr-n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,4.4vw,40px);line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.row100k .rr-k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:5px 0 0}
.row100k .rr-cell.fill .rr-k{color:rgba(21,23,26,.7)}
.row100k .rr-next{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:14px 0 0;line-height:2;border-top:2px solid #fff;padding-top:13px}
.row100k .rr-next b{color:#fff;font-weight:700}

/* ---- the wave grid ---- */
.row100k .rr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.row100k .rr-cw{border:1px solid rgba(255,255,255,.4);padding:12px 12px 14px;min-width:0}
.row100k .rr-cw.done{background:#fff;border-color:#fff;color:var(--ink)}
.row100k .rr-cw.live{border:2px solid #fff;border-top-width:9px}
.row100k .rr-cw.yours{border-left-width:9px}
.row100k .rr-cwk{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:0}
.row100k .rr-cw.done .rr-cwk{color:rgba(21,23,26,.66)}
.row100k .rr-wn{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(38px,5vw,54px);line-height:.9;letter-spacing:-.03em;margin:2px 0 0;color:#fff}
.row100k .rr-cw.done .rr-wn{color:var(--ink)}
.row100k .rr-cw.soon .rr-wn{color:rgba(255,255,255,.5)}
.row100k .rr-cws{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:9px 0 0;line-height:1.9}
.row100k .rr-cws b{color:#fff;font-weight:700}
.row100k .rr-cw.done .rr-cws,.row100k .rr-cw.done .rr-cws b{color:rgba(21,23,26,.72)}

/* ---- the note over the field ---- */
.row100k .rr-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.62);line-height:2.1;max-width:96ch;margin:0 0 18px}
.row100k .rr-note b{color:#fff;font-weight:700}

/* ---- the table ---- */
.row100k table.rr-t{width:100%;border-collapse:collapse;font-family:var(--row-mono),monospace;font-size:13px;color:rgba(255,255,255,.82)}
.row100k table.rr-t th{text-align:left;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.62);font-weight:400;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.55);white-space:nowrap}
.row100k table.rr-t td{padding:9px 6px;border-bottom:1px dashed rgba(255,255,255,.2);vertical-align:middle}
.row100k table.rr-t td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.row100k table.rr-t td.nm{font-family:var(--row-archivo),sans-serif;font-weight:700;color:#fff;min-width:0}
.row100k table.rr-t td.no{color:rgba(255,255,255,.5);width:52px;font-variant-numeric:tabular-nums}
.row100k table.rr-t td.br{color:rgba(255,255,255,.5);width:34px}
.row100k table.rr-t td.tm{color:#fff;font-weight:700;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.row100k table.rr-t td.dim{color:rgba(255,255,255,.5);text-align:right;white-space:nowrap}
.row100k table.rr-t td.seed{color:rgba(255,255,255,.62);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.row100k table.rr-t .pl{width:54px}
.row100k table.rr-t tr.live td{background:rgba(255,255,255,.08)}
.row100k table.rr-t tr.live td:first-child{box-shadow:inset 3px 0 0 #fff}
.row100k table.rr-t tr.mine td{background:rgba(255,255,255,.1)}
.row100k table.rr-t tr.mine td:first-child{box-shadow:inset 6px 0 0 #fff}
/* THE SEED BAR, from the ledger: anybody still to row whose fastest 5k on
 * record is under the leading time gets a bar down their side and their
 * name lifted to full white. It is what turns the table from a list into an
 * answer for the rower sitting fourth, not just for the leader. */
.row100k table.rr-t tr.thr td:first-child{box-shadow:inset 4px 0 0 #fff}
.row100k table.rr-t tr.thr td.seed{color:#fff;font-weight:700}
.row100k table.rr-t td.st{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.5);text-align:right;white-space:nowrap}
.row100k table.rr-t td.st.now{color:#fff;font-weight:700}
/* THE GROUP ROWS ARE TH, NOT TD. A wave head is a heading for the rows under
 * it, not a value in the Place column, and a screen reader was announcing it
 * as one. They are th scope=colgroup in the markup and styled back to the
 * left-aligned band they always looked like. White space has to be released
 * here: the generic th is nowrap, and these run the width of the table. */
.row100k table.rr-t tr.wh th{text-align:left;border-bottom:0;padding:26px 6px 7px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#fff;font-weight:700;border-top:2px solid #fff;white-space:normal}
.row100k table.rr-t tr.wh th span{float:right;color:rgba(255,255,255,.62);font-weight:400}
.row100k table.rr-t tr.wh th span.now{color:#fff;font-weight:700}
/* THE RULE, from the ledger: the heavy line drawn under the last finisher,
 * which says the honest thing louder than a column of dashes. */
.row100k table.rr-t tr.rule th{text-align:left;border-top:3px solid #fff;border-bottom:0;padding:14px 6px 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#fff;font-weight:700;line-height:2;white-space:normal}
.row100k table.rr-t tr.rule th em{font-style:normal;color:rgba(255,255,255,.62);font-weight:400}
/* THE CAPTION names the table for anybody arriving by keyboard or by ear,
 * and it reads as the same quiet mono line the rest of the page uses. */
.row100k table.rr-t caption{caption-side:top;text-align:left;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62);padding:0 0 11px;line-height:1.9}
.row100k .rr-sub{display:none}
.row100k .rr-tag{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;border:1px solid rgba(255,255,255,.5);color:rgba(255,255,255,.62);padding:1px 5px;margin-left:8px;white-space:nowrap}
.row100k .rr-tag.you{background:#fff;border-color:#fff;color:var(--ink);font-weight:700}

/* THE PLACE MARK — the medal with the colour taken out, and the same three
 * marks as the podium so the two teach each other. Mid-race the fill is
 * WITHHELD (.prov): a filled white 1 at 7:38 PM with sixteen people still
 * to row is a screenshot somebody will argue with, so the fill arrives with
 * the word FINAL. The mark is qualified M1 / W1 because places are within
 * bracket and this table holds one room. */
.row100k .rr-pl{display:inline-block;min-width:30px;text-align:center;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.04em;padding:3px 5px 2px;color:rgba(255,255,255,.5)}
.row100k .rr-pl.p1{background:#fff;color:var(--ink)}
.row100k .rr-pl.p2{border:2px solid #fff;color:#fff}
.row100k .rr-pl.p3{border:1px solid rgba(255,255,255,.6);color:rgba(255,255,255,.86)}
/* Withholding the fill cost first place its mark: an outline is what SECOND
 * wears, so the provisional 1 and the provisional 2 came out identical and
 * the ladder collapsed on the screen the owner opens first. First keeps a
 * third step by taking the heavy top bar it is already owed everywhere else
 * on this board — the bar means LEADING, which is exactly what a provisional
 * first place is. Fill is still not spent until the word FINAL. */
.row100k table.rr-t.prov .rr-pl.p1{background:transparent;border:2px solid #fff;border-top-width:6px;color:#fff}

/* ---- the podium ---- */
.row100k .rr-pod{display:grid;gap:12px;margin-top:4px}
.row100k .rr-step{border:1px solid rgba(255,255,255,.45);padding:16px 18px 18px;min-width:0}
.row100k .rr-step.s1{background:#fff;border-color:#fff;color:var(--ink)}
.row100k .rr-step.s2{border:2px solid #fff;border-top-width:7px;color:#fff}
.row100k .rr-step.s3{color:rgba(255,255,255,.86)}
.row100k .rr-ord{display:flex;align-items:baseline;gap:12px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:inherit}
.row100k .rr-ord .gp{margin-left:auto;letter-spacing:.12em;font-weight:400;color:rgba(255,255,255,.74)}
.row100k .rr-step.s1 .rr-ord .gp{color:rgba(21,23,26,.7)}
.row100k .rr-pt{font-family:var(--row-archivo-black),sans-serif;line-height:.94;letter-spacing:-.035em;font-variant-numeric:tabular-nums;margin:10px 0 0;color:inherit}
.row100k .rr-step.s1 .rr-pt{font-size:50px}
.row100k .rr-step.s2 .rr-pt{font-size:36px}
.row100k .rr-step.s3 .rr-pt{font-size:31px}
.row100k .rr-pn{font-family:var(--row-archivo-black),sans-serif;text-transform:uppercase;letter-spacing:-.01em;line-height:1.1;margin:6px 0 0;color:inherit}
.row100k .rr-step.s1 .rr-pn{font-size:25px}
.row100k .rr-step.s2 .rr-pn{font-size:19px}
.row100k .rr-step.s3 .rr-pn{font-size:18px}
.row100k .rr-pm{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:10px 0 0;padding-top:9px;border-top:1px solid rgba(255,255,255,.3);line-height:2}
.row100k .rr-step.s1 .rr-pm{color:rgba(21,23,26,.7);border-top-color:rgba(21,23,26,.25)}
.row100k .rr-pm b{color:#fff;font-weight:700}
.row100k .rr-step.s1 .rr-pm b{color:var(--ink)}
/* THE FOURTH LINE. A podium normally hides it; printed, third place stops
 * being a cut-off and becomes a margin — and on this field a woman misses
 * it by nine tenths of a second. */
.row100k .rr-fourth{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:12px 0 0;padding-top:12px;border-top:1px dashed rgba(255,255,255,.3);line-height:2}
.row100k .rr-fourth b{color:#fff;font-weight:700}
.row100k .rr-legend{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);margin:16px 0 0;line-height:2.1}
.row100k .rr-legend b{color:rgba(255,255,255,.74);font-weight:700}

/* ---- worth saying: dotted leaders, the way the rest of the site lists ---- */
.row100k .rr-say{list-style:none;margin:0;padding:0;display:grid;gap:13px}
.row100k .rr-say li{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.62);min-width:0}
.row100k .rr-say .ln{display:flex;align-items:baseline;gap:0;min-width:0}
.row100k .rr-say .k{flex:0 1 auto;min-width:0}
.row100k .rr-say .dt{flex:1 1 auto;border-bottom:1px dotted rgba(255,255,255,.32);margin:0 9px;transform:translateY(-4px);min-width:14px}
.row100k .rr-say .v{flex:none;color:#fff;font-weight:700;text-align:right;white-space:nowrap}
/* The gloss sits on its own line under the figure it belongs to, or a long
 * one pushes the whole leader out of its column. */
.row100k .rr-say .n{display:block;color:rgba(255,255,255,.5);font-weight:400;font-size:10px;letter-spacing:.1em;line-height:1.7;margin-top:2px;text-align:right;overflow-wrap:anywhere}

/* ---- the cast frame: 1280 by 720, no chrome, nothing scrolls ---- */
.row100k .rr-fit{width:100%;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;overflow:hidden}
.row100k .rr-cast{width:1280px;height:720px;flex:none;background:var(--ink);color:#fff;padding:15px 20px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;overflow:hidden;transform-origin:top left}
.row100k .rr-cast .rr-date{font-size:13px;letter-spacing:.18em;line-height:1.7;color:rgba(255,255,255,.66)}
.row100k .rr-cast .rr-date b{font-size:14px}
.row100k .rr-cast .rr-now{font-size:40px}
.row100k .rr-cast .rr-line{padding-bottom:9px}
.row100k .rr-cast .rr-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:none}
.row100k .rr-cast .rr-box{padding:11px 16px 12px}
.row100k .rr-cast .rr-eye{font-size:12px;letter-spacing:.2em;color:rgba(255,255,255,.7)}
.row100k .rr-cast .rr-big{font-size:104px;margin-top:1px}
.row100k .rr-cast .rr-who{font-size:26px;margin-top:0}
/* The rower number beside the leader was the last thing on the wall still
 * sitting at .5, under the floor this frame claims for a bright gym. */
.row100k .rr-cast .rr-who span{color:rgba(255,255,255,.66)}
.row100k .rr-cast .rr-meta{font-size:12px;color:rgba(255,255,255,.66);margin-top:5px}
.row100k .rr-cast .rr-foot{font-size:13px;color:rgba(255,255,255,.66);margin-top:7px;padding-top:7px;letter-spacing:.09em;line-height:1.85}
/* THE FRAME IS CLIPPED AT 720, so a grid that does not match the model wraps
 * to a second row and falls off the television with no error. Both counts
 * come in from the component as custom properties rather than being typed
 * here: the lane strip maps over board.ergs and the grid over board.waves,
 * and eight and five are only true of tonight. */
.row100k .rr-cast .rr-lanes{grid-template-columns:repeat(var(--rr-ergs,8),1fr);margin-top:9px}
.row100k .rr-cast .rr-lane{padding:6px 8px 7px}
.row100k .rr-cast .rr-ln{font-size:11px;color:rgba(255,255,255,.62)}
.row100k .rr-cast .rr-lname{font-size:15px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:clip}
.row100k .rr-cast .rr-lsub{font-size:11px;color:rgba(255,255,255,.62);margin-top:3px}
.row100k .rr-cast .rr-lane.open .rr-lname,.row100k .rr-cast .rr-lane.open .rr-lsub{color:rgba(255,255,255,.62)}
.row100k .rr-cast .rr-strip{display:grid;grid-template-columns:1fr 424px;gap:12px;align-items:stretch}
.row100k .rr-cast .rr-col{display:flex;flex-direction:column;min-width:0}
.row100k .rr-cast .rr-col .rr-count,.row100k .rr-cast .rr-col .rr-grid{flex:1 1 auto}
.row100k .rr-cast .rr-grid{grid-template-columns:repeat(var(--rr-waves,5),1fr);gap:8px}
.row100k .rr-cast .rr-cw{padding:7px 10px 8px}
.row100k .rr-cast .rr-cwk{font-size:11px;color:rgba(255,255,255,.66)}
.row100k .rr-cast .rr-wn{font-size:40px}
.row100k .rr-cast .rr-cw.soon .rr-wn{color:rgba(255,255,255,.72)}
.row100k .rr-cast .rr-cws{font-size:11px;color:rgba(255,255,255,.66);margin-top:4px;line-height:1.6;white-space:nowrap}
.row100k .rr-cast .rr-count{margin-top:0;border-width:2px}
.row100k .rr-cast .rr-cell{padding:8px 12px 9px;display:flex;flex-direction:column;justify-content:center}
.row100k .rr-cast .rr-n{font-size:32px}
.row100k .rr-cast .rr-k{font-size:10px;letter-spacing:.11em;color:rgba(255,255,255,.66);margin-top:3px;white-space:nowrap}
.row100k .rr-cast .rr-pod{grid-template-columns:1.4fr 1fr 1fr;gap:10px}
.row100k .rr-cast .rr-step.s1 .rr-pt{font-size:62px}
.row100k .rr-cast .rr-step.s2 .rr-pt{font-size:42px}
.row100k .rr-cast .rr-step.s3 .rr-pt{font-size:34px}
.row100k .rr-cast .rr-step{padding:11px 14px 12px}
.row100k .rr-cast .rr-pm{font-size:11px;color:rgba(255,255,255,.7);margin-top:7px;padding-top:6px;line-height:1.8}
.row100k .rr-cast .rr-fourth{font-size:12px;color:rgba(255,255,255,.7);margin-top:8px;padding-top:8px}
.row100k .rr-cast .rr-castk{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.66);margin:0 0 4px}
.row100k .rr-cast .rr-samp{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.62);text-align:right;margin:4px 0 0}
/* The wall is the one screen nobody can interrogate, so a board that has
 * gone quiet has to say so LOUDER there than anywhere else. */
.row100k .rr-cast .rr-samp.stale{color:#fff;font-weight:700}

/* The frame is a fixed 1280 by 720 because a television is. Anything
 * narrower is shown the same frame, scaled — a phone looking at the cast
 * view is looking at what the wall shows, not at a reflowed page.
 *
 * A TRANSFORM DOES NOT SHRINK THE BOX. Scaling alone left a 1280 by 720 hole
 * with a postage stamp floating in the middle of it, so the frame sits in a
 * STAGE that is resized to the scaled size at every step and the frame is
 * pinned to its top left corner. The steps are the same four; the smallest
 * one starts at 519 rather than 479 because .4 of 1280 is 512, and between
 * 480 and 511 the frame was losing both its edges to overflow. */
.row100k .rr-stage{width:1280px;height:720px;flex:none}
@media(max-width:1279px){.row100k .rr-cast{transform:scale(.78)}.row100k .rr-stage{width:998px;height:562px}}
@media(max-width:1023px){.row100k .rr-cast{transform:scale(.56)}.row100k .rr-stage{width:717px;height:403px}}
@media(max-width:767px){.row100k .rr-cast{transform:scale(.4)}.row100k .rr-stage{width:512px;height:288px}}
@media(max-width:519px){.row100k .rr-cast{transform:scale(.28)}.row100k .rr-stage{width:359px;height:202px}}

/* ON A PHONE the wall is pinned to the top and LABELLED. Centred and
 * unlabelled it was a thumbnail adrift in a screen of black with nothing
 * saying what it was. The caption lives outside the scaled box, so it is
 * never on the television. */
.row100k .rr-fitcap{display:none}
@media(max-width:767px){
  .row100k .rr-fit{justify-content:flex-start;align-items:center;padding-top:28px;gap:16px}
  .row100k .rr-fitcap{display:block;font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.62);text-align:center;padding:0 16px;margin:0;line-height:2.2}
  .row100k .rr-fitcap b{color:#fff;font-weight:700}
  /* The way out never breaks across two lines. */
  .row100k .rr-fitcap a{color:#fff;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
}

/* ---- widths ---- */
@media(min-width:620px){
  .row100k .rr-lanes{grid-template-columns:repeat(4,1fr)}
  .row100k .rr-grid{grid-template-columns:repeat(5,1fr)}
}
@media(min-width:880px){
  .row100k .rr-three{grid-template-columns:1fr 1fr 1.06fr}
  .row100k .rr-pod{grid-template-columns:1.44fr 1fr 1fr}
  .row100k .rr-say{grid-template-columns:1fr 1fr;gap:11px 40px}
  .row100k .rr-step.s1 .rr-pt{font-size:86px}
  .row100k .rr-step.s2 .rr-pt{font-size:52px}
  .row100k .rr-step.s3 .rr-pt{font-size:38px}
}

/* THE PHONE. The split, the seed and the bracket leave the grid and come
 * back as one quiet line under the name, so a name never wraps. */
@media(max-width:619px){
  .row100k .rr-hx{display:none}
  .row100k .rr-sub{display:block;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-top:3px;font-weight:400}
  .row100k table.rr-t{font-size:12px}
  .row100k table.rr-t td{padding:8px 3px}
  .row100k table.rr-t th{padding:7px 3px}
  .row100k table.rr-t td.no{width:40px}
  .row100k table.rr-t .pl{width:42px}
  .row100k .rr-pl{min-width:26px;font-size:10px}
  .row100k .rr-cell{padding:10px 10px 12px}
  .row100k .rr-you{padding:12px 14px;border-left-width:7px}
}
`;
