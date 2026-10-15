/**
 * The stickers page's stylesheet (/track/<slug>/share), appended after
 * theme.ts's baseCss so the dark tokens (--ground, --panel, --line, --text,
 * --muted) and .mono / .cond are there. Phone first: 16 px gutters, chips
 * and buttons at least 44 px tall, the canvas no wider than 420 px so a
 * 1080-wide sticker reads at phone scale. The Just Friends lime marks the
 * chosen chip and the primary exit — the one brand note on the page.
 *
 * The clear look previews over a LIGHT checker: its type is ink, and ink
 * on the dark page would vanish.
 *
 * Rendered as the text child of a style tag: no double quotes, no
 * apostrophes, no angle brackets and no ampersands in this string.
 */
export const shareCss = `
.trk .shr{max-width:720px;margin:0 auto;padding:0 16px 64px}
.trk .shr-head{display:flex;align-items:center;gap:12px;min-height:56px;padding-top:6px}
.trk .shr-back{display:inline-flex;align-items:center;min-height:44px;padding:0 10px 0 0;font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-decoration:none;white-space:nowrap;-webkit-tap-highlight-color:transparent}
.trk .shr-back:hover{color:var(--text)}
.trk .shr-head h1{flex:1;min-width:0;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:28px;line-height:1;letter-spacing:.04em;text-transform:uppercase}
.trk .shr-dev{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:12px;border:1px solid var(--line);font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--warn)}
.trk .shr-sub{margin:0 0 14px;font-size:11px}
.trk .shr-wait{margin:0 0 12px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;color:var(--muted);font-size:14px;line-height:1.45}
.trk .shr-wait.is-off{color:var(--warn);border-color:rgba(255,200,87,.5)}

/* THE STICKER PANEL: the pickers, the canvas, the exits. */
.trk .shr-stk{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
.trk .shr-lab{font-family:var(--trk-mono),ui-monospace,monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px}
.trk .shr-lab:first-child{margin-top:0}
.trk .shr-pick{display:flex;flex-wrap:wrap;gap:6px}
.trk .shr-pick button{display:inline-flex;align-items:center;gap:8px;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);-webkit-tap-highlight-color:transparent}
.trk .shr-pick button:hover{color:var(--text);border-color:var(--text)}
.trk .shr-pick button[aria-pressed=true]{background:#D0F858;border-color:#D0F858;color:#101214}
.trk .shr-pick button:disabled{opacity:.4;cursor:default;color:var(--muted);border-color:var(--line)}
/* The pulse on a chip whose card moves. */
.trk .shr-anim{display:inline-block;width:7px;height:7px;border-radius:50%;background:currentColor;animation:trkpulse 1.6s ease-in-out infinite}
.trk .shr-pick.looks{flex-wrap:nowrap;margin-bottom:12px}
.trk .shr-pick.looks button{flex:1 1 0;min-width:0;justify-content:center;padding:0 4px;font-size:11px;letter-spacing:.08em;line-height:1.2;white-space:normal}
.trk .shr-runner{display:block}
.trk .shr-sel{display:block;width:100%;min-height:44px;background:var(--ground);border:1px solid var(--line);border-radius:8px;color:var(--text);font:inherit;font-size:15px;padding:0 12px}
.trk .shr-sel:focus{outline:2px solid var(--text);outline-offset:2px}
.trk .shr-stk canvas{display:block;width:100%;max-width:420px;height:auto;margin:0 auto;border-radius:4px}
/* The clear look over a light checker, so ink type and the transparency both show. */
.trk .shr-stk canvas.clear{background:repeating-conic-gradient(#e6e6e1 0 25%,#cfcfc9 0 50%) 0 0/24px 24px}
.trk .shr-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.trk .shr-btns button{flex:1 1 auto;min-height:48px;border:1px solid var(--text);border-radius:8px;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:16px;letter-spacing:.06em;text-transform:uppercase;padding:0 14px;-webkit-tap-highlight-color:transparent}
.trk .shr-btns button:hover{border-color:#D0F858}
.trk .shr-btns button.primary{background:#D0F858;border-color:#D0F858;color:#101214}
.trk .shr-btns.video{flex-direction:column;align-items:stretch;gap:6px;margin-top:8px}
.trk .shr-btns.video button{border-style:dashed;border-color:#D0F858;color:#D0F858}
.trk .shr-btns.video button:hover{border-style:solid}
.trk .shr-video-note{margin:0;color:var(--muted);font-size:12px;line-height:1.45}
.trk .shr-btns.deck{margin-top:8px}
.trk .shr-btns.deck button{border-color:var(--line);color:var(--muted);font-size:13px;min-height:44px}
.trk .shr-btns.deck button:hover{color:var(--text)}
.trk .shr-btns button:disabled{opacity:.5;cursor:default}
.trk .shr-msg{margin:10px 0 0;font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);min-height:1.4em}
.trk .shr-probe{position:absolute;left:-9999px;top:0;visibility:hidden}
.trk .shr-probe.d{font-family:var(--trk-black),Impact,sans-serif}
.trk .shr-probe.c{font-family:var(--trk-cond),sans-serif;font-weight:600}
.trk .shr-probe.m{font-family:var(--trk-mono),ui-monospace,monospace;font-weight:500}
.trk .shr-note{margin-top:14px;color:var(--muted);font-size:13px;line-height:1.5}
`;
