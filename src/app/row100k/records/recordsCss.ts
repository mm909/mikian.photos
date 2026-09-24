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
 * month word (PeriodSelect.tsx) and the record on one mono line — the
 * stats page .st-pick line, the same type, so the two heads read alike
 * (owner, 2026-09-24: the leader block like the stats page stat block).
 * The leader (LeadBlock.tsx, .bhead) sits straight under it. */
.row100k .rec-head{padding:26px 0 0}
.row100k .rec-period{margin:0;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);line-height:1.8}
.row100k .rec-period .dot{color:var(--gray);margin:0 6px}
.row100k .rec-period .tm-list{min-width:220px}

/* The five record chips: one row, never wrapping, every chip the same
 * width across the measure. The .tabs chip look (theme.ts) carries the
 * border and the type; this only spreads them. A label that does not fit
 * its fifth wraps inside the chip rather than breaking the row. A dotted
 * rule over the row closes the leader block above it. */
.row100k .rec-tabs{flex-wrap:nowrap;gap:8px;margin:26px 0 12px;padding-top:18px;border-top:1px dotted var(--ink)}
.row100k .rec-tabs a{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:9px 6px;line-height:1.25}
@media(max-width:560px){
  .row100k .rec-tabs{gap:5px}
  .row100k .rec-tabs a{font-size:10px;letter-spacing:.06em;padding:8px 3px}
}

/* The division chips stay the house chips: left, bold, wrapping. */
.row100k .rec-div{margin-bottom:22px;align-items:center}

/* FIND A ROWER (owner, 2026-09-25: a search field on the far right of the
 * ALL / MEN S / WOMEN S line, not ugly). Text, not a box: the house mono
 * caps on a dotted rule, the same rule a menu word wears (.tm-btn), pushed
 * to the far edge by the auto margin, water blue when it has focus. No
 * button — typing is the search. Under 560px the chips line is full at
 * 375 with the three chips alone, so the field drops to a line of its own
 * beneath them and runs the measure, the rule now a full-width baseline. */
.row100k .rec-find{margin-left:auto;flex:0 1 210px;width:210px;min-width:0;background:transparent;border:0;border-bottom:2px dotted var(--ink);border-radius:0;appearance:none;padding:7px 0 5px;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);line-height:16px}
.row100k .rec-find::placeholder{color:var(--gray);font-weight:400;letter-spacing:.12em;text-transform:uppercase;opacity:1}
.row100k .rec-find:focus{outline:0;border-bottom-color:var(--water)}
@media(max-width:560px){
  .row100k .rec-find{flex:1 1 100%;width:auto;margin:6px 0 0}
}
`;
