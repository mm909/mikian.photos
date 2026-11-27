import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { Dots, tapSide, useTap } from "../ui";

/* A CARD WITH AS MANY FACES AS IT HAS FIGURES (owner, 2026-11-23, of the
 * analytics' comparisons: "if we can't show it in one chart or one page,
 * that's okay. Just make another page ... we can have multiple of those
 * dots. So if we need to show a chart that's just the stroke KDE ... and
 * then the steady pace KDE, then that's okay too").
 *
 * A TAP TURNS IT, NOT A SWIPE (owner, 2026-11-24: "there's 5 charts. The
 * swiping, it doesn't feel very good. So instead, can we just tap on those
 * and have them go through?"). A tap on the right half is the next face,
 * on the left half the one before (owner, the same day: "if I tap to the
 * left, it should scroll to the left"), round and round (ui.tsx useTap: a finger that is held
 * or drags is reading a chart, not turning the card). The dots are the
 * app's own (ui.tsx Dots): a tap goes to that face, and a finger held on
 * them and slid goes face to face. The faces slide in as before. With one
 * face it is that face alone. The faces are side by side, so each is the
 * height of the tallest. */
export function Pages({ w, pages, labels }: { w: number; pages: ReactNode[]; labels?: string[] }) {
/* EACH FACE ITS OWN HEIGHT (owner, 2026-11-26, of a short card under a
 * tall one: "How do we address this white space problem?"): the faces are
 * measured, and the window eases to the height of the one showing. */
  const n = pages.length;
  const [page, setPage] = useState(0);
  const tall = useRef<number[]>([]);
  const h = useRef(new Animated.Value(0)).current;
  const [sized, setSized] = useState(false);
  const fit = (real: number, now = false) => {
    const t = tall.current[real];
    if (!(t > 0)) return;
    if (now) h.setValue(t);
    else Animated.timing(h, { toValue: t, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  };
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
    fit(real);
    Animated.spring(x, { toValue: -Math.max(0, Math.min(N + 1, i)) * width.current, friction: 9, tension: 70, useNativeDriver: Platform.OS !== "web" }).start(({ finished }) => {
      if (finished && real !== i) x.setValue(-real * width.current);
    });
  };
  const card = useRef<ComponentRef<typeof View> | null>(null);
  const tap = useTap((px) => {
    if (count.current > 1) tapSide(card, px, (d) => go(at.current + d));
  });
  if (n <= 1) return <>{pages[0] ?? null}</>;
  /* A copy of the last face before the first and of the first after the
   * last, so the turn from the last to the first slides on the same way. */
  const strip = [pages[n - 1], ...pages, pages[0]];
  return (
    <>
      <Animated.View ref={card as never} {...tap} accessibilityHint="Tap the right for the next chart, the left for the one before" style={{ width: w, overflow: "hidden", height: sized ? h : undefined }}>
        <Animated.View style={{ width: w * (n + 2), flexDirection: "row", alignItems: "flex-start", transform: [{ translateX: x }] }}>
          {strip.map((p, i) => {
            const copy = i === 0 || i === n + 1;
            return (
              <View
                key={i}
                onLayout={(e) => {
                  tall.current[i] = e.nativeEvent.layout.height;
                  if (i === at.current) {
                    fit(i, true);
                    if (!sized) setSized(true);
                  }
                }}
                style={{ width: w }}
                importantForAccessibility={copy ? "no-hide-descendants" : "auto"}
                accessibilityElementsHidden={copy}
              >
                {p}
              </View>
            );
          })}
        </Animated.View>
      </Animated.View>
      <Dots n={n} at={page} onGo={(i) => go(i + 1)} labels={labels} />
    </>
  );
}
