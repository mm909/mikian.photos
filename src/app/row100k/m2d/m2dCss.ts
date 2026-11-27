/* THE M2D PAGE (page.tsx, M2dSite.tsx), on top of the board page
 * (board100kCss): the dollars as the head, the goal track, the call in a
 * ruled box, and a dollars column on every width. Site variables only
 * (theme.ts). Rendered as the text child of a style tag, so no double
 * quotes, no apostrophes, no angle brackets and no ampersands in this
 * string; descendant selectors only. */
export const m2dCss = `
.row100k .m2-head{margin-top:26px;text-align:center}
.row100k .m2-head .m2-goal,.row100k .m2-head .m2-from,.row100k .m2-head .m2-worth{margin-left:auto;margin-right:auto;text-align:left}
.row100k .m2-from dt small{display:block;margin-top:3px;font-family:var(--row-mono),monospace;font-size:10px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}
.row100k .m2-from div.total{border-top:2px solid var(--ink);border-bottom:0}
.row100k .m2-from div.total dt{font-family:var(--row-archivo-black),sans-serif;font-weight:400;text-transform:uppercase}
.row100k .m2-worth{margin-top:34px;max-width:560px}
.row100k .m2-worth-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:8px;border-bottom:2px solid var(--ink)}
.row100k .m2-worth-h h2{padding-bottom:0;border-bottom:0;color:var(--ink)}
.row100k .m2-worth-h .m2-quiet,.row100k .m2-worth-h .m2-quiet-t{font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--water);text-align:right}
.row100k .m2 .bd-row{--bd-figs:156px}
.row100k .m2 .bd-row.past .bd-bar{background:color-mix(in srgb,var(--water) 22%,transparent)}
@media (min-width:640px){.row100k .m2 .bd-row{--bd-figs:324px}}
.row100k .m2-worth h2{font-family:var(--row-archivo-black),sans-serif;font-size:19px;font-weight:400;text-transform:uppercase;color:var(--ink)}
.row100k .m2-worth dl div{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:9px 0;border-bottom:1px solid var(--line)}
.row100k .m2-worth dt{font-size:15px;font-weight:700;color:var(--ink)}
.row100k .m2-worth dd{font-family:var(--row-mono),monospace;font-size:15px;font-weight:700;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .m2-worth dl div.rate dd{color:var(--ink)}
.row100k .m2-worth dl div.you{border-top:2px solid var(--ink);border-bottom:0}
.row100k .m2-worth dl div.you dt{font-family:var(--row-archivo-black),sans-serif;font-weight:400;text-transform:uppercase}
.row100k .m2-kick{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .m2-big{margin-top:6px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(64px,17vw,168px);font-weight:400;line-height:.95;letter-spacing:-.02em;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .m2-sub{margin-top:10px;font-family:var(--row-mono),monospace;font-size:11px;line-height:1.6;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.row100k .m2-goal{margin-top:22px;max-width:560px}
.row100k .m2-goal-t{display:flex;justify-content:space-between;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .m2-track{margin-top:6px;height:10px;border:1px solid var(--ink)}
.row100k .m2-track i{display:block;height:100%;background:var(--water)}
.row100k .m2-from{margin-top:18px;max-width:560px;border-top:2px solid var(--ink)}
.row100k .m2-from div{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:10px 0 9px;border-bottom:1px solid var(--line)}
.row100k .m2-from dt{font-size:15px;font-weight:700;color:var(--ink)}
.row100k .m2-from dd{font-family:var(--row-mono),monospace;font-size:15px;font-weight:700;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .m2-from div.sub{padding:6px 0 5px 16px;border-bottom:0}
.row100k .m2-from div.sub dt{font-size:13.5px;font-weight:400;color:var(--gray)}
.row100k .m2-from div.sub dd{font-size:13px;font-weight:400;color:var(--gray)}
.row100k .m2-goal + .m2-from{margin-top:22px}
.row100k .m2-split{margin-top:8px;max-width:560px;font-family:var(--row-mono),monospace;font-size:11px;line-height:1.7;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}

.row100k .m2-picks-wrap{margin-top:26px}
.row100k .m2-pick-lede{margin-top:6px;max-width:640px;font-size:14px;line-height:1.5;color:var(--gray)}
.row100k .m2-picks{display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px}
/* A CHARITY: the card is the radio; its own site is a link under it. The
 * picked one is a solid block of the accent with a check (review,
 * 2026-11-25: an unmistakable selected state). */
.row100k .m2-pickbox{display:flex;flex-direction:column}
.row100k .m2-pick{display:block;flex:1 1 auto;width:100%;text-align:left;background:none;border:1px solid var(--ink);border-radius:0;padding:12px 14px;color:var(--ink);font-family:var(--row-archivo),sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}
.row100k .m2-pick b{display:flex;align-items:baseline;gap:0;font-family:var(--row-archivo-black),sans-serif;font-size:17px;font-weight:400;text-transform:uppercase}
.row100k .m2-pick .m2-tick{display:inline-block;width:0;overflow:hidden}
.row100k .m2-pick span{display:block;margin-top:4px;font-size:13.5px;line-height:1.45;color:var(--gray)}
.row100k .m2-pick:hover{border-color:var(--water)}
.row100k .m2-pickbox.on .m2-pick{background:var(--water);border-color:var(--water);color:#fff}
.row100k .m2-pickbox.on .m2-pick span{color:#fff;opacity:.9}
.row100k .m2-pickbox.on .m2-pick .m2-tick{width:auto;margin-right:6px}
.row100k .m2-pick:disabled{cursor:default}
.row100k .m2-pick:disabled:hover{border-color:var(--ink)}
.row100k .m2-pickbox.on .m2-pick:disabled:hover{border-color:var(--water)}
.row100k .m2-site{align-self:flex-start;margin-top:6px;font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);text-decoration:underline;text-underline-offset:3px}
.row100k .m2-site:hover{color:var(--water)}

/* I M REGISTERED: the one solid button on the page, right under the pick. */
.row100k .m2-act{margin-top:18px}
.row100k .m2-go{display:block;width:100%;max-width:420px;background:var(--water);color:#fff;border:2px solid var(--water);border-radius:0;padding:16px 20px;font-family:var(--row-archivo-black),sans-serif;font-size:20px;font-weight:400;letter-spacing:.02em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent}
.row100k .m2-go:hover{background:var(--ink);border-color:var(--ink)}
.row100k .m2-go:disabled{background:none;color:var(--gray);border-color:var(--line);cursor:default}
.row100k .m2-act .m2-note{margin-top:10px}
.row100k .m2-c2{margin-top:20px}
.row100k .m2-inline{color:var(--water);font-weight:700;text-decoration:underline;text-underline-offset:3px}
.row100k .m2-steps li.ours .k{color:var(--ink)}
.row100k .m2-steps li.ours b{color:var(--water)}
/* METERS TO DOLLARS: the graph, big type, few labels. */
.row100k .m2-explain{margin-top:34px;max-width:620px}
.row100k .m2-g{display:block;width:100%;height:auto;margin-top:10px;overflow:visible}
.row100k .m2-g .ax{stroke:var(--line);stroke-width:1}
.row100k .m2-g .ln{stroke:var(--ink);stroke-width:3;fill:none}
.row100k .m2-g .ln.dash{stroke-dasharray:6 6}
.row100k .m2-g .jump{stroke:var(--ink);stroke-width:1.5;stroke-dasharray:2 3}
.row100k .m2-g .ms{fill:var(--paper);stroke:var(--ink);stroke-width:2}
.row100k .m2-g .mk{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;fill:var(--ink)}
.row100k .m2-g .lb{font-family:var(--row-mono),monospace;font-size:11px;fill:var(--gray)}
.row100k .m2-g .lb.sm{font-size:10px}
.row100k .m2-g .you{fill:var(--water)}
.row100k .m2-g .yl{font-family:var(--row-mono),monospace;font-size:13px;font-weight:700;fill:var(--water)}
.row100k .m2-words{margin-top:10px;font-size:17px;font-weight:700;line-height:1.45;color:var(--ink)}

/* REGISTERED: a status in a ruled box, the one link beside it; Undo small,
 * quiet and set apart below. */
.row100k .m2-status{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:20px;max-width:560px;padding:12px 14px;border:1px solid var(--water)}
.row100k .m2-status p{font-family:var(--row-mono),monospace;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--water)}
.row100k .m2-quiet{background:none;border:0;border-radius:0;padding:0;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.row100k .m2-quiet:hover{color:var(--ink)}
.row100k .m2-undo{margin-top:28px;text-align:right;max-width:560px}
.row100k .m2-mine .m2-pick{cursor:default}
.row100k .m2-mine-row{display:flex;justify-content:space-between;align-items:center;margin-top:8px;max-width:560px}
.row100k .m2-mine-row .m2-site{margin-top:0}
.row100k .m2-picks-wrap .m2-kick + .m2-pickbox{margin-top:8px;max-width:560px}

.row100k .m2-big.m2-soon{font-size:clamp(44px,11vw,112px);text-transform:uppercase}

/* THE FINAL ORDER (2026-11-25): the total, then RAISED under it with the
 * small note; the receipts names are links to the math; one quiet line for
 * a rower in; one small JOIN M2D for a rower not in. */
.row100k .m2-head .m2-big + .m2-kick{margin-top:6px}
.row100k .m2-kick-q{font-weight:400;color:var(--gray)}
.row100k .m2-from dt a{color:inherit;text-decoration:none;border-bottom:1px dotted var(--gray)}
.row100k .m2-from dt a:hover{color:var(--water);border-bottom-color:var(--water)}
.row100k .m2-quietline{margin-top:22px;max-width:640px}
.row100k .m2-quietline p{font-family:var(--row-mono),monospace;font-size:11px;line-height:1.7;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.row100k .m2-quietline b{color:var(--water)}
.row100k .m2-join{margin-top:22px}
.row100k .m2-go.small{display:inline-block;width:auto;padding:10px 18px;font-size:15px}
.row100k .m2-faq{padding:16px 0 40px}
.row100k .m2-faq h2{margin-top:34px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(24px,6vw,36px);font-weight:400;line-height:1.05;text-transform:uppercase;color:var(--ink);scroll-margin-top:70px}
.row100k .m2-faq h2 i{font-style:normal;color:var(--water)}
.row100k .m2-faq p,.row100k .m2-faq li{margin-top:10px;max-width:640px;font-size:16px;line-height:1.55;color:var(--ink-soft)}
.row100k .m2-faq ul{margin:6px 0 0 18px;padding:0}
.row100k .m2-faq .sum{margin-top:14px;max-width:560px;border-top:2px solid var(--ink)}
.row100k .m2-faq .sum div{display:flex;justify-content:space-between;gap:16px;padding:9px 0 8px;border-bottom:1px solid var(--line);font-size:15px}
.row100k .m2-faq .sum dd{font-family:var(--row-mono),monospace;font-weight:700;color:var(--water)}
.row100k .m2-faq h3{margin-top:22px;font-size:17px;font-weight:700;color:var(--ink)}
.row100k .m2-faq h2.m2-sec{padding-bottom:8px;border-bottom:2px solid var(--ink)}
.row100k .m2-faq .m2-btn{display:inline-block;padding:10px 16px;background:var(--water);color:#fff;font-family:var(--row-archivo-black),sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:.03em;text-decoration:none}
.row100k .m2-in{width:7em;margin-left:6px;padding:6px 8px;border:1px solid var(--ink);border-radius:0;background:var(--paper);color:var(--ink);font-family:var(--row-mono),monospace;font-size:15px}

.row100k .m2-call{margin-top:34px;border:2px solid var(--ink);padding:22px 18px}
.row100k .m2-call h2{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8vw,56px);font-weight:400;line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink)}
.row100k .m2-call h2 i{font-style:normal;color:var(--water)}
.row100k .m2-lede{margin-top:14px;max-width:640px;font-size:16px;line-height:1.5;color:var(--ink-soft)}
.row100k .m2-call h3{margin-top:26px;font-family:var(--row-archivo-black),sans-serif;font-size:19px;font-weight:400;text-transform:uppercase;color:var(--ink)}
.row100k .m2-steps{list-style:none;margin:6px 0 0;padding:0}
.row100k .m2-steps li{display:grid;grid-template-columns:28px minmax(0,1fr);column-gap:12px;margin-top:14px}
.row100k .m2-steps .k{font-family:var(--row-archivo-black),sans-serif;font-size:20px;line-height:1.1;color:var(--water)}
.row100k .m2-steps b{font-size:16px;color:var(--ink)}
.row100k .m2-steps p{margin-top:2px;font-size:14px;line-height:1.45;color:var(--gray)}
.row100k .m2-note{margin-top:16px;font-family:var(--row-mono),monospace;font-size:10px;line-height:1.6;letter-spacing:.1em;text-transform:uppercase;color:var(--gray)}
.row100k .m2-yes{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 24px;margin-top:20px}
.row100k .m2-yes p{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--water)}

.row100k .m2 .bd-cols,.row100k .m2 .bd-in{grid-template-columns:26px minmax(0,1fr) 72px 64px}
.row100k .m2-usd{font-weight:700;color:var(--water)}
.row100k .m2-usd.off{font-weight:400;color:var(--gray);opacity:.7}
@media(min-width:640px){
  .row100k .m2-head{margin-top:38px}
  .row100k .m2-call{padding:30px 32px}
  .row100k .m2-picks{grid-template-columns:repeat(3,minmax(0,1fr))}
  .row100k .m2 .bd-cols,.row100k .m2 .bd-in{grid-template-columns:48px minmax(0,1fr) 140px 140px}
}

/* THE GIVING PAGE (give/page.tsx). */
.row100k .m2-give .m2-head{max-width:640px;margin-left:auto;margin-right:auto}
.row100k .m2-give-lede{margin-top:16px;font-size:16px;line-height:1.55;color:var(--ink);text-align:left}
.row100k .m2-give .m2-from,.row100k .m2-give .m2-worth,.row100k .m2-calc,.row100k .m2-give-est{font-weight:400;color:var(--gray);font-size:12px}
.row100k .m2-give-now dt small{display:block;margin-top:3px;font-family:var(--row-mono),monospace;font-size:10px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}
.row100k .m2-give-fine{max-width:560px;margin-left:auto;margin-right:auto}
.row100k .m2-give-now{margin-top:30px}
.row100k .m2-give-big{margin-top:14px;font-family:var(--row-archivo-black),sans-serif;font-size:24px;line-height:1.2;text-transform:uppercase}
.row100k .m2-give-big b{color:var(--water);font-weight:400}
.row100k .m2-give-small{margin-top:8px;font-size:14px;line-height:1.5;color:var(--gray)}
.row100k .m2-calc{margin-top:26px;border:2px solid var(--ink);padding:18px}
.row100k .m2-calc-q{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.row100k .m2-calc-by{display:flex;gap:8px}
.row100k .m2-calc-by button{flex:1;background:none;border:1px solid var(--ink);border-radius:0;padding:10px 8px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);cursor:pointer}
.row100k .m2-calc-by button.on{background:var(--ink);color:#fff}
.row100k .m2-calc-in{display:flex;align-items:baseline;gap:8px;margin-top:16px;border-bottom:2px solid var(--ink);padding-bottom:6px}
.row100k .m2-calc-in span{font-family:var(--row-archivo-black),sans-serif;font-size:30px;color:var(--gray)}
.row100k .m2-calc-in input{flex:1;min-width:0;border:0;outline:0;background:none;font-family:var(--row-archivo-black),sans-serif;font-size:44px;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .m2-calc-out div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.row100k .m2-calc-out dt{font-size:15px;font-weight:700}
.row100k .m2-calc-out dd{font-family:var(--row-mono),monospace;font-size:16px;font-weight:700;color:var(--ink)}
.row100k .m2-calc-out dd b{color:var(--water)}
.row100k .m2-give .m2-worth dl div{display:block}
.row100k .m2-give .m2-worth dt small{display:block;margin-top:3px;font-weight:400;font-size:13px;color:var(--gray)}
.row100k .m2-give .m2-worth dt a{color:var(--ink)}
.row100k .m2-give .m2-steps{margin-top:12px}
.row100k .m2-give .m2-steps a{color:var(--water);text-decoration:underline}
.row100k .m2-give-fine{margin-top:26px;font-family:var(--row-mono),monospace;font-size:10.5px;line-height:1.7;letter-spacing:.06em;color:var(--gray)}
.row100k .m2-give-fine a{color:var(--ink);text-decoration:underline}
`;
