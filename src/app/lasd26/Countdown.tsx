"use client";

import { useEffect, useState } from "react";

/* Start is Fri Oct 23, 2026 at 5:00 AM Pacific (PDT, UTC-7). */
const START = Date.UTC(2026, 9, 23, 12, 0, 0);

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

export function Countdown() {
  // null until mounted so the server and first client render match.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now !== null && now >= START) {
    return (
      <div className="count-done mono">
        WE&rsquo;RE OFF — SEE YOU IN SAN DIEGO.
      </div>
    );
  }

  const left = now === null ? null : parts(START - now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const cells = [
    { n: left ? String(left.days) : "—", l: "days" },
    { n: left ? pad(left.hours) : "—", l: "hrs" },
    { n: left ? pad(left.mins) : "—", l: "min" },
    { n: left ? pad(left.secs) : "—", l: "sec" },
  ];

  return (
    <div className="count" role="timer" aria-label="Countdown to the 5:00 AM start">
      {cells.map((c) => (
        <div className="c" key={c.l}>
          <div className="n">{c.n}</div>
          <div className="l">{c.l}</div>
        </div>
      ))}
    </div>
  );
}
