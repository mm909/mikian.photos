"use client";

import { TextMenu } from "./TextMenu";

/* WHICH MONTH, as a word (owner, 2026-09-24): DECEMBER 2026 in the
 * dateline, every month before it and ALL TIME behind a tap on the word
 * (TextMenu.tsx). The page it sits on decides the months (rowPeriod.ts
 * periodOptions) and where ?m= goes; this month is the page's own URL,
 * with no query. */
export type PeriodOption = { key: string; label: string };

export function PeriodSelect({ options, value, base, current, align = "left" }: { options: PeriodOption[]; value: string; base: string; current: string; align?: "left" | "right" }) {
  const hrefOf = (k: string) => (k === current ? base : `${base}?m=${encodeURIComponent(k)}`);
  return <TextMenu options={options.map((o) => ({ key: o.key, label: o.label, href: hrefOf(o.key) }))} value={value} ariaLabel="Which month" align={align} />;
}
