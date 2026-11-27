import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from "react";
import type { Photo } from "./api";
import { peek } from "./api";
import { ActivityIndicator, Animated, Easing, Image, Keyboard, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { buzz } from "./buzz";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
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

/* THE SMALL COPY, OR THE WHOLE PHOTO (owner, 2026-11-25, of a blank first
 * square on his grid: "Why is this one photo at the front not showing?").
 * The server always names a small copy, but the phone makes it best effort
 * (upload.ts), so a row can have none: when the small copy will not load,
 * the whole photo is shown in its place. */
export function Thumb({ photo, style }: { photo: Photo; style?: StyleProp<ImageStyle> }) {
  const [whole, setWhole] = useState(!photo.thumb);
  return <Image source={{ uri: whole ? photo.full : (photo.thumb as string) }} onError={() => setWhole(true)} resizeMode="cover" style={style} />;
}

/* A figure that always stays on one line, shrinking before it wraps. */
export function Num({ children, size = 28, color = C.ink, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={1.4} style={[{ fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.12), color, fontVariant: ["tabular-nums"], letterSpacing: size > 40 ? -1 : 0 }, style]}>
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
      <Text maxFontSizeMultiplier={1.4} style={[styles.btnText, quiet ? { color: C.soft } : null]}>{label}</Text>
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

/* A PLACE WHERE SOMETHING IS COMING: a pale block that breathes (owner,
 * 2026-11-21, of a screen that sat on a spinner: "Did I lose internet? I'm
 * still looking for those like flashing boxes, right? Like those loading
 * screen boxes. I don't see them here, and I feel like we should"). Every
 * block on the screen breathes together, off one clock. */
const breath = new Animated.Value(1);
let breathing = 0;
let breathLoop: Animated.CompositeAnimation | null = null;
function useBreath(): Animated.Value {
  useEffect(() => {
    if (breathing++ === 0) {
      const native = Platform.OS !== "web";
      breathLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(breath, { toValue: 0.4, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
          Animated.timing(breath, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        ]),
      );
      breathLoop.start();
    }
    return () => {
      if (--breathing === 0) {
        breathLoop?.stop();
        breath.setValue(1);
      }
    };
  }, []);
  return breath;
}
export function Skel({ w = "100%", h = 14, r = 4, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const a = useBreath();
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: C.line, opacity: a.interpolate({ inputRange: [0.4, 1], outputRange: [0.22, 0.5] }) }, style]} />;
}
/* A page that has not arrived, in the shape most pages have: a head, a big
 * figure, a few lines, a picture, a list. */
export function SkelPage({ lines = 4 }: { lines?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ paddingHorizontal: 20, paddingTop: 22 }}>
      <Skel w="46%" h={12} />
      <Skel w="72%" h={48} r={6} style={{ marginTop: 14 }} />
      <Skel w="38%" h={12} style={{ marginTop: 12 }} />
      <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
        <Skel h={56} r={6} style={{ flex: 1 }} />
        <Skel h={56} r={6} style={{ flex: 1 }} />
        <Skel h={56} r={6} style={{ flex: 1 }} />
      </View>
      <Skel h={150} r={8} style={{ marginTop: 22 }} />
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18 }}>
          <Skel w={40} h={40} r={20} />
          <View style={{ flex: 1 }}>
            <Skel w={i % 2 ? "58%" : "72%"} h={13} />
            <Skel w="34%" h={10} style={{ marginTop: 8 }} />
          </View>
          <Skel w={56} h={16} />
        </View>
      ))}
    </View>
  );
}

/* Rows that have not arrived, in the shape of the feed's cards. */
export function SkelCards({ n = 2, pad = 0 }: { n?: number; pad?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ paddingHorizontal: pad, paddingTop: pad }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ backgroundColor: C.card, borderCurve: "continuous", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Skel w={36} h={36} r={18} />
            <View style={{ flex: 1 }}>
              <Skel w="52%" h={13} />
              <Skel w="30%" h={10} style={{ marginTop: 7 }} />
            </View>
          </View>
          <Skel w="44%" h={26} r={5} style={{ marginTop: 14 }} />
          <View style={{ flexDirection: "row", gap: 4, marginTop: 12 }}>
            <Skel h={190} r={8} style={{ flex: 1 }} />
            <Skel h={190} r={8} style={{ flex: 1 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* What a screen shows before its first read lands, or instead of it: the
 * breathing blocks, and, when the read is taking long, a sentence so that
 * a slow signal does not look like a broken app. */
export function Waiting({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  if (error)
    return (
      <View style={{ padding: 28, alignItems: "center" }}>
        <Text style={[styles.body, { textAlign: "center", marginBottom: 14 }]}>{error}</Text>
        {onRetry ? <Btn label="Try again" quiet onPress={onRetry} /> : null}
      </View>
    );
  return (
    <View>
      {slow ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={[styles.body, { fontSize: 14, flex: 1 }]}>Still reading. The signal may be slow.</Text>
          {onRetry ? (
            <Text accessibilityRole="button" onPress={onRetry} suppressHighlighting style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1.4, color: C.accent }}>
              TRY AGAIN
            </Text>
          ) : null}
        </View>
      ) : null}
      <SkelPage />
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
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => {
              if (!on) buzz.tick();
              onPick(o.key);
            }} hitSlop={{ top: 4, bottom: 4 }} style={{ paddingVertical: 10, minHeight: 44, borderBottomWidth: 3, borderColor: on ? C.accent : "transparent" }}>
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

/* WHICH WAY A SCREEN IS BEING READ, for the bars that step aside while it
 * goes down and come back on the way up (App.tsx). Spread onto any
 * ScrollView or FlatList. */
/* AT THE FOOT OF A SCREEN THE BARS HOLD STILL (owner, 2026-11-21: "wants to
 * fight you as you scroll down, and the bottom bar ... goes large, goes
 * small, goes large, goes small again ... You are already at the bottom").
 * There the list bounces back by itself, which read as a scroll upward and
 * brought the bars back; the bars coming back change the height of the
 * list, which moved it again. So nothing is told within a short way of the
 * end, nor while the list is pulled past either end. */
type ScrollEv = { nativeEvent: { contentOffset: { y: number }; contentSize?: { height: number }; layoutMeasurement?: { height: number } } };
export function useScrollDir(tell?: (down: boolean) => void): {
  onScroll: (e: ScrollEv) => void;
  scrollEventThrottle: number;
  scrollEnabled: boolean;
  ref: (r: unknown) => void;
  onLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
  onContentSizeChange: (w: number, h: number) => void;
} {
  const last = useRef(0);
  const across = useSyncExternalStore(sideListen, sideRead, sideRead);
  /* NO PAGE PAST ITS END (owner, 2026-11-26: "after clicking to opt in on
   * the profile page, I'm left with just a blank screen"): the M2D steps
   * are long, with the button at their foot; once in, the page is much
   * shorter, and it stayed scrolled past its new end, all blank. When the
   * content shrinks under where the page is, the page comes back to its
   * end. Every page that takes these props gets it. */
  type Scroller = { scrollTo?: (o: { y: number; animated?: boolean }) => void; scrollToOffset?: (o: { offset: number; animated?: boolean }) => void };
  const view = useRef<Scroller | null>(null);
  const viewH = useRef(0);
  return {
    scrollEventThrottle: 64,
    /* A page stands still under a drag across it (setSideDrag, below). */
    scrollEnabled: !across,
    ref: (r) => {
      view.current = (r as Scroller | null) ?? null;
    },
    onLayout: (e) => {
      viewH.current = e.nativeEvent.layout.height;
    },
    onContentSizeChange: (_w, h) => {
      const end = Math.max(0, h - viewH.current);
      if (viewH.current > 0 && last.current > end + 1) {
        last.current = end;
        if (view.current?.scrollTo) view.current.scrollTo({ y: end, animated: false });
        else view.current?.scrollToOffset?.({ offset: end, animated: false });
      }
    },
    onScroll: (e) => {
      const n = e.nativeEvent;
      const y = n.contentOffset.y;
      const end = n.contentSize && n.layoutMeasurement ? n.contentSize.height - n.layoutMeasurement.height : Infinity;
      if (y >= end - 90) {
        last.current = y;
        return;
      }
      if (y > last.current + 12 && y > 80) tell?.(true);
      else if (y < last.current - 12 || y < 40) tell?.(false);
      last.current = y;
    },
  };
}

/* A ROWER'S FACE (owner, 2026-11-22: "I think the answer is yes, we do
 * profile photos"; and of a rower who never sets one: "what happens when
 * someone doesn't fill it out?"). Round, the photo cropped to fill it. With
 * no photo: the rower's initials in the blue on its pale ground, so every
 * line has something where a face goes and nobody looks unfinished. */
/* NO PHOTO, THE ROWER'S NUMBER (owner, 2026-11-23: "I like the profile
 * photo, if they don't have one, being their rower number instead of their
 * initial, like we have it in the stories"). `num`, as a number or as the
 * board writes it ("043"); the initials only where no number is known. */
export function Avatar({ uri, name, size = 36, num }: { uri?: string | null; name: string; size?: number; num?: number | string | null }) {
  const [bad, setBad] = useState(false);
  const numStr = num === undefined || num === null || num === "" ? "" : typeof num === "number" ? String(num).padStart(3, "0") : num;
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: C.pale, alignItems: "center", justifyContent: "center" }}>
      {uri && !bad ? (
        <Image source={{ uri }} resizeMode="cover" onError={() => setBad(true)} style={{ width: size, height: size }} />
      ) : numStr ? (
        <Text style={{ fontFamily: F.monoBold, fontSize: Math.round(size * 0.3), letterSpacing: 0.5, color: C.ink }}>{numStr}</Text>
      ) : (
        <Text style={{ fontFamily: F.bold, fontSize: Math.round(size * 0.38), color: C.accent }}>{letters || "·"}</Text>
      )}
    </View>
  );
}

/* THE TWO PHOTOS OF A ROW (owner, 2026-11-20: "exactly 2 photos"): side by
 * side, each cropped to 4:5 so a tall phone picture and a wide one sit the
 * same; a lone old photo takes the width in a 4:3 frame. Tap for the whole
 * picture. A row with none draws nothing. */
/* `gallery`: the run of photos this pair is part of (every photo in the
 * feed, in order), so that opening one and swiping on carries into the next
 * row's (owner, 2026-11-22: "let me just keep swiping through them, like
 * through different rowers, through different rows"). */
export type Gallery = { photos: Photo[]; stamps: string[][]; offset: number; menu?: (at: number, close: () => void, leave: () => void) => ReactNode };
export function PhotoPair({ photos, style, menu, gallery }: { photos: Photo[]; style?: StyleProp<ViewStyle>; menu?: (close: () => void, leave: () => void) => ReactNode; gallery?: Gallery }) {
  const [open, setOpen] = useState<number | null>(null);
  /* The sheet behind the three dots, up OVER the photo (owner, 2026-11-22:
   * "clicking those three dots shouldn't go back to the page"). `leave`
   * shuts the photos too, for a line of the sheet that goes somewhere. */
  const [dots, setDots] = useState(false);
  const at = useRef(0);
  if (!photos.length) return null;
  const shown = photos.slice(0, 2);
  const has = gallery ? !!gallery.menu : !!menu;
  const close = () => setDots(false);
  const leave = () => {
    setDots(false);
    setOpen(null);
  };
  return (
    <View style={[{ flexDirection: "row", gap: 4 }, style]}>
      {shown.map((p, i) => (
        <Pressable key={i} accessibilityRole="imagebutton" accessibilityLabel={i === 0 ? "The rower's photo" : "The monitor's photo"} onPress={() => setOpen(i)} style={{ flex: 1, aspectRatio: shown.length === 1 ? 4 / 3 : 4 / 5, backgroundColor: C.pale, borderCurve: "continuous", borderRadius: 8, overflow: "hidden" }}>
          {/* THE SMALL COPY FIRST (owner, 2026-11-26: "my row from yesterday
              ... its main photo takes a second to load"): the thumb, most
              often already in hand from the feed, at once, and the full
              photo laid over it when it lands. */}
          {p.thumb && p.thumb !== p.full ? <Image source={{ uri: p.thumb }} resizeMode="cover" style={{ position: "absolute", width: "100%", height: "100%" }} /> : null}
          <Image source={{ uri: p.full }} resizeMode="cover" fadeDuration={0} style={{ width: "100%", height: "100%" }} />
        </Pressable>
      ))}
      {open !== null ? (
        <PhotoViewer photos={gallery ? gallery.photos : shown} stamps={gallery?.stamps} start={gallery ? gallery.offset + open : open} onAt={(i) => (at.current = i)} onClose={() => setOpen(null)} onMenu={has ? () => setDots(true) : undefined}>
          {dots ? (gallery?.menu ? gallery.menu(at.current, close, leave) : menu ? menu(close, leave) : null) : null}
        </PhotoViewer>
      ) : null}
    </View>
  );
}

/* HOW TALL THE KEYBOARD IS, none when it is down: for a sheet at the foot
 * of the screen, which has to stand on top of it (owner, 2026-11-21, of the
 * sheet a description is written in: "the keyboard covers where you're
 * writing so you can't see it"). The move is the keyboard's own, so the
 * sheet rises with it. Nothing in a browser, which moves the page itself. */
export function useKeyboardHeight(): number {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const ios = Platform.OS === "ios";
    const up = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      Keyboard.scheduleLayoutAnimation(e);
      setKb(e.endCoordinates.height);
    });
    const down = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", (e) => {
      Keyboard.scheduleLayoutAnimation(e);
      setKb(0);
    });
    return () => {
      up.remove();
      down.remove();
    };
  }, []);
  return kb;
}

/* SOMETHING IS OPEN OVER THE SCREEN (photos, stickers, a sheet, the
 * comments). A drag inside it must not reach the tabs behind and change
 * tab (owner, 2026-11-22: "I have the share menu open and I swipe ... it
 * swipes to the search"): whatever opens counts itself in here, and the
 * swipe between tabs (App.tsx) stands down while the count is over none. */
export const modals = { open: 0 };
/* A FINGER THAT CAME DOWN ON A CHART IS READING THE CHART (owner,
 * 2026-11-21: "when I'm scrubbing on a graph ... if I scroll too fast, it
 * starts to scroll the whole page ... if I'm scrubbing on the charts, then
 * we shouldn't change pages"). A chart says so as the finger lands and
 * takes it back as the finger lifts (charts.tsx); the app's outermost view
 * clears it as every touch begins, and no swipe between tabs takes a touch
 * that has it set (App.tsx, screens/Profile.tsx). */
/* PAGE DOTS YOU CAN TOUCH (owner, 2026-11-23: "allow me to click on the
 * dots whenever we have them to change. Also allow me to like click the
 * dots, hold, and then swipe back and forth, and I can quickly swipe
 * between all of them. Instagram has this feature"). A tap on a dot goes to
 * its page; a finger held on the row and slid along it goes to the page of
 * the dot under it, one after the other, as fast as it moves. The row holds
 * the touch, so the tabs do not swipe under it. */
const DOT_SLOT = 22;
export function Dots({ n, at, onGo, labels, style }: { n: number; at: number; onGo: (i: number) => void; labels?: string[]; style?: StyleProp<ViewStyle> }) {
  const go = useRef(onGo);
  go.current = onGo;
  const count = useRef(n);
  count.current = n;
  const last = useRef(-1);
  const left = useRef(0);
  const pick = (x: number) => {
    const i = Math.max(0, Math.min(count.current - 1, Math.floor(x / DOT_SLOT)));
    if (i !== last.current) {
      last.current = i;
      go.current(i);
    }
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          scrub.on = true;
          setSideDrag(true);
          last.current = -1;
          left.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
          pick(e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => pick(e.nativeEvent.pageX - left.current),
        onPanResponderRelease: () => {
          scrub.on = false;
          setSideDrag(false);
        },
        onPanResponderTerminate: () => {
          scrub.on = false;
          setSideDrag(false);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <View style={[{ alignItems: "center", marginTop: 4 }, style]}>
      <View
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={labels?.[at] ?? `Page ${at + 1} of ${n}`}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => onGo(e.nativeEvent.actionName === "increment" ? Math.min(n - 1, at + 1) : Math.max(0, at - 1))}
        style={{ flexDirection: "row", height: 26 }}
      >
        {Array.from({ length: n }, (_, i) => (
          <View key={i} pointerEvents="none" style={{ width: DOT_SLOT, height: 26, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: at === i ? C.accent : C.line }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/* A CARD TURNS ON A TAP, NOT A SWIPE (owner, 2026-11-24, of the analytics'
 * cards: "there's 5 charts. The swiping, it doesn't feel very good. So
 * instead, can we just tap on those and have them go through?"). The touch
 * is watched, not taken, so a chart inside still reads under a finger: a
 * finger down and up again inside a moment, having hardly moved, is a tap;
 * one that is held or drags is reading the chart, or scrolling the page. */
const TAP_MS = 300;
const TAP_PX = 8;
/* `onTap` is told where the finger was, across the page (pageX), so a card
 * can turn back on its left half and on on its right (tapSide). */
export function useTap(onTap: (pageX: number) => void): object {
  const s = useRef({ x: 0, y: 0, t: 0, on: false });
  const fire = useRef(onTap);
  fire.current = onTap;
  return useMemo(() => {
    const down = (x: number, y: number) => (s.current = { x, y, t: Date.now(), on: true });
    const move = (x: number, y: number) => {
      if (Math.abs(x - s.current.x) > TAP_PX || Math.abs(y - s.current.y) > TAP_PX) s.current.on = false;
    };
    const up = () => {
      if (s.current.on && Date.now() - s.current.t < TAP_MS) fire.current(s.current.x);
      s.current.on = false;
    };
    /* A browser's mouse sends no touches: there the pointer says the same. */
    return Platform.OS === "web"
      ? {
          onPointerDown: (e: { nativeEvent: { pageX: number; pageY: number } }) => down(e.nativeEvent.pageX, e.nativeEvent.pageY),
          onPointerMove: (e: { nativeEvent: { pageX: number; pageY: number } }) => move(e.nativeEvent.pageX, e.nativeEvent.pageY),
          onPointerUp: up,
        }
      : {
          onTouchStart: (e: GestureResponderEvent) => down(e.nativeEvent.pageX, e.nativeEvent.pageY),
          onTouchMove: (e: GestureResponderEvent) => move(e.nativeEvent.pageX, e.nativeEvent.pageY),
          onTouchEnd: up,
          onTouchCancel: () => (s.current.on = false),
        };
  }, []);
}

/* WHICH HALF OF A CARD A TAP WAS ON (owner, 2026-11-24: "if I tap to the
 * left, it should scroll to the left. If I tap on the right, it should
 * scroll to the right"): -1 for the left half, 1 for the right, measured
 * off the card's own place on the screen. Unmeasured, it goes on. */
export function tapSide(ref: { current: { measure?: (cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void) => void } | null }, pageX: number, then: (dir: -1 | 1) => void): void {
  const v = ref.current;
  if (!v?.measure) return then(1);
  v.measure((_x, _y, w, _h, px) => then(Number.isFinite(px) && w > 0 && pageX < px + w / 2 ? -1 : 1));
}

/* `chart` is the narrower of the two: set by a chart's own surface alone,
 * so a card that turns (Field.tsx Flip) leaves a scrub to the chart. */
export const scrub = { on: false, chart: false };
/* Spread on anything that moves sideways under a finger (a row of tiles, a
 * wide chart, a table wider than the screen): a drag that starts there is
 * its own, and neither the tabs nor the page under it move. */
export const sideways = {
  onTouchStart: () => {
    scrub.on = true;
  },
  onTouchEnd: () => {
    scrub.on = false;
  },
  onTouchCancel: () => {
    scrub.on = false;
  },
};
/* A DRAG ACROSS THE SCREEN DOES NOT ALSO SCROLL THE PAGE UP AND DOWN
 * (owner, 2026-11-22, of the profile's three tabs: "whenever I'm swiping
 * back and forth between them, I can still scroll up and down. We probably
 * want to make it to where if you're scrolling left or right, you can't
 * scroll up and down"). A drag between tabs is taken by a responder in
 * the app's own code, and the phone's scroller under it knows nothing of
 * that: it went on following the finger's up and down. Whatever takes a
 * drag across says so here as it takes it and again as it lets go (the
 * profile's tabs, the shell's tabs, the edge a page is dragged back by),
 * and every page that scrolls (useScrollDir, above) is held still in
 * between. */
const side = { on: false, subs: new Set<() => void>() };
const sideListen = (f: () => void) => {
  side.subs.add(f);
  return () => {
    side.subs.delete(f);
  };
};
const sideRead = () => side.on;
export function setSideDrag(on: boolean): void {
  if (side.on === on) return;
  side.on = on;
  side.subs.forEach((f) => f());
}
export function useModalHold(): void {
  useEffect(() => {
    modals.open++;
    return () => {
      modals.open--;
    };
  }, []);
}

/* THE PHOTOS, WHOLE (owner, 2026-11-21: "if I click on the photos, I should
 * be able to swipe through them, and the background doesn't need to be
 * transparent. It can be black, and we should have two buttons, one on the
 * top left, one on the top right, one to exit ... an X on one side and the
 * three dots on the right side, and the three dots should bring up the
 * report button"). A black page, one photo to a screen, a swipe to the
 * other, and a mark at the foot for which of the two is showing. */
export function PhotoViewer({ photos, stamps, start, onClose, onMenu, onAt, children }: { photos: Photo[]; stamps?: string[][]; start: number; onClose: () => void; onMenu?: () => void; onAt?: (i: number) => void; children?: ReactNode }) {
  const win = useWindowDimensions();
  useModalHold();
  const [at, setAt] = useState(start);
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const w = win.width;
  const btn = { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const };
  const see = (i: number) => {
    if (i === at) return;
    setAt(i);
    onAt?.(i);
  };
  const go = (i: number) => {
    const to = Math.max(0, Math.min(photos.length - 1, i));
    /* At once: a tap is not a swipe (owner, 2026-11-22: "it can just
     * immediately change the photo. It doesn't have to scroll it"). */
    list.current?.scrollTo({ x: to * w, animated: false });
    see(to);
  };
  useEffect(() => {
    onAt?.(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stamp = stamps?.[at];
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <ScrollView
          ref={list}
          horizontal
          {...sideways}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: start * w, y: 0 }}
          onLayout={() => list.current?.scrollTo({ x: start * w, animated: false })}
          onScroll={(e) => see(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, w)))}
          scrollEventThrottle={32}
          style={{ flex: 1 }}
        >
          {photos.map((p, i) => (
            /* A TAP at the right goes on, at the left goes back (owner,
               2026-11-22: "let me tap through them"); a swipe does the same.
               A ROW'S TWO PHOTOS: a tap anywhere is the other one, round
               and round (owner, 2026-11-24: "anywhere where we're opening up
               those 2 photos, we should be able to tap and have them loop
               back and forth ... I had to like tap one direction then the
               other direction"). */
            <Pressable key={i} onPress={(e) => go(photos.length === 2 ? 1 - i : e.nativeEvent.locationX > w / 2 ? i + 1 : i - 1)} style={{ width: w, height: "100%", justifyContent: "center" }}>
              {Math.abs(i - at) <= 2 ? <Image source={{ uri: p.full }} resizeMode="contain" style={{ width: w, height: "100%" }} /> : null}
            </Pressable>
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
        {/* WHOSE AND WHEN, as a stamp at the foot, where a row of dots was
            (owner, 2026-11-22: "I don't need the dots at the bottom ... it
            can be the ID information ... like a stamp"). Small, under the
            picture's own edge where the picture is not full height. */}
        {stamp ? (
          <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 30 }}>
            {stamp.map((line, i) => (
              <Text key={i} numberOfLines={1} style={{ fontFamily: i === 0 ? F.bold : F.mono, fontSize: i === 0 ? 15 : 11, color: "#fff", opacity: i === 0 ? 1 : 0.8, marginTop: i ? 3 : 0, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 6 }}>
                {line}
              </Text>
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

/* THE METAL PLATE (owner, 2026-11-22: "whenever we have telemetry, I need
 * it to look premium ... like Amex Platinum ... think like a premium metal
 * credit card ... that card ... or maybe just their nameplate"). One word
 * engraved on brushed platinum: light across it at a slant, a bright edge
 * along the top, a hairline round it. The metal is the same on the white
 * page and the black one, which is what makes it read as a thing and not
 * as a label. Until that day the word was white mono capitals on an ink
 * box. */
let plates = 0;
export function Plate({ label, height = 18 }: { label: string; height?: number }) {
  const [w, setW] = useState(0);
  const id = useRef(`plate${++plates}`).current;
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ height, paddingHorizontal: 7, justifyContent: "center", borderRadius: 3, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "#6d7176", backgroundColor: "#cfd2d5" }}>
      {w ? (
        <Svg width={w} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#f7f7f5" />
              <Stop offset="0.3" stopColor="#c3c6ca" />
              <Stop offset="0.52" stopColor="#eeefef" />
              <Stop offset="0.74" stopColor="#a6aaaf" />
              <Stop offset="1" stopColor="#dddfe1" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={height} fill={`url(#${id})`} />
          <Rect x={0} y={0} width={w} height={1} fill="#ffffff" opacity={0.85} />
          <Rect x={0} y={height - 1} width={w} height={1} fill="#5f6368" opacity={0.35} />
        </Svg>
      ) : null}
      <Text style={{ fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.6, color: "#23262a" }}>{label}</Text>
    </View>
  );
}

/* THE TWO PHOTOS OF A ROW AS ONE PICTURE, edge to edge, in the tallest
 * frame Instagram takes, three wide by four tall (owner, 2026-11-22: "I
 * definitely like tall ... whatever the largest format Instagram uses,
 * that's the one we're using"). A TAP SWAPS TO THE OTHER ("ours is going
 * to have two photos only, and if you tap them, it'll swap back and
 * forth"), and there are no dots under it ("let's take away the dots
 * because every post is going to have two photos"). Both are loaded from
 * the start, so the swap is at once. A long press opens the photo whole,
 * with the run of every photo in the list behind it as before; or, where
 * the list has a menu for a held row (`onHold`, lift.tsx LiftMenu), it opens
 * that, and the photo whole is a line of the menu. Where the photo sits on
 * the screen goes with it (`from`), so the menu's card can lift off from it
 * (lift.tsx; owner, 2026-11-23: "lift it off the page"). */
export type Held = { at: number; view: () => void; from?: { x: number; y: number; w: number; h: number } };
export function PhotoSwap({ photos, gallery, style, ratio = 3 / 4, onHold }: { photos: Photo[]; gallery?: Gallery; style?: StyleProp<ViewStyle>; ratio?: number; onHold?: (h: Held) => void }) {
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [dots, setDots] = useState(false);
  const seen = useRef(0);
  const frame = useRef<ComponentRef<typeof View>>(null);
  const hold = (h: Held) => {
    if (!onHold) return;
    const v = frame.current;
    if (!v) return onHold(h);
    v.measureInWindow((x, y, w, hh) => onHold(w > 0 && hh > 0 ? { ...h, from: { x, y, w, h: hh } } : h));
  };
  if (!photos.length) return null;
  const shown = photos.slice(0, 2);
  const i = Math.min(at, shown.length - 1);
  const close = () => setDots(false);
  const leave = () => {
    setDots(false);
    setOpen(null);
  };
  return (
    <View style={style}>
      <Pressable ref={frame} accessibilityRole="imagebutton" accessibilityLabel={shown.length > 1 ? (i === 0 ? "The rower's photo. Tap for the monitor's." : "The monitor's photo. Tap for the rower's.") : "The row's photo"} onPress={() => (shown.length > 1 ? setAt(1 - i) : setOpen(0))} delayLongPress={onHold ? HOLD_MS : undefined} onLongPress={() => (onHold ? hold({ at: i, view: () => setOpen(i) }) : setOpen(i))} style={{ width: "100%", aspectRatio: ratio, backgroundColor: C.pale }}>
        {shown.map((p, k) => (
          <Image key={k} source={{ uri: p.full }} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: "100%", height: "100%", opacity: k === i ? 1 : 0 }]} />
        ))}
      </Pressable>
      {open !== null ? (
        <PhotoViewer photos={gallery ? gallery.photos : shown} stamps={gallery?.stamps} start={gallery ? gallery.offset + open : open} onAt={(n) => (seen.current = n)} onClose={() => setOpen(null)} onMenu={gallery?.menu ? () => setDots(true) : undefined}>
          {dots && gallery?.menu ? gallery.menu(seen.current, close, leave) : null}
        </PhotoViewer>
      ) : null}
    </View>
  );
}

/* A ROW, HELD (owner, 2026-11-23, with Instagram's own open beside the app:
 * "give me the ability to have a UI like this where we can hold or long
 * press or deep press, whatever Instagram uses ... let me be able to open
 * up a menu like that by ... pressing down on the item on that feed").
 *
 * What Instagram does there is a press that is held, about a third of a
 * second, and that is what this is (HOLD_MS). The screen behind goes dark;
 * the row comes forward as a card, who and when over its photo; and under
 * the card a short list, a picture and a word to a line. A press anywhere
 * off the list closes it. The lines are the caller's: SWAP PHOTO, SHARE
 * LINK and STICKERS on the feed ("swap photo ... switches the two photos
 * ... share a link, and then the stickers"). It buzzes under the thumb as
 * it opens, in a build that can (buzz.ts).
 *
 * A LINE THAT HANDS SOMETHING TO THE PHONE'S SHARE SHEET KEEPS THE MENU UP
 * UNTIL THE SHEET IS DONE (`wait`; owner, 2026-11-23: "when I hit the ...
 * share link, nothing happened"). The menu closed first and the sheet was
 * asked for in the same breath; a phone will not bring a sheet up from a
 * screen that is on its way out, and says nothing about it. Now the sheet
 * comes up over the menu, and the menu goes when the sheet does.
 *
 * The menu itself is lift.tsx LiftMenu since 2026-11-23 (owner: "I want to
 * pick it up and lift it up and make it bigger"): the card flies up out of
 * the held photo and back into it. The hold's length and the lines are
 * still here. */
export const HOLD_MS = 320;
export type HoldItem = { label: string; icon: ReactNode; onPress: () => void | Promise<unknown>; wait?: boolean };
