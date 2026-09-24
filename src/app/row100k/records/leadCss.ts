/* THE LEADER BLOCK (records/LeadBlock.tsx), rendered on the stats page
 * and on every full-ranking page as one more style child under the theme
 * (owner, 2026-09-24: the head of a records page is the leader, like the
 * stats page's stat block). The big figure and the mono holder line are
 * the .bhead / .st-rec rules in theme.ts; this adds the holder link and
 * the pace figure.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). Prefix .lead-. */
export const leadCss = `
/* The holder is a link to their profile, marked the way the podium names
 * are: plain until hovered, then water and underlined. */
.row100k .lead .bhead-l a{color:inherit;text-decoration:none}
.row100k .lead .bhead-l a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}

/* The pace of a 5k or 10k: a figure of its own under the holder line, in
 * the display face one size under the hours figure on the stats head, ink
 * not water (the time is the record; this says what it took per 500 m).
 * The word PACE sits on its baseline. */
.row100k .lead-pace{display:flex;align-items:baseline;gap:12px;margin-top:14px}
.row100k .lead-pace .n{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(24px,5vw,36px);line-height:1;letter-spacing:-.01em;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .lead-pace .l{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}

/* The pace on the holder line instead (LeadBlock paceInline — the stats
 * page, owner 2026-09-25: the pace stays, the block never changes height).
 * Ink, the way the holder is: the split is the figure that matters on a
 * time record, not a footnote. */
.row100k .lead .bhead-l .lead-pace-in{color:var(--ink);white-space:nowrap}
`;
