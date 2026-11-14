import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import type { Live } from "../erg/model";
import { C, F, fmtClock, fmtInt } from "../theme";
import { Eyebrow, Num, styles } from "../ui";

/* THE PACE WHEEL (owner, 2026-11-14: "one of the screens to be like a
 * vertical dial, like a wheel ... kind of like the Price is Right ... as I
 * go faster the wheel rolls down, as I go slower the wheel rolls up ...
 * markings for where I need to go to hit certain minute targets ... the
 * pace delta to the next 15-second increment").
 *
 * A tape of paces runs behind a fixed line. The pace being rowed is always
 * on the line, big, with the clock under it on the left and the metres on
 * the right. Faster paces are up the tape, so pulling harder rolls the
 * wheel down.
 *
 * THE MARKS ON THE RIGHT ARE FINISH TIMES, every fifteen seconds. Each one
 * sits at the pace that would have to be held FROM HERE, over the metres
 * left, to finish in that time. They drift as the piece goes: fall behind
 * and a mark climbs away up the tape, bank time and it comes down to meet
 * the line. The line under the wheel says it in words: what the average so
 * far finishes in, and how much faster than right now the next mark is. */

const PX = 16; // points of tape per second of pace
const P_MIN = 75; // 1:15
const P_MAX = 270; // 4:30
const H = 380;
const MID = H / 2;

const paceWord = (p: number, tenths = false): string => {
  if (!(p > 0)) return "-:--";
  const t = Math.round(p * 10);
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}${tenths ? `.${t % 10}` : ""}`;
};

export type WheelRead = {
  remaining: number;
  /* What the average so far finishes in; 0 before there is one. */
  projected: number;
  /* Finish times a quarter-minute apart, each with the pace it needs from here. */
  marks: { finish: number; pace: number }[];
  /* The first mark faster than the projection. */
  next: { finish: number; pace: number } | null;
};

/* The arithmetic of the wheel, apart from the drawing. */
export function wheelRead(elapsedS: number, meters: number, goalM: number): WheelRead {
  const remaining = Math.max(0, goalM - meters);
  if (!(meters > 20) || !(elapsedS > 3) || remaining <= 0) return { remaining, projected: 0, marks: [], next: null };
  const projected = (elapsedS / meters) * goalM;
  const marks: WheelRead["marks"] = [];
  const from = Math.floor((projected - 150) / 15) * 15;
  for (let finish = from; finish <= projected + 90; finish += 15) {
    const pace = ((finish - elapsedS) / remaining) * 500;
    if (pace >= P_MIN && pace <= P_MAX) marks.push({ finish, pace });
  }
  const faster = marks.filter((m) => m.finish < projected - 0.05);
  return { remaining, projected, marks, next: faster.length ? faster[faster.length - 1] : null };
}

export function Wheel({ live, goalM }: { live: Live; goalM: number }) {
  const pace = live.pace > 0 ? Math.max(P_MIN, Math.min(P_MAX, live.pace)) : 120;
  const y = useRef(new Animated.Value(MID - (pace - P_MIN) * PX)).current;
  useEffect(() => {
    Animated.spring(y, { toValue: MID - (pace - P_MIN) * PX, friction: 9, tension: 60, useNativeDriver: true }).start();
  }, [y, pace]);

  const r = wheelRead(live.elapsedS, live.meters, goalM);
  const delta = r.next && live.pace > 0 ? live.pace - r.next.pace : null;

  /* Only the stretch of tape near the line is built: a minute either way. */
  const lo = Math.max(P_MIN, Math.floor(pace) - 16);
  const hi = Math.min(P_MAX, Math.floor(pace) + 16);
  const ticks: number[] = [];
  for (let p = lo; p <= hi; p++) ticks.push(p);

  return (
    <View>
      <View style={{ height: H, overflow: "hidden" }}>
        {/* The tape: paces down the left edge, finish times down the right. */}
        <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, transform: [{ translateY: y }] }}>
          {ticks.map((p) => {
            const five = p % 5 === 0;
            return (
              <View key={p} style={{ position: "absolute", left: 0, top: (p - P_MIN) * PX - 8, height: 16, flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: five ? 22 : 10, height: five ? 2 : 1, backgroundColor: five ? C.ink : C.gray }} />
                {five ? <Text style={{ marginLeft: 6, fontFamily: F.mono, fontSize: 12, color: C.gray }}>{paceWord(p)}</Text> : null}
              </View>
            );
          })}
          {r.marks.map((m) => {
            const isNext = r.next?.finish === m.finish;
            return (
              <View key={m.finish} style={{ position: "absolute", right: 0, top: (m.pace - P_MIN) * PX - 11, height: 22, flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontFamily: isNext ? F.black : F.semi, fontSize: isNext ? 17 : 13, color: isNext ? C.accent : C.soft, marginRight: 6, fontVariant: ["tabular-nums"] }}>{fmtClock(m.finish, false)}</Text>
                <View style={{ width: isNext ? 34 : 20, height: isNext ? 4 : 2, backgroundColor: isNext ? C.accent : C.ink }} />
              </View>
            );
          })}
        </Animated.View>

        {/* The paper fades the tape out toward the rim, the way a wheel turns away. */}
        {[0.9, 0.7, 0.45, 0.2].map((o, i) => (
          <View key={`t${i}`} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: i * 16, height: 16, backgroundColor: C.paper, opacity: o }} />
        ))}
        {[0.9, 0.7, 0.45, 0.2].map((o, i) => (
          <View key={`b${i}`} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: i * 16, height: 16, backgroundColor: C.paper, opacity: o }} />
        ))}

        {/* The line, and on it the pace being rowed. */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: MID - 1, height: 2, backgroundColor: C.accent }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 58, right: 84, top: MID - 66, height: 132, backgroundColor: C.paper, alignItems: "center", justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: 70, lineHeight: 76, color: C.ink, letterSpacing: -1.5, fontVariant: ["tabular-nums"], textAlign: "center" }}>
            {paceWord(live.pace)}
          </Text>
          <View style={{ flexDirection: "row", alignSelf: "stretch", justifyContent: "space-between", marginTop: 2 }}>
            <Num size={22} style={{ flexShrink: 1 }}>
              {fmtClock(live.elapsedS, false)}
            </Num>
            <Num size={22} style={{ flexShrink: 1, textAlign: "right" }}>
              {fmtInt(Math.floor(live.meters))} m
            </Num>
          </View>
        </View>
      </View>

      {/* The same thing in words. */}
      <View style={{ borderTopWidth: 2, borderColor: C.ink, paddingTop: 14, marginTop: 6 }}>
        {r.next && delta !== null ? (
          <>
            <Eyebrow>To finish in {fmtClock(r.next.finish, false)}</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
              <Num size={46} color={C.accent} style={{ flexShrink: 1 }}>
                {delta > 0.05 ? `${delta.toFixed(1)} faster` : delta < -0.05 ? `${(-delta).toFixed(1)} in hand` : "on it"}
              </Num>
            </View>
            <Text style={[styles.body, { marginTop: 2 }]}>
              Hold {paceWord(r.next.pace, true)} for the {fmtInt(r.remaining)} m left. The average so far finishes in {fmtClock(r.projected, false)}.
            </Text>
          </>
        ) : r.remaining <= 0 ? (
          <Num size={40} color={C.good}>
            {fmtInt(goalM)} m done
          </Num>
        ) : (
          <Text style={styles.body}>Take a few strokes and the finish times appear down the right of the wheel.</Text>
        )}
      </View>
    </View>
  );
}
