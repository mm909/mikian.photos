/* The roster's pace and shift boxes, ADD A RUNNER, and the join page's
 * "are you one of these?" names (owner, 2026-11-16: named runners a person
 * claims from the invite link; "8 runners and target paces"). Loaded by the
 * team and join pages after the shared sheets. */

export const teamCss = `
.lasd26 .tsp-chip.wait{border-style:dashed;border-color:var(--gray);color:var(--gray)}
.lasd26 .tsp-plan{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px 12px;flex:0 1 auto}
.lasd26 .tsp-plan label{display:block}
.lasd26 .tsp-plan .k{display:block;font-family:var(--lasd-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin-bottom:4px}
.lasd26 .tsp-plan .v{display:block;font-family:var(--lasd-mono),monospace;font-size:14px;font-weight:700;min-height:36px;line-height:36px}
.lasd26 .tsp-plan .tm-num{width:84px;min-height:40px}
.lasd26 .tsp-plan .tm-err{flex-basis:100%;margin:0}
.lasd26 .tsp-plan .tm-note{margin:0;align-self:center}
.lasd26 .tsp-sel{min-height:40px;border:2px solid var(--ink);background:var(--paper);color:var(--ink);font-family:var(--lasd-mono),monospace;font-size:14px;font-weight:700;padding:0 8px;border-radius:0}
.lasd26 .tsp-add{margin-top:22px;padding-top:18px;border-top:2px solid var(--ink)}
.lasd26 .tsp-add h3{font-family:var(--lasd-mono),monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase}
.lasd26 .tsp-claim{margin-bottom:26px}
.lasd26 .tsp-claim-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;max-width:520px}
.lasd26 .tsp-claim-btn{display:block;text-align:left;min-height:56px;padding:8px 12px;border:2px solid var(--ink);background:var(--paper);color:var(--ink);cursor:pointer;font:inherit}
.lasd26 .tsp-claim-btn:hover:not(:disabled){background:var(--ink);color:var(--paper)}
.lasd26 .tsp-claim-btn:disabled{opacity:.5;cursor:default}
.lasd26 .tsp-claim-btn b{display:block;font-size:16px}
.lasd26 .tsp-claim-btn small{display:block;font-family:var(--lasd-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.7}
.lasd26 .tsp-or{font-family:var(--lasd-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);margin:0 0 12px}
`;
