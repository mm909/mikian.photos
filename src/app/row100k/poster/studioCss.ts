/* poster/studioCss.ts — the studio's page-local styles, .po- prefix,
 * theme.ts untouched. Rendered as the text child of a style tag on three
 * pages (posters, the rower's own poster, the dev fixture), so NO double
 * quotes, apostrophes, angle brackets or ampersands anywhere in the
 * string (React escapes them inside a style tag — see theme.ts).
 *
 * The probes and the button are the post pack's (.pk-probe / .pk-btn in
 * post/page.tsx) under this prefix, because pkCss only ships on /post. The
 * roster panel reuses the theme's .pf-find-* rules as they are — they hang
 * under whatever is position:relative above them, which here is
 * .po-subject. */
export const poCss = `
.row100k .po-probe{position:absolute;left:-9999px;top:0;font-size:100px;line-height:normal;white-space:nowrap;visibility:hidden;pointer-events:none}
.row100k .po-strut{display:inline-block;width:0;height:0;overflow:hidden}
.row100k .po-probe.blk{font-family:var(--row-archivo-black),sans-serif}
.row100k .po-probe.mn{font-family:var(--row-mono),monospace}
.row100k .po-probe.arc{font-family:var(--row-archivo),sans-serif}

.row100k .po-subject{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px}
.row100k .po-subject .pf-find{top:calc(100% + 4px)}
.row100k .po-groups{display:flex;flex-wrap:wrap;gap:6px 30px;margin:20px 0 0}
.row100k .po-group .tabs{margin-bottom:0}
.row100k .po-eye{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gray);margin:0 0 8px}
.row100k .po-opts{margin:14px 0 0}
.row100k .po-opts button:disabled{opacity:.35;cursor:default}
.row100k .po-opts .po-sep{color:var(--line);padding:6px 0 4px;font-family:var(--row-mono),monospace;font-size:11px}

.row100k .po-frame{position:relative;display:block;border:2px solid var(--ink);background:var(--paper);overflow:hidden;margin-top:20px;max-width:100%}
.row100k .po-frame img{display:block;width:100%;height:100%;object-fit:contain}
.row100k .po-wait{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gray)}
.row100k .po-status{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--water);margin:12px 0 0;line-height:1.7}
.row100k .po-notes{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin:8px 0 0;line-height:1.9}
.row100k .po-notes li{list-style:none}

.row100k .po-acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.row100k .po-btn{appearance:none;-webkit-appearance:none;border:2px solid var(--ink);border-radius:0;background:none;color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:13px 18px;margin:0;cursor:pointer}
.row100k .po-btn:hover{border-color:var(--water);color:var(--water)}
.row100k .po-btn.primary{background:var(--water);border-color:var(--water);color:#fff}
.row100k .po-btn.primary:hover{background:var(--water-hover);border-color:var(--water-hover);color:#fff}
.row100k .po-btn:disabled{opacity:.45;cursor:default}
.row100k .po-btn:focus{outline:none}
.row100k .po-btn:focus-visible{outline:2px solid var(--water);outline-offset:3px}

.row100k .po-log{font-family:var(--row-mono),monospace;font-size:11px;line-height:1.8;color:var(--ink-soft);margin-top:20px;border-top:1px dashed var(--line);padding-top:12px;font-variant-numeric:tabular-nums}
.row100k .po-log .k{color:var(--gray);letter-spacing:.12em;text-transform:uppercase;font-size:10px}
.row100k .po-log .neg{color:#b3400f;font-weight:700}
.row100k .po-log details{margin-top:10px}
.row100k .po-log summary{cursor:pointer;color:var(--water);letter-spacing:.12em;text-transform:uppercase;font-size:10px}
.row100k .po-log pre{white-space:pre-wrap;word-break:break-word;font-size:10px;line-height:1.6;max-height:50vh;overflow:auto;margin-top:8px}
.row100k .po-first{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--water);font-weight:700;margin-top:18px}
@media (max-width:599px){
  .row100k .po-btn{padding:14px 16px}
  .row100k .po-acts .po-btn.primary{flex:1 1 auto}
}
`;
