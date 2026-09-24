"use client";

import { useEffect, useState } from "react";
import { OptIn } from "./OptIn";

/* LOG A ROW as the third cell of the counter row, for a joined rower
 * (owner, 2026-09-24: "opt in becomes log a row"). The form is LogInPlace,
 * mounted by the page UNDER the cells bar (owner, 2026-09-25: "when I click
 * LOG A ROW the form opens ABOVE the button; it should open BELOW the cells
 * bar, on desktop and mobile"), and this word toggles it by event — no
 * navigation, so NavProgress draws no line. The arrow points right while
 * the form is shut and turns to point down while it is open (owner: "a
 * small animation, and back when closed"): LogInPlace says which each time
 * the seam moves, so the two never disagree, whatever opened it. */
export function LogCell() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onState = (e: Event) => setOpen((e as CustomEvent<boolean>).detail === true);
    window.addEventListener("row100k:log-open", onState);
    return () => window.removeEventListener("row100k:log-open", onState);
  }, []);
  return (
    <div className="go">
      {/* .long: three words and the arrow, sized to the cell (frontCss.ts);
        * .open turns the arrow. */}
      <OptIn
        className={`long${open ? " open" : ""}`}
        onClick={() => window.dispatchEvent(new Event("row100k:log-toggle"))}
      >
        Log a row
      </OptIn>
    </div>
  );
}
