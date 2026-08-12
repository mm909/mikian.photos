"use client";

import { useEffect, useState } from "react";
import { START_MS, END_MS, LOG_CLOSE_MS, nowMs } from "@/lib/row100k";

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

/* Before Sep 1: counts down to the first stroke. During September: counts
 * what's left. After: a wrap banner. Null-until-mounted so the server and
 * first client render match (same trick as /lasd26). */
export function Countdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(nowMs());
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now !== null && now >= LOG_CLOSE_MS) {
    return (
      <div className="count-done mono">
        THAT&rsquo;S A WRAP — THE BOARD BELOW IS FINAL.
      </div>
    );
  }
  if (now !== null && now >= END_MS) {
    return (
      <div className="count-done mono">
        SEPTEMBER&rsquo;S DONE — LATE LOGS CLOSE OCT 3.
      </div>
    );
  }

  const started = now !== null && now >= START_MS;
  const target = started ? END_MS : START_MS;
  const left = now === null ? null : parts(target - now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const cells = [
    { n: left ? String(left.days) : "—", l: "days" },
    { n: left ? pad(left.hours) : "—", l: "hrs" },
    { n: left ? pad(left.mins) : "—", l: "min" },
    { n: left ? pad(left.secs) : "—", l: "sec" },
  ];

  return (
    <div
      className="count"
      role="timer"
      aria-label={started ? "Time left in September" : "Countdown to September 1"}
    >
      {cells.map((c) => (
        <div className="c" key={c.l}>
          <div className="n">{c.n}</div>
          <div className="l">{c.l}</div>
        </div>
      ))}
    </div>
  );
}
