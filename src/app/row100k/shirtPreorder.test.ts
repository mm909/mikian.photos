/* The pre-order counts, checked by hand: npx tsx src/app/row100k/shirtPreorder.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss). */
import assert from "node:assert/strict";
import { SIZES } from "./shirt";
import { costLine, parseColor, preorderCounts, type PreorderLite } from "./shirtPreorder";

async function main() {
  const row = (color: string, size: string, cancelled = false): PreorderLite => ({
    color,
    size,
    cancelledAt: cancelled ? new Date("2026-09-30T20:00:00Z") : null,
  });

  /* Nothing reserved: every number is a zero, every size is present. */
  const none = preorderCounts([]);
  assert.equal(none.black.total, 0);
  assert.equal(none.cream.total, 0);
  assert.deepEqual(Object.keys(none.black.bySize), [...SIZES]);
  assert.deepEqual(Object.keys(none.cream.bySize), [...SIZES]);
  for (const s of SIZES) {
    assert.equal(none.black.bySize[s], 0);
    assert.equal(none.cream.bySize[s], 0);
  }

  /* Live rows count per colour and per size; a let-go row counts for
   * nothing, in the total or under its size. */
  const c = preorderCounts([
    row("black", "M"),
    row("black", "M"),
    row("black", "2XL"),
    row("cream", "L"),
    row("cream", "S", true),
    row("black", "L", true),
  ]);
  assert.equal(c.black.total, 3);
  assert.equal(c.black.bySize.M, 2);
  assert.equal(c.black.bySize["2XL"], 1);
  assert.equal(c.black.bySize.L, 0);
  assert.equal(c.cream.total, 1);
  assert.equal(c.cream.bySize.L, 1);
  assert.equal(c.cream.bySize.S, 0);

  /* A cancelledAt that arrived as a string (JSON) is still a cancellation. */
  const viaJson = preorderCounts([{ color: "cream", size: "M", cancelledAt: "2026-09-30T20:00:00.000Z" }]);
  assert.equal(viaJson.cream.total, 0);

  /* A row that is not one of our colours or sizes is left out, never
   * counted under the wrong word — and never throws. */
  const odd = preorderCounts([row("navy", "M"), row("black", "XS"), row("black", "XL")]);
  assert.equal(odd.black.total, 1);
  assert.equal(odd.black.bySize.XL, 1);
  assert.equal(odd.cream.total, 0);

  /* The totals are the sum of the sizes, always. */
  for (const color of ["black", "cream"] as const) {
    const sum = SIZES.reduce((s, k) => s + c[color].bySize[k], 0);
    assert.equal(c[color].total, sum);
  }

  assert.equal(parseColor("black"), "black");
  assert.equal(parseColor("cream"), "cream");
  assert.equal(parseColor("Black"), null);
  assert.equal(parseColor(null), null);

  /* The one line: "at cost" alone until the owner fills the price in. */
  assert.equal(costLine(null), "Sold at cost, paid when they arrive.");
  assert.equal(costLine(18), "Sold at cost — $18 — paid when they arrive.");

  console.log("shirtPreorder: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
