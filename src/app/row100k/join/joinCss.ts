/* THE SIGN-UP PAGE (join/page.tsx; owner, 2026-10-01: "there should be
 * like tiers … these aren't strict, but there's a hierarchy"). One ruled
 * form, three tiers told apart by the size of their type and the weight of
 * their rule, never by a sentence: the number and who you are at headline
 * size on a 2px ink underline; the board name and the board on a 2px ink
 * rule; then the rest as a small mono list on dashed hairlines. OPT IN is
 * the landing's slab of the accent. The bar, the footer and the error line
 * ride on theme.ts. Prefix .jn-.
 *
 * EVERY COLOUR IS A SITE VARIABLE (--paper, --ink, --water and its hover,
 * --line, --gray, --ink-soft), so the page follows the look and the
 * palette on its own.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const joinCss = `
.row100k .jn{padding-bottom:56px}

/* THE HEAD: the number the rower will wear, the one thing in the accent. */
.row100k .jn-h{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:clamp(44px,13.4vw,96px);line-height:.88;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink);padding-bottom:20px;border-bottom:2px solid var(--ink)}
.row100k .jn-h span{display:block;white-space:nowrap}
.row100k .jn-h b{font-weight:400;color:var(--water)}

/* A FIELD: a mono cap label over its control. The inputs are bare type on
 * an underline; each tier sets the size and the rule. */
.row100k .jn-f{min-width:0}
.row100k .jn-l{display:block;font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;letter-spacing:.14em;line-height:1.4;text-transform:uppercase;color:var(--gray)}
.row100k .jn input[type=text],.row100k .jn input[type=date]{display:block;width:100%;min-width:0;background:transparent;border:none;border-bottom:2px solid var(--line);border-radius:0;appearance:none;-webkit-appearance:none;color:var(--ink);font-family:var(--row-archivo),sans-serif;text-align:left}
.row100k .jn input[type=date]::-webkit-date-and-time-value{text-align:left}
.row100k .jn input:focus{outline:none;border-bottom-color:var(--water)}
.row100k .jn ::placeholder{color:var(--gray);opacity:1}
.row100k .jn .form-err{margin-top:8px}

/* TIER ONE: first and last name, the email as plain type, the birthday. */
.row100k .jn-t1{display:grid;grid-template-columns:minmax(0,1fr);gap:22px 28px;padding-top:24px}
.row100k .jn-t1 input[type=text],.row100k .jn-t1 input[type=date],.row100k .jn-mail{font-size:clamp(22px,5.6vw,30px);font-weight:600;line-height:1.2;letter-spacing:-.01em}
.row100k .jn-t1 input[type=text],.row100k .jn-t1 input[type=date]{border-bottom-color:var(--ink);padding:6px 0 8px;min-height:1.9em}
/* The email is type, not a field: the same box as the inputs beside it so
 * the two baselines sit level, with no rule under it. */
.row100k .jn-mail{display:flex;align-items:center;min-height:1.9em;padding:6px 0 8px;border-bottom:2px solid transparent;color:var(--ink);overflow-wrap:anywhere;min-width:0}
/* On a phone an address is longer than a name: a size down, so thirty
 * characters hold one line at 390. */
@media(max-width:559px){
  .row100k .jn-t1 .jn-mail{font-size:clamp(17px,4.9vw,22px)}
}
@media(min-width:560px){
  .row100k .jn-t1{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .row100k .jn-t1 .jn-wide{grid-column:1 / -1}
}

/* TIER TWO: the name on the board and the board, a step down, under a
 * 2px ink rule. */
.row100k .jn-t2{display:grid;grid-template-columns:minmax(0,1fr);gap:20px 28px;margin-top:34px;padding-top:22px;border-top:2px solid var(--ink)}
.row100k .jn-t2 input[type=text]{font-size:20px;font-weight:600;line-height:1.3;padding:5px 0 7px}
@media(min-width:560px){
  .row100k .jn-t2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
}

/* TEXT CONTROLS (the shirts page idiom, .sp-size): words in bold mono
 * caps, grey at rest, the picked one in ink on a 2px underline of the
 * accent. The labels are capitals by hand — no transform, so a gym keeps
 * its own letters. */
.row100k .jn-picks{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 20px}
.row100k .jn-pick{all:unset;box-sizing:border-box;cursor:pointer;font-family:var(--row-mono),monospace;font-weight:700;letter-spacing:.12em;line-height:1.4;padding:6px 0 3px;border-bottom:2px solid transparent;color:var(--gray);white-space:nowrap;transition:color 160ms ease}
.row100k .jn-pick:hover{color:var(--ink)}
.row100k .jn-pick.on{color:var(--ink);border-bottom-color:var(--water)}
.row100k .jn-pick:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .jn-t2 .jn-pick{font-size:18px}
.row100k .jn-t2 .jn-picks{gap:2px 26px;padding-top:2px}

/* TIER THREE: a list, small — the label in the margin, the control beside
 * it, a dashed hairline under each row. On a phone the label sits over
 * its control. */
.row100k .jn-t3{margin-top:34px;border-top:1px solid var(--ink)}
.row100k .jn-row{display:grid;grid-template-columns:minmax(0,1fr);gap:4px 20px;align-items:baseline;padding:11px 0 10px;border-bottom:1px dashed var(--line)}
.row100k .jn-row:last-child{border-bottom:none}
.row100k .jn-t3 .jn-l{font-size:10px}
/* A thumb needs more of a word than a pointer does: the phone gets the
 * taller, wider-set cut and the list tightens from 560px. */
.row100k .jn-t3 .jn-pick{font-size:13px;padding:8px 0 5px}
.row100k .jn-t3 .jn-picks{gap:0 22px}
.row100k .jn-t3 input[type=text]{font-size:15px;line-height:1.4;border-bottom:1px solid var(--line);padding:3px 0 4px}
.row100k .jn-t3 .jn-other{margin-top:8px}
.row100k .jn-units{display:flex;align-items:baseline;gap:8px}
.row100k .jn-t3 .jn-units input[type=text]{width:4.5ch;flex:none;font-family:var(--row-mono),monospace;font-variant-numeric:tabular-nums;text-align:center}
.row100k .jn-t3 .jn-units input.jn-w3{width:5.5ch}
.row100k .jn-unit{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin-right:12px}
.row100k .jn-unit:last-child{margin-right:0}
@media(min-width:560px){
  .row100k .jn-row{grid-template-columns:120px minmax(0,1fr)}
  .row100k .jn-row .jn-ig{max-width:280px}
  .row100k .jn-t3 .jn-pick{font-size:12px;padding:4px 0 2px}
  .row100k .jn-t3 .jn-picks{gap:0 16px}
}

/* OPT IN: the one action, a slab of the accent — the landing block
 * (l1Css.ts .l1-cta), the words in mono caps, the arrow at the far end.
 * The type on it is the ground colour, so it holds on paper and on ink. */
.row100k .jn-act{margin-top:36px}
.row100k .jn-go{all:unset;box-sizing:border-box;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;width:100%;background:var(--water);color:var(--paper);font-family:var(--row-mono),monospace;font-size:clamp(18px,5vw,22px);font-weight:700;line-height:1;letter-spacing:.16em;text-transform:uppercase;padding:22px 20px 21px;transition:background 160ms ease}
.row100k .jn-go .arr{font-weight:400;letter-spacing:0}
.row100k .jn-go:hover,.row100k .jn-go:focus-visible{background:var(--water-hover)}
.row100k .jn-go:focus-visible{outline:2px solid var(--water);outline-offset:4px}
.row100k .jn-go:disabled{cursor:default;background:var(--gray)}
@media(min-width:640px){
  .row100k .jn-go{display:inline-flex;width:auto;min-width:320px;padding:24px 26px 23px;gap:40px}
}
/* One quiet mono line under the action: SAVING, or the preview saying it
 * kept nothing. */
.row100k .jn-note{margin-top:14px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;line-height:1.6;text-transform:uppercase;color:var(--gray)}
`;
