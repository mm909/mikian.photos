"use client";

import { OptIn } from "./OptIn";

/* LOG A ROW as the third cell of the counter row, for a joined rower
 * (owner, 2026-09-24: "opt in becomes log a row"). The same thing the bar
 * button does (BarLog.tsx): the form is LogInPlace, mounted in the
 * Dashboard above, and it opens in place on the row100k:log event — no
 * navigation, so NavProgress draws no line. */
export function LogCell() {
  return (
    <div className="go">
      {/* .long: three words and the arrow, sized to the cell (frontCss.ts). */}
      <OptIn className="long" onClick={() => window.dispatchEvent(new Event("row100k:log"))}>
        Log a row
      </OptIn>
    </div>
  );
}
