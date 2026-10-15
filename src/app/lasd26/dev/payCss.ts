/* /lasd26/pay — SETTLE UP. Page-specific rules only; the frame, bar, type
 * and tokens come from theme.ts through LasdPage. Same paper, same ink:
 * the share is the one big number on the page (Archivo Black, tabular),
 * everything around it is a mono label. Lime (--safety) is a FILL colour;
 * anything written on the paper in green uses --safety-ink. */

export const payCss = `
.lasd26 .pay-sec{padding-top:40px}

/* The owner's note on top while settling up is closed: ink on the paper so
 * it reads as his, not the team's. */
.lasd26 .pay-owner{background:var(--ink);color:var(--paper);padding:13px 16px;font-size:12px;letter-spacing:.04em;line-height:1.7;margin-bottom:22px}
.lasd26 .pay-owner a{color:var(--safety);text-decoration:underline;text-underline-offset:3px}

/* YOUR SHARE */
.lasd26 .pay-share{border:2px solid var(--ink);padding:22px 20px 24px}
.lasd26 .pay-share .k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.lasd26 .pay-share .n{font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(52px,16vw,96px);line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:8px;word-break:break-word}
.lasd26 .pay-share .m{font-size:13px;color:var(--ink-soft);margin-top:12px;line-height:1.7}
.lasd26 .pay-share .m b{font-weight:700;color:var(--safety-ink)}
.lasd26 .pay-share .est{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--gray);margin-top:8px;line-height:1.7}
.lasd26 .pay-share .est b{color:var(--safety-ink);font-weight:700}

/* PAID — the deep green, the only green type on the paper. */
.lasd26 .pay-paid{border:2px solid var(--safety-ink);color:var(--safety-ink);padding:22px 20px;margin-top:22px;font-size:13px;line-height:1.8}
.lasd26 .pay-paid .big{font-family:var(--lasd-archivo-black),sans-serif;font-size:28px;line-height:1;text-transform:uppercase;letter-spacing:.02em;margin-bottom:8px}

/* The PayPal button and its lines. PayPal draws the button; we keep it to
 * the width of a phone so it does not stretch across the 720 wrap. */
.lasd26 .pay-box{margin-top:22px;max-width:420px}
.lasd26 .pay-note{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin:0 0 12px;line-height:1.7}
.lasd26 .pay-note b{color:var(--ink);font-weight:700}
.lasd26 .pay-err{margin-top:12px;font-size:12px;color:#b3400f;line-height:1.7;border-left:3px solid #b3400f;padding-left:11px}
.lasd26 .pay-alt{margin-top:24px;font-size:12px;color:var(--ink-soft);line-height:1.8;letter-spacing:.02em}
.lasd26 .pay-alt a{text-decoration:underline;text-underline-offset:3px}
.lasd26 .pay-alt a:hover{color:var(--safety-ink)}

/* Calm notices: sign in, not on the team, settling up not open yet. */
.lasd26 .pay-notice{border:2px dashed #c9c8c0;padding:26px 20px;font-size:14px;color:var(--ink-soft);line-height:1.65}
.lasd26 .pay-notice b{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(20px,5.4vw,26px);line-height:1.1;text-transform:uppercase;color:var(--ink);margin-bottom:8px}
.lasd26 .pay-notice a{text-decoration:underline;text-underline-offset:3px}
.lasd26 .pay-notice a:hover{color:var(--safety-ink)}
.lasd26 .pay-notice .mono{display:block;margin-top:12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray)}
`;
