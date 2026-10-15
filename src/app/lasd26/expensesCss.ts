/* /lasd26/expenses — the invoice look on the cream paper (owner, 2026-10-15:
 * "kind of like an invoice"). Passed through LasdPage's extraCss; every rule
 * sits under .lasd26 .xp-* so it cannot leak into the other pages. Fills are
 * the lime (--safety); type and thin borders on the paper are the deep cut
 * (--safety-ink) because lime on cream does not pass contrast. Targets are
 * 44 px or taller — this gets used on a phone in a van. */

export const expensesCss = `
.lasd26 .xp-sum{border:2px solid var(--ink);display:grid;grid-template-columns:1fr 1fr;margin-top:4px}
.lasd26 .xp-sum .c{padding:16px 18px 14px;border-bottom:1px solid var(--ink);min-width:0}
.lasd26 .xp-sum .c:first-child{border-right:1px solid var(--ink)}
.lasd26 .xp-sum .c.per{grid-column:1/-1;border-bottom:none;background:var(--safety);color:#111}
.lasd26 .xp-sum .k{font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.lasd26 .xp-sum .per .k{color:#2a4d08}
.lasd26 .xp-sum .v{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(22px,6.5vw,38px);line-height:1;margin-top:6px;font-variant-numeric:tabular-nums;letter-spacing:-.01em;overflow-wrap:anywhere}
.lasd26 .xp-sum .per .v{font-size:clamp(46px,14vw,84px);letter-spacing:-.02em}
.lasd26 .xp-sum .per small{display:block;font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.06em;margin-top:8px;color:#2a4d08}
.lasd26 .xp-foot{font-family:var(--lasd-mono),monospace;font-size:12px;color:var(--ink-soft);margin-top:10px;display:flex;gap:6px 18px;flex-wrap:wrap;letter-spacing:.02em}
.lasd26 .xp-foot .est{color:var(--safety-ink)}

.lasd26 .xp-l{display:block;font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin:16px 0 4px}
.lasd26 .xp-in{width:100%;min-height:44px;background:transparent;border:none;border-bottom:2px solid var(--ink);color:var(--ink);font-family:var(--lasd-archivo),sans-serif;font-size:17px;padding:8px 2px;border-radius:0;appearance:none}
.lasd26 .xp-in:focus{outline:none;border-bottom-color:var(--safety-ink)}
.lasd26 .xp-in.amt{font-family:var(--lasd-mono),monospace;font-variant-numeric:tabular-nums}
.lasd26 .xp-row{display:grid;grid-template-columns:1fr 150px;gap:0 18px}
.lasd26 .xp-check{display:flex;align-items:center;gap:10px;min-height:44px;margin-top:10px;font-family:var(--lasd-mono),monospace;font-size:13px;cursor:pointer;user-select:none}
.lasd26 .xp-check input{width:20px;height:20px;accent-color:var(--safety-ink);margin:0;flex:none}
.lasd26 .xp-files{display:flex;align-items:center;gap:12px;min-height:48px;margin-top:6px;padding:10px 14px;border:2px dashed var(--ink-soft);font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.06em;cursor:pointer;color:var(--ink-soft)}
.lasd26 .xp-files:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .xp-files input{position:absolute;opacity:0;width:1px;height:1px}
.lasd26 .xp-files b{color:var(--ink)}
.lasd26 .xp-btn{min-height:46px;background:var(--safety);color:#111;border:2px solid #111;font-family:var(--lasd-archivo-black),sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.04em;padding:10px 20px;cursor:pointer}
.lasd26 .xp-btn:hover{background:var(--safety-hover)}
.lasd26 .xp-btn:disabled{background:#d8d7cf;color:#7a7a75;border-color:#c9c8c0;cursor:default}
.lasd26 .xp-ghost{min-height:44px;background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:10px 14px;cursor:pointer}
.lasd26 .xp-ghost:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .xp-ghost.danger:hover{border-color:#b3261e;color:#b3261e}
.lasd26 .xp-ghost:disabled{opacity:.5;cursor:default}
.lasd26 .xp-add{border:2px solid var(--ink);padding:4px 18px 20px;margin-top:22px}
.lasd26 .xp-add-open{display:flex;width:100%;min-height:52px;align-items:center;justify-content:space-between;margin-top:22px;background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--lasd-archivo-black),sans-serif;font-size:16px;text-transform:uppercase;letter-spacing:.04em;padding:12px 18px;cursor:pointer;text-align:left}
.lasd26 .xp-add-open:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .xp-add-open .mono{font-size:11px;letter-spacing:.1em;color:var(--gray)}
.lasd26 .xp-add .acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.lasd26 .xp-err{font-family:var(--lasd-mono),monospace;font-size:12px;color:#b3261e;margin-top:12px;letter-spacing:.02em}

.lasd26 .xp-list{margin-top:28px;border-top:2px solid var(--ink)}
.lasd26 .xp-card{padding:18px 0 20px;border-bottom:1px dashed #c9c8c0}
.lasd26 .xp-top{display:flex;justify-content:space-between;align-items:baseline;gap:14px}
.lasd26 .xp-title{font-weight:700;font-size:17px;text-transform:uppercase;letter-spacing:.02em;line-height:1.25;min-width:0}
.lasd26 .xp-amt{font-family:var(--lasd-archivo-black),sans-serif;font-size:22px;font-variant-numeric:tabular-nums;white-space:nowrap;flex:none}
.lasd26 .xp-amt.est{color:var(--safety-ink)}
.lasd26 .xp-chip{display:inline-block;vertical-align:middle;font-family:var(--lasd-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;border:1.5px solid var(--safety-ink);color:var(--safety-ink);padding:2px 7px 1px;margin-left:8px;font-weight:400;line-height:1.5}
.lasd26 .xp-meta{font-family:var(--lasd-mono),monospace;font-size:11px;color:var(--gray);margin-top:5px;letter-spacing:.04em}
.lasd26 .xp-note{font-size:14px;color:var(--ink-soft);margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere}
.lasd26 .xp-rcpts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.lasd26 .xp-rcpt{position:relative;width:92px;height:92px;border:2px solid var(--ink);background:#e7e6df;display:block;overflow:hidden;flex:none}
.lasd26 .xp-rcpt a{display:block;width:100%;height:100%}
.lasd26 .xp-rcpt img{width:100%;height:100%;object-fit:cover;display:block}
.lasd26 .xp-rcpt.pdf a{display:flex;align-items:center;justify-content:center;font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.12em;font-weight:700;text-decoration:none;color:var(--safety-ink)}
/* The × on a receipt: a 30 px ink square in the corner, but a 44 × 44 hit
 * area (the review, 2026-10-15, finding #7). The tile clips overflow, so
 * the extra reach goes INWARD as padding on the left and bottom, and the
 * ink is painted on the content box only, so the square looks the same. */
.lasd26 .xp-rcpt-x{position:absolute;top:0;right:0;width:44px;height:44px;padding:0 0 14px 14px;background:var(--ink);background-clip:content-box;color:var(--paper);border:none;cursor:pointer;font-size:16px;line-height:1}
.lasd26 .xp-rcpt-x:hover{background-color:#b3261e}
.lasd26 .xp-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.lasd26 .xp-acts .xp-files{margin-top:0;min-height:44px;padding:8px 14px}
.lasd26 .xp-up{font-family:var(--lasd-mono),monospace;font-size:11px;color:var(--ink-soft);margin-top:10px;line-height:1.9;letter-spacing:.02em}
.lasd26 .xp-up .ok{color:var(--safety-ink)}
.lasd26 .xp-up .bad{color:#b3261e}
.lasd26 .xp-edit{border-left:3px solid var(--safety-ink);padding-left:14px;margin-top:4px}

.lasd26 .xp-notice{border:2px solid var(--ink);padding:24px 20px;margin-top:6px;font-family:var(--lasd-mono),monospace;font-size:13px;line-height:1.8}
.lasd26 .xp-notice strong{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:22px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;line-height:1.1;margin-bottom:10px}
.lasd26 .xp-notice .xp-btn{margin-top:18px}

@media(max-width:420px){
  .lasd26 .xp-row{grid-template-columns:1fr}
  .lasd26 .xp-sum .c{padding:14px 14px 12px}
}
`;
