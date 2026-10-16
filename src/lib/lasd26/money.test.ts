/* The bucket rule, checked by hand: npx tsx src/lib/lasd26/money.test.ts
 * (vitest's include is the tracker only — like src/lib/rowPalette.test.ts
 * this is plain asserts, exit 1 on the first miss). What money.ts promises
 * (owner, 2026-10-16: real costs filed under the gas / food estimates): a
 * bucket counts max(estimate, live children); "estimated" is only the part
 * of an estimate the real costs have not covered; a bucket with nothing in
 * it counts as before; deleted lines drop out; a child whose bucket is
 * gone, or a grandchild, counts as its own line rather than vanishing; a
 * flat list without ids sums flat; order does not matter. */
import assert from "node:assert/strict";
import { bucketSum, totalCents, type ExpenseLine } from "./money";

const race: ExpenseLine = { id: "race", parentId: null, amountCents: 200_000, estimate: false };
const gas = (kids: number[]): ExpenseLine[] => [
  { id: "gas", parentId: null, amountCents: 60_000, estimate: true },
  ...kids.map((c, i) => ({ id: `k${i}`, parentId: "gas", amountCents: c, estimate: false })),
];

function main() {
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

  console.log("money.test: all ok");
}

main();
