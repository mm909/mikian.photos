import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";
import { api, edits, peek, type FeedItem, type FeedPage } from "../api";
import { buzz } from "../buzz";
import { ROW_URL, shareLink } from "../files";
import { DotsIcon, ExpandIcon, LinkIcon, StickerIcon, SwapIcon, VerifiedIcon } from "../icons";
import { useSession } from "../session";
import { Ctl, mono } from "../site";
import { C, F, MONTHS, dayKey, wholeSplit } from "../theme";
import { LiftMenu, whereOnScreen, type Rect, type Spot } from "../lift";
import { Avatar, Blocks, HOLD_MS, PhotoSwap, Waiting, useScrollDir, type Gallery, type Held, type HoldItem, Skel, SkelCards } from "../ui";
import { CommentsSheet, PostActions } from "./Comments";
import { RecapStrip } from "./Recap";
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
 * A PHOTO THAT IS HELD brings the row forward over a dark screen with a
 * short list under it, as Instagram does (owner, 2026-11-23; lift.tsx
 * LiftMenu, which lifts it off the page and puts it back): SHARE LINK, a line about the row and the address of its own
 * page on the site, to the phone's share sheet; STICKERS; and VIEW PHOTO,
 * which is what holding a photo did until that day and is MINE to have
 * kept. The grid of a profile has SHARE LINK.
 *
 * SWAP PHOTO IS THE ROWER'S OWN, AND IT IS KEPT (owner, the same day, of a
 * first one that turned the card about for the looker alone: "I swapped
 * photos and none of them saved ... the reason why I want to swap photos is
 * because I want to swap which one shows up first ... it should be swap
 * which one shows to other users. And I shouldn't be able to swap other
 * people's photos. Just me"). On a row of the viewer's own with two photos,
 * on the feed and on their grid: the two change places on the site, for
 * everybody, and the card shows the new first at once (swapPhotos). Nobody
 * else's row has the line.
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
  const [held, setHeld] = useState<{ it: FeedItem; h: Held } | null>(null);

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
      onHold={item.masked ? undefined : (h) => setHeld({ it: item, h })}
      gallery={{ photos: run.photos, stamps: run.stamps, offset: run.offset.get(item.id) ?? 0, menu: (at, close, leave) => (run.owner[at] ? sheet(run.owner[at], close, leave) : null) }}
    />
  );
  const overlays = (
    <>
      {menu ? sheet(menu, () => setMenu(null)) : null}
      {held && held.it.photos[held.h.at] ? (
        <LiftMenu
          head={{ name: held.it.name, sub: when(held.it), avatar: held.it.avatar, num: held.it.numStr || held.it.rowerNumber }}
          photo={held.it.photos[held.h.at]}
          photos={[...held.it.photos.slice(held.h.at, 2), ...held.it.photos.slice(0, held.h.at)]}
          figures={figures(held.it)}
          from={held.h.from}
          onClose={() => setHeld(null)}
          onOpen={() => onRow(held.it.id)}
          items={[
            ...(held.it.mine && held.it.photos.length > 1 ? [{ label: "Swap photo", icon: <SwapIcon />, onPress: () => swapPhotos(touch, held.it) } as HoldItem] : []),
            { label: "Share link", icon: <LinkIcon />, wait: true, onPress: () => shareRow(held.it) },
            { label: "Stickers", icon: <StickerIcon />, onPress: () => setSharing(held.it.id) },
            { label: "View photo", icon: <ExpandIcon />, onPress: held.h.view },
          ]}
        />
      ) : null}
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
  /* Counts the pulls down, so the story recap over the cards reads again
   * with the feed (Recap.tsx; owner, 2026-11-23). */
  const [pulls, setPulls] = useState(0);
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
        contentContainerStyle={{ paddingBottom: 124 }}
        /* Its own colour, so the spinner shows on the dark look too
           (owner, 2026-11-23: "The spinner doesn't show up on dark mode");
           the list's bare onRefresh drew iOS's dark one on black. */
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setPulls((n) => n + 1);
              first(true);
            }}
            tintColor={C.ink}
            colors={[C.ink]}
            progressBackgroundColor={C.paper}
          />
        }
        onEndReached={next}
        onEndReachedThreshold={1.2}
        /* Which way the list is going, for the bars that step aside. */
        {...dir}
        /* WHO ROWED IN THE LAST DAY, as stories over the cards (Recap.tsx).
           Nothing at all when nobody did. */
        ListHeaderComponent={<RecapStrip again={`${stamp}:${pulls}:${me.me?.rowerNumber ?? ""}:${edits.n}`} onRow={onRow} onRower={onRower} />}
        renderItem={({ item }) => <>{card(item)}</>}
        ListEmptyComponent={<Text style={[mono(11, false, C.gray, 0.12), { paddingVertical: 24, paddingHorizontal: 14, lineHeight: 18 }]}>Nothing logged yet. The feed starts with the first row.</Text>}
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

/* A ROW, SENT AS A LINK: what was rowed, in a line, and the address of the
 * row's own page on the site (files.ts ROW_URL). */
function shareRow(it: FeedItem): Promise<unknown> {
  return shareLink(`${it.name} rowed ${it.metersStr} at ${wholeSplit(it.splitStr)} /500m.`, ROW_URL(it.rowerNumber, it.id)).catch(() => null);
}

/* THE ROWER'S OWN TWO PHOTOS CHANGE PLACES, for everybody and for good
 * (api/row100k/app/row, swap). The card turns at once; the site's answer
 * is the pair as it now stands, and a swap that did not go through is put
 * back. */
async function swapPhotos(touch: (id: string, f: Partial<FeedItem>) => void, it: FeedItem): Promise<void> {
  if (!it.mine || it.photos.length < 2) return;
  const was = it.photos;
  buzz.tap();
  touch(it.id, { photos: [was[1], was[0], ...was.slice(2)] });
  try {
    const r = await api<{ photos: FeedItem["photos"] }>("/api/row100k/app/row", { body: { id: it.id, swap: true } });
    touch(it.id, { photos: r.photos });
    /* The rower's own page reads itself again. */
    edits.n++;
  } catch {
    touch(it.id, { photos: was });
  }
}

/* One row. */
/* WHEN, as Strava says it (owner, 2026-11-22: "how does Strava do their
 * dates? Strava does their dates by yesterday at"): Today at 6:12 AM,
 * Yesterday at 6:12 AM, and before that the day in full. */
/* WHEN IT WAS ROWED, for a row off a monitor (owner, 2026-11-23: "if it's a
 * PM5 over Bluetooth, we should set the time as the time rowed, not the
 * time submitted ... we know what time this was done at"): the site sends
 * the rowed clock in the stamp itself, and the rowed day beside it as
 * `rowed` when that is another day than the row was sent (feed/view.ts
 * rowStamp). */
function when(row: FeedItem): string {
  const it = row.rowed ?? row;
  if (it.dayKey === dayKey()) return `Today at ${it.clockStr}`;
  if (it.dayKey === dayKey(new Date(Date.now() - 86_400_000))) return `Yesterday at ${it.clockStr}`;
  const [y, m, d] = it.dayKey.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${d}, ${y} at ${it.clockStr}`;
}

/* How long and how fast, under a held photo (owner, 2026-11-23: "when I
 * press and hold it to view it, I also want to see the how long and how
 * fast stat"): the meters, the pace to the second as the card says it, and
 * the time. */
function figures(it: FeedItem) {
  return { meters: it.metersStr, pace: wholeSplit(it.splitStr), time: it.durationStr };
}

/* One figure of a row: a small grey word over the number in ink. */
function Stat({ k, children }: { k: string; children: ReactNode }) {
  return (
    <View>
      <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.soft }}>{k}</Text>
      <View style={{ minHeight: 24, justifyContent: "center", marginTop: 1 }}>{children}</View>
    </View>
  );
}
const figure = () => ({ fontFamily: F.bold, fontSize: 18, lineHeight: 23, color: C.ink, fontVariant: ["tabular-nums" as const] });
/* No rule between the figures: air, as Strava leaves it (his screenshot). */
const Rule = () => <View style={{ width: 30 }} />;

/* ONE ROW IN THE FEED (owner, 2026-11-22, with Strava's row and an
 * Instagram post open beside the app: "we really want to build almost the
 * same exact UI here ... they kind of got it down. We want distance, pace,
 * time"; "what I like about Strava's is that those stats are separated
 * from the ID"; "look how small their UI is in proportion to the photos
 * ... we need a little smaller UI print"; "we gotta ditch the blue on
 * these numbers ... it's just not good on the eyes").
 *
 * So, top to bottom: WHO (the face, the name, the black check where it is
 * worn, and when, as Strava says it) with the three dots; the row's title;
 * DISTANCE, PACE and TIME as three small figures in ink, apart from who it
 * is, with the word TELEMETRY, small and grey, at the right when the
 * monitor recorded it (a metal badge stood there for an hour and he threw
 * it out: "I didn't mean like the typing of a Pokemon ... definitely not
 * that"; what he means by premium is the rower's NAME taking a sheen, an
 * undertone, and that is not designed yet); then
 * the picture, the full width of the phone and three by four; the heart,
 * the comments and the share; the caption. No box round it and no rule:
 * the picture is what parts one row from the next. Until that day a row
 * was a white card with the meters big and blue. */
function Strip({ it, onRower, onRow, onMenu, onTalk, onShare, onLike, onHold, gallery }: { it: FeedItem; onRower: (n: number) => void; onRow: (id: string) => void; onMenu: () => void; onTalk: () => void; onShare?: () => void; onLike: (likes: number, liked: boolean) => void; onHold?: (h: Held) => void; gallery: Gallery }) {
  const PAD = 14;
  return (
    <View style={{ paddingTop: 14, paddingBottom: 14, borderBottomWidth: 6, borderColor: C.tint }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: PAD }}>
        <Pressable accessibilityLabel={`${it.name}'s page`} onPress={() => onRower(it.rowerNumber)}>
          <Avatar uri={it.avatar} name={it.name} num={it.numStr || it.rowerNumber} size={38} />
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel={`${it.name}, rower ${it.numStr}`} onPress={() => onRower(it.rowerNumber)} hitSlop={6} style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.semi, fontSize: 14.5, color: C.ink, flexShrink: 1 }}>
              {it.name}
            </Text>
            {it.plus ? <VerifiedIcon size={14} /> : null}
          </View>
          <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 12.5, color: C.gray, marginTop: 2 }}>
            {when(it)}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="More about this row" onPress={onMenu} hitSlop={10} style={({ pressed }) => ({ width: 36, height: 36, alignItems: "flex-end", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
          <DotsIcon color={C.ink} size={20} />
        </Pressable>
      </View>

      {/* The title and the three figures open the page of that row. */}
      <Pressable accessibilityRole="link" accessibilityLabel={`Open this row: ${it.masked ? "hidden" : it.metersStr}${it.erg ? ", with telemetry" : ""}`} onPress={() => onRow(it.id)} style={{ paddingHorizontal: PAD, marginTop: 16 }}>
        {it.title ? (
          <Text numberOfLines={2} style={{ fontFamily: F.bold, fontSize: 20, lineHeight: 25, color: C.ink, marginBottom: 12 }}>
            {it.title}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Stat k="Distance">{it.masked ? <Blocks n={it.digits ?? 4} size={14} /> : <Text style={figure()}>{it.metersStr}</Text>}</Stat>
          <Rule />
          <Stat k="Pace">
            <Text style={figure()}>{wholeSplit(it.splitStr)}</Text>
          </Stat>
          {it.masked ? null : (
            <>
              <Rule />
              <Stat k="Time">
                <Text style={figure()}>{it.durationStr}</Text>
              </Stat>
            </>
          )}
          <View style={{ flex: 1 }} />
          {/* The monitor recorded this one: its page has the whole read. */}
          {it.erg && !it.masked ? <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.4, color: C.gray, marginBottom: 6 }}>TELEMETRY</Text> : null}
        </View>
      </Pressable>

      {it.masked ? null : <PhotoSwap key={it.photos[0]?.full ?? "none"} photos={it.photos} style={{ marginTop: 16 }} gallery={gallery} onHold={onHold} />}
      {/* The rower's own row off the monitor, logged before its photos
          (autolog.ts, 2026-11-24): where the picture would be is the way to
          add the two, on the row's page. To everybody else the row is its
          title and its figures, and no picture. */}
      {it.mine && !it.masked && it.photos.length === 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add the two photos to this row" onPress={() => onRow(it.id)} style={({ pressed }) => ({ marginTop: 14, marginHorizontal: PAD, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.gray, paddingVertical: 18, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent }}>ADD THE TWO PHOTOS</Text>
        </Pressable>
      ) : null}

      <PostActions id={it.id} likes={it.likes ?? 0} liked={!!it.liked} comments={it.comments ?? 0} onComments={onTalk} onShare={onShare} onChange={onLike} style={{ marginTop: 8, marginBottom: -4, paddingHorizontal: PAD }} />

      {/* THE CAPTION, under the marks with the name before it, as on
          Instagram (owner, 2026-11-22: "a caption whenever you post ...
          when in doubt, use the Instagram layout"). */}
      {it.caption ? (
        <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.ink, marginTop: 8, paddingHorizontal: PAD }}>
          <Text style={{ fontFamily: F.semi }} onPress={() => onRower(it.rowerNumber)}>
            {it.name}
          </Text>{" "}
          {it.caption}
        </Text>
      ) : null}
    </View>
  );
}

/* A ROWER'S ROWS AS A GRID OF THEIR PHOTOS, three across, as Instagram
 * sets a profile (owner, 2026-11-22: "on my profile, we're definitely not
 * having a feed of stuff. We definitely have like a grid, a gallery ...
 * we'll make the exact same Instagram grid with just a photo ... none of
 * the stats"). Each tile is the first photo of a row, three by four, and
 * opens that row's page. A row with no photo (an old one, or a hidden one)
 * is a quiet tile with its day. Thirty to begin with, and the next thirty
 * as the end of the page comes near (owner, 2026-11-23: "there's a button
 * down there that says more rows. I don't want that. I want that continuous
 * loading page"): the page that holds the grid counts `more` up while its
 * end is near (Profile.tsx), and each count shows what is in hand or reads
 * the next page from the site. A spinner stands at the foot while there is
 * more.
 *
 * A tile does not dim under the finger (owner, 2026-11-22: "when you tap to
 * scroll it, it like flashes, it highlights for a little bit. We can get
 * rid of that"): a finger that lands on the grid is nearly always there to
 * scroll it, and every scroll lit a photo. */
export function RowGrid({ num, mine, onRow, more = 0 }: { num: number; mine: boolean; onRow: (id: string) => void; more?: number }) {
  const rows = useRows(`${PATH}?rower=${num}`, []);
  const { items, older, error, first, next, touch } = rows;
  const [shown, setShown] = useState(30);
  const reading = useRef(false);
  /* A tile that is held: the row forward and a short list, as on the feed.
   * SHARE LINK is the feed's, and so is SWAP PHOTO, on the rower's own. */
  const [held, setHeld] = useState<FeedItem | null>(null);
  /* Where the held square is on the screen, so the card lifts off it and
   * goes back into it (owner, 2026-11-23: "I want to take it, lift it off
   * the page, show it, give it the options. Then I can swipe down and have
   * it be removed"; lift.tsx). */
  const [heldFrom, setHeldFrom] = useState<Rect | undefined>(undefined);
  const squares = useRef(new Map<string, Spot | null>());
  const lift = (it: FeedItem) =>
    whereOnScreen(squares.current.get(it.id), (r) => {
      setHeldFrom(r);
      setHeld(it);
    });
  const face = (it: FeedItem) => (it.masked ? null : it.photos[0] || null);
  const have = items?.length ?? 0;
  useEffect(() => {
    if (!more || reading.current) return;
    if (have > shown) {
      setShown((n) => n + 30);
      return;
    }
    if (!older) return;
    reading.current = true;
    next().then(() => {
      setShown((n) => n + 30);
      reading.current = false;
    });
    // Each count of `more` is one step; the rest is read as it stands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [more]);
  const GAP = 2;
  /* Waiting, it is the grid's own squares, not a feed card (owner,
     2026-11-23: "The loading boxes on the profile should probably be the
     same size as those squares ... it's not loading posts. It's loading
     those images"). Four rows of three, cut exactly as the photos are. */
  if (!items)
    return error ? (
      <Waiting error={error} onRetry={() => first()} />
    ) : (
      <View accessibilityLabel="Loading" style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -GAP }}>
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={{ width: "33.3333%", paddingRight: GAP, paddingBottom: GAP }}>
            <View style={{ width: "100%", aspectRatio: 3 / 4 }}>
              <Skel r={0} style={{ height: "100%" }} />
            </View>
          </View>
        ))}
      </View>
    );
  if (items.length === 0) return <Text style={[mono(11, false, C.gray), { paddingVertical: 24, paddingHorizontal: 14 }]}>{mine ? "Nothing logged yet." : "No rows to show."}</Text>;
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -GAP }}>
        {items.slice(0, shown).map((it) => {
          const photo = face(it);
          return (
            <Pressable key={it.id} accessibilityRole="link" accessibilityLabel={`Open the row of ${it.dayStr}`} onPress={() => onRow(it.id)} delayLongPress={HOLD_MS} onLongPress={photo ? () => lift(it) : undefined} style={{ width: "33.3333%", paddingRight: GAP, paddingBottom: GAP }}>
              <View
                ref={(v) => {
                  squares.current.set(it.id, v);
                }}
                collapsable={false}
                style={{ width: "100%", aspectRatio: 3 / 4, backgroundColor: C.pale, alignItems: "center", justifyContent: "center" }}
              >
                {photo ? <Image source={{ uri: photo.thumb ?? photo.full }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <Text style={mono(10, false, C.gray, 0.1)}>{it.dayStr}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
      {older || items.length > shown ? <ActivityIndicator color={C.ink} style={{ marginVertical: 24 }} /> : null}
      {held && face(held) ? (
        <LiftMenu
          head={{ name: held.name, sub: when(held), avatar: held.avatar, num: held.numStr || held.rowerNumber }}
          photo={face(held) as NonNullable<ReturnType<typeof face>>}
          photos={held.photos.slice(0, 2)}
          figures={figures(held)}
          from={heldFrom}
          onClose={() => setHeld(null)}
          onOpen={() => onRow(held.id)}
          items={[
            ...(held.mine && held.photos.length > 1 ? [{ label: "Swap photo", icon: <SwapIcon />, onPress: () => swapPhotos(touch, held) } as HoldItem] : []),
            { label: "Share link", icon: <LinkIcon />, wait: true, onPress: () => shareRow(held) },
          ]}
        />
      ) : null}
    </View>
  );
}
