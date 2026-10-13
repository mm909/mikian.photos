/* The Hyrox board's rules, checked by hand:
 *   npx tsx src/app/hyrox/fields.test.ts
 * (plain asserts, exit 1 on the first miss, the join form's idiom). */
import assert from "node:assert/strict";
import { ERR, EVENTS, categoryLabel, cleanStartTime, igHandle, partnerSlots, readCategory, readEntry } from "./events";

const ev = EVENTS[0];
assert.equal(ev.slug, "las-vegas-2027");
assert.equal(ev.days.length, 3);

/* ---------------------------------------------------------- categories */
assert.deepEqual(readCategory("singles", "open", "men"), { format: "singles", division: "open", gender: "men" });
assert.equal(readCategory("singles", "open", "mixed"), null, "no mixed singles");
assert.equal(readCategory("doubles", "adaptive", "men"), null, "no adaptive doubles");
assert.equal(readCategory("relay", "pro", "mixed"), null, "relay has one division");
assert.ok(readCategory("relay", "open", "women"));
assert.equal(readCategory("elite", "open", "men"), null);

assert.equal(categoryLabel({ format: "singles", division: "pro", gender: "women" }), "Women's Pro");
assert.equal(categoryLabel({ format: "singles", division: "adaptive", gender: "men" }), "Men's Adaptive");
assert.equal(categoryLabel({ format: "doubles", division: "open", gender: "mixed" }), "Mixed Open Doubles");
assert.equal(categoryLabel({ format: "relay", division: "open", gender: "mixed" }), "Mixed Relay");

assert.equal(partnerSlots("singles"), 0);
assert.equal(partnerSlots("doubles"), 1);
assert.equal(partnerSlots("relay"), 3);

/* ------------------------------------------------------------- strings */
assert.equal(igHandle("@Mikian_"), "Mikian_");
assert.equal(igHandle("https://instagram.com/mikian_/"), "mikian_");
assert.equal(cleanStartTime(""), "");
assert.equal(cleanStartTime(" 9:40 am "), "9:40 AM");
assert.equal(cleanStartTime("14:05"), "14:05");
assert.equal(cleanStartTime("9 pm"), "9 PM");
assert.equal(cleanStartTime("nine forty"), null);
assert.equal(cleanStartTime("25:00"), null);

/* ----------------------------------------------------------- the entry */
const good = {
  name: "  Ada   Byron ",
  email: "ada@example.com",
  instagram: "@ada",
  format: "doubles",
  division: "pro",
  gender: "women",
  day: "2027-03-13",
  partners: ["Grace Hopper", "", "Extra Name"],
  teamName: "Loops",
  startTime: "9:40 am",
};
const r = readEntry(ev, good);
assert.ok(r.ok);
if (r.ok) {
  assert.equal(r.entry.name, "Ada Byron");
  assert.equal(r.entry.instagram, "ada");
  assert.deepEqual(r.entry.partners, ["Grace Hopper"], "doubles keeps one partner, blanks dropped");
  assert.equal(r.entry.teamName, "Loops");
  assert.equal(r.entry.startTime, "9:40 AM");
}

const singles = readEntry(ev, { ...good, format: "singles", division: "open", gender: "men", partners: ["Someone"], teamName: "X" });
assert.ok(singles.ok);
if (singles.ok) {
  assert.deepEqual(singles.entry.partners, [], "singles carries no partner");
  assert.equal(singles.entry.teamName, "", "or a team name");
}

const relay = readEntry(ev, { ...good, format: "relay", division: "open", gender: "mixed", partners: ["A", "B", "C", "D"] });
assert.ok(relay.ok);
if (relay.ok) assert.deepEqual(relay.entry.partners, ["A", "B", "C"], "relay keeps three teammates");

const fail = (body: Record<string, unknown>, err: string, why: string) => {
  const x = readEntry(ev, body);
  assert.ok(!x.ok, why);
  if (!x.ok) assert.equal(x.error, err, why);
};
fail({ ...good, name: "   " }, ERR.name, "no name");
fail({ ...good, email: "ada" }, ERR.email, "bad email");
fail({ ...good, gender: "mixed", format: "singles" }, ERR.category, "no mixed singles");
fail({ ...good, day: "2027-03-15" }, ERR.day, "not a race day");
fail({ ...good, startTime: "soon" }, ERR.startTime, "start time is a time");

/* An entry sent before the partner is known is fine. */
const solo = readEntry(ev, { ...good, partners: [] });
assert.ok(solo.ok);

console.log("hyrox fields: ok");
