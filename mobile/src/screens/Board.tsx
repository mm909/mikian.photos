import AsyncStorage from "@react-native-async-storage/async-storage";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api, type BoardData, type BoardRow } from "../api";
import { useSession } from "../session";
import { Ctl, Dateline, WordMenu, mono } from "../site";
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
 * AND THE MONTH (owner, 2026-11-23: "On the 100K tab, I think I want to be
 * able to change what month I'm looking at. I want to see September's and
 * October's results as well"): the month's name between two arrows at the
 * top, the name itself a menu of every month there is a board for. This
 * month first. A past month is its final standings: no day of the month,
 * no OPT IN, no warming up (its rowers under the first rung are listed in
 * full under UNDER 10K), and in the sheet no days ahead to plan.
 *
 * The rows are the site's own (api/row100k/app/board reads
 * boardPageData.ts), so a hidden rower prints blocks and no place here as
 * there. A name opens the rower. */

const GOAL = 100_000;

/* What the board route answers since 2026-11-23: the months it has a board
 * for, oldest first, and whether this one is the month we are in. */
type Months = { key: string; label: string; name: string }[];
type BoardView = BoardData & { months?: Months; live?: boolean };
/* Everything right of the 100,000 m line: the meters column and the edge. */
const FIGS = 102;

export function BoardScreen({ onRower, onScrollDir, look = "bars" }: { onRower: (n: number) => void; onScrollDir?: (down: boolean) => void; /* Which look: the board as it is, or the sheet being tried. */ look?: "bars" | "sheet" }) {
  const dir = useScrollDir(onScrollDir);
  const { me, refresh } = useSession();
  /* The month on the screen: null is this month, whichever it is. */
  const [month, setMonth] = useState<string | null>(null);
  const path = `/api/row100k/app/board${month ? `?m=${month}` : ""}`;
  const { data, error, loading, reload } = useLoad(() => api<BoardView>(path), [path, me.me?.rowerNumber], path);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  /* WARMING UP opened into its rowers (owner, 2026-11-23: "I'm also still
   * not able to click on the warming up section and have me see those
   * rowers"). Shut again with every month change. */
  const [warm, setWarm] = useState(false);
  /* The months as last read, so the arrows stay up while another month's
   * board is on its way. */
  const months = useRef<Months>([]);
  if (data?.months?.length) months.current = data.months;
  const pick = (k: string) => {
    const now = months.current[months.current.length - 1]?.key;
    setMonth(k === now ? null : k);
    setWarm(false);
    setNote("");
  };
  const shownKey = month ?? months.current[months.current.length - 1]?.key ?? data?.month.key ?? "";
  if (!data || (month !== null && data.month.key !== month)) {
    if (!months.current.length) return <Waiting error={error} onRetry={reload} />;
    return (
      <ScrollView {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132 }}>
        <View style={{ paddingHorizontal: look === "sheet" ? 16 : 20 }}>
          <MonthPick months={months.current} value={shownKey} onPick={pick} />
        </View>
        <Waiting error={error} onRetry={reload} />
      </ScrollView>
    );
  }
  const live = data.live !== false;

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
  const head = months.current.length > 1 ? <MonthPick months={months.current} value={data.month.key} onPick={pick} /> : null;
  if (look === "sheet") return <Sheet data={data} live={live} head={head} placed={placed} loading={loading} reload={reload} onRower={onRower} dir={dir} />;
  const tierOf = (r: BoardRow) => data.tiers.find((t) => r.meters >= t.floor) ?? data.tiers[data.tiers.length - 1];

  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <View style={{ paddingHorizontal: 20 }}>
        {head}
        <Dateline left={data.month.label} right={live ? `Day ${data.month.day} of ${data.month.days}` : "Final standings"} days={data.month.days} day={data.month.day} />
        {live && data.me && !data.me.in ? (
          <View style={{ marginTop: 18 }}>
            <Ctl label={busy ? "Opting in" : `Opt in to ${data.month.word}`} disabled={busy} onPress={optIn} />
          </View>
        ) : null}
        {note ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 10, lineHeight: 18 }]}>{note}</Text> : null}
      </View>

      {data.unreadable ? <Text style={[mono(11, false, C.gray), { paddingHorizontal: 20, paddingVertical: 14 }]}>The board could not be read just now.</Text> : null}
      {data.rows.length === 0 && !data.unreadable ? <Text style={[mono(11, false, C.gray), { paddingHorizontal: 20, paddingVertical: 14 }]}>{live ? "Nobody is in yet this month." : "Nobody was on this month's board."}</Text> : null}

      {data.tiers.map((t) => {
        const rows = placed.filter((x) => tierOf(x.r).key === t.key);
        if (!rows.length) return null;
        /* WARMING UP is one line, not a list (owner, 2026-11-21: "the
         * warming up should probably be just this many rowers warming up for
         * this many meters"). The viewer's own row still prints if they are
         * among them, so they can find themselves. */
        if (t.key === "warming" && live) {
          const meters = rows.reduce((n, x) => n + (x.r.blocks === undefined ? x.r.meters : 0), 0);
          const mine = rows.filter((x) => x.r.me);
          return (
            <View key={t.key}>
              <View style={{ marginHorizontal: 20, paddingTop: 26, paddingBottom: 9, borderBottomWidth: 1, borderColor: C.ink }}>
                <Text style={{ fontFamily: F.black, fontSize: 17, lineHeight: 18, letterSpacing: 0.2, color: C.ink, textTransform: "uppercase" }}>{t.title}</Text>
              </View>
              {/* The line is a button: it opens into the rowers and shuts
               * again (owner, 2026-11-23). Still one line until pressed. */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: warm }}
                accessibilityLabel={`${rows.length} ${rows.length === 1 ? "rower" : "rowers"} warming up, ${fmtInt(meters)} meters. ${warm ? "Press to hide them" : "Press to see them"}.`}
                onPress={() => setWarm(!warm)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", columnGap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: pressed ? C.pale : "transparent", borderBottomWidth: warm ? 1 : 0, borderColor: C.line })}
              >
                <Text style={[mono(11, false, C.gray, 0.12), { flex: 1 }]}>
                  <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{rows.length}</Text> {rows.length === 1 ? "rower" : "rowers"} warming up · <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(meters)}</Text> m
                </Text>
                <Text style={mono(11, true, C.accent, 0.12)}>{warm ? "Hide ▴" : "See ▾"}</Text>
              </Pressable>
              {(warm ? rows : mine).map(({ r, place: n }, i) => (
                <Line key={r.rowerNumber} r={r} place={n} delay={warm ? Math.min(i, 12) * 40 : 0} onPress={() => onRower(r.rowerNumber)} />
              ))}
              {warm && rows.length > 8 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Hide the rowers warming up" onPress={() => setWarm(false)} hitSlop={8} style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
                  <Text style={mono(11, true, C.accent, 0.12)}>{"Hide ▴"}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }
        /* A past month's rowers under the first rung, in full: its final
         * standings, not a month still warming up. */
        const title = t.key === "warming" ? `Under ${Math.round((data.tiers.find((x) => x.key === "participant")?.floor ?? 10_000) / 1000)}K` : t.title.replace(/row[tv]ember/i, data.month.word);
        return (
          <View key={t.key}>
            <View style={{ marginHorizontal: 20, paddingTop: 26, paddingBottom: 9, borderBottomWidth: 1, borderColor: C.ink }}>
              <Text style={{ fontFamily: F.black, fontSize: 17, lineHeight: 18, letterSpacing: 0.2, color: C.ink, textTransform: "uppercase" }}>{title}</Text>
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

/* THE MONTH, AND THE WAY TO ANOTHER (owner, 2026-11-23: "it must be
 * obvious it can be changed"): the month's name big between two boxed
 * arrows, an arrow that has nowhere to go greyed out; the name is a menu
 * of every month there is a board for. Under it, this month or FINAL. */
function MonthPick({ months, value, onPick }: { months: Months; value: string; onPick: (k: string) => void }) {
  const at = Math.max(0, months.findIndex((m) => m.key === value));
  const cur = months[at];
  const live = at === months.length - 1;
  const arrow = (step: -1 | 1) => {
    const to = months[at + step];
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={to ? `${step < 0 ? "Earlier month" : "Later month"}: ${to.label}` : step < 0 ? "No earlier month" : "No later month"}
        disabled={!to}
        onPress={() => to && onPick(to.key)}
        hitSlop={6}
        style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: to ? C.ink : C.line, backgroundColor: pressed ? C.pale : "transparent" })}
      >
        <Text style={{ fontFamily: F.monoBold, fontSize: 22, lineHeight: 26, color: to ? C.ink : C.line }}>{step < 0 ? "‹" : "›"}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12, marginBottom: 16 }}>
      {arrow(-1)}
      <View style={{ flex: 1, alignItems: "center" }}>
        <WordMenu
          ariaLabel="Which month"
          options={[...months].reverse().map((m) => ({ key: m.key, label: m.name === m.label.split(" ")[0] ? m.label : `${m.name} · ${m.label}` }))}
          value={value}
          label={cur?.name ?? ""}
          onPick={onPick}
          width={260}
          textStyle={{ fontFamily: F.black, fontSize: 22, lineHeight: 26, letterSpacing: 0.3, color: C.ink, textTransform: "uppercase" }}
        />
        <Text style={[mono(10, true, live ? C.accent : C.gray, 0.14), { marginTop: 4 }]}>{live ? "This month" : "Final"}</Text>
      </View>
      {arrow(1)}
    </View>
  );
}

/* ---- THE SHEET: a look being tried ---------------------------------------
 *
 * (owner, 2026-11-22, of the board's bars: "could we do it in a way that's
 * like an attendance sheet? ... on GitHub ... that heat map ... boxes like
 * that, where inside of them is the meters that were rowed that day, and
 * there's one column per day ... we only show the days plus or minus 7
 * from us, at most, probably only 3 ahead"; "I want people to be able to
 * publicly declare their rowing plan ... let's just do the first 3 days";
 * "it's important, you need to see my current total ... a big number
 * above"; "on the left-hand side can be my rower number and my place and
 * my name. And then in the middle can kind of be the track"; "let's just
 * mock that up for now".)
 *
 * A MOCK, reached by an admin pressing the 100K at the top of the board
 * (App.tsx: "the secret dev trick ... click the top 100K button, it'll
 * swap the look"). The seven days gone and today are real (the board
 * route's `week`). THE THREE DAYS AHEAD ARE THE VIEWER'S OWN AND STAY ON
 * THE PHONE: a press on one of their own boxes steps it through a few
 * distances. Nothing is declared to anybody yet; that needs a table and a
 * route, and waits on his yes to the look. */

const PLAN_KEY = "plan/1";
const STEPS = [0, 2000, 5000, 10000, 15000, 20000];
const DAY = 86_400_000;
const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const dayOf = (key: string, add: number): string => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) + add * DAY).toISOString().slice(0, 10);
const letterOf = (key: string): string => LETTERS[new Date(`${key}T12:00:00Z`).getUTCDay()];
/* 5000 -> "5", 7500 -> "7.5", 12300 -> "12": thousands, as short as reads. */
const short = (m: number): string => (m >= 10_000 ? String(Math.round(m / 1000)) : m >= 1000 ? String(Math.round(m / 100) / 10) : m > 0 ? "<1" : "");

function Sheet({ data, live, head, placed, loading, reload, onRower, dir }: { data: BoardData; live: boolean; head: ReactNode; placed: { r: BoardRow; place: number | null }[]; loading: boolean; reload: () => void; onRower: (n: number) => void; dir: ReturnType<typeof useScrollDir> }) {
  const [plan, setPlan] = useState<Record<string, number>>({});
  useEffect(() => {
    AsyncStorage.getItem(PLAN_KEY)
      .then((v) => setPlan(v ? (JSON.parse(v) as Record<string, number>) : {}))
      .catch(() => null);
  }, []);
  const step = (day: string) => {
    const next = STEPS[(STEPS.indexOf(plan[day] ?? 0) + 1) % STEPS.length];
    const out = { ...plan, [day]: next };
    if (!next) delete out[day];
    setPlan(out);
    AsyncStorage.setItem(PLAN_KEY, JSON.stringify(out)).catch(() => null);
  };
  const days = data.week?.days ?? [];
  const today = days[days.length - 1] ?? `${data.month.key}-${String(data.month.day).padStart(2, "0")}`;
  /* A past month has no days ahead, and no today to ring: its boxes are
   * its last eight days (owner, 2026-11-23, the months). */
  const ahead = live ? [1, 2, 3].map((n) => dayOf(today, n)) : [];
  const ring = live ? today : "";
  const mine = data.me;
  const planned = ahead.reduce((n, d) => n + (plan[d] ?? 0), 0);
  const left = mine ? Math.max(0, GOAL - mine.meters) : 0;
  const daysLeft = Math.max(1, data.month.days - data.month.day + 1);
  const GAP = 3;

  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <View style={{ paddingHorizontal: 16 }}>
        {head}
        <Dateline left={data.month.label} right={live ? `Day ${data.month.day} of ${data.month.days}` : "Final standings"} days={data.month.days} day={data.month.day} />
        {mine && mine.blocks === undefined ? (
          <View style={{ marginTop: 18 }}>
            <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.gray }}>Your {data.month.word}</Text>
            <Text style={{ fontFamily: F.black, fontSize: 44, lineHeight: 50, color: C.ink, fontVariant: ["tabular-nums"], letterSpacing: -1 }}>{fmtInt(mine.meters)}</Text>
            <Text style={{ fontFamily: F.sans, fontSize: 13.5, color: C.gray }}>
              {!live ? (left > 0 ? "Final" : "100K made") : left > 0 ? `${fmtInt(left)} to go · ${fmtInt(Math.ceil(left / daysLeft))} a day gets there` : "100K made"}
              {planned ? ` · ${fmtInt(planned)} planned` : ""}
            </Text>
          </View>
        ) : null}

        {/* The days, once, over every rower's boxes. */}
        <View style={{ flexDirection: "row", gap: GAP, marginTop: 22, paddingBottom: 6, borderBottomWidth: 1, borderColor: C.ink }}>
          {[...days, ...ahead].map((d) => (
            <Text key={d} style={{ flex: 1, textAlign: "center", fontFamily: d === ring ? F.monoBold : F.mono, fontSize: 10, color: d === ring ? C.ink : C.gray }}>
              {letterOf(d)}
            </Text>
          ))}
        </View>
      </View>

      {data.rows.length === 0 ? <Text style={[mono(11, false, C.gray), { paddingHorizontal: 16, paddingVertical: 14 }]}>{live ? "Nobody is in yet this month." : "Nobody was on this month's board."}</Text> : null}
      {placed.map(({ r, place }) => {
        const hidden = r.blocks !== undefined;
        const week = data.week?.meters[r.rowerNumber] ?? days.map(() => 0);
        return (
          <View key={r.rowerNumber} style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.line }}>
            <Pressable accessibilityRole="link" accessibilityLabel={`${place ? `Place ${place}, ` : ""}rower ${r.rowerNumber}, ${r.name}`} onPress={() => onRower(r.rowerNumber)} style={{ flexDirection: "row", alignItems: "baseline", columnGap: 8 }}>
              <Text style={{ width: 22, fontFamily: r.me ? F.monoBold : F.mono, fontSize: 12, color: r.me ? C.ink : C.gray, fontVariant: ["tabular-nums"] }}>{place ?? ""}</Text>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: r.me ? F.bold : F.semi, fontSize: 14.5, color: C.ink }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11.5, color: C.gray }}>{String(r.rowerNumber).padStart(3, "0")} </Text>
                {r.name}
              </Text>
              {hidden ? <Blocks n={r.blocks ?? 5} size={12} /> : <Text style={{ fontFamily: F.bold, fontSize: 14.5, color: C.ink, fontVariant: ["tabular-nums"] }}>{r.shape ?? fmtInt(r.meters)}</Text>}
            </Pressable>
            {hidden ? null : (
              <View style={{ flexDirection: "row", gap: GAP, marginTop: 8 }}>
                {days.map((d, i) => {
                  const m = week[i] ?? 0;
                  const deep = Math.min(1, m / 10_000);
                  return (
                    <View key={d} accessibilityLabel={`${d}: ${m ? `${fmtInt(m)} meters` : "no row"}`} style={{ flex: 1, height: 30, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: m ? C.ink : C.pale, opacity: m ? 0.28 + 0.72 * deep : 1, borderWidth: d === ring ? 2 : 0, borderColor: C.ink }}>
                      <Text style={{ fontFamily: F.monoBold, fontSize: 10, color: C.paper, fontVariant: ["tabular-nums"] }}>{short(m)}</Text>
                    </View>
                  );
                })}
                {ahead.map((d) => {
                  const m = r.me ? (plan[d] ?? 0) : 0;
                  return (
                    <Pressable key={d} accessibilityRole={r.me ? "button" : "text"} accessibilityLabel={r.me ? `Plan for ${d}: ${m ? `${fmtInt(m)} meters` : "nothing yet"}. Press to change.` : `${d}: nothing planned`} disabled={!r.me} onPress={() => step(d)} style={{ flex: 1, height: 30, borderRadius: 4, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: r.me ? C.ink : C.line }}>
                      <Text style={{ fontFamily: F.monoBold, fontSize: 10, color: C.ink, fontVariant: ["tabular-nums"] }}>{m ? short(m) : r.me ? "+" : ""}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
      <Text style={{ fontFamily: F.sans, fontSize: 12.5, lineHeight: 18, color: C.gray, paddingHorizontal: 16, paddingTop: 14 }}>{live ? "A box is a day: the seven gone, today, and the three ahead, in thousands of meters. Press one of your own three to plan it. The plan is on this phone only for now." : `A box is a day: the last eight of ${data.month.label}, in thousands of meters.`}</Text>
    </ScrollView>
  );
}
