/**
 * Page CSS for /lasd26/info, the info sheet (owner, 2026-10-16: "make a
 * info page where we can fill out addresses for airbnb, start line, van
 * pick up etc."). Passed through LasdPage's extraCss on top of the shared
 * stylesheet in theme.ts. Same paper, same tokens: lime (--safety) is a
 * FILL (the save button, the underline under a link), deep green
 * (--safety-ink) is for type and thin borders on the cream.
 *
 * Prefix: .if-. A clean read — each line is a mono eyebrow over body type,
 * dashed rules between them, inside the 720 px wrap. The owner's EDIT
 * pencil sits at the right of the eyebrow and turns the line into a
 * textarea with SAVE / CANCEL under it; a member sees no controls.
 */
export const infoCss = `
.lasd26 .if-lede{font-size:15px;color:var(--ink-soft);max-width:56ch;margin:-6px 0 10px}
.lasd26 .if-list{margin:0}
.lasd26 .if-item{padding:16px 0 18px;border-bottom:1px dashed var(--line)}
.lasd26 .if-item:last-child{border-bottom:none}
.lasd26 .if-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:28px}
.lasd26 .if-k{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--safety-ink)}
/* The pencil: a quiet mono word, grey until hovered, a thumb target in the
 * van (44 px tall, no visual box so the eyebrow row stays thin). */
.lasd26 .if-pencil{display:inline-flex;align-items:center;gap:6px;min-height:44px;margin:-10px -6px -10px 0;padding:0 6px;background:none;border:none;color:var(--gray);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.lasd26 .if-pencil:hover{color:var(--safety-ink)}
.lasd26 .if-pencil:disabled{opacity:.5;cursor:default}
.lasd26 .if-v{margin:8px 0 0;font-size:16px;line-height:1.65}
/* The value line by line (InfoSheet's Lines): a paragraph per blank line
 * with a gap between, a line as typed inside it, a bullet or a number
 * hanging in the margin so a wrapped rule stays indented; a measure of
 * ~64 characters so the Airbnb's house rules read as a page, not a slab;
 * long links broken rather than pushing the wrap. */
.lasd26 .if-text{max-width:64ch;overflow-wrap:anywhere}
.lasd26 .if-p{margin:0 0 14px}
.lasd26 .if-p:last-child{margin-bottom:0}
.lasd26 .if-line{white-space:pre-wrap}
.lasd26 .if-bullet{padding-left:1.35em;text-indent:-1.35em}
.lasd26 .if-text a{color:var(--ink);text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px;text-decoration-color:var(--safety)}
.lasd26 .if-text a:hover{color:var(--safety-ink)}
.lasd26 .if-empty{font-family:var(--lasd-mono),monospace;font-size:13px;color:var(--gray)}
.lasd26 .if-empty small{display:block;font-family:var(--lasd-archivo),sans-serif;font-size:13px;color:var(--gray);margin-top:2px}

/* Editing (owner only). */
.lasd26 .if-ta{display:block;width:100%;min-height:96px;border:2px solid var(--ink);background:transparent;color:var(--ink);font-family:var(--lasd-archivo),sans-serif;font-size:16px;line-height:1.5;padding:10px 12px;border-radius:0;appearance:none;resize:vertical}
.lasd26 .if-ta:focus{outline:none;border-color:var(--safety-ink)}
.lasd26 .if-ta::placeholder{color:var(--gray)}
.lasd26 .if-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}
.lasd26 .if-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 16px;cursor:pointer}
.lasd26 .if-btn:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .if-btn:disabled{opacity:.5;cursor:default;border-color:var(--ink);color:var(--ink)}
.lasd26 .if-btn.fill{background:var(--safety);border-color:#111;color:#111}
.lasd26 .if-btn.fill:hover{background:var(--safety-hover);color:#111}
.lasd26 .if-hint{font-family:var(--lasd-mono),monospace;font-size:11px;color:var(--gray);letter-spacing:.04em}
.lasd26 .if-err{font-family:var(--lasd-mono),monospace;font-size:12px;color:var(--safety-ink);margin-top:10px;letter-spacing:.04em}
.lasd26 .if-err::before{content:"! "}

/* Signed out / not on the team: the same box the expenses page shows. */
.lasd26 .if-notice{border:2px solid var(--ink);padding:24px 20px;margin-top:6px;font-family:var(--lasd-mono),monospace;font-size:13px;line-height:1.8}
.lasd26 .if-notice strong{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:22px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;line-height:1.1;margin-bottom:10px}
.lasd26 .if-go{display:inline-block;margin-top:18px;min-height:46px;background:var(--safety);color:#111;border:2px solid #111;font-family:var(--lasd-archivo-black),sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.04em;padding:10px 20px;cursor:pointer}
.lasd26 .if-go:hover{background:var(--safety-hover)}
`;
