import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { metersInMonth, streak, week, type Profile, type Row } from "../store";
import { C, F, dayKey, fmtClock, fmtInt, fmtPace } from "../theme";
import { Card, Eyebrow, Num, styles } from "../ui";

/* PROFILE: who you are on the board, the streak and the week as a picture,
 * and every row banked on this phone. A row recorded from an erg opens THE
 * READ. */

const SOURCE: Record<Row["source"], string> = { erg: "PM5", demo: "Demo", manual: "By hand" };

export function ProfileScreen({ rows, profile, onProfile, onDelete, onOpen }: { rows: Row[]; profile: Profile; onProfile: (p: Profile) => void; onDelete: (id: string) => void; onOpen: (r: Row) => void }) {
  const now = new Date();
  const list = [...rows].sort((a, b) => b.at - a.at);
  const run = streak(rows, now);
  const days = week(rows, now);
  const monthM = metersInMonth(rows, dayKey(now).slice(0, 7));
  const total = rows.reduce((n, r) => n + r.meters, 0);
  const field = { borderBottomWidth: 1, borderColor: C.ink, fontSize: 22, fontFamily: F.black, paddingVertical: 6, color: C.ink } as const;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Eyebrow>Name on the board</Eyebrow>
      <TextInput style={[field, { marginBottom: 18 }]} value={profile.name} maxLength={24} onChangeText={(name) => onProfile({ ...profile, name })} accessibilityLabel="Name" />

      <View style={{ flexDirection: "row", marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Streak</Eyebrow>
          <Num size={40} color={C.accent}>
            {run} {run === 1 ? "day" : "days"}
          </Num>
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow>This month</Eyebrow>
          <Num size={40}>{fmtInt(monthM)}</Num>
        </View>
      </View>

      <Card>
        <Eyebrow style={{ marginBottom: 12 }}>The last seven days</Eyebrow>
        <View style={[styles.row, { justifyContent: "space-between", alignItems: "flex-end" }]}>
          {days.map((d, i) => (
            <View key={d.day} style={{ alignItems: "center", flex: 1 }}>
              <DayColumn meters={d.meters} goal={profile.dailyGoal} delay={i * 70} today={d.today} />
              <Text style={{ fontSize: 11, fontFamily: d.today ? F.monoBold : F.mono, color: d.today ? C.accent : C.gray, marginTop: 6 }}>{d.letter}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Eyebrow>Daily goal, meters</Eyebrow>
        <TextInput
          style={field}
          keyboardType="number-pad"
          value={String(profile.dailyGoal || "")}
          onChangeText={(v) => onProfile({ ...profile, dailyGoal: Math.min(100000, Math.max(0, Math.round(Number(v)) || 0)) })}
          accessibilityLabel="Daily goal in meters"
        />
      </Card>

      <View style={{ borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8, marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
        <Eyebrow style={{ color: C.ink }}>
          {list.length} {list.length === 1 ? "row" : "rows"}
        </Eyebrow>
        <Eyebrow style={{ color: C.ink }}>{fmtInt(total)} m all told</Eyebrow>
      </View>
      {list.length === 0 ? <Text style={[styles.body, { marginTop: 14 }]}>Nothing banked yet. Log a row and it lands here.</Text> : null}
      {list.map((r) => (
        <View key={r.id} style={{ borderBottomWidth: 1, borderColor: C.line, paddingVertical: 14 }}>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Eyebrow>
              {r.day} · {SOURCE[r.source]}
            </Eyebrow>
            <Text style={{ fontSize: 11, fontFamily: F.mono, color: C.gray, letterSpacing: 2 }} onPress={() => onDelete(r.id)} accessibilityRole="button">
              DELETE
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Num size={30}>{fmtInt(r.meters)} m</Num>
            <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.soft, fontVariant: ["tabular-nums"] }}>
              {fmtClock(r.seconds)} · {fmtPace(r.meters > 0 ? (r.seconds / r.meters) * 500 : 0)}
              {r.avgWatts ? ` · ${r.avgWatts} W` : ""}
            </Text>
          </View>
          {r.hasDoc ? (
            <Pressable onPress={() => onOpen(r)} accessibilityRole="button" style={{ paddingTop: 8 }}>
              <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2.2, color: C.accent }}>THE READ →</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Text style={{ fontSize: 13, fontFamily: F.sans, color: C.gray, marginTop: 16, lineHeight: 19 }}>Rows stay on this phone for now.</Text>
    </ScrollView>
  );
}

/* One day of the week: a column that rises to that day's share of the goal. */
function DayColumn({ meters, goal, delay, today }: { meters: number; goal: number; delay: number; today: boolean }) {
  const frac = goal > 0 ? Math.min(1, meters / goal) : 0;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: frac, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, frac, delay]);
  return (
    <View style={{ width: 20, height: 72, backgroundColor: C.pale, justifyContent: "flex-end" }}>
      <Animated.View style={{ backgroundColor: frac >= 1 ? C.good : today ? C.accent : C.ink, height: a.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}
