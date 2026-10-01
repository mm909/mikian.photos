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
/* The one line of copy, under the section head. */
.row100k .sp-line{margin:-8px 0 26px;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.1em;line-height:1.6;text-transform:uppercase;color:var(--ink-soft)}

/* THE TWO SHIRTS: one bar between two ink rules, split down the middle by
 * a dashed hairline. Side by side at every width — on a 390px phone each
 * half is 165px, which holds the five size words and CHANGE TO 2XL with
 * the tighter gaps below. */
.row100k .sp-two{display:grid;grid-template-columns:1fr 1fr;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink)}
.row100k .sp-shirt{min-width:0;padding:24px 24px 26px 0}
.row100k .sp-shirt + .sp-shirt{border-left:1px dashed var(--line);padding-left:24px;padding-right:0}

/* The drawing: a flat tee, the fill the shirt itself and the outline the
 * ink — so the black shirt stands on the paper and the cream one is cut
 * out of it. Literal fills, not the variables: under the ink look the
 * paper goes black and the ink white, and a cream shirt drawn in var(--paper)
 * would come out black. The outline follows the look. */
.row100k .sp-fig{display:block;width:100%;max-width:200px;height:auto}
.row100k .sp-fig path{stroke:var(--ink);stroke-width:2;stroke-linejoin:miter;vector-effect:non-scaling-stroke}
.row100k .sp-fig.black path{fill:#15171a}
.row100k .sp-fig.cream path{fill:#F4F3EE}

/* The name at headline weight, the count as the bold mono line under it,
 * the number in the one accent. */
.row100k .sp-name{margin-top:18px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(22px,5.4vw,34px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink)}
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
