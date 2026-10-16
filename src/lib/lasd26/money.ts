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
 * filed under: "Chevron $62" goes in with parentId = Gas. Until settling up
 * opens the bucket counts max(its estimate, the sum of its live children)
 * — the estimate holds until the real costs pass it, so one early gas
 * receipt does not drop everyone's share. "Estimated" is then only the
 * part of each estimate the real costs have not yet covered.
 *
 * SETTLE = REAL COSTS ONLY (owner, 2026-10-16: "When I make settle up go
 * live replace the estimate costs w/ the real cost"). Once settleOpen is
 * on, an estimate counts for NOTHING: a bucket is the sum of its real
 * costs, an estimate with nothing filed under it is $0, and "estimated"
 * is 0. What the crew pays is what was actually spent.
 *
 * FRONTED COSTS (owner, 2026-10-16: "if someone pays for something like
 * gas and then has to settle up later there should be a way to deduct that
 * from their total … the math is right (everyone pays their fair share),
 * it's clear to everyone (I would have paid x but I already spent y so now
 * I owe z), and prevent me from having to reimburse someone for them to
 * just pay it back"). Every real line has paidById — who fronted it. A
 * member's NET is their share minus what they fronted: positive, they owe
 * it; negative, the pool owes them and the owner pays them out after the
 * race; nobody is paid back only to pay it in again. settlement() below is
 * the whole rule, pure, checked by money.test.ts.
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
  /** The member who fronted it (TeamMember.id); null on an estimate or until set. */
  paidById?: string | null;
};

/** The columns totalCents() and settlement() need; every findMany that feeds them selects these. */
export const TOTAL_SELECT = { id: true, parentId: true, amountCents: true, estimate: true, deletedAt: true, paidById: true } as const;

export type TotalOpts = {
  /** Settling up is open: estimates count for nothing (see the header). */
  settleOpen?: boolean;
};

export type BucketSum = {
  /** The live children added up — "$124.10 in real costs so far". */
  realCents: number;
  /** What the bucket puts into the total: max(estimate, real), or real alone once settleOpen. */
  countedCents: number;
  /** The part of the estimate the real costs have not reached yet (0 once they pass it, 0 when settleOpen). */
  uncoveredCents: number;
};

/** The bucket rule on one estimate and its children, see the header. */
export function bucketSum(estimateCents: number, childCents: number[], opts: TotalOpts = {}): BucketSum {
  let realCents = 0;
  for (const c of childCents) realCents += c;
  if (opts.settleOpen) return { realCents, countedCents: realCents, uncoveredCents: 0 };
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
 *   settleOpen:    Gas est $600, children $62 + $58   → counted $120, estimated $0
 *   settleOpen:    Gas est $600                       → counted $0,   estimated $0
 *   (the cases live in money.test.ts: npx tsx src/lib/lasd26/money.test.ts)
 */
export function totalCents(lines: ExpenseLine[], opts: TotalOpts = {}): { total: number; estimated: number; confirmed: number } {
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
      const b = bucketSum(t.amountCents, kids, opts);
      total += b.countedCents;
      // A non-estimate parent cannot happen through the API; if the data
      // gets there anyway its whole counted amount reads as confirmed.
      if (t.estimate) estimated += b.uncoveredCents;
    } else if (t.estimate) {
      // A lone estimate: the round number until settling up opens, then nothing.
      if (!opts.settleOpen) {
        total += t.amountCents;
        estimated += t.amountCents;
      }
    } else {
      total += t.amountCents;
    }
  }
  return { total, estimated, confirmed: total - estimated };
}

/**
 * What one member fronted: every live REAL line they paid for, wherever it
 * sits (a child in a bucket counts the same as a top-level line). An
 * estimate is never fronted — nobody has paid a round number — so its
 * paidById, if any, is ignored.
 */
export function frontedCents(lines: ExpenseLine[], memberId: string): number {
  let sum = 0;
  for (const l of lines) {
    if (l.deletedAt || l.estimate) continue;
    if ((l.paidById ?? null) === memberId) sum += l.amountCents;
  }
  return sum;
}

/** The live real lines one member fronted, for "YOU FRONTED" on the pay page. */
export function frontedLines<T extends ExpenseLine>(lines: T[], memberId: string): T[] {
  return lines.filter((l) => !l.deletedAt && !l.estimate && (l.paidById ?? null) === memberId);
}

export type SettleRow = {
  memberId: string;
  /** Each person's share of the total (= perPersonCents). */
  shareCents: number;
  /** What this member fronted (frontedCents). */
  frontedCents: number;
  /** share − fronted: > 0 they owe it, < 0 the pool owes them, 0 square. */
  netCents: number;
};

export type Settlement = {
  total: number;
  estimated: number;
  perPersonCents: number;
  rows: SettleRow[];
  /** Σ fronted over the members given. */
  frontedCents: number;
  /** Σ net over the members given — see the identity in the header of money.test.ts. */
  netCents: number;
};

/**
 * The whole settlement rule, pure: the sheet's total under the current
 * mode, each member's share, what they fronted, and the net between the
 * two. The members are ids (the roster); a line fronted by someone not in
 * the list still counts in the total, it just comes off nobody's share
 * (the seeded lines before the owner sets PAID BY).
 */
export function settlement(lines: ExpenseLine[], memberIds: string[], splitCount: number, opts: TotalOpts = {}): Settlement {
  const { total, estimated } = totalCents(lines, opts);
  const per = perPersonCents(total, splitCount);
  let fronted = 0;
  let net = 0;
  const rows = memberIds.map((memberId) => {
    const f = frontedCents(lines, memberId);
    fronted += f;
    net += per - f;
    return { memberId, shareCents: per, frontedCents: f, netCents: per - f };
  });
  return { total, estimated, perPersonCents: per, rows, frontedCents: fronted, netCents: net };
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

/** "371.25", "1,415", "$505", "1415" → cents; null when it is not money. */
export function parseUsd(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) : null;
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}
