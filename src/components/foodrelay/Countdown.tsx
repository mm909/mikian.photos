"use client";

import { useEffect, useState } from "react";

/* The clock to the start. Renders dashes on the server and on the first
 * client pass (the two must agree), then ticks. Once the start has passed
 * it says so instead of counting up. */
export function Countdown({ target, doneLabel }: { target: string; doneLabel: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now === null ? null : new Date(target).getTime() - now;
  if (left !== null && left <= 0) {
    return (
      <div className="fr-count fr-count-done" role="status">
        {doneLabel}
      </div>
    );
  }
  const s = left === null ? null : Math.floor(left / 1000);
  const parts: [string, number | null][] = [
    ["Days", s === null ? null : Math.floor(s / 86400)],
    ["Hours", s === null ? null : Math.floor((s % 86400) / 3600)],
    ["Minutes", s === null ? null : Math.floor((s % 3600) / 60)],
    ["Seconds", s === null ? null : s % 60],
  ];
  return (
    <div className="fr-count" role="timer" aria-label="Time until the start">
      {parts.map(([label, v], i) => (
        <div className="fr-count-cell" key={label}>
          <div className="fr-count-n">{v === null ? "--" : i === 0 ? v : String(v).padStart(2, "0")}</div>
          <div className="fr-count-l">{label}</div>
        </div>
      ))}
    </div>
  );
}
