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
 *
 * BUCKETS (owner, 2026-10-16: "How do I let people add real expenses to
 * the food/gas estimates"). An estimate line is a bucket the real costs are
 * filed under: "Chevron $62" goes in with parentId = Gas. The bucket counts
 * max(its estimate, the sum of its live children) — the estimate holds
 * until the real costs pass it, so one early gas receipt does not drop
 * everyone's share, and once the receipts add up past $600 the real number
 * takes over. "Estimated" is then only the part of each estimate the real
 * costs have not yet covered.
 */

export type ExpenseLine = {
  amountCents: number;
  estimate: boolean;
  deletedAt?: Date | null;
  /**
   * The bucket rule needs both: a line's own id and the bucket it sits in.
   * A list without them sums flat (every line its own cost) — which double
   * counts once a child exists, so every reader selects TOTAL_SELECT.
   */
  id?: string;
  parentId?: string | null;
};

/** The columns totalCents() needs; every findMany that feeds it selects these. */
export const TOTAL_SELECT = { id: true, parentId: true, amountCents: true, estimate: true, deletedAt: true } as const;

export type BucketSum = {
  /** The live children added up — "$124.10 in real costs so far". */
  realCents: number;
  /** What the bucket puts into the total: max(estimate, real). */
  countedCents: number;
  /** The part of the estimate the real costs have not reached yet (0 once they pass it). */
  uncoveredCents: number;
};

/** The bucket rule on one estimate and its children, see the header. */
export function bucketSum(estimateCents: number, childCents: number[]): BucketSum {
  let realCents = 0;
  for (const c of childCents) realCents += c;
  return { realCents, countedCents: Math.max(estimateCents, realCents), uncoveredCents: Math.max(0, estimateCents - realCents) };
}

/**
 * The sheet's sums over a flat list of lines (parents and children mixed,
 * any order). Pure. Deleted lines are skipped. A line is a child only when
 * its parent is in the list, live, and itself top-level — anything else
 * (parent deleted, missing, or a child — the API forbids the last) counts
 * as its own top-level line rather than vanishing from the total. A
 * child's own `estimate` flag is ignored (the API refuses it): what sits
 * in a bucket is a real cost.
 *
 *   bucket below:  Gas est $600, children $62 + $58   → counted $600, estimated $480
 *   bucket above:  Gas est $600, children $350 + $300 → counted $650, estimated $0
 *   no children:   Gas est $600                       → counted $600, estimated $600
 *   (checked with a tsx script on 2026-10-16; the cases live in the header
 *   so the next person can rerun them)
 */
export function totalCents(lines: ExpenseLine[]): { total: number; estimated: number; confirmed: number } {
  const live = lines.filter((l) => !l.deletedAt);
  const byId = new Map<string, ExpenseLine>();
  for (const l of live) if (l.id) byId.set(l.id, l);

  const isChild = (l: ExpenseLine): boolean => {
    const pid = l.parentId ?? null;
    if (pid === null) return false;
    const parent = byId.get(pid);
    return parent !== undefined && (parent.parentId ?? null) === null;
  };

  const childCents = new Map<string, number[]>();
  const tops: ExpenseLine[] = [];
  for (const l of live) {
    if (isChild(l)) {
      const pid = l.parentId as string;
      const list = childCents.get(pid);
      if (list) list.push(l.amountCents);
      else childCents.set(pid, [l.amountCents]);
    } else {
      tops.push(l);
    }
  }

  let total = 0;
  let estimated = 0;
  for (const t of tops) {
    const kids = t.id ? childCents.get(t.id) : undefined;
    if (kids && kids.length > 0) {
      const b = bucketSum(t.amountCents, kids);
      total += b.countedCents;
      // A non-estimate parent cannot happen through the API; if the data
      // gets there anyway its whole counted amount reads as confirmed.
      if (t.estimate) estimated += b.uncoveredCents;
    } else {
      total += t.amountCents;
      if (t.estimate) estimated += t.amountCents;
    }
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
