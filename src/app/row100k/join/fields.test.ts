/* The sign-up page's rules, checked by hand:
 *   npx tsx src/app/row100k/join/fields.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * The owner's tiers from 2026-10-01: name, email, birthday; the board name
 * and the board; then shirt size, height, weight, home gym, Instagram —
 * "not as important", so every one of the last five may be blank. */
import assert from "node:assert/strict";
import { GYM_OTHER, JOIN_ERR, parseJoinExtras, readJoinForm, type JoinValues } from "./fields";

/* Noon Pacific, 8 October 2026 — the clock the birthday band is read on. */
const NOW = Date.UTC(2026, 9, 8, 19, 0, 0);

const blank: JoinValues = {
  first: "",
  last: "",
  birthday: "",
  name: "",
  division: null,
  shirt: "",
  heightFt: "",
  heightIn: "",
  weightLb: "",
  gymPick: "",
  gymOther: "",
  instagram: "",
};
const good: JoinValues = { ...blank, first: "Ada", last: "Byron", birthday: "1990-12-10", name: "Ada Byron", division: "F" };

/* ------------------------------------------------- the two tiers that must */
const empty = readJoinForm(blank, NOW);
assert.equal(empty.body, null);
assert.deepEqual(Object.keys(empty.errors).sort(), ["birthday", "division", "name"], "only the two tiers that must be filled refuse");
assert.equal(empty.errors.name, JOIN_ERR.name);
assert.equal(empty.errors.division, JOIN_ERR.division);

const min = readJoinForm(good, NOW);
assert.deepEqual(min.errors, {});
assert.deepEqual(min.body, {
  displayName: "Ada Byron",
  instagram: "",
  division: "F",
  birthday: "1990-12-10",
  shirtSize: null,
  heightCm: null,
  weightKg: null,
  homeGym: null,
  monthOptIn: true,
});

/* The board name is trimmed and its inner runs collapsed; one letter is
 * not a name. */
assert.equal(readJoinForm({ ...good, name: "  Ada   B  " }, NOW).body?.displayName, "Ada B");
assert.equal(readJoinForm({ ...good, name: "A" }, NOW).errors.name, JOIN_ERR.name);

/* The birthday band is an age, read on the clock given. */
assert.ok(readJoinForm({ ...good, birthday: "2020-01-01" }, NOW).errors.birthday, "six years old is turned away");
assert.ok(readJoinForm({ ...good, birthday: "1890-01-01" }, NOW).errors.birthday);
assert.ok(readJoinForm({ ...good, birthday: "1990-02-30" }, NOW).errors.birthday, "not a real date");
assert.ok(readJoinForm({ ...good, birthday: "12/10/1990" }, NOW).errors.birthday);

/* ---------------------------------------------------------- the third tier */
const full = readJoinForm(
  { ...good, shirt: "XL", heightFt: "5", heightIn: "11", weightLb: "165", gymPick: "The Strip Barbell", instagram: "@ada.rows" },
  NOW,
);
assert.deepEqual(full.errors, {});
assert.equal(full.body?.shirtSize, "XL");
assert.equal(full.body?.heightCm, 180, "5 ft 11 in is 180 cm");
assert.equal(full.body?.weightKg, 74.8, "165 lb is 74.8 kg");
assert.equal(full.body?.homeGym, "The Strip Barbell");
assert.equal(full.body?.instagram, "ada.rows", "the handle is kept without its @");

/* Feet alone is a height (no inches is 0); inches alone is not. */
assert.equal(readJoinForm({ ...good, heightFt: "6" }, NOW).body?.heightCm, 183);
assert.equal(readJoinForm({ ...good, heightIn: "11" }, NOW).errors.height, JOIN_ERR.height);
assert.equal(readJoinForm({ ...good, heightFt: "9" }, NOW).errors.height, JOIN_ERR.height);
assert.equal(readJoinForm({ ...good, heightFt: "5", heightIn: "12" }, NOW).errors.height, JOIN_ERR.height);
assert.equal(readJoinForm({ ...good, weightLb: "20" }, NOW).errors.weight, JOIN_ERR.weight);
assert.equal(readJoinForm({ ...good, weightLb: "abc" }, NOW).errors.weight, JOIN_ERR.weight);

/* OTHER is the rower's words; OTHER with nothing written is no gym; a gym
 * past the cap is refused, not cut. The words typed under OTHER are not
 * sent once a chip is picked instead. */
assert.equal(readJoinForm({ ...good, gymPick: GYM_OTHER, gymOther: "  Garage   gym " }, NOW).body?.homeGym, "Garage gym");
assert.equal(readJoinForm({ ...good, gymPick: GYM_OTHER, gymOther: "   " }, NOW).body?.homeGym, null);
assert.equal(readJoinForm({ ...good, gymPick: GYM_OTHER, gymOther: "x".repeat(61) }, NOW).errors.gym, JOIN_ERR.gym);
assert.equal(readJoinForm({ ...good, gymPick: "Home", gymOther: "Garage gym" }, NOW).body?.homeGym, "Home");

assert.equal(readJoinForm({ ...good, instagram: "not a handle!" }, NOW).errors.instagram, JOIN_ERR.instagram);

/* Every refusal at once, each under its own field. */
const many = readJoinForm({ ...blank, heightIn: "40", weightLb: "9", instagram: "a b" }, NOW);
assert.deepEqual(Object.keys(many.errors).sort(), ["birthday", "division", "height", "instagram", "name", "weight"]);
assert.equal(many.body, null);

/* ------------------------------------------------- the route reads it back */
/* What the form sends is what the route takes, value for value. */
const sent = full.body!;
assert.deepEqual(parseJoinExtras(sent), {
  ok: true,
  value: { shirtSize: "XL", heightCm: 180, weightKg: 74.8, homeGym: "The Strip Barbell" },
});
/* Nulls are "none", kept as nulls. */
assert.deepEqual(parseJoinExtras(min.body!), {
  ok: true,
  value: { shirtSize: null, heightCm: null, weightKg: null, homeGym: null },
});
/* THE OLD SHAPE: a client that sends no third tier (the JoinPanel, the
 * settings form's board save) touches nothing. */
assert.deepEqual(parseJoinExtras({}), { ok: true, value: {} });
assert.deepEqual(
  parseJoinExtras({ displayName: "Ada", instagram: "", division: "F" } as Record<string, unknown>),
  { ok: true, value: {} },
);
/* A value that does not read is refused under its own field. */
assert.deepEqual(parseJoinExtras({ shirtSize: "XXS" }), { ok: false, field: "shirt", error: JOIN_ERR.shirt });
assert.deepEqual(parseJoinExtras({ shirtSize: 3 }), { ok: false, field: "shirt", error: JOIN_ERR.shirt });
assert.deepEqual(parseJoinExtras({ heightCm: 20 }), { ok: false, field: "height", error: JOIN_ERR.height });
assert.deepEqual(parseJoinExtras({ weightKg: 900 }), { ok: false, field: "weight", error: JOIN_ERR.weight });
assert.deepEqual(parseJoinExtras({ homeGym: "x".repeat(61) }), { ok: false, field: "gym", error: JOIN_ERR.gym });
assert.deepEqual(parseJoinExtras({ homeGym: 7 }), { ok: false, field: "gym", error: JOIN_ERR.gym });
/* "" clears, the same as null; whitespace is no gym. */
assert.deepEqual(parseJoinExtras({ shirtSize: "", heightCm: "", weightKg: "", homeGym: "   " }), {
  ok: true,
  value: { shirtSize: null, heightCm: null, weightKg: null, homeGym: null },
});

console.log("join fields: every case holds");
