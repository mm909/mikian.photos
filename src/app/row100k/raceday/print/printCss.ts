/* THE PRINT SHEETS (owner, 2026-09-21: "make me flyers for race day that I
 * can print out and put at local gyms. Give me a few options and make sure
 * they are in a format I can send to a print shop").
 *
 * Text child of a style tag: NO double quotes, apostrophes, angle brackets
 * or ampersands anywhere in here, comments included.
 *
 * US LETTER, 8.5 by 11 inches, and everything on it is measured in inches
 * and points because that is what a print shop measures in. @page has no
 * margin so the sheet is the page; the sheet keeps its own half-inch safe
 * margin inside, which is what a desk printer cannot reach anyway. On
 * screen the sheets stack on grey with a shadow so the page reads as
 * paper; ?flat=1 drops that for a straight screenshot.
 *
 * THREE LOOKS, one class each:
 *   .pr-a  PAPER  — ink on white. The cheap one: any printer, any gym.
 *   .pr-b  INK    — white on black, the race day page as a poster.
 *   .pr-c  TABS   — ink on white with a tear-off strip of eight tabs.
 * The type is the site's own: Archivo Black for the bill, Space Mono for
 * the small print. */
export const printCss = `
@page{size:8.5in 11in;margin:0}
.pr{margin:0;padding:0;font-family:var(--row-archivo),sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pr *{box-sizing:border-box;min-width:0}
.pr b,.pr i{font-style:normal;font-weight:400}
/* The site sheet colours p and hr on its own; on ink they must follow the sheet. */
.pr p,.pr hr{color:inherit}
.pr-sheet{
  width:8.5in;height:11in;position:relative;overflow:hidden;
  padding:.55in .6in .5in;background:#fff;color:#000;
  display:flex;flex-direction:column;
  break-after:page;page-break-after:always;
}
.pr-sheet:last-child{break-after:auto;page-break-after:auto}
.pr-b{background:#000;color:#fff}
@media screen{
  .pr{background:#5a5a5a;padding:24px 0;min-height:100vh}
  .pr-sheet{margin:0 auto 24px;box-shadow:0 8px 40px rgba(0,0,0,.45)}
  .pr.flat{background:#fff;padding:0;min-height:0}
  .pr.flat .pr-sheet{margin:0;box-shadow:none}
  .pr-nav{max-width:8.5in;margin:0 auto 18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#fff}
  .pr-nav a{color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.5);padding:8px 12px;border-radius:2px}
  .pr-nav a.on,.pr-nav a:hover{background:#fff;color:#000;border-color:#fff}
  .pr-nav .k{margin-right:6px;opacity:.7}
}
@media print{.pr-nav{display:none}}

/* ---- the bill, shared by all three ---------------------------------- */
.pr-top{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--row-mono),monospace;font-size:10.5pt;letter-spacing:.22em;text-transform:uppercase;padding-bottom:.12in;border-bottom:.06in solid currentColor}
.pr-title{margin:.1in 0 0;font-family:var(--row-archivo-black),sans-serif;font-weight:400;text-transform:uppercase;line-height:.84;letter-spacing:-.03em;font-size:176pt}
.pr-title span{display:block}
.pr-rule{border:0;border-top:.06in solid currentColor;margin:.14in 0 0}
.pr-sub{margin:.12in 0 0;font-family:var(--row-archivo-black),sans-serif;font-size:36pt;line-height:1;letter-spacing:-.01em;text-transform:uppercase}
.pr-wave{margin:.1in 0 0;font-family:var(--row-mono),monospace;font-size:10.5pt;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap}
.pr-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:.22in;border-top:.06in solid currentColor;padding-top:.14in}
.pr-facts div{padding:0 .16in 0 0;border-left:1px solid currentColor;padding-left:.14in}
.pr-facts div:first-child{border-left:0;padding-left:0}
.pr-facts b{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:34pt;line-height:1;letter-spacing:-.02em;text-transform:uppercase;white-space:nowrap}
.pr-facts span{display:block;margin-top:.08in;font-family:var(--row-mono),monospace;font-size:9pt;letter-spacing:.16em;text-transform:uppercase;opacity:.72}
.pr-where{margin:.18in 0 0;font-size:14.5pt;line-height:1.5;max-width:6.2in}
.pr-where b{font-weight:700}

/* THE FOOT: the code, what it does, and the house. */
.pr-foot{margin-top:auto;display:grid;grid-template-columns:1.55in minmax(0,1fr) 1.9in;gap:.28in;align-items:center;border-top:.06in solid currentColor;padding-top:.24in}
.pr-qr{display:block;width:1.55in;height:1.55in}
.pr-how b{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:17pt;line-height:1.05;text-transform:uppercase;letter-spacing:-.01em}
.pr-how span{display:block;margin-top:.07in;font-family:var(--row-mono),monospace;font-size:11.5pt;font-weight:700;letter-spacing:.06em}
.pr-how small{display:block;margin-top:.09in;font-size:10.5pt;line-height:1.45;opacity:.8}
.pr-mark{display:block;width:1.9in;height:auto;justify-self:end}

/* ---- C, the tear-off ------------------------------------------------- */
.pr-c{padding-bottom:.35in}
.pr-c .pr-title{font-size:136pt}
.pr-c .pr-foot{border-top:0;padding-top:.16in;margin-top:.14in;grid-template-columns:1.2in minmax(0,1fr) 1.7in}
.pr-c .pr-qr{width:1.2in;height:1.2in}
.pr-c .pr-mark{width:1.7in}
.pr-tabs{margin-top:auto;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));border-top:1px dashed currentColor;height:2.2in}
.pr-tab{border-left:1px dashed currentColor;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:.1in .04in .06in;gap:.08in;overflow:hidden}
.pr-tab:first-child{border-left:0}
.pr-tab img{width:.62in;height:.62in;display:block}
.pr-tab span{writing-mode:vertical-rl;transform:rotate(180deg);font-family:var(--row-mono),monospace;font-size:7pt;font-weight:700;letter-spacing:.04em;line-height:1.5;white-space:nowrap;flex:1;min-height:0;display:flex;align-items:center;justify-content:flex-end}
.pr-tab span b{font-weight:700}
.pr-cut{display:flex;justify-content:space-between;font-family:var(--row-mono),monospace;font-size:7pt;letter-spacing:.2em;text-transform:uppercase;opacity:.55;margin-top:.06in}
`;
