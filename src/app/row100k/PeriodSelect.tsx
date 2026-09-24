"use client";

import { TextMenu } from "./TextMenu";

/* WHICH MONTH, as a word (owner, 2026-09-24): DECEMBER 2026 in the
 * dateline, every month before it and ALL TIME behind a tap on the word
 * (TextMenu.tsx). The page it sits on decides the months (rowPeriod.ts
 * periodOptions) and where ?m= goes; this month is the page's own URL,
 * with no query. */
export type PeriodOption = { key: string; label: string };

export function PeriodSelect({
  options,
  value,
  base,
  current,
  align = "left",
  query,
}: {
  options: PeriodOption[];
  value: string;
  base: string;
  current: string;
  align?: "left" | "right";
  /* Query the page is already carrying that a month change must keep —
   * the stats page's ?s= (the stat word), so picking November keeps
   * FASTEST 10K under it (owner, 2026-09-24: a selector for the period
   * and a selector for the stat, side by side). */
  query?: Record<string, string>;
}) {
  const hrefOf = (k: string) => {
    const q = new URLSearchParams(query ?? {});
    if (k !== current) q.set("m", k);
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };
  return <TextMenu options={options.map((o) => ({ key: o.key, label: o.label, href: hrefOf(o.key) }))} value={value} ariaLabel="Which month" align={align} />;
}
