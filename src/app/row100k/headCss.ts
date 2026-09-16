/* THE PAGE HEAD (owner, 2026-09-16: no bold THE BOARD / THE STATS / THE
 * FEED, the board number in the front page odometer, not incrementing).
 * One head for the three pages (PageHead.tsx): the page name kept quiet,
 * the number in the landing counter look (.my-od, theme.ts), the unit
 * line under it. Three variants rode on ?head=a|b|c for a day; the owner
 * picked A for every tab (2026-09-16), so A is the only one here now.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes and no angle brackets anywhere in this string, comments
 * included (see the note in theme.ts). Prefix .ph-. */
export const headCss = `
/* Where the head sits: 26px off the bar, the front page nameplate distance. */
.row100k .ph-sec{padding:26px 0 0}
.row100k section.ph-sec{padding:26px 0 8px}
/* The head is its own size container so the odometer is measured off the
 * column it sits in, not the viewport (the same trick as .mine). */
.row100k .ph{container-type:inline-size}
.row100k .ph h1{margin:0}

/* The line: one gray mono dateline with the page name folded in, then the
 * odometer, then the unit. The h1 is the name alone, inline. */
.row100k .ph-line{font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);line-height:1.7}
.row100k .ph-line h1{display:inline;font:inherit;letter-spacing:inherit;text-transform:inherit;color:inherit}

/* The odometer: eight cells at .68em and two commas at .34em are 6.12em,
 * so the size is the column over 6.12 — sized off the container (cqw) with
 * the viewport formula as the fallback for a browser without it — capped
 * at 108px on the 760 column (720 inside) and 160px on the front measure
 * (1040, 1000 inside), the landing cap. On a 375 phone the column is 335,
 * which is 54px; 16.3vw - 10px is 51px there, so both fit. */
.row100k .ph-od{margin-top:10px}
.row100k .ph .my-od{--od-size:clamp(34px,min(calc(16.3vw - 10px),30vh),108px);font-size:min(calc(100cqw / 6.12),30vh,108px)}
.row100k .ph-wide .my-od{--od-size:clamp(40px,min(calc(16.3vw - 10px),30vh),160px);font-size:min(calc(100cqw / 6.12),30vh,160px)}
/* The feed pads to six wheels (owner, 2026-09-16: no million and ten
 * million digits on the feed): six cells and one comma are 4.42em, so the
 * column over 4.42 — 76px on the 335 phone column, 108px from 478 up. The
 * fallback is the same column in vw: (100vw - 40px) / 4.42. A day past
 * 999,999 m grows to seven cells and one more comma (5.44em) and wraps no
 * worse than the eight-cell head does. */
.row100k .ph-6 .my-od{--od-size:clamp(34px,min(calc(22.6vw - 9px),30vh),108px);font-size:min(calc(100cqw / 4.42),30vh,108px)}

/* The second mono line under the unit (the feed: rows and rowers today). */
.row100k .ph-sub{margin-top:6px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);line-height:1.7}
`;
