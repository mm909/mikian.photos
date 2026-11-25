/* THE M2D PAGE (page.tsx, M2dSite.tsx), on top of the board page
 * (board100kCss): the dollars as the head, the goal track, the call in a
 * ruled box, and a dollars column on every width. Site variables only
 * (theme.ts). Rendered as the text child of a style tag, so no double
 * quotes, no apostrophes, no angle brackets and no ampersands in this
 * string; descendant selectors only. */
export const m2dCss = `
.row100k .m2-head{margin-top:26px}
.row100k .m2-kick{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .m2-big{margin-top:6px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(64px,17vw,168px);font-weight:400;line-height:.95;letter-spacing:-.02em;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .m2-sub{margin-top:10px;font-family:var(--row-mono),monospace;font-size:11px;line-height:1.6;letter-spacing:.12em;text-transform:uppercase;color:var(--gray)}
.row100k .m2-goal{margin-top:22px;max-width:560px}
.row100k .m2-goal-t{display:flex;justify-content:space-between;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.row100k .m2-track{margin-top:6px;height:10px;border:1px solid var(--ink)}
.row100k .m2-track i{display:block;height:100%;background:var(--water)}
.row100k .m2-match{margin-top:20px;max-width:640px;font-size:15px;line-height:1.5;color:var(--ink-soft)}
.row100k .m2-match b{color:var(--ink)}

.row100k .m2-call{margin-top:34px;border:2px solid var(--ink);padding:22px 18px}
.row100k .m2-call h2{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,8vw,56px);font-weight:400;line-height:1;letter-spacing:-.01em;text-transform:uppercase;color:var(--ink)}
.row100k .m2-call h2 i{font-style:normal;color:var(--water)}
.row100k .m2-lede{margin-top:14px;max-width:640px;font-size:16px;line-height:1.5;color:var(--ink-soft)}
.row100k .m2-call h3{margin-top:26px;font-family:var(--row-archivo-black),sans-serif;font-size:19px;font-weight:400;text-transform:uppercase;color:var(--ink)}
.row100k .m2-steps{list-style:none;margin:6px 0 0;padding:0}
.row100k .m2-steps li{display:grid;grid-template-columns:28px minmax(0,1fr);column-gap:12px;margin-top:14px}
.row100k .m2-steps .k{font-family:var(--row-archivo-black),sans-serif;font-size:20px;line-height:1.1;color:var(--water)}
.row100k .m2-steps b{font-size:16px;color:var(--ink)}
.row100k .m2-steps p{margin-top:2px;font-size:14px;line-height:1.45;color:var(--gray)}
.row100k .m2-note{margin-top:16px;font-family:var(--row-mono),monospace;font-size:10px;line-height:1.6;letter-spacing:.1em;text-transform:uppercase;color:var(--gray)}
.row100k .m2-yes{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 24px;margin-top:20px}
.row100k .m2-yes p{font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--water)}

.row100k .m2 .bd-cols,.row100k .m2 .bd-in{grid-template-columns:26px minmax(0,1fr) 72px 64px}
.row100k .m2-usd{font-weight:700;color:var(--water)}
.row100k .m2-usd.off{font-weight:400;color:var(--gray);opacity:.7}
@media(min-width:640px){
  .row100k .m2-head{margin-top:38px}
  .row100k .m2-call{padding:30px 32px}
  .row100k .m2 .bd-cols,.row100k .m2 .bd-in{grid-template-columns:48px minmax(0,1fr) 140px 140px}
}
`;
