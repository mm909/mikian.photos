/* /lasd26/pay — SETTLE UP. Page-specific rules only; the frame, bar, type
 * and tokens come from theme.ts through LasdPage. Same paper, same ink:
 * the statement is three numbers down the page (Archivo Black, tabular),
 * the last one big, everything around them a mono label. Lime (--safety)
 * is a FILL colour; anything written on the paper in green uses
 * --safety-ink. */

export const payCss = `
.lasd26 .pay-sec{padding-top:40px}

/* The owner's note on top while settling up is closed: ink on the paper so
 * it reads as his, not the team's. */
.lasd26 .pay-owner{background:var(--ink);color:var(--paper);padding:13px 16px;font-size:12px;letter-spacing:.04em;line-height:1.7;margin-bottom:22px}
.lasd26 .pay-owner a{color:var(--safety);text-decoration:underline;text-underline-offset:3px}

/* THE STATEMENT (owner, 2026-10-16: "I would have paid x but I already
 * spent y so now I owe z"): three rows in one ruled box — YOUR SHARE, YOU
 * FRONTED, then the answer, big. The share and the total are links to the
 * expenses page (owner: "if you click on the number that is your share or
 * the total it takes you to the expenses page") — plain ink, the underline
 * is the only tell, green on hover. */
.lasd26 .pay-stmt{border:2px solid var(--ink)}
.lasd26 .pay-stmt .row{padding:18px 20px 20px;border-bottom:1px solid var(--ink)}
.lasd26 .pay-stmt .row:last-child{border-bottom:none}
.lasd26 .pay-stmt .k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.lasd26 .pay-stmt .n{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(30px,9vw,48px);line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:6px;word-break:break-word;color:var(--ink);text-decoration:none}
.lasd26 .pay-stmt a.n{text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:3px;text-decoration-color:var(--safety)}
.lasd26 .pay-stmt a.n:hover{color:var(--safety-ink)}
.lasd26 .pay-stmt .row.big{background:var(--safety);color:#111}
.lasd26 .pay-stmt .row.big .k{color:#2a4d08}
.lasd26 .pay-stmt .row.big .n{font-size:clamp(52px,16vw,96px);color:#111}
.lasd26 .pay-stmt .row.big .m{color:#2a4d08}
.lasd26 .pay-stmt .m{font-size:13px;color:var(--ink-soft);margin-top:10px;line-height:1.7}
.lasd26 .pay-stmt .m a{text-decoration:underline;text-underline-offset:3px;font-weight:700;color:var(--safety-ink)}
.lasd26 .pay-stmt .m a:hover{color:var(--ink)}
.lasd26 .pay-stmt .est{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--gray);margin-top:8px;line-height:1.7}
.lasd26 .pay-stmt .est b{color:var(--safety-ink);font-weight:700}
/* The lines behind YOU FRONTED, small: title left, amount right. */
.lasd26 .pay-stmt .lines{list-style:none;margin-top:10px;font-size:12px;color:var(--ink-soft);line-height:1.9;letter-spacing:.02em}
.lasd26 .pay-stmt .lines li{display:flex;justify-content:space-between;gap:12px;border-top:1px dashed var(--line);padding:2px 0}
.lasd26 .pay-stmt .lines li span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}

/* PAID — the deep green, the only green type on the paper. */
.lasd26 .pay-paid{border:2px solid var(--safety-ink);color:var(--safety-ink);padding:22px 20px;margin-top:22px;font-size:13px;line-height:1.8}
.lasd26 .pay-paid .big{font-family:var(--lasd-archivo-black),sans-serif;font-size:28px;line-height:1;text-transform:uppercase;letter-spacing:.02em;margin-bottom:8px}

/* The card button and its lines. PayPal draws the button; we keep it to
 * the width of a phone so it does not stretch across the 720 wrap. */
.lasd26 .pay-box{margin-top:22px;max-width:420px}
.lasd26 .pay-note{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin:0 0 12px;line-height:1.7}
.lasd26 .pay-note b{color:var(--ink);font-weight:700}
.lasd26 .pay-err{margin-top:12px;font-size:12px;color:#b3400f;line-height:1.7;border-left:3px solid #b3400f;padding-left:11px}

/* Calm notices: sign in, not on the team, settling up not open yet. */
.lasd26 .pay-notice{border:2px dashed #c9c8c0;padding:26px 20px;font-size:14px;color:var(--ink-soft);line-height:1.65}
.lasd26 .pay-notice b{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:clamp(20px,5.4vw,26px);line-height:1.1;text-transform:uppercase;color:var(--ink);margin-bottom:8px}
.lasd26 .pay-notice a{text-decoration:underline;text-underline-offset:3px}
.lasd26 .pay-notice a:hover{color:var(--safety-ink)}
.lasd26 .pay-notice .mono{display:block;margin-top:12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray)}
`;
