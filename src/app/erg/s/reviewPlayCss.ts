/* THE PLAYBACK BLOCK ON THE REVIEW (owner, 2026-09-24: "put the playback
 * menu in this screen, in this screen's color scheme"). The live charts,
 * the transport strip and the chips are the console's own components,
 * class names and all; this sheet only sits them on paper.
 *
 * The console skeleton (ergTheme.ts) colours itself off variables, so on
 * the .eg-paper ground the ink, the rules and the greys already resolve to
 * the review's. What it does not do is pick the review's one colour: the
 * console draws its lead line in the foreground because on ink the
 * foreground is the brightest thing there is. On paper the review draws
 * the piece being read in water blue and measures it against grey, so
 * every lead mark here is turned blue to match the charts above it.
 *
 * HOUSE RULE: this string is the text child of a style tag, so there are
 * no double quotes, apostrophes, angle brackets or ampersands anywhere in
 * it, these comments included. */

export const reviewPlayCss = `
.eg .rv-play .rv-word{all:unset;cursor:pointer;color:var(--eg-fg);font-family:var(--eg-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;border-bottom:1px dotted currentColor;padding-bottom:1px}
.eg .rv-play .rv-word:hover{color:var(--eg-accent)}
.eg .rv-play .rv-word:focus-visible{outline:2px solid var(--eg-accent);outline-offset:3px}
.eg .rv-play h2 em{margin-left:8px}
.eg .rv-playbody{margin-top:4px}

.eg .rv-play .eg-pb{background:var(--eg-panel);border-color:var(--eg-fg)}
.eg .rv-play .eg-pb-scrub input{accent-color:var(--eg-accent)}
.eg .rv-play .eg-pb-bar span{background:var(--eg-accent)}

.eg .rv-now{margin:0 0 16px}
.eg .rv-now .rv-cell .rv-v{color:var(--eg-accent)}

.eg .rv-play .rv-playhead{border-bottom:1px solid var(--eg-line-soft);margin-top:22px}
.eg .rv-play .rv-playhead h3{font-family:var(--eg-mono),monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--eg-fg-3);font-weight:400}
.eg .rv-play .eg-pairs{margin-top:4px}
.eg .rv-play .eg-chart{background:var(--eg-panel);border-radius:3px}

.eg .rv-play .eg-svg .ln{stroke:var(--eg-accent)}
.eg .rv-play .eg-svg .dot{fill:var(--eg-accent)}
.eg .rv-play .eg-svg .bar{fill:var(--eg-accent)}
.eg .rv-play .eg-svg .bar-on{fill:var(--eg-fg)}
.eg .rv-play .eg-svg .cdot{stroke:var(--eg-accent)}
.eg .rv-play .eg-svg .kdot{stroke:var(--eg-accent)}
.eg .rv-play .eg-svg .kd{fill:var(--eg-accent);opacity:.14}
.eg .rv-play .eg-svg .sdband{fill:var(--eg-accent);opacity:.07}
.eg .rv-play .eg-svg .fc-now{stroke:var(--eg-accent)}
.eg .rv-play .eg-svg .fc-one{opacity:.09}

@media (max-width:820px){
  .eg .rv-now{grid-template-columns:repeat(3,1fr)}
}
@media (max-width:520px){
  .eg .rv-now{grid-template-columns:repeat(2,1fr)}
}
`;
