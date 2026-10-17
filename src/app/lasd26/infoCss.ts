/**
 * Page CSS for /lasd26/info, the info sheet (owner, 2026-10-16: "make a
 * info page where we can fill out addresses for airbnb, start line, van
 * pick up etc."). Passed through LasdPage's extraCss on top of the shared
 * stylesheet in theme.ts. Same paper, same tokens: lime (--safety) is a
 * FILL (the save button, the underline under a link), deep green
 * (--safety-ink) is for type and thin borders on the cream, ink for the
 * one button that strikes a line.
 *
 * Prefix: .if-. A clean read — each line is a mono eyebrow over body type,
 * dashed rules between them, inside the 720 px wrap. The owner's tools
 * (owner, 2026-10-16, that night: "Allow me to add / remove notes on the
 * info page") sit at the right of the eyebrow: the EDIT pencil and REMOVE
 * as quiet mono words, 44 px tall; REMOVE's second step is "REMOVE THIS
 * LINE? · YES · NO" with a solid ink YES. On a phone the row wraps and the
 * tools drop under the eyebrow, kept to the right edge by their auto
 * margin — nothing overflows. EDIT
 * turns the line into a textarea (a note gets a LABEL input over it) with
 * SAVE / CANCEL under; "+ ADD A NOTE" is a dashed-top band under the list
 * with one outlined button, and the open form sits on the paper in an ink
 * border. A member sees no controls.
 */
export const infoCss = `
.lasd26 .if-lede{font-size:15px;color:var(--ink-soft);max-width:56ch;margin:-6px 0 10px}
.lasd26 .if-list{margin:0}
.lasd26 .if-item{padding:16px 0 18px;border-bottom:1px dashed var(--line)}
.lasd26 .if-item:last-child{border-bottom:none}
/* The eyebrow row wraps: the tools go to the right on one line, and under
 * the eyebrow when the width runs out (a note's long label on a phone). */
.lasd26 .if-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:2px 12px;min-height:28px}
.lasd26 .if-k{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--safety-ink);min-width:0;overflow-wrap:anywhere}
/* The tools: quiet mono words, grey until hovered, thumb targets in the
 * van (44 px tall, no visual box, pulled in by negative margins so the
 * eyebrow row stays thin). */
.lasd26 .if-tools{display:flex;flex-wrap:wrap;align-items:center;gap:0 2px;max-width:100%;margin:-8px -6px -8px auto}
.lasd26 .if-pencil{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 6px;background:none;border:none;color:var(--gray);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
.lasd26 .if-pencil:hover{color:var(--safety-ink)}
.lasd26 .if-pencil:disabled{opacity:.5;cursor:default}
/* REMOVE goes to ink, not green, on hover: it is the one word that takes a line away. */
.lasd26 .if-x:hover{color:var(--ink)}
/* The second step: the question and two real buttons, wrapping as they need to. */
.lasd26 .if-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:100%;margin-left:auto;padding:4px 0}
.lasd26 .if-q{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
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
/* A note's LABEL: the eyebrow's mono caps as an input, over the textarea.
 * Typed text wears the caps; the placeholder stays plain so it reads as a
 * hint, not a value. */
/* 16 px, not the eyebrow's 12: iOS Safari zooms the page into any field
 * under 16 px and leaves it zoomed (review, 2026-10-16) — the textarea and
 * every other field on the site are 16–17 px for the same reason. */
.lasd26 .if-lab{display:block;width:100%;min-height:44px;margin:0 0 10px;border:2px solid var(--ink);background:transparent;color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 12px;border-radius:0;appearance:none}
.lasd26 .if-lab:focus{outline:none;border-color:var(--safety-ink)}
.lasd26 .if-lab::placeholder{color:var(--gray);font-weight:400;letter-spacing:.04em;text-transform:none}
.lasd26 .if-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}
.lasd26 .if-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;background:transparent;border:2px solid var(--ink);color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 16px;cursor:pointer}
.lasd26 .if-btn:hover{border-color:var(--safety-ink);color:var(--safety-ink)}
.lasd26 .if-btn:disabled{opacity:.5;cursor:default;border-color:var(--ink);color:var(--ink)}
.lasd26 .if-btn.fill{background:var(--safety);border-color:#111;color:#111}
.lasd26 .if-btn.fill:hover{background:var(--safety-hover);color:#111}
.lasd26 .if-btn.fill:disabled{background:var(--safety);border-color:#111;color:#111}
/* YES on the remove step: solid ink, the account button's own hover. */
.lasd26 .if-btn.ink{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.lasd26 .if-btn.ink:hover{background:var(--safety-ink);border-color:var(--safety-ink);color:var(--paper)}
.lasd26 .if-btn.ink:disabled{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.lasd26 .if-hint{font-family:var(--lasd-mono),monospace;font-size:11px;color:var(--gray);letter-spacing:.04em}
.lasd26 .if-err{font-family:var(--lasd-mono),monospace;font-size:12px;color:var(--safety-ink);margin-top:10px;letter-spacing:.04em}
.lasd26 .if-err::before{content:"! "}

/* + ADD A NOTE (owner only): a dashed-top band under the last line — the
 * last line draws no rule of its own — with one outlined button in the
 * deep green; open, the form sits on the paper inside an ink border, the
 * "NEW NOTE" eyebrow over the LABEL input and the textarea. */
.lasd26 .if-add{margin-top:4px;padding:16px 0 4px;border-top:1px dashed var(--line)}
.lasd26 .list-empty + .if-add{border-top:none;padding-top:4px}
.lasd26 .if-add-btn{display:inline-flex;align-items:center;justify-content:center;max-width:100%;min-height:44px;background:transparent;border:2px solid var(--safety-ink);color:var(--safety-ink);font-family:var(--lasd-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:10px 16px;cursor:pointer;white-space:nowrap}
.lasd26 .if-add-btn:hover{border-color:var(--ink);color:var(--ink)}
.lasd26 .if-add-form{border:2px solid var(--ink);padding:16px 14px 14px}
.lasd26 .if-add-form .if-k{display:block;margin-bottom:10px}

/* Signed out / not on the team: the same box the expenses page shows. */
.lasd26 .if-notice{border:2px solid var(--ink);padding:24px 20px;margin-top:6px;font-family:var(--lasd-mono),monospace;font-size:13px;line-height:1.8}
.lasd26 .if-notice strong{display:block;font-family:var(--lasd-archivo-black),sans-serif;font-size:22px;font-weight:400;text-transform:uppercase;letter-spacing:.01em;line-height:1.1;margin-bottom:10px}
.lasd26 .if-go{display:inline-block;margin-top:18px;min-height:46px;background:var(--safety);color:#111;border:2px solid #111;font-family:var(--lasd-archivo-black),sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.04em;padding:10px 20px;cursor:pointer}
.lasd26 .if-go:hover{background:var(--safety-hover)}
`;
