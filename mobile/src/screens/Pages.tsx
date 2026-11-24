import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, Platform, View } from "react-native";
import { Dots, scrub, setSideDrag } from "../ui";

/* A CARD WITH AS MANY FACES AS IT HAS FIGURES (owner, 2026-11-23, of the
 * analytics' comparisons: "if we can't show it in one chart or one page,
 * that's okay. Just make another page ... we can keep swiping. We can have
 * multiple of those dots. So if we need to show a chart that's just the
 * stroke KDE ... and then the steady pace KDE, then that's okay too").
 *
 * Field.tsx Flip, for any number of faces: a JS pager that turns from a
 * sideways drag no chart inside it has claimed (`scrub.chart`), keeps the
 * drag from the tabs once it has it, and goes round, a copy of the last
 * face before the first and of the first after the last. The dots are the
 * app's own (ui.tsx Dots): a tap goes to that face, and a finger held on
 * them and slid goes face to face. With one face it is that face alone.
 * The faces are side by side, so each is the height of the tallest. */
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
  const go = (i: number, v = 0) => {
    const N = count.current;
    const real = i <= 0 ? N : i >= N + 1 ? 1 : i;
    at.current = real;
    setPage(real - 1);
    Animated.spring(x, { toValue: -Math.max(0, Math.min(N + 1, i)) * width.current, velocity: v, friction: 9, tension: 70, useNativeDriver: Platform.OS !== "web" }).start(({ finished }) => {
      if (finished && real !== i) x.setValue(-real * width.current);
    });
  };
  const goRef = useRef(go);
  goRef.current = go;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => count.current > 1 && !scrub.chart && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: () => {
          scrub.on = true;
          setSideDrag(true);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          x.setValue(-at.current * width.current + Math.max(-width.current, Math.min(width.current, g.dx)));
        },
        onPanResponderRelease: (_e, g) => {
          scrub.on = false;
          setSideDrag(false);
          const far = Math.abs(g.dx) > width.current * 0.22 || Math.abs(g.vx) > 0.35;
          goRef.current(far ? at.current + (g.dx < 0 ? 1 : -1) : at.current, g.vx);
        },
        onPanResponderTerminate: () => {
          scrub.on = false;
          setSideDrag(false);
          goRef.current(at.current);
        },
      }),
    [x],
  );
  if (n <= 1) return <>{pages[0] ?? null}</>;
  const strip = [pages[n - 1], ...pages, pages[0]];
  return (
    <>
      <View {...pan.panHandlers} style={{ width: w, overflow: "hidden" }}>
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
