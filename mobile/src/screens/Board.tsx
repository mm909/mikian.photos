import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api, type BoardData, type BoardRow } from "../api";
import { useSession } from "../session";
import { Ctl, Dateline, Lead, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Blocks, Waiting, useLoad } from "../ui";

/* THE 100K BOARD, the site's /board on a phone (board/Board100k.tsx,
 * board100kCss.ts), piece for piece:
 *
 *   the dateline: the month left, the day of it right, a 2px rule, and a
 *     square for every day with the days gone filled;
 *   the strip: which challenge and how many are in, in ordinary mono caps,
 *     with OPT IN at its right for a rower who is not;
 *   the table: # · ROWER · METERS, each tier under its word in Archivo
 *     Black, and a tier prints only once somebody is in it;
 *   the row: its share of 100,000 m as a wash from the screen's left edge
 *     that stops where the figures start, a faint neutral for the field and
 *     the blue for the viewer, whose place and number are in the blue too.
 *
 * ONE THING THE SITE DOES NOT HAVE: YOUR LINE, under the dateline, for the
 * look a rower takes before a row (owner, 2026-11-20: "gets on the app to
 * check stats/current meters/who has passed them/how many more they need";
 * the app opens on this screen for that). Their place, their metres, how far
 * to 100,000, how far to the rower above, and who has gone past them since
 * they last opened the app.
 *
 * No headline of its own: the site has none (owner, 2026-11-20: "I dont
 * like the 'the 100k' header, we dont have that on the site"). The rows are
 * the site's own (api/row100k/app/board reads boardPageData.ts), so a hidden
 * rower prints blocks and no place here as there. A name opens the rower. */

const GOAL = 100_000;
/* Everything right of the 100,000 m line: the metres column and the edge. */
const FIGS = 102;

export function BoardScreen({ onRower }: { onRower: (n: number) => void }) {
  const { me, refresh } = useSession();
  const { data, error, loading, reload } = useLoad(() => api<BoardData>("/api/row100k/app/board"), [me.me?.rowerNumber]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (!data) return <Waiting error={error} onRetry={reload} />;

  const optIn = async () => {
    setBusy(true);
    setNote("");
    try {
      await api("/api/row100k/month-optin", { body: {} });
      await Promise.all([reload(), refresh()]);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy(false);
  };

  /* Places count the ranked rows only: the hidden elite carry none. */
  let place = 0;
  const placed = data.rows.map((r) => ({ r, place: r.unranked ? null : ++place }));
  const tierOf = (r: BoardRow) => data.tiers.find((t) => r.meters >= t.floor) ?? data.tiers[data.tiers.length - 1];
  const word = data.month.word.toUpperCase();

  return (
    <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <View style={{ paddingHorizontal: 20 }}>
        <Dateline left={data.month.label} right={`Day ${data.month.day} of ${data.month.days}`} days={data.month.days} day={data.month.day} />
        <Yours data={data} onRower={onRower} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginTop: 30, paddingBottom: 9, borderBottomWidth: 2, borderColor: C.ink }}>
          <Text style={[mono(11), { flexShrink: 1 }]}>
            The {word} 100K · {data.rows.length} in
          </Text>
          {data.me && !data.me.in ? <Ctl label={busy ? "Opting in" : "Opt in"} disabled={busy} onPress={optIn} /> : null}
        </View>
        {note ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 10, lineHeight: 18 }]}>{note}</Text> : null}

        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 10, paddingTop: 9, paddingBottom: 8, borderBottomWidth: 1, borderColor: C.ink }}>
          <Text style={[mono(10, false, C.gray, 0.14), { width: 30 }]}>#</Text>
          <Text style={[mono(10, false, C.gray, 0.14), { flex: 1 }]}>Rower</Text>
          <Text style={[mono(10, false, C.gray, 0.14), { width: 72, textAlign: "right" }]}>Meters</Text>
        </View>
      </View>

      {data.unreadable ? <Text style={[mono(11, false, C.gray), { paddingHorizontal: 20, paddingVertical: 14 }]}>The board could not be read just now.</Text> : null}
      {data.rows.length === 0 && !data.unreadable ? <Text style={[mono(11, false, C.gray), { paddingHorizontal: 20, paddingVertical: 14 }]}>Nobody is in yet this month.</Text> : null}

      {data.tiers.map((t) => {
        const rows = placed.filter((x) => tierOf(x.r).key === t.key);
        if (!rows.length) return null;
        return (
          <View key={t.key}>
            <View style={{ marginHorizontal: 20, paddingTop: 26, paddingBottom: 9, borderBottomWidth: 1, borderColor: C.ink }}>
              <Text style={{ fontFamily: F.black, fontSize: 17, lineHeight: 18, letterSpacing: 0.2, color: C.ink, textTransform: "uppercase" }}>{t.title.replace(/row[tv]ember/i, data.month.word)}</Text>
            </View>
            {rows.map(({ r, place: n }, i) => (
              <Line key={r.rowerNumber} r={r} place={n} delay={Math.min(i, 12) * 40} onPress={() => onRower(r.rowerNumber)} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Line({ r, place, delay, onPress }: { r: BoardRow; place: number | null; delay: number; onPress: () => void }) {
  const hidden = r.blocks !== undefined;
  const frac = hidden ? 0 : Math.min(1, r.meters / GOAL);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: frac, duration: 800, delay, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: false }).start();
  }, [a, frac, delay]);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${place ? `Place ${place}, ` : ""}rower ${r.rowerNumber}, ${r.name}, ${hidden ? "hidden" : `${fmtInt(r.meters)} metres`}`} onPress={onPress} style={{ paddingHorizontal: 20 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: FIGS, top: 0, bottom: 1 }}>
        <Animated.View style={{ height: "100%", backgroundColor: r.me ? "rgba(0,119,182,0.3)" : "rgba(21,23,26,0.09)", width: a.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 10, minHeight: 42, paddingTop: 11, paddingBottom: 10, borderBottomWidth: 1, borderColor: C.line }}>
        <Text style={{ width: 30, fontFamily: r.me ? F.monoBold : F.mono, fontSize: 13, color: r.me ? C.accent : C.gray, fontVariant: ["tabular-nums"] }}>{place ?? ""}</Text>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.ink }}>
          <Text style={{ fontFamily: r.me ? F.monoBold : F.mono, fontSize: 12, color: r.me ? C.accent : C.gray }}>{String(r.rowerNumber).padStart(3, "0")} · </Text>
          {r.name}
        </Text>
        {hidden ? <Blocks n={r.blocks ?? 5} size={13} /> : <Text style={{ width: 72, textAlign: "right", fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>{r.shape ?? fmtInt(r.meters)}</Text>}
      </View>
    </Pressable>
  );
}

/* ---- your line --------------------------------------------------------- */

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/* The board as it stood the last time the app was opened, kept on the
 * phone: the rower's own metres and everybody else's. Read once per opening
 * of the app (so every look during one visit is measured against the same
 * earlier state) and written back each time the board is read. */
type Seen = { month: string; mine: number; rows: Record<string, number> };
const SEEN = "board/seen/1";
let baseline: Seen | null | undefined;

function Yours({ data, onRower }: { data: BoardData; onRower: (n: number) => void }) {
  const me = data.rows.find((r) => r.me);
  const [passedBy, setPassedBy] = useState<BoardRow[]>([]);
  const meters = me?.meters ?? -1;
  const hidden = me?.blocks !== undefined;
  useEffect(() => {
    if (!me || hidden) return;
    let live = true;
    (async () => {
      if (baseline === undefined) {
        try {
          const raw = await AsyncStorage.getItem(SEEN);
          baseline = raw ? (JSON.parse(raw) as Seen) : null;
        } catch {
          baseline = null;
        }
      }
      const was = baseline && baseline.month === data.month.key ? baseline : null;
      /* Above me now, and under me then. A rower who was not on the board
       * then counts as under. Hidden rows have no metres to compare. */
      const went = was ? data.rows.filter((r) => !r.me && r.blocks === undefined && r.meters > me.meters && (was.rows[String(r.rowerNumber)] ?? 0) < was.mine) : [];
      if (live) setPassedBy(went);
      const now: Seen = { month: data.month.key, mine: me.meters, rows: Object.fromEntries(data.rows.filter((r) => r.blocks === undefined).map((r) => [String(r.rowerNumber), r.meters])) };
      AsyncStorage.setItem(SEEN, JSON.stringify(now)).catch(() => null);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.month.key, meters, hidden, data.rows.length]);

  if (!me) return null;
  const ranked = data.rows.filter((r) => !r.unranked);
  const at = ranked.findIndex((r) => r.me);
  const above = at > 0 ? ranked[at - 1] : null;
  const toGo = GOAL - me.meters;
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={mono(11, true)}>
        You
        {at >= 0 ? (
          <>
            {" · "}
            <Text style={{ color: C.accent }}>{ordinal(at + 1)}</Text>
            <Text style={{ fontFamily: F.mono, color: C.gray }}> of {data.rows.length}</Text>
          </>
        ) : null}
      </Text>
      {hidden ? <Lead value={<Blocks n={me.blocks ?? 5} size={40} />} unit="m" /> : <Lead value={me.shape ?? fmtInt(me.meters)} unit="m" size={52} />}
      {hidden ? null : (
        <Text style={[mono(11, false, C.gray, 0.12), { marginTop: 10, lineHeight: 19 }]}>
          <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{toGo > 0 ? `${fmtInt(toGo)} m to 100K` : `100K done, ${fmtInt(-toGo)} m over`}</Text>
          {above && above.blocks === undefined ? ` · ${fmtInt(above.meters - me.meters)} m behind ${above.name}` : at === 0 ? " · leading the board" : ""}
        </Text>
      )}
      {passedBy.length ? (
        <View style={{ marginTop: 12 }}>
          <Text style={mono(11, true, C.accent)}>
            {passedBy.length === 1 ? "1 rower" : `${passedBy.length} rowers`} passed you since you last looked
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 2, marginTop: 4 }}>
            {passedBy.slice(0, 6).map((r) => (
              <Pressable key={r.rowerNumber} accessibilityRole="link" accessibilityLabel={`${r.name} passed you`} onPress={() => onRower(r.rowerNumber)} hitSlop={6} style={{ minHeight: 28, justifyContent: "center" }}>
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, textDecorationLine: "underline", textDecorationStyle: "dotted" }}>{r.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
