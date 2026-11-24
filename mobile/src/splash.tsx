/* THE OPENING (owner, 2026-11-23: "add a small splash screen for row, it
 * should prob have the ROW title and count up to the total number of
 * meters rowed"). Once a launch: the mark, and under it every meter anybody
 * has logged (the stats tab's number, api/row100k/app/total) rolling up
 * from nothing, then the whole of it fades and the app is there under it.
 *
 * The app is drawn and reading ahead the whole time, so the opening costs
 * no wait of its own. The last total this phone saw is kept, so the count
 * starts at once; a fresher one that lands while it runs is where it ends.
 * With no total at all (first launch with no network) it is the mark alone.
 * A tap anywhere lets it go at once. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { api } from "./api";
import { C, F } from "./theme";

const KEEP = "row.splash.total";
const COUNT_MS = 1100;
const HOLD_MS = 380;
const FADE_MS = 280;
/* How long to wait for a total when this phone has none kept. */
const WAIT_MS = 700;

/* THE MARK ROLLS IN, letter by letter, the way the bar's title does
 * (owner, 2026-11-23: "I want it to roll in like it does on the title ...
 * it animates in kind of like one letter by letter"): each letter rises
 * into its own window, one after the other (mark.tsx's wheel, at this size).
 * The count starts as the last letter settles. */
const LETTERS = ["R", "O", "W"];
const LINE = 84;
const ROLL_STEP = 70;
const ROLL_MS = 420;
const EASE = Easing.bezier(0.2, 0.7, 0.2, 1);
const ROLLED_MS = (LETTERS.length - 1) * ROLL_STEP + ROLL_MS - 60;

/* THE LINE AT THE FOOT (owner, 2026-11-23: "instead of the version number
 * stuff, I want it to just say for yourself and others"). */
/* And the version after it (owner, 2026-11-23: "I do want the version
 * number down at the bottom ... probably to the right of it. It's probably
 * for yourself and others, .v, whatever"). */
const VERSION = (() => {
  try {
    return Constants.expoConfig?.version ?? "";
  } catch {
    return "";
  }
})();
const FOOT = `FOR YOURSELF AND OTHERS${VERSION ? ` · V${VERSION}` : ""}`;

/* THE COUNT POPS UP AS ZEROS FIRST (owner, 2026-11-23: "the meters count
 * kind of just pops in. Can that also pop up, but pop up as all zeros and
 * then start counting ... pop up all the zeros and then the M, and then
 * start counting"). The zeros and the M spring up into place; the count
 * starts once they are there. */
const NUM_POP_MS = 360;

/* EVERY PLACE IS THERE FROM THE START, AND ONE MORE (owner, 2026-11-23:
 * "Always add a 0 in front of the digits that we end with ... Even when
 * we're counting and it only has the 100,000s place and doesn't have the
 * million yet, those ... million places should be 00"). The count wears as
 * many digits as the total, plus a leading 0, the whole way up, so it rolls
 * like a meter: 13,303,326 counts 000,000,000 → 013,303,326. */
function zeroed(n: number, total: number): string {
  const width = String(Math.max(0, Math.round(total))).length + 1;
  return String(Math.max(0, n)).padStart(width, "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/* Once per launch: a change of look mounts the app afresh, not the opening. */
let shown = false;

export function Splash() {
  const [on, setOn] = useState(() => {
    if (shown) return false;
    /* In a browser in development, a page opened at a test address (?demo=,
       ?row=) goes straight to it. */
    if (Platform.OS === "web" && typeof window !== "undefined" && window.location.search.length > 1) return false;
    return true;
  });
  const [meters, setMeters] = useState(0);
  const [known, setKnown] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  /* The mark rolls in first; the count waits for it. */
  const rolls = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const numPop = useRef(new Animated.Value(0)).current;
  const target = useRef(0);
  const gone = useRef(false);

  const leave = () => {
    if (gone.current) return;
    gone.current = true;
    Animated.timing(fade, { toValue: 0, duration: FADE_MS, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== "web" }).start(() => setOn(false));
  };

  useEffect(() => {
    if (!on) return;
    shown = true;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    let still = false;
    let popped = false;
    let asked = false;

    const run = () => {
      asked = true;
      if (started || !popped) return;
      started = true;
      if (!target.current) {
        timer = setTimeout(leave, HOLD_MS + 300);
        return;
      }
      setMeters(0);
      setKnown(true);
      if (still) {
        numPop.setValue(1);
        setMeters(target.current);
        timer = setTimeout(leave, HOLD_MS + 400);
        return;
      }
      Animated.spring(numPop, { toValue: 1, friction: 7, tension: 110, useNativeDriver: Platform.OS !== "web" }).start();
      timer = setTimeout(count, NUM_POP_MS);
    };
    const count = () => {
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min(1, (Date.now() - t0) / COUNT_MS);
        const eased = 1 - Math.pow(1 - p, 3);
        setMeters(Math.round(target.current * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
        else timer = setTimeout(leave, HOLD_MS);
      };
      raf = requestAnimationFrame(tick);
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        still = v;
      }, () => null)
      .then(() => {
        const popDone = () => {
          popped = true;
          if (asked) run();
        };
        if (still) {
          rolls.forEach((r) => r.setValue(1));
          popDone();
        } else {
          rolls.forEach((r, i) => Animated.timing(r, { toValue: 1, duration: ROLL_MS, delay: i * ROLL_STEP, easing: EASE, useNativeDriver: Platform.OS !== "web" }).start());
          setTimeout(popDone, ROLLED_MS);
        }
      })
      .then(() => AsyncStorage.getItem(KEEP).catch(() => null))
      .then((kept) => {
        const n = Number(kept);
        if (n > 0 && !target.current) target.current = n;
        if (target.current) run();
      });

    api<{ meters: number }>("/api/row100k/app/total").then(
      (r) => {
        if (!(r.meters > 0)) return;
        /* A fresher total is where the count ends, if it is still counting. */
        if (r.meters > target.current) target.current = r.meters;
        AsyncStorage.setItem(KEEP, String(r.meters)).catch(() => null);
        run();
      },
      () => null,
    );
    const wait = setTimeout(run, WAIT_MS);
    /* However it goes, the app is never held behind the opening for long. */
    const cap = setTimeout(leave, ROLLED_MS + WAIT_MS + NUM_POP_MS + COUNT_MS + HOLD_MS + 600);

    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      clearTimeout(wait);
      clearTimeout(cap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!on) return null;
  return (
    <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: C.paper, opacity: fade }}>
      <Pressable accessibilityLabel="Row. Tap to open." onPress={leave} style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 }}>
        <View accessibilityRole="header" accessibilityLabel="Row" style={{ flexDirection: "row", height: LINE }}>
          {LETTERS.map((ch, i) => (
            <View key={ch} style={{ height: LINE, overflow: "hidden" }}>
              <Animated.Text style={{ fontFamily: F.black, fontSize: 76, lineHeight: LINE, letterSpacing: 1, color: ch === "O" ? C.accent : C.ink, transform: [{ translateY: rolls[i].interpolate({ inputRange: [0, 1], outputRange: [LINE, 0] }) }] }}>{ch}</Animated.Text>
            </View>
          ))}
        </View>
        <View style={{ height: 64, alignItems: "center", justifyContent: "flex-start", marginTop: 14 }}>
          {known ? (
            <Animated.View style={{ alignItems: "center", opacity: numPop.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }), transform: [{ translateY: numPop.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: numPop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
              <Text style={{ fontFamily: F.black, fontSize: 30, lineHeight: 36, color: C.ink, fontVariant: ["tabular-nums"] }}>
                {zeroed(meters, target.current)}
                <Text style={{ color: C.accent }}> M</Text>
              </Text>
              <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2.2, color: C.gray, marginTop: 6 }}>METERS ROWED</Text>
            </Animated.View>
          ) : null}
        </View>
        <Text style={{ position: "absolute", left: 16, right: 16, bottom: 28, textAlign: "center", fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: C.gray }}>{FOOT}</Text>
      </Pressable>
    </Animated.View>
  );
}
