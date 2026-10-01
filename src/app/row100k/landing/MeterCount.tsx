"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/* THE METERS ON THE FOLD, counting up (owner, 2026-09-30: the meters
 * figure counts up on load). The server prints the final number, so the
 * page reads right with no script and the hydration matches; then, before
 * the first client paint, the figure drops to zero and runs to the number
 * over about a second on requestAnimationFrame, easing out. Under
 * prefers-reduced-motion it never leaves the final number. Tabular figures
 * (the sheet) keep the digits from swimming while it runs. */

const RUN_MS = 1200;

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function MeterCount({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const [run, setRun] = useState(false);

  useLayoutEffect(() => {
    if (value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(0);
    setRun(true);
  }, [value]);

  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const x = Math.min(1, (t - t0) / RUN_MS);
      const eased = 1 - Math.pow(1 - x, 3);
      setShown(value * eased);
      if (x < 1) raf = requestAnimationFrame(tick);
      else setRun(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, value]);

  return <span className={className}>{fmt(shown)}</span>;
}
