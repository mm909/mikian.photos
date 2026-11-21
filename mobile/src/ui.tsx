import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import type { Photo } from "./api";
import { peek } from "./api";
import { ActivityIndicator, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { CloseIcon, DotsIcon } from "./icons";
import { C, F, onLook } from "./theme";

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

/* ONE READ OF THE SERVER, with its three states. `reload` reads again in
 * place (pull to refresh, a row just logged) without blanking the screen.
 * Given the path it reads as `key`, it starts from the last answer the app
 * has for that path (api.ts peek) and reads again behind it: no spinner for
 * a thing already seen. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], key?: string | null): { data: T | null; error: string; loading: boolean; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(() => peek<T>(key));
  const shown = useRef(key);
  if (shown.current !== key) {
    /* Another thing is asked for: what is kept of it, or nothing, at once. */
    shown.current = key;
    setData(peek<T>(key));
  }
  const [error, setError] = useState("");
  /* `loading` is the spinner of a PULL: true only while a read somebody
   * asked for (pull to refresh) is out. The read every screen makes as it
   * opens is silent, because what the app already has is on the screen
   * (owner, 2026-11-22: "does the spinner pop up when we swap ... it looks
   * like the data's already there"). A first read with nothing to show is
   * the screen's own waiting state, not this. */
  const [loading, setLoading] = useState(false);
  const pulled = useRef(false);
  const turn = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const mine = ++turn.current;
    if (pulled.current) setLoading(true);
    pulled.current = false;
    try {
      const d = await fn();
      if (mine === turn.current) {
        setData(d);
        setError("");
      }
    } catch (err) {
      if (mine === turn.current) setError(err instanceof Error ? err.message : "That could not be read.");
    }
    if (mine === turn.current) setLoading(false);
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  const pull = useCallback(() => {
    pulled.current = true;
    return reload();
  }, [reload]);
  return { data, error, loading, reload: pull };
}

/* What a screen shows before its first read lands, or instead of it. */
export function Waiting({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: 28, alignItems: "center" }}>
      {error ? (
        <>
          <Text style={[styles.body, { textAlign: "center", marginBottom: 14 }]}>{error}</Text>
          {onRetry ? <Btn label="Try again" quiet onPress={onRetry} /> : null}
        </>
      ) : (
        <ActivityIndicator color={C.ink} />
      )}
    </View>
  );
}

/* The head of a stretch of page: the ink rule and the mono words over it,
 * as the site's sections open. */
export function Section({ title, right, children, style }: { title: string; right?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 30 }, style]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8, marginBottom: 12 }}>
        <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2.2, color: C.ink }}>{title.toUpperCase()}</Text>
        {typeof right === "string" ? <Eyebrow>{right}</Eyebrow> : right}
      </View>
      {children}
    </View>
  );
}

/* WORDS TO CHOOSE BETWEEN, in a row that scrolls: the one chosen in ink
 * over the blue rule, the way the site's rail marks the page it is on. */
export function Picks<T extends string>({ options, value, onPick, style }: { options: { key: T; label: string }[]; value: T; onPick: (k: T) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", columnGap: 20, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderColor: C.line }, style]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onPick(o.key)} style={{ paddingVertical: 10, minHeight: 40, borderBottomWidth: 3, borderColor: on ? C.accent : "transparent" }}>
            <Text style={{ fontFamily: on ? F.monoBold : F.mono, fontSize: 12, letterSpacing: 1.8, color: on ? C.ink : C.gray }}>{o.label.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* A HIDDEN NUMBER (lights out): ink blocks the width the digits would be.
 * Nothing of the number is in the app when these draw. */
export function Blocks({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <View accessibilityLabel="Hidden" style={{ flexDirection: "row", gap: Math.max(2, size * 0.14) }}>
      {Array.from({ length: Math.max(1, Math.min(8, n)) }, (_, i) => (
        <View key={i} style={{ width: size * 0.6, height: size, backgroundColor: C.ink }} />
      ))}
    </View>
  );
}

/* The lifetime tag beside a name: a small outlined chip. */
export function Tag({ children, on }: { children: ReactNode; on?: boolean }) {
  return (
    <View style={{ borderWidth: 1.5, borderColor: on ? C.accent : C.ink, paddingHorizontal: 6, paddingVertical: 1 }}>
      <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1, color: on ? C.accent : C.ink }}>{children}</Text>
    </View>
  );
}

/* A ROWER'S FACE (owner, 2026-11-22: "I think the answer is yes, we do
 * profile photos"; and of a rower who never sets one: "what happens when
 * someone doesn't fill it out?"). Round, the photo cropped to fill it. With
 * no photo: the rower's initials in the blue on its pale ground, so every
 * line has something where a face goes and nobody looks unfinished. */
export function Avatar({ uri, name, size = 36 }: { uri?: string | null; name: string; size?: number }) {
  const [bad, setBad] = useState(false);
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: C.pale, alignItems: "center", justifyContent: "center" }}>
      {uri && !bad ? <Image source={{ uri }} resizeMode="cover" onError={() => setBad(true)} style={{ width: size, height: size }} /> : <Text style={{ fontFamily: F.bold, fontSize: Math.round(size * 0.38), color: C.accent }}>{letters || "·"}</Text>}
    </View>
  );
}

/* THE TWO PHOTOS OF A ROW (owner, 2026-11-20: "exactly 2 photos"): side by
 * side, each cropped to 4:5 so a tall phone picture and a wide one sit the
 * same; a lone old photo takes the width in a 4:3 frame. Tap for the whole
 * picture. A row with none draws nothing. */
export function PhotoPair({ photos, style, menu }: { photos: Photo[]; style?: StyleProp<ViewStyle>; menu?: (close: () => void, leave: () => void) => ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  /* The sheet behind the three dots, up OVER the photo (owner, 2026-11-22:
   * "clicking those three dots shouldn't go back to the page"). `leave`
   * shuts the photos too, for a line of the sheet that goes somewhere. */
  const [dots, setDots] = useState(false);
  if (!photos.length) return null;
  const shown = photos.slice(0, 2);
  return (
    <View style={[{ flexDirection: "row", gap: 4 }, style]}>
      {shown.map((p, i) => (
        <Pressable key={i} accessibilityRole="imagebutton" accessibilityLabel={i === 0 ? "The rower's photo" : "The monitor's photo"} onPress={() => setOpen(i)} style={{ flex: 1, aspectRatio: shown.length === 1 ? 4 / 3 : 4 / 5, backgroundColor: C.pale }}>
          <Image source={{ uri: p.full }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
        </Pressable>
      ))}
      {open !== null ? (
        <PhotoViewer
          photos={shown}
          start={open}
          onClose={() => setOpen(null)}
          onMenu={menu ? () => setDots(true) : undefined}
        >
          {dots && menu
            ? menu(
                () => setDots(false),
                () => {
                  setDots(false);
                  setOpen(null);
                },
              )
            : null}
        </PhotoViewer>
      ) : null}
    </View>
  );
}

/* THE PHOTOS, WHOLE (owner, 2026-11-21: "if I click on the photos, I should
 * be able to swipe through them, and the background doesn't need to be
 * transparent. It can be black, and we should have two buttons, one on the
 * top left, one on the top right, one to exit ... an X on one side and the
 * three dots on the right side, and the three dots should bring up the
 * report button"). A black page, one photo to a screen, a swipe to the
 * other, and a mark at the foot for which of the two is showing. */
export function PhotoViewer({ photos, start, onClose, onMenu, children }: { photos: Photo[]; start: number; onClose: () => void; onMenu?: () => void; children?: ReactNode }) {
  const win = useWindowDimensions();
  const [at, setAt] = useState(start);
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const w = win.width;
  const btn = { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const };
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <ScrollView
          ref={list}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: start * w, y: 0 }}
          onLayout={() => list.current?.scrollTo({ x: start * w, animated: false })}
          onScroll={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, w)))}
          scrollEventThrottle={32}
          style={{ flex: 1 }}
        >
          {photos.map((p, i) => (
            <View key={i} style={{ width: w, height: "100%", justifyContent: "center" }}>
              <Image source={{ uri: p.full }} resizeMode="contain" style={{ width: w, height: "100%" }} />
            </View>
          ))}
        </ScrollView>
        <View style={{ position: "absolute", top: 44, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={btn}>
            <CloseIcon color="#fff" size={26} />
          </Pressable>
          {onMenu ? (
            <Pressable accessibilityRole="button" accessibilityLabel="More about this row" onPress={onMenu} hitSlop={8} style={btn}>
              <DotsIcon color="#fff" size={26} />
            </Pressable>
          ) : null}
        </View>
        {photos.length > 1 ? (
          <View pointerEvents="none" style={{ position: "absolute", bottom: 36, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 8 }}>
            {photos.map((_, i) => (
              <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === at ? "#fff" : "rgba(255,255,255,0.35)" }} />
            ))}
          </View>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

const build = () => StyleSheet.create({
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
/* Built once, and again whenever the look changes (theme.ts). */
export let styles = build();
onLook(() => {
  styles = build();
});
