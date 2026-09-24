/* THE PLAN PAGE (owner, 2026-09-24: make the plan more user friendly — a
 * calendar of the remaining days with the meters split among them, each
 * day editable in place, a day tappable to turn it off, an UNALLOCATED
 * line and AUTO DISTRIBUTE, a pace chart when a goal is set). The grid
 * borrows the heatmap idiom (.hm in theme.ts: seven columns, mono weekday
 * letters, dashed cells, water fills) but a plan cell carries a number a
 * rower will read and edit, so it is taller than it is wide on a phone and
 * has its own rules here. Prefix .pl-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const planCss = `
/* The target panel: two fields side by side once there is room. */
.row100k .pl-fields{display:grid;grid-template-columns:1fr;gap:0 28px}
@media(min-width:560px){.row100k .pl-fields{grid-template-columns:1fr 1fr}}
.row100k .pl-fields .hint{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-top:6px;line-height:1.6}

/* The status line under the calendar head: what is still unallocated (or
 * over), in water, and the words that act on it. The words are the house
 * dotted-rule control (.tm-btn in theme.ts), not buttons. */
.row100k .pl-status{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 20px;margin:-6px 0 16px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);line-height:1.7}
.row100k .pl-status .n{color:var(--water);font-weight:700}
.row100k .pl-status.ok .n{color:var(--ink)}
.row100k .pl-status .tm-btn{color:var(--ink);font-weight:700}
.row100k .pl-status .tm-btn:hover{color:var(--water)}
.row100k .pl-status .tm-btn:disabled{color:var(--gray);cursor:default;border-bottom-color:transparent}

/* The calendar. */
.row100k .pl-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.row100k .pl-cal .dow{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;color:var(--gray);text-align:center;padding-bottom:3px}
.row100k .pl-day{all:unset;box-sizing:border-box;position:relative;display:block;min-height:64px;padding:6px 5px 6px;border:1px dashed var(--line);text-align:left;color:var(--ink);cursor:pointer;min-width:0;overflow:hidden;-webkit-tap-highlight-color:transparent}
@media(min-width:560px){.row100k .pl-day{min-height:78px;padding:8px 8px 7px}}
.row100k .pl-day:focus-visible{outline:2px solid var(--water);outline-offset:2px}
.row100k .pl-day:hover{border-color:var(--ink)}
.row100k .pl-day .d{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.12em;color:var(--gray);line-height:1}
.row100k .pl-day .m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(13px,3.4vw,20px);line-height:1;margin-top:6px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.row100k .pl-day .s{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.1em;color:var(--gray);text-transform:uppercase;margin-top:5px;line-height:1.2}
/* A day the rower typed holds a solid rule; an auto day keeps the dashes. */
.row100k .pl-day.set{border:1px solid var(--ink)}
.row100k .pl-day.today{box-shadow:inset 0 0 0 2px var(--water)}
.row100k .pl-day.today .d{color:var(--water);font-weight:700}
/* Off: the number goes, the word OFF stays in gray. */
.row100k .pl-day.off{background:repeating-linear-gradient(135deg,transparent 0 6px,rgba(21,23,26,.05) 6px 7px)}
.row100k .pl-day.off .m{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;color:var(--gray);margin-top:8px}
/* Past days: what was rowed, in gray, no tap. */
.row100k .pl-day.past{cursor:default;color:var(--gray);border:1px solid var(--line)}
.row100k .pl-day.past:hover{border-color:var(--line)}
.row100k .pl-day.past.rowed{background:var(--water-pale);border-color:var(--water-pale)}
.row100k .pl-day.past .m{color:var(--ink-soft)}
/* Editing in place: the number becomes a field, two words under it. */
.row100k .pl-day.edit{border:1px solid var(--ink);cursor:default}
.row100k .pl-day input{width:100%;box-sizing:border-box;background:transparent;border:0;border-bottom:2px solid var(--water);border-radius:0;color:var(--ink);font-family:var(--row-mono),monospace;font-size:13px;font-weight:700;padding:3px 0 2px;margin-top:4px;outline:none;appearance:none;font-variant-numeric:tabular-nums}
.row100k .pl-day .acts{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:7px;font-family:var(--row-mono),monospace;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.row100k .pl-day .acts .tm-btn{color:var(--gray)}
.row100k .pl-day .acts .tm-btn:hover{color:var(--water)}
.row100k .pl-legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:12px;font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;line-height:1.8}
.row100k .pl-legend i{display:inline-block;width:12px;height:12px;vertical-align:-2px;margin-right:6px;border:1px dashed var(--line)}
.row100k .pl-legend i.set{border:1px solid var(--ink)}
.row100k .pl-legend i.today{box-shadow:inset 0 0 0 2px var(--water)}
.row100k .pl-legend i.past{background:var(--water-pale);border:1px solid var(--water-pale)}

/* The pace chart rides on .st-kde (theme.ts) like the profile curve. */
.row100k .pl-pace .key{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:8px;font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;line-height:1.8}
.row100k .pl-pace .key i{display:inline-block;width:18px;height:0;vertical-align:3px;margin-right:6px;border-top:2.5px solid var(--water)}
.row100k .pl-pace .key i.next{border-top-style:dashed}
.row100k .pl-pace .key i.goal{border-top:1px dotted var(--ink)}
`;
