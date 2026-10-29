/* /lasd26/your-share — PAY WHAT YOU'RE ABLE, step by step (owner, 2026-10-28
 * and 29; the brief is in page.tsx). A BARE page: not LasdPage, no bar,
 * no site footer. Ink, lime type, the brand's lime (#D0F858, theme.ts
 * --safety) as TYPE — on ink it may be — with the small lines at reduced
 * opacity so they read softer than the one big number. Four screens in one
 * column: the marks and SIGN IN on top, the screen in the middle, the four
 * dashes and LASD26 at the foot, nothing under it. The fonts are the site's (theme.ts
 * variables, set on the wrapper by the page). */

export const payAbleCss = `
.lasd-pay,.lasd-pay *{margin:0;padding:0;box-sizing:border-box}
.lasd-pay{
  --ink:#111110; --paper:#F4F3EE; --lime:#D0F858; --lime-hover:#DFFF78; --red:#DE0614; --warn:#ff8a5c;
  min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;
  background:var(--ink);color:var(--lime);
  font-family:var(--lasd-archivo),sans-serif;font-size:16px;line-height:1.5;
  -webkit-font-smoothing:antialiased;color-scheme:dark;
}
.lasd-pay .mono{font-family:var(--lasd-mono),monospace}
.lasd-pay ::selection{background:var(--lime);color:#111}
.lasd-pay :focus-visible{outline:2px solid var(--lime);outline-offset:3px}
/* The one link on the screens — the total, to the expenses sheet (owner,
 * 2026-10-29: "link to the expenses sheet on the total"): the line's own
 * lime, an underline the only tell. */
.lasd-pay a{color:inherit;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px}
.lasd-pay a:hover{color:var(--paper)}
@media (prefers-reduced-motion: reduce){ .lasd-pay *{animation:none!important;transition:none!important} .lasd-pay .art .run{stroke-dashoffset:0} }

/* ─── THE TOP: the two marks (type, like the stickers) and the one control ─── */
.lasd-pay .top,.lasd-pay .dots,.lasd-pay .foot{position:relative;z-index:1}
.lasd-pay .top{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 20px;max-width:760px;width:100%;margin:0 auto}
.lasd-pay .marks{display:flex;align-items:baseline;gap:12px;font-family:var(--lasd-archivo-black),sans-serif;font-size:13px;letter-spacing:.03em;color:var(--paper);white-space:nowrap}
.lasd-pay .marks .ns{text-transform:uppercase}
.lasd-pay .marks .arrow{color:var(--red);font-family:var(--lasd-archivo),sans-serif;font-weight:700;margin-left:.1em}
.lasd-pay .marks .x{font-family:var(--lasd-archivo),sans-serif;font-weight:700;opacity:.5;font-size:12px}
.lasd-pay .marks .jf{text-transform:lowercase;letter-spacing:-.01em}
.lasd-pay .marks .dot{display:inline-block;width:.3em;height:.3em;border-radius:50%;background:var(--lime);margin-left:.1em;vertical-align:baseline}
.lasd-pay .signin{background:transparent;border:2px solid var(--lime);color:var(--lime);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:9px 14px;cursor:pointer;white-space:nowrap}
.lasd-pay .signin:hover{background:var(--lime);color:#111}
.lasd-pay .who{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;white-space:nowrap}

/* ─── THE STAGE: one screen at a time, vertically centred ─── */
.lasd-pay .stage{flex:1;position:relative;display:flex;flex-direction:column;justify-content:center;max-width:760px;width:100%;margin:0 auto;padding:28px 20px 32px}
.lasd-pay .step{position:relative;z-index:1}
.lasd-pay h1{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(30px,7.4vw,58px);line-height:.98;letter-spacing:-.02em;text-transform:uppercase;color:var(--lime);max-width:19ch}
.lasd-pay .line{margin-top:18px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--lime);opacity:.75;line-height:1.8;max-width:52ch}
/* WHAT THEY ALREADY COVERED (screen 1): paper type, the sum in lime. */
.lasd-pay .note{margin-top:18px;max-width:46ch;font-size:15px;line-height:1.6;color:var(--paper)}
.lasd-pay .note b{color:var(--lime);font-weight:700}
.lasd-pay .k{margin-top:30px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--lime);opacity:.6}
.lasd-pay .big{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(64px,19vw,132px);line-height:.95;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--lime);margin-top:4px;word-break:break-word}

/* THE FIELD (screen 2), the one big number there: typed, a $ in front, a lime rule under. */
.lasd-pay .field{display:flex;align-items:baseline;gap:.06em;margin-top:28px;max-width:440px;border-bottom:3px solid var(--lime);font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(56px,16vw,120px);line-height:1.05;letter-spacing:-.03em;color:var(--lime)}
.lasd-pay .field .cur{font-size:.55em;align-self:center;transform:translateY(-.06em)}
.lasd-pay .field input{flex:1 1 auto;min-width:0;width:100%;background:transparent;border:none;border-radius:0;appearance:none;-moz-appearance:textfield;color:var(--lime);font:inherit;letter-spacing:inherit;font-variant-numeric:tabular-nums;padding:.04em 0 .02em;caret-color:var(--lime)}
.lasd-pay .field input::-webkit-outer-spin-button,.lasd-pay .field input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.lasd-pay .field input:focus{outline:none}
.lasd-pay .field.bad{border-bottom-color:var(--warn)}

/* THE BUTTONS: CONTINUE / PAY BY CARD solid lime; BACK a small mono word. */
.lasd-pay .btn{display:inline-flex;justify-content:center;align-items:center;min-width:min(100%,320px);margin-top:30px;background:var(--lime);color:#111;border:none;font-family:var(--lasd-archivo-black),sans-serif;font-size:18px;text-transform:uppercase;letter-spacing:.04em;padding:18px 28px;cursor:pointer;text-align:center}
.lasd-pay .btn:hover{background:var(--lime-hover)}
.lasd-pay .btn:disabled{background:#2a2a28;color:#6f6f6a;cursor:default}
.lasd-pay .back{display:block;margin-top:22px;background:none;border:none;color:var(--lime);opacity:.55;font-size:11px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;padding:6px 0}
.lasd-pay .back:hover{opacity:1}
.lasd-pay .paypal{margin-top:14px;max-width:440px}
/* While PayPal's form is opening or the capture runs the button goes quiet
 * (it must stay mounted) and the STATUS block speaks: one mono line over a
 * lime bar that slides until the answer comes. */
.lasd-pay .paypal.busy{opacity:.3;pointer-events:none}
/* On the amount screen the button is already mounted, offscreen, so it is
 * drawn by the time the pay screen opens. */
.lasd-pay .paypal.off{position:absolute;left:-9999px;top:0;width:440px;visibility:hidden}
.lasd-pay .status{margin-top:28px;max-width:440px;display:flex;flex-direction:column;gap:14px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--lime)}
.lasd-pay .status .bar{display:block;height:3px;background:rgba(208,248,88,.18);position:relative;overflow:hidden}
.lasd-pay .status .bar::after{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;background:var(--lime);animation:lasd-slide 1.2s ease-in-out infinite}
@keyframes lasd-slide{to{left:100%}}
.lasd-pay .err{margin-top:14px;font-size:12px;color:var(--warn);line-height:1.7;border-left:3px solid var(--warn);padding-left:11px;max-width:52ch}
.lasd-pay .notice{margin-top:28px;border:2px dashed var(--lime);padding:20px 22px;max-width:480px;color:var(--paper);font-size:15px;line-height:1.6}

/* ─── THE ROUTE, drawing itself behind the first screen ─── */
/* The box is the viewport, the drawing its full height (owner, 2026-10-29:
 * "draw the route from top to bottom"): routeArt.ts draws the course in a
 * tall box, so it fits the height and sits at the right of a laptop and
 * across a phone. Fixed, behind everything (the top, the dashes and the
 * foot sit above it). */
.lasd-pay .art{position:fixed;inset:0;display:flex;justify-content:flex-end;align-items:stretch;pointer-events:none;opacity:.4;z-index:0}
.lasd-pay .art svg{height:100%;width:56%;overflow:visible}
/* No vector-effect here: with non-scaling-stroke Chrome lays the dash in
 * screen space and pathLength="1" no longer means the whole path, so the
 * line came out dotted on a laptop and vanished on a phone. The width is
 * in viewBox units (~900 wide) and scales with the drawing. */
.lasd-pay .art .run{fill:none;stroke:var(--lime);stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:lasd-draw 6s cubic-bezier(.45,0,.2,1) forwards}
@keyframes lasd-draw{to{stroke-dashoffset:0}}
@media(max-width:640px){ .lasd-pay .art{opacity:.32} .lasd-pay .art svg{width:100%} }

/* ─── RECOVERED (/lasd26/recovered): who paid, a list, so the stage starts at the top ─── */
.lasd-pay .stage.list{justify-content:flex-start}
.lasd-pay .paid{list-style:none;margin-top:28px;max-width:520px;border-top:1px solid rgba(208,248,88,.25)}
.lasd-pay .paid li{display:grid;grid-template-columns:1fr auto;gap:2px 16px;padding:12px 0;border-bottom:1px solid rgba(208,248,88,.25);align-items:baseline}
.lasd-pay .paid .who{font-size:16px;color:var(--paper)}
.lasd-pay .paid .amt{font-family:var(--lasd-archivo-black),sans-serif;font-size:20px;font-variant-numeric:tabular-nums;color:var(--lime);text-align:right}
.lasd-pay .paid .when{grid-column:1 / -1;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--lime);opacity:.55}
.lasd-pay .names{margin-top:8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--lime);opacity:.55;line-height:1.9;max-width:520px}

/* ─── THE FOOT: the four dashes, then LASD26 (owner: "I like LASD26 being the footer") ─── */
.lasd-pay .dots{display:flex;gap:6px;max-width:760px;width:100%;margin:0 auto;padding:0 20px 22px}
.lasd-pay .dots i{display:block;width:24px;height:3px;background:var(--lime);opacity:.22}
.lasd-pay .dots i.on{opacity:1}
.lasd-pay .foot{max-width:760px;width:100%;margin:0 auto;padding:0 20px 24px}
.lasd-pay .foot .wm{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(40px,10vw,72px);line-height:.9;letter-spacing:-.02em;color:var(--lime)}
`;
