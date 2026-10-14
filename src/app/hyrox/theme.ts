import { Anton, Barlow_Condensed } from "next/font/google";

/* THE HYROX LOOK (owner, 2026-10-13: "make it Hyrox like style"): black
 * ground, the race's yellow, heavy condensed uppercase type, hard edges,
 * no rounded corners. Their logo is theirs and is not drawn here; the
 * word HYROX is set in type, the way the event is named. Scoped under
 * .hx. Prefix the classes .hx-.
 *
 * Rendered as the text child of a style tag: no double quotes, no
 * apostrophes, no angle brackets and no ampersands in this string. */

export const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--hx-display",
});
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--hx-cond",
});

export const YELLOW = "#FFED00";
export const BLACK = "#0A0A0A";

export const css = `
.hx,.hx *{margin:0;padding:0;box-sizing:border-box}
.hx{
  --ground:#0A0A0A; --panel:#141414; --panel-2:#1C1C1C; --white:#F4F4F0; --white-dim:rgba(244,244,240,.7); --mute:rgba(244,244,240,.45); --rule:rgba(244,244,240,.16); --yellow:#FFED00; --yellow-dim:#D9C900;
  background:var(--ground);color:var(--white);
  font-family:var(--hx-cond),sans-serif;font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased;
  min-height:100vh;min-height:100dvh;width:100%;color-scheme:dark;
}
@media (prefers-reduced-motion: reduce){ .hx *{transition:none!important;animation:none!important} }
.hx a{color:inherit}
.hx button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;border-radius:0;-webkit-tap-highlight-color:transparent}
.hx :focus-visible{outline:2px solid var(--yellow);outline-offset:3px}
.hx .wrap{max-width:720px;margin:0 auto;padding-left:20px;padding-right:20px}
/* The site globals style p, h1-h3 and inputs by element; everything here
 * inherits the ground instead. */
.hx p,.hx h1,.hx h2,.hx h3,.hx h4{font-family:inherit;font-size:inherit;line-height:inherit;color:inherit;text-wrap:initial}
.hx .disp{font-family:var(--hx-display),Impact,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.01em}
.hx .y{color:var(--yellow)}

/* THE BAR, the Rowtember way: the wordmark on the left, chips on the
 * right (owner, 2026-10-13: really similar to the Rowtember and LASD
 * headers). Sticky, black, a rule under it. */
.hx .hx-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 20px;border-bottom:2px solid var(--yellow);position:sticky;top:0;background:var(--ground);z-index:50}
.hx .hx-wm{font-family:var(--hx-display),Impact,sans-serif;font-size:22px;letter-spacing:.12em;text-transform:uppercase;line-height:1;text-decoration:none;color:var(--yellow)}
.hx .hx-wm small{display:block;font-family:var(--hx-cond),sans-serif;font-size:11px;letter-spacing:.24em;color:var(--white-dim);margin-top:4px;font-weight:600}
.hx .hx-acct{display:flex;align-items:center;gap:8px;white-space:nowrap}
.hx .hx-acct .who{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);overflow:hidden;text-overflow:ellipsis;max-width:34vw;margin-right:6px}
.hx .hx-chip{border:2px solid var(--white);background:transparent;color:var(--white);font-family:var(--hx-cond),sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;line-height:16px;text-transform:uppercase;padding:5px 11px;cursor:pointer;white-space:nowrap;text-decoration:none}
.hx .hx-chip:hover{border-color:var(--yellow);color:var(--yellow)}

/* THE HERO: a yellow stripe, the city huge, the year in a black box. */
.hx .hx-stripe{height:8px;background:repeating-linear-gradient(135deg,var(--yellow) 0 18px,var(--ground) 18px 28px)}
.hx .hx-crumb{font-size:12px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:var(--yellow);padding-top:40px}
.hx h1{font-size:clamp(60px,15vw,120px);line-height:.9;margin-top:14px}
.hx h1 .yr{display:inline-block;background:var(--yellow);color:var(--ground);padding:0 .12em;line-height:1;margin-top:.08em}
.hx .hx-tag{font-size:clamp(22px,5.5vw,30px);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:22px;line-height:1.15;color:var(--yellow)}
.hx .hx-lede{margin-top:16px;font-size:17px;line-height:1.65;color:var(--white-dim);max-width:36em}
.hx .hx-lede b{color:var(--white);font-weight:700}

/* THE FACTS: a ruled grid. */
.hx .hx-facts{display:grid;grid-template-columns:repeat(3,1fr);border-top:2px solid var(--white);border-bottom:1px solid var(--rule);margin-top:34px}
.hx .hx-fact{padding:14px 0}
.hx .hx-fact + .hx-fact{border-left:1px solid var(--rule);padding-left:16px}
.hx .hx-fact .k{font-size:11px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--mute)}
.hx .hx-fact .v{font-family:var(--hx-display),Impact,sans-serif;font-size:26px;line-height:1.1;margin-top:6px;text-transform:uppercase}
.hx .hx-fact .v small{display:block;font-family:var(--hx-cond),sans-serif;font-size:12px;font-weight:500;color:var(--white-dim);margin-top:4px;letter-spacing:.06em;text-transform:none}

/* THE YELLOW BAR: one call to action. */
.hx .hx-cta{display:block;width:100%;margin-top:28px;background:var(--yellow);color:var(--ground);text-align:center;font-family:var(--hx-display),Impact,sans-serif;font-size:18px;letter-spacing:.1em;text-transform:uppercase;padding:18px 16px;text-decoration:none;transition:background 140ms ease}
.hx .hx-cta:hover{background:#fff27a}
.hx .hx-cta:disabled{background:#3a3a2a;color:var(--mute);cursor:default}
.hx .hx-cta.quiet{background:transparent;border:2px solid var(--rule);color:var(--white-dim);margin-top:12px}
.hx .hx-cta.quiet:hover{border-color:var(--white);color:var(--white)}
.hx .hx-cta.small{width:auto;display:inline-block;padding:10px 16px;font-size:14px;margin-top:0}

/* THE SECTION HEAD. */
.hx section{padding-top:52px}
.hx .hx-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-bottom:3px solid var(--yellow);padding-bottom:8px}
.hx .hx-head h2{font-size:clamp(34px,8vw,52px);line-height:1}
.hx .hx-head span{font-size:12px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--mute);white-space:nowrap}

/* THE FORM. */
.hx .hx-form label.fl{display:block;font-size:11px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--mute);margin:24px 0 6px}
.hx .hx-form label.fl i{font-style:normal;color:var(--yellow)}
.hx .hx-form input[type=text],.hx .hx-form input[type=email]{width:100%;background:var(--panel);border:1px solid var(--rule);color:var(--white);font-family:var(--hx-cond),sans-serif;font-size:19px;font-weight:500;padding:12px 12px;border-radius:0;appearance:none}
.hx .hx-form input:focus{outline:none;border-color:var(--yellow)}
.hx .hx-form input::placeholder{color:var(--mute);font-weight:400}
.hx .hx-form .two{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
.hx .hx-hint{font-size:13px;color:var(--mute);margin-top:8px;line-height:1.5}
.hx .hx-err{margin-top:16px;font-size:14px;font-weight:600;letter-spacing:.04em;color:var(--yellow)}

/* THE PICKS: a row of hard-edged segments, the chosen one yellow. */
.hx .hx-seg{display:flex;flex-wrap:wrap;gap:6px}
.hx .hx-seg button{flex:1 1 auto;min-width:88px;border:1px solid var(--rule);background:var(--panel);color:var(--white-dim);font-family:var(--hx-display),Impact,sans-serif;font-size:16px;letter-spacing:.08em;text-transform:uppercase;padding:12px 12px;transition:background 120ms ease,color 120ms ease,border-color 120ms ease}
.hx .hx-seg button:hover{border-color:var(--white);color:var(--white)}
.hx .hx-seg button[aria-pressed=true]{background:var(--yellow);border-color:var(--yellow);color:var(--ground)}
.hx .hx-seg.days button{flex-direction:column}
.hx .hx-seg button small{display:block;font-family:var(--hx-cond),sans-serif;font-size:11px;font-weight:600;letter-spacing:.14em;margin-top:2px;opacity:.8}

/* THE CONFIRMATION. */
.hx .hx-done{margin-top:30px;border-top:2px solid var(--white);padding-top:22px}
.hx .hx-done h3{font-size:clamp(34px,9vw,56px);line-height:.95}
.hx .hx-done p{margin-top:14px;color:var(--white-dim);line-height:1.6}
.hx .hx-done p b{color:var(--white)}

/* MY RACES: the entries this account has on the board. */
.hx .hx-mine{margin-top:22px;display:grid;gap:10px}
.hx .hx-mine-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--panel);border:1px solid var(--rule);border-left:4px solid var(--yellow);padding:12px 14px}
.hx .hx-mine-row .what{font-family:var(--hx-display),Impact,sans-serif;font-size:18px;letter-spacing:.04em;text-transform:uppercase;line-height:1.15}
.hx .hx-mine-row .what small{display:block;font-family:var(--hx-cond),sans-serif;font-size:13px;font-weight:500;letter-spacing:.04em;color:var(--white-dim);text-transform:none;margin-top:3px}
.hx .hx-mine-row .acts{display:flex;gap:12px;flex:none}
.hx .hx-mine-row .acts button{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;border-bottom:2px solid var(--yellow);padding-bottom:1px}
.hx .hx-mine-row .acts button:hover{color:var(--yellow)}
.hx .hx-mine-row .acts button.x{border-color:var(--rule);color:var(--mute)}

/* THE BOARD: a day, then its categories, then who. */
.hx .hx-day{margin-top:34px}
.hx .hx-day-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;background:var(--yellow);color:var(--ground);padding:8px 12px}
.hx .hx-day-head h3{font-size:clamp(22px,5.5vw,30px);line-height:1}
.hx .hx-day-head span{font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
.hx .hx-cat{margin-top:16px}
.hx .hx-cat h4{font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--yellow);border-bottom:1px solid var(--rule);padding:0 0 6px 2px}
.hx .hx-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:10px 2px;border-bottom:1px solid var(--rule)}
.hx .hx-row .names{font-family:var(--hx-display),Impact,sans-serif;font-size:19px;letter-spacing:.03em;text-transform:uppercase;line-height:1.2}
.hx .hx-row .names .amp{color:var(--yellow);padding:0 .25em}
.hx .hx-row .names .tbd{color:var(--mute)}
.hx .hx-row .names small{display:block;font-family:var(--hx-cond),sans-serif;font-size:13px;font-weight:500;letter-spacing:.04em;color:var(--white-dim);text-transform:none;margin-top:2px}
.hx .hx-row .names small a{text-decoration:none;border-bottom:1px solid var(--yellow)}
.hx .hx-row .start{flex:none;font-family:var(--hx-display),Impact,sans-serif;font-size:16px;letter-spacing:.06em;color:var(--white-dim);white-space:nowrap}
.hx .hx-empty{margin-top:24px;color:var(--mute)}

/* THE STICKER: the canvas on a panel, the three buttons under it. */
.hx .hx-stk{margin-top:22px;background:var(--panel);border:1px solid var(--rule);padding:16px}
.hx .hx-stk-pick{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.hx .hx-stk-pick button{border:1px solid var(--rule);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;padding:8px 12px;color:var(--white-dim)}
.hx .hx-stk-pick button[aria-pressed=true]{background:var(--white);color:var(--ground);border-color:var(--white)}
.hx .hx-stk-pick.looks{flex-wrap:nowrap}
.hx .hx-stk-pick.looks button{flex:1 1 0;min-width:0;padding:7px 4px;font-size:10px;letter-spacing:.1em;line-height:1.25;white-space:normal}
.hx .hx-stk-btns.deck{margin-top:8px}
.hx .hx-stk-btns.deck button{border-color:var(--rule);color:var(--white-dim);font-size:13px}
.hx .hx-stk-btns.deck button:hover{border-color:var(--yellow);color:var(--white)}
.hx .hx-stk-btns button:disabled{opacity:.5;cursor:default}
.hx .hx-stk canvas{display:block;width:100%;max-width:420px;height:auto;margin:0 auto}
.hx .hx-stk canvas.clear{background:repeating-conic-gradient(#2a2a2a 0 25%,#1c1c1c 0 50%) 0 0/24px 24px}
.hx .hx-stk-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.hx .hx-stk-btns button{flex:1 1 auto;border:2px solid var(--white);font-family:var(--hx-display),Impact,sans-serif;font-size:15px;letter-spacing:.1em;text-transform:uppercase;padding:11px 14px}
.hx .hx-stk-btns button.primary{background:var(--yellow);border-color:var(--yellow);color:var(--ground)}
.hx .hx-stk-btns button:hover{border-color:var(--yellow)}
.hx .hx-stk-msg{margin-top:10px;font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--white-dim);min-height:1.4em}
.hx .hx-probe{position:absolute;left:-9999px;top:0;visibility:hidden}
.hx .hx-probe.d{font-family:var(--hx-display),Impact,sans-serif}
.hx .hx-probe.c{font-family:var(--hx-cond),sans-serif}

/* THE LIST (the owner), for a phone: one card per entry, no table, nothing
 * wider than the screen. */
.hx .hx-roster{margin-top:8px}
.hx .hx-roster-day{font-size:clamp(22px,5.5vw,30px);line-height:1;background:var(--yellow);color:var(--ground);padding:8px 12px;margin-top:26px}
.hx .hx-card{background:var(--panel);border:1px solid var(--rule);border-left:4px solid var(--yellow);padding:12px 14px;margin-top:10px;overflow-wrap:anywhere}
.hx .hx-card-top{display:flex;align-items:baseline;gap:10px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--yellow)}
.hx .hx-card-top .n{color:var(--mute);flex:none}
.hx .hx-card-top .cat{flex:1 1 auto;min-width:0}
.hx .hx-card-top .start{flex:none;color:var(--white)}
.hx .hx-card-remove{flex:none;display:inline-flex;align-items:baseline;gap:8px}
.hx .hx-card-remove button{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--mute);border-bottom:2px solid var(--rule);padding-bottom:1px}
.hx .hx-card-remove button:hover{color:var(--yellow);border-color:var(--yellow)}
.hx .hx-card-remove em{font-style:normal;font-size:11px;color:var(--yellow)}
.hx .hx-card-name{font-size:24px;line-height:1.1;margin-top:6px}
.hx .hx-card-line{font-size:15px;font-weight:500;color:var(--white-dim);margin-top:4px;line-height:1.4}
.hx .hx-card-line a{text-decoration:none;color:var(--white);border-bottom:1px solid var(--yellow)}
.hx .hx-card-line .amp{color:var(--yellow)}
.hx .hx-card-with{margin-top:6px}

/* THE EVENTS INDEX. */
.hx .hx-events{margin-top:24px;display:grid;gap:10px}
.hx .hx-event{display:block;text-decoration:none;background:var(--panel);border:1px solid var(--rule);border-left:6px solid var(--yellow);padding:16px 18px}
.hx .hx-event:hover{border-color:var(--yellow)}
.hx .hx-event .t{font-family:var(--hx-display),Impact,sans-serif;font-size:28px;text-transform:uppercase;line-height:1}
.hx .hx-event small{display:block;font-size:13px;font-weight:500;color:var(--white-dim);margin-top:6px;letter-spacing:.04em}

/* THE FOOT: the house footer (HomeFooter.tsx — MIKIAN MUSSER, @mikian_,
 * the email, FOR YOURSELF AND OTHERS), its classes styled for the ground. */
.hx footer{margin-top:64px;border-top:1px solid var(--rule);padding:30px 20px 56px}
.hx footer .wrap{max-width:720px;margin:0 auto}
.hx footer .big{font-family:var(--hx-display),Impact,sans-serif;font-size:14px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px;color:var(--white)}
.hx footer p.mono{font-family:var(--hx-cond),sans-serif;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);line-height:2}
.hx footer a{color:var(--white);text-decoration:none;border-bottom:2px solid var(--yellow)}
.hx footer a:hover{color:var(--yellow)}

@media(max-width:460px){
  .hx .hx-form .two{grid-template-columns:1fr}
  .hx .hx-acct .who{display:none}
  .hx .hx-facts{grid-template-columns:1fr}
  .hx .hx-fact + .hx-fact{border-left:0;padding-left:0;border-top:1px solid var(--rule)}
}
`;
