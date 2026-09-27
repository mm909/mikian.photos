/* The emails page (emails/page.tsx), .em- prefix, theme.ts untouched.
 * Rendered as the text of a style element, so this template carries no
 * quotes, angle brackets or ampersands. */
export const emailsCss = `
.row100k .em{padding-top:28px;padding-bottom:40px}
.row100k .em .em-words{display:inline-flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.row100k .em .em-words .dot{color:var(--gray);font-weight:400}
.row100k .em-env{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px 14px;margin:0 0 18px;padding:0}
.row100k .em-env dt{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);padding-top:3px}
.row100k .em-env dd{margin:0;font-size:14px;line-height:1.45;color:var(--ink);overflow-wrap:anywhere}
.row100k .em-env dd.subj{font-weight:700}
.row100k .em-frame{display:block;width:100%;border:1px solid var(--ink);background:#F4F3EE}
.row100k .em-text{margin:0;padding:18px 16px;border:1px solid var(--ink);background:#ffffff;font-family:var(--row-mono),monospace;font-size:12.5px;line-height:1.6;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere}
.row100k .em-plain{margin-top:18px}
.row100k .em-plain summary{list-style:none;cursor:pointer;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);margin-bottom:10px}
.row100k .em-plain summary::-webkit-details-marker{display:none}
.row100k .em-plain summary:hover{color:var(--water)}
.row100k .em-plain[open] summary{color:var(--ink)}
@media (max-width:560px){.row100k .em-env{grid-template-columns:64px minmax(0,1fr)}}
`;
