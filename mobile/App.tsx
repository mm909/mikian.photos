import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Animated, Easing, Platform, Pressable, SafeAreaView, Text, View, useWindowDimensions } from "react-native";
import { useErg } from "./src/erg/useErg";
import { BackIcon, BellIcon, BoardIcon, DotsIcon, FeedIcon, MenuIcon, PlusIcon, ProfileIcon, SearchIcon, StatsIcon } from "./src/icons";
import { LookCtx, loadLook, saveLook } from "./src/look";
import { BoardScreen } from "./src/screens/Board";
import { FeedScreen } from "./src/screens/Feed";
import { ProfileScreen } from "./src/screens/Profile";
import { RowPage, type Fresh } from "./src/screens/RowPage";
import type { TelemetryDoc } from "./src/pm5/session";
import { RowScreen, type Logged } from "./src/screens/RowScreen";
import { NewsScreen, PeopleScreen, SearchScreen, SettingsScreen, type PeopleList } from "./src/screens/Social";
import { StatsScreen } from "./src/screens/Stats";
import { SessionProvider, useSession } from "./src/session";
import { loadRows, saveDoc, saveRows, type Row } from "./src/store";
import { C, F, fmtClock, fmtInt, setLook } from "./src/theme";

/* ROW, THE APP.
 *
 * THE SHAPE (owner, 2026-11-21, after a first try with words at the bottom
 * and a wide LOG A ROW button up top: "I really like how Instagram's app is
 * set up ... the top bar could look kind of like Instagram, where it's plus
 * on the left, top left, and then a row in the middle, and then
 * notifications on the right. Search at the bottom. We do icons instead of
 * the words"; "if we have that blue square in the back, then have it slide,
 * animate, across from one to the other").
 *
 *   TOP     +  (log a row)  ·  ROW  ·  the bell
 *   BOTTOM  feed · search · board · stats · profile, as glyphs, the blue
 *           square sliding under whichever is open
 *
 * ON A PROFILE the mark in the middle rolls over into the rower's number
 * ("ROW turns into 001 ... a nice little animation to it"), and the right
 * of the bar is the menu: three lines on the viewer's own page (settings),
 * three dots on somebody else's (block, report).
 *
 * Every screen reads the site (src/api.ts): the same routes, the same
 * numbers, the same rules about who is hidden. The one thing that lives on
 * the phone is the row in progress (erg/useErg.ts), held above the screens
 * so leaving the monitor for the feed or a profile does not end it: a strip
 * over the tabs says it is still recording and leads back.
 *
 * No router: a tab, and a short stack of things opened over it (a rower, a
 * row, a list of people, the notifications, the settings). */

type Tab = "feed" | "search" | "board" | "stats" | "profile";
const TABS: { id: Tab; label: string; Icon: ComponentType<{ color?: string; size?: number }> }[] = [
  { id: "feed", label: "Feed", Icon: FeedIcon },
  { id: "search", label: "Search", Icon: SearchIcon },
  { id: "board", label: "Board", Icon: BoardIcon },
  { id: "stats", label: "Stats", Icon: StatsIcon },
  { id: "profile", label: "Profile", Icon: ProfileIcon },
];

type Over =
  | { kind: "rower"; num: number }
  | { kind: "row"; id: string; fresh?: Fresh; doc?: TelemetryDoc }
  | { kind: "news" }
  | { kind: "settings" }
  | { kind: "people"; list: PeopleList; num?: number };

const PEOPLE: Record<PeopleList, string> = { followers: "Followers", following: "Following", requests: "Requests", blocked: "Blocked" };

/* Where the app was, kept above the shell so that changing the look (which
 * mounts the shell afresh) lands on the screen it was changed from. */
type Nav = { tab: Tab; stack: Over[] };

export default function App() {
  const [fontsIn] = useFonts({ ArchivoBlack_400Regular, Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold, SpaceMono_400Regular, SpaceMono_700Bold });
  /* The look this phone last chose is put on before anything is drawn. */
  const [dark, setDarkState] = useState<boolean | null>(null);
  useEffect(() => {
    loadLook().then(setDarkState, () => setDarkState(false));
  }, []);
  if (!fontsIn || dark === null) return <View style={{ flex: 1, backgroundColor: C.paper }} />;
  const setDark = (v: boolean) => {
    setLook(v);
    saveLook(v);
    setDarkState(v);
  };
  return (
    <SessionProvider>
      <LookCtx.Provider value={{ dark, setDark }}>
        <Root dark={dark} />
      </LookCtx.Provider>
    </SessionProvider>
  );
}

/* What must outlive a change of look: the row in progress, and where the
 * app was. */
function Root({ dark }: { dark: boolean }) {
  const erg = useErg();
  const nav = useRef<Nav>({ tab: "board", stack: [] });
  const keep = useRef((n: Nav) => {
    nav.current = n;
  }).current;
  return <Shell key={dark ? "dark" : "light"} dark={dark} erg={erg} init={nav.current} onNav={keep} />;
}

function Shell({ dark, erg, init, onNav }: { dark: boolean; erg: ReturnType<typeof useErg>; init: Nav; onNav: (n: Nav) => void }) {
  const { refresh, me } = useSession();
  const win = useWindowDimensions();
  const [tab, setTab] = useState<Tab>(init.tab);
  const [stack, setStack] = useState<Over[]>(init.stack);
  useEffect(() => {
    onNav({ tab, stack });
  }, [tab, stack, onNav]);
  /* LOG A ROW sits over everything. Once opened it stays mounted until the
   * row is logged, shown or not, so a form half filled survives a look at
   * the feed (the row in progress itself lives in useErg and needs no such
   * care). */
  const [log, setLog] = useState<"closed" | "hidden" | "shown">("closed");
  /* Moves when a row is logged, so the screens that list rows read again. */
  const [stamp, setStamp] = useState(0);
  /* The three dots on somebody else's profile. */
  const [menu, setMenu] = useState(false);
  /* The pieces this phone has recorded, for THE READ to rank against. */
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    loadRows().then(setRows);
  }, []);

  /* DEVELOPMENT, in a browser: ?row=<id> opens that row's page, and
   * &fresh=<metres> plays it as if those metres had just been logged, so
   * the LOGGED animation can be looked at without rowing. */
  const deep = useRef(false);
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== "web" || deep.current || !me.signedIn) return;
    deep.current = true;
    const q = new URLSearchParams(window.location.search);
    const id = q.get("row");
    const m = Number(q.get("fresh"));
    if (!id) return;
    const fresh: Fresh | undefined =
      m > 0 && me.totals && me.month ? { meters: m, monthBefore: me.totals.monthMeters - m, lifeBefore: me.totals.meters - m, inMonth: true, goal: me.month.goal, monthWord: me.month.label.split(" ")[0] } : undefined;
    setStack([{ kind: "row", id, fresh }]);
  }, [me]);

  const logOn = log === "shown";
  const top = logOn ? undefined : stack[stack.length - 1];
  const over = logOn || top !== undefined;
  const push = (o: Over) => {
    setMenu(false);
    setStack((s) => [...s, o]);
  };
  const pop = () => {
    setMenu(false);
    if (logOn) setLog("hidden");
    else setStack((s) => s.slice(0, -1));
  };
  const rowing = erg.phase === "live";
  /* The monitor takes the whole screen: no bar, no tabs, its own way out. */
  const monitor = rowing && logOn;
  const openLog = () => setLog("shown");
  const openRower = (num: number) => push({ kind: "rower", num });
  const openRow = (id: string) => push({ kind: "row", id });
  const openPeople = (list: PeopleList, num?: number) => push({ kind: "people", list, num });

  /* The bell is read again every minute the app is open, so a line that
   * lands while a screen is being looked at still shows up on it. */
  useEffect(() => {
    if (!me.me) return;
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [me.me?.participantId, refresh]);
  const waiting = (me.social?.unread ?? 0) + (me.social?.requests ?? 0);

  /* A ROW LOGGED lands on its own page, with what the totals were a moment
   * before so the page can show them move (the session is read again only
   * after these are taken). A recording is kept on the phone too, so THE
   * READ opens even where the site did not take it. */
  const logged = async (r: Logged) => {
    const fresh: Fresh = {
      meters: r.meters,
      monthBefore: me.totals?.monthMeters ?? 0,
      lifeBefore: me.totals?.meters ?? 0,
      inMonth: !!me.month && r.day.startsWith(me.month.key),
      goal: me.month?.goal ?? 100_000,
      monthWord: me.month?.label.split(" ")[0] ?? "This month",
    };
    if (r.doc) {
      const row: Row = { id: r.id, day: r.day, at: Date.now(), meters: r.meters, seconds: r.seconds, strokes: r.strokes, avgWatts: r.avgWatts, source: r.demo ? "demo" : "erg", hasDoc: true, device: r.device };
      try {
        await saveDoc(r.id, r.doc);
        const next = [...rows, row];
        setRows(next);
        saveRows(next).catch(() => null);
      } catch {
        /* The page still has the recording in hand for this visit. */
      }
    }
    setStamp((n) => n + 1);
    refresh();
    setTab("board");
    setLog("closed");
    setStack([{ kind: "row", id: r.id, fresh, doc: r.doc }]);
  };

  /* THE MIDDLE OF THE BAR: the mark, which is ROW everywhere and a rower's
   * number on a profile; or, on a screen that is neither, its name. */
  const myNum = me.me?.rowerNumber;
  const num3 = (n: number) => String(n).padStart(3, "0");
  const mark = logOn ? null : !top ? (tab === "profile" && myNum ? num3(myNum) : "ROW") : top.kind === "rower" ? num3(top.num) : null;
  const title = logOn ? "Log a row" : !top || top.kind === "rower" ? "" : top.kind === "row" ? (top.fresh ? "Logged" : "The row") : top.kind === "news" ? "Notifications" : top.kind === "settings" ? "Settings" : PEOPLE[top.list];
  const wide = win.width > win.height;
  const side = { width: 64, height: 54, justifyContent: "center" as const };
  const press = ({ pressed }: { pressed: boolean }) => ({ width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const, opacity: pressed ? 0.5 : 1 });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar style={dark ? "light" : "dark"} hidden={monitor && wide} />
      <View style={{ flex: 1, width: "100%", maxWidth: monitor ? 1100 : 560, alignSelf: "center", paddingTop: Platform.OS === "android" ? 28 : 0 }}>
        {monitor ? null : (
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 54, borderBottomWidth: 2, borderColor: C.ink }}>
            <View style={[side, { alignItems: "flex-start" }]}>
              {over ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={pop} hitSlop={8} style={press}>
                  <BackIcon />
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={rowing ? "Back to the row in progress" : "Log a row"} onPress={openLog} hitSlop={8} style={press}>
                  <PlusIcon color={rowing ? C.accent : C.ink} />
                </Pressable>
              )}
            </View>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {mark ? (
                <Mark label={mark} />
              ) : (
                <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2.2, color: C.ink }}>
                  {title.toUpperCase()}
                </Text>
              )}
            </View>
            <View style={[side, { alignItems: "flex-end" }]}>
              {logOn ? null : top?.kind === "rower" ? (
                top.num !== myNum && me.me ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="More about this rower" onPress={() => setMenu(true)} hitSlop={8} style={press}>
                    <DotsIcon />
                  </Pressable>
                ) : null
              ) : top ? null : tab === "profile" ? (
                me.me ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => push({ kind: "settings" })} hitSlop={8} style={press}>
                    <MenuIcon />
                  </Pressable>
                ) : null
              ) : me.me ? (
                <Pressable accessibilityRole="button" accessibilityLabel={waiting ? `Notifications, ${waiting} waiting` : "Notifications"} onPress={() => push({ kind: "news" })} hitSlop={8} style={press}>
                  <BellIcon count={waiting} />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {/* The tab underneath stays mounted while something is open over
              it, so coming back is where you left it. */}
          <View style={{ flex: 1, display: over ? "none" : "flex" }}>
            {tab === "feed" ? <FeedScreen onRower={openRower} onRow={openRow} stamp={stamp} /> : null}
            {tab === "search" ? <SearchScreen onRower={openRower} /> : null}
            {tab === "board" ? <BoardScreen key={stamp} onRower={openRower} /> : null}
            {tab === "stats" ? <StatsScreen onRower={openRower} /> : null}
            {tab === "profile" ? <ProfileScreen key={stamp} onLog={openLog} onRow={openRow} onPeople={openPeople} /> : null}
          </View>
          {top?.kind === "rower" ? <ProfileScreen key={`r${top.num}`} num={top.num} onRow={openRow} onPeople={openPeople} menu={menu} onMenu={setMenu} onGone={pop} /> : null}
          {top?.kind === "people" ? <PeopleScreen key={`${top.list}${top.num ?? ""}`} list={top.list} num={top.num} onRower={openRower} /> : null}
          {top?.kind === "settings" ? <SettingsScreen onPeople={openPeople} onSignedOut={() => setStack([])} /> : null}
          {top?.kind === "news" ? (
            <NewsScreen
              onRower={openRower}
              onRow={openRow}
              onPeople={openPeople}
              onBoard={() => {
                setStack([]);
                setTab("board");
              }}
            />
          ) : null}
          {/* The log stays mounted under whatever is opened over it, so its
              form survives a look at the feed. */}
          {log !== "closed" ? (
            <View style={{ flex: 1, display: logOn ? "flex" : "none" }}>
              <RowScreen erg={erg} onLogged={logged} onLeave={pop} />
            </View>
          ) : null}
          {top?.kind === "row" ? <RowPage key={top.id} id={top.id} fresh={top.fresh} localDoc={top.doc} rows={rows} onRower={openRower} onDone={pop} /> : null}
        </View>

        {/* THE ROW IN PROGRESS, while the monitor is not on screen. */}
        {rowing && !monitor ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to the row in progress" onPress={openLog} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.ink, paddingHorizontal: 18, minHeight: 46 }}>
            <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: C.paper, fontVariant: ["tabular-nums"] }}>
              <Text style={{ color: C.accentLight }}>● </Text>
              {erg.live.ended ? "FINISHED" : "ROWING"} · {fmtInt(Math.floor(erg.live.meters))} M · {fmtClock(erg.live.elapsedS, false)}
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: C.paper }}>OPEN →</Text>
          </Pressable>
        ) : null}

        {monitor ? null : (
          <TabBar
            tab={tab}
            onTab={(t) => {
              setMenu(false);
              setStack([]);
              if (logOn) setLog("hidden");
              setTab(t);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

/* THE MARK (owner, 2026-11-14: "change our logo to ROW with the O in the
 * Rowtember color"), and what it becomes on a profile (owner, 2026-11-21:
 * "ROW turns into 001 ... a nice little animation"): each letter is a wheel
 * that rolls up to the figure under it, one after the other, as an odometer
 * turns over. The middle keeps the blue either way. */
const WHEEL = 32;
function Mark({ label }: { label: string }) {
  const [pair, setPair] = useState({ from: label, to: label, turn: 0 });
  useEffect(() => {
    setPair((p) => (p.to === label ? p : { from: p.to, to: label, turn: p.turn + 1 }));
  }, [label]);
  const chars = pair.to.split("");
  const same = pair.from.length === pair.to.length;
  return (
    <View accessibilityRole="header" accessibilityLabel={pair.to === "ROW" ? "Row" : `Rower ${pair.to}`} style={{ flexDirection: "row", height: WHEEL }}>
      {chars.map((ch, i) => (
        <Wheel key={`${pair.turn}-${i}`} from={same ? pair.from[i] : ""} to={ch} roll={pair.turn > 0} delay={i * 70} blue={i > 0 && i < chars.length - 1} />
      ))}
    </View>
  );
}

function Wheel({ from, to, roll, delay, blue }: { from: string; to: string; roll: boolean; delay: number; blue: boolean }) {
  const a = useRef(new Animated.Value(roll ? 0 : 1)).current;
  useEffect(() => {
    if (roll) Animated.timing(a, { toValue: 1, duration: 380, delay, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, roll, delay]);
  const face = { fontFamily: F.black, fontSize: 26, lineHeight: WHEEL, letterSpacing: 0.5, color: blue ? C.accent : C.ink, fontVariant: ["tabular-nums" as const], textAlign: "center" as const };
  return (
    <View style={{ height: WHEEL, overflow: "hidden" }}>
      <Animated.Text style={[face, { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [WHEEL, 0] }) }] }]}>{to}</Animated.Text>
      {roll && from ? <Animated.Text style={[face, { position: "absolute", left: 0, right: 0, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -WHEEL] }) }] }]}>{from}</Animated.Text> : null}
    </View>
  );
}

/* THE FIVE GLYPHS AT THE BOTTOM, and the blue square that slides under the
 * one that is open (the site rail marks its page with a box of the blue;
 * here the box travels). */
const BOX = 44;
function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const [w, setW] = useState(0);
  const at = TABS.findIndex((t) => t.id === tab);
  const x = useRef(new Animated.Value(at)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: at, friction: 9, tension: 110, useNativeDriver: Platform.OS !== "web" }).start();
  }, [x, at]);
  const cell = w / TABS.length;
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", height: 60, borderTopWidth: 2, borderColor: C.ink, backgroundColor: C.paper }}>
      {w ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: (58 - BOX) / 2, left: (cell - BOX) / 2, width: BOX, height: BOX, backgroundColor: C.accent, transform: [{ translateX: x.interpolate({ inputRange: [0, TABS.length - 1], outputRange: [0, cell * (TABS.length - 1)] }) }] }}
        />
      ) : null}
      {TABS.map((t) => (
        <Pressable key={t.id} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: tab === t.id }} onPress={() => onTab(t.id)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <t.Icon color={tab === t.id ? "#fff" : C.ink} />
        </Pressable>
      ))}
    </View>
  );
}
