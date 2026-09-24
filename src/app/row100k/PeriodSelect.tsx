"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/* WHICH MONTH, as one control (owner, 2026-09-24: "I don't like the
 * selectors for the board — in 2027 I'm going to have 20 of these little
 * buttons; a selection, maybe with some arrows"). A select of every month
 * there has been plus ALL TIME, with an arrow either side that steps to
 * the month before or after. The board and the profile both mount it; the
 * page it sits on decides what the months are (rowPeriod.ts
 * periodOptions) and where ?m= goes.
 *
 * This month is the page's own URL, with no query, so the plain link stays
 * the plain link. */
export type PeriodOption = { key: string; label: string };

export function PeriodSelect({ options, value, base, current }: { options: PeriodOption[]; value: string; base: string; current: string }) {
  const router = useRouter();
  const hrefOf = (k: string) => (k === current ? base : `${base}?m=${encodeURIComponent(k)}`);
  const i = options.findIndex((o) => o.key === value);
  const prev = i > 0 ? options[i - 1] : null;
  const next = i >= 0 && i < options.length - 1 ? options[i + 1] : null;
  return (
    <div className="pd-nav">
      <Link className={prev ? "" : "off"} href={prev ? hrefOf(prev.key) : "#"} aria-label={prev ? `Back to ${prev.label}` : "No earlier month"} aria-disabled={!prev} tabIndex={prev ? undefined : -1}>
        ‹
      </Link>
      <span className="sel">
        <select value={value} aria-label="Which month" onChange={(ev) => router.push(hrefOf(ev.target.value))}>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pd-caret" aria-hidden="true">
          ▾
        </span>
      </span>
      <Link className={next ? "" : "off"} href={next ? hrefOf(next.key) : "#"} aria-label={next ? `On to ${next.label}` : "No later month"} aria-disabled={!next} tabIndex={next ? undefined : -1}>
        ›
      </Link>
    </div>
  );
}
