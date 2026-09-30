/* The About you readers, checked by hand: npx tsx src/lib/row100kAbout.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * Birthday, height, weight and the optional handle — the pure helpers the
 * join form, the settings page and both APIs share (owner ask, 2026-09-24). */
import assert from "node:assert/strict";
import {
  HOME_GYMS,
  ageOn,
  birthdayBounds,
  birthdayInput,
  fmtHeightCm,
  fmtWeightKg,
  heightCmFromFtIn,
  heightFtIn,
  matchHomeGym,
  parseBirthday,
  parseHeightCm,
  parseInstagramOptional,
  parseWeightKg,
  weightKgFromLb,
  weightLb,
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
assert.equal(parseWeightKg("60 lb"), 27.2, "the form's floor reads through the API");
assert.equal(parseWeightKg(27.2), 27.2);
assert.equal(fmtWeightKg(75), "75 kg");
assert.equal(fmtWeightKg(74.8), "74.8 kg");
assert.equal(fmtWeightKg(null), "");

/* ------------------------------------------ the American edge (09-30) */
// The boxes → cm, nearest cm.
assert.equal(heightCmFromFtIn("5", "11"), 180);
assert.equal(heightCmFromFtIn(5, 11), 180);
assert.equal(heightCmFromFtIn("4", "0"), 122, "4 ft");
assert.equal(heightCmFromFtIn("7", "0"), 213, "7 ft");
assert.equal(heightCmFromFtIn("7", "11"), 241, "the tallest the boxes allow");
assert.equal(heightCmFromFtIn("6", ""), 183, "blank inches is 0");
assert.equal(heightCmFromFtIn("6", " "), 183);
assert.equal(heightCmFromFtIn("6", undefined), 183);
assert.equal(heightCmFromFtIn("", "11"), null, "inches without feet is not a height");
assert.equal(heightCmFromFtIn("", ""), null, "both blank is the caller's clear");
assert.equal(heightCmFromFtIn("3", "11"), null, "under 4 ft");
assert.equal(heightCmFromFtIn("8", "0"), null, "over 7 ft");
assert.equal(heightCmFromFtIn("5", "12"), null, "12 inches is a foot");
assert.equal(heightCmFromFtIn("5.5", "0"), null, "whole feet only");
assert.equal(heightCmFromFtIn("5'", "11"), null);
// cm → the boxes: total inches nearest, then feet and the remainder.
assert.deepEqual(heightFtIn(180), { ft: "5", inch: "11" });
assert.deepEqual(heightFtIn(122), { ft: "4", inch: "0" });
assert.deepEqual(heightFtIn(213), { ft: "7", inch: "0" });
assert.deepEqual(heightFtIn(183), { ft: "6", inch: "0" });
assert.deepEqual(heightFtIn(241), { ft: "7", inch: "11" });
assert.deepEqual(heightFtIn(null), { ft: "", inch: "" });
assert.deepEqual(heightFtIn(undefined), { ft: "", inch: "" });
// Every whole height the boxes can send comes back as the same boxes.
for (let ft = 4; ft <= 7; ft++) {
  for (let inch = 0; inch <= 11; inch++) {
    const cm = heightCmFromFtIn(ft, inch);
    assert.ok(cm !== null, `${ft} ft ${inch} in reads`);
    assert.deepEqual(heightFtIn(cm), { ft: String(ft), inch: String(inch) }, `${ft} ft ${inch} in round-trips`);
  }
}
// lb → kg, nearest 0.1; kg → lb, nearest lb.
assert.equal(weightKgFromLb("180"), 81.6);
assert.equal(weightKgFromLb(180), 81.6);
assert.equal(weightKgFromLb("180.5"), 81.9);
assert.equal(weightKgFromLb("60"), 27.2, "the floor");
assert.equal(weightKgFromLb("500"), 226.8, "the ceiling");
assert.equal(weightKgFromLb("59"), null, "under the floor");
assert.equal(weightKgFromLb("501"), null, "over the ceiling");
assert.equal(weightKgFromLb(""), null, "blank is the caller's clear");
assert.equal(weightKgFromLb("180 lb"), null, "the boxes carry numbers only");
assert.equal(weightKgFromLb("heavy"), null);
assert.equal(weightLb(81.6), "180");
assert.equal(weightLb(27.2), "60");
assert.equal(weightLb(226.8), "500");
assert.equal(weightLb(74.8), "165");
assert.equal(weightLb(null), "");
// Every whole pound the box can send comes back as the same pound.
for (let lb = 60; lb <= 500; lb++) {
  const kg = weightKgFromLb(lb);
  assert.ok(kg !== null, `${lb} lb reads`);
  assert.equal(weightLb(kg), String(lb), `${lb} lb round-trips`);
}

/* ------------------------------------------------------------ home gym */
assert.ok(HOME_GYMS.length >= 4);
assert.equal(new Set(HOME_GYMS.map((g) => g.name.toLowerCase())).size, HOME_GYMS.length, "no gym twice");
assert.equal(matchHomeGym("Planet Fitness"), "Planet Fitness");
assert.equal(matchHomeGym("planet fitness"), "Planet Fitness", "case aside");
assert.equal(matchHomeGym("  The  Strip Barbell "), "The Strip Barbell", "spacing aside");
assert.equal(matchHomeGym("EōS Fitness"), "EōS Fitness");
assert.equal(matchHomeGym("Home"), "Home");
assert.equal(matchHomeGym("Gold's Gym"), null, "a rower's own words light OTHER");
assert.equal(matchHomeGym(""), null);
assert.equal(matchHomeGym(null), null);
assert.equal(matchHomeGym(undefined), null);

console.log("row100kAbout: all checks passed");
