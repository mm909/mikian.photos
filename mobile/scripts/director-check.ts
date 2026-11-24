/* The director of the produced page (src/erg/director.ts), checked with no
 * phone, no monitor and no server: `npx tsx scripts/director-check.ts` in
 * mobile/. It rows three whole pieces through the director a quarter of a
 * second at a time, with a field of past rows beside them, and prints what
 * was put on the screen and why:
 *
 *   a steady 5K            nothing in the stroke changes; the show is the
 *                          marks along the way, the boats, and quiet.
 *   a 5K rowed quicker     kicks at 2,500 m and 4,000 m, and a force curve
 *   and quicker            that peaks later from 3,000 m on.
 *   a 1K                   a fifth of the length: every distance is cut to
 *                          the piece.
 */
import { MIN_HOLD, POINTS, createDirector, planOf, resample, shapeGap, type Boat, type Entry } from "../src/erg/director";
import { leadSeconds, type Ghost } from "../src/erg/ghosts";

let failed = 0;
const ok = (what: string, pass: boolean, got?: unknown) => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${what}${pass ? "" : ` (got ${JSON.stringify(got)})`}`);
};

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, " ")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

/* A force curve: a bell that peaks `at` of the way through the drive. */
const bell = (peak: number, at: number, n = 32): number[] => Array.from({ length: n }, (_, i) => (i < 2 ? 0 : Math.round(peak * Math.exp(-(((i / (n - 1) - at) / 0.24) ** 2)))));

/* mulberry32, as the simulator's: the same piece every run. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* A field of past rows about a finish: most of them only a time, and a few
 * recorded ones that go out hard and come back, or the other way, so the
 * lead changes hands. */
function fieldFor(target: number, near: number, seed: number): Ghost[] {
  const rnd = prng(seed);
  const out: Ghost[] = [];
  for (let i = 0; i < 24; i++) {
    const seconds = Math.round(near * (0.955 + rnd() * 0.09));
    const g: Ghost = { id: `g${i}`, kind: "field", name: `Rower ${i}`, numStr: String(100 + i), day: "", seconds, spm: 24, marks: [] };
    if (i % 4 === 0) {
      /* Quicker than its average for the first half and slower after, or
       * the other way round. */
      const lean = (i % 8 === 0 ? 1 : -1) * 0.02;
      const lines = Math.ceil(target / 100);
      let at = 0;
      for (let k = 1; k <= lines; k++) {
        const through = (k - 0.5) / lines;
        at += (seconds / lines) * (1 + lean * (through < 0.5 ? -1 : 1));
        g.marks.push(at);
      }
      g.seconds = at;
    }
    out.push(g);
  }
  return out;
}

type Piece = { name: string; target: number; pace: (m: number) => number; curve: (m: number) => number[]; seed: number; /* How many times as fast as a clock it is rowed: a demo row is ten. */ speed?: number };

function rowIt(p: Piece): { log: Entry[]; notes: { t: number; m: number; cue: string }[]; seconds: number; held: { scene: string; cue: string; next: string; s: number }[] } {
  const d = createDirector();
  /* What the piece will finish in, for the field to be about. */
  let near = 0;
  for (let m = 0; m < p.target; m += 10) near += (p.pace(m) / 500) * 10;
  const field = fieldFor(p.target, near, p.seed);
  const DT = 0.25;
  let t = 0;
  let m = 0;
  let nextStroke = 0;
  let curve: number[] = [];
  let ended = false;
  while (!ended) {
    t += DT;
    /* Off the line: half speed for the first strokes. */
    const split = p.pace(m) * (t < 6 ? 1.6 - t * 0.1 : 1);
    m = Math.min(p.target, m + (500 / split) * DT);
    ended = m >= p.target;
    if (t >= nextStroke) {
      nextStroke = t + 60 / 26;
      curve = p.curve(m);
    }
    /* The four nearest in seconds have the lanes; the two nearest of
     * those are beside the rower. */
    const leads = field.map((g) => ({ id: g.id, lead: leadSeconds(g, p.target, t, m) })).sort((a, b) => Math.abs(a.lead) - Math.abs(b.lead));
    const boats: Boat[] = leads.slice(0, 4).map((b, i) => ({ ...b, beside: i < 2 }));
    d.step({ now: t / (p.speed ?? 1), t, m, target: p.target, avgPace: m > 0 ? (t / m) * 500 : 0, curve, boats, ended });
  }
  /* The mean of the whole row, as the page asks for it on every frame. */
  const all = d.average();
  ok(`${p.name}: the mean curve of the row is there to draw the stroke against`, !!all && all.mean.length === POINTS && all.peak > 100, all?.peak);
  const held = d.log.map((e, i) => ({ scene: `${e.scene}${e.lanes}`, cue: e.cue, next: d.log[i + 1]?.cue ?? "", s: (d.log[i + 1]?.t ?? t) - e.t }));
  return { log: [...d.log], notes: [...d.notes], seconds: t, held };
}

const word = (e: Entry) => (e.scene === "lanes" ? "LANES, 5" : e.scene === "duel" ? (e.lanes === 1 ? "DUEL, the rower alone" : "DUEL, 3 lanes") : e.scene === "wide" ? "THE FIELD FROM FAR UP" : "TWO FORCE CURVES");

function print(p: Piece, r: ReturnType<typeof rowIt>) {
  const plan = planOf(p.target);
  console.log(`\n${p.name}: ${fmt(p.target)} m in ${clock(r.seconds)}. Curves over ${fmt(plan.seg)} m, the last stretch ${fmt(plan.homeM)} m, the last strokes ${fmt(plan.lineM)} m.`);
  r.log.forEach((e, i) => console.log(`  ${clock(e.t)}  ${fmt(e.m).padStart(6)} m  ${word(e).padEnd(22)} ${e.cue.padEnd(8)} ${i < r.log.length - 1 ? `${Math.round(r.held[i].s)} s` : "to the end"}`));
  const said = r.notes.filter((n) => !r.log.some((e) => e.t === n.t && e.cue === n.cue));
  console.log(`  ${r.log.length} scenes. Said without a change of scene: ${said.length ? [...new Set(said.map((n) => n.cue))].map((c) => `${c} x${said.filter((n) => n.cue === c).length}`).join(", ") : "nothing"}.`);
}

/* What is true of any piece. */
function common(p: Piece, r: ReturnType<typeof rowIt>, scenes: [number, number]) {
  const cues = r.notes.map((e) => e.cue).filter((c) => c === "home" || c === "line" || c === "finish");
  ok(`${p.name}: it opens on the five lanes`, r.log[0].scene === "lanes" && r.log[0].lanes === 5 && r.log[0].cue === "start", r.log[0]);
  const cut = new Set(["home", "line", "finish"]);
  const short = r.held.filter((h) => h.s < MIN_HOLD - 0.01 && !cut.has(h.next) && h.next !== "");
  ok(`${p.name}: no scene is up under ${MIN_HOLD} s but for the last stretch`, short.length === 0, short);
  ok(`${p.name}: the whole course at half way`, r.log.some((e) => e.cue === "half" && e.scene === "wide" && e.m >= p.target / 2 && e.m < p.target / 2 + 150), r.log.filter((e) => e.cue === "half"));
  ok(`${p.name}: the last stretch, the last strokes and the finish, in that order`, cues.join(" ") === "home line finish", cues);
  ok(`${p.name}: the whole course is not put up twice inside a minute`, r.log.every((e, i) => e.scene !== "wide" || !r.log.slice(i + 1).some((x) => x.scene === "wide" && x.t - e.t < 60)), r.log.filter((e) => e.scene === "wide").map((e) => Math.round(e.t)));
  const homeM = p.target - planOf(p.target).homeM;
  ok(`${p.name}: nothing but the race from the last stretch on`, r.log.filter((e) => e.m >= homeM + 60).every((e) => e.scene === "lanes" || e.scene === "duel"), r.log.filter((e) => e.m >= homeM));
  ok(`${p.name}: every scene that passes through goes back to the race`, r.log.every((e, i) => !(e.scene === "wide" || e.scene === "curve") || (r.log[i + 1] && r.held[i].s <= 14)), r.held);
  ok(`${p.name}: between ${scenes[0]} and ${scenes[1]} scenes`, r.log.length >= scenes[0] && r.log.length <= scenes[1], r.log.length);
  ok(`${p.name}: the lanes are 1, 3 or 5`, r.log.every((e) => e.lanes === 1 || e.lanes === 3 || e.lanes === 5));
}

/* ---- the arithmetic under it ------------------------------------------- */
ok("a curve brought to its samples keeps its ends and its peak", resample([0, 10, 20, 10, 0]).length === POINTS && resample([0, 10, 20, 10, 0])[0] === 0 && Math.abs(Math.max(...resample([0, 10, 20, 10, 0])) - 20) < 1);
ok("the same shape pulled harder is the same shape", shapeGap(resample(bell(150, 0.34)), resample(bell(200, 0.34))) < 0.01, shapeGap(resample(bell(150, 0.34)), resample(bell(200, 0.34))));
ok("a peak that moves from a third to a half of the drive is another shape", shapeGap(resample(bell(170, 0.34)), resample(bell(170, 0.5))) > 0.15, shapeGap(resample(bell(170, 0.34)), resample(bell(170, 0.5))));
ok("a 5K compares 1,000 m and ends on 500 m and 100 m", planOf(5000).seg === 1000 && planOf(5000).homeM === 500 && planOf(5000).lineM === 100, planOf(5000));
ok("a 1K compares 200 m and ends on 150 m and 40 m", planOf(1000).seg === 200 && planOf(1000).homeM === 150 && planOf(1000).lineM === 40, planOf(1000));

/* ---- three rows ---------------------------------------------------------- */
const steady: Piece = { name: "A steady 5K", target: 5000, pace: (m) => 120 + 0.3 * Math.sin(m / 180), curve: () => bell(170, 0.34), seed: 7 };
const quicker: Piece = {
  name: "A 5K rowed quicker and quicker",
  target: 5000,
  pace: (m) => (m < 2500 ? 124 : m < 4000 ? 120.5 : 117) + 0.3 * Math.sin(m / 180),
  curve: (m) => (m < 3000 ? bell(165, 0.32) : bell(178, 0.46)),
  seed: 11,
};
const oneK: Piece = { name: "A 1K", target: 1000, pace: (m) => (m < 700 ? 106 : 103) + 0.2 * Math.sin(m / 90), curve: () => bell(190, 0.36), seed: 3 };

const a = rowIt(steady);
print(steady, a);
common(steady, a, [10, 40]);
ok("A steady 5K: nothing is said of the stroke, which did not change", !a.notes.some((n) => n.cue === "surge" || n.cue === "fade" || n.cue === "shape"), a.notes.filter((n) => n.cue === "surge" || n.cue === "fade" || n.cue === "shape"));
ok("A steady 5K: the first 1,000 m against the last, before the last stretch", a.log.some((e) => e.cue === "compare" && e.scene === "curve" && e.m >= 4300 && e.m < 4500), a.log.filter((e) => e.cue === "compare"));
ok("A steady 5K: quiet brings the whole course round", a.log.some((e) => e.cue === "quiet" && e.scene === "wide"));
ok("A steady 5K: and the lanes down to three and back to five", a.log.some((e) => e.scene === "duel" && e.lanes === 3) && a.log.filter((e) => e.scene === "lanes").length >= 3);

const b = rowIt(quicker);
print(quicker, b);
common(quicker, b, [10, 40]);
ok("quicker and quicker: the kick at 2,500 m is a surge, inside 150 m", b.notes.some((n) => n.cue === "surge" && n.m > 2500 && n.m < 2650), b.notes.filter((n) => n.cue === "surge"));
ok("quicker and quicker: and the one at 4,000 m", b.notes.some((n) => n.cue === "surge" && n.m > 4000 && n.m < 4150), b.notes.filter((n) => n.cue === "surge"));
ok("quicker and quicker: the curve that changed at 3,000 m is put up, inside 300 m", b.log.some((e) => e.cue === "shape" && e.scene === "curve" && e.m > 3000 && e.m < 3300), b.log.filter((e) => e.cue === "shape"));
ok("quicker and quicker: it is not called a fade anywhere", !b.notes.some((n) => n.cue === "fade"), b.notes.filter((n) => n.cue === "fade"));

const c = rowIt(oneK);
print(oneK, c);
common(oneK, c, [5, 16]);
ok("A 1K: its last stretch starts at 850 m and its last strokes at 960 m", c.notes.some((e) => e.cue === "home" && e.m >= 850 && e.m < 860) && c.notes.some((e) => e.cue === "line" && e.m >= 960 && e.m < 970), c.notes.filter((e) => e.cue === "home" || e.cue === "line"));

/* The demo row: the same 5K at ten times a clock, two minutes of it. Every
 * scene is still up its six seconds of the wall, and the first stretch is
 * still set against the last, early enough to be seen. */
const demo: Piece = { ...steady, name: "The demo row, ten times as fast", speed: 10 };
const e = rowIt(demo);
print(demo, e);
const quick = e.held.filter((h) => h.s / 10 < MIN_HOLD - 0.01 && !["home", "line", "finish", ""].includes(h.next));
ok("the demo row: no scene is up under 6 s of the wall but for the last stretch", quick.length === 0, quick);
ok("the demo row: the first 1,000 m against the last is put up before the last stretch", e.log.some((x) => x.cue === "compare" && x.scene === "curve" && x.m < 4500 - 300), e.log.filter((x) => x.cue === "compare"));
ok("the demo row: the field from far up at half way", e.log.some((x) => x.cue === "half" && x.scene === "wide"));
ok("the demo row: between 8 and 20 scenes in its two minutes", e.log.length >= 8 && e.log.length <= 20, e.log.length);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
