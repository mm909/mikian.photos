import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Image, Modal, PanResponder, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { api, peek } from "../api";
import { CloseIcon } from "../icons";
import { mono } from "../site";
import { C, F, wholeSplit } from "../theme";
import { Avatar, scrub, useModalHold } from "../ui";

/* THE STORY RECAP, ATOP THE FEED (owner, 2026-11-23: "a story recap. I want
 * anyone who has rowed in the last 24 hours to show up kind of like a story
 * at the top of the feed. And when we click it, something similar to
 * stories happens ... we'll just show their first photo and some text about
 * length and time and who did it"; "We can build that, ship it, and we'll
 * see how we like it").
 *
 * A row of circles over the first card, one for every rower who logged a
 * row in the last 24 hours that the feed would show this viewer (the
 * server decides: api/row100k/app/recap), the viewer's own first. The ring
 * is the blue until every row in it has been seen on this phone, then the
 * hairline. Gone altogether when nobody has rowed in a day.
 *
 * A circle opens the stories, one page to a row (RecapViewer, below). Not
 * screens/Stories.tsx: that is the FAQs. */

const PATH = "/api/row100k/app/recap";
const SEEN_KEY = "recap/seen/1";
/* How long a page stands before the next ("auto-advance every ~5 s"). */
const SHOW_MS = 5000;
const ND = Platform.OS !== "web";

type RecapPhoto = { full: string; thumb: string | null };
/* `photos` is the row's first two (owner, 2026-11-24); a server from before
 * it sends only `photo`, the first. */
export type RecapRow = { id: string; meters: number; seconds: number; metersStr: string; durationStr: string; splitStr: string; title: string; photo: RecapPhoto | null; photos?: RecapPhoto[]; absIso: string };
export type RecapRower = { rowerNumber: number; numStr: string; name: string; avatar: string | null; me: boolean; latest: string; rows: RecapRow[] };
type RecapPage = { rowers: RecapRower[] };

/* BOTH PHOTOS, ONE RIGHT AFTER THE OTHER (owner, 2026-11-24: "When I am
 * looking through stories, I actually do want to look through both of the
 * rows, photos. So just one right after the other. Post both of them"). A
 * story page is a FRAME: a row with two photos is two frames back to back,
 * the first photo then the second, its length and time on both; a row with
 * one photo, or none, is one. */
type Frame = { row: RecapRow; photo: RecapPhoto | null; key: string };
function framesOf(r: RecapRower): Frame[] {
  const out: Frame[] = [];
  for (const row of r.rows) {
    const photos = row.photos?.length ? row.photos : row.photo ? [row.photo] : [];
    if (!photos.length) out.push({ row, photo: null, key: row.id });
    else photos.forEach((photo, k) => out.push({ row, photo, key: `${row.id}/${k}` }));
  }
  return out;
}

/* WHICH ROWS HAVE BEEN SEEN, on this phone: the ids, newest last, the last
 * few hundred kept. A day's rows are a few dozen. */
let seenCache: string[] | null = null;
async function readSeen(): Promise<string[]> {
  if (seenCache) return seenCache;
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    seenCache = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    seenCache = [];
  }
  return seenCache;
}
function writeSeen(ids: string[]): void {
  seenCache = ids.slice(-600);
  AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seenCache)).catch(() => null);
}

/* "12m", "3h": how long ago, as a story says it. */
function ago(iso: string): string {
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  return `${Math.min(24, Math.floor(m / 60))}h`;
}
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/* THE CIRCLES. `again` moves when the feed is pulled down or a row is
 * logged, and the recap reads again with it. */
export function RecapStrip({ again, onRow, onRower }: { again: string; onRow: (id: string) => void; onRower: (n: number) => void }) {
  const kept = peek<RecapPage>(PATH);
  const [rowers, setRowers] = useState<RecapRower[]>(kept?.rowers ?? []);
  const [seen, setSeen] = useState<Set<string>>(() => new Set(seenCache ?? []));
  const [open, setOpen] = useState<number | null>(null);
  /* Whether the circles run past the screen: only then does a drag across
   * them belong to them and not to the tabs. */
  const [wide, setWide] = useState({ view: 0, content: 0 });
  useEffect(() => {
    readSeen().then((ids) => setSeen(new Set(ids)));
  }, []);
  useEffect(() => {
    let live = true;
    api<RecapPage>(PATH)
      .then((p) => live && setRowers(p.rowers ?? []))
      /* Not read: what was there stays, or nothing is drawn. */
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [again]);
  const mark = (id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeSeen([...(seenCache ?? []).filter((x) => x !== id), id]);
      return next;
    });
  };
  if (!rowers.length) return null;
  const done = (r: RecapRower) => r.rows.every((x) => seen.has(x.id));
  const RING = 70;
  const FACE = RING - 10;
  const overflow = wide.content > wide.view + 1;
  return (
    /* No rule under the circles (owner, 2026-11-23: "I don't like the line
       that's underneath the stories"). */
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setWide((w) => ({ ...w, view: e.nativeEvent.layout.width }))}
        onContentSizeChange={(cw) => setWide((w) => ({ ...w, content: cw }))}
        /* A drag along circles that run off the screen is theirs; the tabs
           stay put (ui.tsx scrub, cleared as the next touch begins). */
        onTouchStart={() => {
          if (overflow) scrub.on = true;
        }}
        onTouchEnd={() => {
          scrub.on = false;
        }}
        onTouchCancel={() => {
          scrub.on = false;
        }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, gap: 6 }}
      >
        {rowers.map((r, i) => {
          const fresh = !done(r);
          return (
            <Pressable key={r.rowerNumber} accessibilityRole="button" accessibilityLabel={`${r.me ? "Your rows" : `${r.name}'s rows`} of the last day${fresh ? ", not seen" : ""}`} onPress={() => setOpen(i)} style={({ pressed }) => ({ width: RING + 6, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
              <View style={{ width: RING, height: RING, borderRadius: RING / 2, borderWidth: fresh ? 2.5 : 1.5, borderColor: fresh ? C.accent : C.line, alignItems: "center", justifyContent: "center" }}>
                <Face r={r} size={FACE} />
              </View>
              <Text numberOfLines={1} style={[mono(10, false, fresh ? C.ink : C.gray, 0.08), { marginTop: 6, maxWidth: RING + 6 }]}>
                {r.me ? "You" : firstName(r.name)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {open !== null ? (
        <RecapViewer
          rowers={rowers}
          start={open}
          seen={seen}
          onSeen={mark}
          onClose={() => setOpen(null)}
          onRow={(id) => {
            setOpen(null);
            onRow(id);
          }}
          onRower={(n) => {
            setOpen(null);
            onRower(n);
          }}
        />
      ) : null}
    </View>
  );
}

/* The face, or the rower's number in a circle where there is no photo. */
function Face({ r, size, light }: { r: RecapRower; size: number; light?: boolean }) {
  if (r.avatar) return <Avatar uri={r.avatar} name={r.name} size={size} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: light ? "rgba(255,255,255,0.18)" : C.pale, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: F.monoBold, fontSize: Math.round(size * 0.3), letterSpacing: 0.5, color: light ? "#fff" : C.ink }}>{r.numStr}</Text>
    </View>
  );
}

/* THE STORIES, WHOLE (owner, 2026-11-23: "something similar to stories
 * happens ... The numbers ... can be either in the header, next to their
 * name, or it can be down at the bottom ... should there be a way to go to
 * the row? Like if you tap in the middle of an Instagram story ... you can
 * go to their page ... there's probably a section or an area that you can
 * click on that lets you go to that row, and then otherwise it lets you just
 * go to the next one").
 *
 * One page to a photo of a row (framesOf, above: a row's two photos are two
 * pages, 2026-11-24), the photo filling the screen; a row with no photo is a
 * plain page on the paper with its figures big. The bars over the top, one
 * to a page of this rower's, fill as the page stands. Under
 * them the rower's face, number and name (a tap opens the rower) and how
 * long ago. At the foot the meters big, and the time and the pace: a tap
 * there opens the row. Anywhere else, the right two thirds go on and the
 * left third goes back; a page goes on by itself after five seconds; a
 * finger held down stops it; a drag down closes it. Past a rower's last
 * row is the next rower's first not yet seen; past the last new one, it
 * closes. */
export function RecapViewer({ rowers, start, seen, onSeen, onClose, onRow, onRower }: { rowers: RecapRower[]; start: number; seen: Set<string>; onSeen: (id: string) => void; onClose: () => void; onRow: (id: string) => void; onRower: (n: number) => void }) {
  useModalHold();
  const win = useWindowDimensions();
  /* Where a rower opens: their first row not yet seen, as things stood
   * when the viewer opened, so marking a page seen does not move it. */
  const seenAtOpen = useRef(seen).current;
  /* Each rower's pages, a page to a photo. */
  const frames = useMemo(() => rowers.map(framesOf), [rowers]);
  const firstOpen = (ri: number) => Math.max(0, frames[ri]?.findIndex((f) => !seenAtOpen.has(f.row.id)) ?? 0);
  const [pos, setPos] = useState(() => ({ r: start, p: firstOpen(start) }));
  const posRef = useRef(pos);
  posRef.current = pos;
  const rower = rowers[pos.r];
  const pages = frames[pos.r] ?? [];
  const frame = pages[pos.p];
  const row = frame?.row;

  const prog = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const held = useRef(false);
  const dragging = useRef(false);
  const at = useRef(0);
  const closing = useRef(false);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    anim.current?.stop();
    onClose();
  };
  const go = (to: { r: number; p: number }) => {
    posRef.current = to;
    setPos(to);
  };
  const next = () => {
    const { r, p } = posRef.current;
    if (p < (frames[r]?.length ?? 0) - 1) return go({ r, p: p + 1 });
    /* PAST THE LAST NEW ONE, IT CLOSES (owner, 2026-11-24: "when I finish
     * all the new stories, go ahead and close out the stories for me"):
     * past a rower's last page is the next rower with a page not yet seen
     * when the viewer opened; with none left, the viewer closes. A circle
     * already seen still opens and plays when it is tapped. */
    const ahead = frames.findIndex((fs, i) => i > r && fs.some((f) => !seenAtOpen.has(f.row.id)));
    if (ahead >= 0) go({ r: ahead, p: firstOpen(ahead) });
    else close();
  };
  const prev = () => {
    const { r, p } = posRef.current;
    if (p > 0) go({ r, p: p - 1 });
    else if (r > 0) go({ r: r - 1, p: 0 });
    else run(0); // back on the very first page: it starts again
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  const run = (from: number) => {
    anim.current?.stop();
    prog.setValue(from);
    anim.current = Animated.timing(prog, { toValue: 1, duration: Math.max(1, SHOW_MS * (1 - from)), easing: Easing.linear, useNativeDriver: ND });
    anim.current.start(({ finished }) => {
      if (finished && !held.current) nextRef.current();
    });
  };
  const pause = () => {
    held.current = true;
    anim.current?.stop();
    prog.stopAnimation((v) => {
      at.current = v;
    });
  };
  const resume = () => {
    /* A finger dragging the page down keeps it stopped, whatever the tap
     * under it says as it is let go. */
    if (!held.current || dragging.current) return;
    held.current = false;
    run(at.current);
  };

  /* Each page: seen, its bar from empty, the next page's photo fetched. */
  useEffect(() => {
    if (!row) return;
    onSeen(row.id);
    at.current = 0;
    if (held.current) prog.setValue(0);
    else run(0);
    const after = pages[pos.p + 1] ?? frames[pos.r + 1]?.[0];
    if (after?.photo) Image.prefetch(after.photo.full).catch(() => null);
    return () => anim.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.r, pos.p]);

  /* A DRAG DOWN CLOSES IT; a short one springs back and the page goes on. */
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderGrant: () => {
        dragging.current = true;
        pause();
      },
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        dragging.current = false;
        if (g.dy > 110 || g.vy > 0.9) {
          Animated.timing(drag, { toValue: win.height, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: ND }).start(() => close());
          return;
        }
        Animated.spring(drag, { toValue: 0, friction: 8, tension: 90, useNativeDriver: ND }).start();
        resume();
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        Animated.spring(drag, { toValue: 0, friction: 8, tension: 90, useNativeDriver: ND }).start();
        resume();
      },
    }),
  ).current;
  /* BELOW THE CAMERA (owner, 2026-11-23: "the bar for like how long the
   * story is going ... is covered by ... the little black like camera bar on
   * my iPhone, so it probably needs to go a little lower"): how far down the
   * phone's own top edge reaches, read off a SafeAreaView (in every build,
   * unlike the safe-area module) on an iPhone, the status bar on Android. */
  const [safeTop, setSafeTop] = useState(Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : Platform.OS === "ios" ? 54 : 0);

  if (!rower || !frame || !row) return null;
  const photo = frame.photo;
  /* Over a photo the type is white; on the plain page it is the ink. */
  const fg = photo ? "#fff" : C.ink;
  const shade: TextStyle | null = photo ? { textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 8 } : null;
  const GAP = 4;
  const n = pages.length;
  const segW = Math.max(4, (win.width - 16 - GAP * (n - 1)) / n);
  const TOP = safeTop + 8;
  const pace = row.splitStr ? wholeSplit(row.splitStr) : "";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {Platform.OS === "ios" ? (
          <SafeAreaView pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
            <View onLayout={(e) => setSafeTop(Math.round(e.nativeEvent.layout.y))} style={{ height: 1 }} />
          </SafeAreaView>
        ) : null}
        <Animated.View
          {...pan.panHandlers}
          style={{ flex: 1, backgroundColor: photo ? "#000" : C.paper, overflow: "hidden", transform: [{ translateY: drag }, { scale: drag.interpolate({ inputRange: [0, win.height], outputRange: [1, 0.85], extrapolate: "clamp" }) }] }}
        >
          {photo ? <Image key={frame.key} source={{ uri: photo.full }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
          {/* A dark wash at the top and the foot, so the white type reads over
              any photo. */}
          {photo ? (
            <Svg pointerEvents="none" width={win.width} height={win.height} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="recapTop" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000" stopOpacity={0.55} />
                  <Stop offset="1" stopColor="#000" stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id="recapFoot" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000" stopOpacity={0} />
                  <Stop offset="1" stopColor="#000" stopOpacity={0.7} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={win.width} height={170} fill="url(#recapTop)" />
              <Rect x={0} y={win.height - 300} width={win.width} height={300} fill="url(#recapFoot)" />
            </Svg>
          ) : null}

          {/* THE TAPS: the left third back, the rest on; held, it stops. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next"
            onPressIn={pause}
            onPressOut={resume}
            delayLongPress={250}
            onLongPress={() => null}
            /* Where across the page: the phone gives `locationX`; a browser's
               click may come without it, and the page fills the window, so
               its `pageX` is the same place (2026-11-24, seen in the sandbox:
               a tap on the left went on). */
            onPress={(e) => ((e.nativeEvent.locationX ?? e.nativeEvent.pageX ?? win.width) < win.width / 3 ? prev() : next())}
            style={StyleSheet.absoluteFill}
          />

          {/* THE BARS, one to a page of this rower's. */}
          <View pointerEvents="none" style={{ position: "absolute", top: TOP, left: 8, right: 8, flexDirection: "row", gap: GAP }}>
            {pages.map((x, k) => (
              <View key={x.key} style={{ width: segW, height: 2.5, borderRadius: 2, overflow: "hidden", backgroundColor: photo ? "rgba(255,255,255,0.35)" : C.line }}>
                {k < pos.p ? <View style={{ flex: 1, backgroundColor: fg }} /> : null}
                {k === pos.p ? <Animated.View style={{ width: segW, height: "100%", backgroundColor: fg, transform: [{ translateX: prog.interpolate({ inputRange: [0, 1], outputRange: [-segW, 0] }) }] }} /> : null}
              </View>
            ))}
          </View>

          {/* WHO, and how long ago; the X. */}
          <View pointerEvents="box-none" style={{ position: "absolute", top: TOP + 12, left: 12, right: 6, flexDirection: "row", alignItems: "center" }}>
            <Pressable accessibilityRole="link" accessibilityLabel={`${rower.name}, rower ${rower.numStr}`} onPress={() => onRower(rower.rowerNumber)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
              <Face r={rower} size={34} light={!!photo} />
              <View style={{ flexShrink: 1 }}>
                <Text numberOfLines={1} style={[{ fontFamily: F.semi, fontSize: 15, color: fg }, shade]}>
                  {rower.name}
                </Text>
                <Text numberOfLines={1} style={[mono(10, false, fg, 0.1), { opacity: 0.85, marginTop: 2 }, shade]}>
                  {`${rower.numStr} · ${ago(row.absIso)}`}
                </Text>
              </View>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <CloseIcon color={fg} size={26} />
            </Pressable>
          </View>

          {/* THE ROW: its length big, the time and the pace; a tap opens it.
              At the foot over a photo; in the middle of the plain page. */}
          <View pointerEvents="box-none" style={photo ? { position: "absolute", left: 0, right: 0, bottom: 34 } : { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "center" }}>
            <Pressable accessibilityRole="link" accessibilityLabel={`Open this row: ${row.metersStr}, ${row.durationStr}`} onPressIn={pause} onPressOut={resume} onPress={() => onRow(row.id)} style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 12, opacity: pressed ? 0.7 : 1, alignItems: photo ? "flex-start" : "center" })}>
              {row.title ? (
                <Text numberOfLines={1} style={[mono(11, false, fg, 0.12), { opacity: 0.9, marginBottom: 6 }, shade]}>
                  {row.title}
                </Text>
              ) : null}
              <Text numberOfLines={1} adjustsFontSizeToFit style={[{ fontFamily: F.black, fontSize: photo ? 52 : 64, lineHeight: photo ? 58 : 70, color: fg, letterSpacing: -1, fontVariant: ["tabular-nums"] }, shade]}>
                {row.metersStr}
              </Text>
              <View style={{ flexDirection: "row", gap: 22, marginTop: 6 }}>
                <Fig k="Time" v={row.durationStr} fg={fg} shade={shade} big={!photo} />
                {pace ? <Fig k="Pace" v={`${pace} /500m`} fg={fg} shade={shade} big={!photo} /> : null}
              </View>
              <Text style={[mono(10, false, fg, 0.14), { opacity: 0.75, marginTop: 14 }, shade]}>See the row ›</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* One figure at the foot: a small word over the number. */
function Fig({ k, v, fg, shade, big }: { k: string; v: string; fg: string; shade: TextStyle | null; big?: boolean }) {
  return (
    <View>
      <Text style={[mono(10, false, fg, 0.12), { opacity: 0.8 }, shade]}>{k}</Text>
      <Text style={[{ fontFamily: F.bold, fontSize: big ? 28 : 24, lineHeight: big ? 34 : 30, color: fg, marginTop: 2, fontVariant: ["tabular-nums"] }, shade]}>{v}</Text>
    </View>
  );
}

/* A ROWER'S STORY FROM THEIR PROFILE (owner, 2026-11-23: "if I have rowed in
 * the last 24 hours and I have a story up, that story should also be
 * available to click on my profile page"). The face on a profile, ringed as
 * the feed's circles are (the blue until every row in it is seen on this
 * phone, then the hairline) when that rower has rowed in the last day; a
 * press opens their story alone. Without a story the face is as it was,
 * and a press does nothing. Reads the same recap the feed does, kept. */
export function StoryRing({ num, size, children, onRow, onRower }: { num: number; size: number; children: ReactNode; onRow?: (id: string) => void; onRower?: (n: number) => void }) {
  const kept = peek<RecapPage>(PATH);
  const [rowers, setRowers] = useState<RecapRower[]>(kept?.rowers ?? []);
  const [seen, setSeen] = useState<Set<string>>(() => new Set(seenCache ?? []));
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    readSeen().then((ids) => live && setSeen(new Set(ids)));
    api<RecapPage>(PATH)
      .then((p) => live && setRowers(p.rowers ?? []))
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [num]);
  const mine = rowers.find((r) => r.rowerNumber === num);
  if (!mine) return <>{children}</>;
  const fresh = !mine.rows.every((x) => seen.has(x.id));
  const ring = size + 10;
  const mark = (id: string) =>
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeSeen([...(seenCache ?? []).filter((x) => x !== id), id]);
      return next;
    });
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${mine.me ? "Your" : `${mine.name}'s`} rows of the last day${fresh ? ", not seen" : ""}`} onPress={() => setOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <View style={{ width: ring, height: ring, borderRadius: ring / 2, borderWidth: fresh ? 2.5 : 1.5, borderColor: fresh ? C.accent : C.line, alignItems: "center", justifyContent: "center", margin: -5 }}>{children}</View>
      </Pressable>
      {open ? (
        <RecapViewer
          rowers={[mine]}
          start={0}
          seen={seen}
          onSeen={mark}
          onClose={() => setOpen(false)}
          onRow={(id) => {
            setOpen(false);
            onRow?.(id);
          }}
          onRower={(n) => {
            setOpen(false);
            if (n !== num) onRower?.(n);
          }}
        />
      ) : null}
    </>
  );
}
