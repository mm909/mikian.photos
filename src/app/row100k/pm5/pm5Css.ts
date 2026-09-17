/* Page-local styles for /row100k/pm5 — .pm- prefix, theme.ts untouched.
 * Rendered as the text child of a style tag, so NO double quotes, angle
 * brackets, apostrophes or ampersands anywhere in the string (the note in
 * theme.ts: React escapes them server-side only and hydration fails on the
 * mismatch). Every colour is a variable so ink and paper both read. */
export const pmCss = `
.row100k .pm-copy{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--gray);line-height:1.8;margin:0 0 18px;max-width:72ch}
.row100k .pm-copy b{color:var(--ink);font-weight:700}
.row100k .pm-nope{border:2px solid var(--ink);padding:18px 20px;font-family:var(--row-mono),monospace;font-size:13px;line-height:1.8;color:var(--ink)}
.row100k .pm-nope b{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:20px;text-transform:uppercase;margin-bottom:6px}
.row100k .pm-sec{margin-top:40px}
.row100k .pm-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:14px}
.row100k .pm-head h3{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(18px,4vw,24px);text-transform:uppercase;margin:0}
.row100k .pm-head .mono{font-size:11px;color:var(--gray);letter-spacing:.1em}
.row100k .pm-act{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
.row100k .pm-act .send{margin-top:0;width:auto;padding:11px 18px;font-size:14px}
.row100k .pm-check{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.row100k .pm-check input{accent-color:var(--water);width:15px;height:15px;margin:0}
.row100k .pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.row100k .pm-erg{border:2px solid var(--ink);padding:12px 14px 14px;font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink)}
.row100k .pm-erg.dropped{border-style:dashed;border-color:var(--gray)}
.row100k .pm-erg .h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;border-bottom:1px solid var(--ink);padding-bottom:6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.row100k .pm-erg .h .st{color:var(--gray);font-weight:400}
.row100k .pm-erg .h .st.live{color:var(--water)}
.row100k .pm-erg .big{font-family:var(--row-archivo-black),sans-serif;font-size:34px;line-height:1;margin:12px 0 2px;font-variant-numeric:tabular-nums}
.row100k .pm-erg .big .u{font-family:var(--row-mono),monospace;font-size:11px;font-weight:400;letter-spacing:.12em;color:var(--gray);margin-left:6px}
.row100k .pm-erg .state{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--water);margin:0 0 8px}
.row100k .pm-erg dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0;padding:0}
.row100k .pm-erg dt{color:var(--gray);font-size:10px;letter-spacing:.12em;text-transform:uppercase;align-self:baseline}
.row100k .pm-erg dd{margin:0;font-variant-numeric:tabular-nums;text-align:right}
.row100k .pm-erg .lane{display:flex;align-items:center;gap:8px;margin:12px 0 0;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.row100k .pm-erg .lane select{font-family:var(--row-mono),monospace;font-size:12px;padding:5px 6px;border:2px solid var(--ink);background:var(--paper);color:var(--ink);cursor:pointer;flex:1}
.row100k .pm-erg .who{margin-top:6px;font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:14px;color:var(--ink)}
.row100k .pm-erg .who .n{font-family:var(--row-mono),monospace;font-weight:400;font-size:11px;color:var(--gray);margin-right:6px}
.row100k .pm-erg .final{margin-top:12px;border-top:1px dashed var(--line);padding-top:10px}
.row100k .pm-erg .final .t{font-family:var(--row-archivo-black),sans-serif;font-size:26px;line-height:1;margin:4px 0 8px;font-variant-numeric:tabular-nums}
.row100k .pm-erg .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.row100k .pm-erg .btns .send{margin-top:0;width:auto;padding:9px 14px;font-size:13px}
.row100k .pm-erg .btns .outline-btn{padding:7px 12px;font-size:11px}
.row100k .pm-erg .note{margin-top:10px;font-size:11px;line-height:1.6;color:var(--water);word-break:break-word}
.row100k .pm-erg .note.bad{color:var(--ink)}
.row100k .pm-empty{font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray);line-height:1.8;padding:8px 0}
.row100k .pm-wave .tabs{margin-bottom:12px}
.row100k table.board.pm-t{min-width:420px}
.row100k .pm-scroll{overflow-x:auto}
.row100k .pm-log{border:2px solid var(--ink);background:var(--ink);color:var(--paper);font-family:var(--row-mono),monospace;font-size:11px;line-height:1.7;padding:10px 12px;max-height:320px;overflow-y:auto;white-space:pre-wrap;word-break:break-word}
.row100k .pm-log .ts{color:var(--gray);margin-right:8px}
.row100k .pm-ok{margin-top:10px;font-family:var(--row-mono),monospace;font-size:12px;color:var(--water);line-height:1.7}
.row100k .pm-err{margin-top:10px;font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink);line-height:1.7}
@media (max-width:560px){.row100k .pm-grid{grid-template-columns:1fr}}
`;
