/* The Hyrox board's rules, checked by hand:
 *   npx tsx src/app/hyrox/fields.test.ts
 * (plain asserts, exit 1 on the first miss, the join form's idiom). */
import assert from "node:assert/strict";
import {
  ERR,
  EVENTS,
  catWords,
  categoryLabel,
  cleanStartTime,
  hyresultUrl,
  igHandle,
  isDebut,
  isNewPr,
  partnerSlots,
  partnersFromColumns,
  partnersToColumns,
  prLabel,
  readCategory,
  readEntry,
  startMinutes,
  toSeconds,
} from "./events";

const ev = EVENTS[0];
assert.equal(ev.slug, "las-vegas-2027");
assert.equal(ev.days.length, 3);
assert.equal(ev.startTimesOpen, false, "start times are not taken until announced");

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
  email: "ignored@example.com",
  instagram: "@ada",
  format: "doubles",
  division: "pro",
  gender: "women",
  day: "2027-03-13",
  partners: [{ name: "Grace Hopper", instagram: "https://instagram.com/grace" }, { name: "", instagram: "@nobody" }, { name: "Extra Name" }],
  teamName: "Loops",
  startTime: "9:40 am",
};
const r = readEntry(ev, good);
assert.ok(r.ok);
if (r.ok) {
  assert.equal(r.entry.name, "Ada Byron");
  assert.equal(r.entry.instagram, "ada");
  assert.ok(!("email" in r.entry), "the email is the account's, not the form's");
  assert.ok(!("teamName" in r.entry), "no team names");
  assert.deepEqual(r.entry.partners, [{ name: "Grace Hopper", instagram: "grace" }], "doubles keeps one partner, blanks dropped, handle cleaned");
  assert.equal(r.entry.startTime, "", "a start time is not taken while the event has them closed");
}

/* Once the event opens start times, the field is read. */
const open = { ...ev, startTimesOpen: true };
const timed = readEntry(open, good);
assert.ok(timed.ok);
if (timed.ok) assert.equal(timed.entry.startTime, "9:40 AM");
const badTime = readEntry(open, { ...good, startTime: "soon" });
assert.ok(!badTime.ok);
if (!badTime.ok) assert.equal(badTime.error, ERR.startTime);

const singles = readEntry(ev, { ...good, format: "singles", division: "open", gender: "men", partners: [{ name: "Someone" }] });
assert.ok(singles.ok);
if (singles.ok) assert.deepEqual(singles.entry.partners, [], "singles carries no partner");

const relay = readEntry(ev, { ...good, format: "relay", division: "open", gender: "mixed", partners: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }] });
assert.ok(relay.ok);
if (relay.ok) assert.deepEqual(relay.entry.partners.map((p) => p.name), ["A", "B", "C"], "relay keeps three teammates");

/* Old-shape partners (plain strings) are not names. */
const strings = readEntry(ev, { ...good, partners: ["Grace Hopper"] });
assert.ok(strings.ok);
if (strings.ok) assert.deepEqual(strings.entry.partners, []);

const fail = (body: Record<string, unknown>, err: string, why: string) => {
  const x = readEntry(ev, body);
  assert.ok(!x.ok, why);
  if (!x.ok) assert.equal(x.error, err, why);
};
fail({ ...good, name: "   " }, ERR.name, "no name");
fail({ ...good, gender: "mixed", format: "singles" }, ERR.category, "no mixed singles");
fail({ ...good, day: "2027-03-15" }, ERR.day, "not a race day");

/* An entry sent before the partner is known is fine. */
const solo = readEntry(ev, { ...good, partners: [] });
assert.ok(solo.ok);

/* ------------------------------------------------------------ the record */
assert.equal(isDebut({ priorRaces: 0 }), true);
assert.equal(isDebut({ priorRaces: 1 }), false);
assert.equal(isDebut({ priorRaces: null }), false, "not looked up is not a debut");
assert.equal(isDebut({}), false);
assert.equal(prLabel({ pr: "" }), "");
assert.equal(prLabel({}), "");
assert.equal(prLabel({ pr: "1:12:34" }), "PR 1:12:34");

/* A rower's save takes no start time before the event opens them; the
 * owner's does, any time. The record is never read from a body. */
const rower = readEntry(ev, good);
assert.ok(rower.ok);
if (rower.ok) {
  assert.deepEqual(rower.taken, { startTime: false });
  assert.equal(rower.entry.startTime, "");
  assert.ok(!("priorRaces" in rower.entry) && !("pr" in rower.entry), "the record is hyresult's, not the form's");
}
const rowerOpen = readEntry(open, good);
assert.ok(rowerOpen.ok);
if (rowerOpen.ok) assert.deepEqual(rowerOpen.taken, { startTime: true });
const owner = readEntry(ev, good, { admin: true });
assert.ok(owner.ok);
if (owner.ok) {
  assert.deepEqual(owner.taken, { startTime: true });
  assert.equal(owner.entry.startTime, "9:40 AM", "the owner keys a start time in before the event opens them");
}

/* ------------------------------------------------------------- the links */
assert.equal(hyresultUrl("Ada Byron"), "https://www.hyresult.com/athlete/ada-byron");
assert.equal(hyresultUrl("  José  García-Lopez "), "https://www.hyresult.com/athlete/jose-garcia-lopez");

/* ------------------------------------------------------------- the words */
assert.deepEqual(catWords({ format: "singles", division: "pro", gender: "men" }), { words: "MEN'S SINGLES", tag: "PRO" });
assert.deepEqual(catWords({ format: "singles", division: "open", gender: "women" }), { words: "WOMEN'S SINGLES", tag: "" }, "open says nothing");
assert.deepEqual(catWords({ format: "doubles", division: "pro", gender: "mixed" }), { words: "MIXED DOUBLES", tag: "PRO" });
assert.deepEqual(catWords({ format: "singles", division: "adaptive", gender: "men" }), { words: "MEN'S SINGLES", tag: "ADAPTIVE" });
assert.deepEqual(catWords({ format: "relay", division: "open", gender: "mixed" }), { words: "MIXED RELAY", tag: "" });
assert.deepEqual(catWords(null), { words: "OTHER", tag: "" });

assert.equal(toSeconds("1:12:34"), 4354);
assert.equal(toSeconds("58:12"), 3492);
assert.ok(Number.isNaN(toSeconds("fast")));
assert.equal(isNewPr({ finishTime: "1:10:00", pr: "1:12:34" }), true);
assert.equal(isNewPr({ finishTime: "1:12:34", pr: "1:12:34" }), false, "equal is not a new PR");
assert.equal(isNewPr({ finishTime: "1:15:00", pr: "1:12:34" }), false);
assert.equal(isNewPr({ finishTime: "1:15:00", pr: "" }), false, "a debut has no PR to beat");
assert.equal(isNewPr({ finishTime: "", pr: "1:12:34" }), false);

assert.equal(startMinutes("9:40 AM"), 580);
assert.equal(startMinutes("12:05 PM"), 725);
assert.equal(startMinutes("12:30 AM"), 30);
assert.equal(startMinutes("2:15 PM"), 855);
assert.equal(startMinutes("14:05"), 845);
assert.equal(startMinutes("9 PM"), 1260);
assert.equal(startMinutes(""), 100_000, "no time sorts last");
assert.ok(startMinutes("8:00 AM") < startMinutes("8:10 AM"));

/* ----------------------------------------------------------- the columns */
const cols = partnersToColumns([{ name: "A", instagram: "a" }, { name: "B", instagram: "" }]);
assert.deepEqual(cols, { partners: ["A", "B"], partnerIgs: ["a", ""] });
assert.deepEqual(partnersFromColumns(["A", "B"], ["a"]), [{ name: "A", instagram: "a" }, { name: "B", instagram: "" }]);

console.log("hyrox fields: ok");
