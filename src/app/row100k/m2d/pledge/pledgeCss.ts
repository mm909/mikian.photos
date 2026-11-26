/* THE PLEDGE PAGES (m2d/pledge, dev/m2d-pledges), on top of m2dCss. The
 * same rules as that string: site variables only, no double quotes, no
 * apostrophes, no angle brackets, no ampersands. */
export const pledgeCss = `
.row100k .pl-card{margin:22px 0 0;max-width:560px;border:2px solid var(--ink);padding:18px 18px 16px;background:var(--paper)}
.row100k .pl-card.declined{opacity:.55}
.row100k .pl-status{display:flex;justify-content:space-between;gap:12px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .pl-card.approved .pl-status span:first-child,.row100k .pl-card.claimed .pl-status span:first-child{color:var(--water)}
.row100k .pl-rate{margin-top:8px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(48px,12vw,84px);line-height:1;letter-spacing:-.02em;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .pl-rate small{font-size:20px;letter-spacing:0;color:var(--ink);text-transform:uppercase}
.row100k .pl-cap{margin-top:8px;font-size:17px;color:var(--ink)}
.row100k .pl-cap b{font-family:var(--row-archivo-black),sans-serif;font-weight:400}
.row100k .pl-cap span{color:var(--gray)}
.row100k .pl-bar{margin-top:16px;height:14px;border:1px solid var(--ink)}
.row100k .pl-bar i{display:block;height:100%;background:var(--water);transition:width .4s}
.row100k .pl-fill{display:flex;justify-content:space-between;gap:12px;margin-top:8px;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}
.row100k .pl-fill b{color:var(--ink)}
.row100k .pl-form{margin-top:30px;max-width:560px}
.row100k .pl-q{margin-top:22px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.row100k .pl-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.row100k .pl-chips button{flex:1 1 0;min-width:72px;background:none;border:1px solid var(--ink);border-radius:0;padding:12px 8px;font-family:var(--row-archivo-black),sans-serif;font-size:17px;color:var(--ink);cursor:pointer}
.row100k .pl-chips button.on{background:var(--water);border-color:var(--water);color:#fff}
.row100k .pl-in{display:flex;align-items:baseline;gap:8px;margin-top:10px;border-bottom:2px solid var(--ink);padding-bottom:4px}
.row100k .pl-in span{font-family:var(--row-archivo-black),sans-serif;font-size:22px;color:var(--gray)}
.row100k .pl-in input{flex:1;min-width:0;border:0;outline:0;background:none;font-family:var(--row-archivo-black),sans-serif;font-size:30px;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .pl-in input.txt{font-family:var(--row-archivo),sans-serif;font-size:19px;font-weight:700;color:var(--ink)}
.row100k .pl-check{display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:14px;line-height:1.45;color:var(--ink);cursor:pointer}
.row100k .pl-check input{width:18px;height:18px;margin-top:1px;accent-color:var(--water);flex:none}
.row100k .pl-say{margin-top:14px;font-size:14px;line-height:1.5;color:var(--gray)}
.row100k .pl-say.err{color:var(--ink);font-weight:700}
.row100k .pl-form .m2-go{margin-top:24px}
.row100k .pl-mine{margin-top:34px;max-width:560px}
.row100k .pl-split{margin-top:10px;font-family:var(--row-mono),monospace;font-size:11px;line-height:1.7;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}
.row100k .pl-admin{margin-top:26px}
.row100k .pl-admin h2{margin-top:30px}
.row100k .pl-who{margin-top:10px;font-size:14px;line-height:1.5;color:var(--gray)}
.row100k .pl-who b{color:var(--ink)}
.row100k .pl-acts{display:flex;gap:10px;margin-top:12px}
.row100k .pl-acts button{background:none;border:2px solid var(--ink);border-radius:0;padding:10px 18px;font-family:var(--row-archivo-black),sans-serif;font-size:15px;text-transform:uppercase;color:var(--ink);cursor:pointer}
.row100k .pl-acts button.yes{background:var(--water);border-color:var(--water);color:#fff}
.row100k .pl-acts button:disabled{opacity:.5;cursor:default}
.row100k .pl-links{margin-top:14px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.row100k .pl-links a{color:var(--water);margin-right:14px}
`;
