import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, Pressable, SafeAreaView, Text, View } from "react-native";
import { Feed } from "./src/screens/Feed";
import { ProfileScreen } from "./src/screens/Profile";
import { Review } from "./src/screens/Review";
import { RowScreen } from "./src/screens/RowScreen";
import type { TelemetryDoc } from "./src/pm5/session";
import { DEFAULT_PROFILE, deleteDoc, loadProfile, loadRows, metersInMonth, metersOn, saveDoc, saveProfile, saveRows, type Profile, type Row } from "./src/store";
import { C, F, dayKey } from "./src/theme";

/* ROW, THE APP (owner, 2026-11-14: "an interface kind of like a daily log
 * game ... animations for bars filling up or moving up the leaderboard ...
 * the Concept2 machines need to be able to connect to it"; and, of the
 * first cut, "the buttons should be a feed of people's rows, log a row (or
 * connect to an erg for the live erg menus), and profile").
 *
 * Three tabs and no router: FEED (today, everybody's rows, the board), LOG
 * A ROW (connect a PM5, watch it, bank it; or a demo; or by hand), PROFILE
 * (you, your streak, your rows). A recorded row opens THE READ, and DONE
 * there lands on the feed with the bars filling and the board ready to
 * climb. */

type Tab = "feed" | "row" | "profile";
const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "row", label: "Log a row" },
  { id: "profile", label: "Profile" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("feed");
  const [rows, setRows] = useState<Row[]>([]);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);
  const [fontsIn] = useFonts({ ArchivoBlack_400Regular, Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold, SpaceMono_400Regular, SpaceMono_700Bold });
  /* The row just banked, for the banner; and the month total before it, for the climb. */
  const [banked, setBanked] = useState<Row | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  /* THE READ, open over the tabs: the row being read, and whether it was just banked. */
  const [reading, setReading] = useState<{ row: Row; fresh: boolean } | null>(null);

  useEffect(() => {
    Promise.all([loadRows(), loadProfile()]).then(([r, p]) => {
      setRows(r);
      setProfile(p);
      setReady(true);
    });
  }, []);

  const month = dayKey().slice(0, 7);
  const monthM = metersInMonth(rows, month);

  /* A recorded piece opens on THE READ; DONE there lands on TODAY with the
   * bars filling. A row with no recording goes straight to TODAY. */
  const bank = async (r: Row, doc?: TelemetryDoc) => {
    let row = r;
    if (doc) {
      try {
        await saveDoc(r.id, doc);
      } catch {
        row = { ...r, hasDoc: false };
      }
    }
    setBefore(monthM);
    const next = [...rows, row];
    setRows(next);
    saveRows(next).catch(() => null);
    setBanked(row);
    setTab("feed");
    if (row.hasDoc) setReading({ row, fresh: true });
  };

  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    saveRows(next).catch(() => null);
    deleteDoc(id);
  };

  const go = (t: Tab) => {
    /* Leaving the feed spends the banner and the climb. */
    if (tab === "feed" && t !== "feed" && !reading) {
      setBefore(null);
      setBanked(null);
    }
    setReading(null);
    setTab(t);
  };

  if (!ready || !fontsIn) return <View style={{ flex: 1, backgroundColor: C.paper }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", paddingTop: Platform.OS === "android" ? 28 : 0 }}>
        <View style={{ paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 2, borderColor: C.ink }}>
          {/* THE MARK (owner, 2026-11-14: "change our logo to ROW with the O in the Rowtember color"). */}
          <Text accessibilityLabel="Row" style={{ fontSize: 24, fontFamily: F.black, letterSpacing: 0.5, color: C.ink }}>
            R<Text style={{ color: C.accent }}>O</Text>W
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {reading ? (
            <Review
              row={reading.row}
              rows={rows}
              banked={reading.fresh}
              onDone={() => setReading(null)}
              onDelete={() => {
                remove(reading.row.id);
                setBanked(null);
                setReading(null);
              }}
            />
          ) : null}
          {!reading && tab === "feed" ? <Feed rows={rows} profile={profile} banked={banked} before={before} onOpen={(r) => setReading({ row: r, fresh: false })} /> : null}
          {!reading && tab === "row" ? <RowScreen dailyGoal={profile.dailyGoal} todayMeters={metersOn(rows, dayKey())} onSave={bank} /> : null}
          {!reading && tab === "profile" ? (
            <ProfileScreen
              rows={rows}
              profile={profile}
              onProfile={(p) => {
                setProfile(p);
                saveProfile(p).catch(() => null);
              }}
              onDelete={remove}
              onOpen={(r) => setReading({ row: r, fresh: false })}
            />
          ) : null}
        </View>

        {/* The rail: three words, the one you are on in ink under a blue rule. */}
        <View style={{ flexDirection: "row", borderTopWidth: 2, borderColor: C.ink, backgroundColor: C.paper }}>
          {TABS.map((t) => {
            const on = tab === t.id && !reading;
            return (
              <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => go(t.id)} style={{ flex: t.id === "row" ? 1.3 : 1, minHeight: 58, alignItems: "center", justifyContent: "center", borderTopWidth: 4, borderColor: on ? C.accent : "transparent", marginTop: -2 }}>
                <Text style={{ fontSize: 12, fontFamily: on || t.id === "row" ? F.monoBold : F.mono, letterSpacing: 2.2, color: on ? C.ink : t.id === "row" ? C.accent : C.gray }}>
                  {t.id === "row" ? "+ " : ""}
                  {t.label.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
