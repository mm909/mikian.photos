/* The arithmetic of the race page (src/erg/ghosts.ts), checked with no
 * phone and no server: `npx tsx scripts/ghosts-check.ts` in mobile/. */
import { DRIVE, dealLanes, ghostMeters, oarAngle, phaseOf, standing, type Ghost } from "../src/erg/ghosts";

let failed = 0;
const ok = (what: string, pass: boolean, got?: unknown) => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${what}${pass ? "" : ` (got ${JSON.stringify(got)})`}`);
};
const near = (a: number, b: number, by = 0.01) => Math.abs(a - b) <= by;

const even: Ghost = { id: "a", kind: "me", name: "", numStr: "001", day: "AUG 12", seconds: 1200, spm: 0, marks: [] };
ok("a hand-logged row is at half way at half time", near(ghostMeters(even, 5000, 600), 2500), ghostMeters(even, 5000, 600));
ok("it has not left before the start", ghostMeters(even, 5000, -3) === 0);
ok("it waits on the finish line", ghostMeters(even, 5000, 5000) === 5000);

/* A recorded row: 100 m every 24 s for the first half, every 20 s after. */
const marks = Array.from({ length: 50 }, (_, i) => (i < 25 ? (i + 1) * 24 : 600 + (i - 24) * 20));
const rec: Ghost = { id: "b", kind: "follow", name: "Dana", numStr: "007", day: "SEP 27", seconds: marks[49], spm: 24, marks };
ok("a recorded row is on its 100 m line at the mark", near(ghostMeters(rec, 5000, 24), 100), ghostMeters(rec, 5000, 24));
ok("and between two lines between two marks", near(ghostMeters(rec, 5000, 36), 150), ghostMeters(rec, 5000, 36));
ok("inside the first 100 m it runs in from the start", near(ghostMeters(rec, 5000, 12), 50), ghostMeters(rec, 5000, 12));
ok("it keeps the pace it changed to", near(ghostMeters(rec, 5000, 610), 2550), ghostMeters(rec, 5000, 610));
ok("its last line is the finish", near(ghostMeters(rec, 5000, rec.seconds - 10), 4950), ghostMeters(rec, 5000, rec.seconds - 10));
let last = -1;
let rising = true;
for (let t = 0; t <= rec.seconds + 5; t += 0.7) {
  const m = ghostMeters(rec, 5000, t);
  if (m < last) rising = false;
  last = m;
}
ok("it never goes backwards", rising);

const field: Ghost[] = [1180, 1190, 1200, 1210, 1220, 1230].map((s, i) => ({ ...even, id: `g${i}`, seconds: s }));
const lanes = dealLanes(field, 5, 1200);
ok("nobody is dealt the rower's lane", [...lanes.values()].every((l) => l !== 2), [...lanes.values()]);
ok("the two nearest finishes are in different lanes", lanes.get("g2") !== lanes.get("g1") && lanes.get("g2") !== lanes.get("g3"), [...lanes.entries()]);
ok("every ghost has a lane", lanes.size === field.length);

const st = standing(field, 5000, 600, 2500);
ok("at half time on a 20:00 pace, two are ahead and three behind", st.ahead === 2 && st.behind === 3, st);

ok("the blade is in the water through the drive", oarAngle(0.1).wet && !oarAngle(DRIVE + 0.1).wet);
ok("the oar starts ahead of the pin and finishes behind it", oarAngle(0).angle > 0.5 && oarAngle(DRIVE - 0.001).angle < -0.5, [oarAngle(0).angle, oarAngle(DRIVE - 0.001).angle]);
ok("the way back ends where the catch begins", near(oarAngle(0.9999).angle, oarAngle(0).angle, 0.01));
ok("a ghost's place in its stroke is steady and under one", phaseOf("abc") === phaseOf("abc") && phaseOf("abc") >= 0 && phaseOf("abc") < 1);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
