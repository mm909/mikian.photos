/* Race day styles — .rd- prefix, theme.ts untouched (the landing page owns
 * the design language: newspaper on cream, water blue for the lead number,
 * thick black rules, mono datelines).
 *
 * Rendered as the text child of a style tag, so the string carries NO
 * double quotes, no apostrophes, no angle brackets and no ampersands —
 * React escapes those server-side only and hydration then fails on the
 * mismatch (the note in theme.ts). Its own module so the page and the
 * scratchpad render harness style the same markup from one copy. */
export const rdCss = `
.row100k .rd-dev{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);border-bottom:1px dashed var(--line);padding-bottom:12px;margin-bottom:22px}

.row100k .rd-stub{border:2px solid var(--ink);padding:clamp(24px,5vw,38px) clamp(18px,4vw,32px) clamp(26px,5vw,34px)}
.row100k .rd-eye{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gray);margin:0}
.row100k .rd-when{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(36px,11vw,66px);line-height:.96;letter-spacing:-.02em;text-transform:uppercase;color:var(--water);margin:12px 0 0}
.row100k .rd-facts{list-style:none;margin:22px 0 0;padding:18px 0 0;border-top:2px solid var(--ink);display:grid;gap:11px 26px;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.row100k .rd-facts li{display:flex;align-items:baseline;gap:10px;min-width:0}
.row100k .rd-facts .k{flex:none;width:62px;color:var(--gray)}
.row100k .rd-facts .v{font-weight:700;color:var(--ink);min-width:0;letter-spacing:.06em;overflow-wrap:anywhere}
.row100k .rd-facts .v a{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .rd-facts .v a:hover{color:var(--ink)}
.row100k .rd-blurb{font-size:15px;line-height:1.7;color:var(--ink-soft);max-width:60ch;margin:22px 0 0}
.row100k .rd-closes{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin:16px 0 0}
@media(min-width:640px){.row100k .rd-facts{grid-template-columns:1fr 1fr}}

.row100k .rd-act{border:2px solid var(--ink);padding:clamp(22px,5vw,30px) clamp(18px,4vw,26px) clamp(24px,5vw,30px);margin-top:24px}
.row100k .rd-act.in{border-color:var(--water)}
.row100k .rd-lede{font-size:15px;line-height:1.7;color:var(--ink-soft);max-width:52ch;margin:10px 0 0}
.row100k .rd-act .send{margin-top:22px}
.row100k .rd-you{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8.4vw,58px);line-height:1;letter-spacing:-.02em;text-transform:uppercase;color:var(--water);margin:12px 0 0}
.row100k .rd-wave{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);font-weight:700;margin:14px 0 0}
.row100k .rd-small{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin:12px 0 0;line-height:1.8}
.row100k .rd-two{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:22px;padding-top:18px;border-top:1px dashed var(--line)}
.row100k .rd-two .mono{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}

/* THE WAIVER: the tick that rides with the entry, and the strip that asks
 * again afterwards for anyone who has not got to it (owner sent the link
 * 2026-09-11). Never a gate, so it is never styled as an error. */
.row100k .rd-check{display:flex;align-items:flex-start;gap:10px;margin-top:20px;font-size:14px;line-height:1.6;color:var(--ink-soft);cursor:pointer}
.row100k .rd-check input{flex:none;width:18px;height:18px;margin:2px 0 0;accent-color:var(--water)}
.row100k .rd-check a{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .rd-check a:hover{color:var(--ink)}
.row100k .rd-waiver{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px dashed var(--line)}
.row100k .rd-wlink{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--water);text-decoration:underline;text-underline-offset:4px}
.row100k .rd-wlink:hover{color:var(--ink)}

.row100k .rd-br{margin-top:30px}
.row100k .rd-br:first-of-type{margin-top:0}
.row100k table.board.rd-t td.wv{color:var(--water);font-weight:700}
.row100k table.board.rd-t td.t5{font-variant-numeric:tabular-nums}
.row100k table.board.rd-t .none{color:var(--gray);font-weight:400}
/* The brackets are separate tables, so their columns are pinned to the same
 * widths — otherwise one long name in the men shunts their FASTEST 5K
 * header out of line with the women below it. */
.row100k table.board.rd-t th:nth-child(3),.row100k table.board.rd-t td:nth-child(3){width:112px}
.row100k table.board.rd-t th:nth-child(4),.row100k table.board.rd-t td:nth-child(4){width:64px}
.row100k .rd-foot{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin:26px 0 0;line-height:1.9;border-top:2px solid var(--ink);padding-top:16px}
@media(max-width:520px){
  .row100k table.board.rd-t td,.row100k table.board.rd-t th{padding-left:4px;padding-right:4px}
  .row100k .rd-facts .k{width:52px}
}
`;
