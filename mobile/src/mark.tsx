import { useEffect, useRef, useState, type ReactNode } from "react";
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
 * stopped at the ninth letter.
 *
 * AND WHAT LEAVES IS GONE BEFORE WHAT COMES ARRIVES (owner, 2026-11-21, of
 * the stats' long count turning into PROFILE: "make sure the animation of
 * the item leaving the top finishes before the animation of something new
 * coming in ... move faster or wait. Probably a combination of both"). So
 * a word of another length leaves quickly, all of it inside a quarter of a
 * second however long it is, and the new word's first letter waits for
 * that before it starts up. Two words of one length still turn over wheel
 * for wheel, at once. */
const WHEEL = 32;
/* The leaving word: every letter under way inside OUT_SPREAD, each taking
 * OUT_MS; the arriving word starts after the last of it. */
const OUT_SPREAD = 100;
const OUT_MS = 150;
const WAIT = OUT_SPREAD + OUT_MS - 20;
/* "month": "11/26", the month's two figures in the blue (2026-11-23). */
export type MarkKind = "word" | "meters" | "month";

/* How a word is set: its size, and which ONE thing in it is the blue. A
 * count of meters: its M. A rower's number: what is between its first and
 * last figure. A word: its first O, as in ROW and LOG, or failing an O the
 * letter in its middle; and a word that opens on a Q wears it there
 * (owner, 2026-11-21: "let's make the Q on the questions the highlighted
 * thing here"), as FAQS wears its own (2026-11-23: "instead of questions,
 * let's just make it FAQs. Still the Q be the thing that is blue"). */
function setting(word: string, kind: MarkKind) {
  const n = word.length;
  const size = n > 9 ? 20 : n > 5 ? 23 : 26;
  const digits = /^\d+$/.test(word);
  const o = word.indexOf("O");
  const one = word === "FAQS" ? 2 : word[0] === "Q" ? 0 : o >= 0 ? o : Math.floor((n - 1) / 2);
  const blue = (i: number) => (kind === "month" ? i < 2 : kind === "meters" ? i === n - 1 : digits ? i > 0 && i < n - 1 : i === one);
  /* The whole word is under way inside about half a second. */
  const step = Math.min(55, 460 / Math.max(1, n));
  /* And on its way out, much faster. */
  const out = Math.min(24, OUT_SPREAD / Math.max(1, n));
  return { size, blue, step, out };
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
          <Wheel key={`${pair.turn}-${i}`} from={same ? pair.from[i] : ""} to={ch} roll={pair.turn > 0} delay={(same ? 0 : WAIT) + i * now.step} blue={now.blue(i)} fromBlue={was.blue(i)} size={now.size} />
        ))}
      </View>
      {pair.turn > 0 && !same ? (
        /* The word that was here, on its way up and out. Wider than the new
           word or not, it stays centred on the same spot. */
        <View key={`out-${pair.turn}`} pointerEvents="none" style={{ position: "absolute", top: 0, left: -160, right: -160, height: WHEEL, flexDirection: "row", justifyContent: "center" }}>
          {pair.from.split("").map((ch, i) => (
            <Gone key={i} ch={ch} delay={i * was.out} blue={was.blue(i)} size={was.size} />
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
    Animated.timing(a, { toValue: 1, duration: OUT_MS, delay, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, delay]);
  return (
    <View style={{ height: WHEEL, overflow: "hidden" }}>
      <Animated.Text style={[face(size, blue), { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -WHEEL] }) }] }]}>{ch}</Animated.Text>
    </View>
  );
}

/* WHAT RIDES BESIDE THE MARK ROLLS IN WITH IT (owner, 2026-11-23: "the
 * verified icon doesn't animate in with the rower ... number, and I think
 * that it should"): up into its own window, the way a letter does, as the
 * mark's last letter lands. Keyed on the mark's word by the caller, so it
 * rolls again each time the word changes. `after` is how many letters the
 * word has. */
export function RollIn({ children, after }: { children: ReactNode; after: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const step = Math.min(55, 460 / Math.max(1, after));
    Animated.timing(a, { toValue: 1, duration: 380, delay: WAIT + after * step, easing: EASE, useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, after]);
  return (
    <View style={{ height: WHEEL, overflow: "hidden", justifyContent: "center" }}>
      <Animated.View style={{ transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [WHEEL, 0] }) }] }}>{children}</Animated.View>
    </View>
  );
}

/* THE CHECK GOES WITH THE NUMBER TOO (owner, 2026-11-23: "where it's
 * transitioning that top title, and we're going from profile to something
 * else, the verified badge disappears on the leaving animation. It should
 * probably stay and leave with the 001 or whatever it is"). The slot beside
 * the mark: when the word changes, a check that was there rolls up and out
 * with the old word's letters, and one that belongs to the new word rolls
 * in after its letters (RollIn). `word` is the mark's word; `on`, whether
 * this word wears the check. */
export function BadgeSlot({ word, on, children }: { word: string; on: boolean; children: ReactNode }) {
  const [s, setS] = useState({ word, on, turn: 0, was: false });
  useEffect(() => {
    setS((p) => (p.word === word && p.on === on ? p : { word, on, turn: p.turn + 1, was: p.on }));
  }, [word, on]);
  const leaving = s.turn > 0 && s.was;
  if (!s.on && !leaving) return null;
  return (
    <View style={{ height: WHEEL, overflow: "hidden", justifyContent: "center" }}>
      {leaving ? (
        <View key={`out-${s.turn}`} pointerEvents="none" style={s.on ? { position: "absolute", left: 0, top: 0, bottom: 0, justifyContent: "center" } : { justifyContent: "center" }}>
          <GoneBadge delay={Math.min(OUT_SPREAD, 24 * 3)}>{children}</GoneBadge>
        </View>
      ) : null}
      {s.on ? (
        <RollIn key={`in-${s.turn}`} after={s.word.length}>
          {children}
        </RollIn>
      ) : null}
    </View>
  );
}

function GoneBadge({ children, delay }: { children: ReactNode; delay: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: OUT_MS, delay, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, delay]);
  return <Animated.View style={{ opacity: a.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -WHEEL] }) }] }}>{children}</Animated.View>;
}
