import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { C, F } from "./theme";

/* THE MARK (owner, 2026-11-14: "change our logo to ROW with the O in the
 * Rowtember color"), and what it becomes (owner, 2026-11-21: "ROW turns
 * into 001 ... a nice little animation"): each letter is a wheel that rolls
 * up to the figure under it, one after the other, as an odometer turns
 * over. A word or a rower's number keeps the blue in its middle; a count of
 * meters is ink with its M in the blue.
 *
 * WHAT WAS THERE LEAVES THE SAME WAY (owner, 2026-11-21: "the old item
 * that was there kind of just leaves ... settings just kind of disappears
 * and it feels like it should either go up the top or go finish its
 * animation"). Two words of the same length turn over wheel for wheel; of
 * different lengths, the old one rolls up and out, letter by letter, while
 * the new one rolls up into its place.
 *
 * EVERY LETTER HAS ITS OWN MOMENT, however long the word (the same day, of
 * NOTIFICATIONS: "that back half, the ATIONS, looks like it comes up
 * almost as one block"): the stagger is spread over the whole word, not
 * stopped at the ninth letter. */
const WHEEL = 32;
export type MarkKind = "word" | "meters";

/* How a word is set: its size, and which ONE thing in it is the blue. A
 * count of meters: its M. A rower's number: what is between its first and
 * last figure. A word: its first O, as in ROW and LOG, or failing an O the
 * letter in its middle. */
function setting(word: string, kind: MarkKind) {
  const n = word.length;
  const size = n > 9 ? 20 : n > 5 ? 23 : 26;
  const digits = /^\d+$/.test(word);
  const o = word.indexOf("O");
  const one = o >= 0 ? o : Math.floor((n - 1) / 2);
  const blue = (i: number) => (kind === "meters" ? i === n - 1 : digits ? i > 0 && i < n - 1 : i === one);
  /* The whole word is under way inside about half a second. */
  const step = Math.min(55, 460 / Math.max(1, n));
  return { size, blue, step };
}

export function Mark({ label, kind }: { label: string; kind: MarkKind }) {
  const [pair, setPair] = useState({ from: label, fromKind: kind, to: label, turn: 0 });
  const kindRef = useRef(kind);
  useEffect(() => {
    setPair((p) => (p.to === label ? p : { from: p.to, fromKind: kindRef.current, to: label, turn: p.turn + 1 }));
    kindRef.current = kind;
  }, [label, kind]);
  const chars = pair.to.split("");
  const same = pair.from.length === pair.to.length;
  const now = setting(pair.to, kind);
  const was = setting(pair.from, pair.fromKind);
  return (
    <View accessibilityRole="header" accessibilityLabel={pair.to === "ROW" ? "Row" : pair.to} style={{ height: WHEEL, alignItems: "center" }}>
      <View style={{ flexDirection: "row", height: WHEEL }}>
        {chars.map((ch, i) => (
          <Wheel key={`${pair.turn}-${i}`} from={same ? pair.from[i] : ""} to={ch} roll={pair.turn > 0} delay={i * now.step} blue={now.blue(i)} fromBlue={was.blue(i)} size={now.size} />
        ))}
      </View>
      {pair.turn > 0 && !same ? (
        /* The word that was here, on its way up and out. Wider than the new
           word or not, it stays centred on the same spot. */
        <View key={`out-${pair.turn}`} pointerEvents="none" style={{ position: "absolute", top: 0, left: -160, right: -160, height: WHEEL, flexDirection: "row", justifyContent: "center" }}>
          {pair.from.split("").map((ch, i) => (
            <Gone key={i} ch={ch} delay={i * was.step} blue={was.blue(i)} size={was.size} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const face = (size: number, blue: boolean) => ({ fontFamily: F.black, fontSize: size, lineHeight: WHEEL, letterSpacing: 0.5, color: blue ? C.accent : C.ink, fontVariant: ["tabular-nums" as const], textAlign: "center" as const });
const EASE = Easing.bezier(0.2, 0.7, 0.2, 1);

function Wheel({ from, to, roll, delay, blue, fromBlue, size }: { from: string; to: string; roll: boolean; delay: number; blue: boolean; fromBlue: boolean; size: number }) {
  const a = useRef(new Animated.Value(roll ? 0 : 1)).current;
  useEffect(() => {
    if (roll) Animated.timing(a, { toValue: 1, duration: 380, delay, easing: EASE, useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, roll, delay]);
  return (
    <View style={{ height: WHEEL, overflow: "hidden" }}>
      <Animated.Text style={[face(size, blue), { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [WHEEL, 0] }) }] }]}>{to}</Animated.Text>
      {roll && from ? <Animated.Text style={[face(size, fromBlue), { position: "absolute", left: 0, right: 0, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -WHEEL] }) }] }]}>{from}</Animated.Text> : null}
    </View>
  );
}

/* One letter of the word that is leaving: up and out of its window. */
function Gone({ ch, delay, blue, size }: { ch: string; delay: number; blue: boolean; size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 300, delay, easing: EASE, useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, delay]);
  return (
    <View style={{ height: WHEEL, overflow: "hidden" }}>
      <Animated.Text style={[face(size, blue), { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -WHEEL] }) }] }]}>{ch}</Animated.Text>
    </View>
  );
}
