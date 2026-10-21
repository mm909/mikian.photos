/* /lasd26/stickers — the sticker frame on the cream paper (owner,
 * 2026-10-21). Passed through LasdPage's extraCss; every rule sits under
 * .lasd26 .st-*. The pickers are square paper chips, the pressed one ink;
 * the canvas sits on a checker so a clear look shows as clear; the exits
 * are the landing's hard-edged buttons, 44 px tall for a thumb. */

export const stickersCss = `
.lasd26 .st-top{padding:36px 0 56px}
.lasd26 .st-frame{margin-top:4px}
.lasd26 .st-pick{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.lasd26 .st-pick button{border:2px solid var(--ink);border-radius:0;background:transparent;color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:8px 12px;min-height:36px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.lasd26 .st-pick button:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .st-pick button[aria-pressed=true]{background:var(--ink);color:var(--safety);border-color:var(--ink)}
.lasd26 .st-pick.fam{margin-bottom:14px;padding-bottom:14px;border-bottom:1px dashed var(--line)}
.lasd26 .st-pick.fam button{font-size:12px;padding:10px 14px;min-height:44px}
.lasd26 .st-pick.looks{flex-wrap:nowrap}
.lasd26 .st-pick.looks button{flex:1 1 0;min-width:0;padding:7px 4px;font-size:10px;letter-spacing:.06em;line-height:1.25;white-space:normal}
.lasd26 .st-field{display:flex;flex-direction:column;gap:6px;margin:4px 0 14px;max-width:260px}
.lasd26 .st-field .mono{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.lasd26 .st-field input{width:100%;min-height:44px;border:none;border-bottom:2px solid var(--ink);background:transparent;font-family:var(--lasd-mono),monospace;font-size:16px;padding:6px 2px;border-radius:0;appearance:none;color:var(--ink)}
.lasd26 .st-field input:focus{outline:none;border-bottom-color:var(--safety-ink)}
.lasd26 .st-frame canvas{display:block;width:100%;max-width:460px;height:auto;margin:0 auto;border:2px solid var(--ink)}
.lasd26 .st-frame canvas.clear{background:repeating-conic-gradient(#d9d8d0 0 25%,#e9e8e1 0 50%) 0 0/24px 24px}
.lasd26 .st-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.lasd26 .st-btns button{flex:1 1 auto;min-height:44px;border:2px solid var(--ink);border-radius:0;background:transparent;color:var(--ink);font-family:var(--lasd-archivo-black),sans-serif;font-size:15px;letter-spacing:.06em;text-transform:uppercase;padding:10px 14px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.lasd26 .st-btns button.primary{background:var(--safety);border-color:var(--safety);color:#111}
.lasd26 .st-btns button:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .st-btns button.primary:hover{background:var(--safety-hover);border-color:var(--safety-hover);color:#111}
.lasd26 .st-btns.deck{margin-top:8px}
.lasd26 .st-btns.deck button{font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;border-color:var(--line);color:var(--ink-soft)}
.lasd26 .st-btns.deck button:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .st-btns button:disabled{opacity:.5;cursor:default}
.lasd26 .st-msg{margin-top:10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--safety-ink);min-height:1.4em}
.lasd26 .st-probe{position:absolute;left:-9999px;top:0;visibility:hidden}
.lasd26 .st-probe.d{font-family:var(--lasd-archivo-black),sans-serif}
.lasd26 .st-probe.b{font-family:var(--lasd-archivo),sans-serif}
.lasd26 .st-probe.m{font-family:var(--lasd-mono),monospace}
/* The sign-in / invite notices, the info sheet's (infoCss.ts .if-notice),
 * for a visitor who is not on the team. */
.lasd26 .if-notice{border:2px solid var(--ink);padding:24px 20px;margin-top:6px;font-family:var(--lasd-mono),monospace;font-size:13px;line-height:1.8}
.lasd26 .if-notice strong{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:22px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;line-height:1.1;margin-bottom:10px}
.lasd26 .if-go{display:inline-block;margin-top:18px;min-height:46px;background:var(--safety);color:#111;border:2px solid #111;font-family:var(--lasd-archivo-black),sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.04em;padding:10px 20px;cursor:pointer}
.lasd26 .if-go:hover{background:var(--safety-hover)}
`;
