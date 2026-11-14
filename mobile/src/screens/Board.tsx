import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { crewOn, ranked, type Racer } from "../board";
import { C, F, fmtInt } from "../theme";
import { Eyebrow, Num, useCount } from "../ui";

/* THE BOARD. Every rower is a row pinned to its rank; when the order
 * changes the rows slide to their new places, and each bar grows to its
 * metres. `before` is the viewer's total before the row they just banked:
 * the board opens on the old order, waits a beat, then lets them climb. */

const ROW_H = 58;

export function Board({ name, meters, before }: { name: string; meters: number; before: number | null }) {
  const dom = new Date().getDate();
  const [mine, setMine] = useState(before ?? meters);
  useEffect(() => {
    if (mine === meters) return;
    const t = setTimeout(() => setMine(meters), 700);
    return () => clearTimeout(t);
  }, [meters, mine]);

  const list = ranked(crewOn(dom, { name, meters: mine }));
  const top = Math.max(1, list[0]?.meters ?? 1);
  const place = list.findIndex((r) => r.you) + 1;
  const was = before !== null ? ranked(crewOn(dom, { name, meters: before })).findIndex((r) => r.you) + 1 : place;

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
        <View>
          <Eyebrow>This month</Eyebrow>
          <Num size={34}>
            You are <Text style={{ color: C.accent }}>#{place}</Text>
          </Num>
        </View>
        {was > place ? <Text style={{ fontSize: 13, fontFamily: F.monoBold, letterSpacing: 2, color: C.good }}>UP {was - place}</Text> : null}
      </View>
      <View style={{ height: list.length * ROW_H }}>
        {list.map((r, i) => (
          <Line key={r.id} racer={r} rank={i} top={top} />
        ))}
      </View>
      <Text style={{ fontSize: 13, fontFamily: F.sans, color: C.gray, marginTop: 14, lineHeight: 19 }}>Sample rowers for now. The real board arrives with sign-in.</Text>
    </View>
  );
}

function Line({ racer, rank, top }: { racer: Racer; rank: number; top: number }) {
  const y = useRef(new Animated.Value(rank * ROW_H)).current;
  const w = useRef(new Animated.Value(0)).current;
  const shown = useCount(racer.meters, 1100);
  useEffect(() => {
    Animated.spring(y, { toValue: rank * ROW_H, friction: 8, tension: 50, useNativeDriver: true }).start();
  }, [y, rank]);
  useEffect(() => {
    Animated.timing(w, { toValue: racer.meters / top, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [w, racer.meters, top]);

  return (
    <Animated.View style={{ position: "absolute", left: 0, right: 0, height: ROW_H, transform: [{ translateY: y }], zIndex: racer.you ? 2 : 1, backgroundColor: C.paper }}>
      <View style={{ flex: 1, justifyContent: "center", borderTopWidth: 1, borderColor: C.line }}>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text style={{ width: 30, fontSize: 12, fontFamily: F.mono, color: racer.you ? C.accent : C.gray }}>{String(rank + 1).padStart(2, "0")}</Text>
          <Text style={{ flex: 1, fontSize: 18, fontFamily: racer.you ? F.black : F.semi, color: racer.you ? C.accent : C.ink }} numberOfLines={1}>
            {racer.name}
          </Text>
          <Text style={{ fontSize: 16, fontFamily: F.black, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(shown)}</Text>
        </View>
        <View style={{ height: 4, marginTop: 7, marginLeft: 30, backgroundColor: C.pale }}>
          <Animated.View style={{ height: 4, backgroundColor: racer.you ? C.accent : C.ink, width: w.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
        </View>
      </View>
    </Animated.View>
  );
}
