/* The money rules, checked by hand: npx tsx src/lib/lasd26/money.test.ts
 * (vitest's include is the tracker only — like src/lib/rowPalette.test.ts
 * this is plain asserts, exit 1 on the first miss).
 *
 * What money.ts promises:
 *  - BUCKETS (owner, 2026-10-16: real costs filed under the gas / food
 *    estimates): a bucket counts max(estimate, live children); "estimated"
 *    is only the part of an estimate the real costs have not covered; a
 *    bucket with nothing in it counts as before; deleted lines drop out; a
 *    child whose bucket is gone, or a grandchild, counts as its own line
 *    rather than vanishing; a flat list without ids sums flat; order does
 *    not matter.
 *  - SETTLE OPEN (owner: "replace the estimate costs w/ the real cost"):
 *    an estimate counts for nothing — a bucket is its real costs, a lone
 *    estimate is $0, estimated is 0.
 *  - FRONTED (owner: "deduct that from their total … everyone pays their
 *    fair share"): net = share − fronted, estimates never fronted.
 *
 * THE IDENTITY. Σ net over the roster = Σ share − Σ fronted. With settling
 * up open and every real line carrying a payer, Σ fronted = total, and
 * Σ share = splitCount × ceil(total / splitCount), so Σ net is only the
 * rounding slack: 0 when the total divides evenly, else under splitCount
 * cents. Nothing is owed twice and nothing goes missing. While estimates
 * are ON the identity does not hold: Σ net = estimated + slack > 0,
 * because the round numbers nobody has fronted are still in every share
 * — which is why settling up replaces them with the real costs.
 *
 * THE POOL (owner, 2026-10-16: "I am not going to be 'paying out' myself.
 * People will be paying me"). The owner's row is the pool — settle.ts
 * reads it as status "pool", never owing, never owed — so the identity
 * that matters is over the OTHER rows:
 *
 *   Σ(non-pool nets) = what the pool collects − what it pays out
 *                    = pool fronted − pool share
 *                    = total − Σ(non-pool fronted) − pool share
 *
 * (settling open, every line claimed, no slack). The pool gets back
 * exactly what it spent beyond its own seat; its own net is the mirror,
 * −Σ(non-pool nets), and nobody pays it out. */
import assert from "node:assert/strict";
import { bucketSum, frontedCents, frontedLines, settlement, totalCents, type ExpenseLine, type Settlement, wholeDollarsUp } from "./money";

const race: ExpenseLine = { id: "race", parentId: null, amountCents: 200_000, estimate: false, paidById: "o" };
const gas = (kids: number[], payers: string[] = []): ExpenseLine[] => [
  { id: "gas", parentId: null, amountCents: 60_000, estimate: true },
  ...kids.map((c, i) => ({ id: `k${i}`, parentId: "gas", amountCents: c, estimate: false, paidById: payers[i] ?? null })),
];
const food: ExpenseLine = { id: "food", parentId: null, amountCents: 50_000, estimate: true };

function main() {
  /* ── buckets, estimates on ─────────────────────────────────────────── */
  // 1. bucket below the estimate: $62 + $58 in, the $600 still stands
  assert.deepEqual(totalCents([race, ...gas([6_200, 5_800])]), { total: 260_000, estimated: 48_000, confirmed: 212_000 });
  // 2. bucket above the estimate: $350 + $300 = $650 takes over
  assert.deepEqual(totalCents([race, ...gas([35_000, 30_000])]), { total: 265_000, estimated: 0, confirmed: 265_000 });
  // 3. no children: the estimate counts whole, as before
  assert.deepEqual(totalCents([race, ...gas([])]), { total: 260_000, estimated: 60_000, confirmed: 200_000 });

  assert.deepEqual(bucketSum(60_000, [6_200, 5_800]), { realCents: 12_000, countedCents: 60_000, uncoveredCents: 48_000 });
  assert.deepEqual(bucketSum(60_000, [35_000, 30_000]), { realCents: 65_000, countedCents: 65_000, uncoveredCents: 0 });
  assert.deepEqual(bucketSum(60_000, [60_000]), { realCents: 60_000, countedCents: 60_000, uncoveredCents: 0 });

  // a deleted bucket: its children count as their own lines
  assert.deepEqual(
    totalCents([race, { id: "gas", parentId: null, amountCents: 60_000, estimate: true, deletedAt: new Date() }, { id: "k0", parentId: "gas", amountCents: 6_200, estimate: false }]),
    { total: 206_200, estimated: 0, confirmed: 206_200 },
  );
  // a deleted child drops out
  assert.deepEqual(totalCents([race, ...gas([6_200]), { id: "k9", parentId: "gas", amountCents: 99_000, estimate: false, deletedAt: new Date() }]), {
    total: 260_000,
    estimated: 53_800,
    confirmed: 206_200,
  });
  // a flat list without ids / parentIds sums as before
  assert.deepEqual(totalCents([{ amountCents: 100, estimate: false }, { amountCents: 50, estimate: true }]), { total: 150, estimated: 50, confirmed: 100 });
  // a grandchild (the API forbids it) is not lost: its parent is a child, so it counts as top-level
  assert.deepEqual(totalCents([...gas([6_200]), { id: "g", parentId: "k0", amountCents: 1_000, estimate: false }]), { total: 61_000, estimated: 53_800, confirmed: 7_200 });
  // children before the bucket
  assert.deepEqual(totalCents([{ id: "k0", parentId: "gas", amountCents: 6_200, estimate: false }, { id: "gas", parentId: null, amountCents: 60_000, estimate: true }]), {
    total: 60_000,
    estimated: 53_800,
    confirmed: 6_200,
  });

  /* ── settle open: real costs only ──────────────────────────────────── */
  const open = { settleOpen: true };
  // the bucket is its real costs, the $600 is gone
  assert.deepEqual(totalCents([race, ...gas([6_200, 5_800])], open), { total: 212_000, estimated: 0, confirmed: 212_000 });
  // above the estimate: the same real sum either way
  assert.deepEqual(totalCents([race, ...gas([35_000, 30_000])], open), { total: 265_000, estimated: 0, confirmed: 265_000 });
  // a lone estimate counts for nothing
  assert.deepEqual(totalCents([race, ...gas([]), food], open), { total: 200_000, estimated: 0, confirmed: 200_000 });
  // a flat estimate without ids too
  assert.deepEqual(totalCents([{ amountCents: 100, estimate: false }, { amountCents: 50, estimate: true }], open), { total: 100, estimated: 0, confirmed: 100 });
  assert.deepEqual(bucketSum(60_000, [6_200, 5_800], open), { realCents: 12_000, countedCents: 12_000, uncoveredCents: 0 });
  assert.deepEqual(bucketSum(60_000, [], open), { realCents: 0, countedCents: 0, uncoveredCents: 0 });

  /* ── fronted ───────────────────────────────────────────────────────── */
  const sheet = [race, ...gas([6_200, 5_800], ["m1", "m2"]), food];
  assert.equal(frontedCents(sheet, "o"), 200_000);
  assert.equal(frontedCents(sheet, "m1"), 6_200);
  assert.equal(frontedCents(sheet, "m2"), 5_800);
  assert.equal(frontedCents(sheet, "m3"), 0);
  // an estimate is never fronted, whatever paidById says
  assert.equal(frontedCents([{ id: "gas", parentId: null, amountCents: 60_000, estimate: true, paidById: "o" }], "o"), 0);
  // a deleted line is not fronted
  assert.equal(frontedCents([{ ...race, deletedAt: new Date() }], "o"), 0);
  assert.deepEqual(frontedLines(sheet, "m1").map((l) => l.id), ["k0"]);

  /* ── the statement: I would have paid x, I spent y, so I owe z ─────── */
  // settling open, 4 people, $2,120 of real costs → $530 each; the owner
  // fronted $2,000 so the pool owes him $1,470; m1 fronted $62 and owes
  // $468; m3 fronted nothing and owes the whole $530.
  const s = settlement(sheet, ["o", "m1", "m2", "m3"], 4, open);
  assert.equal(s.total, 212_000);
  assert.equal(s.perPersonCents, 53_000);
  assert.deepEqual(s.rows, [
    { memberId: "o", shareCents: 53_000, frontedCents: 200_000, netCents: -147_000 },
    { memberId: "m1", shareCents: 53_000, frontedCents: 6_200, netCents: 46_800 },
    { memberId: "m2", shareCents: 53_000, frontedCents: 5_800, netCents: 47_200 },
    { memberId: "m3", shareCents: 53_000, frontedCents: 0, netCents: 53_000 },
  ]);
  // THE IDENTITY, settling open, every real line with a payer, total
  // divides evenly: Σ net = 0 — what is owed in equals what is owed out.
  assert.equal(s.frontedCents, s.total);
  assert.equal(s.netCents, 0);
  // the same with a total that does not divide: Σ net is the rounding slack only
  const odd = settlement([{ ...race, amountCents: 200_001 }, ...gas([6_200, 5_800], ["m1", "m2"])], ["o", "m1", "m2", "m3"], 4, open);
  assert.equal(odd.perPersonCents, 53_001);
  assert.equal(odd.netCents, 4 * 53_001 - 212_001);
  assert.ok(odd.netCents >= 0 && odd.netCents < 4);
  // a line nobody has claimed (a seeded line before PAID BY is set) stays in
  // the total but comes off nobody's share: Σ net = that line
  const unclaimed = settlement([{ ...race, paidById: null }, ...gas([6_200, 5_800], ["m1", "m2"])], ["o", "m1", "m2", "m3"], 4, open);
  assert.equal(unclaimed.netCents, 200_000);

  /* ── the pool: the owner's row (2026-10-16: "People will be paying me") ── */
  // settle.ts marks "o" as the pool and sums the OTHER rows: what comes in
  // (positive nets) minus what goes out (negative nets). The sums here are
  // the same arithmetic over settlement()'s rows.
  const others = (st: Settlement, poolId: string) => {
    let net = 0;
    let collects = 0;
    let paysOut = 0;
    let fronted = 0;
    for (const r of st.rows) {
      if (r.memberId === poolId) continue;
      net += r.netCents;
      fronted += r.frontedCents;
      if (r.netCents > 0) collects += r.netCents;
      else paysOut -= r.netCents;
    }
    return { net, collects, paysOut, fronted };
  };
  // THE POOL IDENTITY on the sheet above: the crew owes $1,470 between
  // them, nobody is owed, and $1,470 is exactly the $2,000 the owner
  // fronted beyond his own $530 share (= 212_000 − 12_000 − 53_000).
  const me = s.rows[0];
  const o1 = others(s, "o");
  assert.equal(o1.net, 147_000);
  assert.equal(o1.collects - o1.paysOut, o1.net);
  assert.equal(o1.paysOut, 0);
  assert.equal(o1.net, me.frontedCents - me.shareCents);
  assert.equal(o1.net, s.total - o1.fronted - me.shareCents);
  assert.equal(me.netCents, -o1.net);
  // and when the pool OWES someone: m1 fronted $800 of gas, above the
  // $714.50 share → the pool pays out $85.50, collects $656.50 + $714.50,
  // and the difference is still what it fronted beyond its seat.
  const t = settlement([race, ...gas([80_000, 5_800], ["m1", "m2"])], ["o", "m1", "m2", "m3"], 4, open);
  assert.equal(t.total, 285_800);
  assert.equal(t.perPersonCents, 71_450);
  const o2 = others(t, "o");
  assert.equal(o2.paysOut, 8_550);
  assert.equal(o2.collects, 65_650 + 71_450);
  assert.equal(o2.collects - o2.paysOut, 200_000 - 71_450);
  assert.equal(o2.net, t.total - o2.fronted - 71_450);
  assert.equal(t.rows[0].netCents, -o2.net);

  // ESTIMATES ON: the identity does not hold. Σ net = estimated + slack,
  // the round numbers nobody has fronted ($480 of gas, $500 of food):
  //   total 310_000 → 77_500 each; Σ share 310_000; Σ fronted 212_000;
  //   Σ net 98_000 = estimated 98_000 + slack 0  (> 0)
  const est = settlement(sheet, ["o", "m1", "m2", "m3"], 4);
  assert.equal(est.total, 310_000);
  assert.equal(est.estimated, 98_000);
  assert.equal(est.netCents, est.estimated);
  assert.ok(est.netCents > 0);

  // WHOLE DOLLARS, UP (the pay page, 2026-10-29): never short, round stays round.
  assert.equal(wholeDollarsUp(37_123), 37_200);
  assert.equal(wholeDollarsUp(30_923), 31_000);
  assert.equal(wholeDollarsUp(47_500), 47_500);
  assert.equal(wholeDollarsUp(0), 0);

  console.log("money.test: all ok");
}

main();
