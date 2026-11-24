import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { Photo } from "./api";
import { buzz } from "./buzz";
import { C, F } from "./theme";
import { Avatar, useModalHold, type HoldItem } from "./ui";

/* A ROW, HELD, LIFTED OFF THE PAGE (owner, 2026-11-23: "whenever we hover
 * over or like hard press one of the posts on the gallery, I need it to like
 * animate open ... right now it just pops open ... I want to pick it up and
 * lift it up and make it bigger ... But I want to take it, lift it off the
 * page, show it, give it the options. Then I can swipe down and have it be
 * removed. Also, I feel like when I press and hold it to view it, I also want
 * to see the how long and how fast stat").
 *
 * The first cut of this (round 33, then ui.tsx HoldMenu) was Instagram's
 * held post: the screen behind goes dark, the row comes forward as a card,
 * who and when over its photo, and under it a short list, a picture and a
 * word to a line. That is all still here. What is new is how it comes and
 * goes:
 *
 *   UP. The caller measures where the held photo sits on the screen (`from`,
 *   measureInWindow) and the photo is first drawn there, the same size, over
 *   itself. It springs from there to the middle of the screen and grows to
 *   the card's width, about a third of a second; the page behind darkens as
 *   it goes, and the card's paper, its shadow, who and when over it and the
 *   row's figures under it (DISTANCE, PACE, TIME) come up round the photo
 *   in the last part of the way. The list comes up under it.
 *
 *   DOWN. A drag down takes the card with the finger and makes it a little
 *   smaller as it goes, and the dark behind it thins, so the page shows
 *   through. Let go past a hand's width, or with a flick, and the photo goes
 *   back into its own square and the dark is gone; short of that it springs
 *   back to the middle. A press off the card, on the card, or the phone's
 *   back does the same as a drag down past the mark.
 *
 * The square on the page stays as it is underneath: the photo lands on top
 * of it and the cover goes. With "reduce motion" on in the phone's settings
 * nothing flies: the card fades up in the middle and fades away there.
 *
 * The finger that held the square is still on the page when the card comes
 * up, and the phone keeps that touch on the page: it lifts, and a new touch
 * drags the card. MINE: carrying one touch from the page onto the card
 * would take the whole grid's touches into this, and that is not built. */

export type Rect = { x: number; y: number; w: number; h: number };
export type Figures = { meters: string; pace: string; time: string };

const native = Platform.OS !== "web";

/* Whether the phone asks for less motion, kept as the phone says it, so the
 * card knows at once as it opens. */
let still = false;
try {
  AccessibilityInfo.isReduceMotionEnabled().then(
    (v) => {
      still = v;
    },
    () => null,
  );
  AccessibilityInfo.addEventListener("reduceMotionChanged", (v: boolean) => {
    still = v;
  });
} catch {
  /* No such reading here: the card flies. */
}

/* Where a view is on the screen, for `from`: nothing when it is not laid
 * out (the card then comes up in the middle as before). */
export type Spot = ComponentRef<typeof View>;
export function whereOnScreen(v: Spot | null | undefined, then: (r: Rect | undefined) => void): void {
  if (!v) return then(undefined);
  v.measureInWindow((x, y, w, h) => then(w > 0 && h > 0 ? { x, y, w, h } : undefined));
}

/* TWO TAPS ON THE CARD (owner, 2026-11-23: "allow me to tap the photo and
 * have it swap the photo, but if I tap the stats down at the bottom, take
 * me to that row"): `photos`, the row's photos from the one held, turn over
 * on a tap of the photo; `onOpen` is the row, opened from the figures. */
export function LiftMenu({ head, photo, photos, figures, from, items, onClose, onOpen }: { head?: { name: string; sub?: string; avatar?: string | null; num?: number | string }; photo: Photo; photos?: Photo[]; figures?: Figures; from?: Rect; items: HoldItem[]; onClose: () => void; onOpen?: () => void }) {
  const [turn, setTurn] = useState(0);
  const many = (photos?.length ?? 0) > 1;
  const showing = many && photos ? photos[turn % photos.length] : photo;
  useModalHold();
  const win = useWindowDimensions();
  const p = useRef(new Animated.Value(0)).current;
  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  /* Settled as it opens: the square it came from and whether it may fly. */
  const fly = useRef(!!from && !still).current;
  const calm = useRef(still).current;
  const shut = useRef(onClose);
  shut.current = onClose;
  const gone = useRef(false);

  const LINE = 50;
  const HEAD = head ? 56 : 0;
  const STATS = figures ? 62 : 0;
  const GAP = 12;
  const menuW = 236;
  const W = win.width;
  const H = win.height;
  /* Upright: the card over the list, as tall as the two fit. On its side:
   * the card beside the list. */
  const flat = W > H;
  const menuH = items.length * LINE;
  const tall = flat ? H - 48 - HEAD - STATS : H - 132 - HEAD - STATS - GAP - menuH;
  const cardW = Math.round(Math.max(150, Math.min(flat ? W - menuW - GAP - 48 : W - 32, 440, (tall * 3) / 4)));
  const photoH = Math.round((cardW * 4) / 3);
  const cardH = HEAD + photoH + STATS;
  const left = Math.round(flat ? (W - cardW - GAP - menuW) / 2 : (W - cardW) / 2);
  const top = Math.max(8, Math.round(flat ? (H - cardH) / 2 : (H - cardH - GAP - menuH) / 2));
  const menuX = flat ? left + cardW + GAP : left;
  const menuY = flat ? top + cardH - menuH : top + cardH + GAP;

  /* Where the card starts: drawn at its place in the middle and moved and
   * shrunk so that its PHOTO sits exactly on the held square. A transform
   * scales about the card's own middle, and the photo's middle is below the
   * card's by half of who-and-when less half of the figures. */
  const cx = left + cardW / 2;
  const cy = top + cardH / 2;
  const py = top + HEAD + photoH / 2;
  const s0 = fly && from ? from.w / cardW : calm ? 1 : 0.92;
  const x0 = fly && from ? from.x + from.w / 2 - cx : 0;
  const y0 = fly && from ? from.y + from.h / 2 - cy - s0 * (py - cy) : 0;

  const scale = Animated.multiply(p.interpolate({ inputRange: [0, 1], outputRange: [s0, 1] }), dy.interpolate({ inputRange: [0, 420], outputRange: [1, 0.8], extrapolate: "clamp" }));
  const tx = Animated.add(p.interpolate({ inputRange: [0, 1], outputRange: [x0, 0] }), dx);
  const ty = Animated.add(p.interpolate({ inputRange: [0, 1], outputRange: [y0, 0] }), dy);
  const trans = [{ translateX: tx }, { translateY: ty }, { scale }];
  const shown = p.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" });
  /* The paper, the words and the figures come in the last part of the way
   * up, and go in the first part of the way down. */
  const late = p.interpolate({ inputRange: [0.35, 1], outputRange: [0, 1], extrapolate: "clamp" });
  const scrim = Animated.multiply(shown, dy.interpolate({ inputRange: [0, 420], outputRange: [1, 0.3], extrapolate: "clamp" }));
  const menuOp = Animated.multiply(late, dy.interpolate({ inputRange: [0, 100], outputRange: [1, 0], extrapolate: "clamp" }));
  const menuRise = p.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  useEffect(() => {
    buzz.thud();
    (fly
      ? Animated.spring(p, { toValue: 1, stiffness: 320, damping: 26, mass: 1, useNativeDriver: native })
      : Animated.timing(p, { toValue: 1, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: native })
    ).start();
  }, [p, fly]);

  /* Back into the square (or, with less motion, away where it is), then
   * gone. */
  const leave = useRef(() => {
    if (gone.current) return;
    gone.current = true;
    const to0 = (v: Animated.Value, ms: number) => Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    Animated.parallel(fly ? [to0(p, 280), to0(dx, 280), to0(dy, 280)] : [to0(p, 180)]).start(() => shut.current());
  }).current;
  const back = () => {
    const spring0 = (v: Animated.Value) => Animated.spring(v, { toValue: 0, stiffness: 300, damping: 24, mass: 1, useNativeDriver: native });
    Animated.parallel([spring0(dx), spring0(dy)]).start();
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => !gone.current && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        dx.setValue(g.dx);
        /* Down follows the finger; up gives a little and no more. */
        dy.setValue(g.dy > 0 ? g.dy : g.dy / 4);
      },
      onPanResponderRelease: (_, g) => (g.dy > 110 || g.vy > 0.9 ? leave() : back()),
      onPanResponderTerminate: () => back(),
    }),
  ).current;

  const box = { position: "absolute" as const, left, top, width: cardW, height: cardH, borderRadius: 18 };
  return (
    <Modal visible transparent animationType="none" onRequestClose={leave} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,10,14,0.8)", opacity: scrim }]}>
          <Pressable accessibilityLabel="Close" onPress={leave} style={{ flex: 1 }} />
        </Animated.View>
        {/* The card's paper and its shadow, under the card, coming up with
            the words: the photo flies alone and lands on it. */}
        <Animated.View pointerEvents="none" style={[box, { backgroundColor: C.paper, opacity: late, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 16, transform: trans }]} />
        <Animated.View {...pan.panHandlers} style={[box, { overflow: "hidden", elevation: 16, transform: trans }]}>
          <Pressable accessibilityLabel="Close" accessibilityHint="Or drag it down" onPress={leave} style={{ flex: 1 }}>
            {head ? (
              <Animated.View style={{ height: HEAD, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, backgroundColor: C.paper, opacity: late }}>
                <Avatar uri={head.avatar} name={head.name} num={head.num} size={34} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: F.semi, fontSize: 14.5, color: C.ink }}>
                    {head.name}
                  </Text>
                  {head.sub ? (
                    <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 12.5, color: C.gray, marginTop: 1 }}>
                      {head.sub}
                    </Text>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}
            {/* The small copy the square shows under the whole one, so the
                photo is there from the first frame of the lift. */}
            <Pressable accessibilityRole={many ? "button" : undefined} accessibilityLabel={many ? "The other photo" : undefined} disabled={!many} onPress={() => setTurn((t) => t + 1)}>
              <Animated.View style={{ width: cardW, height: photoH, backgroundColor: C.pale, opacity: fly ? 1 : shown }}>
                {showing.thumb ? <Image source={{ uri: showing.thumb }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
                <Image source={{ uri: showing.full }} resizeMode="cover" style={StyleSheet.absoluteFill} />
              </Animated.View>
            </Pressable>
            {figures ? (
              <Pressable
                accessibilityRole={onOpen ? "link" : undefined}
                accessibilityLabel={onOpen ? "Open the row" : undefined}
                disabled={!onOpen}
                onPress={() => {
                  if (gone.current || !onOpen) return;
                  gone.current = true;
                  shut.current();
                  onOpen();
                }}
              >
                <Animated.View style={{ height: STATS, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, backgroundColor: C.paper, opacity: late }}>
                  <Figure k="Distance" v={figures.meters} />
                  <Figure k="Pace" v={figures.pace} u="/500m" />
                  <Figure k="Time" v={figures.time} />
                </Animated.View>
              </Pressable>
            ) : null}
          </Pressable>
        </Animated.View>
        <Animated.View accessibilityRole="menu" style={{ position: "absolute", left: menuX, top: menuY, width: menuW, borderRadius: 14, overflow: "hidden", backgroundColor: C.paper, elevation: 16, opacity: menuOp, transform: [{ translateY: menuRise }] }}>
          {items.map((it, k) => (
            <Pressable
              key={it.label}
              accessibilityRole="menuitem"
              accessibilityLabel={it.label}
              onPress={() => {
                if (gone.current) return;
                /* A line that hands something to the share sheet keeps the
                   card up until the sheet is done (HoldItem `wait`), then the
                   card goes back into its square. The others go somewhere
                   else at once, and the card with them. */
                if (it.wait) {
                  Promise.resolve(it.onPress())
                    .catch(() => null)
                    .then(leave);
                  return;
                }
                gone.current = true;
                shut.current();
                it.onPress();
              }}
              style={({ pressed }) => ({ height: LINE, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, borderTopWidth: k ? 1 : 0, borderColor: C.line, backgroundColor: pressed ? C.pale : C.paper })}
            >
              {it.icon}
              <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 16.5, color: C.ink }}>
                {it.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* One figure of the row under the photo, as the feed's card sets them: a
 * small grey word over the number in ink (Feed.tsx Stat). */
function Figure({ k, v, u }: { k: string; v: string; u?: string }) {
  return (
    <View>
      <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.soft }}>{k}</Text>
      <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 18, lineHeight: 23, color: C.ink, fontVariant: ["tabular-nums"], marginTop: 1 }}>
        {v}
        {u ? <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.gray }}> {u}</Text> : null}
      </Text>
    </View>
  );
}
