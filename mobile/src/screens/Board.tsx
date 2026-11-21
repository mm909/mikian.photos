import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api, type BoardData, type BoardRow } from "../api";
import { useSession } from "../session";
import { Ctl, Dateline, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Blocks, Waiting, useLoad, useScrollDir } from "../ui";

/* THE 100K BOARD, the site's /board on a phone (board/Board100k.tsx,
 * board100kCss.ts):
 *
 *   the dateline: the month left, the day of it right, a 2px rule, and a
 *     square for every day with the days gone filled;
 *   each tier under its word in Archivo Black, and a tier prints only once
 *     somebody is in it;
 *   the row: its share of 100,000 m as a wash from the screen's left edge
 *     that stops where the figures start, a faint neutral for the field and
 *     the blue for the viewer, whose place and number are in the blue too.
 *
 * AND NOTHING ELSE (owner, 2026-11-21, of a first version that put the
 * viewer's own meters big and blue over the table: "there's no blue large
 * number callout on the board on the website. So let's not have it there in
 * the app either ... the board is just for seeing the 100K challenge, like
 * rankings"). Gone with it, on his word the same day: the line counting who
 * is in, and the "# ROWER METERS" heads over the table. The viewer finds
 * themselves by the blue row.
 *
 * The one control is OPT IN, for a rower who is not on this month's board.
 *
 * The rows are the site's own (api/row100k/app/board reads
 * boardPageData.ts), so a hidden rower prints blocks and no place here as
 * there. A name opens the rower. */

const GOAL = 100_000;
/* Everything right of the 100,000 m line: the meters column and the edge. */
const FIGS = 102;

export function BoardScreen({ onRower, onScrollDir }: { onRower: (n: number) => void; onScrollDir?: (down: boolean) => void }) {
  const dir = useScrollDir(onScrollDir);
  const { me, refresh } = useSession();
  const { data, error, loading, reload } = useLoad(() => api<BoardData>("/api/row100k/app/board"), [me.me?.rowerNumber], "/api/row100k/app/board");
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

  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <View style={{ paddingHorizontal: 20 }}>
        <Dateline left={data.month.label} right={`Day ${data.month.day} of ${data.month.days}`} days={data.month.days} day={data.month.day} />
        {data.me && !data.me.in ? (
          <View style={{ marginTop: 18 }}>
            <Ctl label={busy ? "Opting in" : `Opt in to ${data.month.word}`} disabled={busy} onPress={optIn} />
          </View>
        ) : null}
        {note ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 10, lineHeight: 18 }]}>{note}</Text> : null}
      </View>

      {data.unreadable ? <Text style={[mono(11, false, C.gray), { paddingHorizontal: 20, paddingVertical: 14 }]}>The board could not be read just now.</Text> : null}
      {data.rows.length === 0 && !data.unreadable ? <Text style={[mono(11, false, C.gray), { paddingHorizontal: 20, paddingVertical: 14 }]}>Nobody is in yet this month.</Text> : null}

      {data.tiers.map((t) => {
        const rows = placed.filter((x) => tierOf(x.r).key === t.key);
        if (!rows.length) return null;
        /* WARMING UP is one line, not a list (owner, 2026-11-21: "the
         * warming up should probably be just this many rowers warming up for
         * this many meters"). The viewer's own row still prints if they are
         * among them, so they can find themselves. */
        if (t.key === "warming") {
          const meters = rows.reduce((n, x) => n + (x.r.blocks === undefined ? x.r.meters : 0), 0);
          const mine = rows.filter((x) => x.r.me);
          return (
            <View key={t.key}>
              <View style={{ marginHorizontal: 20, paddingTop: 26, paddingBottom: 9, borderBottomWidth: 1, borderColor: C.ink }}>
                <Text style={{ fontFamily: F.black, fontSize: 17, lineHeight: 18, letterSpacing: 0.2, color: C.ink, textTransform: "uppercase" }}>{t.title}</Text>
              </View>
              <Text style={[mono(11, false, C.gray, 0.12), { paddingHorizontal: 20, paddingVertical: 14 }]}>
                <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{rows.length}</Text> {rows.length === 1 ? "rower" : "rowers"} warming up · <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(meters)}</Text> m
              </Text>
              {mine.map(({ r, place: n }) => (
                <Line key={r.rowerNumber} r={r} place={n} delay={0} onPress={() => onRower(r.rowerNumber)} />
              ))}
            </View>
          );
        }
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
    <Pressable accessibilityRole="link" accessibilityLabel={`${place ? `Place ${place}, ` : ""}rower ${r.rowerNumber}, ${r.name}, ${hidden ? "hidden" : `${fmtInt(r.meters)} meters`}`} onPress={onPress} style={{ paddingHorizontal: 20 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: FIGS, top: 0, bottom: 1 }}>
        <Animated.View style={{ height: "100%", backgroundColor: r.me ? C.washMe : C.wash, width: a.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
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
