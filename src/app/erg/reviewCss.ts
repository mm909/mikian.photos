/* THE REVIEW SHEET (owner, 2026-09-17: "I really want to emphasise the
 * post hoc analysis screen"). What the erg skeleton in ergTheme.ts does
 * not have: the big head of a finished piece, THE READ block, the numbers
 * strip, the chart panels, the splits table and the sessions list.
 *
 * It colours itself entirely off the same variables the skeleton uses, so
 * it would read on the ink ground too; in practice both surfaces that
 * wear it are .eg-paper — cream, ink, water blue as the one accent.
 *
 * MONOCHROME PLUS THE ONE BLUE. A chart tells its series apart by weight
 * and dash, not by hue; blue is the piece being read and grey is
 * everything it is measured against.
 *
 * HOUSE RULE: this string is the text child of a style tag, so there are
 * no double quotes, apostrophes, angle brackets or ampersands anywhere in
 * it, these comments included. */

export const reviewCss = `
.eg .rv-top{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;margin:26px 0 6px}
.eg .rv-title{font-family:var(--eg-black),sans-serif;font-size:22px;line-height:1.15;letter-spacing:-.01em;max-width:30ch}
.eg .rv-eyebrow{display:block;font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3);margin-bottom:6px}
.eg .rv-time{font-family:var(--eg-black),sans-serif;font-size:76px;line-height:.92;letter-spacing:-.03em;color:var(--eg-accent);font-variant-numeric:tabular-nums;display:block}
.eg .rv-headline{display:flex;gap:28px;flex-wrap:wrap;align-items:flex-end;border-bottom:1px solid var(--eg-line);padding-bottom:14px}
.eg .rv-big{font-family:var(--eg-black),sans-serif;font-size:30px;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;display:block}
.eg .rv-k{display:block;font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-3);margin-bottom:5px}
.eg .rv-meta{font-family:var(--eg-mono),monospace;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--eg-fg-3);margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap}
.eg .rv-meta span{white-space:nowrap}
.eg .rv-flag{border:1px solid var(--eg-line);border-radius:2px;padding:1px 6px;color:var(--eg-fg-2)}

.eg .rv-read{border:1px solid var(--eg-fg);border-radius:3px;background:var(--eg-panel);padding:18px 20px;margin:24px 0}
.eg .rv-read h2{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--eg-fg-3);font-weight:400;margin-bottom:10px}
.eg .rv-read p{font-size:17px;line-height:1.5;max-width:72ch;margin-bottom:9px}
.eg .rv-read p:last-child{margin-bottom:0}
.eg .rv-read p:first-of-type{font-family:var(--eg-black),sans-serif;font-size:19px;line-height:1.35}

.eg .rv-next{border-left:3px solid var(--eg-accent);padding:4px 0 4px 16px;margin:26px 0}
.eg .rv-next h2{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--eg-fg-3);font-weight:400;margin-bottom:8px}
.eg .rv-next p{font-size:16px;line-height:1.5;max-width:72ch;color:var(--eg-fg-2);margin-bottom:8px}
.eg .rv-next p:last-child{margin-bottom:0}

.eg .rv-sec{margin:34px 0 0}
.eg .rv-sec h2{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--eg-fg-3);font-weight:400;border-bottom:1px solid var(--eg-line-soft);padding-bottom:7px;margin-bottom:14px}
.eg .rv-sec h2 em{font-style:normal;color:var(--eg-fg-4);letter-spacing:.1em}

.eg .rv-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--eg-line-soft);border:1px solid var(--eg-line-soft);border-radius:3px;overflow:hidden}
.eg .rv-cell{background:var(--eg-panel);padding:12px 13px 13px}
.eg .rv-cell .rv-v{font-family:var(--eg-black),sans-serif;font-size:24px;line-height:1.05;font-variant-numeric:tabular-nums;display:block}
.eg .rv-strip-4{grid-template-columns:repeat(4,1fr)}
.eg .rv-cell .rv-u{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--eg-fg-4);display:block;margin-top:4px}

.eg .rv-panels{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.eg .rv-panel{border:1px solid var(--eg-line-soft);border-radius:3px;background:var(--eg-panel);padding:12px 14px 10px}
.eg .rv-panel .rv-ptitle{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;justify-content:space-between;font-family:var(--eg-mono),monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-3);margin-bottom:6px}
.eg .rv-panel .rv-ptitle b{color:var(--eg-fg);letter-spacing:.14em}
.eg .rv-wide{grid-column:1 / -1}

.eg .rv-svg{width:100%;height:auto;display:block;overflow:visible}
.eg .rv-svg .grid{stroke:var(--eg-line-soft);stroke-width:1}
.eg .rv-svg .axis{stroke:var(--eg-line);stroke-width:1}
.eg .rv-svg .ax{fill:var(--eg-fg-4);font-family:var(--eg-mono),monospace;font-size:8px;letter-spacing:.06em}
.eg .rv-svg .axl{fill:var(--eg-fg-4);font-family:var(--eg-mono),monospace;font-size:7.5px;letter-spacing:.14em;text-transform:uppercase}
.eg .rv-svg .bar{fill:var(--eg-accent)}
.eg .rv-svg .bar-hi{fill:var(--eg-fg-4)}
.eg .rv-svg .barlab{fill:var(--eg-fg-3);font-family:var(--eg-mono),monospace;font-size:7.5px}
.eg .rv-svg .ln{fill:none;stroke:var(--eg-accent);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}
.eg .rv-svg .ln2{fill:none;stroke:var(--eg-fg-3);stroke-width:1.4;stroke-dasharray:5 4;stroke-linejoin:round}
.eg .rv-svg .ref{stroke:var(--eg-fg-3);stroke-width:1;stroke-dasharray:4 4}
.eg .rv-svg .trend{fill:none;stroke:var(--eg-fg);stroke-width:1.4;stroke-dasharray:6 4}
.eg .rv-svg .area{fill:var(--eg-accent);fill-opacity:.14}
.eg .rv-svg .dot{fill:var(--eg-accent)}
.eg .rv-svg .dots{fill:var(--eg-fg-4)}
.eg .rv-svg .peak{fill:var(--eg-fg);font-family:var(--eg-mono),monospace;font-size:8.5px;letter-spacing:.06em}
.eg .rv-svg .empty{fill:var(--eg-fg-4);font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.14em}

.eg .rv-tablewrap{border:1px solid var(--eg-line-soft);border-radius:3px;background:var(--eg-panel);overflow-x:auto}
.eg .rv-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.eg .rv-table th{text-align:right;font-family:var(--eg-mono),monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--eg-fg-3);font-weight:400;padding:9px 12px;border-bottom:1px solid var(--eg-line);white-space:nowrap}
.eg .rv-table td{text-align:right;padding:8px 12px;border-bottom:1px solid var(--eg-line-soft);font-size:14px;white-space:nowrap}
.eg .rv-table tr:last-child td{border-bottom:0}
.eg .rv-table .lead{text-align:left;font-family:var(--eg-mono),monospace;font-size:12px;letter-spacing:.08em;color:var(--eg-fg-3)}
.eg .rv-table .lead .rv-open{color:var(--eg-fg);font-family:var(--eg-archivo),sans-serif;font-size:15px;letter-spacing:0;text-decoration:none;border-bottom:1px solid var(--eg-line)}
.eg .rv-table .lead .rv-open:hover{border-bottom-color:var(--eg-accent);color:var(--eg-accent)}
.eg .rv-table .pace{font-family:var(--eg-black),sans-serif;font-size:15px}
.eg .rv-table tr:hover td{background:rgba(127,127,127,.06)}

.eg .rv-acts{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:26px 0 8px;padding-top:18px;border-top:1px solid var(--eg-line-soft)}
.eg .rv-acts .rv-spacer{margin-left:auto}
.eg .rv-danger{border-color:#b23c2b;color:#b23c2b}
.eg .rv-danger:hover{background:#b23c2b;border-color:#b23c2b;color:#ffffff}

@media (max-width:820px){
  .eg .rv-panels{grid-template-columns:1fr}
  .eg .rv-strip{grid-template-columns:repeat(3,1fr)}
  .eg .rv-time{font-size:58px}
}
@media (max-width:520px){
  .eg .rv-strip{grid-template-columns:repeat(2,1fr)}
  .eg .rv-time{font-size:46px}
  .eg .rv-big{font-size:24px}
}
`;
