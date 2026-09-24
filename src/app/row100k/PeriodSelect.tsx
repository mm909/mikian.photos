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
   * the full rankings keep their ?d= division across months, the stats
   * page keeps its ?s= stat word (owner, 2026-09-24). A string without the
   * leading ?, or a map. Empty or absent: none. */
  query?: string | Record<string, string>;
}) {
  const hrefOf = (k: string) => {
    const q = new URLSearchParams(typeof query === "string" ? query : (query ?? {}));
    if (k !== current) q.set("m", k);
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };
  return <TextMenu options={options.map((o) => ({ key: o.key, label: o.label, href: hrefOf(o.key) }))} value={value} ariaLabel="Which month" align={align} />;
}
