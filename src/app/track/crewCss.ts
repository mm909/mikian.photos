/**
 * Rules shared by the crew, van and join pages, appended after theme.ts
 * baseCss inside each page's own <style>. Prefixed `c-` so nothing here
 * collides with the public page's classes.
 *
 * These three pages are used standing on a road shoulder at night or in
 * full sun: bigger type than the spectator page (18 px body, 22 px rows),
 * tap targets of 44 px minimum and 72 px+ for the handoff buttons, and the
 * entry colour set as `--entry` on a wrapper so chips and highlights follow
 * the team — always beside the short name or initials, never alone.
 */
export const crewCss = `
.trk .c-page{min-height:100dvh;display:flex;flex-direction:column;font-size:18px;padding-bottom:calc(32px + env(safe-area-inset-bottom))}
.trk .c-top{position:sticky;top:0;z-index:5;background:rgba(16,18,20,.94);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:calc(10px + env(safe-area-inset-top)) 16px 10px}
.trk .c-top .row{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:720px;margin:0 auto}
.trk .c-title{font-size:22px;line-height:1.1;font-weight:600}
.trk .c-kicker{display:block;margin-bottom:2px}
.trk .c-net{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--muted);white-space:nowrap}
.trk .c-net i{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--ok)}
.trk .c-net.off i{background:var(--bad)}
.trk .c-net.off{color:var(--bad)}
.trk .c-main{flex:1;width:100%;max-width:720px;margin:0 auto;padding:0 16px}
.trk .c-section{padding:18px 0 6px}
.trk .c-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px}
.trk .c-h .mono{font-size:12px}
.trk .c-link{min-height:44px;display:inline-flex;align-items:center;padding:0 6px;color:var(--muted);text-decoration:underline;text-underline-offset:3px;font-size:15px}
.trk .c-lead{font-size:20px;line-height:1.35;margin-bottom:14px}
.trk .c-sub{color:var(--muted);font-size:16px;line-height:1.4}

.trk .c-teams{display:grid;gap:12px}
.trk .c-team{min-height:96px;width:100%;display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:14px;border:2px solid var(--line);background:var(--panel);text-align:left;font-size:24px;font-weight:600;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.trk .c-team:active{background:#22262b}
.trk .c-team .dot{width:48px;height:48px;font-size:20px;flex:none;background:var(--entry)}
.trk .c-team small{display:block;font-size:14px;color:var(--muted);font-weight:400}
.trk .c-teamchip{display:inline-flex;align-items:center;gap:8px;font-size:15px;color:var(--muted)}
.trk .c-teamchip .tag{background:var(--entry)}

.trk .c-runners{display:grid;gap:10px}
.trk .c-runner{position:relative;min-height:76px;width:100%;display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:14px;border:2px solid var(--line);background:var(--panel);text-align:left;font-size:22px;font-weight:600;line-height:1.15;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .08s ease}
.trk .c-runner:active{transform:scale(.985);background:#22262b}
.trk .c-runner.on{border-color:var(--entry);box-shadow:inset 0 0 0 1px var(--entry)}
.trk .c-runner .chip{flex:none;width:48px;height:48px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:var(--entry);color:#101214;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:20px}
.trk .c-runner .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trk .c-runner .lbl{flex:none;font-family:var(--trk-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.trk .c-runner.on .lbl{color:var(--entry)}
.trk .c-runner.next .lbl{color:var(--text)}

.trk .c-now{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:var(--panel);border:1px solid var(--line);margin-bottom:14px}
.trk .c-now .chip{flex:none;width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;background:var(--entry);color:#101214;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:24px}
.trk .c-now .who{font-size:24px;font-weight:600;line-height:1.1}
.trk .c-now .since{color:var(--muted);font-size:15px;margin-top:3px}
/* Pairs: the on-course card is one line per slot, each led by its slot chip. */
.trk .c-now.is-pairs{flex-direction:column;align-items:stretch;gap:12px}
.trk .c-now .line{display:flex;align-items:center;gap:12px;min-width:0}
.trk .c-now.is-pairs .chip{width:44px;height:44px;border-radius:11px;font-size:19px}
.trk .c-now.is-pairs .who{font-size:20px}

/* The SLOT PICKER (pairs only): one big pill per slot, the picked one in the
 * entry colour, each showing who holds it now. 88 px tall — a thumb target
 * for a crew member running up to the exchange. */
.trk .c-slots{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.trk .c-slot{min-height:88px;width:100%;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;padding:12px 14px;border-radius:14px;border:2px solid var(--line);background:var(--panel);text-align:left;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .08s ease}
.trk .c-slot:active{transform:scale(.985);background:#22262b}
.trk .c-slot[aria-checked="true"]{border-color:var(--entry);box-shadow:inset 0 0 0 1px var(--entry)}
.trk .c-slot .big{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;padding:0 12px;border-radius:12px;background:var(--line);color:var(--text);font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:28px;line-height:1}
.trk .c-slot[aria-checked="true"] .big{background:var(--entry);color:#101214}
.trk .c-slot .holder{display:block;max-width:100%;font-size:15px;line-height:1.25;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trk .c-slot .holder b{color:var(--text);font-weight:600}
/* The slot chip on rows and the on-course card: the label on the entry colour. */
.trk .c-slotchip{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 8px;border-radius:8px;background:var(--entry);color:#101214;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:15px}
.trk .c-slotchip.sm{min-width:24px;height:24px;padding:0 6px;border-radius:7px;font-size:13px}
/* No slot picked yet: the roster is still there but dimmed, and a tap says "Pick A or B first". */
.trk .c-runners.is-unpicked .c-runner{opacity:.55}

.trk .c-queue{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 0;padding:12px 14px;border-radius:12px;background:#2E2612;border:1px solid var(--warn);color:var(--warn);font-size:16px;font-weight:600}
.trk .c-queue.err{background:#2E1616;border-color:var(--bad);color:var(--bad)}
.trk .c-queue small{display:block;font-weight:400;font-size:13px;opacity:.9;margin-top:2px}
.trk .c-queue button{min-height:44px;padding:0 14px;border-radius:8px;border:1px solid currentColor;font-weight:700;white-space:nowrap}

.trk .c-list{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
.trk .c-hand{display:flex;align-items:center;gap:12px;padding:12px 14px;border-top:1px solid var(--line);font-size:18px;min-height:56px}
.trk .c-hand:first-child{border-top:0}
.trk .c-hand.voided .who,.trk .c-hand.voided .t{opacity:.45;text-decoration:line-through}
.trk .c-hand .t{font-family:var(--trk-cond),sans-serif;font-weight:700;font-variant-numeric:tabular-nums;font-size:20px;min-width:80px}
.trk .c-hand .tag{flex:none;background:var(--entry)}
.trk .c-hand .who{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trk .c-hand .st{flex:none;font-family:var(--trk-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.trk .c-hand .st.wait{color:var(--warn)}
.trk .c-hand .undo{flex:none;min-height:44px;padding:0 12px;border-radius:8px;border:1px solid var(--line);font-weight:700;font-size:15px}
.trk .c-empty{padding:18px 14px;color:var(--muted);font-size:16px}

.trk .c-toast{position:fixed;left:16px;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:20;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:14px;background:var(--text);color:var(--ground);font-size:19px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:688px;margin:0 auto}
.trk .c-toast button{min-height:44px;padding:0 18px;border-radius:9px;background:var(--ground);color:var(--text);font-weight:700;font-size:17px}

.trk .c-big{width:100%;min-height:128px;border-radius:20px;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:40px;letter-spacing:.02em;color:#101214;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.trk .c-big.start{background:var(--ok)}
.trk .c-big.stop{background:var(--bad)}
.trk .c-big:active{filter:brightness(.92)}
.trk .c-big small{display:block;font-family:var(--trk-sans),sans-serif;font-weight:500;font-size:16px;letter-spacing:0;margin-top:2px;opacity:.8}
.trk .c-rule{display:flex;gap:12px;align-items:center;margin:16px 0;padding:14px 16px;border-radius:12px;background:var(--panel);border-left:5px solid var(--warn);font-size:20px;font-weight:600;line-height:1.3}
.trk .c-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.trk .c-stat{padding:12px 14px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}
.trk .c-stat .k{display:block;margin-bottom:4px}
.trk .c-stat .v{font-family:var(--trk-cond),sans-serif;font-weight:700;font-variant-numeric:tabular-nums;font-size:28px;line-height:1}
.trk .c-stat .v small{font-size:15px;font-family:var(--trk-sans),sans-serif;font-weight:500;color:var(--muted);margin-left:4px}
.trk .c-stat.warn .v{color:var(--warn)}
.trk .c-stat.bad .v{color:var(--bad)}
.trk .c-stat.ok .v{color:var(--ok)}
.trk .c-err{margin:12px 0;padding:14px 16px;border-radius:12px;background:#2E1616;border:1px solid var(--bad);font-size:17px;line-height:1.4}
.trk .c-err b{color:var(--bad)}
.trk .c-err ol{margin:8px 0 0 20px}
.trk .c-err li{margin:4px 0}

.trk .c-pill{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--panel);font-size:16px;font-weight:600}
.trk .c-pill i{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--muted)}
.trk .c-pill.ok i{background:var(--ok)}
.trk .c-pill.warn i{background:var(--warn)}
.trk .c-pill.bad i{background:var(--bad)}

.trk .c-copy{display:flex;align-items:center;gap:12px;padding:12px 12px 12px 16px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}
.trk .c-copy .c-code{flex:1;min-width:0}
.trk .c-code{font-family:var(--trk-mono),ui-monospace,monospace;font-size:19px;letter-spacing:0;color:var(--text);word-break:break-all;line-height:1.3}
.trk .c-copy button{flex:none;min-height:44px;min-width:84px;padding:0 14px;border-radius:9px;border:1px solid var(--line);font-weight:700;font-size:15px}
.trk .c-copy button.done{border-color:var(--ok);color:var(--ok)}
.trk .c-field{margin-bottom:14px}
.trk .c-field .mono{display:block;margin-bottom:6px}

.trk .c-steps{list-style:none;counter-reset:step;display:grid;gap:10px}
.trk .c-steps li{position:relative;padding:12px 14px 12px 54px;border-radius:12px;background:var(--panel);border:1px solid var(--line);font-size:17px;line-height:1.4;min-height:56px}
.trk .c-steps li::before{counter-increment:step;content:counter(step);position:absolute;left:14px;top:12px;width:28px;height:28px;border-radius:50%;background:var(--text);color:var(--ground);font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:16px;display:inline-flex;align-items:center;justify-content:center}
.trk .c-steps li b{font-weight:600}
.trk .c-settings{display:grid;gap:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
.trk .c-kv{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-top:1px solid var(--line);font-size:17px;min-height:50px}
.trk .c-kv:first-child{border-top:0}
.trk .c-kv b{font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:20px;text-align:right}
.trk .c-check{display:grid;gap:8px}
.trk .c-check li{list-style:none;display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:var(--panel);border:1px solid var(--line);font-size:17px;line-height:1.4}
.trk .c-check li::before{content:"";flex:none;width:12px;height:12px;border-radius:3px;border:2px solid var(--muted);margin-top:7px}
.trk .c-check li small{display:block;color:var(--muted);font-size:14px;margin-top:2px}
.trk .c-people{display:grid;gap:10px}
.trk .c-person{min-height:60px;width:100%;display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:var(--panel);text-align:left;font-size:20px;font-weight:600;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.trk .c-person:active{background:#22262b}
.trk .c-person .chip{flex:none;width:40px;height:40px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:var(--entry);color:#101214;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:17px}
.trk .c-person small{margin-left:auto;color:var(--muted);font-weight:400;font-size:14px;white-space:nowrap}
.trk .c-live{padding:16px;border-radius:14px;border:2px solid var(--line);background:var(--panel)}
.trk .c-live.ok{border-color:var(--ok)}
.trk .c-live.warn{border-color:var(--warn)}
.trk .c-live.bad{border-color:var(--bad)}
.trk .c-live .big{font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:30px;line-height:1.1;margin:6px 0}
.trk .c-live.ok .big{color:var(--ok)}
.trk .c-live.warn .big{color:var(--warn)}
.trk .c-live.bad .big{color:var(--bad)}
.trk .c-live .meta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:15px;margin-top:6px}

.trk .c-wall{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 20px;text-align:center}
.trk .c-wall h1{font-size:30px;line-height:1.1;margin:14px 0 10px}
.trk .c-wall p{color:var(--muted);font-size:18px;line-height:1.45;max-width:420px;margin:0 auto}
.trk .c-foot{padding:24px 0 0;color:var(--muted);font-size:13px;line-height:1.5}
.trk .c-foot a{color:var(--muted)}
@media (min-width:560px){.trk .c-stats{grid-template-columns:repeat(4,1fr)}.trk .c-teams{grid-template-columns:1fr 1fr}}
`;
