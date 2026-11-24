import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, View } from "react-native";
import { Dots, useTap } from "../ui";

/* A CARD WITH AS MANY FACES AS IT HAS FIGURES (owner, 2026-11-23, of the
 * analytics' comparisons: "if we can't show it in one chart or one page,
 * that's okay. Just make another page ... we can have multiple of those
 * dots. So if we need to show a chart that's just the stroke KDE ... and
 * then the steady pace KDE, then that's okay too").
 *
 * A TAP TURNS IT, NOT A SWIPE (owner, 2026-11-24: "there's 5 charts. The
 * swiping, it doesn't feel very good. So instead, can we just tap on those
 * and have them go through?"). A tap anywhere on the card is the next face,
 * and after the last, the first again (ui.tsx useTap: a finger that is held
 * or drags is reading a chart, not turning the card). The dots are the
 * app's own (ui.tsx Dots): a tap goes to that face, and a finger held on
 * them and slid goes face to face. The faces slide in as before. With one
 * face it is that face alone. The faces are side by side, so each is the
 * height of the tallest. */
export function Pages({ w, pages, labels }: { w: number; pages: ReactNode[]; labels?: string[] }) {
  const n = pages.length;
  const [page, setPage] = useState(0);
  const at = useRef(1);
  const x = useRef(new Animated.Value(-w)).current;
  const width = useRef(w);
  width.current = w;
  const count = useRef(n);
  count.current = n;
  useEffect(() => {
    if (at.current > n) {
      at.current = 1;
      setPage(0);
    }
    x.setValue(-at.current * w);
  }, [w, n, x]);
  const go = (i: number) => {
    const N = count.current;
    const real = i <= 0 ? N : i >= N + 1 ? 1 : i;
    at.current = real;
    setPage(real - 1);
    Animated.spring(x, { toValue: -Math.max(0, Math.min(N + 1, i)) * width.current, friction: 9, tension: 70, useNativeDriver: Platform.OS !== "web" }).start(({ finished }) => {
      if (finished && real !== i) x.setValue(-real * width.current);
    });
  };
  const tap = useTap(() => {
    if (count.current > 1) go(at.current + 1);
  });
  if (n <= 1) return <>{pages[0] ?? null}</>;
  /* A copy of the last face before the first and of the first after the
   * last, so the turn from the last to the first slides on the same way. */
  const strip = [pages[n - 1], ...pages, pages[0]];
  return (
    <>
      <View {...tap} accessibilityHint="Tap for the next chart" style={{ width: w, overflow: "hidden" }}>
        <Animated.View style={{ width: w * (n + 2), flexDirection: "row", transform: [{ translateX: x }] }}>
          {strip.map((p, i) => {
            const copy = i === 0 || i === n + 1;
            return (
              <View key={i} style={{ width: w }} importantForAccessibility={copy ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={copy}>
                {p}
              </View>
            );
          })}
        </Animated.View>
      </View>
      <Dots n={n} at={page} onGo={(i) => go(i + 1)} labels={labels} />
    </>
  );
}
