/**
 * Page CSS for the team pages — /lasd26/join (the group-chat link) and
 * /lasd26/team (the owner's console). Passed through LasdPage's extraCss on
 * top of the shared stylesheet in theme.ts, so only what those two pages
 * add lives here. Same paper, same tokens: lime (--safety) is a FILL, deep
 * green (--safety-ink) is for type and thin borders on the cream.
 *
 * Prefixes: .jn- is the join page, .tm- the team console.
 */
export const teamCss = `
/* The old orange hover on the big button, until theme.ts catches up. */
.lasd26 .send:hover{background:var(--safety-hover)}

/* ─── join ───────────────────────────────────────────────────────────── */
.lasd26 .jn-hero{padding:34px 20px 0}
.lasd26 .jn-hero h1{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(38px,11vw,84px);line-height:.94;letter-spacing:-.02em;text-transform:uppercase}
.lasd26 .jn-hero h1 .o{color:var(--safety-ink)}
.lasd26 .jn-hero .sub{margin-top:14px;max-width:52ch;color:var(--ink-soft);font-size:15px}
.lasd26 .jn-hero .sub strong{color:var(--ink)}
.lasd26 .jn-brand{display:flex;align-items:center;gap:12px;margin-top:22px}
.lasd26 .jn-brand img{width:44px;height:44px;border-radius:50%;display:block}
.lasd26 .jn-brand .x{font-family:var(--lasd-mono),monospace;font-size:12px;color:var(--gray);letter-spacing:.1em}

.lasd26 .jn-form{margin-top:40px}
.lasd26 .jn-form .pill small{display:block;font-size:10px;color:#9a9a94;letter-spacing:.06em;margin-top:2px;text-transform:uppercase}
.lasd26 .jn-form .pill input:checked + span small{color:var(--safety)}
.lasd26 .jn-form .send{margin-top:28px}
.lasd26 .jn-err{margin-top:14px;font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.06em;color:var(--safety)}
.lasd26 .jn-form .who{font-family:var(--lasd-mono),monospace;font-size:12px;color:#9a9a94;margin-top:10px;letter-spacing:.06em}

.lasd26 .jn-state{border:2px solid var(--ink);padding:22px 20px;margin-top:34px}
.lasd26 .jn-state .k{font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.lasd26 .jn-state .v{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(24px,7vw,38px);text-transform:uppercase;line-height:1.05;margin-top:6px}
.lasd26 .jn-state .v .o{color:var(--safety-ink)}
.lasd26 .jn-state p{font-size:14px;color:var(--ink-soft);margin-top:10px}
.lasd26 .jn-state .pills{margin-top:16px}
.lasd26 .jn-state .pill span{border-color:#c9c8c0;color:var(--ink)}
.lasd26 .jn-state .pill input:checked + span{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .jn-state .pill small{display:block;font-size:10px;color:var(--gray);letter-spacing:.06em;margin-top:2px;text-transform:uppercase}
.lasd26 .jn-bad{border:2px dashed #c9c8c0;padding:26px 20px;margin-top:40px;font-family:var(--lasd-mono),monospace;font-size:13px;line-height:1.8;color:var(--ink-soft)}
.lasd26 .jn-bad strong{color:var(--ink);display:block;font-size:15px}

/* Big lime button on paper (sign in / join / go to expenses). */
.lasd26 .tm-go{display:inline-flex;align-items:center;justify-content:center;min-height:52px;background:var(--safety);color:#111;border:2px solid #111;font-family:var(--lasd-archivo-black),sans-serif;font-size:17px;text-transform:uppercase;letter-spacing:.04em;padding:12px 22px;cursor:pointer;text-decoration:none;margin-top:22px}
.lasd26 .tm-go:hover{background:var(--safety-hover)}
.lasd26 .tm-go:disabled{background:#c9c8c0;border-color:#c9c8c0;cursor:default}
.lasd26 .tm-go.wide{display:flex;width:100%}

/* ─── team console ───────────────────────────────────────────────────── */
.lasd26 .tm-lede{font-size:14px;color:var(--ink-soft);max-width:56ch;margin-bottom:18px}
.lasd26 .tm-card{border:2px solid var(--ink);padding:18px 16px}
.lasd26 .tm-link{display:block;width:100%;border:none;border-bottom:2px solid var(--ink);background:transparent;font-family:var(--lasd-mono),monospace;font-size:13px;color:var(--ink);padding:10px 2px;border-radius:0;appearance:none;word-break:break-all}
.lasd26 .tm-link:focus{outline:none;border-bottom-color:var(--safety-ink)}
.lasd26 .tm-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.lasd26 .tm-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 16px;cursor:pointer;text-decoration:none}
.lasd26 .tm-btn:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .tm-btn:disabled{opacity:.5;cursor:default;border-color:var(--ink);color:var(--ink)}
.lasd26 .tm-btn.fill{background:var(--safety);border-color:#111;color:#111}
.lasd26 .tm-btn.fill:hover{background:var(--safety-hover);color:#111}
.lasd26 .tm-btn.quiet{border-color:#c9c8c0;color:var(--ink-soft);font-weight:400}
.lasd26 .tm-btn.quiet:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .tm-btn.row{min-height:44px;padding:6px 10px;font-size:11px;margin-top:6px}
.lasd26 .tm-note{font-family:var(--lasd-mono),monospace;font-size:12px;color:var(--gray);line-height:1.8;margin-top:12px}
.lasd26 .tm-note strong{color:var(--ink);font-weight:700}
.lasd26 .tm-ok{color:var(--safety-ink)}
.lasd26 .tm-err{font-family:var(--lasd-mono),monospace;font-size:12px;color:var(--safety-ink);margin-top:10px;letter-spacing:.04em}
.lasd26 .tm-err::before{content:"! "}

.lasd26 table.pile td.tm-paid{white-space:nowrap}
.lasd26 table.pile .tm-dim{color:var(--gray)}
.lasd26 table.pile .tm-role{text-transform:uppercase;letter-spacing:.08em;font-size:11px}
.lasd26 table.pile .tm-email{display:block;font-size:11px;color:var(--gray);word-break:break-all}
@media(max-width:559px){
  .lasd26 .tm-hide-sm{display:none}
  .lasd26 table.pile td.tm-paid{white-space:normal}
}

.lasd26 .tm-set{display:grid;grid-template-columns:1fr;gap:18px;margin-top:4px}
.lasd26 .tm-set label.k{display:block;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-bottom:8px}
.lasd26 .tm-num{width:120px;min-height:44px;border:2px solid var(--ink);background:transparent;font-family:var(--lasd-mono),monospace;font-size:18px;color:var(--ink);padding:6px 10px;border-radius:0;appearance:none}
.lasd26 .tm-num:focus{outline:none;border-color:var(--safety-ink)}
.lasd26 .tm-inline{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.lasd26 .tm-inline .mono{font-size:13px;color:var(--ink-soft)}
.lasd26 .tm-toggle{display:inline-flex;align-items:center;gap:10px;cursor:pointer;min-height:44px;user-select:none}
.lasd26 .tm-toggle input{position:absolute;opacity:0}
.lasd26 .tm-toggle .sw{width:46px;height:26px;border:2px solid var(--ink);position:relative;flex:none;background:transparent}
.lasd26 .tm-toggle .sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;background:var(--ink);transition:left .12s}
.lasd26 .tm-toggle input:checked + .sw{background:var(--safety)}
.lasd26 .tm-toggle input:checked + .sw::after{left:23px}
.lasd26 .tm-toggle input:focus-visible + .sw{outline:2px solid var(--safety-ink);outline-offset:3px}
.lasd26 .tm-toggle .t{font-family:var(--lasd-mono),monospace;font-size:13px}
.lasd26 .tm-toggle .t small{display:block;font-size:11px;color:var(--gray)}
.lasd26 .tm-share{border-top:2px solid var(--ink);margin-top:22px;padding-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lasd26 .tm-share .k{font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.lasd26 .tm-share .v{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(22px,6vw,32px);line-height:1.1;margin-top:4px;font-variant-numeric:tabular-nums}
.lasd26 .tm-share .v.o{color:var(--safety-ink)}
`;
