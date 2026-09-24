/* THE PACE dots (owner ask, 2026-09-24: a dot per row at its own average
 * split, under the running-average line). Kept out of theme.ts so the
 * packages working the site tonight do not collide there: rendered as one
 * more style child under the theme on r/[num]/page.tsx.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const paceCss = `
/* A dot is a focus stop for the keyboard, so it takes the same readout as
 * the pointer: no browser outline (the SVG one draws a box), the ring
 * turns ink and the mark swells a touch instead. */
.row100k .pf-pace .dot{outline:none;cursor:default;transition:r .12s ease}
.row100k .pf-pace .dot:focus-visible{stroke:var(--ink);stroke-width:2}
`;
