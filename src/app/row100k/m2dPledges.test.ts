/* The M2D pledge fill, checked by hand: npx tsx src/app/row100k/m2dPledges.test.ts
 * (plain asserts, exit 1 on the first miss). Owner, 2026-11-26: "$1 per
 * kilometer for $500 ... the next 500 kilometers that are submitted will
 * get $1 each", split where the rowers who filled it picked. */
import assert from "node:assert/strict";
import { fillPledge, pledgeLine, readPledgeBody } from "./m2dPledges";
import { EVEN_SHARES, type Shares } from "./m2d";

const t0 = new Date("2026-11-27T12:00:00Z");
const at = (h: number) => new Date(t0.getTime() + h * 3_600_000);
const ins = new Map<string, Shares | null>([
  ["a", { inclusion: 100 }],
  ["b", EVEN_SHARES],
]);
const pledge = { centsPerKm: 100, capDollars: 500, decidedAt: t0 };

// Rows before approval, and rowers who are out, do not count.
{
  const f = fillPledge(pledge, [
    { participantId: "a", meters: 100_000, createdAt: at(-1) },
    { participantId: "x", meters: 100_000, createdAt: at(1) },
    { participantId: "a", meters: 20_000, createdAt: at(2) },
  ], ins);
  assert.equal(f.dollars, 20);
  assert.equal(f.km, 20);
  assert.equal(f.capKm, 500);
  assert.equal(f.filled, false);
  assert.equal(f.split.inclusion, 20);
}

// It fills at the cap, splits by who filled it, and stops there.
{
  const f = fillPledge(pledge, [
    { participantId: "a", meters: 200_000, createdAt: at(1) },
    { participantId: "b", meters: 400_000, createdAt: at(2) },
    { participantId: "a", meters: 50_000, createdAt: at(3) },
  ], ins);
  assert.equal(f.filled, true);
  assert.equal(f.dollars, 500);
  assert.equal(f.km, 500);
  assert.deepEqual(f.filledAt, at(2));
  // a: $200 all to inclusion; b: $300 at 34/33/33.
  assert.equal(f.split.inclusion, 200 + 99);
  assert.equal(f.split.candlelighters, 102);
  assert.equal(f.split.shine, 99);
  assert.equal(f.split.candlelighters + f.split.shine + f.split.inclusion, 500);
}

// Not approved: nothing.
assert.equal(fillPledge({ ...pledge, decidedAt: null }, [{ participantId: "a", meters: 1000, createdAt: at(1) }], ins).dollars, 0);

assert.equal(pledgeLine({ name: "Jordan", centsPerKm: 100, capDollars: 500 }), "$1/km for 500 km · Jordan");
assert.equal(pledgeLine({ name: "Sam", centsPerKm: 25, capDollars: 250 }), "25¢/km for 1,000 km · Sam");
assert.equal(typeof readPledgeBody({ cents: 100, cap: 1_000_000_000, name: "Big" }), "string");
assert.deepEqual(readPledgeBody({ cents: 50, cap: 500, name: "  Pat  " }), { centsPerKm: 50, capDollars: 500, name: "Pat", note: "" });

console.log("m2dPledges: ok");
