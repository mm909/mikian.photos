/* The ETA engine against the real course file. Plain asserts, run with
 *   npx tsx src/app/lasd26/route/eta.test.ts
 * (vitest's include is the tracker's tests only — see vitest.config.ts). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MI, type CourseFile } from "./course";
import {
  DEFAULT_ETA_SETTINGS,
  formatClock,
  formatPace,
  formatSpan,
  mileMarkers,
  paceModel,
  parsePace,
  rowEtas,
  snapToCourse,
  startIsoFromTime,
  startTimeInput,
  vanRowAfter,
  type VanPin,
} from "./eta";

const course = JSON.parse(readFileSync(resolve(__dirname, "../../../../public/lasd26/route/course.json"), "utf8")) as CourseFile;
const START = new Date("2026-10-23T05:00:00-07:00");
const plus = (min: number) => new Date(START.getTime() + min * 60000);
const pin = (lat: number, lon: number, at: Date, byName = "Jazz"): VanPin => ({ lat, lon, accuracyM: 12, at: at.toISOString(), byName });
/** The course's own point at a run mile, nudged a few metres east. */
const atMile = (mile: number): [number, number] => {
  const target = mile * MI;
  let i = 1;
  while (i < course.coords.length - 1 && course.cum_m[i] < target) i++;
  return [course.coords[i][1] + 0.00002, course.coords[i][0] + 0.00003];
};

/* ─── mile markers ─── */
const marks = mileMarkers(course);
assert.equal(marks.length, Math.floor(course.length_m / MI), "one marker per whole run mile");
assert.equal(marks[0].mile, 1);
assert.equal(marks[9].tier, 10);
assert.equal(marks[4].tier, 5);
assert.equal(marks[0].tier, 1);
for (const m of marks) {
  const s = snapToCourse(course, m.lat, m.lon);
  assert.ok(Math.abs(s.routeM / MI - m.mile) < 0.02, `marker ${m.mile} snaps back to its mile (got ${(s.routeM / MI).toFixed(3)})`);
}

/* ─── snapping ─── */
{
  const [lat, lon] = atMile(20);
  const s = snapToCourse(course, lat, lon);
  assert.ok(s.offM < 10, `on the line (${s.offM.toFixed(1)} m off)`);
  assert.ok(Math.abs(s.routeM / MI - 20) < 0.05, `mile 20 (got ${(s.routeM / MI).toFixed(2)})`);
  assert.equal(s.afterDrives, 0);
  assert.equal(s.onDrive, false);
}
{
  // A point in the middle of the drive's road through Camp Pendleton.
  const road = course.drives[0].coords!;
  const mid = road[Math.floor(road.length / 2)];
  const s = snapToCourse(course, mid[1], mid[0]);
  assert.equal(s.onDrive, true, "the middle of I-5 is on the drive");
  assert.ok(s.driveFrac > 0.3 && s.driveFrac < 0.7, `about halfway (${s.driveFrac.toFixed(2)})`);
}
{
  // The pickup itself: both lines meet — the van waiting there is on the course, not on the road.
  const d = course.drives[0];
  const s = snapToCourse(course, d.from[1], d.from[0]);
  assert.equal(s.onDrive, false, "waiting at the pickup is not on the drive");
  assert.ok(Math.abs(s.routeM / MI - d.mile) < 0.05);
  assert.equal(s.afterDrives, 0);
}
{
  // Past the restart: the run mile is the same as the pickup's, but a drive is behind it.
  const [lat, lon] = atMile(course.drives[0].mile + 3);
  const s = snapToCourse(course, lat, lon);
  assert.equal(s.afterDrives, 1, "past Camp Pendleton");
}
{
  // Las Vegas is off the course.
  const s = snapToCourse(course, 36.17, -115.14);
  assert.ok(s.offM > 100 * MI);
}

/* ─── the plan, no pin ─── */
{
  const m = paceModel(course, DEFAULT_ETA_SETTINGS, null);
  assert.equal(m.source, "plan");
  assert.equal(m.paceSec, 540);
  const etas = rowEtas(course, m, plus(-600));
  assert.equal(etas.length, course.turns.length);
  assert.equal(etas[0].at.getTime(), START.getTime(), "the start row is the start");
  const finish = etas[etas.length - 1].at;
  const expected = course.length_m / MI * 540 + 25 * 60;
  assert.ok(Math.abs((finish.getTime() - START.getTime()) / 1000 - expected) < 60, "finish = miles × pace + the drive");
  assert.equal(etas.every((e) => !e.passed), true, "nothing passed before the race");
  // The restart row is the drive row's time plus the drive.
  const di = course.turns.findIndex((t) => t.kind === "drive");
  const ri = course.turns.findIndex((t) => t.kind === "restart");
  assert.ok(di >= 0 && ri > di);
  assert.ok(Math.abs((etas[ri].at.getTime() - etas[di].at.getTime()) / 60000 - 25) < 0.01, "restart = drive row + the ride, nothing more");
  for (let i = 1; i < etas.length; i++) assert.ok(etas[i].at.getTime() >= etas[i - 1].at.getTime(), `row ${i} never earlier than the one before`);
  assert.equal(vanRowAfter(course, m), null);
}

/* ─── a pin before the start / at the start / off the course does not set the pace ─── */
{
  const [lat, lon] = atMile(20);
  assert.equal(paceModel(course, DEFAULT_ETA_SETTINGS, pin(lat, lon, plus(-30))).source, "plan");
  assert.match(paceModel(course, DEFAULT_ETA_SETTINGS, pin(lat, lon, plus(-30))).pinNote ?? "", /before the start/);
  const [slat, slon] = atMile(0.3);
  assert.match(paceModel(course, DEFAULT_ETA_SETTINGS, pin(slat, slon, plus(5))).pinNote ?? "", /still at the start/);
  assert.match(paceModel(course, DEFAULT_ETA_SETTINGS, pin(36.17, -115.14, plus(120))).pinNote ?? "", /off the course/);
  // Mile 20 after 10 minutes is not a running pace.
  assert.match(paceModel(course, DEFAULT_ETA_SETTINGS, pin(lat, lon, plus(10))).pinNote ?? "", /not a pace/);
}

/* ─── the van sets the pace ─── */
{
  // Mile 20 at 3 h in → 9:00/mi exactly.
  const [lat, lon] = atMile(20);
  const m = paceModel(course, DEFAULT_ETA_SETTINGS, pin(lat, lon, plus(180)));
  assert.equal(m.source, "van");
  assert.ok(Math.abs(m.paceSec - 540) < 3, `9:00/mi (got ${formatPace(m.paceSec)})`);
  const now = plus(190);
  const etas = rowEtas(course, m, now);
  // A call at mile 30 is ~90 minutes after the pin.
  const i30 = course.turns.findIndex((t) => t.mile >= 30);
  const minutes = (etas[i30].at.getTime() - plus(180).getTime()) / 60000;
  assert.ok(Math.abs(minutes - (course.turns[i30].mile - 20) * 9) < 1, `mile ${course.turns[i30].mile} is ${minutes.toFixed(1)} min after the pin`);
  // Calls behind the van are passed, the ones ahead are not.
  const i10 = course.turns.findIndex((t) => t.mile >= 10);
  assert.equal(etas[i10].passed, true);
  assert.equal(etas[i30].passed, false);
  // The van's row sits after the last call at or before mile 20.
  const after = vanRowAfter(course, m)!;
  assert.ok(course.turns[after].mile <= 20 && (course.turns[after + 1]?.mile ?? 999) > 20);
}
{
  // A faster crew: mile 40 at 5 h → 7:30/mi.
  const [lat, lon] = atMile(40);
  const m = paceModel(course, DEFAULT_ETA_SETTINGS, pin(lat, lon, plus(300)));
  assert.equal(m.source, "van");
  assert.ok(Math.abs(m.paceSec - 450) < 3, formatPace(m.paceSec));
}
{
  // On the drive, halfway, 12 h 15 min in: the run to the pickup took 12 h, 12.5 min of the ride is used.
  const road = course.drives[0].coords!;
  const mid = road[Math.floor(road.length / 2)];
  const m = paceModel(course, DEFAULT_ETA_SETTINGS, pin(mid[1], mid[0], plus(12 * 60 + 15)));
  assert.equal(m.source, "van");
  const pickup = course.drives[0].mile;
  const frac = m.snap!.driveFrac;
  const expectedPace = (12 * 3600 + 15 * 60 - frac * 25 * 60) / pickup;
  assert.ok(Math.abs(m.paceSec - expectedPace) < 1, `${formatPace(m.paceSec)} vs ${formatPace(expectedPace)}`);
  // Its row sits after the DRIVE call.
  const di = course.turns.findIndex((t) => t.kind === "drive");
  assert.equal(vanRowAfter(course, m), di);
  // The restart is the rest of the ride away.
  const etas = rowEtas(course, m, plus(12 * 60 + 15));
  const ri = course.turns.findIndex((t) => t.kind === "restart");
  const minutes = (etas[ri].at.getTime() - plus(12 * 60 + 15).getTime()) / 60000;
  assert.ok(Math.abs(minutes - (1 - frac) * 25) < 0.5, `restart in ${minutes.toFixed(1)} min`);
}
{
  // Past the restart, mile = pickup + 3 at 13 h 25 min: 25 min of drive comes off the clock.
  const pickup = course.drives[0].mile;
  const [lat, lon] = atMile(pickup + 3);
  const m = paceModel(course, DEFAULT_ETA_SETTINGS, pin(lat, lon, plus(13 * 60 + 25)));
  assert.equal(m.source, "van");
  const expectedPace = (13 * 3600) / (pickup + 3);
  assert.ok(Math.abs(m.paceSec - expectedPace) < 2, `${formatPace(m.paceSec)} vs ${formatPace(expectedPace)}`);
  const ri = course.turns.findIndex((t) => t.kind === "restart");
  assert.ok(vanRowAfter(course, m)! >= ri, "the van's row is past the restart");
  // Custom drive minutes and a later start both count.
  const m2 = paceModel(course, { driveMin: 40, startAt: "2026-10-23T05:10:00-07:00", planPaceSec: 540 }, pin(lat, lon, plus(13 * 60 + 25)));
  const expected2 = (13 * 3600 + 15 * 60 - 40 * 60) / (pickup + 3);
  assert.ok(Math.abs(m2.paceSec - expected2) < 2, `${formatPace(m2.paceSec)} vs ${formatPace(expected2)}`);
}

/* ─── words ─── */
assert.equal(formatClock(START), "5:00 AM");
assert.equal(formatClock(new Date("2026-10-23T22:14:00-07:00")), "10:14 PM");
assert.equal(formatClock(new Date("2026-10-24T00:40:00-07:00")), "12:40 AM SAT");
assert.equal(formatPace(532), "8:52/MI");
assert.equal(formatSpan(17 * 3600 + 14 * 60), "17 H 14 MIN");
assert.equal(formatSpan(40 * 60), "40 MIN");
assert.equal(parsePace("9:00"), 540);
assert.equal(parsePace("8"), 480);
assert.equal(parsePace("9:60"), null);
assert.equal(parsePace("abc"), null);
assert.equal(parsePace("1:00"), null);
assert.equal(startTimeInput(DEFAULT_ETA_SETTINGS), "05:00");
assert.equal(startTimeInput({ ...DEFAULT_ETA_SETTINGS, startAt: "2026-10-23T05:12:00-07:00" }), "05:12");
assert.equal(startIsoFromTime("05:12"), "2026-10-23T05:12:00-07:00");
assert.equal(startIsoFromTime("25:00"), null);

console.log("eta.test.ts: ok");
