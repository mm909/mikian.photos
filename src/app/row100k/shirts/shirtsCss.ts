/* THE SHIRT PRE-ORDER PAGE (owner, 2026-09-30: sell the shirts as
 * pre-orders, at cost, no payment now). Two shirts side by side on one
 * ruled bar — a flat drawn shirt in each colour, its name, how many are
 * reserved, the sizes as words, one action word — then a small mono table
 * of the same numbers per size. The bar, the footer and the section head
 * ride on theme.ts. Prefix .sp-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const shirtsCss = `
/* THE TWO SHIRTS: one bar between two ink rules, split down the middle by
 * a dashed hairline. Side by side at every width — on a 390px phone each
 * half is 165px, which holds the five size words and CHANGE TO 2XL with
 * the tighter gaps below. */
.row100k .sp-two{display:grid;grid-template-columns:1fr 1fr;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.row100k .sp-shirt{min-width:0;padding:24px 24px 26px 0}
.row100k .sp-shirt + .sp-shirt{border-left:1px dashed var(--line);padding-left:24px;padding-right:0}

/* THE CAROUSEL (2026-10-01, where the drawn tee was): a 4:5 frame the
 * width of the half, the photos snapping one at a time on a horizontal
 * scroll, no scrollbar; a row of dots under it. Empty: one flat frame in
 * the shirt colour, literal fills (under the ink look the paper goes
 * black, and a cream frame drawn in var(--paper) would come out black). */
.row100k .sp-car{position:relative;width:100%}
.row100k .sp-car-strip{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;aspect-ratio:4/5;background:var(--line)}
.row100k .sp-car-strip::-webkit-scrollbar{display:none}
.row100k .sp-car-frame{all:unset;cursor:pointer;flex:none;width:100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:block}
.row100k .sp-car-frame img{display:block;width:100%;height:100%;object-fit:cover}
.row100k .sp-car-frame:focus-visible{outline:2px solid var(--water);outline-offset:-2px}
.row100k .sp-car-empty{aspect-ratio:4/5;display:flex;align-items:flex-end;padding:12px;border:1px solid var(--ink)}
.row100k .sp-car.black .sp-car-empty{background:#15171a}
.row100k .sp-car.cream .sp-car-empty{background:#F4F3EE}
.row100k .sp-car-empty span{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
.row100k .sp-car.black .sp-car-empty span{color:#F4F3EE}
.row100k .sp-car.cream .sp-car-empty span{color:#15171a}
.row100k .sp-car-dots{display:flex;gap:6px;margin-top:10px}
.row100k .sp-car-dots button{all:unset;cursor:pointer;width:8px;height:8px;border:1px solid var(--ink);box-sizing:border-box}
.row100k .sp-car-dots button.on{background:var(--ink)}
.row100k .sp-car-dots button:focus-visible{outline:2px solid var(--water);outline-offset:2px}
/* The two owner words under the frame, in the voice of the action word. */
.row100k .sp-car-admin{display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:10px}
.row100k .sp-go.quiet{color:var(--gray);text-decoration-color:var(--line)}
.row100k .sp-go.quiet:hover{color:var(--water)}

/* The name at headline weight, the count as the bold mono line under it,
 * the number in the one accent. */
.row100k .sp-name{margin-top:16px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(22px,5.4vw,34px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink)}
.row100k .sp-count{margin-top:10px;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.12em;line-height:1.5;text-transform:uppercase;color:var(--ink-soft)}
.row100k .sp-count b{color:var(--water)}

/* THE SIZES AS WORDS (the stats submenu idiom, theme.ts .st-sub): mono
 * caps in grey, the picked one in ink on a 2px water underline. The size
 * already reserved, while another is picked, keeps its ink and takes a
 * dotted rule so the two never read as one. */
.row100k .sp-sizes{display:flex;flex-wrap:wrap;gap:2px 16px;margin-top:16px;padding-top:10px;border-top:1px dashed var(--line)}
.row100k .sp-size{all:unset;cursor:pointer;font-family:var(--row-mono),monospace;font-size:13px;font-weight:700;letter-spacing:.12em;line-height:1.4;padding:6px 0 3px;border-bottom:2px solid transparent;color:var(--gray);transition:color 160ms ease}
.row100k .sp-size:hover:not(.on){color:var(--water)}
.row100k .sp-size.mine{color:var(--ink);border-bottom:2px dotted var(--line)}
.row100k .sp-size.on,.row100k .sp-size.on.mine{color:var(--ink);border-bottom:2px solid var(--water)}
.row100k .sp-size:disabled{cursor:default}
.row100k .sp-size:disabled:not(.on):not(.mine){color:var(--gray)}
.row100k .sp-size:focus-visible{outline:2px solid var(--water);outline-offset:3px}

/* THE ACTION: one word at a time — RESERVE, CHANGE TO L, LET IT GO — bold
 * mono on a water underline; grey on a hairline while there is nothing to
 * do. SIGN IN and OPT IN, for a visitor, wear the same word. */
.row100k .sp-act{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 18px;margin-top:16px;min-height:26px}
.row100k .sp-go{all:unset;cursor:pointer;display:inline-block;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.14em;line-height:1.5;text-transform:uppercase;color:var(--ink);text-decoration:underline;text-decoration-color:var(--water);text-decoration-thickness:2px;text-underline-offset:4px;transition:color 160ms ease}
.row100k .sp-go:hover{color:var(--water)}
.row100k .sp-go:disabled{cursor:default;color:var(--gray);text-decoration-color:var(--line)}
.row100k .sp-go:focus-visible{outline:2px solid var(--water);outline-offset:4px}
/* Something went wrong on the wire: the house error line, mono. */
.row100k .sp-err{margin-top:10px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.06em;line-height:1.6;color:#b3400f}

/* A visitor: the word under the bar, where the actions would be. */
.row100k .sp-visitor{margin-top:18px}

/* THE TABLE: the same numbers per size, small mono, one ink rule under the
 * head, dashed hairlines between the rows, the total on a solid rule. */
.row100k .sp-table{width:100%;max-width:360px;margin-top:26px;border-collapse:collapse;font-family:var(--row-mono),monospace;font-size:12px;font-variant-numeric:tabular-nums}
.row100k .sp-table th{text-align:left;font-size:10px;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);padding:0 0 8px;border-bottom:1px solid var(--ink)}
.row100k .sp-table td{padding:8px 0;border-bottom:1px dashed var(--line);color:var(--ink)}
.row100k .sp-table th.n,.row100k .sp-table td.n{text-align:right;padding-left:18px}
.row100k .sp-table td.k{font-weight:700;letter-spacing:.1em}
.row100k .sp-table tr.all td{border-bottom:none;border-top:1px solid var(--ink);font-weight:700}

/* A phone: the halves keep their split but give up some air. */
@media(max-width:559px){
  .row100k .sp-shirt{padding:18px 14px 20px 0}
  .row100k .sp-shirt + .sp-shirt{padding-left:14px;padding-right:0}
  .row100k .sp-sizes{gap:2px 11px}
  .row100k .sp-size{font-size:12px;letter-spacing:.08em}
  .row100k .sp-go{font-size:11px;letter-spacing:.1em}
}
`;
