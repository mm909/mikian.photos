"use client";

import { useEffect, useState } from "react";

/* LOG A ROW as a word (owner, 2026-09-25: "a LOG A ROW call to action" is
 * the first priority of the feed landing; and this week: controls as
 * words, quieter, smaller). The same contract as the counter row's
 * LogCell: the page mounts LogInPlace under the head, this word toggles
 * it by the row100k:log-toggle event, and LogInPlace answers with
 * row100k:log-open so the word can say it is open. No navigation. */
export function LogWord() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onState = (e: Event) => setOpen((e as CustomEvent<boolean>).detail === true);
    window.addEventListener("row100k:log-open", onState);
    return () => window.removeEventListener("row100k:log-open", onState);
  }, []);
  return (
    <button
      type="button"
      className={open ? "lk-log open" : "lk-log"}
      aria-expanded={open}
      onClick={() => window.dispatchEvent(new Event("row100k:log-toggle"))}
    >
      Log a row
      <span className="arr" aria-hidden="true">
        <svg viewBox="0 0 100 100" focusable="false">
          <path d="M6 50h78M52 18l32 32-32 32" fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="butt" strokeLinejoin="miter" />
        </svg>
      </span>
    </button>
  );
}
