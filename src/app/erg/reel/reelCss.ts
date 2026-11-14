/* The reel studio's sheet. Phone first: one column, the preview on top;
 * two columns from 820 px with the preview held in view. */
export const reelCss = `
.eg .rl{margin:0 0 28px}
.eg .rl-tabs{display:flex;gap:0;border:1px solid var(--eg-fg);width:max-content;max-width:100%;margin:0 0 16px}
.eg .rl-tabs button{font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:11px 16px;min-height:44px;background:transparent;color:var(--eg-fg);border:0;cursor:pointer}
.eg .rl-tabs button.on{background:var(--eg-fg);color:var(--eg-bg,#f3ecdd)}
.eg .rl-grid{display:grid;gap:20px}
.eg .rl-stage{min-width:0}
.eg .rl-frame{display:flex;justify-content:center;background:#15171a;padding:10px}
.eg .rl-frame canvas{display:block;height:auto;width:auto;max-width:100%;max-height:58vh}
.eg .rl-check canvas{background:repeating-conic-gradient(#8a8a8a 0% 25%,#b5b5b5 0% 50%) 50%/28px 28px}
.eg .rl-bar{height:4px;background:var(--eg-line);margin-top:0}
.eg .rl-bar i{display:block;height:100%;background:var(--eg-accent)}
.eg .rl-field{display:flex;align-items:center;gap:12px;margin:10px 0 0;font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-3)}
.eg .rl-field span{flex:0 0 auto;min-width:44px}
.eg .rl-field input[type=range]{flex:1;min-width:0;height:32px;accent-color:var(--eg-accent)}
.eg .rl-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.eg .rl-actions .eg-btn{min-height:46px}
.eg .rl-go{background:var(--eg-fg);color:var(--eg-bg,#f3ecdd)}
.eg .rl-go:disabled{background:transparent}
.eg .rl-out{margin-top:14px;border:1px solid var(--eg-fg);padding:12px}
.eg .rl-out b{font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700}
.eg .rl-note{margin-top:10px;font-size:14px;color:var(--eg-fg-3)}
.eg .rl-controls section{border-top:1px solid var(--eg-line);padding:14px 0 16px}
.eg .rl-controls h2{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;margin:0 0 10px}
.eg .rl-controls h2 em{font-style:normal;font-weight:400;color:var(--eg-fg-3);letter-spacing:.06em;margin-left:6px}
.eg .rl-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.eg .rl-chips:last-child{margin-bottom:0}
.eg .rl-chip{display:inline-flex;align-items:center;gap:8px;font-family:var(--eg-archivo),sans-serif;font-weight:600;font-size:14px;min-height:42px;padding:8px 14px;background:transparent;color:var(--eg-fg);border:1px solid var(--eg-line);cursor:pointer;text-align:left}
.eg .rl-chip.on{border-color:var(--eg-fg);background:var(--eg-fg);color:var(--eg-bg,#f3ecdd)}
.eg .rl-chip:disabled{opacity:.45;cursor:default}
.eg .rl-sw{width:16px;height:16px;border:1px solid var(--eg-line);flex:0 0 auto}
.eg .rl-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.eg .rl-row .rl-chips{margin:0}
.eg .rl-num{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--eg-line);padding:0 10px;min-height:42px;font-family:var(--eg-mono),monospace;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--eg-fg-3)}
.eg .rl-num input{width:56px;border:0;background:transparent;color:var(--eg-fg);font:700 16px var(--eg-mono),monospace;padding:8px 0;outline:none;-moz-appearance:textfield}
.eg .rl-num.wide input{width:96px}
.eg .rl-num:focus-within{border-color:var(--eg-fg)}
.eg .rl-file{position:relative;overflow:hidden;min-height:44px;margin:0 8px 8px 0}
.eg .rl-file input{position:absolute;inset:0;opacity:0;cursor:pointer}
.eg .rl-sub{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3);margin:10px 0 6px}
.eg .rl-sub:first-of-type{margin-top:0}
.eg .rl-text{width:100%;max-width:420px;min-height:44px;border:1px solid var(--eg-line);background:transparent;color:var(--eg-fg);font:600 16px var(--eg-archivo),sans-serif;padding:8px 12px;text-transform:uppercase}
.eg .rl-text:focus{outline:none;border-color:var(--eg-fg)}
.eg .rl-files{list-style:none;margin:10px 0 0;padding:0;font-family:var(--eg-mono),monospace;font-size:12px}
.eg .rl-files li{padding:6px 0;border-top:1px solid var(--eg-line);overflow-wrap:anywhere}
.eg .rl-files a{color:var(--eg-fg)}
@media (min-width:820px){
  .eg .rl-grid{grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:32px;align-items:start}
  .eg .rl-stage{position:sticky;top:16px}
  .eg .rl-frame canvas{max-height:70vh}
}
`;
