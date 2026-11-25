import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { createDirector, planOf, resample, type Compare, type Cue, type Director, type Scene, type Shot } from "../erg/director";
import { ghostDone, ghostMeters, leadSeconds, phaseOf, type Ghost } from "../erg/ghosts";
import { useLiveRowers } from "../erg/liveRace";
import { milestone } from "../erg/milestone";
import type { Erg } from "../erg/useErg";
import { C, F, fmtClock, fmtInt, fmtPace } from "../theme";
import { Eyebrow, Num } from "../ui";
import type { Arcaded } from "../arcade/useArcade";
import { ArcadeStage } from "./ArcadeGame";
import { BEST, BOAT_M, GhostRace, MID, PX_PER_M, raceWater, type Race } from "./GhostRace";

/* THE PRODUCED ROW: a page of the monitor that is directed while the rower
 * rows (owner, 2026-11-23: "during the row, I want users to want to use our
 * app during the row ... I want to produce a screen that they're looking at
 * ... for a 5K, we get to run like a 20-minute television show"; "I want my
 * eyes to be glued to my screen while I row"; "like watching a movie").
 *
 * WHAT IS ALWAYS UP ("The stats that are always important are how many
 * meters are left, what's my average pace, and what's my ETA ... should be
 * there all the time"): those three, over every scene. On its side the
 * phone has room for the split right now and the time as well ("how fast
 * they're going, how long they're rowing, when they're going to be done,
 * what's their average pace").
 *
 * THE STAGE AND THE CURVE ("some nice like animation on the left and
 * showing their force curve on the right"): the stage is where the scenes
 * play; the stroke being pulled is drawn beside it on a phone on its side
 * and under it on one upright, over the mean of the row so far.
 *
 * WHO PICKS THE SCENE: the director (erg/director.ts), off cues in the row
 * ("I don't want it to just change like a screensaver ... I want it to
 * change a little intelligently"). The page says it is being directed: the
 * small word PRODUCED, and after it, for a few seconds, the cue that was
 * just taken ("We don't have to tell them with a bunch of words. We just
 * ... show them": one word, and the scene).
 *
 * THE SCENES ARE LAYERS OF ONE STAGE, and one fades into the next; nothing
 * is cut:
 *   the race   GhostRace.tsx, with five lanes in view, three, or the
 *              rower's own. Going from one count to another the lanes
 *              grow and the edge ones leave the water.
 *   the field  `Wide`, below. It is laid over the same water the race is
 *   from far   on and starts at the race's own scale with every boat where
 *   up         the race had it, so as the race fades the camera is seen to
 *              go up: the boats shrink and the rest of the field comes in
 *              from the edges, until all of it is on the water and the
 *              whole course is a bar along the foot. Coming back it goes
 *              down again before the race fades in.
 *   two        `Curves`: the earlier stretch in grey, the later one in the
 *   curves     blue, drawn across after it.
 *
 * A SET DISTANCE ONLY, like the race: a plain row has no meters left and
 * nobody to race, so the monitor does not offer this page for one. */

type Layer = "race" | "wide" | "curve";
const layerOf = (s: Scene): Layer => (s === "wide" ? "wide" : s === "curve" ? "curve" : "race");
const NATIVE = Platform.OS !== "web";
const FADE_MS = 420;
/* How long the camera takes to go up over the course, and to come down. */
const OUT_MS = 2200;
const IN_MS = 1500;
/* How long the page says which cue it just took. */
const WORD_MS = 7000;

/* THE DIRECTOR, held by the monitor beside the race so it has watched the
 * whole row whichever page was in view: a rower who swipes here at 3,000 m
 * finds a director that knows the first 1,000. Told where the row is four
 * times a second. */
export function useDirector(erg: Erg, race: Race): { shot: Shot | null; average: Director["average"] } {
  const d = useRef<Director | null>(null);
  if (!d.current) d.current = createDirector();
  const [shot, setShot] = useState<Shot | null>(null);
  const now = useRef(erg);
  now.current = erg;
  const rivals = race.rivals;
  const on = erg.phase === "live" && erg.live.targetM > 0;
  useEffect(() => {
    if (!on) return;
    const tick = () => {
      const l = now.current.live;
      if (!(l.targetM > 0) || !d.current) return;
      const boats = rivals.current.map((r) => ({ id: r.g.id, lead: leadSeconds(r.g, l.targetM, l.elapsedS, l.meters), beside: Math.abs(Math.round(r.lane) - MID) === 1 }));
      const next = d.current.step({ now: Date.now() / 1000, t: l.elapsedS, m: l.meters, target: l.targetM, avgPace: l.avgPace, curve: l.curve, boats, ended: l.ended });
      setShot((was) => (was === next ? was : next));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [on, rivals]);
  return { shot: on ? shot : null, average: d.current.average };
}
export type Directed = ReturnType<typeof useDirector>;

/* The one word for a cue. A scene that only came round, or went back, has
 * none. */
function wordOf(cue: Cue, target: number): string {
  const plan = planOf(target);
  switch (cue) {
    case "start":
      return "THE START";
    case "surge":
      return "PACE UP";
    case "fade":
      return "PACE DOWN";
    case "shape":
      return "YOUR STROKE CHANGED";
    case "closing":
      return "CLOSING";
    case "pass":
      return "PASS";
    case "passed":
      return "PASSED";
    case "half":
      return "HALFWAY";
    case "compare":
      return "FIRST AND LAST";
    case "home":
      return `LAST ${fmtInt(plan.homeM)} M`;
    case "line":
      return `LAST ${fmtInt(plan.lineM)} M`;
    case "finish":
      return "FINISHED";
    default:
      return "";
  }
}

/* A GAME TAKES THE STAGE (owner, 2026-11-24: "the director drops into a
 * row" a game of the arcade, screens/ArcadeGame.tsx): `arcade` is set while
 * one is up. The figures stay; the race goes on under the game, unseen, so
 * it is where it should be when the chest closes. */
export function Produced({ erg, race, directed, width, height, active, arcade = null }: { erg: Erg; race: Race; directed: Directed; width: number; height: number; /* The page in view. */ active: boolean; arcade?: Arcaded | null }) {
  const game = !!arcade?.id;
  const { live } = erg;
  const target = live.targetM;
  const wide = width >= 520;
  const shot = directed.shot;
  const scene: Scene = shot?.scene ?? "lanes";
  const want = layerOf(scene);

  /* WHICH LAYERS ARE ON THE STAGE, and how much of each shows. A layer is
   * drawn only while it is showing or on its way in or out: the race and
   * the whole course each draw thirty times a second. */
  const [on, setOn] = useState<Record<Layer, boolean>>({ race: want === "race", wide: want === "wide", curve: want === "curve" });
  const o = useRef({ race: new Animated.Value(want === "race" ? 1 : 0), wide: new Animated.Value(want === "wide" ? 1 : 0), curve: new Animated.Value(want === "curve" ? 1 : 0) }).current;
  /* The camera over the whole course: when it last set off, which way, and
   * how far up it was then (0 on the water, 1 over the whole course). */
  const [zoom, setZoom] = useState({ at: 0, dir: 1 as 1 | -1, from: want === "wide" ? 1 : 0 });
  const zNow = useRef(want === "wide" ? 1 : 0);
  const showing = useRef<Layer>(want);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  useEffect(() => {
    const from = showing.current;
    if (from === want) return;
    showing.current = want;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const fade = (to: Layer, after = 0) => {
      const go = () => {
        setOn((v) => ({ ...v, [to]: true }));
        for (const k of ["race", "wide", "curve"] as Layer[]) Animated.timing(o[k], { toValue: k === to ? 1 : 0, duration: FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }).start();
        timers.current.push(setTimeout(() => setOn({ race: to === "race", wide: to === "wide", curve: to === "curve" }), FADE_MS + 80));
      };
      if (after > 0) timers.current.push(setTimeout(go, after));
      else go();
    };
    if (want === "wide") {
      /* Out of the race the camera starts on the water and goes up. Out
       * of the curves it is up already. */
      const z0 = from === "race" ? 0 : 1;
      zNow.current = z0;
      setZoom({ at: Date.now(), dir: 1, from: z0 });
      fade("wide");
    } else if (from === "wide" && want === "race") {
      /* Back to the race the camera comes down first, and the race fades
       * in over the last of it. */
      const z0 = zNow.current;
      setZoom({ at: Date.now(), dir: -1, from: z0 });
      fade("race", Math.max(0, IN_MS * z0 - FADE_MS));
    } else fade(want);
    // `o` and the refs are the same for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);

  /* ---- the figures that are always up -------------------------------- */
  const ms = milestone(live);
  const clock = (s: number) => fmtClock(s, false);
  const left = fmtInt(Math.max(0, Math.ceil(target - live.meters)));
  const avg = fmtPace(live.avgPace);
  const finish = live.ended ? clock(live.elapsedS) : ms ? clock(ms.projected) : "--:--";
  const nowPace = live.pace > 0 && live.pace < 600 ? clock(live.pace) : "-:--";
  const time = clock(live.elapsedS);

  /* The word after PRODUCED: the cue just taken, for a few seconds. */
  const said = game ? "ARCADE · 159" : shot && Date.now() - shot.note.at * 1000 < WORD_MS ? wordOf(shot.note.cue, target) : "";
  /* Upright the two are on one line over the figures; on its side they are
   * one over the other at the head of the column the curve is in, which
   * is too narrow for YOUR STROKE CHANGED after PRODUCED. */
  const label = (
    <View style={wide ? { height: 32 } : { flexDirection: "row", alignItems: "baseline", columnGap: 10 }}>
      <Text style={{ fontFamily: F.monoBold, fontSize: 11, lineHeight: 15, letterSpacing: 2.2, color: C.ink }}>PRODUCED</Text>
      {said ? (
        <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 11, lineHeight: 15, letterSpacing: 2.2, color: C.accent, flexShrink: 1 }}>
          {said}
        </Text>
      ) : null}
    </View>
  );

  /* ---- where everything is -------------------------------------------- */
  const PAD = wide ? 16 : 20;
  /* On its side: the five figures across the top, the stage under them at
   * the left and the curve at the right. Upright: the word, the three
   * figures, the stage, and the curve with the split and the time under
   * it. */
  const figN = wide ? 5 : 3;
  const fig = Math.min(wide ? 44 : 40, Math.floor((width - PAD * 2) / figN / 4.15));
  const STRIP = Math.round(fig * 1.12) + 18;
  const LABEL = wide ? 0 : 22;
  const SIDE = wide ? Math.round(Math.max(190, Math.min(260, width * 0.28))) : 0;
  const UNDER = wide ? 0 : Math.round(Math.max(96, Math.min(128, height * 0.2)));
  const stageW = width - SIDE;
  const stageH = Math.max(160, height - LABEL - STRIP - UNDER);

  const cell = (k: string, v: string, color: string, align: "flex-start" | "center" | "flex-end") => (
    <View style={{ flex: 1, alignItems: align }}>
      <Eyebrow>{k}</Eyebrow>
      <Num size={fig} color={color}>
        {v}
      </Num>
    </View>
  );
  const strip = (
    <View style={{ height: STRIP, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: PAD, columnGap: 8 }}>
      {cell("Meters left", left, C.ink, "flex-start")}
      {cell("Average pace", avg, C.accent, wide ? "flex-start" : "center")}
      {cell("Finish", finish, C.ink, wide ? "flex-start" : "flex-end")}
      {wide ? cell("Current pace", nowPace, C.ink, "flex-start") : null}
      {wide ? cell("Time", time, C.ink, "flex-end") : null}
    </View>
  );

  const avgCurve = directed.average();
  const stage = (
    <View style={{ width: stageW, height: stageH, overflow: "hidden" }}>
      {/* The race is always on the stage, under whatever else is: it is
          what says who has a lane, so it is kept going (at the monitor's
          own few words a second) while another scene is up, and drawn
          thirty times a second only while it shows. */}
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: stageW, height: stageH, opacity: o.race }}>
        <GhostRace erg={erg} width={stageW} height={stageH} race={race} drive={active} active={active && on.race && !game} bare lanes={shot && scene !== "wide" && scene !== "curve" ? shot.lanes : 5} />
      </Animated.View>
      {on.wide ? (
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: stageW, height: stageH, opacity: o.wide }}>
          <Wide erg={erg} race={race} width={stageW} height={stageH} zoom={zoom} zNow={zNow} active={active && !game} />
        </Animated.View>
      ) : null}
      {on.curve ? (
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: stageW, height: stageH, opacity: o.curve, transform: [{ scale: o.curve.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
          {shot?.compare ? <Curves compare={shot.compare} width={stageW} height={stageH} pad={PAD} /> : null}
        </Animated.View>
      ) : null}
      {game && arcade ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: stageW, height: stageH, backgroundColor: C.paper }}>
          <ArcadeStage arcade={arcade} erg={erg} width={stageW} height={stageH} active={active} />
        </View>
      ) : null}
    </View>
  );

  if (wide) {
    return (
      <View style={{ width, height }}>
        {strip}
        <View style={{ flexDirection: "row" }}>
          {stage}
          <View style={{ width: SIDE, height: stageH, paddingLeft: 14, paddingRight: PAD, paddingTop: 6 }}>
            {label}
            <Stroke curve={live.curve} mean={avgCurve} width={SIDE - 14 - PAD} height={Math.max(60, stageH - 6 - 32 - 42)} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Eyebrow>Strokes a minute</Eyebrow>
              <Num size={26}>{live.spm > 0 ? `${live.spm}` : "--"}</Num>
            </View>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={{ width, height }}>
      <View style={{ height: LABEL, paddingHorizontal: PAD, justifyContent: "flex-end" }}>{label}</View>
      {strip}
      {stage}
      <View style={{ height: UNDER, flexDirection: "row", paddingHorizontal: PAD, paddingTop: 8, columnGap: 16 }}>
        <Stroke curve={live.curve} mean={avgCurve} width={Math.round((width - PAD * 2 - 16) * 0.58)} height={UNDER - 12} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Eyebrow>Now</Eyebrow>
            <Num size={34}>{nowPace}</Num>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1, borderColor: C.line }}>
            <Eyebrow>Time</Eyebrow>
            <Num size={28}>{time}</Num>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ---- a curve as a line -------------------------------------------------- */

/* Points across a box, joined through the middle of each pair so the line
 * bends and does not corner. `close` brings it down to the foot at both
 * ends, for a shape to fill. */
function lineOf(pts: number[], w: number, h: number, top: number, close = false): string {
  const n = pts.length;
  if (n < 2 || !(top > 0)) return "";
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => h - Math.max(0, Math.min(1, v / top)) * (h - 3) - 1;
  let d = `M${x(0).toFixed(1)} ${y(pts[0]).toFixed(1)}`;
  for (let i = 1; i < n - 1; i++) d += ` Q${x(i).toFixed(1)} ${y(pts[i]).toFixed(1)} ${((x(i) + x(i + 1)) / 2).toFixed(1)} ${((y(pts[i]) + y(pts[i + 1])) / 2).toFixed(1)}`;
  d += ` L${x(n - 1).toFixed(1)} ${y(pts[n - 1]).toFixed(1)}`;
  return close ? `${d} L${w.toFixed(1)} ${h} L0 ${h}Z` : d;
}

/* THE STROKE BEING PULLED, over the mean of the row so far: the grey shape
 * is what the rower's stroke has been, the blue line the one just pulled.
 * Both to one height, the tallest peak of the row. */
function Stroke({ curve, mean, width, height }: { curve: number[]; mean: { mean: number[]; peak: number } | null; width: number; height: number }) {
  const mine = useMemo(() => (curve.length >= 6 ? resample(curve) : null), [curve]);
  const top = Math.max(mean?.peak ?? 0, mine ? Math.max(...mine) : 0, 1) * 1.06;
  return (
    <View style={{ width, height, marginVertical: 4 }}>
      <Svg width={width} height={height}>
        {mean ? <Path d={lineOf(mean.mean, width, height, top, true)} fill={C.gray} fillOpacity={0.22} stroke={C.gray} strokeWidth={1.2} /> : null}
        {mine ? <Path d={lineOf(mine, width, height, top)} stroke={C.accent} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
        <Line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke={C.ink} strokeWidth={1} />
      </Svg>
      {!mine ? <Eyebrow style={{ position: "absolute", left: 0, bottom: 8 }}>Your stroke draws here</Eyebrow> : null}
    </View>
  );
}

/* TWO CURVES, ONE OVER THE OTHER ("show them the force curve for the last
 * 1,000 ... versus the last 1,000. Or near the end ... here's what it was
 * the first 1,000, here's what it was this last 1,000"). The earlier
 * stretch is the grey shape; the later is the blue line, drawn across
 * after it so the eye sees which came second. Each is named by its
 * stretch and nothing else is said. */
function Curves({ compare, width, height, pad }: { compare: Compare; width: number; height: number; pad: number }) {
  const w = width - pad * 2;
  const HEAD = 34;
  const h = Math.max(80, height - HEAD - 18);
  const top = Math.max(...compare.a, ...compare.b, 1) * 1.06;
  /* The later curve comes across in a little under a second. */
  const across = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    across.setValue(0);
    Animated.timing(across, { toValue: 1, duration: 900, delay: FADE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [compare, across]);
  const key = (color: string, word: string, line: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", columnGap: 8 }}>
      <View style={{ width: 22, height: line ? 4 : 12, backgroundColor: color, opacity: line ? 1 : 0.4 }} />
      <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: width >= 520 ? 18 : 15, letterSpacing: 0.8, color: line ? C.accent : C.ink }}>
        {word}
      </Text>
    </View>
  );
  return (
    <View style={{ width, height, paddingHorizontal: pad, paddingTop: 8 }}>
      <View style={{ height: HEAD - 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        {key(C.gray, compare.aWord, false)}
        {key(C.accent, compare.bWord, true)}
      </View>
      <View style={{ width: w, height: h }}>
        <Svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
          <Path d={lineOf(compare.a, w, h, top, true)} fill={C.gray} fillOpacity={0.24} stroke={C.gray} strokeWidth={2} />
          <Line x1={0} y1={h - 0.5} x2={w} y2={h - 0.5} stroke={C.ink} strokeWidth={1} />
        </Svg>
        <Animated.View style={{ position: "absolute", left: 0, top: 0, height: h, overflow: "hidden", width: across.interpolate({ inputRange: [0, 1], outputRange: [0, w] }) }}>
          <Svg width={w} height={h}>
            <Path d={lineOf(compare.b, w, h, top)} stroke={C.accent} strokeWidth={4.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>
      <Eyebrow style={{ marginTop: 4 }}>Your force through the stroke</Eyebrow>
    </View>
  );
}

/* ---- the whole course ---------------------------------------------------- */

const smooth = (x: number): number => {
  const v = Math.max(0, Math.min(1, x));
  return v * v * (3 - 2 * v);
};
/* A hull seen from over the water, bow to the right. */
const hull = (x: number, y: number, len: number, beam: number): string => `M${(x - len / 2).toFixed(1)} ${y.toFixed(1)} Q${x.toFixed(1)} ${(y - beam * 2).toFixed(1)} ${(x + len / 2).toFixed(1)} ${y.toFixed(1)} Q${x.toFixed(1)} ${(y + beam * 2).toFixed(1)} ${(x - len / 2).toFixed(1)} ${y.toFixed(1)}Z`;

/* THE FIELD, FROM FAR UP ("one animation is the zooming out of that race
 * screen ... you could see other dots for other live rowers ... very faint
 * dots of everyone's row and where they're at during this 5K ... people who
 * are racing live ... have little boats ... then maybe it zooms in again").
 * Every row in the field is a dot where it is at this second of its own
 * row; a row that has finished is off the picture ("would just get off the
 * screen"). The four in the lanes and anybody on the water this minute are
 * small boats, the live ones in the monitor's green; the rower's best is
 * the red one; the rower's own is the blue one.
 *
 * HOW FAR UP. Everybody left the start with the rower, so at any second
 * the whole field is on a few hundred meters of the course: seen from over
 * all 5,000 m it is one thin column of dots (the first cut, and that is
 * what it looked like). So the camera goes up until THE FIELD fills the
 * water, the slowest row at the left edge and the quickest at the right,
 * and the whole course is the bar along the foot of it: the blue is what
 * the rower has covered, the box is the stretch of course on the screen,
 * the tick is half way. The meters over the water say how wide the shot
 * is.
 *
 * THE CAMERA. `z` runs from 0, on the water at the race's own scale with
 * the rower where the race holds them, to 1, the field from edge to edge.
 * The scale goes between the two by equal ratios, as a lens does, and only
 * along the course: across it the lanes stay where they are. It is worked
 * out on every frame here, as the race is, because what moves is where a
 * hundred things are drawn; the fade between the layers is the phone's own
 * animation. */
function Wide({ erg, race, width, height, zoom, zNow, active }: { erg: Erg; race: Race; width: number; height: number; zoom: { at: number; dir: 1 | -1; from: number }; zNow: MutableRefObject<number>; active: boolean }) {
  const { live } = erg;
  const target = live.targetM;
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
  const liveNow = useLiveRowers();
  const ghosts = useMemo(() => race.field?.ghosts ?? [], [race.field]);
  const best = useMemo(() => ghosts.filter((g) => g.kind === "me").sort((a, b) => a.seconds - b.seconds)[0] ?? null, [ghosts]);

  const now = Date.now();
  const k = zoom.at ? (now - zoom.at) / (zoom.dir > 0 ? OUT_MS : IN_MS * Math.max(0.3, zoom.from)) : 1;
  const z = zoom.dir > 0 ? zoom.from + (1 - zoom.from) * smooth(k) : zoom.from * (1 - smooth(k));
  zNow.current = z;

  /* Where the rower is: where the race last put them, carried on. */
  const sh = race.shown.current;
  const moving = live.awake && !live.ended && live.pace > 0 && live.pace < 600;
  const since = moving && sh.at ? Math.min(1.5, (now - sh.at) / 1000) * race.rate.current : 0;
  const t = race.lineAt.current !== null ? Math.min(sh.t + since, race.lineAt.current) : sh.t + since;
  const myM = Math.min(target, sh.m + (moving ? (since * 500) / live.pace : 0));

  const box = raceWater(width, height);
  const H = box.h;
  const W = width;
  const EDGE = 22;
  const racing = race.rivals.current;
  /* The stretch of the course the field is on: all but the few rows far
   * off either end of it, the boats in the lanes and the rower always, and
   * never less than a few hundred meters, so it is a wide shot from the
   * first stroke. Eased from frame to frame: rows finish and leave it. */
  const at: number[] = [];
  for (const g of ghosts) if (!ghostDone(g, t)) at.push(ghostMeters(g, target, t));
  at.sort((a, b) => a - b);
  const part = (q: number) => at[Math.min(at.length - 1, Math.round(q * (at.length - 1)))];
  let lo = at.length ? Math.min(myM, part(0.05)) : myM;
  let hi = at.length ? Math.max(myM, part(0.95)) : myM;
  for (const g of [...racing.map((r) => r.g), ...liveNow]) {
    if (ghostDone(g, t)) continue;
    const m = ghostMeters(g, target, t);
    if (Math.abs(m - myM) > 600) continue;
    lo = Math.min(lo, m);
    hi = Math.max(hi, m);
  }
  const least = Math.max(260, target * 0.05);
  const pad = Math.max((least - (hi - lo)) / 2, (hi - lo) * 0.07);
  lo = Math.max(-12, lo - pad);
  hi = Math.min(target + 12, Math.max(lo + least, hi + pad));
  const span = useRef<{ lo: number; hi: number } | null>(null);
  span.current = span.current && Math.abs(span.current.lo - lo) < 2000 ? { lo: span.current.lo + (lo - span.current.lo) * 0.08, hi: span.current.hi + (hi - span.current.hi) * 0.08 } : { lo, hi };
  lo = span.current.lo;
  hi = span.current.hi;
  const far = (W - EDGE * 2) / Math.max(1, hi - lo);
  const u = Math.exp(Math.log(PX_PER_M) + (Math.log(far) - Math.log(PX_PER_M)) * z);
  const ax = box.xMe + (EDGE + (myM - lo) * far - box.xMe) * z;
  const X = (m: number) => ax + (m - myM) * u;
  /* The whole course, along the foot of the water. */
  const BAR = 30;
  const barY = H - 13;
  const cx = (m: number) => EDGE + (Math.max(0, Math.min(target, m)) / Math.max(1, target)) * (W - EDGE * 2);
  const pitch = (H - BAR * z) / 5;
  const drop = W >= 520 ? 0 : pitch * 0.12 * (1 - z);
  const laneY = (lane: number) => (lane + 0.5) * pitch + drop;
  const inX = (x: number) => x > -6 && x < W + 6;

  /* The lines across the water and the meters over it: as far apart as
   * reads at this height. */
  const stepFor = (min: number) => [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].find((s) => s >= 100 * (1 - z) && s * u >= min) ?? 100000;
  const lineStep = stepFor(30);
  const wordStep = stepFor(84);
  const fromM = Math.max(0, myM - ax / u);
  const toM = Math.min(target, myM + (W - ax) / u);
  const lines: number[] = [];
  for (let m = Math.ceil(fromM / lineStep) * lineStep; m <= toM; m += lineStep) if (m > 0 && m < target) lines.push(m);

  const taken = new Set(racing.map((r) => r.g.id));
  /* Across the water the dots keep clear of the bar as it comes up. */
  const dotY = (id: string) => 6 + phaseOf(`${id}y`) * (H - 12 - BAR * z);
  const dots: { id: string; x: number; y: number; mine: boolean }[] = [];
  const boats: { id: string; x: number; y: number; color: string; len: number }[] = [];
  const lenOf = (min: number) => Math.max(min, BOAT_M * u);
  for (const g of ghosts) {
    if (taken.has(g.id) || g === best || ghostDone(g, t)) continue;
    const x = X(ghostMeters(g, target, t));
    if (inX(x)) dots.push({ id: g.id, x, y: dotY(g.id), mine: g.kind === "me" });
  }
  for (const g of liveNow) {
    if (taken.has(g.id) || ghostDone(g, t)) continue;
    const x = X(ghostMeters(g, target, t));
    if (inX(x)) boats.push({ id: g.id, x, y: dotY(g.id), color: C.good, len: lenOf(13) });
  }
  for (const r of racing) {
    if (ghostDone(r.g, t) && t > 0) continue;
    const x = X(ghostMeters(r.g, target, t));
    if (inX(x)) boats.push({ id: r.g.id, x, y: laneY(r.lane), color: r.g.kind === "live" ? C.good : C.ink, len: lenOf(r.g.kind === "live" ? 13 : 10) });
  }
  if (best && t > 0 && !ghostDone(best, t)) {
    const x = X(ghostMeters(best, target, t));
    if (inX(x)) boats.push({ id: `best:${best.id}`, x, y: laneY(MID), color: BEST, len: lenOf(12) });
  }
  const beam = Math.max(1.3, Math.min(3.2, 0.36 * u));
  const xMe = X(myM);
  const meLen = lenOf(20);
  const word = (m: number, text: string, left: number) => (
    <Text key={text} numberOfLines={1} style={{ position: "absolute", left, bottom: 0, fontFamily: F.monoBold, fontSize: W >= 520 ? 15 : 16, lineHeight: 20, letterSpacing: text === "FINISH" ? 0.6 : 0, color: C.ink, fontVariant: ["tabular-nums"] }}>
      {text}
    </Text>
  );
  return (
    <View style={{ width, height }}>
      <View style={{ height: box.top, overflow: "hidden" }}>
        {lines.filter((m) => m % wordStep === 0 && X(target) - X(m) > 120).map((m) => word(m, fmtInt(m), X(m) + 5))}
        {inX(X(target)) || X(target) < W + 70 ? word(target, "FINISH", X(target) - 72) : null}
      </View>
      <View style={{ width: W, height: H, overflow: "hidden", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.ink }}>
        <Svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {lines.map((m) => (
            <Line key={m} x1={X(m)} y1={0} x2={X(m)} y2={H} stroke={C.line} strokeWidth={1} strokeDasharray="2 5" />
          ))}
          {inX(X(0)) ? <Line x1={X(0)} y1={0} x2={X(0)} y2={H} stroke={C.ink} strokeWidth={1} /> : null}
          {inX(X(target)) ? (
            <>
              <Line x1={X(target)} y1={0} x2={X(target)} y2={H} stroke={C.ink} strokeWidth={1.5} />
              <Line x1={X(target) + 4} y1={0} x2={X(target) + 4} y2={H} stroke={C.ink} strokeWidth={1.5} strokeDasharray="5 5" />
            </>
          ) : null}
          {dots.map((d) => (
            <Circle key={d.id} cx={d.x} cy={d.y} r={1.7 + 0.5 * z} fill={d.mine ? C.gray : C.ink} fillOpacity={0.6 - 0.22 * z} />
          ))}
          {boats.map((b) => (
            <Path key={b.id} d={hull(b.x, b.y, b.len, beam)} stroke={b.color} strokeWidth={1.3} fill={b.color} fillOpacity={0.85 * z} strokeLinejoin="round" />
          ))}
          <Path d={hull(xMe, laneY(MID), meLen, Math.max(2.2, beam))} stroke={C.accent} strokeWidth={1.8} fill={C.accent} fillOpacity={z} strokeLinejoin="round" />
          {/* THE WHOLE COURSE, as the camera goes up: what the rower has
              covered in the blue, the stretch on the screen boxed, half
              way ticked, the finish at its end. */}
          <Line x1={EDGE} y1={barY} x2={W - EDGE} y2={barY} stroke={C.gray} strokeWidth={2} strokeOpacity={0.7 * z} />
          <Line x1={EDGE} y1={barY} x2={cx(myM)} y2={barY} stroke={C.accent} strokeWidth={4} strokeOpacity={z} />
          <Line x1={cx(target / 2)} y1={barY - 6} x2={cx(target / 2)} y2={barY + 6} stroke={C.ink} strokeWidth={1.5} strokeOpacity={z} />
          <Line x1={W - EDGE} y1={barY - 8} x2={W - EDGE} y2={barY + 8} stroke={C.ink} strokeWidth={2} strokeOpacity={z} />
          <Line x1={EDGE} y1={barY - 8} x2={EDGE} y2={barY + 8} stroke={C.ink} strokeWidth={1.5} strokeOpacity={z} />
          <Path d={`M${cx(lo).toFixed(1)} ${barY - 8} H${Math.max(cx(lo) + 6, cx(hi)).toFixed(1)} V${barY + 8} H${cx(lo).toFixed(1)}Z`} stroke={C.ink} strokeWidth={1} strokeOpacity={0.55 * z} fill={C.ink} fillOpacity={0.06 * z} />
          <Circle cx={cx(myM)} cy={barY} r={5} fill={C.accent} fillOpacity={z} />
        </Svg>
      </View>
    </View>
  );
}
