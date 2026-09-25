/* THE FRONT AS THE COUNTER PAGE (owner, 2026-09-24: the landing should
 * look closer to mikianmusser.com — the month as the subtitle, the big
 * number, three cells, then the top five men and women; nothing else to
 * click), reworked after his review of it (2026-09-25):
 *   - the big number is static — a rower sees their own month, a visitor
 *     sees everyone together, eight wheels like the landing counter;
 *   - the cells: METERS TOGETHER (a rower) or HOURS (a visitor) as a static
 *     ink number, THE LATEST ROW with no callout, then LOG A ROW or OPT IN;
 *     each a left-justified block sitting in the middle of its box on
 *     desktop (owner, 2026-09-25, second pass: not the text centred
 *     horizontally, the item in the middle of the block);
 *   - the latest cell reads who, then the meters in bold, then the pace
 *     and how long ago (owner, same day: the bib number and the name ABOVE
 *     the meters, the pace and how-long-ago BELOW it);
 *   - the first two cells are the same three rows, a small line, the
 *     number, a small line, so the two numbers sit level (owner, same day,
 *     pm: i dont like that these numbers arent level) — the label rides
 *     OVER the meters together and that third row is empty;
 *   - on a phone the call to action comes straight after the number, the
 *     landing way (Home.tsx .cta), and the two cells stack under it;
 *   - the log form opens under the cells bar, and the LOG A ROW arrow turns
 *     down while it is open.
 * The cells ride on .front-stats in theme.ts; what is new is here. Prefix
 * .front-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const frontCss = `
/* Each outer cell is its own size container (.fc — the odometer digits are
 * .cell too, so the outer ones carry a class of their own), so OPT IN is
 * sized off the cell and never off the viewport. */
.row100k .front-stats .fc{container-type:inline-size}

/* The visitor big number: eight wheels and two commas are 6.12em (the
 * landing math in Home.tsx); 160px is the landing cap, where 979px fills
 * the 1040 measure. The rower keeps seven wheels (theme.ts .mine .my-od). */
.row100k .mine.eight .my-od{--od-size:min(calc(100cqw / 6.12),30vh,160px)}

/* METERS TOGETHER (or HOURS): the same ink number as the latest row, static
 * (owner, 2026-09-25: a static number, not counting up, black text,
 * no blinking blue dot). The number is still the way to the stats
 * page — a link with no chrome, water on hover. */
.row100k .front-stats .tog .n{white-space:nowrap}
.row100k .front-stats .tog a{color:inherit;text-decoration:none;transition:color 160ms ease}
.row100k .front-stats .tog a:hover{color:var(--water)}

/* THE LATEST ROW, top to bottom: the rower — bib number in gray mono, the
 * name as a word with a dotted rule, the link to their profile — then the
 * meters as the bold number, then the split and how long ago on the label
 * line. No LATEST ROW callout (owner, 2026-09-25); the rower moved from
 * under the number to over it the same day (owner: the bib number and the
 * name ABOVE the meters, the pace and how-long-ago BELOW it, the meters
 * stay bold). */
.row100k .front-stats .by{margin:0 0 8px;font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:14px;line-height:1.4;min-width:0;overflow-wrap:anywhere}
.row100k .front-stats .by .num{color:var(--gray);font-family:var(--row-mono),monospace;font-weight:400;font-size:12px}
.row100k .front-stats .by a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .front-stats .by a:hover{color:var(--water)}
.row100k .front-stats .nothing{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);padding:6px 0}

/* LEVEL NUMBERS (owner, 2026-09-25 pm: i dont like that these numbers
 * arent level). METERS TOGETHER and THE LATEST ROW are the same grid of
 * three rows — a small line, the number, a small line — so the number is
 * the same row in each: the label over the meters together, the rower over
 * the latest meters, the pace line under it, and nothing under the meters
 * together. The small rows are 20px: .by is 14px Archivo at 1.4 (19.6px)
 * and .l 11px mono at the body 1.55 (17px), both set to a 20px line here
 * with no margins, so the rows are exact; the air either side of the number
 * is the row gap, the 8px the .by margin used to give. The rows are fixed
 * only from 640px, where the cells sit side by side; stacked on a phone the
 * tog cell carries no empty third row. */
.row100k .front-stats.counter .cell.tog,.row100k .front-stats.counter .cell.latest{display:grid;grid-template-columns:minmax(0,1fr);row-gap:8px;align-content:center;justify-content:start;justify-items:start}
.row100k .front-stats.counter .tog .l,.row100k .front-stats.counter .latest .l,.row100k .front-stats.counter .latest .by{margin:0;line-height:20px}
@media(min-width:640px){
  .row100k .front-stats.counter .cell.tog,.row100k .front-stats.counter .cell.latest{grid-template-rows:20px auto 20px}
}

/* OPT IN or LOG A ROW as the third cell (OptIn.tsx, the landing look). The
 * cell is the link when it links (a stranger, or a signed-in visitor who
 * has not joined); a joined rower gets the word that opens the form under
 * the bar (LogCell.tsx). The arrow: right when shut, down when the form is
 * open (owner, 2026-09-25: a small animation, and back when closed). */
.row100k .front-stats .go{display:flex;align-items:center;min-height:1.2em}
.row100k .front-stats .go .optin .arr{transition:transform 220ms cubic-bezier(.2,.7,.2,1)}
.row100k .front-stats .go .optin.open .arr{transform:rotate(90deg)}
@media(prefers-reduced-motion:reduce){.row100k .front-stats .go .optin .arr{transition:none}}

/* DESKTOP (from 640px, the seam of every front grid): three boxes, each a
 * left-justified block sitting in the middle of its box — the grid
 * stretches the three to the tallest (the two three-row cells) and the
 * third centres itself in that height. Owner, 2026-09-25, on the
 * centred pass before this one: I do not want the text centered
 * horizontally in the cells; the item can still sit in the middle of the
 * block, but the text is LEFT-JUSTIFIED. So the padding is the house
 * idiom again (theme.ts: none on the outer edges, 18px either side of a
 * rule), which puts the first figure on the measure, under the big number.
 * OPT IN plus the arrow is about 4.5em of Archivo Black and LOG A ROW plus
 * the arrow about 6.9em (.long says which), so the size is the cell over
 * that, capped where the ink numbers stop (theme.ts .front-stats.big .n). */
@media(min-width:640px){
  .row100k .front-stats.counter .cell{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;text-align:left}
  .row100k .front-stats.counter .go{justify-content:flex-start;width:100%}
  /* Seven digits, two commas, a space and the m are about 6.6em of Archivo
   * Black: a month of everyone must stay on one line in a third of the
   * measure, so the size is the cell over that, capped at the ink size. */
  .row100k .front-stats.counter .tog .n{font-size:min(calc(100cqw / 6.8),52px)}
  .row100k .front-stats .go .optin{font-size:min(calc(100cqw / 4.9),52px);line-height:1.1;text-align:left}
  .row100k .front-stats .go .optin.long{font-size:min(calc(100cqw / 7.1),52px)}
}

/* A PHONE (owner, 2026-09-25: cluttered; the main call to action must be
 * OPT IN or LOG A ROW. Get closer to the mikianmusser.com landing — the
 * big number, then the call to action as the very next thing, then the
 * cells stacked, then the top fives). The call-to-action cell is ordered
 * first and loses its rules, so it reads as the landing .cta: the same air
 * above it as the landing (clamp(30px,6vh,64px), less the 28px the section
 * already carries) and the same poster size; the bar then
 * starts on the first stat cell with the 2px rule the grid used to carry,
 * and ends on the last one with the grid rule, no doubled line. */
@media(max-width:639px){
  .row100k .front-stats.counter{border-top:none}
  .row100k .front-stats.counter .cell.cta{order:-1;border-bottom:none;padding:clamp(2px,calc(6vh - 28px),36px) 0 clamp(26px,5vh,40px)}
  .row100k .front-stats.counter .cell.tog{border-top:2px solid var(--ink)}
  .row100k .front-stats.counter .cell.latest{border-bottom:none}
  .row100k .front-stats .go .optin{font-size:clamp(38px,8.6vw,96px)}
}

/* THE LOG FORM under the cells bar (LogRow, which carries its own flat
 * panel): the bar already ends on a 2px rule, so the seam draws none. */
.row100k .front-form .front-log{margin-top:6px;border-top:none;padding-top:0}
`;
