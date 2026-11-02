import { Bungee, Barlow_Condensed } from "next/font/google";

/* THE PICKLEBALL LOOK (owner, 2026-11-02: a new slate — "lets try to
 * animate it where things make sense"): a night court. Deep court blue
 * ground, white court lines, the ball's neon as the one loud colour,
 * chunky display type. Scoped under .pb, classes prefixed .pb-.
 *
 * THE MOTION all lives here as CSS: the hero title rises word by word, a
 * ball bounces across the baseline, the OPTED IN stamp slams down, team
 * rows and bracket cards stagger in, a ready match pulses, the champion
 * banner shimmers, the score sheet slides up. Every bit of it dies under
 * prefers-reduced-motion.
 *
 * Rendered as the text child of a style tag: no double quotes, no
 * apostrophes, no angle brackets and no ampersands in this string (so no
 * content:"" — connector stubs are real spans, .pb-j). */

export const bungee = Bungee({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--pb-display",
});
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--pb-cond",
});

export const COURT = "#0E2A47";
export const NEON = "#DFFF3F";
export const LINE = "#F4F7F2";
export const DARK = "#0B1E33";

export const css = `
.pb,.pb *{margin:0;padding:0;box-sizing:border-box}
.pb{
  --ground:#0E2A47; --panel:#14395F; --panel-2:#1A4571; --line:#F4F7F2; --line-dim:rgba(244,247,242,.7); --mute:rgba(244,247,242,.45); --rule:rgba(244,247,242,.16); --ball:#DFFF3F; --ball-dim:#B8D32E; --dark:#0B1E33;
  background:var(--ground);color:var(--line);
  font-family:var(--pb-cond),sans-serif;font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased;
  min-height:100vh;min-height:100dvh;width:100%;color-scheme:dark;
}
@media (prefers-reduced-motion: reduce){ .pb *{transition:none!important;animation:none!important} .pb h1 .wi{transform:none!important} .pb .pb-ball{display:none} }
.pb a{color:inherit}
.pb button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;border-radius:0;-webkit-tap-highlight-color:transparent}
.pb :focus-visible{outline:2px solid var(--ball);outline-offset:3px}
.pb .wrap{max-width:760px;margin:0 auto;padding-left:20px;padding-right:20px}
.pb p,.pb h1,.pb h2,.pb h3,.pb h4{font-family:inherit;font-size:inherit;line-height:inherit;color:inherit;text-wrap:initial}
/* The site globals paint em in the shop accent; here it is plain type. */
.pb em{font-style:normal;color:inherit}
.pb .disp{font-family:var(--pb-display),Impact,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.01em}

/* -------------------------------------------------------- the motion */
@keyframes pbRise{from{transform:translateY(110%)}to{transform:translateY(0)}}
@keyframes pbSlide{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
@keyframes pbPop{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:none}}
@keyframes pbStamp{0%{opacity:0;transform:scale(2.6) rotate(-18deg)}60%{opacity:1}100%{opacity:1;transform:scale(1) rotate(-5deg)}}
@keyframes pbGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes pbPulse{0%,100%{box-shadow:0 0 0 0 rgba(223,255,63,.45)}50%{box-shadow:0 0 0 7px rgba(223,255,63,0)}}
@keyframes pbShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes pbUp{from{transform:translateY(102%)}to{transform:translateY(0)}}
@keyframes pbFade{from{opacity:0}to{opacity:1}}
@keyframes pbFlash{0%{background:rgba(223,255,63,.35)}100%{background:transparent}}
@keyframes pbBallX{0%{left:-6%}100%{left:103%}}
@keyframes pbBallY{0%{transform:translateY(-240px) scale(1)}92%{transform:translateY(-4px) scale(1)}100%{transform:translateY(0) scaleY(.78) scaleX(1.12)}}
@keyframes pbSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}

/* ------------------------------------------------------------ the bar */
.pb .pb-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 20px;border-bottom:2px solid var(--ball);position:sticky;top:0;background:var(--ground);z-index:50}
.pb .pb-wm{font-family:var(--pb-display),Impact,sans-serif;font-size:19px;letter-spacing:.08em;text-transform:uppercase;line-height:1;text-decoration:none;color:var(--ball)}
.pb .pb-wm small{display:block;font-family:var(--pb-cond),sans-serif;font-size:11px;letter-spacing:.24em;color:var(--line-dim);margin-top:4px;font-weight:600}
.pb .pb-bar nav{display:flex;gap:8px}
.pb .pb-chip{border:2px solid var(--line);background:transparent;color:var(--line);font-size:11px;font-weight:700;letter-spacing:.12em;line-height:16px;text-transform:uppercase;padding:5px 11px;cursor:pointer;white-space:nowrap;text-decoration:none}
.pb .pb-chip:hover{border-color:var(--ball);color:var(--ball)}

/* The baseline stripe: court lines. */
.pb .pb-stripe{height:8px;background:repeating-linear-gradient(90deg,var(--line) 0 26px,var(--ground) 26px 52px);opacity:.9}

/* ----------------------------------------------------------- the hero */
.pb .pb-hero{position:relative;overflow:hidden;padding-bottom:70px}
.pb .pb-crumb{font-size:12px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:var(--ball);padding-top:40px}
.pb h1{font-size:clamp(46px,12.5vw,104px);line-height:.98;margin-top:14px}
.pb h1 .w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.06em;margin-bottom:-.06em}
.pb h1 .wi{display:inline-block;font-style:normal;transform:translateY(110%);animation:pbRise .7s cubic-bezier(.2,.9,.25,1) forwards;animation-delay:var(--d,0ms)}
.pb h1 .yr{display:inline-block;background:var(--ball);color:var(--dark);padding:0 .14em;line-height:1.08;margin-top:.06em}
.pb .pb-tag{font-size:clamp(20px,5vw,28px);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:20px;line-height:1.15;color:var(--ball);opacity:0;animation:pbFade .6s .5s forwards}
.pb .pb-lede{margin-top:14px;font-size:17px;line-height:1.65;color:var(--line-dim);max-width:36em;opacity:0;animation:pbFade .6s .65s forwards}
.pb .pb-ball{position:absolute;bottom:2px;left:-6%;width:34px;height:34px;pointer-events:none;animation:pbBallX 8s linear infinite}
.pb .pb-ball i{display:block;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f2ff9e,var(--ball) 55%,#93aa17);animation:pbBallY 1.6s cubic-bezier(.45,0,.8,1) infinite alternate}
.pb .pb-baseline{position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--line);opacity:.5}

/* THE FACTS. */
.pb .pb-facts{display:grid;grid-template-columns:repeat(3,1fr);border-top:2px solid var(--line);border-bottom:1px solid var(--rule);margin-top:34px}
.pb .pb-fact{padding:14px 0;opacity:0;animation:pbFade .5s both;animation-delay:calc(.5s + var(--i,0)*120ms)}
.pb .pb-fact + .pb-fact{border-left:1px solid var(--rule);padding-left:16px}
.pb .pb-fact .k{font-size:11px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--mute)}
.pb .pb-fact .v{font-family:var(--pb-display),Impact,sans-serif;font-size:24px;line-height:1.1;margin-top:6px;text-transform:uppercase}
.pb .pb-fact .v small{display:block;font-family:var(--pb-cond),sans-serif;font-size:12px;font-weight:500;color:var(--line-dim);margin-top:4px;letter-spacing:.06em;text-transform:none}

/* THE SECTIONS. */
.pb section{padding-top:52px}
.pb .pb-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-bottom:3px solid var(--ball);padding-bottom:8px}
.pb .pb-head h2{font-size:clamp(28px,7vw,44px);line-height:1}
.pb .pb-head span{font-size:12px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--mute);white-space:nowrap}
.pb .pb-err{margin-top:16px;font-size:14px;font-weight:600;letter-spacing:.04em;color:var(--ball)}
.pb .pb-hint{font-size:13px;color:var(--mute);margin-top:8px;line-height:1.5}
.pb .pb-empty{margin-top:24px;color:var(--mute)}

/* THE FORM. */
.pb .pb-form label.fl{display:block;font-size:11px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--mute);margin:24px 0 6px}
.pb .pb-form input[type=text]{width:100%;background:var(--panel);border:1px solid var(--rule);color:var(--line);font-family:var(--pb-cond),sans-serif;font-size:19px;font-weight:500;padding:12px 12px;border-radius:0;appearance:none;transition:border-color 140ms ease,transform 140ms ease}
.pb .pb-form input:focus{outline:none;border-color:var(--ball)}
.pb .pb-form input::placeholder{color:var(--mute);font-weight:400}
.pb .pb-form .two{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
.pb .pb-seg{display:flex;flex-wrap:wrap;gap:6px}
.pb .pb-seg button{flex:1 1 auto;min-width:72px;border:1px solid var(--rule);background:var(--panel);color:var(--line-dim);font-family:var(--pb-display),Impact,sans-serif;font-size:14px;letter-spacing:.06em;text-transform:uppercase;padding:12px 10px;transition:all 140ms ease}
.pb .pb-seg button:hover{border-color:var(--line);color:var(--line);transform:translateY(-2px)}
.pb .pb-seg button[aria-pressed=true]{background:var(--ball);border-color:var(--ball);color:var(--dark)}
.pb .pb-cta{display:block;width:100%;margin-top:28px;background:var(--ball);color:var(--dark);text-align:center;font-family:var(--pb-display),Impact,sans-serif;font-size:17px;letter-spacing:.08em;text-transform:uppercase;padding:18px 16px;text-decoration:none;transition:transform 140ms cubic-bezier(.2,1.4,.4,1),background 140ms ease}
.pb .pb-cta:hover{background:#ecff7a;transform:translateY(-2px)}
.pb .pb-cta:active{transform:translateY(0) scale(.99)}
.pb .pb-cta:disabled{background:#33455a;color:var(--mute);cursor:default;transform:none}
.pb .pb-cta.quiet{background:transparent;border:2px solid var(--rule);color:var(--line-dim);margin-top:12px}
.pb .pb-cta.quiet:hover{border-color:var(--line);color:var(--line)}
.pb .pb-cta.small{width:auto;display:inline-block;padding:10px 16px;font-size:14px;margin-top:0}

/* THE CONFIRMATION, stamped. */
.pb .pb-done{margin-top:30px;border-top:2px solid var(--line);padding-top:26px}
.pb .pb-stamp{display:inline-block;border:6px double var(--ball);color:var(--ball);font-family:var(--pb-display),Impact,sans-serif;font-size:clamp(30px,8vw,52px);letter-spacing:.06em;text-transform:uppercase;line-height:1;padding:14px 24px;transform:rotate(-5deg);animation:pbStamp .55s cubic-bezier(.2,2.2,.4,1) both}
.pb .pb-done p{margin-top:18px;color:var(--line-dim);line-height:1.6}
.pb .pb-done p b{color:var(--line)}

/* THE TEAMS. */
.pb .pb-teams{margin-top:22px;display:grid;gap:10px}
.pb .pb-team{display:flex;align-items:center;gap:14px;background:var(--panel);border:1px solid var(--rule);border-left:4px solid var(--ball);padding:12px 14px;animation:pbSlide .5s both;animation-delay:calc(var(--i,0)*60ms)}
.pb .pb-team .n{flex:none;font-family:var(--pb-display),Impact,sans-serif;font-size:15px;color:var(--mute);min-width:30px}
.pb .pb-team .who{flex:1 1 auto;min-width:0;font-family:var(--pb-display),Impact,sans-serif;font-size:17px;letter-spacing:.03em;text-transform:uppercase;line-height:1.25}
.pb .pb-team .who .amp{color:var(--ball);padding:0 .3em}
.pb .pb-team .lvl{flex:none;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--dark);background:var(--line);padding:3px 8px}
.pb .pb-team .out{flex:none;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--mute)}
.pb .pb-team.gone .who{color:var(--mute);text-decoration:line-through}

/* THE BRACKET. */
.pb .pb-sub{font-size:12px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--ball);margin-top:30px}
.pb .pb-scroll{overflow-x:auto;margin-top:14px;padding-bottom:10px;-webkit-overflow-scrolling:touch}
.pb .pb-grid{display:flex;gap:26px;min-width:min-content}
.pb .pb-col{display:grid;gap:10px;min-width:210px;align-content:stretch}
.pb .pb-col .rh{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);align-self:end}
.pb .pb-m{position:relative;background:var(--panel);border:1px solid var(--rule);padding:8px 10px;animation:pbPop .45s both;animation-delay:calc(var(--i,0)*50ms);align-self:center;width:100%}
.pb .pb-m .ml{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--mute);margin-bottom:4px;display:flex;justify-content:space-between;gap:8px}
.pb .pb-m .ml em{font-style:normal;color:var(--ball)}
.pb .pb-m .t{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-family:var(--pb-display),Impact,sans-serif;font-size:14px;letter-spacing:.02em;text-transform:uppercase;line-height:1.5}
.pb .pb-m .t .nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb .pb-m .t .sc{flex:none;font-size:15px}
.pb .pb-m .t.win{color:var(--ball)}
.pb .pb-m .t.dim .nm{color:var(--mute);font-family:var(--pb-cond),sans-serif;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:none}
.pb .pb-m.ready{border-color:var(--ball);cursor:pointer;animation:pbPop .45s both,pbPulse 2.2s 1s infinite}
.pb .pb-m.ready:hover{background:var(--panel-2)}
.pb .pb-m.played{border-left:3px solid var(--ball)}
.pb .pb-m.fresh{animation:pbPop .45s both,pbFlash 1.2s .3s both}
.pb .pb-m .fix{position:absolute;right:6px;bottom:4px;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--mute)}
.pb .pb-m:hover .fix{color:var(--ball)}
.pb .pb-j{position:absolute;right:-27px;top:50%;width:26px;height:2px;background:var(--rule);transform:scaleX(0);transform-origin:left;animation:pbGrow .5s .4s forwards}

/* THE CHAMPIONS. */
.pb .pb-champ{margin-top:26px;background:var(--ball);color:var(--dark);padding:20px 18px;position:relative;overflow:hidden}
.pb .pb-champ .k{font-size:12px;font-weight:700;letter-spacing:.3em;text-transform:uppercase}
.pb .pb-champ .v{font-family:var(--pb-display),Impact,sans-serif;font-size:clamp(26px,7vw,44px);line-height:1.05;text-transform:uppercase;margin-top:6px}
.pb .pb-champ .sheen{position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.5) 50%,transparent 65%);background-size:200% 100%;animation:pbShimmer 2.8s linear infinite;pointer-events:none}

/* THE SCORE SHEET: slides up from the baseline. */
.pb .pb-dim{position:fixed;inset:0;background:rgba(4,10,18,.65);z-index:90;animation:pbFade .25s both}
.pb .pb-sheet{position:fixed;left:0;right:0;bottom:0;z-index:91;background:var(--panel);border-top:3px solid var(--ball);padding:20px 20px 28px;animation:pbUp .35s cubic-bezier(.2,.9,.25,1) both;max-width:560px;margin:0 auto}
.pb .pb-sheet h3{font-family:var(--pb-display),Impact,sans-serif;font-size:19px;text-transform:uppercase;letter-spacing:.03em}
.pb .pb-sheet .mk{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);margin-top:2px}
.pb .pb-sheet .row{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px}
.pb .pb-sheet .row .nm{flex:1 1 auto;min-width:0;font-family:var(--pb-display),Impact,sans-serif;font-size:16px;text-transform:uppercase;line-height:1.3}
.pb .pb-sheet .row input{flex:none;width:86px;background:var(--panel-2);border:1px solid var(--rule);color:var(--line);font-family:var(--pb-display),Impact,sans-serif;font-size:26px;text-align:center;padding:8px 6px;border-radius:0;appearance:none}
.pb .pb-sheet .row input:focus{outline:none;border-color:var(--ball)}
.pb .pb-sheet label.fl{display:block;font-size:11px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--mute);margin:18px 0 6px}
.pb .pb-sheet input.by{width:100%;background:var(--panel-2);border:1px solid var(--rule);color:var(--line);font-family:var(--pb-cond),sans-serif;font-size:16px;padding:10px 12px;border-radius:0;appearance:none}
.pb .pb-sheet input.by:focus{outline:none;border-color:var(--ball)}
.pb .pb-sheet .btns{display:flex;gap:10px;margin-top:20px}
.pb .pb-sheet .btns button{flex:1 1 auto;border:2px solid var(--line);font-family:var(--pb-display),Impact,sans-serif;font-size:15px;letter-spacing:.06em;text-transform:uppercase;padding:12px 14px}
.pb .pb-sheet .btns button.primary{background:var(--ball);border-color:var(--ball);color:var(--dark)}
.pb .pb-sheet .btns button:disabled{opacity:.5;cursor:default}

/* THE OWNER PANEL. */
.pb .pb-admin{margin-top:22px;border:1px dashed var(--rule);padding:16px}
.pb .pb-admin .ah{font-size:11px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--mute)}
.pb .pb-admin .srow{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--rule)}
.pb .pb-admin .srow input{width:56px;background:var(--panel);border:1px solid var(--rule);color:var(--line);font-family:var(--pb-display),Impact,sans-serif;font-size:16px;text-align:center;padding:6px 4px;border-radius:0;appearance:none}
.pb .pb-admin .srow input:focus{outline:none;border-color:var(--ball)}
.pb .pb-admin .srow .who{flex:1 1 auto;min-width:0;font-family:var(--pb-display),Impact,sans-serif;font-size:14px;text-transform:uppercase}
.pb .pb-admin .srow button{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--mute);border-bottom:2px solid var(--rule);padding-bottom:1px}
.pb .pb-admin .srow button:hover{color:var(--ball);border-color:var(--ball)}
.pb .pb-admin .abtns{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
.pb .pb-admin .abtns button{border:2px solid var(--line);font-family:var(--pb-display),Impact,sans-serif;font-size:14px;letter-spacing:.06em;text-transform:uppercase;padding:10px 16px}
.pb .pb-admin .abtns button.primary{background:var(--ball);border-color:var(--ball);color:var(--dark)}
.pb .pb-admin .abtns button:disabled{opacity:.5;cursor:default}

/* THE STICKERS. */
.pb .pb-stk{margin-top:22px;background:var(--panel);border:1px solid var(--rule);padding:16px}
.pb .pb-stk-pick{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.pb .pb-stk-pick button{border:1px solid var(--rule);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;padding:8px 12px;color:var(--line-dim)}
.pb .pb-stk-pick button[aria-pressed=true]{background:var(--line);color:var(--dark);border-color:var(--line)}
.pb .pb-stk-pick.looks{flex-wrap:nowrap}
.pb .pb-stk-pick.looks button{flex:1 1 0;min-width:0;padding:7px 4px;font-size:10px;letter-spacing:.1em;line-height:1.25;white-space:normal}
.pb .pb-stk canvas{display:block;width:100%;max-width:420px;height:auto;margin:0 auto}
.pb .pb-stk canvas.clear{background:repeating-conic-gradient(#1a3a5e 0 25%,#12304e 0 50%) 0 0/24px 24px}
.pb .pb-stk-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pb .pb-stk-btns button{flex:1 1 auto;border:2px solid var(--line);font-family:var(--pb-display),Impact,sans-serif;font-size:14px;letter-spacing:.08em;text-transform:uppercase;padding:11px 14px}
.pb .pb-stk-btns button.primary{background:var(--ball);border-color:var(--ball);color:var(--dark)}
.pb .pb-stk-btns button:hover{border-color:var(--ball)}
.pb .pb-stk-msg{margin-top:10px;font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--line-dim);min-height:1.4em}
.pb .pb-probe{position:absolute;left:-9999px;top:0;visibility:hidden}
.pb .pb-probe.d{font-family:var(--pb-display),Impact,sans-serif}
.pb .pb-probe.c{font-family:var(--pb-cond),sans-serif}

/* THE FOOT. */
.pb footer{margin-top:64px;border-top:1px solid var(--rule);padding:30px 20px 56px}
.pb footer .wrap{max-width:760px;margin:0 auto}
.pb footer .big{font-family:var(--pb-display),Impact,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px;color:var(--line)}
.pb footer p.mono{font-family:var(--pb-cond),sans-serif;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);line-height:2}
.pb footer a{color:var(--line);text-decoration:none;border-bottom:2px solid var(--ball)}
.pb footer a:hover{color:var(--ball)}

@media(max-width:460px){
  .pb .pb-form .two{grid-template-columns:1fr}
  .pb .pb-facts{grid-template-columns:1fr}
  .pb .pb-fact + .pb-fact{border-left:0;padding-left:0;border-top:1px solid var(--rule)}
  .pb .pb-sheet .row input{width:72px}
}
`;
