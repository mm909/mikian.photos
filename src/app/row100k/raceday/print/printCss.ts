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
 * ONE LOOK — ink on white (owner, same day, of the three offered: "I like
 * version A"). The type is the site's own: Archivo Black for the bill,
 * Space Mono for the small print. */
export const printCss = `
@page{size:8.5in 11in;margin:0}
.pr{margin:0;padding:0;font-family:var(--row-archivo),sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pr *{box-sizing:border-box;min-width:0}
.pr b,.pr i{font-style:normal;font-weight:400}
.pr p,.pr hr{color:inherit}
.pr-sheet{
  width:8.5in;height:11in;position:relative;overflow:hidden;
  padding:.55in .6in .55in;background:#fff;color:#000;
  display:flex;flex-direction:column;
}
@media screen{
  .pr{background:#5a5a5a;padding:24px 0;min-height:100vh}
  .pr-sheet{margin:0 auto;box-shadow:0 8px 40px rgba(0,0,0,.45)}
  .pr.flat{background:#fff;padding:0;min-height:0}
  .pr.flat .pr-sheet{margin:0;box-shadow:none}
}

.pr-top{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--row-mono),monospace;font-size:10.5pt;letter-spacing:.22em;text-transform:uppercase;padding-bottom:.12in;border-bottom:.06in solid currentColor}
.pr-title{margin:.1in 0 0;font-family:var(--row-archivo-black),sans-serif;font-weight:400;text-transform:uppercase;line-height:.84;letter-spacing:-.03em;font-size:176pt}
.pr-title span{display:block}
.pr-rule{border:0;border-top:.06in solid currentColor;margin:.14in 0 0}
.pr-sub{margin:.14in 0 0;font-family:var(--row-archivo-black),sans-serif;font-size:36pt;line-height:1;letter-spacing:-.01em;text-transform:uppercase}
.pr-facts{display:grid;grid-template-columns:repeat(3,auto);justify-content:space-between;column-gap:.3in;margin-top:.3in;border-top:.06in solid currentColor;padding:.18in 0;border-bottom:.06in solid currentColor}
.pr-facts div{border-left:1px solid currentColor;padding-left:.24in}
.pr-facts div:first-child{border-left:0;padding-left:0}
.pr-facts b{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:36pt;line-height:1;letter-spacing:-.02em;text-transform:uppercase;white-space:nowrap}

/* THE FOOT: the code, OPT IN, and the house. */
.pr-foot{margin-top:auto;display:grid;grid-template-columns:1.8in minmax(0,1fr) 1.6in;gap:.28in;align-items:center;border-top:.06in solid currentColor;padding-top:.3in}
.pr-qr{display:block;width:1.8in;height:1.8in}
.pr-cta{margin:0;font-family:var(--row-archivo-black),sans-serif;font-size:54pt;line-height:.9;letter-spacing:-.03em;text-transform:uppercase;white-space:nowrap}
.pr-mark{display:block;width:1.6in;height:auto;justify-self:end}
`;
