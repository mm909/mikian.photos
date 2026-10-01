/* THE LANE (hub.ts setErgLane, listErgs): lanes first in lane order, the
 * unnumbered after in the order they were added, and a lane taken off
 * again. Run: npx tsx src/app/erg/lane.test.ts */
import assert from "node:assert/strict";
import { addSourceErg, getErg, listErgs, setErgLane, type SourceDriver } from "./hub";

const quiet = (label: string): SourceDriver => ({ label, done: false, step: () => [] });

async function main() {
  const a = addSourceErg({ source: "sim", driver: quiet("a"), device: { name: "A" } });
  const b = addSourceErg({ source: "sim", driver: quiet("b"), device: { name: "B" } });
  const c = addSourceErg({ source: "sim", driver: quiet("c"), device: { name: "C" } });
  const d = addSourceErg({ source: "sim", driver: quiet("d"), device: { name: "D" } });

  const names = () => listErgs().map((e) => e.name).join("");
  assert.equal(names(), "ABCD", "added order to begin with");

  setErgLane(c, 1);
  setErgLane(a, 3);
  setErgLane(d, 2);
  assert.equal(names(), "CDAB", "lanes 1, 2, 3 first, then the unnumbered");
  assert.equal(getErg(c)?.lane, 1);

  setErgLane(d, null);
  assert.equal(names(), "CABD", "a lane taken off falls back to added order");

  setErgLane(b, 0);
  assert.equal(getErg(b)?.lane, null, "zero is no lane");
  setErgLane(b, 2.5);
  assert.equal(getErg(b)?.lane, null, "a fraction is no lane");
  setErgLane(b, 200);
  assert.equal(getErg(b)?.lane, null, "past 99 is no lane");

  setErgLane(b, 3);
  assert.equal(names(), "CABD", "equal lanes keep added order (A before B)");
  assert.ok(getErg(a)?.model.log.some((l) => /^lane 3$/.test(l.text)), "the card logs the lane");

  console.log("lane: every case holds");
  process.exit(0);
}

void main();
