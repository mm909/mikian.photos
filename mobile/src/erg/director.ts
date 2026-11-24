/* THE DIRECTOR: who decides what the produced page shows, and when (owner,
 * 2026-11-23: "during the row, I want users to want to use our app during
 * the row ... I want to produce a screen that they're looking at ... for a
 * 5K, we get to run like a 20-minute television show"; "as I'm rowing, I
 * want that screen to change. I don't want it to just change like a
 * screensaver ... I want it to change a little intelligently. I want it to
 * change when things in my stroke change, like maybe I kicked it up a lot,
 * or maybe I changed my force curve"; "I want it to be dynamic ... like
 * watching a movie"; and then: "I like the idea of having a director /
 * producer ... having them have a bunch of scenes to choose from and maybe
 * cues for when to put those scenes in").
 *
 * It is told where the row is a few times a second (`step`) and answers
 * with the SHOT: which scene is up, how many lanes the race has, and the
 * cue that put it there. Nothing in this file touches React, the network
 * or a clock of its own, so a script rows whole pieces through it and
 * prints what it chose (mobile/scripts/director-check.ts).
 *
 * THE SCENES it has to choose from:
 *   lanes  the race, five lanes (screens/GhostRace.tsx);
 *   duel   the same race narrowed to three lanes, or to the rower's own
 *          ("reduce the number of people we're racing against to 3 ... 2
 *          of the edge people fall off ... keep it at 1, 3 or 5");
 *   wide   the whole field from far up, everybody a dot, and the whole
 *          course as a bar under it ("one animation is the zooming out of
 *          that race screen ... very faint dots of everyone's row and
 *          where they're at during this 5K");
 *   curve  two force curves, one over the other ("if my force curve
 *          changed significantly, I could show them the force curve for
 *          the last 1,000 ... versus the last 1,000. Or near the end ...
 *          here's what it was the first 1,000, here's what it was this
 *          last 1,000").
 *
 * THE CUES, and what each puts up:
 *   start    the five lanes, lined up.
 *   surge    the split of the last 100 m is two seconds or more quicker
 *            than the 100 m before it: the rower's own lane, alone.
 *   fade     the same the other way: three lanes, the two beside them.
 *   shape    the force curve of the last strokes is not the curve of the
 *            stretch before them: the two curves.
 *   closing  a boat and the rower will change places inside half a
 *            minute; pass, passed: they just did. If it is not in the
 *            picture the lanes widen to take it in ("eventually maybe we
 *            catch up to someone, and maybe there's a 4th and 5th added
 *            again").
 *   half     half way: the field from far up.
 *   compare  a little before the last stretch: the first stretch's curve
 *            against the last one's.
 *   home     the last stretch: five lanes and no more scenes.
 *   line     the last strokes: three lanes if somebody is beside the
 *            rower, their own lane if nobody is.
 *   finish   five lanes, and it stays.
 *   quiet    nothing has happened for a while: the five lanes come in to
 *            three ("then maybe it zooms in again"); from three, the
 *            field from far up and back, or the last stretch's curve against
 *            the one before; and when neither is due, back out to five.
 *   back     a scene that is only passing through has had its time.
 *
 * NO FLICKER. A scene is up six seconds of the clock on the wall before
 * anything but the last stretch may take the screen from it; a cue that
 * arrives sooner waits its turn, a few seconds, and is dropped if the
 * moment has gone. The whole course and the curves come back only after a
 * rest. Cues are read off the row's own meters and seconds; how long a
 * scene is held is read off the wall, because a demo row runs ten times
 * as fast as a clock and eyes do not.
 *
 * A 1K IS NOT A 5K ("other people row for different amounts of time, like
 * a 1K"). Every distance below is cut to the piece (`planOf`): the stretch
 * the curves are compared over is a fifth of it (1,000 m of a 5K, 200 m of
 * a 1K), the last stretch a tenth, and how long quiet lasts follows how
 * long the row will take. */

export type Scene = "lanes" | "wide" | "duel" | "curve";
export type Cue = "start" | "surge" | "fade" | "shape" | "closing" | "pass" | "passed" | "half" | "compare" | "home" | "line" | "finish" | "quiet" | "back";

/* One of the boats in a lane: how many seconds it is ahead of the rower
 * (behind, under nothing), and whether its lane is one of the two beside
 * the rower's. */
export type Boat = { id: string; lead: number; beside: boolean };

export type Tick = {
  /* The clock on the wall, seconds. */
  now: number;
  /* The monitor's own seconds and meters, and the distance it is set to. */
  t: number;
  m: number;
  target: number;
  /* The average split so far, seconds a 500; 0 before there is one. */
  avgPace: number;
  /* The last whole force curve the monitor sent, pounds of force. A new
   * stroke is a new array. */
  curve: number[];
  boats: Boat[];
  ended: boolean;
};

/* Two curves to draw one over the other, each the mean of a stretch, as
 * POINTS samples across the drive, in pounds. `a` is the earlier one. */
export type Compare = { a: number[]; b: number[]; aWord: string; bWord: string };

export type Shot = {
  scene: Scene;
  lanes: 1 | 3 | 5;
  /* What put this scene up. */
  cue: Cue;
  /* When, by the wall and by the row. */
  at: number;
  atT: number;
  atM: number;
  compare: Compare | null;
  /* The last cue of all, whether or not it changed the scene: a pass that
   * was already in the picture is still worth a word on the page. */
  note: { cue: Cue; at: number };
};

export type Entry = { t: number; m: number; scene: Scene; lanes: 1 | 3 | 5; cue: Cue };

/* How many samples every curve is brought to, so one can be laid on
 * another whatever the length of its drive. */
export const POINTS = 24;
const BUCKET_M = 50;

/* Seconds of the wall a scene is up before another may take the screen. */
export const MIN_HOLD = 6;
/* And how long the scenes that only pass through stay. */
const HOLD: Record<"wide" | "curve" | "solo", number> = { wide: 12, curve: 10, solo: 8 };
/* Seconds a 500 the split must move, 100 m against the 100 m before. */
const PACE_S = 2;
/* How unlike two curves must be, each against its own peak (root mean
 * square of the difference, 0 to 1), or how far the peak itself must have
 * moved, to be worth showing. MINE: neither has been seen against a real
 * rower's curves yet. */
const SHAPE_GAP = 0.06;
const PEAK_GAP = 0.15;
/* A boat that will cross the rower inside this many seconds is closing. */
const CLOSE_S = 30;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const meters = (v: number): string => Math.round(v).toLocaleString("en-US");

/* THE PIECE'S OWN DISTANCES. */
export function planOf(target: number) {
  /* What a surge is read over. */
  const lap = target < 2000 ? 50 : 100;
  /* The stretch two curves are compared over: 1,000 m of a 5K. */
  const seg = clamp(Math.round(target / 500) * 100, 200, 1000);
  /* The last stretch (500 m of a 5K) and the last strokes (100 m of it). */
  const homeM = clamp(target * 0.1, 150, 500);
  const lineM = clamp(target * 0.02, 40, 100);
  /* Where the first stretch is set against the last, clear of the end. */
  const lateM = target - homeM - Math.max(80, target * 0.04);
  /* The start is its own thing: nothing is read into the stroke, and
   * quiet is not counted, until the row has settled. */
  const settleM = clamp(target * 0.08, 150, 500);
  return { lap, seg, homeM, lineM, lateM, settleM, recentM: clamp(seg * 0.2, 100, 200) };
}

/* A curve as POINTS samples across its drive. */
export function resample(points: number[], n = POINTS): number[] {
  const out = new Array<number>(n).fill(0);
  const last = points.length - 1;
  if (last < 1) return out;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * last;
    const k = Math.min(last - 1, Math.floor(x));
    out[i] = points[k] + (points[k + 1] - points[k]) * (x - k);
  }
  return out;
}

/* How unlike two curves are in shape, each against its own peak. */
export function shapeGap(a: number[], b: number[]): number {
  const pa = Math.max(...a);
  const pb = Math.max(...b);
  if (!(pa > 0) || !(pb > 0) || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] / pa - b[i] / pb;
    s += d * d;
  }
  return Math.sqrt(s / a.length);
}

/* `until`: the second on the wall after which the moment has gone. */
type Want = { cue: Cue; pri: number; until: number; beside?: boolean; compare?: Compare };
type Seen = { side: -1 | 0 | 1; hist: { t: number; lead: number }[]; mute: number; muteClose: number; at: number };

export type Director = {
  step(tick: Tick): Shot;
  /* The mean curve of the row so far and the tallest peak in it, for the
   * live curve to be drawn against; null before there are strokes. */
  average(): { mean: number[]; peak: number } | null;
  /* Every scene it has put up, in order, for the check. */
  log: Entry[];
  notes: { t: number; m: number; cue: Cue }[];
};

export function createDirector(): Director {
  let target = -1;
  let plan = planOf(0);
  let lastM = 0;
  let path: { t: number; m: number }[] = [];
  let curveRef: number[] | null = null;
  let buckets: ({ sum: number[]; n: number } | undefined)[] = [];
  let peak = 0;
  const boats = new Map<string, Seen>();
  let once = new Set<Cue>();
  /* How many lanes the race goes back to after a scene passes through. */
  let home: 3 | 5 = 5;
  /* The row's second at which the scene last changed, and the row's
   * seconds before which each of these may not come round again. */
  let changedT = 0;
  let cool = { wide: 0, curve: 0, solo: 0, pace: 0 };
  /* The meters before which a changed curve is not put up again: by then
   * the stretch it is set against is the new curve too. */
  let shapeM = 0;
  /* The cue waiting for the screen, and the mark along the way that is. */
  let pending: Want | null = null;
  let owed: Want | null = null;
  let turn = 0;
  /* How many of the row's seconds pass in one of the wall's: 1 on a real
   * monitor, ten on a demo row. */
  let rate = 1;
  let wasAt = { now: 0, t: 0 };
  const first = (now: number): Shot => ({ scene: "lanes", lanes: 5, cue: "start", at: now, atT: 0, atM: 0, compare: null, note: { cue: "start", at: now } });
  let shot = first(0);
  const log: Entry[] = [];
  const notes: { t: number; m: number; cue: Cue }[] = [];

  const reset = (tick: Tick) => {
    target = tick.target;
    plan = planOf(target);
    path = [];
    curveRef = null;
    buckets = [];
    peak = 0;
    boats.clear();
    once = new Set();
    home = 5;
    changedT = 0;
    cool = { wide: 0, curve: 0, solo: 0, pace: 0 };
    shapeM = 0;
    pending = null;
    owed = null;
    turn = 0;
    rate = 1;
    wasAt = { now: 0, t: 0 };
    shot = first(tick.now);
    log.length = 0;
    notes.length = 0;
    log.push({ t: 0, m: 0, scene: "lanes", lanes: 5, cue: "start" });
  };

  /* The second the rower was at `m`, off the path kept. */
  const secondAt = (m: number): number | null => {
    if (path.length < 2 || m < path[0].m) return null;
    for (let i = path.length - 1; i > 0; i--) {
      if (path[i - 1].m > m) continue;
      const [a, b] = [path[i - 1], path[i]];
      return b.m > a.m ? a.t + ((m - a.m) / (b.m - a.m)) * (b.t - a.t) : b.t;
    }
    return null;
  };

  /* The mean curve of the strokes pulled between two places. */
  const meanOver = (from: number, to: number): { mean: number[]; n: number } | null => {
    const sum = new Array<number>(POINTS).fill(0);
    let n = 0;
    for (let i = Math.max(0, Math.ceil(from / BUCKET_M)); i * BUCKET_M < to && i < buckets.length; i++) {
      const b = buckets[i];
      if (!b) continue;
      for (let k = 0; k < POINTS; k++) sum[k] += b.sum[k];
      n += b.n;
    }
    return n > 0 ? { mean: sum.map((v) => v / n), n } : null;
  };

  /* The last stretch against the one before it. */
  const stretches = (m: number): Compare | null => {
    const a = meanOver(m - 2 * plan.seg, m - plan.seg);
    const b = meanOver(m - plan.seg, m);
    if (!a || !b || a.n < 8 || b.n < 8 || m < 2 * plan.seg) return null;
    return { a: a.mean, b: b.mean, aWord: `${meters(plan.seg)} M BEFORE`, bWord: `LAST ${meters(plan.seg)} M` };
  };

  const isRace = (s: Shot) => s.scene === "lanes" || s.scene === "duel";
  /* A scene that is only passing through: the whole course, the curves,
   * and the rower's own lane alone (but for the last strokes). */
  const passing = (s: Shot) => s.scene === "wide" || s.scene === "curve" || (s.scene === "duel" && s.lanes === 1 && s.cue !== "line");
  const holdOf = (s: Shot) => (s.scene === "wide" ? HOLD.wide : s.scene === "curve" ? HOLD.curve : HOLD.solo);

  return {
    log,
    notes,
    average: () => {
      const all = meanOver(0, Infinity);
      return all && all.n >= 3 ? { mean: all.mean, peak } : null;
    },
    step(tick) {
      if (tick.target !== target || tick.m + 5 < lastM) reset(tick);
      lastM = tick.m;
      const { now, t, m } = tick;
      /* How long the row will take, for how long quiet is. */
      const whole = (target * (tick.avgPace > 0 && m > 100 ? tick.avgPace : 120)) / 500;
      if (!wasAt.now || t < wasAt.t) wasAt = { now, t };
      else if (now - wasAt.now >= 0.2) {
        const r = (t - wasAt.t) / (now - wasAt.now);
        if (r > 0) rate = r > 0.7 && r < 1.4 ? 1 : Math.min(40, rate + (r - rate) * 0.3);
        wasAt = { now, t };
      }
      const quietS = clamp(whole * 0.06, 25, 90);

      const say = (cue: Cue) => {
        if (shot.note.cue === cue && now - shot.note.at < 1) return;
        shot = { ...shot, note: { cue, at: now } };
        notes.push({ t, m, cue });
      };
      const show = (scene: Scene, lanes: 1 | 3 | 5, cue: Cue, compare: Compare | null = null) => {
        if (scene === shot.scene && lanes === shot.lanes) return say(cue);
        shot = { scene, lanes, cue, at: now, atT: t, atM: m, compare, note: { cue, at: now } };
        changedT = t;
        if (scene === "wide") cool.wide = t + 4 * quietS;
        if (scene === "curve") cool.curve = t + 4 * quietS;
        if (scene === "duel" && lanes === 1) cool.solo = t + quietS;
        if (cue === "shape") shapeM = m + plan.seg;
        notes.push({ t, m, cue });
        log.push({ t, m, scene, lanes, cue });
        if (log.length > 400) log.shift();
      };
      const race = (lanes: 1 | 3 | 5, cue: Cue) => show(lanes === 5 ? "lanes" : "duel", lanes, cue);

      /* ---- what the row has done ------------------------------------ */
      const tail = path[path.length - 1];
      if (m > 0 && (!tail || m >= tail.m + 2)) {
        path.push({ t, m });
        while (path.length > 2 && path[1].m < m - 2 * plan.lap - 40) path.shift();
      }
      let stroke = false;
      if (tick.curve !== curveRef) {
        curveRef = tick.curve;
        if (tick.curve.length >= 6 && m > 0) {
          const r = resample(tick.curve);
          const i = Math.floor(m / BUCKET_M);
          const b = (buckets[i] ??= { sum: new Array<number>(POINTS).fill(0), n: 0 });
          for (let k = 0; k < POINTS; k++) b.sum[k] += r[k];
          b.n++;
          peak = Math.max(peak, ...r);
          stroke = true;
        }
      }

      if (tick.ended) {
        if (!once.has("finish")) {
          once.add("finish");
          pending = owed = null;
          race(5, "finish");
        }
        return shot;
      }
      /* On the start line the picture is the line-up. */
      if (!(t > 0) || m < 1) return shot;

      /* ---- the boats: who just changed places with the rower, and who
       * is about to -------------------------------------------------- */
      const wants: Want[] = [];
      for (const b of tick.boats) {
        let k = boats.get(b.id);
        if (!k) {
          k = { side: 0, hist: [], mute: 0, muteClose: 0, at: t };
          boats.set(b.id, k);
        }
        k.at = t;
        const side: -1 | 0 | 1 = b.lead > 0.15 ? 1 : b.lead < -0.15 ? -1 : k.side;
        const old = k.hist[0];
        if (m >= 150) {
          if (k.side && side && side !== k.side && t >= k.mute) {
            wants.push({ cue: side < 0 ? "pass" : "passed", pri: 70, until: now + 5, beside: b.beside });
            k.mute = t + 20;
            k.muteClose = t + 30;
          } else if (old && t - old.t >= 8 && t >= k.muteClose && Math.abs(b.lead) > 0.4) {
            const v = (b.lead - old.lead) / (t - old.t);
            const cross = (side > 0 && v < -0.004) || (side < 0 && v > 0.004) ? Math.abs(b.lead) / Math.abs(v) : Infinity;
            if (cross < CLOSE_S) {
              wants.push({ cue: "closing", pri: 60, until: now + 6, beside: b.beside });
              k.muteClose = t + 30;
            }
          }
        }
        k.side = side;
        k.hist.push({ t, lead: b.lead });
        while (k.hist.length > 1 && k.hist[1].t <= t - 10) k.hist.shift();
      }
      for (const [id, k] of boats) if (k.at !== t) boats.delete(id);

      /* ---- the last stretch: the picture is the finish --------------- */
      if (m >= target - plan.lineM) {
        if (!once.has("line")) {
          once.add("line");
          once.add("home");
          pending = owed = null;
          home = 5;
          race(tick.boats.some((b) => b.beside && Math.abs(b.lead) <= 4) ? 3 : 1, "line");
        }
        return shot;
      }
      if (m >= target - plan.homeM) {
        if (!once.has("home")) {
          once.add("home");
          pending = owed = null;
          home = 5;
          race(5, "home");
        }
        for (const w of wants) say(w.cue);
        return shot;
      }

      /* ---- the marks along the way ----------------------------------- */
      if (m >= target / 2 && !once.has("half")) {
        once.add("half");
        wants.push({ cue: "half", pri: 50, until: now + 20 });
      }
      /* A demo row covers the water many times as fast as a clock: the
       * first stretch is set against the last far enough before the last
       * stretch for the scene to be up its time on the wall. On a real
       * monitor this is where the plan put it. */
      const lateM = Math.min(plan.lateM, target - plan.homeM - (MIN_HOLD + HOLD.curve + 2) * rate * (500 / (tick.avgPace > 0 ? tick.avgPace : 120)));
      if (lateM >= 2 * plan.seg && m >= lateM && !once.has("compare")) {
        once.add("compare");
        const a = meanOver(100, plan.seg);
        const b = meanOver(m - plan.seg, m);
        if (a && b && a.n >= 8 && b.n >= 8) wants.push({ cue: "compare", pri: 55, until: now + 20, compare: { a: a.mean, b: b.mean, aWord: `FIRST ${meters(plan.seg)} M`, bWord: `LAST ${meters(plan.seg)} M` } });
      }

      /* ---- the stroke: kicked up, let go, or pulled another way ------ */
      if (t >= cool.pace && m >= plan.settleM + 2 * plan.lap) {
        const a = secondAt(m - plan.lap);
        const b = secondAt(m - 2 * plan.lap);
        if (a !== null && b !== null) {
          const quicker = (((a - b) - (t - a)) / plan.lap) * 500;
          if (Math.abs(quicker) >= PACE_S) {
            wants.push({ cue: quicker > 0 ? "surge" : "fade", pri: 40, until: now + 6 });
            cool.pace = t + 45;
          }
        }
      }
      if (stroke && m >= shapeM) {
        const was = meanOver(Math.max(100, m - plan.recentM - plan.seg), m - plan.recentM);
        const is = meanOver(m - plan.recentM, m + BUCKET_M);
        if (was && is && was.n >= 12 && is.n >= 6) {
          const pa = Math.max(...was.mean);
          const pb = Math.max(...is.mean);
          if (shapeGap(was.mean, is.mean) >= SHAPE_GAP || (pa > 0 && Math.abs(pb / pa - 1) >= PEAK_GAP)) {
            wants.push({ cue: "shape", pri: 45, until: now + 10, compare: { a: was.mean, b: is.mean, aWord: "BEFORE", bWord: "NOW" } });
          }
        }
      }

      /* ---- which of them has the screen ------------------------------ */
      if (pending && pending.until < now) pending = null;
      if (owed && owed.until < now) owed = null;
      const free = now - shot.at >= MIN_HOLD;
      const racing = (w: Want) => w.cue === "pass" || w.cue === "passed" || w.cue === "closing";
      const inPicture = (w: Want) => racing(w) && isRace(shot) && (shot.lanes === 5 || (!!w.beside && shot.lanes === 3));
      for (const w of wants) {
        /* A cue that is already in the picture (five lanes show every
         * boat, three show the two beside the rower), or whose scene is
         * resting, is said in the page's small word and asks for no more. */
        if (inPicture(w) || (w.cue === "surge" && t < cool.solo)) say(w.cue);
        /* A mark along the way waits its turn whatever else happens: a
         * pass that takes the screen first does not take its place. */
        else if (w.cue === "half" || w.cue === "compare") owed = w;
        else if (!pending || w.pri >= pending.pri) pending = w;
      }
      const best = pending && (!owed || pending.pri > owed.pri) ? pending : owed;
      if (best) {
        if (free) {
          const w = best;
          if (w === pending) pending = null;
          else owed = null;
          if (racing(w)) {
            if (inPicture(w)) say(w.cue);
            else {
              const need: 3 | 5 = w.beside ? home : 5;
              home = need;
              race(need, w.cue);
            }
          } else if (w.cue === "half") show("wide", 5, "half");
          else if (w.cue === "shape" || w.cue === "compare") show("curve", 5, w.cue, w.compare ?? null);
          else if (w.cue === "surge") race(1, "surge");
          else if (w.cue === "fade") {
            home = 3;
            race(3, "fade");
          }
        }
        return shot;
      }

      /* ---- nothing asked for the screen ------------------------------ */
      if (passing(shot)) {
        if (now - shot.at >= holdOf(shot)) {
          /* Back from the whole course the race is three lanes: the
           * camera comes down nearer than it left. */
          if (shot.scene === "wide") home = 3;
          race(home, "back");
        }
        return shot;
      }
      if (free && m >= plan.settleM && t - changedT >= quietS) {
        /* QUIET. From five lanes the camera comes in to three. From three
         * it goes up over the whole course and comes back, then puts the
         * last stretch's curve against the one before, each only after a
         * rest and never just ahead of the mark that will put the same
         * scene up anyway; and when neither is due it lets the two edge
         * lanes back in. */
        const per = (tick.avgPace > 0 ? tick.avgPace : 120) / 500;
        const soon = (at: number) => at > m && (at - m) * per < 2 * quietS;
        /* How long, by the wall, until the last stretch takes the screen:
         * a scene that would be cut short by it is not started. */
        const room = ((target - plan.homeM - m) * per) / rate;
        const wideDue = t >= cool.wide && room >= HOLD.wide + 2 && !(soon(target / 2) && !once.has("half"));
        const curves = t >= cool.curve && room >= HOLD.curve + 2 && !(soon(plan.lateM) && !once.has("compare")) ? stretches(m) : null;
        if (home === 5) {
          home = 3;
          race(3, "quiet");
        } else if (wideDue && (turn % 2 === 0 || !curves)) {
          turn++;
          show("wide", 5, "quiet");
        } else if (curves) {
          turn++;
          show("curve", 5, "quiet", curves);
        } else {
          home = 5;
          race(5, "quiet");
        }
      }
      return shot;
    },
  };
}
