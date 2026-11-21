import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, SafeAreaView, Text, View, useWindowDimensions } from "react-native";
import { useErg } from "./src/erg/useErg";
import { BoardScreen } from "./src/screens/Board";
import { FeedScreen } from "./src/screens/Feed";
import { ProfileScreen } from "./src/screens/Profile";
import { RowPage, type Fresh } from "./src/screens/RowPage";
import type { TelemetryDoc } from "./src/pm5/session";
import { RowScreen, type Logged } from "./src/screens/RowScreen";
import { BellGlyph, NewsScreen, PeopleScreen, SearchGlyph, SearchScreen, SettingsScreen, type PeopleList } from "./src/screens/Social";
import { StatsScreen } from "./src/screens/Stats";
import { SessionProvider, useSession } from "./src/session";
import { loadRows, saveDoc, saveRows, type Row } from "./src/store";
import { C, F, fmtClock, fmtInt } from "./src/theme";

/* ROW, THE APP.
 *
 * THE SHAPE (owner, 2026-11-20): "What if we have 3 buttons, feed, stats,
 * profile at the bottom and then log a row up top right?"; and, the same
 * day, "I def dont want to remove the board. I also dont want to have the
 * stats page buried by the 100k board every month". So four words at the
 * bottom, FEED · BOARD · STATS · PROFILE, and LOG A ROW top right.
 *
 * Every screen reads the site (src/api.ts): the same routes, the same
 * numbers, the same rules about who is hidden. The one thing that lives on
 * the phone is the row in progress (erg/useErg.ts), held here above the
 * screens so leaving the monitor for the feed or a profile does not end it:
 * a strip over the tabs says it is still recording and leads back.
 *
 * No router: a tab, and a short stack of things opened over it (a rower, the
 * log, the read of a row just recorded).
 *
 * SEARCH AND THE BELL (pass 3, 2026-11-21; owner, 2026-11-20: "search
 * function", "a notification centre") sit in the top bar beside LOG A ROW,
 * as two glyphs: they are reached from every tab, and the four words at the
 * bottom stay four. The bell carries how many lines are unread plus how
 * many follow requests are waiting. */

type Tab = "feed" | "board" | "stats" | "profile";
const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "board", label: "Board" },
  { id: "stats", label: "Stats" },
  { id: "profile", label: "Profile" },
];

type Over =
  | { kind: "rower"; num: number }
  | { kind: "row"; id: string; fresh?: Fresh; doc?: TelemetryDoc }
  | { kind: "search" }
  | { kind: "news" }
  | { kind: "settings" }
  | { kind: "people"; list: PeopleList; num?: number };

const PEOPLE: Record<PeopleList, string> = { followers: "Followers", following: "Following", requests: "Requests", blocked: "Blocked" };

export default function App() {
  const [fontsIn] = useFonts({ ArchivoBlack_400Regular, Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold, SpaceMono_400Regular, SpaceMono_700Bold });
  if (!fontsIn) return <View style={{ flex: 1, backgroundColor: C.paper }} />;
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const { refresh, me } = useSession();
  const erg = useErg();
  const win = useWindowDimensions();
  const [tab, setTab] = useState<Tab>("board");
  const [stack, setStack] = useState<Over[]>([]);
  /* LOG A ROW sits over everything. Once opened it stays mounted until the
   * row is logged, shown or not, so a form half filled survives a look at
   * the feed (the row in progress itself lives in useErg and needs no such
   * care). */
  const [log, setLog] = useState<"closed" | "hidden" | "shown">("closed");
  /* Moves when a row is logged, so the screens that list rows read again. */
  const [stamp, setStamp] = useState(0);
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
  const push = (o: Over) => setStack((s) => [...s, o]);
  const pop = () => (logOn ? setLog("hidden") : setStack((s) => s.slice(0, -1)));
  const rowing = erg.phase === "live";
  /* The monitor takes the whole screen: no bar, no tabs, its own way out. */
  const monitor = rowing && logOn;
  const openLog = () => setLog("shown");
  const openRower = (num: number) => push({ kind: "rower", num });
  const openRow = (id: string) => push({ kind: "row", id });
  const openPeople = (list: PeopleList, num?: number) => push({ kind: "people", list, num });
  const openSettings = () => push({ kind: "settings" });

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

  const title = logOn
    ? "Log a row"
    : !top
      ? ""
      : top.kind === "row"
        ? top.fresh
          ? "Logged"
          : "The row"
        : top.kind === "rower"
          ? `Rower ${String(top.num).padStart(3, "0")}`
          : top.kind === "search"
            ? "Search"
            : top.kind === "news"
              ? "Notifications"
              : top.kind === "settings"
                ? "Settings"
                : PEOPLE[top.list];
  const wide = win.width > win.height;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar style="dark" hidden={monitor && wide} />
      <View style={{ flex: 1, width: "100%", maxWidth: monitor ? 1100 : 560, alignSelf: "center", paddingTop: Platform.OS === "android" ? 28 : 0 }}>
        {monitor ? null : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, minHeight: 54, borderBottomWidth: 2, borderColor: C.ink }}>
            {over ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={pop} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
                <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink }}>←</Text>
                <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2.2, color: C.ink }}>{title.toUpperCase()}</Text>
              </Pressable>
            ) : (
              /* THE MARK (owner, 2026-11-14: "change our logo to ROW with the O in the Rowtember color"). */
              <Text accessibilityRole="header" accessibilityLabel="Row" style={{ fontSize: 26, fontFamily: F.black, letterSpacing: 0.5, color: C.ink }}>
                R<Text style={{ color: C.accent }}>O</Text>W
              </Text>
            )}
            {logOn ? null : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {over ? null : (
                  <>
                    <Pressable accessibilityRole="button" accessibilityLabel="Search rowers" onPress={() => push({ kind: "search" })} hitSlop={6} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
                      <SearchGlyph />
                    </Pressable>
                    {me.me ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={waiting ? `Notifications, ${waiting} waiting` : "Notifications"} onPress={() => push({ kind: "news" })} hitSlop={6} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: 8, opacity: pressed ? 0.5 : 1 })}>
                        <BellGlyph count={waiting} />
                      </Pressable>
                    ) : null}
                  </>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={rowing ? "Back to the row in progress" : "Log a row"} onPress={openLog} style={({ pressed }) => ({ backgroundColor: C.accent, minHeight: 40, paddingHorizontal: 14, justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: "#fff" }}>{rowing ? "● ROWING" : "+ LOG A ROW"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        <View style={{ flex: 1 }}>
          {/* The tab underneath stays mounted while something is open over
              it, so coming back is where you left it. */}
          <View style={{ flex: 1, display: over ? "none" : "flex" }}>
            {tab === "feed" ? <FeedScreen onRower={openRower} onRow={openRow} stamp={stamp} /> : null}
            {tab === "board" ? <BoardScreen key={stamp} onRower={openRower} /> : null}
            {tab === "stats" ? <StatsScreen onRower={openRower} /> : null}
            {tab === "profile" ? <ProfileScreen key={stamp} onLog={openLog} onRow={openRow} onPeople={openPeople} onSettings={openSettings} /> : null}
          </View>
          {top?.kind === "rower" ? <ProfileScreen key={`r${top.num}`} num={top.num} onRow={openRow} onPeople={openPeople} /> : null}
          {top?.kind === "search" ? <SearchScreen onRower={openRower} /> : null}
          {top?.kind === "people" ? <PeopleScreen key={`${top.list}${top.num ?? ""}`} list={top.list} num={top.num} onRower={openRower} /> : null}
          {top?.kind === "settings" ? <SettingsScreen onPeople={openPeople} /> : null}
          {top?.kind === "news" ? (
            <NewsScreen
              onRower={openRower}
              onRow={openRow}
              onPeople={openPeople}
              onSettings={openSettings}
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
            <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: "#fff", fontVariant: ["tabular-nums"] }}>
              <Text style={{ color: C.accentLight }}>● </Text>
              {erg.live.ended ? "FINISHED" : "ROWING"} · {fmtInt(Math.floor(erg.live.meters))} M · {fmtClock(erg.live.elapsedS, false)}
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: "#fff" }}>OPEN →</Text>
          </Pressable>
        ) : null}

        {monitor ? null : (
          <View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 2, borderColor: C.ink, backgroundColor: C.paper }}>
            {TABS.map((t) => {
              const on = tab === t.id && !over;
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setStack([]);
                    if (logOn) setLog("hidden");
                    setTab(t.id);
                  }}
                  style={{ flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center" }}
                >
                  {/* The site rail marks the page it is on with a box of the blue. */}
                  <View style={{ backgroundColor: on ? C.accent : "transparent", paddingHorizontal: 9, paddingVertical: 7 }}>
                    <Text style={{ fontSize: 12, fontFamily: on ? F.monoBold : F.mono, letterSpacing: 1.6, color: on ? "#fff" : C.gray }}>{t.label.toUpperCase()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
