/* THE FULL RANKINGS (owner, 2026-09-24: the board is reduced into the
 * records page; no FULL RANKINGS heading; the time period we are looking
 * at above the record chips, as the month word; the five categories
 * centered, filling the row, like 1-2-3-4-5).
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). Prefix .rec-. */
export const recordsCss = `
/* The head: 26px off the bar, the front page nameplate distance. The
 * month word (PeriodSelect.tsx) is the whole head, in the kicker type the
 * off-season front uses, so the dotted rule under it is the only chrome. */
.row100k .rec-head{padding:26px 0 0}
.row100k .rec-period{margin:0;font-family:var(--row-mono),monospace;font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:10px}

/* The five record chips: one row, never wrapping, every chip the same
 * width across the measure. The .tabs chip look (theme.ts) carries the
 * border and the type; this only spreads them. A label that does not fit
 * its fifth wraps inside the chip rather than breaking the row. */
.row100k .rec-tabs{flex-wrap:nowrap;gap:8px;margin:18px 0 12px}
.row100k .rec-tabs a{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:9px 6px;line-height:1.25}
@media(max-width:560px){
  .row100k .rec-tabs{gap:5px}
  .row100k .rec-tabs a{font-size:10px;letter-spacing:.06em;padding:8px 3px}
}

/* The division chips stay the house chips: left, bold, wrapping. */
.row100k .rec-div{margin-bottom:22px}
`;
