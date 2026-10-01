/* THE 100K BOARD in the opt-in look (owner, 2026-10-01, from his
 * "Rowtember · the opt in" mock): ink ground, the paper colour as the
 * type, one accent. The mock drew it in a red of its own (#E8402F); it is
 * THE PALETTE ACCENT now (owner, same day: "instead of red, let's pick
 * like October orange ... make sure we address the colors for each of
 * them") — --bk-acc is the site --water, which RowSite cuts for ink on a
 * .chrome-ink page (rowPalette.ts), and the fill behind the viewer row is
 * a quarter of it. The bar is the mock's own — the wordmark, the rower
 * chip, then BOARD · LOG · YOU on a ruled row — not the site bar, because
 * the page is drawn dark edge to edge. Prefix .bk-; the root also wears
 * .chrome-ink so the ink look never inverts it again (theme.ts INK).
 *
 * THE BAR BEHIND THE METERS (owner: "I really like those progress bars,
 * how they are hovering over the name"): every row carries its share of
 * 100,000 m as a faint fill from the left edge; the viewer's own row
 * carries it in the accent and grows in from nothing when the page lands. Rows
 * are grid rows, not table rows, so the fill is a positioned child and
 * needs no registered custom property to animate.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const board100kCss = `
.row100k.bk{--bk-ink:#15171a;--bk-ground:#0d0e10;--bk-white:#F4F3EE;--bk-acc:var(--water);--bk-dim:rgba(244,243,238,.64);--bk-mute:rgba(244,243,238,.5);--bk-rule:rgba(244,243,238,.18);--bk-soft:rgba(244,243,238,.10);--bk-fill:rgba(244,243,238,.055);--bk-acc-fill:color-mix(in srgb,var(--water) 26%,transparent);--bk-ez:cubic-bezier(.2,.7,.2,1);background:var(--bk-ground);color:var(--bk-white);min-height:100vh;min-height:100dvh;color-scheme:dark}
.row100k.bk .bk-page{max-width:640px;margin:0 auto;background:var(--bk-ink);min-height:100vh;min-height:100dvh;display:flex;flex-direction:column}
.row100k.bk button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;border-radius:0;text-align:left;-webkit-tap-highlight-color:transparent}
.row100k.bk a{color:inherit;text-decoration:none}
.row100k.bk :focus-visible{outline:2px solid var(--bk-acc);outline-offset:3px}
.row100k.bk .mono{font-family:var(--row-mono),monospace}

/* TEXT CONTROLS: Archivo Black on an underline of the accent, nothing else. */
.row100k.bk .bk-ctl{display:inline-block;font-family:var(--row-archivo-black),sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:-.01em;line-height:1;color:var(--bk-white);white-space:nowrap;text-decoration:underline;text-decoration-color:var(--bk-acc);text-decoration-thickness:.09em;text-underline-offset:.12em;text-decoration-skip-ink:none;transition:color 160ms ease}
.row100k.bk .bk-ctl:hover,.row100k.bk .bk-ctl:active{color:var(--bk-acc)}
.row100k.bk .bk-ctl.s{font-size:15px}.row100k.bk .bk-ctl.m{font-size:20px}.row100k.bk .bk-ctl.l{font-size:44px}
.row100k.bk .bk-ctl:disabled{color:var(--bk-mute);cursor:default}
.row100k.bk .bk-quiet{display:inline-block;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--bk-mute);line-height:16px;transition:color 160ms ease}
.row100k.bk .bk-quiet:hover{color:var(--bk-white)}

/* THE BAR: wordmark, chip, then the section words on their own ruled row. */
.row100k.bk .bk-bar{flex:none;border-bottom:2px solid var(--bk-white);position:sticky;top:0;z-index:5;background:var(--bk-ink)}
.row100k.bk .bk-r1{display:flex;align-items:center;gap:12px;padding:0 20px;height:44px}
.row100k.bk .bk-wm{font-family:var(--row-archivo-black),sans-serif;font-size:14px;line-height:1;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.row100k.bk .bk-chip{margin-left:auto;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.08em;line-height:16px;border:1px solid var(--bk-white);padding:3px 8px;text-transform:uppercase}
.row100k.bk .bk-r2{display:flex;gap:24px;padding:0 20px;height:32px;align-items:center;border-top:1px solid var(--bk-rule);font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--bk-mute)}
.row100k.bk .bk-r2 .on{color:var(--bk-white);font-weight:700}
.row100k.bk .bk-r2 a:hover{color:var(--bk-white)}

/* THE BOARD. */
.row100k.bk .bk-kick{padding:16px 20px 0;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--bk-mute);line-height:16px}
.row100k.bk .bk-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 20px 0;padding:12px 0 11px;border-top:1px solid var(--bk-white);border-bottom:1px solid var(--bk-white)}
.row100k.bk .bk-strip .t{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;line-height:16px}
.row100k.bk .bk-strip .t i{font-style:normal;color:var(--bk-acc)}
.row100k.bk .bk-under{margin:8px 20px 0}
.row100k.bk .bk-err{margin:8px 20px 0;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.06em;line-height:1.6;color:var(--bk-acc)}

.row100k.bk .bk-board{margin-top:2px;padding-bottom:40px;font-family:var(--row-mono),monospace;font-size:13px}
.row100k.bk .bk-row{position:relative;display:grid;grid-template-columns:50px minmax(0,1fr) auto;align-items:center;gap:0 6px;padding:11px 20px;border-bottom:1px solid var(--bk-soft);line-height:18px}
.row100k.bk .bk-head{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--bk-mute);padding:12px 20px 8px;border-bottom:1px solid var(--bk-white)}
.row100k.bk .bk-row .rk{color:var(--bk-mute);font-variant-numeric:tabular-nums;position:relative}
.row100k.bk .bk-row .who{font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative}
.row100k.bk .bk-row .who .n{font-family:var(--row-mono),monospace;font-weight:400;color:var(--bk-mute);font-size:12px}
.row100k.bk .bk-row .who .u{font-family:var(--row-mono),monospace;font-weight:700;color:var(--bk-acc);font-size:10px;letter-spacing:.12em;margin-left:8px;vertical-align:1px}
.row100k.bk .bk-row .num{font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;position:relative}
.row100k.bk .bk-row a.who:hover{color:var(--bk-acc)}
/* The fill: the share of 100,000 m, under the words. */
.row100k.bk .bk-row .bar{position:absolute;left:0;top:0;bottom:0;background:var(--bk-fill);pointer-events:none}
.row100k.bk .bk-row.me .bar{background:var(--bk-acc-fill);animation:bk-grow 900ms var(--bk-ez)}
.row100k.bk .bk-row.me .rk{color:var(--bk-acc)}
@keyframes bk-grow{from{width:0}}
/* Blocks for a hidden rower (theme.ts .bo draws them in ink; here they
 * are paper). */
.row100k.bk .bo i{background:var(--bk-white)}
/* The section words, the lock line, the gap. */
.row100k.bk .bk-div{padding:16px 20px 6px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--bk-mute);border-bottom:1px solid var(--bk-soft)}
.row100k.bk .bk-lock{padding:12px 20px;font-size:11px;color:var(--bk-mute);letter-spacing:.06em;border-bottom:1px solid var(--bk-soft)}
.row100k.bk .bk-gap{display:block;width:100%;padding:10px 20px;font-family:var(--row-archivo),sans-serif;font-size:13px;line-height:18px;color:var(--bk-dim);border-top:1px dashed var(--bk-rule);border-bottom:1px dashed var(--bk-rule);text-decoration:underline;text-decoration-color:var(--bk-acc);text-decoration-thickness:1px;text-underline-offset:3px;transition:color 160ms ease}
.row100k.bk .bk-gap:hover{color:var(--bk-white)}
.row100k.bk .bk-empty{padding:16px 20px;font-size:11px;color:var(--bk-mute);letter-spacing:.06em;line-height:1.6}

/* THE SHEET over the board. */
.row100k.bk .bk-scrim{position:fixed;inset:0;z-index:60;background:rgba(13,14,16,.68);opacity:0;pointer-events:none;transition:opacity 300ms ease}
.row100k.bk .bk-scrim.on{opacity:1;pointer-events:auto}
.row100k.bk .bk-sheet{position:fixed;left:0;right:0;bottom:0;z-index:61;max-width:640px;margin:0 auto;background:var(--bk-ink);border-top:2px solid var(--bk-white);padding:26px 20px calc(36px + env(safe-area-inset-bottom,0px));transform:translateY(103%);visibility:hidden;transition:transform 380ms var(--bk-ez),visibility 0s linear 380ms}
.row100k.bk .bk-sheet.on{transform:none;visibility:visible;transition:transform 380ms var(--bk-ez),visibility 0s}
.row100k.bk .bk-sheet h2{font-family:var(--row-archivo-black),sans-serif;font-weight:400;font-size:36px;line-height:1.02;text-transform:uppercase;letter-spacing:-.01em;color:var(--bk-white)}
.row100k.bk .bk-sheet h2 i{font-style:normal;color:var(--bk-acc)}
.row100k.bk .bk-sheet p{margin-top:16px;font-size:15px;line-height:1.45;color:var(--bk-dim)}
.row100k.bk .bk-sheet .bk-ctl.l{display:inline-block;margin-top:32px}
.row100k.bk .bk-sheet .bk-quiet{display:block;margin-top:20px}
@media(prefers-reduced-motion:reduce){.row100k.bk .bk-sheet,.row100k.bk .bk-scrim{transition:none}.row100k.bk .bk-row.me .bar{animation:none}}
@media(max-width:480px){.row100k.bk .bk-sheet h2{font-size:30px}.row100k.bk .bk-ctl.l{font-size:38px}}
`;
