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
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { api } from "./api";
import { C, F, fmtInt } from "./theme";

const KEEP = "row.splash.total";
const COUNT_MS = 1100;
const HOLD_MS = 380;
const FADE_MS = 280;
/* How long to wait for a total when this phone has none kept. */
const WAIT_MS = 700;

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

    const run = () => {
      if (started) return;
      started = true;
      if (!target.current) {
        timer = setTimeout(leave, HOLD_MS + 300);
        return;
      }
      setKnown(true);
      if (still) {
        setMeters(target.current);
        timer = setTimeout(leave, HOLD_MS + 400);
        return;
      }
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
    const cap = setTimeout(leave, WAIT_MS + COUNT_MS + HOLD_MS + 600);

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
        <Text accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 76, lineHeight: 84, letterSpacing: 1, color: C.ink }}>
          R<Text style={{ color: C.accent }}>O</Text>W
        </Text>
        <View style={{ height: 64, alignItems: "center", justifyContent: "flex-start", marginTop: 14 }}>
          {known ? (
            <>
              <Text style={{ fontFamily: F.black, fontSize: 30, lineHeight: 36, color: C.ink, fontVariant: ["tabular-nums"] }}>
                {fmtInt(meters)}
                <Text style={{ color: C.accent }}> M</Text>
              </Text>
              <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2.2, color: C.gray, marginTop: 6 }}>METERS ROWED</Text>
            </>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
