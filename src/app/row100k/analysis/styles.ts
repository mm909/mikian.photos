/* Page-local CSS for /row100k/analysis, rendered as a second style tag
 * after the shared theme. Same contract as theme.ts: this string is the
 * text child of a style element, so it must contain no double quotes, no
 * apostrophes and no angle brackets — comments included. Everything is
 * scoped under .row100k and prefixed an- so nothing leaks either way.
 *
 * The one colour rule of the page: field marks are grey and ink over a pale
 * water tint; solid water-blue appears only on the viewer, so the .y line
 * in a tile is the only blue type below the masthead. */
export const analysisCss = `
.row100k .an-mast{padding:36px 0 0}
.row100k .an-eyebrow{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.16em;color:var(--gray);text-transform:uppercase}
.row100k .an-mast h1{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(36px,9vw,66px);line-height:.95;text-transform:uppercase;letter-spacing:-.02em;margin-top:8px}
.row100k .an-mast h1 .o{color:var(--water)}
.row100k .an-mast .sub{margin-top:14px;max-width:58ch;color:var(--ink-soft);font-size:15px}
.row100k .an-pill{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:22px}
.row100k .an-pill .tabs{margin-bottom:0}
.row100k .an-pill .hint{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--gray);text-transform:uppercase;text-decoration:underline;text-underline-offset:3px}
.row100k .an-pill button.hint{background:none;border:none;cursor:pointer;padding:0}
.row100k .an-pill .hint:hover{color:var(--water)}
.row100k .an-who{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--water)}
.row100k .an-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px}
@media(max-width:640px){.row100k .an-tiles{grid-template-columns:1fr 1fr}}
@media(max-width:420px){.row100k .an-tiles{grid-template-columns:1fr}}
.row100k .an-tile{border:2px solid var(--ink);padding:14px 14px 12px;min-width:0}
.row100k .an-tile .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(19px,4.6vw,27px);line-height:1.08;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.row100k .an-tile .d{font-size:12px;line-height:1.5;color:var(--ink-soft);margin-top:7px}
.row100k .an-tile .y{font-family:var(--row-mono),monospace;font-size:11px;color:var(--water);margin-top:8px;padding-top:7px;border-top:1px dashed var(--line);line-height:1.5}
.row100k .curve.an-chart{margin-top:24px}
.row100k .an-take{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;color:var(--ink-soft);text-transform:uppercase;margin-top:10px;line-height:1.8}
.row100k .an-take b{color:var(--ink);font-weight:700}
.row100k .an-foot{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.06em;color:var(--gray);margin-top:4px;line-height:1.7;text-transform:uppercase}
.row100k .an-foot.you{color:var(--water)}
.row100k .an-empty{font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray);padding:18px 0;line-height:1.8}
.row100k .an-note{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.06em;color:var(--gray);margin-top:16px;line-height:1.7;text-transform:uppercase}
`;
