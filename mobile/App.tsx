import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, SafeAreaView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { api, warm } from "./src/api";
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
import { RankingsScreen, StatsScreen } from "./src/screens/Stats";
import { SessionProvider, useSession } from "./src/session";
import { loadRows, saveDoc, saveRows, type Row } from "./src/store";
import { C, F, fmtClock, fmtInt, isDark, setLook } from "./src/theme";

/* ROW, THE APP.
 *
 * THE SHAPE (owner, 2026-11-21: "I really like how Instagram's app is set
 * up ... the top bar could look kind of like Instagram, where it's plus on
 * the left, top left, and then a row in the middle, and then notifications
 * on the right. Search at the bottom. We do icons instead of the words").
 *
 *   TOP     +  (log a row)  ·  ROW  ·  the bell
 *   BOTTOM  feed · search · board · stats · profile, white glyphs on a
 *           dark rounded bar, a rounded blue highlight sliding under the
 *           one that is open ("I really want to just copy this Instagram
 *           nav bar ... white on black icons, rounded bars at the bottom, a
 *           highlight that follows each of the buttons").
 *
 * THE MARK IN THE MIDDLE ROLLS OVER into what the screen is about ("ROW
 * turns into 001 ... I think that is one of the coolest transitions ... how
 * can we make that a thing in other places?"): a rower's number on a
 * profile and on a row's page, LOG on the log screen, every meter anybody
 * has rowed on the stats tab.
 *
 * WHAT IS OPENED OVER A TAB (a rower, a row, a list of people, the
 * notifications, the settings) SLIDES IN from the right and goes back with
 * a swipe from the left edge ("it should swing in from the right ... I
 * obviously want to swipe to go back a page"). Everything under it stays
 * where it was, mounted, so going back is instant and nothing reads again.
 *
 * Every screen reads the site (src/api.ts): the same routes, the same
 * numbers, the same rules about who is hidden; and what has been read once
 * is drawn at once the next time. The one thing that lives on the phone is
 * the row in progress (erg/useErg.ts), held above the screens so leaving
 * the monitor for the feed does not end it. */

type Tab = "feed" | "search" | "board" | "stats" | "profile";
const TABS: { id: Tab; label: string; Icon: ComponentType<{ color?: string; size?: number }> }[] = [
  { id: "feed", label: "Feed", Icon: FeedIcon },
  { id: "search", label: "Search", Icon: SearchIcon },
  { id: "board", label: "Board", Icon: BoardIcon },
  { id: "stats", label: "Stats", Icon: StatsIcon },
  { id: "profile", label: "Profile", Icon: ProfileIcon },
];

type Over = { k: number } & (
  | { kind: "rower"; num: number }
  | { kind: "row"; id: string; fresh?: Fresh; doc?: TelemetryDoc }
  | { kind: "news" }
  | { kind: "settings" }
  | { kind: "people"; list: PeopleList; num?: number }
  | { kind: "rankings"; period: string; rec: string }
);
type Push = Over extends infer O ? (O extends { k: number } ? Omit<O, "k"> : never) : never;

const PEOPLE: Record<PeopleList, string> = { followers: "Followers", following: "Following", requests: "Requests", blocked: "Blocked", muted: "Muted" };

/* Where the app was, kept above the shell so that changing the look (which
 * mounts the shell afresh) lands on the screen it was changed from. */
type Nav = { tab: Tab; stack: Over[] };
let nextKey = 1;

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
  /* The screens that were already open when this shell was mounted (a
   * change of look): they are simply there, they do not slide in again. */
  const settled = useRef(new Set(init.stack.map((o) => o.k))).current;
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
  /* The three dots at the top right of a rower or a row, pressed. */
  const [menu, setMenu] = useState(false);
  /* Whose row a row's page is, once the page knows: its number goes in the bar. */
  const [rowNum, setRowNum] = useState<Record<string, number>>({});
  /* Every meter anybody has logged, for the mark on the stats tab. */
  const [total, setTotal] = useState<number | null>(null);
  /* What is typed in the search field, which sits in the bar on that tab. */
  const [find, setFind] = useState("");
  /* The pieces this phone has recorded, for THE READ to rank against. */
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    loadRows().then(setRows);
  }, []);

  /* READ AHEAD: the five tabs and the two screens behind the bar's glyphs,
   * quietly, as the app opens and whenever a row is logged, so opening any
   * of them shows what is already here (api.ts keeps every answer). */
  const mine = me.me?.rowerNumber;
  useEffect(() => {
    warm(["/api/row100k/app/board", "/api/row100k/app/feed", "/api/row100k/stats?m=all", "/api/row100k/app/people?q="]);
    if (mine) warm(["/api/row100k/app/profile?", "/api/row100k/app/settings", "/api/row100k/app/notifications"]);
    api<{ meters: number }>("/api/row100k/app/total").then((r) => setTotal(r.meters), () => null);
  }, [mine, stamp]);

  /* DEVELOPMENT, in a browser: ?row=<id> opens that row's page, and
   * &fresh=<meters> plays it as if those meters had just been logged, so
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
    setStack([{ k: nextKey++, kind: "row", id, fresh }]);
  }, [me]);

  const logOn = log === "shown";
  const top = logOn ? undefined : stack[stack.length - 1];
  const over = logOn || top !== undefined;
  const push = (o: Push) => {
    setMenu(false);
    setStack((s) => [...s, { ...o, k: nextKey++ } as Over]);
  };
  const drop = useCallback(() => {
    setMenu(false);
    setStack((s) => s.slice(0, -1));
  }, []);
  /* The screen on top hands over how it leaves (it slides out, then drops),
   * so the arrow in the bar and a swipe from the edge go the same way. */
  const leave = useRef<(() => void) | null>(null);
  const back = () => {
    setMenu(false);
    if (logOn) setLog("hidden");
    else if (stack.length && leave.current) leave.current();
    else drop();
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
    setStack([{ k: nextKey++, kind: "row", id: r.id, fresh, doc: r.doc }]);
  };

  /* THE MIDDLE OF THE BAR: the mark, and what it has rolled over into; or,
   * on a screen that is about nothing in particular, its name. */
  const num3 = (n: number) => String(n).padStart(3, "0");
  const rowOf = top?.kind === "row" ? rowNum[top.id] : undefined;
  let mark: string | null = null;
  let markIs: "word" | "meters" = "word";
  if (logOn) mark = "LOG";
  else if (!top) {
    if (tab === "profile" && mine) mark = num3(mine);
    else if (tab === "stats" && total !== null) {
      mark = `${fmtInt(total)}M`;
      markIs = "meters";
    } else mark = "ROW";
  } else if (top.kind === "rower") mark = num3(top.num);
  else if (top.kind === "row") mark = rowOf ? num3(rowOf) : "ROW";
  /* Every screen's name is set in the mark's own face with one letter in
   * the blue (owner, 2026-11-22: "let's try and have that always have one
   * item blue in it ... and we should also retain that same font"). */
  if (top && !mark) mark = (top.kind === "news" ? "Notifications" : top.kind === "settings" ? "Settings" : top.kind === "people" ? PEOPLE[top.list] : top.kind === "rankings" ? "Rankings" : "Row").toUpperCase();
  const searchBar = !over && tab === "search";
  const wide = win.width > win.height;
  const side = { width: 64, height: 54, justifyContent: "center" as const };
  const press = ({ pressed }: { pressed: boolean }) => ({ width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const, opacity: pressed ? 0.5 : 1 });
  const dots = !logOn && me.me && ((top?.kind === "rower" && top.num !== mine) || top?.kind === "row");

  const screen = (o: Over): ReactNode =>
    o.kind === "rower" ? (
      <ProfileScreen num={o.num} onRow={openRow} onPeople={openPeople} menu={menu && top === o} onMenu={setMenu} onGone={drop} />
    ) : o.kind === "people" ? (
      <PeopleScreen list={o.list} num={o.num} onRower={openRower} />
    ) : o.kind === "rankings" ? (
      <RankingsScreen period={o.period} rec={o.rec} onRower={openRower} />
    ) : o.kind === "settings" ? (
      <SettingsScreen onPeople={openPeople} onSignedOut={() => setStack([])} />
    ) : o.kind === "news" ? (
      <NewsScreen
        onRower={openRower}
        onRow={openRow}
        onPeople={openPeople}
        onBoard={() => {
          setStack([]);
          setTab("board");
        }}
      />
    ) : (
      <RowPage id={o.id} fresh={o.fresh} localDoc={o.doc} rows={rows} onRower={openRower} onDone={drop} menu={menu && top === o} onMenu={setMenu} onWho={(n) => setRowNum((m) => (m[o.id] === n ? m : { ...m, [o.id]: n }))} />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar style={dark ? "light" : "dark"} hidden={monitor && wide} />
      <View style={{ flex: 1, width: "100%", maxWidth: monitor ? 1100 : 560, alignSelf: "center", paddingTop: Platform.OS === "android" ? 28 : 0 }}>
        {monitor ? null : (
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, minHeight: 54, borderBottomWidth: 2, borderColor: C.ink }}>
            <View style={[side, { alignItems: "flex-start" }]}>
              {over ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={8} style={press}>
                  <BackIcon />
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={rowing ? "Back to the row in progress" : "Log a row"} onPress={openLog} hitSlop={8} style={press}>
                  <PlusIcon color={rowing ? C.accent : C.ink} />
                </Pressable>
              )}
            </View>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {searchBar ? (
                /* THE SEARCH FIELD, where the mark is on the other tabs, the
                   blue glass at its left (owner, 2026-11-22: "maybe that's
                   where the search text box actually goes ... we can still
                   have that blue magnifying glass, but maybe that gets
                   moved to the left"). */
                <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }}>
                  <SearchIcon color={C.accent} size={18} />
                  <TextInput
                    accessibilityLabel="Search rowers by name, Instagram or number"
                    value={find}
                    onChangeText={setFind}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    placeholder="Search"
                    placeholderTextColor={C.gray}
                    style={[{ flex: 1, fontFamily: F.bold, fontSize: 16, color: C.ink, paddingVertical: 0 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
                  />
                  {find ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Clear the search" onPress={() => setFind("")} hitSlop={10}>
                      <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.gray }}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : mark ? (
                <Mark label={mark} kind={markIs} />
              ) : null}
            </View>
            <View style={[side, { alignItems: "flex-end" }]}>
              {dots ? (
                <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => setMenu(true)} hitSlop={8} style={press}>
                  <DotsIcon />
                </Pressable>
              ) : over ? null : tab === "profile" ? (
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

        <View style={{ flex: 1, overflow: "hidden" }}>
          {/* The tab stays where it was, mounted, under whatever is opened
              over it. */}
          <View style={{ flex: 1 }}>
            {tab === "feed" ? <FeedScreen onRower={openRower} onRow={openRow} stamp={stamp} /> : null}
            {tab === "search" ? <SearchScreen text={find} onRower={openRower} /> : null}
            {tab === "board" ? <BoardScreen key={stamp} onRower={openRower} /> : null}
            {tab === "stats" ? <StatsScreen onRower={openRower} onRankings={(period, rec) => push({ kind: "rankings", period, rec })} /> : null}
            {tab === "profile" ? <ProfileScreen key={stamp} onRow={openRow} onPeople={openPeople} /> : null}
          </View>
          {stack.map((o, i) => (
            <Slide
              key={o.k}
              top={i === stack.length - 1 && !logOn}
              still={settled.has(o.k)}
              width={Math.min(win.width, 560)}
              onGone={drop}
              hand={(f) => {
                if (i === stack.length - 1) leave.current = f;
              }}
            >
              {screen(o)}
            </Slide>
          ))}
          {/* The log stays mounted under whatever is opened over it, so its
              form survives a look at the feed. */}
          {log !== "closed" ? (
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.paper, display: logOn ? "flex" : "none" }}>
              <RowScreen erg={erg} onLogged={logged} onLeave={back} />
            </View>
          ) : null}
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
              leave.current = null;
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

/* ONE SCREEN OPENED OVER THE TAB. It slides in from the right, covers what
 * is under it with the page's own ground, and leaves the way it came: by
 * the arrow in the bar, or by a swipe that starts at the left edge and
 * drags it off (past a third of the way, or flicked, it goes; short of
 * that it springs back). Only the one on top can be touched. */
function Slide({ children, top, still, width, onGone, hand }: { children: ReactNode; top: boolean; still: boolean; width: number; onGone: () => void; hand: (leave: (() => void) | null) => void }) {
  const x = useRef(new Animated.Value(still ? 0 : width)).current;
  const native = Platform.OS !== "web";
  const going = useRef(false);
  useEffect(() => {
    if (!still) Animated.timing(x, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [x, still, native]);
  const leave = useCallback(() => {
    if (going.current) return;
    going.current = true;
    Animated.timing(x, { toValue: width, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() => onGone());
  }, [x, width, native, onGone]);
  useEffect(() => {
    if (top) hand(leave);
  });
  const edge = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => x.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > width / 3 || g.vx > 0.6) leave();
        else Animated.spring(x, { toValue: 0, friction: 9, tension: 90, useNativeDriver: native }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(x, { toValue: 0, friction: 9, tension: 90, useNativeDriver: native }).start();
      },
    }),
  ).current;
  return (
    <Animated.View pointerEvents={top ? "auto" : "none"} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.paper, transform: [{ translateX: x }] }}>
      {children}
      {/* Where a swipe back starts: a strip down the left edge. */}
      <View {...edge.panHandlers} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 22 }} />
    </Animated.View>
  );
}

/* THE MARK (owner, 2026-11-14: "change our logo to ROW with the O in the
 * Rowtember color"), and what it becomes (owner, 2026-11-21: "ROW turns
 * into 001 ... a nice little animation"): each letter is a wheel that rolls
 * up to the figure under it, one after the other, as an odometer turns
 * over. A word or a rower's number keeps the blue in its middle; a count of
 * meters is ink with its M in the blue. */
const WHEEL = 32;
function Mark({ label, kind }: { label: string; kind: "word" | "meters" }) {
  const [pair, setPair] = useState({ from: label, to: label, turn: 0 });
  useEffect(() => {
    setPair((p) => (p.to === label ? p : { from: p.to, to: label, turn: p.turn + 1 }));
  }, [label]);
  const chars = pair.to.split("");
  const same = pair.from.length === pair.to.length;
  const size = chars.length > 9 ? 20 : chars.length > 5 ? 23 : 26;
  /* ONE thing in the blue. A count of meters: its M. A rower's number:
   * what is between its first and last figure. A word: its first O, as in
   * ROW and LOG, or failing an O the letter in its middle. */
  const digits = /^\d+$/.test(pair.to);
  const o = pair.to.indexOf("O");
  const one = o >= 0 ? o : Math.floor((chars.length - 1) / 2);
  const blue = (i: number) => (kind === "meters" ? i === chars.length - 1 : digits ? i > 0 && i < chars.length - 1 : i === one);
  return (
    <View accessibilityRole="header" accessibilityLabel={pair.to === "ROW" ? "Row" : pair.to} style={{ flexDirection: "row", height: WHEEL }}>
      {chars.map((ch, i) => (
        <Wheel key={`${pair.turn}-${i}`} from={same ? pair.from[i] : ""} to={ch} roll={pair.turn > 0} delay={Math.min(i, 8) * 55} blue={blue(i)} size={size} />
      ))}
    </View>
  );
}

function Wheel({ from, to, roll, delay, blue, size }: { from: string; to: string; roll: boolean; delay: number; blue: boolean; size: number }) {
  const a = useRef(new Animated.Value(roll ? 0 : 1)).current;
  useEffect(() => {
    if (roll) Animated.timing(a, { toValue: 1, duration: 380, delay, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, roll, delay]);
  const face = { fontFamily: F.black, fontSize: size, lineHeight: WHEEL, letterSpacing: 0.5, color: blue ? C.accent : C.ink, fontVariant: ["tabular-nums" as const], textAlign: "center" as const };
  return (
    <View style={{ height: WHEEL, overflow: "hidden" }}>
      <Animated.Text style={[face, { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [WHEEL, 0] }) }] }]}>{to}</Animated.Text>
      {roll && from ? <Animated.Text style={[face, { position: "absolute", left: 0, right: 0, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -WHEEL] }) }] }]}>{from}</Animated.Text> : null}
    </View>
  );
}

/* THE BAR AT THE BOTTOM: five white glyphs on a dark rounded bar that
 * floats over the page's ground, and a rounded square of the blue that
 * slides under whichever is open. */
const BOX = 46;
const BAR = 60;
function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const [w, setW] = useState(0);
  const at = TABS.findIndex((t) => t.id === tab);
  const x = useRef(new Animated.Value(at)).current;
  useEffect(() => {
    /* Eased, not sprung: a spring carries the highlight past the end of the bar. */
    Animated.timing(x, { toValue: at, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [x, at]);
  const cell = w / TABS.length;
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, backgroundColor: C.paper }}>
      <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", height: BAR, borderRadius: BAR / 2, backgroundColor: isDark() ? "#2a2d32" : "#15171a", overflow: "hidden" }}>
        {w ? (
          <Animated.View
            pointerEvents="none"
            style={{ position: "absolute", top: (BAR - BOX) / 2, left: (cell - BOX) / 2, width: BOX, height: BOX, borderRadius: 16, backgroundColor: C.accent, transform: [{ translateX: x.interpolate({ inputRange: [0, TABS.length - 1], outputRange: [0, cell * (TABS.length - 1)] }) }] }}
          />
        ) : null}
        {TABS.map((t) => (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: tab === t.id }} onPress={() => onTab(t.id)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <t.Icon color="#fff" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
