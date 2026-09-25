/* THE PLAN PAGE (owner, 2026-09-25: one section, THE PLAN with the month
 * as its date; the calendar is days ON or OFF plus what was actually
 * done, a click toggles a day and the meters redistribute by
 * themselves). The grid borrows the heatmap idiom (.hm in theme.ts: seven
 * columns, mono weekday letters, dashed cells) but a plan cell carries a
 * number a rower will read, so it is taller than it is wide on a phone
 * and has its own rules here. Prefix .pl-.
 *
 * Rendered as the text child of a style tag, so no double quotes, no
 * apostrophes, no angle brackets and no ampersands anywhere in this
 * string, comments included (see the note in theme.ts). */
export const planCss = `
/* The two fields, side by side once there is room. They wear the panel
 * input rule without the panel box (owner, 2026-09-25: quieter, fewer
 * things). */
.row100k .pl-fields{display:grid;grid-template-columns:1fr;gap:0 28px}
@media(min-width:560px){.row100k .pl-fields{grid-template-columns:1fr 1fr}}
.row100k .pl-fields label.fl{margin-top:6px}
.row100k .pl-fields input{width:100%;box-sizing:border-box;background:transparent;border:0;border-bottom:2px solid var(--line);color:var(--ink);font-family:var(--row-archivo),sans-serif;font-size:17px;padding:8px 2px;border-radius:0;appearance:none;-webkit-appearance:none;font-variant-numeric:tabular-nums}
.row100k .pl-fields input:focus{outline:none;border-bottom-color:var(--water)}
.row100k .pl-fields ::placeholder{color:#a5a49d}
.row100k .pl-tiles{margin-top:28px}

/* The calendar. A day that is ON holds its meters inside a solid ink
 * rule; OFF is dashed and blank; the past is grey with what was rowed. */
.row100k .pl-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:22px}
.row100k .pl-cal .dow{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;color:var(--gray);text-align:center;padding-bottom:3px}
.row100k .pl-day{all:unset;box-sizing:border-box;position:relative;display:block;min-height:64px;padding:6px 5px 6px;border:1px solid var(--ink);text-align:left;color:var(--ink);cursor:pointer;min-width:0;overflow:hidden;-webkit-tap-highlight-color:transparent}
@media(min-width:560px){.row100k .pl-day{min-height:78px;padding:8px 8px 7px}}
.row100k .pl-day:focus-visible{outline:2px solid var(--water);outline-offset:2px}
.row100k .pl-day:hover{border-color:var(--water)}
.row100k .pl-day .d{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.12em;color:var(--gray);line-height:1}
.row100k .pl-day .m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(13px,3.4vw,20px);line-height:1;margin-top:6px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;min-height:1em}
.row100k .pl-day .s{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.1em;color:var(--gray);text-transform:uppercase;margin-top:5px;line-height:1.2}
.row100k .pl-day.today{box-shadow:inset 0 0 0 2px var(--water)}
.row100k .pl-day.today .d{color:var(--water);font-weight:700}
/* Off: dashed, blank. */
.row100k .pl-day.off{border:1px dashed var(--line)}
.row100k .pl-day.off:hover{border-color:var(--gray)}
/* Past days: what was rowed, in grey, no tap. */
.row100k .pl-day.past{cursor:default;color:var(--gray);border:1px solid var(--line)}
.row100k .pl-day.past:hover{border-color:var(--line)}
.row100k .pl-day.past.rowed{background:var(--water-pale);border-color:var(--water-pale)}
.row100k .pl-day.past .m{color:var(--ink-soft)}

/* The pace chart rides on .st-kde (theme.ts) like the profile curve. */
.row100k .pl-pace{margin-top:28px}
.row100k .pl-pace .key{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:8px;font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;line-height:1.8}
.row100k .pl-pace .key i{display:inline-block;width:18px;height:0;vertical-align:3px;margin-right:6px;border-top:2.5px solid var(--water)}
.row100k .pl-pace .key i.next{border-top-style:dashed}
.row100k .pl-pace .key i.goal{border-top:1px dotted var(--ink)}
`;
