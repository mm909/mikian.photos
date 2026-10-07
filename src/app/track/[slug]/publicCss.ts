/**
 * The public spectator page's stylesheet (TRACKER_SPEC.md §11 "Public").
 * Appended after theme.ts's baseCss in the page's <style>, so the tokens
 * (--ground, --panel, --line, --text, --muted, --warn, --bad, --ok) and the
 * utility classes (.cond .num .mono .panel .dot .pill…) are already there.
 *
 * Phone first: the tab bar is FIXED to the bottom (thumb reach, 56 px tall
 * plus the home-indicator inset) and moves to a sticky strip under the
 * header from 720 px up. 16 px gutters, nothing scrolls sideways, every
 * tap target is at least 44 px. Entry colour is never the only cue — the
 * short name is in every dot, chip and tag (see .mk, .chip, .etag).
 */
export const publicCss = `
.trk .app{display:flex;flex-direction:column;min-height:100dvh;padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))}
.trk .main{flex:1}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.trk .hdr{position:sticky;top:0;z-index:7;background:rgba(16,18,20,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.trk .hdr-in{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 16px;max-width:960px;margin:0 auto}
.trk .hdr h1{flex:1;min-width:0;font-family:var(--trk-cond),sans-serif;font-weight:600;font-size:19px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trk .hdr-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:none}
.trk .upd{font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;color:var(--muted);letter-spacing:.02em;white-space:nowrap}
.trk .upd.is-off{color:var(--warn)}
.trk .pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:12px;border:1px solid var(--line);font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.trk .pill.is-live{color:var(--ok);border-color:rgba(123,228,149,.45)}
.trk .pill.is-finished{color:var(--text);border-color:var(--text)}
.trk .pill.is-off{color:var(--warn);border-color:rgba(255,200,87,.5)}
.trk .pill.is-dev{color:var(--warn)}
.trk .pill.is-delayed{color:var(--text)}

/* ─── Tab bar ────────────────────────────────────────────────────────────── */
.trk .tabs{position:fixed;left:0;right:0;bottom:0;z-index:8;display:grid;grid-template-columns:repeat(4,1fr);background:var(--panel);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom,0px)}
.trk .tabs button{position:relative;min-height:56px;display:flex;align-items:center;justify-content:center;font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);-webkit-tap-highlight-color:transparent}
.trk .tabs button[aria-selected="true"]{color:var(--text)}
.trk .tabs button[aria-selected="true"]::after{content:"";position:absolute;left:18%;right:18%;top:0;height:2px;background:var(--text);border-radius:0 0 2px 2px}
@media (min-width:720px){
  .trk .app{padding-bottom:0}
  .trk .tabs{position:sticky;top:52px;bottom:auto;border-top:0;border-bottom:1px solid var(--line);grid-template-columns:repeat(4,160px);justify-content:center;padding-bottom:0}
  .trk .tabs button{min-height:48px}
  .trk .tabs button[aria-selected="true"]::after{top:auto;bottom:0;border-radius:2px 2px 0 0}
}

/* ─── Map ────────────────────────────────────────────────────────────────── */
.trk .map-wrap{position:relative;height:55dvh;min-height:260px;max-height:640px;background:#0c0c0c;border-bottom:1px solid var(--line)}
.trk .map-wrap.is-hidden{display:none}
.trk .map-el{position:absolute;inset:0}
.trk .map-el canvas{outline:none}
.trk .map-note{position:absolute;left:12px;top:12px;max-width:70%;padding:6px 10px;border-radius:8px;background:rgba(16,18,20,.82);border:1px solid var(--line);font-size:13px;color:var(--muted);pointer-events:none}
.trk .map-note.is-right{left:auto;right:12px;color:var(--warn)}
.trk .map-follow{position:absolute;right:12px;bottom:12px;min-height:44px;padding:0 14px;border-radius:22px;background:rgba(26,29,33,.92);border:1px solid var(--line);color:var(--muted);font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;display:inline-flex;align-items:center;gap:8px}
.trk .map-follow[aria-pressed="true"]{color:var(--ground);background:var(--text);border-color:var(--text)}
.trk .mk{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:13px;color:#101214;border:2px solid #101214;box-shadow:0 0 0 2px rgba(241,241,236,.75),0 3px 10px rgba(0,0,0,.6);cursor:default;user-select:none}
.trk .mk.is-vehicle{border-radius:8px}
.trk .mk.is-stale{opacity:.6;box-shadow:0 0 0 2px var(--warn),0 3px 10px rgba(0,0,0,.6)}
.trk .mk.is-off{box-shadow:0 0 0 2px var(--bad),0 3px 10px rgba(0,0,0,.6)}
.trk .mk.is-leader{box-shadow:0 0 0 2px rgba(241,241,236,.75),0 0 0 6px rgba(241,241,236,.18),0 3px 10px rgba(0,0,0,.6)}
.trk .maplibregl-ctrl-attrib{background:rgba(16,18,20,.75)!important;color:var(--muted);font-size:10px;font-family:var(--trk-sans),sans-serif}
.trk .maplibregl-ctrl-attrib a{color:var(--muted)}
.trk .maplibregl-ctrl-attrib-button{filter:invert(1)}
.trk .maplibregl-ctrl-bottom-left{bottom:0}

/* ─── Cards (Live tab) ───────────────────────────────────────────────────── */
.trk .cards{max-width:720px;margin:0 auto;padding:12px 16px 0;display:flex;flex-direction:column;gap:12px}
.trk .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;overflow:hidden}
.trk .card-head{display:flex;align-items:center;gap:10px;min-width:0}
.trk .ename{flex:1;min-width:0;font-family:var(--trk-cond),sans-serif;font-weight:600;font-size:21px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trk .eyebrow{font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:14px}
.trk .oncourse{margin-top:4px;font-size:16px;line-height:1.35}
.trk .oncourse strong{font-weight:600}
.trk .oncourse .sep{color:var(--muted);margin:0 6px}
.trk .nextup{margin-top:2px;font-size:13px;color:var(--muted)}
.trk .prog{margin-top:14px}
.trk .prog-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:6px}
.trk .prog-row .pct{font-family:var(--trk-cond),sans-serif;font-weight:700;font-variant-numeric:tabular-nums;font-size:22px;line-height:1}
.trk .prog-row .of{font-family:var(--trk-cond),sans-serif;font-weight:500;font-variant-numeric:tabular-nums;font-size:15px;color:var(--muted)}
.trk .bar{height:8px;border-radius:4px;background:var(--line);overflow:hidden}
.trk .bar i{display:block;height:100%;border-radius:4px;transition:width .6s ease}
.trk .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
.trk .stat{min-width:0}
.trk .stat .k{font-family:var(--trk-mono),ui-monospace,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.trk .stat .v{font-family:var(--trk-cond),sans-serif;font-weight:700;font-variant-numeric:tabular-nums lining-nums;font-size:24px;line-height:1.1;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trk .stat .v.eta{font-size:22px}
@media (max-width:359px){.trk .stat .v{font-size:20px}.trk .stat .v.eta{font-size:18px}}
.trk .stat .w{font-family:var(--trk-cond),sans-serif;font-weight:500;font-variant-numeric:tabular-nums;font-size:13px;color:var(--muted);margin-top:2px;white-space:nowrap}
/* With a public delay the clock's label is "RACE CLOCK (DELAYED)" — too long
 * for a third of a 375 px card — so the labels may wrap, and the three stats
 * share rows (subgrid) so the big numbers stay on one line. Without subgrid
 * support the first value simply sits one label-line lower. */
.trk .stats.is-delayed{grid-template-rows:auto auto auto}
.trk .stats.is-delayed .stat{display:grid;grid-template-rows:subgrid;grid-row:span 3;align-content:start}
.trk .stats.is-delayed .stat .k{white-space:normal}
.trk .fresh{display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
.trk .fresh.is-fresh{color:var(--text)}
.trk .fresh.is-stale{color:var(--warn)}
.trk .fresh .off{color:var(--bad)}
.trk .fresh .sep{opacity:.5}
.trk .gap{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:16px}
.trk .gap strong{font-weight:600}
.trk .gap .num{font-size:20px}
.trk .countdown{text-align:center;padding:22px 16px}
.trk .countdown .v{font-family:var(--trk-cond),sans-serif;font-weight:700;font-variant-numeric:tabular-nums;font-size:48px;line-height:1}
.trk .countdown .d{margin-top:6px;color:var(--muted);font-size:14px}
.trk .notice{text-align:center;color:var(--muted);font-size:14px;padding:8px 0}
.trk .loading{display:flex;align-items:center;justify-content:center;gap:10px;padding:28px 16px;color:var(--muted);font-size:14px}

/* ─── Lists (Runners, Legs) ──────────────────────────────────────────────── */
.trk .list{max-width:720px;margin:0 auto;padding:12px 16px 0}
.trk .filter{display:flex;justify-content:center;margin-bottom:12px}
/* The segment fills the row and the buttons share it (flex:1 1 0, min-width:0)
 * so a long team name shortens with an ellipsis instead of pushing the next
 * button past the clipped edge — review: at 375 px two 12-character names
 * left part of the second team's tap target unreachable. The dot cannot
 * shrink; the name is what gives way. */
.trk .seg{display:flex;width:100%;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}
.trk .seg button{flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 12px;color:var(--muted);font-weight:600;font-size:14px;border-right:1px solid var(--line);white-space:nowrap;-webkit-tap-highlight-color:transparent}
.trk .seg button:last-child{border-right:0}
.trk .seg button[aria-pressed="true"]{background:var(--text);color:var(--ground)}
.trk .seg button .dot{flex:none}
.trk .seg button[aria-pressed="true"] .dot{box-shadow:0 0 0 2px var(--ground)}
.trk .seg .sname{min-width:0;overflow:hidden;text-overflow:ellipsis}
.trk .group{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:12px}
.trk .group-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
.trk .group-head .gname{flex:1;min-width:0;font-family:var(--trk-cond),sans-serif;font-weight:600;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trk .row{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);min-height:60px}
.trk .row:last-child{border-bottom:0}
.trk .row.is-live{background:rgba(123,228,149,.05)}
.trk .chip{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:14px;color:#101214;flex:none}
.trk .who{min-width:0}
.trk .who .n{display:flex;align-items:center;gap:8px;font-weight:600;font-size:16px;line-height:1.2;min-width:0}
.trk .who .n span.nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trk .who .s{margin-top:2px;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.trk .who .s.is-on{color:var(--ok)}
.trk .who .s.dim{color:var(--muted);opacity:.7;font-size:12px}
.trk .etag{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:5px;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:12px;color:#101214;flex:none}
.trk .cols{display:grid;grid-auto-flow:column;gap:14px;text-align:right}
.trk .cols .c{min-width:0}
.trk .cols .v{font-family:var(--trk-cond),sans-serif;font-weight:700;font-variant-numeric:tabular-nums lining-nums;font-size:18px;line-height:1.1;white-space:nowrap}
.trk .cols .k{font-family:var(--trk-mono),ui-monospace,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:2px}
.trk .live-badge{display:inline-flex;align-items:center;gap:6px;height:20px;padding:0 7px;border-radius:5px;border:1px solid rgba(123,228,149,.45);color:var(--ok);font-family:var(--trk-mono),ui-monospace,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
.trk .legno{font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.06em;color:var(--muted)}
.trk .empty{padding:28px 16px;text-align:center;color:var(--muted);font-size:14px}
@media (max-width:359px){.trk .cols{gap:10px}.trk .cols .v{font-size:16px}}

/* ─── Meet us ────────────────────────────────────────────────────────────── */
.trk .cp{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.trk .cp-head,.trk .cp-row{display:grid;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line)}
.trk .cp-head{padding-top:12px;padding-bottom:10px}
.trk .cp-row:last-child{border-bottom:0}
.trk .cp-row{min-height:56px}
.trk .cp-name{min-width:0}
.trk .cp-name .n{font-weight:600;font-size:16px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trk .cp-name .m{font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;color:var(--muted);margin-top:2px}
.trk .cp-cell{min-width:0;text-align:right}
.trk .cp-cell .t{font-family:var(--trk-cond),sans-serif;font-weight:700;font-variant-numeric:tabular-nums;font-size:18px;line-height:1.1;white-space:nowrap}
.trk .cp-cell .t.is-passed{color:var(--muted);font-weight:600}
.trk .cp-cell .w{font-family:var(--trk-cond),sans-serif;font-weight:500;font-variant-numeric:tabular-nums;font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap}
.trk .cp-cell .k{font-family:var(--trk-mono),ui-monospace,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:1px}
.trk .cp-row.is-finish{background:rgba(241,241,236,.04);min-height:68px}
.trk .cp-row.is-finish .cp-name .n{font-family:var(--trk-cond),sans-serif;font-size:20px;letter-spacing:.01em;text-transform:uppercase}
.trk .cp-row.is-finish .cp-cell .t{font-size:22px}
.trk .cp-head .h{display:flex;justify-content:flex-end;align-items:center;gap:6px;min-width:0}
.trk .cp-head .h .hn{font-family:var(--trk-cond),sans-serif;font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trk .cp-note{color:var(--muted);font-size:13px;text-align:center;margin:12px 0 0}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
.trk .foot{padding:22px 16px 10px;text-align:center;color:var(--muted);font-size:13px}
`;
