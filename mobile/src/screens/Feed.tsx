import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { api, type FeedItem, type FeedPage } from "../api";
import { useSession } from "../session";
import { Chip, Dash, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Blocks, PhotoPair, Waiting } from "../ui";

/* THE FEED (owner, 2026-11-20: "a chronological list of all rows so far. No
 * month cutoff. It should include the photos as well as the other info like
 * name, meters, time, stats (if hooked up to the erg)"; "we don't need the
 * header of today's meters and the bar for x of 100k this month, we can
 * just have the feed").
 *
 * The strips are the site's (feed/Strips.tsx), with the photos given the
 * width of the phone instead of a thumbnail's: a day head on a dashed rule
 * (the day, what landed that day in the blue, how many rows), then each row
 * as the title in quiet mono, the grey number and the name in mono caps,
 * the two photos, the metres big and blue, and the time, the split and the
 * clock on one mono line. A row off a connected erg adds the monitor's
 * averages. A hidden rower's row draws blocks and no photos, as on /feed.
 *
 * Every row anybody has logged, newest first, sixty at a time, older ones
 * arriving as the list is scrolled (api/row100k/app/feed reads feedData.ts).
 * A name opens the rower.
 *
 * EVERYONE, OR FOLLOWING (owner, 2026-11-20: "the feed opens on everyone,
 * not on following"; "see only who I follow in my feed"): two chips over
 * the list for a signed-in rower. Following is the rowers they follow and
 * their own rows. A private rower's rows, and anybody's across a block,
 * are simply not in either list (the server leaves them out). */

type Days = Record<string, { meters: number; rows: number }>;

export function FeedScreen({ onRower, onRow, stamp }: { onRower: (n: number) => void; onRow: (id: string) => void; stamp: number }) {
  const { me } = useSession();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [days, setDays] = useState<Days>({});
  const [older, setOlder] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const more = useRef(false);
  const [following, setFollowing] = useState(false);
  const which = following && me.me ? "following=1" : "";

  const first = useCallback(async () => {
    setRefreshing(true);
    try {
      const p = await api<FeedPage & { days?: Days }>(`/api/row100k/app/feed${which ? `?${which}` : ""}`);
      setItems(p.items);
      setDays(p.days ?? {});
      setOlder(p.older);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The feed could not be read.");
    }
    setRefreshing(false);
  }, [which]);

  /* `stamp` moves when a row is logged, so the feed reads again. */
  useEffect(() => {
    first();
  }, [first, stamp, me.me?.rowerNumber]);

  const next = async () => {
    if (!older || more.current) return;
    more.current = true;
    try {
      const p = await api<FeedPage & { days?: Days }>(`/api/row100k/app/feed?before=${encodeURIComponent(older)}${which ? `&${which}` : ""}`);
      setItems((prev) => [...(prev ?? []), ...p.items.filter((it) => !(prev ?? []).some((x) => x.id === it.id))]);
      /* A day split across two pages keeps the total it first came with:
       * the server counts the whole day either time. */
      setDays((prev) => ({ ...(p.days ?? {}), ...prev }));
      setOlder(p.older);
    } catch {
      /* The foot keeps its spinner; the next scroll tries again. */
    }
    more.current = false;
  };

  if (!items) return <Waiting error={error} onRetry={first} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      onRefresh={first}
      refreshing={refreshing}
      onEndReached={next}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={
        me.me ? (
          <View style={{ flexDirection: "row", gap: 8, paddingTop: 18 }}>
            <Chip label="Everyone" on={!following} onPress={() => setFollowing(false)} />
            <Chip label="Following" on={following} onPress={() => setFollowing(true)} />
          </View>
        ) : undefined
      }
      renderItem={({ item, index }) => <Strip it={item} day={index === 0 || items[index - 1].dayKey !== item.dayKey ? (days[item.dayKey] ?? null) : undefined} onRower={onRower} onRow={onRow} />}
      ListEmptyComponent={<Text style={[mono(11, false, C.gray, 0.12), { paddingVertical: 24, lineHeight: 18 }]}>{following ? "Nothing here yet. Follow a rower (the search is at the top) and their rows land here." : "Nothing logged yet. The feed starts with the first row."}</Text>}
      ListFooterComponent={older ? <ActivityIndicator color={C.ink} style={{ marginVertical: 24 }} /> : items.length ? <Text style={[mono(11, false, C.gray), { textAlign: "center", marginVertical: 24 }]}>The first row</Text> : undefined}
    />
  );
}

const fig = { fontFamily: F.mono, fontSize: 13, color: C.gray, fontVariant: ["tabular-nums" as const] };

/* One row. `day` is set on the first row of a day: its total, or null when
 * the day's total did not come. */
function Strip({ it, day, onRower, onRow }: { it: FeedItem; day?: { meters: number; rows: number } | null; onRower: (n: number) => void; onRow: (id: string) => void }) {
  const erg = it.erg ? [it.erg.watts ? `${it.erg.watts} W` : "", it.erg.spm ? `${it.erg.spm} s/m` : "", it.erg.hr ? `${it.erg.hr} bpm` : "", it.erg.drag ? `drag ${it.erg.drag}` : ""].filter(Boolean) : [];
  return (
    <View>
      {day !== undefined ? (
        <View style={{ paddingTop: 26 }}>
          <Text style={[mono(12, false, C.gray, 0.14), { paddingBottom: 8 }]}>
            <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{it.dayStr}</Text>
            {day ? (
              <>
                {" — "}
                <Text style={{ fontFamily: F.monoBold, color: C.accent }}>{fmtInt(day.meters)} m</Text>
                {` · ${day.rows} ${day.rows === 1 ? "row" : "rows"}`}
              </>
            ) : null}
          </Text>
          <Dash color={C.gray} />
        </View>
      ) : null}
      <View style={{ paddingVertical: 16 }}>
        {it.title ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray, marginBottom: 2 }}>{it.title}</Text> : null}
        <Pressable accessibilityRole="link" accessibilityLabel={`${it.name}, rower ${it.numStr}`} onPress={() => onRower(it.rowerNumber)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
          <Text numberOfLines={1} style={mono(12, false, C.gray, 0.12)}>
            {it.numStr} · <Text style={{ fontFamily: F.monoBold, color: it.mine ? C.accent : C.ink }}>{it.name}</Text>
          </Text>
        </Pressable>
        {it.masked ? (
          <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Blocks n={it.digits ?? 4} size={26} />
            {it.elite ? <Text style={mono(11, true, C.ink)}>Lights out</Text> : null}
          </View>
        ) : (
          <>
            <PhotoPair photos={it.photos} style={{ marginTop: 10 }} />
          </>
        )}
        {/* The figures open the page of that row. */}
        <Pressable accessibilityRole="link" accessibilityLabel={`Open this row: ${it.masked ? "hidden" : it.metersStr}`} onPress={() => onRow(it.id)}>
          {it.masked ? null : <Text style={{ fontFamily: F.black, fontSize: 30, lineHeight: 34, color: C.accent, fontVariant: ["tabular-nums"], marginTop: 8 }}>{it.metersStr}</Text>}
          <Text style={[fig, { marginTop: 2 }]}>
            {it.masked ? null : <Text style={{ color: C.ink }}>{it.durationStr}  </Text>}
            {it.splitStr} /500m  {it.clockStr}  <Text style={{ color: C.accent }}>→</Text>
          </Text>
        </Pressable>
        {erg.length ? (
          <Text style={[fig, { marginTop: 4 }]}>
            <Text style={{ fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.4, color: C.accent }}>ERG  </Text>
            {erg.join(" · ")}
          </Text>
        ) : null}
      </View>
      <Dash />
    </View>
  );
}
