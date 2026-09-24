/* THE SHAREABLES PAGE, its own rules (owner, 2026-09-24: "instead of My
 * poster, turn that into Shareables — a page where you can go to get all
 * the copy-pasteable shareables"). Kept out of theme.ts so the packages
 * working the site tonight do not collide there: rendered as one more
 * style child under the theme on r/[num]/share/page.tsx. Prefix .shp-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const shareCss = `
/* THE DATELINE under the head: the month word (PeriodSelect.tsx) at the
 * left, the way off to the poster studio at the right, both mono caps. */
.row100k .shp-line{display:flex;justify-content:space-between;align-items:baseline;gap:8px 20px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);margin:-8px 0 26px}
.row100k .shp-line a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .shp-line a:hover{color:var(--water)}
.row100k .shp-line .tm-list{min-width:220px}

/* A GROUP of cards: an eyebrow like the profile ones (.pf-eye in
 * theme.ts), then the grid. The explainer under the eyebrow is the small
 * grey mono. */
.row100k .shp-sec{margin-top:34px}
.row100k .shp-sec:first-of-type{margin-top:0}
.row100k .shp-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--gray);margin:-4px 0 16px;line-height:1.6}
.row100k .shp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:26px 22px}

/* ONE CARD: the same stage the dialog paints on (.share-stage, dark under
 * the white-on-transparent art), the label over it, COPY and DOWNLOAD
 * under it as words with a dotted rule, not buttons. The canvas is drawn
 * at the card size so what is copied is the full image, and shown at the
 * width of the cell. */
.row100k .shp-card{min-width:0}
.row100k .shp-card .share-stage{margin-top:0}
.row100k .shp-lab{display:flex;justify-content:space-between;align-items:baseline;gap:6px 12px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin-bottom:8px}
.row100k .shp-lab .sz{color:var(--gray);font-weight:400;letter-spacing:.08em}
.row100k .shp-acts{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:10px;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.row100k .shp-act{all:unset;cursor:pointer;color:var(--ink);font:inherit;letter-spacing:inherit;text-transform:inherit;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .shp-act:hover{color:var(--water)}
.row100k .shp-act:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .shp-status{margin-left:auto;color:var(--water);font-weight:400;letter-spacing:.08em}
.row100k .shp-status.bad{color:#b3400f}

/* THE ROW WORD: which row the row cards draw, a menu of the month rows
 * (TextMenu.tsx) on the eyebrow line; the list scrolls when a month has
 * more rows than the screen has room for. */
.row100k .shp-rows .tm-list{max-height:min(60vh,440px);overflow-y:auto;min-width:260px}
.row100k .shp-empty{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);padding:6px 0}
`;
