"use client";

import { useEffect, useState } from "react";
import { START_MS, END_MS, FIRST_DAY_TAG, LATE_LOGS_TAG, LOG_CLOSE_MS, MONTH_NAME, nowMs } from "@/lib/row100k";

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
 * first client render match (same trick as /lasd26). `size` small is the
 * corner-of-the-newspaper cut (owner call, 2026-09-05: the clock was taking
 * up too much space — same box as the leader headline, still ticking). */
/* THE CLOCK COUNTS DOWN TO THE END OF LIGHTS OUT while a window is open
 * (owner, 2026-09-21: "let us not say hidden until September 27th — the
 * clock that is currently counting down to the end of the month can instead
 * count down to the end of lights out"). The end of the month is what it
 * counts to the rest of the time. */
export function Countdown({ size, lightsOutEndsAt }: { size?: "small"; lightsOutEndsAt?: string | null } = {}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(nowMs());
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(t);
  }, []);

  const small = size === "small" ? " small" : "";

  if (now !== null && now >= LOG_CLOSE_MS) {
    return (
      <div className={`count-done mono${small}`}>
        THAT&rsquo;S A WRAP — THE BOARD IS FINAL.
      </div>
    );
  }
  if (now !== null && now >= END_MS) {
    return (
      <div className={`count-done mono${small}`}>
        {MONTH_NAME.toUpperCase()}&rsquo;S DONE — LATE LOGS CLOSE {LATE_LOGS_TAG}.
      </div>
    );
  }

  const started = now !== null && now >= START_MS;
  const outEnd = lightsOutEndsAt ? Date.parse(lightsOutEndsAt) : NaN;
  const lightsOut = started && Number.isFinite(outEnd) && now !== null && now < outEnd;
  const target = lightsOut ? outEnd : started ? END_MS : START_MS;
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
      className={`count${small}`}
      role="timer"
      aria-label={lightsOut ? "Time left in lights out" : started ? `Time left in ${MONTH_NAME}` : `Countdown to ${FIRST_DAY_TAG}`}
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
