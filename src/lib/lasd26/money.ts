/**
 * The crew's money, in whole cents (isomorphic — the expenses page and the
 * pay page both use it). The cost sheet the owner pasted on 2026-10-15:
 *
 *   Race entry 2 teams × $1,000 = $2,000 · Hotel 5 rooms × $283 = $1,415 ·
 *   Airbnb $1,112 · Sprinter vans $505 + $550 · Gas $600 · Race day food $500
 *   → $6,682 / 18 people = $371.25
 *
 * The split count is a setting (TeamSettings.splitCount, 18) rather than
 * the member count: people join over a few days and the number must not
 * wobble while they do.
 */

export type ExpenseLine = { amountCents: number; estimate: boolean; deletedAt?: Date | null };

export function totalCents(lines: ExpenseLine[]): { total: number; estimated: number; confirmed: number } {
  let total = 0;
  let estimated = 0;
  for (const l of lines) {
    if (l.deletedAt) continue;
    total += l.amountCents;
    if (l.estimate) estimated += l.amountCents;
  }
  return { total, estimated, confirmed: total - estimated };
}

/** Each person's share, rounded up to the cent so the crew is never short. */
export function perPersonCents(total: number, splitCount: number): number {
  if (splitCount <= 0) return 0;
  return Math.ceil(total / splitCount);
}

/** 668200 → "$6,682.00"; 37125 → "$371.25". */
export function fmtUsd(cents: number, opts: { whole?: boolean } = {}): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.whole ? 0 : 2,
    maximumFractionDigits: opts.whole ? 0 : 2,
  }).format(dollars);
}

/** "371.25", "1,415", "$1,415.00", "1415" → cents; null when it is not money. */
export function parseUsd(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null;
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}
