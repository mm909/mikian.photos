/* THE FRONT AS THE COUNTER PAGE (owner, 2026-09-24: the landing should
 * look closer to mikianmusser.com — the month as the subtitle, then three
 * cells: METERS TOGETHER ticking live, THE LATEST ROW, OPT IN or LOG A ROW;
 * then the top five men and women; nothing else to click). The cells ride
 * on .front-stats in theme.ts; what is new is here. Prefix .front-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const frontCss = `
/* Each outer cell is its own size container (.fc — the odometer digits are
 * .cell too, so the outer ones carry a class of their own), so the wheels
 * and OPT IN are sized off the cell and never off the viewport. */
.row100k .front-stats .fc{container-type:inline-size}

/* METERS TOGETHER: the landing wheels (Home.tsx Odometer, class .od) in the
 * front-page water blue. Eight digits and two commas are 6.12em, so the
 * size is the cell over 6.12, capped where the other two numbers stop
 * (.front-stats.big .n). The digit cells are reset from the outer cell rule
 * — .cell is padded and ruled in theme.ts — by the element in the
 * selector. */
.row100k .front-live-link{display:block;text-decoration:none;color:inherit}
.row100k .front-live .od{--od-cw:.68em;--od-sw:.34em;display:flex;align-items:flex-start;font-family:var(--row-archivo-black),sans-serif;font-size:min(calc(100cqw / 6.12),30vh,56px);line-height:1;color:var(--water);letter-spacing:0;font-variant-numeric:tabular-nums;transition:color 160ms ease}
@media(min-width:640px){.row100k .front-live .od{font-size:min(calc(100cqw / 6.12),30vh,52px)}}
.row100k .front-live-link:hover .od{color:var(--ink)}
.row100k .front-stats .front-live .od span.cell{position:relative;flex:none;width:var(--od-cw);height:1em;padding:0;border:0;overflow:hidden;transition:opacity 420ms ease}
.row100k .front-live .od .strip{display:block;width:100%;transition:transform 170ms cubic-bezier(.2,.7,.2,1)}
.row100k .front-live .od .g{display:block;height:1em;line-height:1;text-align:center}
.row100k .front-live .od .sep{flex:none;width:var(--od-sw);height:1em;line-height:1;text-align:center;transition:opacity 420ms ease}
.row100k .front-live .od .lead{opacity:.25}
/* The dot in front of the label once the wheels are turning. */
.row100k .front-stats .l .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--water);margin-right:8px;vertical-align:middle;position:relative;top:-1px;animation:front-pulse 1.6s ease-in-out infinite}
@keyframes front-pulse{0%,100%{opacity:1}50%{opacity:.25}}

/* THE LATEST ROW: the meters as the number, the split and how long ago on
 * the label line, the rower under it as a word with a dotted rule — the
 * link to their profile. */
.row100k .front-stats .by{margin-top:9px;font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:14px;line-height:1.4;min-width:0;overflow-wrap:anywhere}
.row100k .front-stats .by .num{color:var(--gray);font-family:var(--row-mono),monospace;font-weight:400;font-size:12px}
.row100k .front-stats .by a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .front-stats .by a:hover{color:var(--water)}
.row100k .front-stats .nothing{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);padding:6px 0}

/* OPT IN or LOG A ROW as the third cell (OptIn.tsx, the landing look,
 * sized to the cell: OPT IN plus the arrow is about 4.5em of Archivo
 * Black, LOG A ROW plus the arrow about 6.9em — .long says which). The
 * cell is the link when it links (a stranger, or a signed-in visitor who
 * has not joined); a joined rower gets the button that opens the form in
 * place. */
.row100k .front-stats .go{display:flex;align-items:center;min-height:1.2em}
.row100k .front-stats .go .optin{font-size:min(calc(100cqw / 4.9),56px);line-height:1.1}
.row100k .front-stats .go .optin.long{font-size:min(calc(100cqw / 7.1),56px)}
@media(min-width:640px){
  .row100k .front-stats .go .optin{font-size:min(calc(100cqw / 4.9),52px)}
  .row100k .front-stats .go .optin.long{font-size:min(calc(100cqw / 7.1),52px)}
}

/* SHARE on the id line under the signed-in number: a word with a dotted
 * rule, no chrome. */
.row100k .front-id-share{all:unset;cursor:pointer;color:var(--ink);font:inherit;letter-spacing:inherit;text-transform:inherit;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .front-id-share:hover{color:var(--water)}
.row100k .front-id-share:focus-visible{outline:2px solid var(--water);outline-offset:3px}
`;
