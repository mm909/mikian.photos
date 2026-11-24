import { useRef, type ReactElement } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { BOAT_H, BOAT_W, BoatArt, useWallClock } from "../arcade/BoatArt";
import { Briefcase, DOT_ON, FlipDots, Hazard, dotClock } from "../arcade/Art159";
import { ChestOpen } from "../arcade/Chest";
import { FLIGHT_S, SEG_M, SHOTS, TITLE_159_S, TITLE_MAX_M, TITLE_S, rockAngle, type Rock, type View159 } from "../arcade/game159";
import { useLocker } from "../arcade/locker";
import { prng } from "../arcade/rng";
import { wear } from "../arcade/skins";
import type { Arcaded } from "../arcade/useArcade";
import type { Erg } from "../erg/useErg";
import { C, F, fmtClock, fmtInt, fmtPace } from "../theme";
import { Eyebrow, Num } from "../ui";
import { BEST } from "./GhostRace";

/* THE GAME ON THE MONITOR (owner, 2026-11-24: "159"; arcade/game159.ts is
 * the game, this is how it looks). Two ways it shows while a game is up:
 *
 *   on the produced page   it takes the stage, under the page's own
 *                          figures (Produced.tsx);
 *   on any other page      it is laid over the page (ArcadeOverlay), with
 *                          the four figures a rower reads from the seat
 *                          across its top: the split now, the average, the
 *                          meters and the time. The page under it is back
 *                          as the chest closes.
 *
 * READ FROM THE SEAT, three to six feet away (the owner's rule for the
 * monitor, 2026-11-22): every word the game says is in the black face and
 * big, and nothing has to be read to play. The pace is the only control.
 *
 * Drawn thirty times a second off the wall's clock, from the view the
 * arcade hands over in a ref (arcade/useArcade.ts). */

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const easeBack = (x: number) => {
  const v = clamp(x);
  return 1 + 2.2 * (v - 1) ** 3 + 1.2 * (v - 1) ** 2;
};

/* WHERE THE ROWER IS IN THEIR STROKE, for the oars of the game's boat. On a
 * monitor it is set off each catch the monitor reports (live.driving),
 * stroke by stroke; a demo row strokes ten times as fast as a clock, which
 * no eye follows, so its boat rows a steady 26 by the wall. */
function useStrokePhase(erg: Erg, t: number): number {
  const s = useRef({ was: false, at: t, period: 2.3 });
  const l = erg.live;
  if (erg.demo) return (t * 26) / 60;
  if (l.driving && !s.current.was) {
    const gap = t - s.current.at;
    if (gap > 0.8) {
      if (gap < 4.5) s.current.period = gap;
      s.current.at = t;
    }
  }
  s.current.was = l.driving;
  const since = t - s.current.at;
  return since / s.current.period > 1.6 ? since / (l.spm > 0 ? 60 / l.spm : 2.3) : since / s.current.period;
}

/* ---- the stage -------------------------------------------------------- */

export function ArcadeStage({ arcade, erg, width, height, active }: { arcade: Arcaded; erg: Erg; width: number; height: number; active: boolean }) {
  const t = useWallClock(active);
  const locker = useLocker();
  const phase = useStrokePhase(erg, t);
  const wob = useRef(0);
  const v = arcade.view.current;
  if (!v) return null;
  const target = v.phase === "play" ? v.wobble : v.phase === "result" && !v.won ? 0.6 : 0;
  wob.current += (target - wob.current) * 0.12;
  const paint = wear(locker.equipped);
  if (v.phase === "title") return <Title v={v} erg={erg} t={t} width={width} height={height} />;
  if (v.phase === "reward" && v.chest) return <ChestOpen chest={v.chest} at={v.since} t={t} width={width} height={height} won={!!v.won} />;
  if (v.phase === "play" || v.phase === "result") return <Play v={v} erg={erg} t={t} width={width} height={height} paint={paint} phase={phase} wobble={wob.current} />;
  return null;
}

/* ---- the title card ---------------------------------------------------- */

function Title({ v, erg, t, width, height }: { v: View159; erg: Erg; t: number; width: number; height: number }) {
  const e = t - v.since;
  const wide = width >= 520;
  const k = Math.max(e / TITLE_S, (erg.live.meters - v.startM) / TITLE_MAX_M);
  const morph = e >= TITLE_159_S;
  const pace = v.needle || erg.live.pace;
  const BAND = 30;
  const room = height - BAND - 16;
  const caseW = wide ? Math.min(width * 0.3, room * 0.9 / 0.78) : Math.min(width * 0.44, (room * 0.3) / 0.78);
  const dotsW = wide ? Math.min(width * 0.52, 420) : Math.min(width - 40, 380);
  const head = morph ? "LOCK IN YOUR PACE" : "GAME: 159";
  /* The black face runs about three quarters of its size a letter, and a
   * phone's browser will not shrink a line to fit: it is cut to fit here. */
  const textW = wide ? width - caseW - 54 : width - 32;
  const headSize = Math.min(wide ? 36 : 34, Math.floor(textW / (head.length * 0.74)));
  const words = (
    <View style={{ alignItems: wide ? "flex-start" : "center", width: textW }}>
      <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: headSize, lineHeight: Math.round(headSize * 1.15), color: C.ink, letterSpacing: 0.5 }}>
        {head}
      </Text>
      <Text style={{ fontFamily: F.monoBold, fontSize: 13, lineHeight: 19, letterSpacing: 1.2, color: C.soft, marginTop: 2, textAlign: wide ? "left" : "center" }}>{morph ? "THE PACE YOU ARE ROWING · A SHOT EVERY 50 M" : "FOUR SHOTS · 200 M · ONE PACE"}</Text>
      <View style={{ width: wide ? dotsW : Math.min(width - 40, 380), height: 8, backgroundColor: C.line, marginTop: 12 }}>
        <View style={{ width: `${Math.round(clamp(k) * 100)}%`, height: 8, backgroundColor: C.ink }} />
      </View>
    </View>
  );
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <View style={{ height: BAND, justifyContent: "center" }}>
        <Hazard width={width} height={BAND} t={t} />
        <View style={{ position: "absolute", alignSelf: "center", backgroundColor: DOT_ON, paddingHorizontal: 10 }}>
          <Text style={{ fontFamily: F.black, fontSize: 16, letterSpacing: 2, color: "#111111" }}>GAME INCOMING</Text>
        </View>
      </View>
      {wide ? (
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, columnGap: 22 }}>
          <Briefcase width={caseW} pop={easeBack(e / 0.5)} t={t} />
          <View style={{ rowGap: 12 }}>
            <FlipDots text={morph ? dotClock(pace) : "1:59"} width={dotsW} t={t} />
            {words}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "space-evenly", paddingHorizontal: 20 }}>
          <Briefcase width={caseW} pop={easeBack(e / 0.5)} t={t} />
          <FlipDots text={morph ? dotClock(pace) : "1:59"} width={dotsW} t={t} />
          {words}
        </View>
      )}
    </View>
  );
}

/* ---- the field ----------------------------------------------------------- */

/* A rock's outline, out of its own seed: nine corners, each its own way
 * out, turning slowly. */
function rockPath(k: Rock, x: number, y: number, R: number, t: number): string {
  const r = prng(k.seed);
  const n = 9;
  const turn = k.spin * (t - k.born);
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2;
    const rr = R * (0.72 + r() * 0.36);
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `${d}Z`;
}

function Play({ v, erg, t, width, height, paint, phase, wobble }: { v: View159; erg: Erg; t: number; width: number; height: number; paint: ReturnType<typeof wear>; phase: number; wobble: number }) {
  const wide = width >= 520;
  const e = t - v.since;
  const HEAD = wide ? 66 : 68;
  const GAUGE = wide ? 58 : 72;
  const HINT = height >= 420 ? 46 : 0;
  const fw = width;
  const fh = Math.max(110, height - HEAD - GAUGE - HINT);
  const cx = fw / 2;
  const cy = fh / 2;
  const unit = Math.min(fw, fh);
  const sizeOf = (s: 1 | 2 | 3) => unit * (s === 3 ? 0.12 : s === 2 ? 0.085 : 0.06);
  const lose = v.phase === "result" && !v.won;
  /* The rocks come in on the boat when it has lost. */
  const inK = lose ? clamp(e / 0.9) : 0;
  const posOf = (k: Rock, at: number) => {
    const a = rockAngle(k, at);
    const r = k.r * (1 - inK * 0.92);
    return { x: cx + Math.cos(a) * r * (fw / 2 - sizeOf(k.size) - 4), y: cy + Math.sin(a) * r * (fh / 2 - sizeOf(k.size) - 4) };
  };
  const shown = v.rocks.filter((k) => t >= k.born && (k.dies === null || t < k.dies));
  /* The boat, in the middle. */
  const bw = Math.min(fw * 0.56, ((fh * 0.56) * BOAT_W) / BOAT_H);
  const bh = (bw * BOAT_H) / BOAT_W;
  const gun = { x: cx, y: cy - bh * 0.05 };
  const blown = lose && e >= 0.9;

  /* The last shot, for a moment: its word and its flight. */
  const last = v.shots[v.shots.length - 1];
  const fresh = last && t - last.at < 1.5 ? last : null;
  const shotWord = fresh ? (fresh.hit ? "HIT" : fresh.lucky ? "LUCKY!" : "MISS") : "";
  const left = Math.max(0, Math.ceil(SEG_M - v.segM));

  const bullets: ReactElement[] = [];
  const bursts: ReactElement[] = [];
  for (const s of v.shots) {
    const k = (t - s.at) / FLIGHT_S;
    const tgt = v.rocks.find((r) => r.id === s.target);
    if (!tgt) continue;
    const end = posOf(tgt, s.at + FLIGHT_S);
    /* A miss goes wide of the rock and on out of the picture. */
    const aim = s.hit || s.lucky ? end : { x: end.x + (end.y - gun.y) * 0.35, y: end.y - (end.x - gun.x) * 0.35 };
    if (k >= 0 && k < (s.hit || s.lucky ? 1 : 1.6)) {
      const head = Math.min(k, 1.6);
      const tail = Math.max(0, head - 0.3);
      const p = (q: number) => ({ x: gun.x + (aim.x - gun.x) * q, y: gun.y + (aim.y - gun.y) * q });
      const a = p(head);
      const b = p(tail);
      bullets.push(
        <G key={`b${s.n}`}>
          <Line x1={b.x} y1={b.y} x2={a.x} y2={a.y} stroke="#111111" strokeWidth={7} strokeLinecap="round" />
          <Line x1={b.x} y1={b.y} x2={a.x} y2={a.y} stroke={DOT_ON} strokeWidth={4} strokeLinecap="round" />
        </G>,
      );
    }
    const kb = (t - s.at - FLIGHT_S) / 0.6;
    if ((s.hit || s.lucky) && kb >= 0 && kb < 1) {
      const R = sizeOf(tgt.size) * (1 + kb * 1.4);
      bursts.push(
        <G key={`x${s.n}`} opacity={1 - kb}>
          <Circle cx={end.x} cy={end.y} r={R} stroke={s.lucky ? DOT_ON : C.ink} strokeWidth={3} fill="none" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + s.n;
            return <Line key={i} x1={end.x + Math.cos(a) * R * 0.5} y1={end.y + Math.sin(a) * R * 0.5} x2={end.x + Math.cos(a) * R * 1.2} y2={end.y + Math.sin(a) * R * 1.2} stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />;
          })}
        </G>,
      );
    }
  }

  /* ---- the head: the pace to hold, and the meters to the next shot. */
  const big = wide ? 38 : 44;
  const head = (
    <View style={{ height: HEAD, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16 }}>
      <View>
        <Eyebrow style={{ color: C.ink }}>{`Hold · ±${v.band.toFixed(1)} s`}</Eyebrow>
        <Num size={big}>{fmtClock(v.locked)}</Num>
      </View>
      {v.phase === "play" ? (
        <View style={{ alignItems: "flex-end" }}>
          <Eyebrow style={{ color: C.ink }}>{`Shot ${Math.min(SHOTS, v.seg + 1)} of ${SHOTS} in`}</Eyebrow>
          <Num size={big}>{`${left} m`}</Num>
        </View>
      ) : null}
    </View>
  );

  /* ---- the gauge: the band about the locked pace, and the needle. */
  const gw = width - 32;
  const span = v.band * 2.5;
  const gx = (off: number) => gw / 2 - (clamp(off / span, -1, 1) * gw) / 2;
  const bandW = (v.band / span) * gw;
  const needleX = gx(v.off);
  const needleColor = v.inBand ? C.good : BEST;
  const gauge = (
    <View style={{ height: GAUGE, paddingHorizontal: 16, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.6, color: C.soft }}>← SLOWER</Text>
        <Pips v={v} t={t} />
        <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.6, color: C.soft }}>FASTER →</Text>
      </View>
      <Svg width={gw} height={30} style={{ marginTop: 4 }}>
        <Rect x={0} y={8} width={gw} height={14} fill={C.pale} />
        <Rect x={gw / 2 - bandW / 2} y={4} width={bandW} height={22} fill={C.good} fillOpacity={0.28} stroke={C.good} strokeWidth={1.5} />
        <Line x1={gw / 2} y1={0} x2={gw / 2} y2={30} stroke={C.ink} strokeWidth={2} />
        {v.needle ? <Rect x={needleX - 4} y={0} width={8} height={30} rx={2} fill={needleColor} stroke={C.ink} strokeWidth={1.2} /> : null}
      </Svg>
    </View>
  );

  const hint = v.phase === "result" ? (v.won ? "FIELD CLEAR" : "WIPED OUT") : !v.needle ? "ROW TO PLAY" : v.inBand ? "LOCKED IN" : v.off > 0 ? "A TOUCH FASTER" : "A TOUCH SLOWER";
  const hintColor = v.phase === "result" ? (v.won ? C.good : BEST) : v.inBand ? C.good : C.ink;

  return (
    <View style={{ width, height, overflow: "hidden" }}>
      {head}
      <View style={{ width: fw, height: fh }}>
        <Svg width={fw} height={fh} style={{ position: "absolute", left: 0, top: 0 }}>
          {/* The water the boat sits on. */}
          <Line x1={cx - bw * 0.7} y1={cy + bh * 0.14} x2={cx + bw * 0.7} y2={cy + bh * 0.14} stroke={C.line} strokeWidth={2} strokeDasharray="6 6" />
          {shown.map((k) => {
            const p = posOf(k, t);
            return <Path key={k.id} d={rockPath(k, p.x, p.y, sizeOf(k.size), t)} fill={C.pale} stroke={C.ink} strokeWidth={2.4} strokeLinejoin="round" />;
          })}
        </Svg>
        {!blown ? (
          <View pointerEvents="none" style={{ position: "absolute", left: cx - bw / 2, top: cy - bh * 0.55 }}>
            <BoatArt paint={paint} width={bw} phase={phase} t={t} wobble={wobble} uid="game" />
          </View>
        ) : null}
        <Svg width={fw} height={fh} style={{ position: "absolute", left: 0, top: 0 }}>
          {bullets}
          {bursts}
          {blown ? <Blast x={cx} y={cy} unit={unit} k={(e - 0.9) / 1.2} /> : null}
          {v.phase === "result" && v.won ? <Sparks x={cx} y={cy} unit={unit} t={t} /> : null}
        </Svg>
        {shotWord ? (
          <View pointerEvents="none" style={{ position: "absolute", top: 4, alignSelf: "center", backgroundColor: fresh?.lucky ? "#111111" : "transparent", paddingHorizontal: 10 }}>
            <Text style={{ fontFamily: F.black, fontSize: wide ? 38 : 42, letterSpacing: 1, color: fresh?.lucky ? DOT_ON : fresh?.hit ? C.ink : C.gray }}>{shotWord}</Text>
          </View>
        ) : null}
        {HINT === 0 ? (
          <Text numberOfLines={1} style={{ position: "absolute", bottom: 0, alignSelf: "center", fontFamily: F.black, fontSize: 26, color: hintColor }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {HINT ? (
        <View style={{ height: HINT, alignItems: "center", justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: Math.min(34, Math.floor((width - 32) / (hint.length * 0.74))), color: hintColor, letterSpacing: 0.5 }}>
            {hint}
          </Text>
        </View>
      ) : null}
      {gauge}
    </View>
  );
}

/* The four shots: a hit filled, a lucky one in the yellow, a miss crossed,
 * the one coming ringed. */
function Pips({ v, t }: { v: View159; t: number }) {
  const R = 9;
  return (
    <Svg width={SHOTS * 26} height={22}>
      {Array.from({ length: SHOTS }, (_, i) => {
        const s = v.shots[i];
        const x = 13 + i * 26;
        if (!s) {
          const now = i === v.seg && v.phase === "play";
          return <Circle key={i} cx={x} cy={11} r={R - (now ? 0 : 2)} stroke={C.ink} strokeWidth={now ? 2.5 + Math.sin(t * 6) : 1.5} fill="none" />;
        }
        if (s.hit) return <Circle key={i} cx={x} cy={11} r={R} fill={C.ink} />;
        if (s.lucky) return <Circle key={i} cx={x} cy={11} r={R} fill={DOT_ON} stroke="#111111" strokeWidth={2} />;
        return (
          <G key={i}>
            <Circle cx={x} cy={11} r={R - 1} stroke={C.gray} strokeWidth={1.5} fill="none" />
            <Path d={`M${x - 5} 6 L${x + 5} 16 M${x + 5} 6 L${x - 5} 16`} stroke={BEST} strokeWidth={2.4} strokeLinecap="round" />
          </G>
        );
      })}
    </Svg>
  );
}

/* The rocks reach the boat. */
function Blast({ x, y, unit, k }: { x: number; y: number; unit: number; k: number }) {
  const q = clamp(k);
  return (
    <G opacity={1 - q * 0.6}>
      <Circle cx={x} cy={y} r={unit * (0.1 + 0.32 * q)} fill="#F0631E" fillOpacity={0.5 * (1 - q)} />
      <Circle cx={x} cy={y} r={unit * (0.06 + 0.2 * q)} fill={DOT_ON} fillOpacity={0.9 * (1 - q)} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r0 = unit * (0.08 + 0.3 * q);
        return <Line key={i} x1={x + Math.cos(a) * r0} y1={y + Math.sin(a) * r0} x2={x + Math.cos(a) * (r0 + unit * 0.06)} y2={y + Math.sin(a) * (r0 + unit * 0.06)} stroke={C.ink} strokeWidth={3} strokeLinecap="round" />;
      })}
    </G>
  );
}

/* A clear field: a ring of little stars round the boat. */
function Sparks({ x, y, unit, t }: { x: number; y: number; unit: number; t: number }) {
  return (
    <G>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + t * 0.8;
        const r = unit * (0.36 + 0.04 * Math.sin(t * 5 + i));
        const sx = x + Math.cos(a) * r;
        const sy = y + Math.sin(a) * r * 0.8;
        const s = 4 + 3 * Math.sin(t * 6 + i);
        return <Path key={i} d={`M${sx} ${sy - s} L${sx + s * 0.3} ${sy - s * 0.3} L${sx + s} ${sy} L${sx + s * 0.3} ${sy + s * 0.3} L${sx} ${sy + s} L${sx - s * 0.3} ${sy + s * 0.3} L${sx - s} ${sy} L${sx - s * 0.3} ${sy - s * 0.3}Z`} fill={DOT_ON} stroke="#111111" strokeWidth={1} />;
      })}
    </G>
  );
}

/* ---- over any other page ------------------------------------------------ */

/* THE GAME OVER THE PAGE IN VIEW, so the rower does not have to swipe to it,
 * with the four figures across its top in the monitor's own size. */
export function ArcadeOverlay({ arcade, erg, width, height }: { arcade: Arcaded; erg: Erg; width: number; height: number }) {
  const { live } = erg;
  const wide = width >= 520 && width > height;
  const nowPace = live.pace > 0 && live.pace < 600 ? fmtClock(live.pace, false) : "-:--";
  const figs: [string, string, string][] = [
    ["Now /500", nowPace, C.ink],
    ["Average /500", fmtPace(live.avgPace), C.accent],
    ["Meters", fmtInt(Math.floor(live.meters)), C.ink],
    ["Time", fmtClock(live.elapsedS, false), C.ink],
  ];
  if (wide) {
    const SIDE = Math.round(Math.min(280, width * 0.3));
    const size = Math.max(28, Math.min(46, Math.floor((height - 16) / 4) - 20, Math.floor((SIDE - 20) / 4.2)));
    return (
      <View style={{ width, height, flexDirection: "row", backgroundColor: C.paper }}>
        <View style={{ width: SIDE, paddingLeft: 20, paddingRight: 8, justifyContent: "center", borderRightWidth: 1, borderColor: C.line }}>
          {figs.map(([k, val, c]) => (
            <View key={k} style={{ paddingVertical: 2 }}>
              <Eyebrow>{k}</Eyebrow>
              <Num size={size} color={c}>
                {val}
              </Num>
            </View>
          ))}
        </View>
        <ArcadeStage arcade={arcade} erg={erg} width={width - SIDE} height={height} active />
      </View>
    );
  }
  const size = Math.max(28, Math.min(48, Math.floor((width - 40) / 2 / 4.2)));
  const STRIP = 2 * (Math.round(size * 1.12) + 18) + 8;
  return (
    <View style={{ width, height, backgroundColor: C.paper }}>
      <View style={{ height: STRIP, flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, borderBottomWidth: 1, borderColor: C.line }}>
        {figs.map(([k, val, c], i) => (
          <View key={k} style={{ width: "50%", alignItems: i % 2 ? "flex-end" : "flex-start", paddingTop: 4 }}>
            <Eyebrow>{k}</Eyebrow>
            <Num size={size} color={c}>
              {val}
            </Num>
          </View>
        ))}
      </View>
      <ArcadeStage arcade={arcade} erg={erg} width={width} height={height - STRIP} active />
    </View>
  );
}
