/* THE PROFILE after the owner second look (2026-09-25): the dateline with
 * SHARE at its far right, and LOG A ROW as a toggle whose arrow turns down
 * while the form is open. Kept out of theme.ts so the packages working the
 * site tonight do not collide there: rendered as one more style child
 * under the theme on r/[num]/page.tsx, after paceCss. Prefix .pf-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const profileCss = `
/* THE DATELINE (pieces.tsx Dateline): the month word on the left, SHARE
 * at the far right of the same line (owner, 2026-09-25: move the SHARE
 * button onto the same line as the DECEMBER 2026 date selection, right
 * side; best on mobile). A flex row on the baseline, so the two words sit
 * on one line at any width; the dog tag FIND ANOTHER ROWER line is the
 * same element with one child and is left where it was. */
.row100k .pf-date{display:flex;justify-content:space-between;align-items:baseline;gap:16px}
/* SHARE in the quiet face it wore beside LOG A ROW (owner, 2026-09-24:
 * keep LOG A ROW prominent, the share button quieter): the month word
 * idiom — mono caps, the dotted rule, water on hover. */
.row100k .pf-share{all:unset;cursor:pointer;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:1.3;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);border-bottom:1px dotted currentColor;padding-bottom:1px;white-space:nowrap}
.row100k .pf-share:hover{color:var(--water)}
.row100k .pf-share:focus-visible{outline:2px solid var(--water);outline-offset:3px}
/* LOG A ROW as a toggle (owner, 2026-09-25: it should open the form and
 * the arrow should tilt down): the front page turn, LogInPlace puts .open
 * on the word while the form is open. */
.row100k .pf-act .optin .arr{transition:transform 220ms cubic-bezier(.2,.7,.2,1)}
.row100k .pf-act .optin.open .arr{transform:rotate(90deg)}
@media(prefers-reduced-motion:reduce){.row100k .pf-act .optin .arr{transition:none}}
`;
