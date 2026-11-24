import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, SafeAreaView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { api, warm } from "./src/api";
import { useLiveRaceFeed } from "./src/erg/liveRace";
import { useErg } from "./src/erg/useErg";
import { BackIcon, BellIcon, BoardIcon, DotsIcon, FeedIcon, MenuIcon, PlusIcon, ProfileIcon, QuestionIcon, SearchIcon, StatsIcon, VerifiedIcon } from "./src/icons";
import { BadgeSlot, Mark, type MarkKind } from "./src/mark";
import { LookCtx, loadLook, saveLook } from "./src/look";
import { BoardScreen, MonthSheet, monthMark, useBoardMonth } from "./src/screens/Board";
import { FeedScreen } from "./src/screens/Feed";
import { BestsScreen, ProfileScreen } from "./src/screens/Profile";
import { DemoPage, ErgPage, RowPage, type Fresh } from "./src/screens/RowPage";
import type { TelemetryDoc } from "./src/pm5/session";
import { RowScreen, type Faked, type Logged } from "./src/screens/RowScreen";
import { SettingsScreen, type SettingsPage } from "./src/screens/Settings";
import { WikiScreen } from "./src/screens/Wiki";
import { LockerScreen } from "./src/screens/Locker";
import { NewsScreen, PeopleScreen, SearchScreen, type PeopleList } from "./src/screens/Social";
import { StoriesScreen, StoryScreen, type StoryId } from "./src/screens/Stories";
import { MetricScreen, type MetricId } from "./src/screens/Field";
import type { RowMeasure } from "./src/pm5/craft";
import { RankingsScreen, StatsScreen } from "./src/screens/Stats";
import { SessionProvider, useSession } from "./src/session";
import { loadRows, saveDoc, saveRows, type Row } from "./src/store";
import { C, F, fmtClock, fmtInt, isDark, setLook } from "./src/theme";
import { registerPush } from "./src/push";
import { forgetStickers } from "./src/stickers";
import { Avatar, modals, scrub, setSideDrag } from "./src/ui";
import { buzz } from "./src/buzz";
import { monitorShown } from "./src/orient";
import { Splash } from "./src/splash";

/* Android pads the app clear of its own bars (src/insets.tsx); required here
   and only on Android, so an iPhone build without the module never loads it. */
const Insets: ComponentType<{ color: string; children: ReactNode }> | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Platform.OS === "android" ? require("./src/insets").default : null;
function Padded({ children }: { children: ReactNode }) {
  return Insets ? <Insets color={C.paper}>{children}</Insets> : <>{children}</>;
}

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
  | { kind: "row"; id: string; fresh?: Fresh; doc?: TelemetryDoc; talk?: boolean; fake?: Faked }
  | { kind: "news" }
  | { kind: "settings"; page?: SettingsPage }
  | { kind: "stories" }
  | { kind: "story"; id: StoryId }
  /* The questions behind one card of a row's analytics, with that row's
   * own figures (screens/Field.tsx). */
  | { kind: "metric"; id: MetricId; mine: RowMeasure }
  /* The analytics of a demo row: read off the phone, logged nowhere. */
  | { kind: "demo"; doc: TelemetryDoc; meters: number }
  | { kind: "wiki"; id?: string }
  | { kind: "locker" }
  | { kind: "people"; list: PeopleList; num?: number }
  | { kind: "rankings"; period: string; rec: string }
  | { kind: "erg"; id: string }
  | { kind: "bests"; num: number; best: string }
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
  /* Who else is rowing the same distance this minute, for the race page
   * (erg/liveRace.ts). It asks once a piece and is told it is not on. */
  useLiveRaceFeed(erg);
  const nav = useRef<Nav>({ tab: "board", stack: [] });
  const keep = useRef((n: Nav) => {
    nav.current = n;
  }).current;
  return (
    <>
      <Shell key={dark ? "dark" : "light"} dark={dark} erg={erg} init={nav.current} onNav={keep} />
      <Splash />
    </>
  );
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
  /* WHICH ROWERS WEAR THE BLACK CHECK, as their pages say so (owner,
   * 2026-11-22, of the top of his Instagram page: "up at the top where we
   * put that verified check mark ... where mine says mikian_, that's where
   * we're going to put their rower number"). It stands after the number in
   * the bar while a page of theirs is the one in view. */
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const onPlus = (n: number, on: boolean) => setChecked((prev) => (!!prev[n] === on ? prev : { ...prev, [n]: on }));
  /* A LOOK BEING TRIED IS ONE PRESS AWAY, for an admin (owner, 2026-11-22:
   * "when I'm redesigning pages like this, let's have the secret dev trick
   * be that you just click the top button ... this 100K ... it'll swap the
   * look to the thing that we're testing out"). Today: the board, between
   * its bars and the sheet (screens/Board.tsx). Nobody else's press does
   * anything. */
  const [boardLook, setBoardLook] = useState<"bars" | "sheet">("bars");
  /* The board's month, read and set from the title (Board.tsx). */
  const boardMonth = useBoardMonth();
  const [monthsOpen, setMonthsOpen] = useState(false);
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
    if (mine != null) warm(["/api/row100k/app/profile?", "/api/row100k/app/settings", "/api/row100k/app/notifications"]);
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
  /* Upright unless the live row is in front (src/orient.ts); said as the
   * app opens, too. */
  useEffect(() => {
    monitorShown(monitor);
  }, [monitor]);
  const openLog = () => setLog("shown");
  const openRower = (num: number) => push({ kind: "rower", num });
  const openRow = (id: string, talk?: boolean) => push({ kind: "row", id, talk });
  const openPeople = (list: PeopleList, num?: number) => push({ kind: "people", list, num });
  const openMetric = (id: MetricId, mine: RowMeasure) => push({ kind: "metric", id, mine });

  /* The bell is read again every minute the app is open, so a line that
   * lands while a screen is being looked at still shows up on it. */
  useEffect(() => {
    if (!me.me) return;
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [me.me?.participantId, refresh]);
  const waiting = (me.social?.unread ?? 0) + (me.social?.requests ?? 0);
  /* The phone's own notifications, asked for once a rower is signed in. */
  useEffect(() => {
    if (me.me) registerPush();
  }, [me.me?.participantId]);

  /* THE BARS STEP ASIDE while the feed is being read downward, and come
   * back on the way up (owner, 2026-11-22: "as I scroll down on the feed,
   * the bar at the bottom should get smaller, and then the bar at the top
   * of my page should go away. Just like on Instagram"). */
  const [away, setAway] = useState(false);
  const tucked = away && !over;
  const tuck = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(tuck, { toValue: tucked ? 1 : 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [tuck, tucked]);

  /* A SWIPE ACROSS A TAB goes to the one beside it (owner, 2026-11-22: "on
   * Instagram, if I'm on my page, I can swipe ... so let's do that"). Only
   * a clearly sideways drag, and only on a tab itself: anything opened
   * over it has its own swipe, back. */
  /* THE TABS LIE SIDE BY SIDE and the finger drags the row of them (owner,
   * 2026-11-21: "I want to see the pane swipe. Like on Instagram ... it's
   * like they exist, but they're just off the screen. On my app, it just
   * teleports there"). `pos` is which tab is in view, counted in tabs: a
   * drag moves it with the finger, and letting go carries it on to the next
   * tab or back. Only the tab in view and the one being dragged toward are
   * mounted. A press on the bar still goes straight there. */
  const tabRef = useRef<Tab>(tab);
  tabRef.current = tab;
  const at = TABS.findIndex((t) => t.id === tab);
  const pos = useRef(new Animated.Value(at)).current;
  const [peek, setPeek] = useState<Tab | null>(null);
  const peekRef = useRef<Tab | null>(null);
  const paneW = Math.min(win.width, 560);
  const paneRef = useRef(paneW);
  paneRef.current = paneW;
  useEffect(() => {
    pos.setValue(at);
  }, [pos, at]);
  /* A PAGE THAT CAME UP BLANK (owner, 2026-11-23: "if I've had the app open
   * for a bit and I'm like flicking back and forth between a bunch of the
   * pages, it'll go blank ... the data's still there. I just have to like
   * move it a little bit and it'll show up"). Where a pane stands was held
   * in two places: the app's own count of it, and the phone's copy, which
   * ran the glide after a drag. A page drawn while the two disagreed (a
   * second drag begun before the first glide was over, a press on the bar
   * mid-glide) was put where the stale one said, a screen's width off, and
   * stayed there until a finger moved the count again. Now there is one
   * place: the glide is run by the app itself, the count is right before
   * anything is drawn from it, and a glide that is cut short is finished on
   * the spot, the tab it was on its way to becoming the tab, before the
   * next drag or press is read. NOT seen on a phone: the fault could not be
   * made to happen in a browser, so this is the cause as read from the code. */
  const glide = useRef<number | null>(null);
  const settle = useCallback(() => {
    const to = glide.current;
    if (to === null) return;
    glide.current = null;
    pos.stopAnimation();
    pos.setValue(to);
    peekRef.current = null;
    setPeek(null);
    if (TABS[to].id !== tabRef.current) {
      tabRef.current = TABS[to].id;
      setTab(TABS[to].id);
    }
  }, [pos]);
  const glideTo = useCallback(
    (to: number, ms: number) => {
      glide.current = to;
      Animated.timing(pos, { toValue: to, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
        if (finished && glide.current === to) settle();
      });
    },
    [pos, settle],
  );
  /* A press on the bar, or the app itself going to a tab: straight there. */
  const goTab = useCallback(
    (t: Tab) => {
      glide.current = null;
      pos.stopAnimation();
      pos.setValue(TABS.findIndex((x) => x.id === t));
      peekRef.current = null;
      setPeek(null);
      tabRef.current = t;
      setTab(t);
    },
    [pos],
  );
  /* THE LITTLE BUZZ as the tab changes, by a press or by a drag (buzz.ts). */
  const buzzed = useRef(tab);
  useEffect(() => {
    if (buzzed.current === tab) return;
    buzzed.current = tab;
    buzz.tick();
  }, [tab]);
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => modals.open === 0 && !scrub.on && Math.abs(g.dx) > 28 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2,
      /* The page does not scroll up and down under a drag across it
       * (ui.tsx setSideDrag). A glide still under way is finished first. */
      onPanResponderGrant: () => {
        settle();
        setSideDrag(true);
      },
      onPanResponderMove: (_e, g) => {
        const i = TABS.findIndex((t) => t.id === tabRef.current);
        pos.setValue(Math.max(0, Math.min(TABS.length - 1, i - g.dx / paneRef.current)));
        const n = i + (g.dx < 0 ? 1 : -1);
        const want = n >= 0 && n < TABS.length ? TABS[n].id : null;
        if (peekRef.current !== want) {
          peekRef.current = want;
          setPeek(want);
        }
      },
      onPanResponderRelease: (_e, g) => {
        setSideDrag(false);
        const i = TABS.findIndex((t) => t.id === tabRef.current);
        const far = Math.abs(g.dx) > paneRef.current * 0.28 || Math.abs(g.vx) > 0.5;
        glideTo(Math.max(0, Math.min(TABS.length - 1, far ? i + (g.dx < 0 ? 1 : -1) : i)), 220);
      },
      onPanResponderTerminate: () => {
        setSideDrag(false);
        glideTo(TABS.findIndex((t) => t.id === tabRef.current), 180);
      },
    }),
  ).current;
  const pane = (t: Tab): ReactNode =>
    t === "feed" ? (
      <FeedScreen onRower={openRower} onRow={openRow} stamp={stamp} onScrollDir={setAway} />
    ) : t === "search" ? (
      <SearchScreen text={find} onRower={openRower} onScrollDir={setAway} />
    ) : t === "board" ? (
      <BoardScreen key={stamp} look={boardLook} onRower={openRower} onScrollDir={setAway} />
    ) : t === "stats" ? (
      <StatsScreen onRower={openRower} onRow={openRow} onRankings={(period, rec) => push({ kind: "rankings", period, rec })} onScrollDir={setAway} />
    ) : (
      <ProfileScreen key={stamp} onLocker={() => push({ kind: "locker" })} onPlus={onPlus} onEdit={() => push({ kind: "settings", page: "account" })} onRow={openRow} onPeople={openPeople} onErg={(id) => push({ kind: "erg", id })} onBest={(num, best) => push({ kind: "bests", num, best })} onScrollDir={setAway} />
    );

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
    /* A demo row "logged" (RowScreen.tsx Faked): the page it lands on and
     * nothing else; no recording kept, no read again, no stickers dropped. */
    if (r.fake) {
      setLog("closed");
      setStack([{ k: nextKey++, kind: "row", id: r.id, fresh, doc: r.doc, fake: r.fake }]);
      return;
    }
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
    /* Every sticker counts this row now. */
    forgetStickers();
    refresh();
    goTab("board");
    setLog("closed");
    setStack([{ k: nextKey++, kind: "row", id: r.id, fresh, doc: r.doc }]);
  };

  /* THE MIDDLE OF THE BAR: the mark, and what it has rolled over into; or,
   * on a screen that is about nothing in particular, its name. */
  const num3 = (n: number) => String(n).padStart(3, "0");
  const rowOf = top?.kind === "row" ? rowNum[top.id] : undefined;
  let mark: string | null = null;
  let markIs: MarkKind = "word";
  if (logOn) mark = "LOG";
  else if (!top) {
    if (tab === "profile" && mine != null) mark = num3(mine);
    else if (tab === "stats" && total !== null) {
      mark = `${fmtInt(total)}M`;
      markIs = "meters";
    } else if (tab === "board") {
      /* The board's month, "11/26", with the month in the blue (owner,
       * 2026-11-23: "where the 100K is ... that's where we should put the
       * November 2026 ... I think I like the 11/26 ... we'll make the month
       * there colored"); a press opens the months. "100K" until the board
       * has said which months it has. */
      mark = monthMark(boardMonth.shown) || "100K";
      markIs = monthMark(boardMonth.shown) ? "month" : "meters";
    } else mark = "ROW";
  } else if (top.kind === "rower") mark = num3(top.num);
  else if (top.kind === "row") mark = rowOf ? num3(rowOf) : "ROW";
  const pageOf = logOn ? null : !top ? (tab === "profile" && mine != null ? mine : null) : top.kind === "rower" ? top.num : null;
  const flip = !logOn && !top && tab === "board" && !!me.isAdmin;
  const monthsMenu = !logOn && !top && tab === "board" && boardMonth.months.length > 1;
  /* Every screen's name is set in the mark's own face with one letter in
   * the blue (owner, 2026-11-22: "let's try and have that always have one
   * item blue in it ... and we should also retain that same font"). */
  if (top && !mark) mark = (top.kind === "news" ? "Notifications" : top.kind === "settings" ? (top.page ?? "Settings") : top.kind === "stories" || top.kind === "story" || top.kind === "metric" ? "FAQs" : top.kind === "people" ? PEOPLE[top.list] : top.kind === "rankings" ? "Rankings" : top.kind === "erg" || top.kind === "demo" ? "Telemetry" : top.kind === "bests" ? "Bests" : top.kind === "wiki" ? "Wiki" : top.kind === "locker" ? "Locker" : "Row").toUpperCase();
  const searchBar = !over && tab === "search";
  const wide = win.width > win.height;
  const side = { width: 64, height: 54, justifyContent: "center" as const };
  const press = ({ pressed }: { pressed: boolean }) => ({ width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const, opacity: pressed ? 0.5 : 1 });
  const dots = !logOn && me.me && ((top?.kind === "rower" && top.num !== mine) || (top?.kind === "row" && !top.fake));

  const screen = (o: Over): ReactNode =>
    o.kind === "rower" ? (
      <ProfileScreen num={o.num} onPlus={onPlus} onRow={openRow} onPeople={openPeople} onSettings={(page) => push({ kind: "settings", page })} menu={menu && top === o} onMenu={setMenu} onGone={drop} onErg={(id) => push({ kind: "erg", id })} onBest={(num, best) => push({ kind: "bests", num, best })} onScrollDir={setAway} />
    ) : o.kind === "people" ? (
      <PeopleScreen list={o.list} num={o.num} onRower={openRower} />
    ) : o.kind === "bests" ? (
      <BestsScreen num={o.num} best={o.best} onRow={openRow} onRower={openRower} onRankings={(period, rec) => push({ kind: "rankings", period, rec })} />
    ) : o.kind === "erg" ? (
      <ErgPage id={o.id} rows={rows} onMetric={openMetric} />
    ) : o.kind === "rankings" ? (
      <RankingsScreen period={o.period} rec={o.rec} onRower={openRower} onRow={openRow} />
    ) : o.kind === "settings" ? (
      <SettingsScreen page={o.page} onPage={(page) => push({ kind: "settings", page })} onPeople={openPeople} onSignedOut={() => setStack([])} onWiki={() => push({ kind: "wiki" })} onLocker={() => push({ kind: "locker" })} />
    ) : o.kind === "locker" ? (
      <LockerScreen />
    ) : o.kind === "wiki" ? (
      <WikiScreen id={o.id} onPage={(id) => push({ kind: "wiki", id })} />
    ) : o.kind === "stories" ? (
      <StoriesScreen onStory={(id) => push({ kind: "story", id })} />
    ) : o.kind === "story" ? (
      <StoryScreen id={o.id} />
    ) : o.kind === "metric" ? (
      <MetricScreen id={o.id} mine={o.mine} />
    ) : o.kind === "demo" ? (
      <DemoPage doc={o.doc} meters={o.meters} rows={rows} onMetric={openMetric} />
    ) : o.kind === "news" ? (
      <NewsScreen
        onRower={openRower}
        onRow={openRow}
        onPeople={openPeople}
        onBoard={() => {
          setStack([]);
          goTab("board");
        }}
      />
    ) : (
      <RowPage id={o.id} talk={o.talk} fresh={o.fresh} localDoc={o.doc} fake={o.fake} rows={rows} onRower={openRower} onDone={drop} menu={menu && top === o} onMenu={setMenu} onWho={(n) => setRowNum((m) => (m[o.id] === n ? m : { ...m, [o.id]: n }))} onMetric={openMetric} />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar style={dark ? "light" : "dark"} hidden={monitor && wide} />
      <Padded>
      <View
        style={{ flex: 1, width: "100%", maxWidth: monitor ? 1100 : 560, alignSelf: "center", paddingTop: 0 }}
        /* EVERY TOUCH STARTS CLEAN; a chart under it then says if it is the
           chart's (ui.tsx scrub). Here, over the whole app, and not on the
           tabs alone (owner, 2026-11-23: "if I'm on the stats part of the
           profile page and I ... scrubbed the pace meter graph ... then I can
           no longer swipe left or right between the two tabs"). A page opened
           over the tabs, a rower's profile from the feed among them, is not
           inside the tabs' view: the mark a chart left there was never taken
           off, and the profile's own tabs would not swipe again. */
        onTouchStartCapture={() => {
          scrub.on = false;
          scrub.chart = false;
        }}
      >
        {monitor ? null : (
          /* No rule under the bar (owner, 2026-11-22: "I don't need that
             line at the top"). It folds away with the feed. */
          <Animated.View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, overflow: "hidden", height: tuck.interpolate({ inputRange: [0, 1], outputRange: [54, 0] }), opacity: tuck.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            {searchBar ? null : (
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
            )}
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
                <Pressable
                  accessibilityRole={monthsMenu ? "button" : undefined}
                  accessibilityLabel={monthsMenu ? "Which month" : flip ? "Swap the look being tried" : undefined}
                  disabled={!flip && !monthsMenu}
                  onPress={() => (monthsMenu ? setMonthsOpen(true) : setBoardLook((v) => (v === "bars" ? "sheet" : "bars")))}
                  onLongPress={flip ? () => setBoardLook((v) => (v === "bars" ? "sheet" : "bars")) : undefined}
                  hitSlop={8}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Mark label={mark} kind={markIs} />
                  <BadgeSlot word={mark} on={pageOf !== null && !!checked[pageOf]}>
                    <VerifiedIcon size={17} />
                  </BadgeSlot>
                </Pressable>
              ) : null}
            </View>
            {searchBar ? null : (
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
              ) : tab === "stats" ? (
                /* On the stats, the questions the numbers answer (owner,
                   2026-11-21: "the notification button on the stats page
                   gets replaced with like little FAQ button"). */
                <Pressable accessibilityRole="button" accessibilityLabel="FAQs about the stats" onPress={() => push({ kind: "stories" })} hitSlop={8} style={press}>
                  <QuestionIcon />
                </Pressable>
              ) : me.me ? (
                <Pressable accessibilityRole="button" accessibilityLabel={waiting ? `Notifications, ${waiting} waiting` : "Notifications"} onPress={() => push({ kind: "news" })} hitSlop={8} style={press}>
                  <BellIcon count={waiting} />
                </Pressable>
              ) : null}
            </View>
            )}
          </Animated.View>
        )}

        <View style={{ flex: 1, overflow: "hidden" }}>
          {/* The tab stays where it was, mounted, under whatever is opened
              over it. */}
          <View
            style={{ flex: 1 }}
            {...swipe.panHandlers}
          >
            {TABS.map((t, i) =>
              t.id === tab || t.id === peek ? (
                <Animated.View key={t.id} pointerEvents={t.id === tab ? "auto" : "none"} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.paper, transform: [{ translateX: pos.interpolate({ inputRange: [0, TABS.length - 1], outputRange: [i * paneW, (i - (TABS.length - 1)) * paneW] }) }] }}>
                  {pane(t.id)}
                </Animated.View>
              ) : null,
            )}
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
              <RowScreen
                erg={erg}
                onLogged={logged}
                onLeave={back}
                onDemoRead={(doc, meters) => {
                  setLog("closed");
                  setStack([{ k: nextKey++, kind: "demo", doc, meters }]);
                }}
              />
            </View>
          ) : null}
        </View>

        <MonthSheet open={monthsOpen} onClose={() => setMonthsOpen(false)} />
        {monitor ? null : (
          <TabBar
            small={tuck}
            above={
              /* THE ROW IN PROGRESS, while the monitor is not on screen. It
                 rides on the floating bar, over it and moving with it
                 (owner, 2026-11-24, of the strip drawn under the bar: "This
                 shouldn't be able to happen"). It was a line at the foot of
                 the page, and the bar floats over the foot of the page. */
              rowing ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Back to the row in progress" onPress={openLog} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: isDark() ? "rgba(52,56,62,0.94)" : "rgba(21,23,26,0.94)", borderRadius: 23, paddingHorizontal: 18, minHeight: 46, marginBottom: 8, opacity: pressed ? 0.8 : 1 }, Platform.OS === "web" ? ({ backdropFilter: "blur(14px)" } as object) : null]}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: "#FFFFFF", fontVariant: ["tabular-nums"] }}>
                    <Text style={{ color: C.accentLight }}>● </Text>
                    {erg.live.ended ? "FINISHED" : "ROWING"} · {fmtInt(Math.floor(erg.live.meters))} M · {fmtClock(erg.live.elapsedS, false)}
                  </Text>
                  <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: "#FFFFFF" }}>OPEN →</Text>
                </Pressable>
              ) : null
            }
            tab={tab}
            onTab={(t) => {
              setMenu(false);
              setAway(false);
              leave.current = null;
              setStack([]);
              if (logOn) setLog("hidden");
              goTab(t);
            }}
          />
        )}
      </View>
      </Padded>
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
      onPanResponderGrant: () => setSideDrag(true),
      onPanResponderMove: (_e, g) => x.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_e, g) => {
        setSideDrag(false);
        if (g.dx > width / 3 || g.vx > 0.6) leave();
        else Animated.spring(x, { toValue: 0, friction: 9, tension: 90, useNativeDriver: native }).start();
      },
      onPanResponderTerminate: () => {
        setSideDrag(false);
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

/* THE BAR AT THE BOTTOM: five white glyphs on a dark rounded bar that
 * floats over the page's ground, and a rounded square of the blue that
 * slides under whichever is open. */
const BAR = 62;
/* The tab row's inset from the bar's ends, the capsule's gap from the bar's
 * ends, and its gap from the bar's top and foot. */
const TAB_PAD = 10;
const TAB_EDGE = 6;
const TAB_AIR = 7;
function TabBar({ tab, onTab, small, above }: { tab: Tab; onTab: (t: Tab) => void; small: Animated.Value; /* Rides on the bar, over it: the row in progress. */ above?: ReactNode }) {
  const [w, setW] = useState(0);
  const at = TABS.findIndex((t) => t.id === tab);
  const x = useRef(new Animated.Value(at)).current;
  useEffect(() => {
    /* Eased, not sprung: a spring carries the highlight past the end of the bar. */
    Animated.timing(x, { toValue: at, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [x, at]);
  /* The row stands IN from the bar's ends by PAD, so the end tabs' capsules
   * have room to be centred on their icons; each capsule is its slot plus
   * PAD - EDGE either side, and is EDGE from the bar's end at the ends. */
  const cell = (w - 2 * TAB_PAD) / TABS.length;
  const pill = cell + 2 * (TAB_PAD - TAB_EDGE);
  const { me } = useSession();
  return (
    /* It floats over the page, which shows around and through it, and draws
       in while a screen is read downward. Made after Instagram's bar, which
       he sent as the reference (2026-11-22: "let's really try to mimic the
       bar of Instagram"): see-through dark glass, a soft capsule the width
       of its slot under the open tab, and the rower's own face where the
       profile is. */
    <Animated.View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: 10, transform: [{ scale: small.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) }, { translateY: small.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] }}>
      {above}
      <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ flexDirection: "row", height: BAR, borderRadius: BAR / 2, paddingHorizontal: TAB_PAD, backgroundColor: isDark() ? "rgba(52,56,62,0.9)" : "rgba(21,23,26,0.9)", overflow: "hidden" }, Platform.OS === "web" ? ({ backdropFilter: "blur(14px)" } as object) : null]}>
        {w ? (
          <Animated.View
            pointerEvents="none"
            /* BIGGER, as Instagram's (owner, 2026-11-23: "the highlighting of
               what icon we're on could be slightly larger ... a little bit
               taller and wider, close to the Instagram view of it"), a
               little wider than its slot. CENTRED ON ITS ICON, WITH AIR
               ABOVE AND BELOW (owner, 2026-11-24: "The highlight on the
               button at the home button is like off center, and there
               should be some vertical margin"): it had been pushed in at the
               ends to stay inside the bar, off its icon, and stood 4 points
               from the bar's top and foot. */
            style={{ position: "absolute", top: TAB_AIR, left: 0, width: pill, height: BAR - 2 * TAB_AIR, borderRadius: (BAR - 2 * TAB_AIR) / 2, backgroundColor: "rgba(255,255,255,0.2)", transform: [{ translateX: x.interpolate({ inputRange: TABS.map((_, i) => i), outputRange: TABS.map((_, i) => TAB_EDGE + cell * i) }) }] }}
          />
        ) : null}
        {TABS.map((t) => (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: tab === t.id }} onPress={() => onTab(t.id)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {t.id === "profile" && me.me ? (
              <View style={{ borderRadius: 16, borderWidth: 2, borderColor: tab === t.id ? "#fff" : "transparent" }}>
                <Avatar uri={me.avatar} name={me.me.displayName} num={me.me.rowerNumber} size={28} />
              </View>
            ) : (
              <t.Icon color="#fff" size={26} />
            )}
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}
