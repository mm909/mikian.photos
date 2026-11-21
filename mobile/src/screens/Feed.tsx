import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { api, peek, type FeedItem, type FeedPage } from "../api";
import { DotsIcon } from "../icons";
import { useSession } from "../session";
import { mono } from "../site";
import { C, F } from "../theme";
import { Blocks, PhotoPair, Waiting } from "../ui";
import { RowMenu } from "./Social";

/* THE FEED (owner, 2026-11-20: "a chronological list of all rows so far. No
 * month cutoff. It should include the photos as well as the other info like
 * name, meters, time, stats (if hooked up to the erg)").
 *
 * ONE LIST, FOR EVER (owner, 2026-11-21: "I want one page that can forever
 * scroll just like every other social media site, and I want it to consider
 * my friends or who I'm following first, and then everyone else"). The
 * server decides the order (api/row100k/app/feed: the last week of the
 * rowers I follow, then everybody); this screen only keeps asking for the
 * next page as the end comes near.
 *
 * ONE ROW, his order the same day: who and when, then the METERS and the
 * figures ("let's put the meters and stuff like that above the photos"),
 * then the two photos. No day heads with their totals ("no longer want
 * it"), no arrow on the figures ("we can just click on it and it'll go").
 * Three dots at the right of each row hold what can be done about it
 * ("turn on notifications, mute, unfollow, report"). A photo opens both,
 * whole, on black, with a swipe between them.
 *
 * A hidden rower's row draws blocks and no photos, as on /feed. A name
 * opens the rower; the figures open the row. */

const PATH = "/api/row100k/app/feed";

export function FeedScreen({ onRower, onRow, stamp }: { onRower: (n: number) => void; onRow: (id: string) => void; stamp: number }) {
  const { me } = useSession();
  /* What the app last read of the feed is on screen at once. */
  const kept = peek<FeedPage>(PATH);
  const [items, setItems] = useState<FeedItem[] | null>(kept?.items ?? null);
  const [older, setOlder] = useState<string | null>(kept?.older ?? null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState<FeedItem | null>(null);
  const more = useRef(false);

  const first = useCallback(async (pulled?: boolean) => {
    if (pulled) setRefreshing(true);
    try {
      const p = await api<FeedPage>(PATH);
      setItems(p.items);
      setOlder(p.older);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The feed could not be read.");
    }
    setRefreshing(false);
  }, []);

  /* `stamp` moves when a row is logged, so the feed reads again. */
  useEffect(() => {
    first();
  }, [first, stamp, me.me?.rowerNumber]);

  const next = async () => {
    if (!older || more.current) return;
    more.current = true;
    try {
      const p = await api<FeedPage>(`${PATH}?before=${encodeURIComponent(older)}`);
      setItems((prev) => [...(prev ?? []), ...p.items.filter((it) => !(prev ?? []).some((x) => x.id === it.id))]);
      setOlder(p.older);
    } catch {
      /* The foot keeps its spinner; the next scroll tries again. */
    }
    more.current = false;
  };

  if (!items) return <Waiting error={error} onRetry={() => first()} />;

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        onRefresh={() => first(true)}
        refreshing={refreshing}
        onEndReached={next}
        onEndReachedThreshold={1.2}
        renderItem={({ item }) => <Strip it={item} onRower={onRower} onRow={onRow} onMenu={() => setMenu(item)} />}
        ListEmptyComponent={<Text style={[mono(11, false, C.gray, 0.12), { paddingVertical: 24, lineHeight: 18 }]}>Nothing logged yet. The feed starts with the first row.</Text>}
        ListFooterComponent={older ? <ActivityIndicator color={C.ink} style={{ marginVertical: 24 }} /> : items.length ? <Text style={[mono(11, false, C.gray), { textAlign: "center", marginVertical: 24 }]}>The first row</Text> : undefined}
      />
      {menu ? (
        <RowMenu
          row={{ id: menu.id, rowerNumber: menu.rowerNumber, name: menu.name, mine: menu.mine, photos: menu.photos.length, rel: menu.rel }}
          onClose={() => setMenu(null)}
          onRower={onRower}
          onRow={onRow}
          onChange={(what, rel) => {
            const n = menu.rowerNumber;
            if (what === "row-gone") setItems((prev) => (prev ?? []).filter((x) => x.id !== menu.id));
            else if (what === "muted" || what === "blocked") setItems((prev) => (prev ?? []).filter((x) => x.rowerNumber !== n));
            else if (what === "photo") first();
            else if (rel) setItems((prev) => (prev ?? []).map((x) => (x.rowerNumber === n ? { ...x, rel } : x)));
          }}
        />
      ) : null}
    </>
  );
}

const fig = () => ({ fontFamily: F.mono, fontSize: 13, color: C.gray, fontVariant: ["tabular-nums" as const] });

/* One row. */
function Strip({ it, onRower, onRow, onMenu }: { it: FeedItem; onRower: (n: number) => void; onRow: (id: string) => void; onMenu: () => void }) {
  const erg = it.erg ? [it.erg.watts ? `${it.erg.watts} W` : "", it.erg.spm ? `${it.erg.spm} s/m` : "", it.erg.hr ? `${it.erg.hr} bpm` : "", it.erg.drag ? `drag ${it.erg.drag}` : ""].filter(Boolean) : [];
  return (
    <View style={{ paddingTop: 18, paddingBottom: 20, borderBottomWidth: 1, borderColor: C.line }}>
      {/* Who, and the three dots. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`${it.name}, rower ${it.numStr}`} onPress={() => onRower(it.rowerNumber)} hitSlop={8} style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 16, color: it.mine ? C.accent : C.ink }}>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{it.numStr} · </Text>
            {it.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 11, color: C.gray, marginTop: 3 }}>
            {it.dayStr} · {it.clockStr}
            {it.title ? ` · ${it.title}` : ""}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="More about this row" onPress={onMenu} hitSlop={10} style={({ pressed }) => ({ width: 36, height: 36, alignItems: "flex-end", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
          <DotsIcon color={C.gray} size={22} />
        </Pressable>
      </View>

      {/* The meters and the figures open the page of that row. */}
      <Pressable accessibilityRole="link" accessibilityLabel={`Open this row: ${it.masked ? "hidden" : it.metersStr}`} onPress={() => onRow(it.id)} style={{ marginTop: 10 }}>
        {it.masked ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Blocks n={it.digits ?? 4} size={26} />
          </View>
        ) : (
          <Text style={{ fontFamily: F.black, fontSize: 32, lineHeight: 36, color: C.accent, fontVariant: ["tabular-nums"] }}>{it.metersStr}</Text>
        )}
        <Text style={[fig(), { marginTop: 2 }]}>
          <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{it.splitStr}</Text> /500m
          {it.masked ? null : `   ${it.durationStr}`}
        </Text>
        {erg.length ? <Text style={[fig(), { marginTop: 4, fontSize: 12 }]}>{erg.join(" · ")}</Text> : null}
      </Pressable>

      {it.masked ? null : <PhotoPair photos={it.photos} style={{ marginTop: 12 }} onMenu={onMenu} />}
    </View>
  );
}
