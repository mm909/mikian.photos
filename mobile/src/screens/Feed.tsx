import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { api, peek, type FeedItem, type FeedPage } from "../api";
import { DotsIcon } from "../icons";
import { useSession } from "../session";
import { Ctl, mono } from "../site";
import { C, F, wholeSplit } from "../theme";
import { Avatar, Blocks, PhotoPair, Waiting, useScrollDir, type Gallery, SkelCards } from "../ui";
import { CommentsSheet, PostActions } from "./Comments";
import { deck } from "../stickers";
import { StickerViewer } from "./RowPage";
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
 * ONE ROW IS A CARD (2026-11-22: "each post needs to be carded"; then, of
 * corners at 16: "the boxes are a little round"). In it: the face, who and
 * when, and the three dots; the meters at the left with the pace and the
 * time at the right of the same line (he found the right of the meters
 * empty); then the two photos. Three dots hold what can be done about a
 * row, SHARE among them for the rower's own ("let me be able to share the
 * row from the feed"). A photo opens both on black with a swipe between,
 * and the dots there bring the same sheet up OVER the photo, not in place
 * of it.
 *
 * UNDER IT, LIKE, COMMENT, SHARE (2026-11-22: "we want like, comment,
 * share on the posts. And that way, that's where that share button can
 * go"), as Instagram lays them: screens/Comments.tsx.
 *
 * AS READ ON 2026-11-21: the name is ink, the viewer's own too ("it doesn't
 * need to be blue"); the pace is to the second ("we do not need the
 * decimal points"); the monitor's averages are off the card, and a row
 * that came off a connected erg wears TELEMETRY beside its meters instead
 * ("let's not show it on the feed, but let's do note that ... the erg data
 * was logged ... on the same row as that 5,000 meters"); the photos have a
 * little round at the corners.
 *
 * THE SAME CARDS, ONE ROWER'S, are the ROWS tab of a profile (RowerRows).
 *
 * A hidden rower's row draws blocks and no photos, as on /feed. A name
 * opens the rower; the figures open the row. */

const PATH = "/api/row100k/app/feed";

/* A list of rows off the feed route: what is kept of it at once, the next
 * page when asked, and a count that moved put back on the kept copy. */
function useRows(path: string, deps: unknown[]) {
  const kept = peek<FeedPage>(path);
  const [items, setItems] = useState<FeedItem[] | null>(kept?.items ?? null);
  const [older, setOlder] = useState<string | null>(kept?.older ?? null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const more = useRef(false);
  const first = useCallback(
    async (pulled?: boolean) => {
      if (pulled) setRefreshing(true);
      try {
        const p = await api<FeedPage>(path);
        setItems(p.items);
        setOlder(p.older);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "The feed could not be read.");
      }
      setRefreshing(false);
    },
    [path],
  );
  useEffect(() => {
    first();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, ...deps]);
  const next = async () => {
    if (!older || more.current) return;
    more.current = true;
    try {
      const p = await api<FeedPage>(`${path}${path.includes("?") ? "&" : "?"}before=${encodeURIComponent(older)}`);
      setItems((prev) => [...(prev ?? []), ...p.items.filter((it) => !(prev ?? []).some((x) => x.id === it.id))]);
      setOlder(p.older);
    } catch {
      /* The foot keeps its spinner; the next scroll tries again. */
    }
    more.current = false;
  };
  /* A like or a comment count that moved: on the list, and on what the app
   * keeps of it, so the heart is still full when the screen is come back
   * to. */
  const touch = (id: string, f: Partial<FeedItem>) => {
    const k = peek<FeedPage>(path)?.items.find((x) => x.id === id);
    if (k) Object.assign(k, f);
    setItems((prev) => (prev ?? []).map((x) => (x.id === id ? { ...x, ...f } : x)));
  };
  return { items, setItems, older, error, refreshing, first, next, touch };
}

/* What a list of cards needs around it: the run of every photo in it, the
 * sheet behind the dots, the stickers, the comments. Hands back how to draw
 * one card, and what is open over the list. */
function useCards(rows: ReturnType<typeof useRows>, onRower: (n: number) => void, onRow: (id: string) => void) {
  const { items, setItems, first, touch } = rows;
  const [menu, setMenu] = useState<FeedItem | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [talk, setTalk] = useState<string | null>(null);

  /* EVERY PHOTO IN THE LIST, in order, with whose it is: one run a viewer
   * can be swiped along from any of them. */
  const run = useMemo(() => {
    const photos: Gallery["photos"] = [];
    const stamps: string[][] = [];
    const owner: FeedItem[] = [];
    const offset = new Map<string, number>();
    for (const it of items ?? []) {
      if (it.masked) continue;
      offset.set(it.id, photos.length);
      for (const p of it.photos.slice(0, 2)) {
        photos.push(p);
        stamps.push([`${it.numStr} · ${it.name}`, `${it.dayStr} · ${it.metersStr}${it.title ? ` · ${it.title}` : ""}`]);
        owner.push(it);
      }
    }
    return { photos, stamps, owner, offset };
  }, [items]);

  /* The sheet behind a row's three dots. `leave` also shuts whatever the
   * sheet came up over (the photos), for the lines that go somewhere. */
  const sheet = (it: FeedItem, close: () => void, leave: () => void = close) => (
    <RowMenu
      row={{ id: it.id, rowerNumber: it.rowerNumber, name: it.name, mine: it.mine, photos: it.photos.length, rel: it.rel }}
      onClose={close}
      onRower={(n) => {
        leave();
        onRower(n);
      }}
      onRow={(id) => {
        leave();
        onRow(id);
      }}
      onShare={
        it.masked
          ? undefined
          : () => {
              leave();
              setSharing(it.id);
            }
      }
      onChange={(what, rel) => {
        const n = it.rowerNumber;
        if (what === "row-gone") setItems((prev) => (prev ?? []).filter((x) => x.id !== it.id));
        else if (what === "muted" || what === "blocked") setItems((prev) => (prev ?? []).filter((x) => x.rowerNumber !== n));
        else if (what === "photo") first();
        else if (rel) setItems((prev) => (prev ?? []).map((x) => (x.rowerNumber === n ? { ...x, rel } : x)));
      }}
    />
  );
  const card = (item: FeedItem): ReactNode => (
    <Strip
      key={item.id}
      it={item}
      onRower={onRower}
      onRow={onRow}
      onMenu={() => setMenu(item)}
      onTalk={() => setTalk(item.id)}
      onShare={item.masked ? undefined : () => setSharing(item.id)}
      onLike={(likes, liked) => touch(item.id, { likes, liked })}
      gallery={{ photos: run.photos, stamps: run.stamps, offset: run.offset.get(item.id) ?? 0, menu: (at, close, leave) => (run.owner[at] ? sheet(run.owner[at], close, leave) : null) }}
    />
  );
  const overlays = (
    <>
      {menu ? sheet(menu, () => setMenu(null)) : null}
      {sharing ? <StickerViewer rowId={sharing} onClose={() => setSharing(null)} /> : null}
      {talk ? <CommentsSheet entryId={talk} onClose={() => setTalk(null)} onRower={onRower} onCount={(n) => touch(talk, { comments: n })} /> : null}
    </>
  );
  return { card, overlays };
}

export function FeedScreen({ onRower, onRow, stamp, onScrollDir }: { onRower: (n: number) => void; onRow: (id: string) => void; stamp: number; onScrollDir?: (down: boolean) => void }) {
  const { me } = useSession();
  /* `stamp` moves when a row is logged, so the feed reads again. */
  const rows = useRows(PATH, [stamp, me.me?.rowerNumber]);
  const { items, older, error, refreshing, first, next } = rows;
  const { card, overlays } = useCards(rows, onRower, onRow);
  const dir = useScrollDir(onScrollDir);
  /* The stickers of the viewer's own newest rows are drawn while the feed
   * is being read, so SHARE has them in hand. */
  const mineIds = (items ?? []).filter((it) => it.mine && !it.masked).slice(0, 2).map((it) => it.id).join(",");
  useEffect(() => {
    for (const id of mineIds ? mineIds.split(",") : []) deck(id).catch(() => null);
  }, [mineIds]);

  if (!items) return error ? <Waiting error={error} onRetry={() => first()} /> : <SkelCards n={3} pad={12} />;

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 124 }}
        onRefresh={() => first(true)}
        refreshing={refreshing}
        onEndReached={next}
        onEndReachedThreshold={1.2}
        /* Which way the list is going, for the bars that step aside. */
        {...dir}
        renderItem={({ item }) => <>{card(item)}</>}
        ListEmptyComponent={<Text style={[mono(11, false, C.gray, 0.12), { paddingVertical: 24, lineHeight: 18 }]}>Nothing logged yet. The feed starts with the first row.</Text>}
        ListFooterComponent={older ? <ActivityIndicator color={C.ink} style={{ marginVertical: 24 }} /> : items.length ? <Text style={[mono(11, false, C.gray), { textAlign: "center", marginVertical: 24 }]}>The first row</Text> : undefined}
      />
      {overlays}
    </>
  );
}

/* ONE ROWER'S ROWS, as the feed's own cards, inside a page that scrolls by
 * itself: the ROWS tab of a profile (owner, 2026-11-21: "seeing the exact
 * same cards that are in the feed, but on an activities tab in your
 * profile"). The newest page at once, and MORE for the next. */
export function RowerRows({ num, mine, onRower, onRow }: { num: number; mine: boolean; onRower: (n: number) => void; onRow: (id: string) => void }) {
  const rows = useRows(`${PATH}?rower=${num}`, []);
  const { items, older, error, first, next } = rows;
  const { card, overlays } = useCards(rows, onRower, onRow);
  const [busy, setBusy] = useState(false);
  /* Ten cards at a time: this list is inside a page that scrolls by itself,
   * so every card shown is a card drawn, photos and all. */
  const [shown, setShown] = useState(10);
  if (!items) return error ? <Waiting error={error} onRetry={() => first()} /> : <View style={{ marginHorizontal: -8 }}><SkelCards n={2} /></View>;
  return (
    /* The cards run a little wider than the page's own margin, as they do
       on the feed. */
    <View style={{ marginHorizontal: -8 }}>
      {items.length === 0 ? <Text style={[mono(11, false, C.gray), { paddingVertical: 20, paddingHorizontal: 8 }]}>{mine ? "Nothing logged yet." : "No rows to show."}</Text> : null}
      {items.slice(0, shown).map(card)}
      {older || items.length > shown ? (
        <View style={{ alignItems: "center", paddingVertical: 14 }}>
          <Ctl
            label={busy ? "Reading" : "More rows"}
            disabled={busy}
            onPress={async () => {
              if (items.length > shown) return setShown(shown + 10);
              setBusy(true);
              await next();
              setShown(shown + 10);
              setBusy(false);
            }}
          />
        </View>
      ) : null}
      {overlays}
    </View>
  );
}

/* One row. */
function Strip({ it, onRower, onRow, onMenu, onTalk, onShare, onLike, gallery }: { it: FeedItem; onRower: (n: number) => void; onRow: (id: string) => void; onMenu: () => void; onTalk: () => void; onShare?: () => void; onLike: (likes: number, liked: boolean) => void; gallery: Gallery }) {
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
      {/* Who, and the three dots. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable accessibilityLabel={`${it.name}'s page`} onPress={() => onRower(it.rowerNumber)}>
          <Avatar uri={it.avatar} name={it.name} size={38} />
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel={`${it.name}, rower ${it.numStr}`} onPress={() => onRower(it.rowerNumber)} hitSlop={8} style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>
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

      {/* How far at the left, how fast and how long at the right. The line
          opens the page of that row. */}
      <Pressable accessibilityRole="link" accessibilityLabel={`Open this row: ${it.masked ? "hidden" : it.metersStr}${it.erg ? ", with telemetry" : ""}`} onPress={() => onRow(it.id)} style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
            {it.masked ? <Blocks n={it.digits ?? 4} size={26} /> : <Text style={{ fontFamily: F.black, fontSize: 34, lineHeight: 36, color: C.accent, fontVariant: ["tabular-nums"] }}>{it.metersStr}</Text>}
            {/* The monitor recorded this one: its page has the whole read. */}
            {it.erg && !it.masked ? (
              <View style={{ backgroundColor: C.ink, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 }}>
                <Text style={{ fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: C.paper }}>TELEMETRY</Text>
              </View>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: F.black, fontSize: 20, lineHeight: 22, color: C.ink, fontVariant: ["tabular-nums"] }}>{wholeSplit(it.splitStr)}</Text>
            {it.masked ? null : <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray, marginTop: 2, fontVariant: ["tabular-nums"] }}>{it.durationStr}</Text>}
          </View>
        </View>
      </Pressable>

      {it.masked ? null : <PhotoPair photos={it.photos} style={{ marginTop: 12 }} gallery={gallery} />}

      <PostActions id={it.id} likes={it.likes ?? 0} liked={!!it.liked} comments={it.comments ?? 0} onComments={onTalk} onShare={onShare} onChange={onLike} style={{ marginTop: 10, marginBottom: -4 }} />

      {/* THE CAPTION, under the marks with the name before it, as on
          Instagram (owner, 2026-11-22: "a caption whenever you post ...
          when in doubt, use the Instagram layout"). */}
      {it.caption ? (
        <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 10 }}>
          <Text style={{ fontFamily: F.bold }} onPress={() => onRower(it.rowerNumber)}>
            {it.name}
          </Text>{" "}
          {it.caption}
        </Text>
      ) : null}
    </View>
  );
}
