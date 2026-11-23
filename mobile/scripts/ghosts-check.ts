/* The arithmetic of the race page (src/erg/ghosts.ts), checked with no
 * phone and no server: `npx tsx scripts/ghosts-check.ts` in mobile/. */
import { DRIVE, dealLanes, ghostMeters, ghostSeconds, leadSeconds, nextBoat, oarAngle, paceBoat, phaseOf, pickRivals, standing, type Ghost, ghostDone, ghostTrend, trendOf } from "../src/erg/ghosts";

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

/* The seconds between two boats: when a ghost crossed a line. */
ok("a hand-logged row crossed half way at half time", near(ghostSeconds(even, 5000, 2500), 600), ghostSeconds(even, 5000, 2500));
let round = true;
for (let t = 3; t < rec.seconds; t += 7.3) if (!near(ghostSeconds(rec, 5000, ghostMeters(rec, 5000, t)), t, 0.01)) round = false;
ok("a recorded row's seconds undo its meters, all the way along", round);
ok("its finish is its time", ghostSeconds(rec, 5000, 5000) === rec.seconds);
ok("a ghost 50 m up at a 2:00 split is twelve seconds ahead", near(leadSeconds(even, 5000, 600, 2450), 12), leadSeconds(even, 5000, 600, 2450));
ok("and one 50 m back is twelve behind", near(leadSeconds(even, 5000, 600, 2550), -12), leadSeconds(even, 5000, 600, 2550));

/* Who takes an empty lane. The rower is half way, on a 20:00 pace. */
const water = { back: 26, front: 34 };
const at = { meters: 5000, t: 600, mine: 2500, speed: 5000 / 1200, near: 1200, water };
const row = (id: string, seconds: number, numStr: string): Ghost => ({ ...even, id, kind: "follow", name: id, numStr, seconds });
const some = [row("far", 1100, "010"), row("close", 1204, "011"), row("gone", 1300, "012")];
const got = nextBoat({ ...at, ghosts: some, racing: [], want: 0 });
ok("a row on the water has the lane before any pace boat", got?.g.id === "close" && got.on, got);
const none = nextBoat({ ...at, ghosts: [some[0], some[2]], racing: [], want: 0 });
ok("with no row near, a pace boat for a round finish has it", none?.g.kind === "pace" && none.g.seconds % 5 === 0 && Math.abs(none.g.seconds - 1200) <= 5, none);
const ahead = nextBoat({ ...at, near: 1203, ghosts: [], racing: [], want: 1 });
ok("asked for one ahead, the pace boat finishes sooner than the rower", ahead?.g.kind === "pace" && ahead.g.seconds < 1203, ahead);
const behind = nextBoat({ ...at, near: 1203, ghosts: [], racing: [], want: -1 });
ok("asked for one behind, it finishes later", behind?.g.kind === "pace" && behind.g.seconds > 1203, behind);
const second = nextBoat({ ...at, near: 1203, ghosts: [], racing: [ahead!.g], want: 1 });
ok("a second one ahead is a different boat", second?.g.kind === "pace" && second.g.id !== ahead!.g.id && second.g.seconds < 1203, second);
ok("nobody is given a lane twice", nextBoat({ ...at, ghosts: some, racing: [some[1]], want: 0 })?.g.id !== "close");
ok("nor two rows of one rower: a pace boat has the lane first", nextBoat({ ...at, ghosts: [row("twin", 1203, "011")], racing: [some[1]], want: 0 })?.g.kind === "pace");
ok("a row of somebody who is not racing has it", nextBoat({ ...at, ghosts: [row("twin", 1201, "011"), row("other", 1206, "013")], racing: [some[1]], want: 0 })?.g.id === "other");
const own: Ghost[] = [1198, 1202, 1205].map((s2, i) => ({ ...even, id: `own${i}`, kind: "me", seconds: s2 }));
ok("with one of the rower's own rows racing, no other of theirs is given a lane", nextBoat({ ...at, ghosts: own, racing: [own[0]], want: 0 })?.g.kind === "pace");
/* Late in a long piece, upright, only a few seconds either side are on the
 * water: four lanes still fill. */
const late = { ...at, t: 1150, mine: (1150 / 1203) * 5000, near: 1203 };
const filled: Ghost[] = [];
for (let i = 0; i < 4; i++) {
  const n = nextBoat({ ...late, ghosts: [], racing: filled, want: i % 2 ? -1 : 1 });
  if (n) filled.push(n.g);
}
ok("four lanes fill late in the piece with nobody real", filled.length === 4 && new Set(filled.map((g) => g.id)).size === 4, filled.map((g) => g.seconds));
const off = filled.map((g) => ghostMeters(g, 5000, late.t) - late.mine);
ok("each of them is on the water", off.every((d) => d >= -water.back && d <= water.front), off);
ok("a pace boat rows an even pace", near(ghostMeters(paceBoat(1200), 5000, 300), 1250));
const mineOnly: Ghost[] = [1190, 1200, 1210, 1220].map((s2, i) => ({ ...even, id: `m${i}`, seconds: s2 }));
ok("a field of the rower's own rows gives one boat, not four", pickRivals(mineOnly, 5000, 1200, 4).length === 1, pickRivals(mineOnly, 5000, 1200, 4).length);

/* A rower on the water this minute, where they are this second. */
const early: Ghost = { ...even, id: "live:a", kind: "live", ahead: 60 };
ok("a rower who pulled a minute before is a minute up the course", near(ghostMeters(early, 5000, 600), ghostMeters(even, 5000, 660)), ghostMeters(early, 5000, 600));
ok("and is a minute ahead in seconds", near(leadSeconds(early, 5000, 600, 2500), 60), leadSeconds(early, 5000, 600, 2500));
const lateOne: Ghost = { ...even, id: "live:b", kind: "live", ahead: -30 };
ok("one who pulls half a minute after is on the start until then", ghostMeters(lateOne, 5000, 20) === 0 && ghostMeters(lateOne, 5000, 40) > 0);
ok("and finishes half a minute after its time", !ghostDone(lateOne, 1215) && ghostDone(lateOne, 1231) && ghostDone(even, 1200));
ok("a rower on their last 1,000 m as this one starts is not on the water", ghostMeters({ ...even, ahead: 960 }, 5000, 5) > 3900);
ok("nor given a lane", nextBoat({ ...at, t: 5, mine: 20, ghosts: [{ ...even, id: "live:c", kind: "live", numStr: "020", ahead: 960 }], racing: [], want: 0 })?.g.kind === "pace");
ok("a live rower beside this one has the lane before a recorded row", nextBoat({ ...at, ghosts: [...some, { ...even, id: "live:d", kind: "live", numStr: "021", seconds: 1201, ahead: 1 }], racing: [], want: 0 })?.g.id === "live:d");

/* Speeding up, slowing down. */
ok("the same 100 m twice is steady", trendOf(24, 24) === 0 && trendOf(24, 24.1) === 0);
ok("a quicker last 100 m is speeding up", trendOf(24, 23.6) > 0 && trendOf(24, 23) === 1, [trendOf(24, 23.6), trendOf(24, 23)]);
ok("a slower one is slowing down", trendOf(24, 24.4) < 0 && trendOf(24, 25) === -1, [trendOf(24, 24.4), trendOf(24, 25)]);
ok("a row logged by hand is steady", ghostTrend(even, 5000, 600) === 0);
/* 100 m lines 24 s apart to 1,000 m, then 23 s apart. */
const kick: Ghost = { ...even, id: "kick", seconds: 0, marks: [] };
let clockAt = 0;
for (let i = 1; i <= 50; i++) {
  clockAt += i <= 10 ? 24 : 23;
  kick.marks.push(clockAt);
}
kick.seconds = clockAt;
ok("a recorded row is steady before it picks up", ghostTrend(kick, 5000, 200) === 0, ghostTrend(kick, 5000, 200));
ok("speeding up through the 100 m after it does", ghostTrend(kick, 5000, 240 + 23) > 0.9, ghostTrend(kick, 5000, 263));
ok("and steady again once both 100 m are the new split", ghostTrend(kick, 5000, 240 + 23 * 3) === 0, ghostTrend(kick, 5000, 309));

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
