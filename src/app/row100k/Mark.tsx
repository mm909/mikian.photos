import { EDITION, MARK } from "@/lib/row100k";

/* THE WORDMARK as type (owner, 2026-10-30: "I need a Rowvember new logo").
 * One word in Archivo Black caps wherever the site signs itself — the bar,
 * the front nameplate, the footer, the share dialog — and the word follows
 * the month (row100k.ts MARK): ROWTEMBER, the brand, except in a month
 * with an edition of its own, when it is that edition's name.
 *
 * ROWVEMBER carries its device: the V is set in the accent (theme.ts
 * .mk-v, --water) — the one letter that is not in ROWTEMBER, the chevron
 * of a blade entering the water — and the SVG files under
 * public/row100k/rowvember draw the same mark for anything outside the
 * site (Instagram, print, a partner). A slab that is already the accent
 * (the share dialog's .share-mark) sets the V back to the slab's type, so
 * the device never disappears into its own colour. ROWTEMBER has no
 * device: it is the word as it has always been. Server component. */
export function Mark() {
  if (EDITION !== "Rowvember") return <>{MARK}</>;
  const i = MARK.indexOf("V");
  return (
    <>
      {MARK.slice(0, i)}
      <span className="mk-v">V</span>
      {MARK.slice(i + 1)}
    </>
  );
}
