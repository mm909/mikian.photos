import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { crewFeed, type FeedItem } from "../board";
import { metersInMonth, metersOn, type Profile, type Row } from "../store";
import { C, F, dayKey, fmtClock, fmtInt, fmtPace } from "../theme";
import { Bar, Eyebrow, Num, Pop, styles, useCount } from "../ui";
import { Board } from "./Board";

/* THE FEED (owner, 2026-11-14: "the buttons should be a feed of people's
 * rows, log a row ..., and profile").
 *
 * The first thing the app shows: today, as the site's front page says it
 * (the date, the day of the month, a square for every day and a filled one
 * for every day rowed), then the two bars, then everybody's rows, newest
 * first. BOARD is the same people added up. Your own rows open THE READ.
 *
 * Until sign-in exists the other rowers are samples, and the screen says
 * so at the foot. */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ago(at: number, now: number): string {
  const min = Math.max(0, Math.round((now - at) / 60000));
  if (min < 1) return "now";
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} h ago`;
  return "yesterday";
}

export function Feed({ rows, profile, banked, before, onOpen }: { rows: Row[]; profile: Profile; banked: Row | null; before: number | null; onOpen: (r: Row) => void }) {
  const [view, setView] = useState<"feed" | "board">(before !== null ? "board" : "feed");
  const now = new Date();
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const todayM = metersOn(rows, today);
  const monthM = metersInMonth(rows, month);
  const todayShown = useCount(todayM);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const rowed = new Set(rows.filter((r) => r.day.startsWith(month)).map((r) => Number(r.day.slice(8))));
  const monthWord = now.getMonth() === 8 ? "Rowtember" : now.getMonth() === 10 ? "Rowvember" : MONTHS[now.getMonth()];

  const mine: FeedItem[] = rows.map((r) => ({ id: r.id, name: profile.name || "You", meters: r.meters, seconds: r.seconds, at: r.at, you: true, rowId: r.id }));
  const feed = [...mine, ...crewFeed(now)].sort((a, b) => b.at - a.at).slice(0, 40);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* The nameplate: the month, the day, a square a day. */}
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Eyebrow style={{ color: C.ink }}>
          {monthWord} {now.getFullYear()}
        </Eyebrow>
        <Eyebrow style={{ color: C.ink }}>
          Day {now.getDate()} of {days}
        </Eyebrow>
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 8, marginBottom: 22 }}>
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const isToday = d === now.getDate();
          return <View key={d} style={{ flex: 1, height: 7, backgroundColor: rowed.has(d) ? (isToday ? C.accent : C.ink) : "transparent", borderWidth: 1, borderColor: isToday ? C.accent : d < now.getDate() ? C.ink : C.line }} />;
        })}
      </View>

      {banked ? (
        <Pop>
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2.2, color: C.accent, marginBottom: 4 }}>ROW BANKED · +{fmtInt(banked.meters)} M</Text>
        </Pop>
      ) : (
        <Eyebrow>Today</Eyebrow>
      )}
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Num size={84} color={C.accent} style={{ flexShrink: 1 }}>
          {fmtInt(todayShown)}
        </Num>
        <Text style={{ fontFamily: F.black, fontSize: 26, color: C.ink }}>m</Text>
      </View>
      <Bar value={todayM} goal={profile.dailyGoal} height={10} />
      <View style={[styles.row, { justifyContent: "space-between", marginTop: 8, marginBottom: 18 }]}>
        <Eyebrow>of {fmtInt(profile.dailyGoal)} m today</Eyebrow>
        <Eyebrow style={{ color: todayM >= profile.dailyGoal ? C.good : C.gray }}>{todayM >= profile.dailyGoal ? "Done" : `${fmtInt(profile.dailyGoal - todayM)} to go`}</Eyebrow>
      </View>
      <Bar value={monthM} goal={profile.monthGoal} height={4} color={C.ink} delay={250} />
      <View style={[styles.row, { justifyContent: "space-between", marginTop: 8, marginBottom: 26 }]}>
        <Eyebrow>
          {fmtInt(monthM)} of {fmtInt(profile.monthGoal)} m this month
        </Eyebrow>
        <Eyebrow>{Math.min(100, Math.round((monthM / profile.monthGoal) * 100))}%</Eyebrow>
      </View>

      {/* FEED | BOARD, the way the site's rail marks the page it is on. */}
      <View style={{ flexDirection: "row", gap: 22, borderBottomWidth: 2, borderColor: C.ink, marginBottom: 6 }}>
        {(["feed", "board"] as const).map((v) => (
          <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: view === v }} onPress={() => setView(v)} style={{ paddingVertical: 10, borderBottomWidth: 3, borderColor: view === v ? C.accent : "transparent", marginBottom: -2 }}>
            <Text style={{ fontFamily: view === v ? F.monoBold : F.mono, fontSize: 13, letterSpacing: 2.2, color: view === v ? C.ink : C.gray }}>{v.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {view === "board" ? (
        <View style={{ marginTop: 16 }}>
          <Board name={profile.name || "You"} meters={monthM} before={before} />
        </View>
      ) : (
        <View>
          {feed.map((f) => {
            const mineRow = f.rowId ? rows.find((r) => r.id === f.rowId) : undefined;
            const open = mineRow?.hasDoc ? () => onOpen(mineRow) : undefined;
            return (
              <Pressable key={f.id} onPress={open} disabled={!open} style={{ borderBottomWidth: 1, borderColor: C.line, paddingVertical: 16 }}>
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <Text style={{ fontFamily: f.you ? F.black : F.semi, fontSize: 16, color: f.you ? C.accent : C.ink }}>{f.name}</Text>
                  <Eyebrow>{ago(f.at, now.getTime())}</Eyebrow>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 2 }}>
                  <Num size={32}>{fmtInt(f.meters)} m</Num>
                  <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.soft, fontVariant: ["tabular-nums"] }}>
                    {fmtClock(f.seconds)} · {fmtPace(f.meters > 0 ? (f.seconds / f.meters) * 500 : 0)}
                  </Text>
                </View>
                {open ? <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2.2, color: C.accent, marginTop: 6 }}>THE READ →</Text> : null}
              </Pressable>
            );
          })}
          <Text style={{ fontSize: 13, fontFamily: F.sans, color: C.gray, marginTop: 14, lineHeight: 19 }}>Sample rowers for now. Everyone's real rows arrive with sign-in.</Text>
        </View>
      )}
    </ScrollView>
  );
}
