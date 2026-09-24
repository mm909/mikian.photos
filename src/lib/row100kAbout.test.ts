/* The About you readers, checked by hand: npx tsx src/lib/row100kAbout.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * Birthday, height, weight and the optional handle — the pure helpers the
 * join form, the settings page and both APIs share (owner ask, 2026-09-24). */
import assert from "node:assert/strict";
import {
  ageOn,
  birthdayBounds,
  birthdayInput,
  fmtHeightCm,
  fmtWeightKg,
  parseBirthday,
  parseHeightCm,
  parseInstagramOptional,
  parseWeightKg,
} from "./row100k";

/* A fixed "today": 2026-09-24, UTC noon. */
const TODAY = Date.UTC(2026, 8, 24, 12);

/* ---------------------------------------------------------- instagram */
assert.equal(parseInstagramOptional(undefined), "");
assert.equal(parseInstagramOptional(null), "");
assert.equal(parseInstagramOptional(""), "");
assert.equal(parseInstagramOptional("   "), "");
assert.equal(parseInstagramOptional("@"), "");
assert.equal(parseInstagramOptional("@mikian_"), "mikian_");
assert.equal(parseInstagramOptional("mikian_"), "mikian_");
assert.equal(parseInstagramOptional("  @Row.er99 "), "Row.er99");
assert.equal(parseInstagramOptional("not a handle"), null);
assert.equal(parseInstagramOptional("way.too.long.for.instagram.handles.x"), null);
assert.equal(parseInstagramOptional(42), null);

/* ------------------------------------------------------------ birthday */
{
  const ok = parseBirthday("1990-05-17", TODAY);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.toISOString(), "1990-05-17T00:00:00.000Z");
    assert.equal(birthdayInput(ok.value), "1990-05-17");
  }
}
assert.equal(parseBirthday("", TODAY).ok, false);
assert.equal(parseBirthday(undefined, TODAY).ok, false);
assert.equal(parseBirthday("17/05/1990", TODAY).ok, false);
assert.equal(parseBirthday("1990-02-30", TODAY).ok, false, "Feb 30 is not a date");
assert.equal(parseBirthday("2000-02-29", TODAY).ok, true, "leap day is");
assert.equal(parseBirthday("1900-02-29", TODAY).ok, false, "1900 was not a leap year");
// The age band, at the edges: ten today is in, ten tomorrow is out.
assert.equal(parseBirthday("2016-09-24", TODAY).ok, true, "turned 10 today");
assert.equal(parseBirthday("2016-09-25", TODAY).ok, false, "turns 10 tomorrow");
assert.equal(parseBirthday("1926-09-24", TODAY).ok, true, "100 today");
assert.equal(parseBirthday("1926-09-23", TODAY).ok, true, "100 since yesterday, still 100");
assert.equal(parseBirthday("1925-09-24", TODAY).ok, false, "101 — past the band");
assert.equal(parseBirthday("2030-01-01", TODAY).ok, false, "the future");
assert.equal(ageOn(new Date(Date.UTC(2000, 1, 29)), TODAY), 26);
assert.equal(ageOn(new Date(Date.UTC(2000, 9, 1)), TODAY), 25, "birthday later this year");
assert.deepEqual(birthdayBounds(TODAY), { min: "1926-09-24", max: "2016-09-24" });
assert.equal(birthdayInput(null), "");

/* -------------------------------------------------------------- height */
assert.equal(parseHeightCm("180"), 180);
assert.equal(parseHeightCm("180 cm"), 180);
assert.equal(parseHeightCm("180.6cm"), 181);
assert.equal(parseHeightCm("1.80 m"), 180);
assert.equal(parseHeightCm("1,75m"), 175);
assert.equal(parseHeightCm("5'11"), 180);
assert.equal(parseHeightCm("5' 11\""), 180);
assert.equal(parseHeightCm("5 ft 11 in"), 180);
assert.equal(parseHeightCm("5 feet 11 inches"), 180);
assert.equal(parseHeightCm("6'"), 183);
assert.equal(parseHeightCm("71 in"), 180);
assert.equal(parseHeightCm(172.4), 172);
assert.equal(parseHeightCm(""), null);
assert.equal(parseHeightCm("tall"), null);
assert.equal(parseHeightCm("50"), null, "below the band");
assert.equal(parseHeightCm("300 cm"), null, "above the band");
assert.equal(parseHeightCm("9'"), null, "above the band in feet");
assert.equal(parseHeightCm(NaN), null);
assert.equal(fmtHeightCm(180), "180 cm");
assert.equal(fmtHeightCm(null), "");

/* -------------------------------------------------------------- weight */
assert.equal(parseWeightKg("75"), 75);
assert.equal(parseWeightKg("75 kg"), 75);
assert.equal(parseWeightKg("75.55kg"), 75.6);
assert.equal(parseWeightKg("165 lb"), 74.8);
assert.equal(parseWeightKg("165lbs"), 74.8);
assert.equal(parseWeightKg("165 pounds"), 74.8);
assert.equal(parseWeightKg("12 st 4"), 78);
assert.equal(parseWeightKg("12st"), 76.2);
assert.equal(parseWeightKg(80.04), 80);
assert.equal(parseWeightKg(""), null);
assert.equal(parseWeightKg("heavy"), null);
assert.equal(parseWeightKg("20"), null, "below the band");
assert.equal(parseWeightKg("600 lb"), null, "above the band");
assert.equal(fmtWeightKg(75), "75 kg");
assert.equal(fmtWeightKg(74.8), "74.8 kg");
assert.equal(fmtWeightKg(null), "");

console.log("row100kAbout: all checks passed");
