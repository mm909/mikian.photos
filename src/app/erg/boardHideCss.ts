/* HIDING A LANE LIVE (owner, 2026-09-24: "give me the ability to hide ergs
 * live on the race board if they are not being used"). The rules for the
 * hide control on the desk board and on the television, and for the list
 * of hidden ergs each surface can open to bring one back. Rendered as an
 * extra style tag by RaceBoard.tsx and RaceBoardTv.tsx, next to the sheet
 * they already wear, so this lives beside the board and not in ergTheme.
 *
 * Text child of a style tag: NO double quotes, apostrophes, angle brackets
 * or ampersands anywhere in here, comments included.
 *
 * THE CONTROL IS AN x, mono, quiet. It is its own button and never inside
 * the lane button, so a tap on it hides the lane and never opens it. On
 * the desk board it sits beside the lane, dim until the row is under the
 * pointer; on the wall it is hover-only and lays over the far right of the
 * row on a solid ground, so nothing on the row moves when it appears. */
export const boardHideCss = `
/* ---- the desk board ---- */
.eg .eg-lane-row{display:grid;grid-template-columns:minmax(0,1fr) 28px;gap:0 6px;align-items:center}
.eg .eg-lane-hide{
  display:inline-flex;align-items:center;justify-content:center;
  width:28px;height:36px;border:0;border-radius:2px;background:transparent;
  font-family:var(--eg-mono),monospace;font-size:15px;line-height:1;
  color:var(--eg-fg-4);opacity:.55;cursor:pointer;
}
.eg .eg-lane-row:hover .eg-lane-hide,.eg .eg-lane-hide:focus-visible{opacity:1}
.eg .eg-lane-hide:hover,.eg .eg-lane-hide:focus-visible{color:var(--eg-fg);background:var(--eg-panel);outline:0}

/* A word that is a control: mono caps with a dotted underline, the way
 * the site prefers words over chrome. */
.eg .eg-word{
  display:inline-block;border:0;background:transparent;padding:0;cursor:pointer;
  font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--eg-fg-3);text-decoration:underline dotted;text-underline-offset:4px;text-decoration-thickness:1px;
}
.eg .eg-word:hover,.eg .eg-word:focus-visible{color:var(--eg-fg);outline:0}
.eg .eg-word[aria-expanded=true]{color:var(--eg-fg)}

/* The list of hidden ergs, opened from the head: one line each, the name
 * and a SHOW word, then SHOW ALL under a dotted rule. */
.eg .eg-hidden-list{
  border:1px dashed var(--eg-line);border-radius:3px;padding:10px 14px;margin:0 0 14px;
  display:flex;flex-direction:column;gap:6px;
}
.eg .eg-hidden-list .eg-eyebrow{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--eg-fg-4)}
.eg .eg-hidden-row{display:flex;align-items:baseline;gap:8px 16px;flex-wrap:wrap;padding:4px 0;border-bottom:1px dotted var(--eg-line-soft)}
.eg .eg-hidden-row:last-child{border-bottom:0}
.eg .eg-hidden-row .nm{font-family:var(--eg-black),sans-serif;font-size:15px;line-height:1.2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eg .eg-hidden-row .sub{font-family:var(--eg-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--eg-fg-4)}
.eg .eg-hidden-row .eg-word{margin-left:auto}
.eg .eg-hidden-all{display:flex;justify-content:flex-end;padding-top:6px}

/* ---- the television ---- */
/* The hidden line rides above the buttons in the same strip, so the
 * pointer never has to leave the foot of the screen to reach it. */
.eg .eg-tv-ctl{flex-wrap:wrap;justify-content:center;max-width:92vw}
.eg .eg-tv-ctl-hidden{
  flex:1 0 100%;display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap;justify-content:center;
  padding:4px 6px 8px;border-bottom:1px dotted var(--tv-line);margin-bottom:4px;
}
.eg .eg-tv-ctl-hidden .eg-word{color:var(--tv-dim)}
.eg .eg-tv-ctl-hidden .eg-word:hover,.eg .eg-tv-ctl-hidden .eg-word:focus-visible{color:#fff}
.eg .eg-tv-ctl-hidden .eg-word b{font-family:var(--eg-black),sans-serif;font-size:12px;letter-spacing:0;text-transform:none;color:#fff}

/* The x on a row of the wall: shown only while the row is under the
 * pointer, over the far right, on a solid ground the colour of the row. */
.eg .tv-c-list li,.eg .tv-d-rows li{position:relative}
.eg .tv-hide{
  position:absolute;right:.4vw;top:50%;transform:translateY(-50%);z-index:1;
  display:none;align-items:center;justify-content:center;
  width:3.2vh;height:3.2vh;border:1px solid var(--tv-line);border-radius:2px;
  background:#000;color:var(--tv-dim);cursor:pointer;
  font-family:var(--eg-mono),monospace;font-size:2vh;line-height:1;
}
.eg .tv-c-list li:hover .tv-hide,.eg .tv-d-rows li:hover .tv-hide,.eg .tv-hide:focus-visible{display:inline-flex}
.eg .tv-hide:hover,.eg .tv-hide:focus-visible{color:#fff;border-color:#fff;outline:0}
.eg .tv-c-list li.show .tv-hide{background:#1a1a1a}
.eg .tv-d-rows li.lead .tv-hide{background:#fff;color:rgba(0,0,0,.6);border-color:rgba(0,0,0,.3)}
.eg .tv-d-rows li.lead .tv-hide:hover,.eg .tv-d-rows li.lead .tv-hide:focus-visible{color:#000;border-color:#000}
`;
