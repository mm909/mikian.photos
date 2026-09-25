/* THE FIVE LANDING LOOKS (owner, 2026-09-25: the landing as a social feed),
 * their own rules, kept out of theme.ts: rendered as one more style child
 * under the theme by looks/LookPage.tsx. The house language and this
 * week: quieter, smaller, fewer things — section titles as mono eyebrows,
 * controls as words with a dotted or a water rule, dashed hairlines
 * between cards, nothing boxed. Prefix .lk-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const looksCss = `
/* THE LOOK SWITCHER: one grey mono line, the letters as words, the one
 * showing in bold water. */
.row100k .lk-switch{display:flex;align-items:baseline;gap:0 14px;flex-wrap:wrap;padding:18px 0 0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);line-height:1.8}
.row100k .lk-switch .k{color:var(--gray)}
.row100k .lk-switch a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .lk-switch a:hover{color:var(--water)}
.row100k .lk-switch a.on{color:var(--water);font-weight:700;border-bottom:2px solid var(--water)}

/* THE EYEBROW: a section title as a mono line on a 1px rule, the aside at
 * its right end in grey (a count, a link). */
.row100k .lk-eye{display:flex;align-items:baseline;justify-content:space-between;gap:6px 16px;flex-wrap:wrap;margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid var(--ink);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);line-height:1.7}
.row100k .lk-eye a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor;padding-bottom:1px}
.row100k .lk-eye a:hover{color:var(--water)}
.row100k .lk-eye-r{color:var(--gray);font-weight:400;margin-left:auto}

/* THE ME HEAD: the eyebrow with bib, name and month; one line of this
 * month in mono with the figures in ink; LOG A ROW as a word under it in
 * Archivo Black at a small cut, the water rule and the blunt arrow of
 * OPT IN (theme.ts .optin), turning down while the form is open; the
 * form seam under that (LogInPlace, the front page rules). */
.row100k .lk-me{padding:26px 0 0}
.row100k .lk-mine{margin:12px 0 0;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);line-height:1.8;font-variant-numeric:tabular-nums}
.row100k .lk-mine b{color:var(--ink);font-weight:700;font-size:15px}
.row100k .lk-mine .dot{color:var(--gray);margin:0 10px}
.row100k .lk-act{margin-top:16px}
.row100k .lk-log{display:inline-block;font-family:var(--row-archivo-black),sans-serif;font-size:22px;line-height:1;text-transform:uppercase;letter-spacing:-.01em;color:var(--ink);white-space:nowrap;text-decoration:underline;text-decoration-color:var(--water);text-decoration-thickness:.09em;text-underline-offset:.14em;text-decoration-skip-ink:none;background:none;border:none;padding:0;margin:0;cursor:pointer;transition:color 160ms ease}
.row100k .lk-log:hover{color:var(--water)}
.row100k .lk-log .arr{display:inline-block;width:.8em;height:.8em;margin-left:.14em;vertical-align:-.06em;transition:transform 220ms cubic-bezier(.2,.7,.2,1)}
.row100k .lk-log .arr svg{display:block;width:100%;height:100%}
.row100k .lk-log.open .arr{transform:rotate(90deg)}
.row100k .lk-form .front-log{margin-top:14px;border-top:none;padding-top:0}
.row100k .lk-body{margin-top:36px}
.row100k .lk-gap{margin-top:40px}

/* Words that do something (SHOW MORE, SEE ALL, CLOSE): bold mono on a
 * water rule; the count after them in grey. */
.row100k .lk-more{margin:18px 0 0;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);line-height:1.8}
.row100k .lk-word{all:unset;cursor:pointer;color:var(--ink);font:inherit;letter-spacing:inherit;text-transform:inherit;border-bottom:2px solid var(--water);padding-bottom:2px;white-space:nowrap}
.row100k a.lk-word{text-decoration:none}
.row100k .lk-word:hover{color:var(--water)}
.row100k .lk-word:focus-visible{outline:2px solid var(--water);outline-offset:3px}
.row100k .lk-more .dim,.row100k .lk-today .x{color:var(--gray);font-weight:400}
.row100k .lk-empty{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);padding:6px 0}

/* THE STREAM CARD: the two photos side by side on the left, the words on
 * the right, cards parted by dashed hairlines. The photos are squares of a
 * fixed size on desktop (two of them and the gap, 268px, the same footprint
 * a masked row keeps for the LIGHTS OUT mark). */
.row100k .lk-cards{display:flex;flex-direction:column}
.row100k .lk-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;align-items:start;padding:16px 0;border-bottom:1px dashed var(--line)}
.row100k .lk-pics{display:grid;grid-template-columns:132px 132px;gap:4px}
.row100k .lk-pics.none{grid-template-columns:132px}
.row100k .lk-pic{display:block;appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;padding:0;margin:0;cursor:pointer;line-height:0;overflow:hidden;aspect-ratio:1}
.row100k .lk-pic img{display:block;width:100%;height:100%;object-fit:cover;transition:opacity 160ms ease}
.row100k .lk-pic:hover img{opacity:.82}
.row100k .lk-noph{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border:1px dashed var(--line);color:var(--gray);font-family:var(--row-mono),monospace;font-size:11px}
.row100k .lk-elite{display:flex;align-items:center;justify-content:center;gap:0 .45em;width:268px;height:132px;background:var(--ink);color:#fff;text-decoration:none;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap;line-height:1}
.row100k .lk-elite .sq{display:inline-flex;gap:.3em}
.row100k .lk-elite .sq i{display:block;width:.7em;height:.7em;background:var(--paper)}
.row100k .lk-elite:hover .w{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--water)}
.row100k .lk-mid{display:flex;flex-direction:column;gap:5px;min-width:0}
.row100k .lk-who{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink)}
.row100k .lk-who .n{color:var(--gray);font-weight:400}
.row100k .lk-who a{color:var(--ink);text-decoration:none}
.row100k .lk-who a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .lk-who .day{margin-left:auto;color:var(--gray);font-weight:400}
.row100k .lk-ttl{font-size:11px;letter-spacing:.04em;color:var(--gray);overflow-wrap:anywhere}
.row100k .lk-m{font-family:var(--row-archivo-black),sans-serif;font-size:26px;line-height:1;color:var(--water);font-variant-numeric:tabular-nums;margin-top:4px}
.row100k .lk-sub{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12px;letter-spacing:.04em;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .lk-sub .s{color:var(--gray)}

/* THE RECORD CARD and THE SPONSOR SLOT between the rows: full width, the
 * eyebrow on top; a record line is the division, the time in ink, the
 * holder and their pace in grey. */
.row100k .lk-card.lk-rec,.row100k .lk-card.lk-spon{display:block;padding:22px 0 18px}
.row100k .lk-rec-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;padding:6px 0}
.row100k .lk-rec-div{flex:0 0 56px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .lk-rec-t{font-family:var(--row-archivo-black),sans-serif;font-size:22px;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .lk-rec-t.dim{color:var(--gray)}
.row100k .lk-rec-who{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}
.row100k .lk-rec-who a{color:var(--ink);text-decoration:none;border-bottom:1px dotted currentColor}
.row100k .lk-rec-who a:hover{color:var(--water)}
.row100k .lk-spon-box{height:96px;border:1px dashed var(--line)}

/* THE FRIENDS BOARD and MOVED TODAY: the house board table (theme.ts
 * table.board), a MOVED TODAY tag in water after a name, today in water. */
.row100k .lk-tab .who .n{color:var(--gray);font-family:var(--row-mono),monospace;font-weight:400}
.row100k .lk-tab .who a{text-decoration:none}
.row100k .lk-tab .who a:hover{color:var(--water)}
.row100k .lk-tag{display:inline-block;margin-left:10px;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--water);vertical-align:1px;white-space:nowrap}
.row100k .lk-today{color:var(--water);font-weight:700}
.row100k .lk-mv .ttl{color:var(--gray);font-size:12px;overflow-wrap:anywhere}
.row100k .lk-today-list{margin-top:36px}
.row100k .lk-lines{list-style:none;margin:0;padding:0}
.row100k .lk-lines li{padding:9px 0;border-bottom:1px dashed var(--line);font-size:12px;letter-spacing:.04em;line-height:1.6;overflow-wrap:anywhere}
.row100k .lk-lines .n,.row100k .lk-lines .t,.row100k .lk-lines .dot{color:var(--gray)}
.row100k .lk-lines .dot{margin:0 6px}
.row100k .lk-lines a{color:var(--ink);text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
.row100k .lk-lines a:hover{color:var(--water)}
.row100k .lk-lines b{color:var(--water)}

/* TWO COLUMNS (look d): the stream left, the friends board right and
 * sticky under the bar, from 900px; one column under that, the stream
 * first. The photos shrink to fit the narrower column. */
.row100k .lk-two{display:grid;grid-template-columns:minmax(0,1fr);gap:48px;align-items:start}
@media(min-width:900px){
  .row100k .lk-two{grid-template-columns:minmax(0,1fr) 340px}
  .row100k .lk-two .lk-board{position:sticky;top:84px}
  .row100k .lk-two .lk-pics{grid-template-columns:110px 110px}
  .row100k .lk-two .lk-pics.none{grid-template-columns:110px}
  .row100k .lk-two .lk-elite{width:224px;height:110px}
  /* The column board: the MOVED TODAY tag carries today on a line of its
   * own under the name (FriendsBoard compact), so the narrow table is who
   * and the total and nothing wraps mid-name. */
  .row100k .lk-two .lk-tag{display:block;margin:3px 0 0}
  .row100k .lk-two .lk-tab .rk{width:30px}
}

/* THE WALL (look e): a dense grid of square tiles, the bib and the meters
 * as an ink label in the corner; a masked row is one ink tile with the
 * word. The picked tile wears a water ring, and its card comes up in a
 * sheet at the foot of the screen. */
.row100k .lk-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px}
.row100k .lk-tile{position:relative;display:block;appearance:none;-webkit-appearance:none;background:var(--water-pale);border:0;border-radius:0;padding:0;margin:0;cursor:pointer;line-height:0;overflow:hidden;aspect-ratio:1;text-align:left}
.row100k .lk-tile img{display:block;width:100%;height:100%;object-fit:cover;transition:opacity 160ms ease}
.row100k .lk-tile:hover img{opacity:.82}
.row100k .lk-tile.on{outline:3px solid var(--water);outline-offset:-3px}
.row100k .lk-tile .lb{position:absolute;left:0;bottom:0;background:var(--ink);color:#fff;font-size:10px;letter-spacing:.08em;line-height:1;padding:5px 7px;white-space:nowrap;font-variant-numeric:tabular-nums}
.row100k .lk-tile.dark{display:flex;align-items:center;justify-content:center;background:var(--ink);color:#fff;text-decoration:none;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;line-height:1}
.row100k .lk-foot{height:1px}
.row100k .lk-sheet{position:fixed;left:0;right:0;bottom:0;z-index:60;background:var(--paper);border-top:2px solid var(--ink);box-shadow:0 -10px 30px rgba(0,0,0,.14);padding:10px 0 16px;max-height:70vh;overflow:auto}
.row100k .lk-sheet-top{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gray);margin:0}
.row100k .lk-sheet .lk-card{border-bottom:none;padding:10px 0 0}

/* A PHONE: the card stacks — the two photos side by side across the
 * measure, the words under them; a row without photos keeps no square;
 * the mark spans the width; the moved-today table drops the title column
 * and the tiles get smaller. */
@media(max-width:639px){
  .row100k .lk-card{grid-template-columns:1fr;gap:10px}
  /* The words first, the photos under them, the Strava order on a phone:
   * who and how far before the pictures, so a scroll reads. */
  .row100k .lk-card .lk-pics,.row100k .lk-card .lk-elite{order:2}
  .row100k .lk-pics{grid-template-columns:1fr 1fr}
  .row100k .lk-pics.none{display:none}
  .row100k .lk-elite{width:100%;height:96px}
  .row100k .lk-two .lk-pics{grid-template-columns:1fr 1fr}
  /* The sheet under the wall keeps the side-by-side card with small
   * thumbs: full-width photos there would fill the phone with what the
   * reader just tapped. */
  .row100k .lk-sheet .lk-card{grid-template-columns:auto minmax(0,1fr);gap:14px}
  .row100k .lk-sheet .lk-card .lk-pics,.row100k .lk-sheet .lk-card .lk-elite{order:0}
  .row100k .lk-sheet .lk-pics{grid-template-columns:88px 88px}
  .row100k .lk-sheet .lk-pics.none{display:grid;grid-template-columns:88px}
  .row100k .lk-sheet .lk-elite{width:180px;height:88px}
  .row100k .lk-mv .ttl{display:none}
  .row100k .lk-wall{grid-template-columns:repeat(auto-fill,minmax(104px,1fr))}
  .row100k .lk-mine .dot{margin:0 7px}
  .row100k table.board.lk-tab td{padding:9px 4px}
  .row100k .lk-tab .rk{width:28px}
}
`;
