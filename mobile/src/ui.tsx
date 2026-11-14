import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { C, F } from "./theme";

/* The small pieces every screen is made of, in the website's own manner
 * (owner, 2026-11-14, of the first cut: "I don't like how boxy it looks ...
 * white on black text ... no character"): an open cream page, hairline
 * rules instead of boxes, small mono capitals over big Archivo Black
 * figures, the blue for the one number that matters and for the one button
 * that acts. Nothing is white on black. */

/* A number that counts to its target instead of jumping. */
export function useCount(target: number, ms = 900): number {
  const [v, setV] = useState(target);
  const shown = useRef(target);
  useEffect(() => {
    const from = shown.current;
    if (from === target) return;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      const now = from + (target - from) * (1 - Math.pow(1 - p, 3));
      shown.current = now;
      setV(now);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/* A BAR THAT FILLS: from empty when it first appears, and from where it was
 * whenever the value moves. A thin line of the blue on a pale track. */
export function Bar({ value, goal, height = 8, color = C.accent, delay = 0 }: { value: number; goal: number; height?: number; color?: string; delay?: number }) {
  const frac = goal > 0 ? Math.min(1, value / goal) : 0;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: frac, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, frac, delay]);
  return (
    <View style={{ height, backgroundColor: C.pale, overflow: "hidden" }}>
      <Animated.View style={{ height: "100%", backgroundColor: frac >= 1 ? C.good : color, width: a.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

/* A figure that always stays on one line, shrinking before it wraps. */
export function Num({ children, size = 28, color = C.ink, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[{ fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.12), color, fontVariant: ["tabular-nums"], letterSpacing: size > 40 ? -1 : 0 }, style]}>
      {children}
    </Text>
  );
}

/* A stretch of the page under a hairline: no box. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* The blue button acts; the quiet one is an outline, like the site's. */
export function Btn({ label, onPress, quiet, disabled, style }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, quiet ? styles.btnQuiet : null, disabled ? { opacity: 0.4 } : null, pressed ? { opacity: 0.7 } : null, style]}
    >
      <Text style={[styles.btnText, quiet ? { color: C.soft } : null]}>{label}</Text>
    </Pressable>
  );
}

/* Something that pops in: a scale and a fade, once, on mount. */
export function Pop({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, delay, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [a, delay]);
  return <Animated.View style={{ opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>{children}</Animated.View>;
}

export const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, letterSpacing: 2.2, fontFamily: F.mono, color: C.gray, textTransform: "uppercase" },
  card: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: C.line, paddingVertical: 18 },
  btn: { backgroundColor: C.accent, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderWidth: 1, borderColor: C.accent },
  btnQuiet: { backgroundColor: "transparent", borderColor: C.line },
  btnText: { color: "#fff", fontSize: 13, fontFamily: F.monoBold, letterSpacing: 2.2, textTransform: "uppercase" },
  big: { fontSize: 56, fontFamily: F.black, color: C.ink, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  mid: { fontSize: 28, fontFamily: F.black, color: C.ink, fontVariant: ["tabular-nums"] },
  body: { fontSize: 16, color: C.soft, lineHeight: 23, fontFamily: F.sans },
  row: { flexDirection: "row", alignItems: "center" },
});
