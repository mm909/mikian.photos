import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { api } from "../api";
import { DRIVE, ghostMeters, oarAngle, phaseOf, pickRivals, rowerKey, standing, type Ghost, type Ghosts } from "../erg/ghosts";
import { milestone } from "../erg/milestone";
import type { Erg } from "../erg/useErg";
import { C, F, fmtClock, fmtInt, fmtPace } from "../theme";
import { Eyebrow, Num, styles } from "../ui";

/* THE RACE: the row in progress against four rows already rowed, seen
 * from over the water (owner, 2026-11-22: "one of the screens on live
 * view"; "a line art style ... thin lines"; "a drone view"; "going to the
 * right"; "I can see myself passing them"). The monitor's first page when
 * the piece is a set distance ("let's have that be the main screen").
 *
 * FIVE LANES AND FIVE BOATS, the rower's in the middle (his second read,
 * the same night: "let's cap this animation at 5 boats. And like in 5
 * lanes. I really don't like the 3 boats in a lane look"; "let's think
 * about lanes on a track ... so that way we can put their name larger";
 * "I won't be able to see those names when I'm rowing. They're going to be
 * too small"). A lane is ruled off like a lane of a track and carries
 * whose boat is in it in type a rower can read from the seat, and how many
 * meters that boat is ahead or behind.
 *
 * WHO THE FOUR ARE (erg/ghosts.ts pickRivals): the rows that will finish
 * nearest the finish the rower is headed for, a recorded row before one
 * logged by hand ("we should prioritize people with telemetry data, and we
 * should denote that it's telemetry data ... you are literally rowing
 * against every stroke that they did"), two that finish ahead and two
 * behind where the field has them. Each lane says which it is: EVERY
 * STROKE for a recording, EVEN PACE for a row of which only the time is
 * known.
 *
 * THE CLOSEST ARE NEXT TO THE ROWER ("I need the rowers that are going to
 * be closest to me for any given period of the race to be in the lanes
 * closest to me ... if assuming A and B were on the same side, I want A to
 * be closer to me when we're neck and neck, and B ... when they're neck
 * and neck with me"). Two of the four are above the rower and two below,
 * for the whole row. Of each two, the one that will be nearer over the
 * next half minute has the lane beside the rower; when that changes they
 * trade lanes, and only while they are a boat's length apart along the
 * water, so neither rows through the other ("we can predict a nice path").
 *
 * ONE THAT IS GONE IS REPLACED ("if they fall too far behind, they can get
 * replaced by someone ... that can kind of slide in"). A boat off the
 * water for four seconds gives its lane to the best rival not yet racing
 * for the finish the rower is now on pace for, near the rower if there is
 * one, and that boat slides in from the end of the lane it is coming from.
 *
 * THE REST OF THE FIELD IS IN THE WATER, as small dots where each of those
 * rows is at this moment (he did not take to the strip of ticks under the
 * water: "it's hard to see ... a bunch of fish in the water ... fish-sized
 * dots kind of going through the water that shows the other rowers").
 *
 * FOUR FIGURES AND NO MORE: the finish the row is on pace for at the top,
 * in ink ("we're going to remove the blue here"), and under the water the
 * meters to go, the time and the average.
 *
 * EVERY BOAT LEFT THE START WITH THE ROWER. The rower's boat holds its
 * place on the screen and the water runs under it. The monitor speaks a
 * few times a second; the picture is drawn thirty times a second from
 * where the last word put the rower, carried on at the split it gave. */

const PX_PER_M = 7.2;
const BOAT_M = 8.2;
const PUDDLE_S = 2.4;
const LANES = 5;
const MID = 2;
const RIVALS = 4;
/* How long a boat is off the water before its lane is given away, and how
 * long the boat that takes it is sliding in. */
const GONE_MS = 4000;
const ENTER_MS = 1400;

type Puddle = { wm: number; y: number; born: number };
type Stroke = { phase: number; puddles: Puddle[] };
/* One of the four: the row, which side of the rower it is on for good, the
 * lane it is drawn in (between two while it changes), when it came on, and
 * since when it has been off the water. */
type Rival = { g: Ghost; side: -1 | 1; lane: number; born: number; gone: number };

/* One boat, bow to the right, as two paths: the thin lines (hull, rigger,
 * looms, the wake) and the blades. */
function boat(cx: number, cy: number, u: number, pitch: number, phase: number): { lines: string; blades: string; wet: boolean; tipDy: number } {
  const len = BOAT_M * u;
  const hb = Math.max(1.8, Math.min(3.2, 0.36 * u));
  const pinX = cx + 0.15 * u;
  const pinY = Math.max(4.5, 0.8 * u);
  const out = Math.max(8, Math.min(1.9 * u, pitch * 0.46 - pinY));
  const inb = pinY * 0.7;
  const { angle, wet } = oarAngle(phase);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const n = (v: number) => v.toFixed(1);
  let lines = `M${n(cx - len / 2)} ${n(cy)} Q${n(cx)} ${n(cy - hb * 2)} ${n(cx + len / 2)} ${n(cy)} Q${n(cx)} ${n(cy + hb * 2)} ${n(cx - len / 2)} ${n(cy)}Z`;
  lines += `M${n(pinX)} ${n(cy - pinY)} L${n(pinX)} ${n(cy + pinY)}`;
  lines += `M${n(cx - len / 2 - 1)} ${n(cy)} l${n(-0.9 * u)} ${n(-0.42 * u)} M${n(cx - len / 2 - 1)} ${n(cy)} l${n(-0.9 * u)} ${n(0.42 * u)}`;
  let blades = "";
  for (const side of [-1, 1]) {
    const hx = pinX - inb * sin;
    const hy = cy + side * (pinY - inb * cos);
    const tx = pinX + out * sin;
    const ty = cy + side * (pinY + out * cos);
    const bx = pinX + out * 0.7 * sin;
    const by = cy + side * (pinY + out * 0.7 * cos);
    lines += `M${n(hx)} ${n(hy)} L${n(bx)} ${n(by)}`;
    blades += `M${n(bx)} ${n(by)} L${n(tx)} ${n(ty)}`;
  }
  return { lines, blades, wet, tipDy: pinY + out * cos };
}

const median = (v: number[]): number => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : 0);
/* "+12", "−8", "0": meters ahead of the rower, or behind. */
const gapWord = (d: number): string => (d >= 0.5 ? `+${fmtInt(d)}` : d <= -0.5 ? `−${fmtInt(-d)}` : "0");

export function GhostRace({ erg, width, height, active }: { erg: Erg; width: number; height: number; active: boolean }) {
  const { live } = erg;
  const target = live.targetM;
  const [field, setField] = useState<Ghosts | null>(null);
  const [failed, setFailed] = useState(false);

  /* The field for this distance, asked for once as the monitor names it. */
  useEffect(() => {
    if (!(target > 0)) return;
    let on = true;
    setField(null);
    setFailed(false);
    api<Ghosts>(`/api/row100k/app/ghosts?meters=${Math.round(target)}`)
      .then((r) => on && setField(r))
      .catch(() => on && setFailed(true));
    return () => {
      on = false;
    };
  }, [target]);

  const ghosts = useMemo(() => field?.ghosts ?? [], [field]);
  /* What the rower usually does over this distance: the middle of their
   * own rows, or of the field's when they have none. The finish the four
   * are first picked for, before this row has a pace. */
  const usual = useMemo(() => median(ghosts.filter((g) => g.kind === "me").map((g) => g.seconds)) || median(ghosts.map((g) => g.seconds)), [ghosts]);

  /* Thirty frames a second while this page is the one in view. */
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last >= 32) {
        last = ts;
        setFrame((v) => (v + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  /* WHERE THE ROWER IS NOW: the monitor's last word, carried on. */
  const said = useRef({ at: 0, t: -1, m: -1 });
  const shown = useRef({ at: 0, t: 0, m: 0 });
  const strokes = useRef(new Map<string, Stroke>());
  /* How many of the monitor's seconds pass in one of the clock's: 1 on a
   * real monitor; the demo row runs faster and is carried on as fast. */
  const rate = useRef(1);
  /* Whether the handle was on the drive at the last frame, and since when. */
  const pulling = useRef({ on: false, at: 0 });
  const rivals = useRef<Rival[]>([]);
  const seeded = useRef<Ghosts | null>(null);
  const now = Date.now();
  if (live.elapsedS !== said.current.t || live.meters !== said.current.m) {
    /* A new piece on the monitor starts the picture, and the race, again. */
    if (live.meters + 5 < said.current.m) {
      shown.current = { at: now, t: live.elapsedS, m: live.meters };
      strokes.current.clear();
      seeded.current = null;
    }
    const wall = (now - said.current.at) / 1000;
    const step = live.elapsedS - said.current.t;
    if (said.current.t >= 0 && wall > 0.03 && wall < 3 && step > 0) {
      const r = step / wall;
      rate.current = r > 0.7 && r < 1.4 ? 1 : Math.min(40, rate.current + (r - rate.current) * 0.5);
    }
    said.current = { at: now, t: live.elapsedS, m: live.meters };
  }
  const moving = live.awake && !live.ended && live.pace > 0 && live.pace < 600;
  const since = Math.min(1.5, (now - said.current.at) / 1000) * rate.current;
  const wantT = said.current.t < 0 ? 0 : said.current.t + (moving ? since : 0);
  let wantM = said.current.m < 0 ? 0 : said.current.m + (moving ? (since * 500) / live.pace : 0);
  if (target > 0) wantM = Math.min(target, wantM);
  const dt = shown.current.at ? Math.min(0.25, (now - shown.current.at) / 1000) : 0;
  const ease = Math.min(1, dt * 9);
  shown.current = { at: now, t: shown.current.t + (wantT - shown.current.t) * ease, m: Math.max(0, shown.current.m + (wantM - shown.current.m) * ease) };
  const t = shown.current.t;
  const myM = shown.current.m;

  if (!(target > 0)) {
    return (
      <View style={{ width, height, justifyContent: "center" }}>
        <Eyebrow style={{ color: C.ink, marginBottom: 6 }}>The race</Eyebrow>
        <Text style={styles.body}>Set a distance on the monitor and four rows already rowed over it line up beside you: your own, and the rowers you follow.</Text>
      </View>
    );
  }

  /* THE PAGE: on its side, whose lane it is at the left of the water and
   * the meters at the right; upright, both inside the lane, over the boat. */
  const wide = width >= 520;
  const GL = wide ? 150 : 0;
  const GR = wide ? 72 : 0;
  const W = width - GL - GR;
  const TOP = wide ? 44 : 60;
  const FOOT = 60;
  const waterH = Math.max(150, height - TOP - FOOT - 10);
  const pitch = waterH / LANES;
  const drop = wide ? 0 : 9;
  const u = PX_PER_M;
  const xMe = W * 0.42;
  const xOf = (m: number) => xMe + (m - myM) * u;
  const yOf = (lane: number) => (lane + 0.5) * pitch + drop;
  const n1 = (v: number) => v.toFixed(1);
  const back = xMe / u + BOAT_M / 2;
  const front = (W - xMe) / u + BOAT_M / 2;

  /* The finish the rower is headed for: this row's own, once there is
   * 300 m of it to go on; their usual before that. */
  const ms = milestone(live);
  const near = ms && live.meters >= 300 ? ms.projected : usual;
  const speed = live.avgPace > 0 ? 500 / live.avgPace : near > 0 ? target / near : 0;
  const gapOf = (g: Ghost, at = t, mine = myM) => ghostMeters(g, target, at) - mine;

  /* THE FOUR, picked once the field is in: two above the rower and two
   * below, a quicker and a slower row on each side, the nearer finish in
   * the lane beside the rower. */
  if (seeded.current !== field && field) {
    seeded.current = field;
    strokes.current.clear();
    const four = pickRivals(ghosts, target, usual, RIVALS).sort((a, b) => a.seconds - b.seconds);
    const sides: (-1 | 1)[] = [-1, 1, -1, 1];
    rivals.current = four.map((g, i) => ({ g, side: sides[i], lane: MID, born: 0, gone: 0 }));
    for (const s of [-1, 1] as const) {
      const two = rivals.current.filter((r) => r.side === s).sort((a, b) => Math.abs(a.g.seconds - usual) - Math.abs(b.g.seconds - usual));
      two.forEach((r, i) => (r.lane = MID + s * (i + 1)));
    }
  }

  /* A boat that has been off the water for a while gives up its lane. */
  for (const r of rivals.current) {
    const d = gapOf(r.g);
    const off = d < -(back + 6) || d > front + 6;
    if (!off) {
      r.gone = 0;
      continue;
    }
    if (!r.gone) r.gone = now;
    if (now - r.gone < GONE_MS || t < 20 || target - myM < 250) continue;
    const racing = new Set(rivals.current.map((x) => rowerKey(x.g)));
    const [next] = pickRivals(ghosts, target, near, 1, racing, (g) => Math.max(0, Math.abs(gapOf(g)) - 30) * 0.25);
    /* Nobody better placed than the one that left: the lane waits. */
    if (!next || Math.abs(gapOf(next)) >= Math.abs(d)) continue;
    strokes.current.delete(r.g.id);
    r.g = next;
    r.born = now;
    r.gone = 0;
  }

  /* WHO IS BESIDE THE ROWER. Of the two on a side, the nearer over the
   * next half minute, the rower carried on at their average; a trade
   * waits until it is nearer by three meters and the two are a boat's
   * length apart along the water. */
  const soon = (g: Ghost): number => [0, 10, 20, 30].reduce((sum, a) => sum + Math.abs(gapOf(g, t + a, myM + a * speed)), 0) / 4;
  for (const s of [-1, 1] as const) {
    const two = rivals.current.filter((r) => r.side === s);
    if (two.length < 2) {
      if (two[0]) two[0].lane += (MID + s - two[0].lane) * Math.min(1, dt * 2.4);
      continue;
    }
    /* Which of the two has the lane beside the rower now. */
    let [inner, outer] = [...two].sort((a, b) => Math.abs(a.lane - MID) - Math.abs(b.lane - MID));
    if (soon(outer.g) + 3 < soon(inner.g) && Math.abs(gapOf(inner.g) - gapOf(outer.g)) >= BOAT_M * 1.15) [inner, outer] = [outer, inner];
    const step = Math.min(1, dt * 2.4);
    inner.lane += (MID + s - inner.lane) * step;
    outer.lane += (MID + 2 * s - outer.lane) * step;
    /* Arrived: on the lane, so the next look reads whole numbers. */
    if (Math.abs(inner.lane - (MID + s)) < 0.01) inner.lane = MID + s;
    if (Math.abs(outer.lane - (MID + 2 * s)) < 0.01) outer.lane = MID + 2 * s;
  }

  /* The strokes: each boat's place in its own, and the puddles its blades
   * left on the water where they came out. */
  const reach = Math.max(8, Math.min(1.9 * u, pitch * 0.46 - Math.max(4.5, 0.8 * u)));
  const tipM = (0.15 * u + reach * Math.sin(-0.62)) / u;
  const pull = (id: string, spm: number, y: number, wm: number): Stroke => {
    let s = strokes.current.get(id);
    if (!s) {
      s = { phase: phaseOf(id), puddles: [] };
      strokes.current.set(id, s);
    }
    const before = s.phase;
    /* The oars keep to a pace an eye can follow, however fast a demo runs. */
    s.phase = (before + (dt * Math.min(rate.current, 2.5) * spm) / 60) % 1;
    if (spm > 0 && before < DRIVE && (s.phase >= DRIVE || s.phase < before)) s.puddles.push({ wm: wm + tipM, y, born: now });
    s.puddles = s.puddles.filter((p) => now - p.born < PUDDLE_S * 1000);
    return s;
  };
  /* THE ROWER'S OWN OARS ARE THE ROWER'S OWN STROKE (owner, 2026-11-22:
   * "if we're gonna have a rowing animation, it needs to match with the
   * stroke that I'm pulling"). The monitor says when the handle goes on
   * the drive and when it comes off; the blades go in and come out on
   * those two words, and between them the oar is carried through at the
   * length the last stroke's drive and way back took. It waits at the
   * catch for the next pull, however long that is. */
  let mine = strokes.current.get("me");
  if (!mine) {
    mine = { phase: 0, puddles: [] };
    strokes.current.set("me", mine);
  }
  if (live.driving !== pulling.current.on) {
    if (pulling.current.on && moving) mine.puddles.push({ wm: myM + tipM, y: yOf(MID), born: now });
    pulling.current = { on: live.driving, at: now };
  }
  const held = ((now - pulling.current.at) / 1000) * rate.current;
  mine.phase = live.driving ? Math.min(0.999, held / (live.driveS > 0 ? live.driveS : 0.8)) * DRIVE : DRIVE + Math.min(0.999, held / (live.recoveryS > 0 ? live.recoveryS : 1.6)) * (1 - DRIVE);
  mine.puddles = mine.puddles.filter((p) => now - p.born < PUDDLE_S * 1000);
  const myBoat = boat(xMe, yOf(MID), u, pitch, mine.phase);

  const others = rivals.current.map((r) => {
    const d = gapOf(r.g);
    const done = t >= r.g.seconds;
    const y = yOf(r.lane);
    const s = pull(r.g.id, done || t <= 0 ? 0 : r.g.spm > 0 ? r.g.spm : 24, y, myM + d);
    /* A boat that has just been given the lane slides in from the end of
     * it that it is coming from. */
    const k = r.born ? Math.min(1, (now - r.born) / ENTER_MS) : 1;
    const edge = d < 0 ? -BOAT_M * u : W + BOAT_M * u;
    const x = edge + (xOf(myM + d) - edge) * (1 - Math.pow(1 - k, 3));
    return { r, g: r.g, d, y, s, shape: boat(x, y, u, pitch, s.phase) };
  });
  const racing = new Set(rivals.current.map((r) => r.g.id));

  /* THE WATER: the lanes ruled off, a tick every 10 m along both edges, a
   * line and its figure every 100 m, the start and the finish. */
  const fromM = myM - xMe / u;
  const toM = fromM + W / u;
  let ticks = "";
  for (let m = Math.ceil(fromM / 10) * 10; m <= toM; m += 10) {
    if (m < 0 || m > target) continue;
    ticks += `M${n1(xOf(m))} 0 v5 M${n1(xOf(m))} ${n1(waterH)} v-5`;
  }
  const hundreds: number[] = [];
  for (let m = Math.ceil(fromM / 100) * 100; m <= toM; m += 100) if (m > 0 && m < target) hundreds.push(m);
  let ropes = "";
  for (let l = 1; l < LANES; l++) ropes += `M0 ${n1(l * pitch)} H${n1(W)}`;

  /* THE REST OF THE FIELD: a dot for every other row that is within the
   * water right now, each in a place of its own up and down it. */
  const fish: { id: string; x: number; y: number; mine: boolean }[] = [];
  for (const g of ghosts) {
    if (racing.has(g.id) || fish.length >= 70) continue;
    const d = gapOf(g);
    if (d < -back || d > front) continue;
    fish.push({ id: g.id, x: xOf(myM + d), y: 6 + phaseOf(`${g.id}y`) * (waterH - 12), mine: g.kind === "me" });
  }
  const puddles = [{ id: "me", s: mine, me: true }, ...others.map((o) => ({ id: o.g.id, s: o.s, me: false }))].flatMap(({ id, s, me }) =>
    s.puddles.flatMap((p) => {
      const age = (now - p.born) / 1000 / PUDDLE_S;
      const x = xOf(p.wm);
      if (x < -12 || x > W + 12) return [];
      return [-1, 1].map((side) => ({ key: `${id}:${p.born}:${side}`, x, y: p.y + side * myBoat.tipDy, r: 1.2 + age * 3.6, o: (1 - age) * (me ? 0.8 : 0.4), me }));
    }),
  );

  const place = standing(ghosts, target, t, myM);
  const finish = live.ended ? fmtClock(live.elapsedS, false) : ms ? fmtClock(ms.projected, false) : "--:--";
  /* Three figures across: six characters of the black face run about four
   * times the type size wide, and each has a third of the width. */
  const fig = Math.min(40, Math.floor(width / 3 / 4.15));
  const who = (g: Ghost) => (g.kind === "me" ? "You" : g.name);
  const how = (g: Ghost) => `${g.kind === "race" ? "RACE DAY" : g.day} · ${g.marks.length >= 2 ? "EVERY STROKE" : "EVEN PACE"}`;

  return (
    <View style={{ width, height }}>
      {/* The finish the row is on pace for, and how the field stands. */}
      <View style={{ height: TOP, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 6 }}>
        <View style={wide ? { flexDirection: "row", alignItems: "baseline", gap: 10 } : undefined}>
          <Eyebrow style={{ color: C.ink }}>{live.ended ? "Finished in" : "On pace for"}</Eyebrow>
          <Num size={30} color={C.ink}>
            {finish}
          </Num>
        </View>
        <Eyebrow style={{ flexShrink: 1, textAlign: "right" }}>{ghosts.length ? `${place.ahead} ahead · ${place.behind} behind` : field ? "No rows over this distance yet" : failed ? "The field did not load" : "Finding the field"}</Eyebrow>
      </View>

      <View style={{ height: waterH, flexDirection: "row" }}>
        {/* WHOSE LANE, in type to be read from the seat. */}
        {wide ? (
          <View style={{ width: GL, height: waterH }}>
            <View style={{ position: "absolute", left: 0, right: 10, top: yOf(MID) - 10 }}>
              <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: 15, lineHeight: 20, color: C.accent }}>
                YOU
              </Text>
            </View>
            {others.map(({ g, y }) => (
              <View key={g.id} style={{ position: "absolute", left: 0, right: 10, top: y - 17 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 15, lineHeight: 19, color: C.ink }}>
                  {who(g)}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 9.5, lineHeight: 14, letterSpacing: 0.6, color: C.gray }}>
                  {how(g)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ width: W, height: waterH, overflow: "hidden", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.ink }}>
          <Svg width={W} height={waterH}>
            <Path d={ropes} stroke={C.line} strokeWidth={1} fill="none" />
            <Path d={ticks} stroke={C.gray} strokeWidth={1} fill="none" />
            {hundreds.map((m) => (
              <Line key={m} x1={xOf(m)} y1={0} x2={xOf(m)} y2={waterH} stroke={C.line} strokeWidth={1} strokeDasharray="2 5" />
            ))}
            {xOf(0) > -4 && xOf(0) < W + 4 ? <Line x1={xOf(0)} y1={0} x2={xOf(0)} y2={waterH} stroke={C.ink} strokeWidth={1} /> : null}
            {xOf(target) > -6 && xOf(target) < W + 6 ? (
              <>
                <Line x1={xOf(target)} y1={0} x2={xOf(target)} y2={waterH} stroke={C.ink} strokeWidth={1.5} />
                <Line x1={xOf(target) + 4} y1={0} x2={xOf(target) + 4} y2={waterH} stroke={C.ink} strokeWidth={1.5} strokeDasharray="5 5" />
              </>
            ) : null}
            {fish.map((f) => (
              <Circle key={f.id} cx={f.x} cy={f.y} r={1.7} fill={f.mine ? C.gray : C.ink} fillOpacity={f.mine ? 0.55 : 0.6} />
            ))}
            {puddles.map((p) => (
              <Circle key={p.key} cx={p.x} cy={p.y} r={p.r} stroke={p.me ? C.accent : C.gray} strokeWidth={1} strokeOpacity={p.o} fill="none" />
            ))}
            {others.map(({ g, shape }) => (
              <Path key={`l${g.id}`} d={shape.lines} stroke={C.ink} strokeWidth={1.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {others.map(({ g, shape }) => (
              <Path key={`b${g.id}`} d={shape.blades} stroke={C.ink} strokeWidth={shape.wet ? 2.6 : 1.4} fill="none" strokeLinecap="round" />
            ))}
            <Path d={myBoat.lines} stroke={C.accent} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Path d={myBoat.blades} stroke={C.accent} strokeWidth={myBoat.wet ? 3.4 : 1.8} fill="none" strokeLinecap="round" />
          </Svg>
          {hundreds.map((m) => (
            <Text key={m} style={{ position: "absolute", left: xOf(m) + 4, top: 2, fontFamily: F.mono, fontSize: 10, letterSpacing: 0.6, color: C.gray }}>
              {fmtInt(m)}
            </Text>
          ))}
          {xOf(target) > 0 && xOf(target) < W ? <Text style={{ position: "absolute", left: xOf(target) - 46, top: 2, fontFamily: F.monoBold, fontSize: 10, letterSpacing: 0.6, color: C.ink }}>FINISH</Text> : null}
          {/* Upright there is no room beside the water: the lane's words
              stand in the lane, over its boat. */}
          {wide
            ? null
            : others.map(({ g, d, r }) => (
                <View key={g.id} style={{ position: "absolute", left: 6, right: 6, top: r.lane * pitch + 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                  <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 14, color: C.ink, flexShrink: 1 }}>
                    {who(g)} <Text style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.6, color: C.gray }}>{how(g)}</Text>
                  </Text>
                  <Text style={{ fontFamily: F.black, fontSize: 16, color: C.ink, fontVariant: ["tabular-nums"] }}>{gapWord(d)}</Text>
                </View>
              ))}
          {wide ? null : <Text style={{ position: "absolute", left: 6, top: MID * pitch + 4, fontFamily: F.black, fontSize: 14, color: C.accent }}>YOU</Text>}
        </View>

        {/* How far ahead of the rower that lane's boat is, in meters. */}
        {wide ? (
          <View style={{ width: GR, height: waterH }}>
            {others.map(({ g, d, y }) => (
              <Text key={g.id} numberOfLines={1} style={{ position: "absolute", left: 6, right: 0, top: y - 14, textAlign: "right", fontFamily: F.black, fontSize: 21, lineHeight: 27, color: C.ink, fontVariant: ["tabular-nums"] }}>
                {gapWord(d)}
              </Text>
            ))}
            <Text style={{ position: "absolute", left: 6, right: 0, top: yOf(MID) - 7, textAlign: "right", fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.6, color: C.gray }}>METERS</Text>
          </View>
        ) : null}
      </View>

      <View style={{ height: FOOT + 10, flexDirection: "row", alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Meters to go</Eyebrow>
          <Num size={fig}>{fmtInt(Math.max(0, Math.ceil(target - live.meters)))}</Num>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Eyebrow>Time</Eyebrow>
          <Num size={fig}>{fmtClock(live.elapsedS, false)}</Num>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Eyebrow>Average</Eyebrow>
          <Num size={fig}>{fmtPace(live.avgPace)}</Num>
        </View>
      </View>
    </View>
  );
}
