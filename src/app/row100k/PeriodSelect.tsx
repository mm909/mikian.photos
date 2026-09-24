"use client";

import { useRouter } from "next/navigation";

/* WHICH MONTH, as text (owner, 2026-09-24: "I like the drop down; the
 * arrows didn't land; put it in the header where it says THE BOARD ·
 * DECEMBER 2026 · DAY 15 OF 31 — click on it and swap it to November or
 * all time; more text, less UI button-y"). The month reads as a word in
 * the dateline with a small caret after it; a native select sits over
 * the word, invisible, so a tap opens the phone's own picker and the
 * page follows. The board and the profile both mount it; the page it
 * sits on decides the months (rowPeriod.ts periodOptions) and where
 * ?m= goes. This month is the page's own URL, with no query. */
export type PeriodOption = { key: string; label: string };

export function PeriodSelect({ options, value, base, current }: { options: PeriodOption[]; value: string; base: string; current: string }) {
  const router = useRouter();
  const hrefOf = (k: string) => (k === current ? base : `${base}?m=${encodeURIComponent(k)}`);
  const label = options.find((o) => o.key === value)?.label ?? value;
  return (
    <span className="pd-text">
      <span className="lbl" aria-hidden="true">
        {label}
        <span className="caret">▾</span>
      </span>
      <select value={value} aria-label="Which month" onChange={(ev) => router.push(hrefOf(ev.target.value))}>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
