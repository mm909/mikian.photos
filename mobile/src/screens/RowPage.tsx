import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { api, type BoardData, type FollowState, type Photo } from "../api";
import { CloseIcon, ShareIcon } from "../icons";
import type { TelemetryDoc } from "../pm5/session";
import { useSession } from "../session";
import { Chip, Ctl, Dash, Dateline, Dot, Eye, Lead, mono } from "../site";
import { CLIPS, GROUNDS, LENGTHS, deck, reelStillUri, copySticker, shareReel, shareSticker, stickerUri, type ClipId, type GroundId, type Sticker } from "../stickers";
import type { Row } from "../store";
import { C, F, LADDER, fmtInt, lifetimeTag } from "../theme";
import { Blocks, Btn, PhotoPair, Pop, Waiting, useCount, useLoad } from "../ui";
import { Review } from "./Review";
import { RowMenu } from "./Social";

/* ONE ROW'S PAGE (owner, 2026-11-20). The journey he walked: "right as they
 * finish they submit the row and see an animation of their meters going up
 * and seeing who they have passed. They get a shareables menu, then they get
 * shown a stats page with all of their stats from this row if they were
 * connected to the erg (prob the same screen but with less stats if they
 * didnt). Then they might share the stickers"; and "if you tap a row it can
 * open up the commentary on that row, that post row screen, and there you
 * can use the shareables".
 *
 * So one page, top to bottom:
 *   LOGGED, only when the row was logged a moment ago: the meters counting
 *     up, the month's bar filling from where it was, the all-time total and
 *     any tag just earned, and the climb past the rowers just passed;
 *   the row: who, when, the meters, the time and the split, the two photos;
 *   STICKERS, for the rower's own row: the site's transparent share cards,
 *     drawn by the site, a tap to share;
 *   REEL OVERLAYS, when the erg was connected: the row's numbers as short
 *     videos on a ground to key out, filmed by the site, to stitch into an
 *     edit in another app;
 *   THE READ, when the erg was connected: the recording read back; the
 *     monitor's averages alone when the recording is somebody else's.
 * Opened later from the feed or a profile it is the same page with no
 * LOGGED block. */

export type Fresh = { meters: number; monthBefore: number; lifeBefore: number; inMonth: boolean; goal: number; monthWord: string };

type RowData = {
  id: string;
  day: string;
  rowedStr: string;
  dayStr: string;
  clockStr: string;
  rowerNumber: number;
  numStr: string;
  name: string;
  title: string;
  meters: number | null;
  seconds: number | null;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  photos: Photo[];
  masked: boolean;
  digits?: number;
  elite: boolean;
  mine: boolean;
  /* The viewer is an admin: the owner's tools show on this row. */
  admin?: boolean;
  /* How the viewer stands to the row's rower, for the three dots. */
  rel?: { following: FollowState; bell: boolean; muted?: boolean };
  canShare: boolean;
  canReel: boolean;
  erg: { id: string; device: string; simulated: boolean; watts: number | null; spm: number | null; hr: number | null; drag: number | null; strokes: number } | null;
  doc: TelemetryDoc | null;
};

export function RowPage({
  id,
  fresh,
  rows,
  localDoc,
  onRower,
  onDone,
  menu,
  onMenu,
  onWho,
}: {
  id: string;
  fresh?: Fresh;
  rows: Row[];
  localDoc?: TelemetryDoc;
  onRower: (n: number) => void;
  onDone: () => void;
  /* The three dots in the top bar, pressed (App.tsx holds it). */
  menu?: boolean;
  onMenu?: (open: boolean) => void;
  /* Whose row this is, once known: the top bar's mark rolls into it. */
  onWho?: (num: number) => void;
}) {
  const path = `/api/row100k/app/row?id=${id}`;
  const { data, error, reload } = useLoad(() => api<{ row: RowData }>(path), [path], path);
  const [sharing, setSharing] = useState(false);
  const who = data?.row.rowerNumber;
  useEffect(() => {
    if (who) onWho?.(who);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who]);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const r = data.row;
  const doc = r.doc ?? localDoc ?? null;
  const erg = r.erg ? [r.erg.watts ? [`${r.erg.watts}`, "Watts"] : null, r.erg.spm ? [`${r.erg.spm}`, "Strokes a minute"] : null, r.erg.hr ? [`${r.erg.hr}`, "Heart rate"] : null, r.erg.drag ? [`${r.erg.drag}`, "Drag factor"] : null].filter((x): x is string[] => x !== null) : [];

  /* The time and the split, under the meters of a row just logged. */
  const figures = (
    <Text style={{ fontFamily: F.mono, fontSize: 14, color: C.gray, marginTop: 10, fontVariant: ["tabular-nums"] }}>
      {r.masked ? null : <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{r.durationStr}  </Text>}
      {r.splitStr} /500m
    </Text>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 56 }}>
      {/* WHO AND WHEN, in two tight lines (owner, 2026-11-21: "the space
          isn't used well up at the top. I feel like we can do the same with
          less vertical space"). The rower's number is in the bar above. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`${r.name}, rower ${r.numStr}`} onPress={() => onRower(r.rowerNumber)} hitSlop={8} style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 18, color: r.mine ? C.accent : C.ink }}>
            {r.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 11, color: C.gray, marginTop: 3 }}>
            {r.rowedStr} · {r.clockStr}
            {r.title ? ` · ${r.title}` : ""}
          </Text>
        </Pressable>
        {/* THE STICKERS, behind one mark (owner, 2026-11-21: "let's put
            these stickers behind like a little share icon"). */}
        {r.canShare && !r.masked ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Share this row" onPress={() => setSharing(true)} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, height: 38, paddingHorizontal: 12, backgroundColor: C.accent, borderRadius: 19, opacity: pressed ? 0.7 : 1 })}>
            <ShareIcon color="#fff" size={18} />
            <Text style={mono(11, true, "#fff", 0.12)}>Share</Text>
          </Pressable>
        ) : null}
      </View>

      {/* THE TWO NUMBERS: how far, and at what pace (owner, 2026-11-21:
          "those are the two numbers I'm looking at"). The meters lead; the
          pace is second and no smaller than it needs to be; the time is the
          small one under it. */}
      {fresh && r.meters ? (
        <Logged fresh={fresh} meters={r.meters} line={figures} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16 }}>
          <View>
            {r.masked ? (
              <Blocks n={r.digits ?? 4} size={40} />
            ) : (
              <Text style={{ fontFamily: F.black, fontSize: 52, lineHeight: 54, letterSpacing: -1, color: C.accent, fontVariant: ["tabular-nums"] }}>{fmtInt(r.meters ?? 0)}</Text>
            )}
            <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 4 }]}>Meters</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: F.black, fontSize: 32, lineHeight: 36, color: C.ink, fontVariant: ["tabular-nums"] }}>{r.splitStr}</Text>
            <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 4 }]}>/500m{r.masked ? "" : ` · ${r.durationStr}`}</Text>
          </View>
        </View>
      )}

      <PhotoPair photos={r.photos} style={{ marginTop: 16 }} onMenu={onMenu ? () => onMenu(true) : undefined} />

      {r.canReel && !r.masked ? <Reels rowId={r.id} /> : null}

      {erg.length ? (
        <>
          <Eye left="The erg" right={r.erg?.simulated ? "Demo" : r.erg?.device} />
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {erg.map(([v, k]) => (
              <View key={k} style={{ width: "50%", paddingVertical: 10 }}>
                <Text style={{ fontFamily: F.black, fontSize: 28, color: C.ink, fontVariant: ["tabular-nums"] }}>{v}</Text>
                <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 4 }]}>{k}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {doc ? <Review row={{ id: r.id, day: r.day, meters: r.meters ?? 0 }} rows={rows} doc={doc} /> : null}
      {!doc && !erg.length && !r.masked ? <Text style={[mono(11, false, C.gray, 0.12), { marginTop: 30, lineHeight: 18 }]}>Logged by hand. A row off a connected erg adds the splits, the stroke and the read.</Text> : null}

      {fresh ? <Btn label="Done" onPress={onDone} style={{ marginTop: 34 }} /> : null}

      {/* THE THREE DOTS at the top of the page: the rower's page, follow,
          notifications, mute, report; and, for the owner, his tools. */}
      {menu && onMenu ? (
        <RowMenu
          row={{ id: r.id, rowerNumber: r.rowerNumber, name: r.name, mine: r.mine, photos: r.photos.length, rel: r.rel ?? { following: "none", bell: false } }}
          onClose={() => onMenu(false)}
          onRower={onRower}
          onChange={(what) => (what === "row-gone" || what === "blocked" ? onDone() : reload())}
        />
      ) : null}
      {sharing ? <StickerViewer rowId={r.id} onClose={() => setSharing(false)} /> : null}
    </ScrollView>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

function Logged({ fresh, meters, line }: { fresh: Fresh; meters: number; line: ReactNode }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 250);
    return () => clearTimeout(t);
  }, []);
  const added = useCount(go ? meters : 0, 1200);
  const monthAfter = fresh.monthBefore + (fresh.inMonth ? meters : 0);
  const month = useCount(go ? monthAfter : fresh.monthBefore, 1400);
  const lifeAfter = fresh.lifeBefore + meters;
  const life = useCount(go ? lifeAfter : fresh.lifeBefore, 1600);
  const tagBefore = lifetimeTag(fresh.lifeBefore)?.tag ?? "";
  const tagNow = lifetimeTag(lifeAfter);
  const newTag = tagNow?.tag && tagNow.tag !== tagBefore ? tagNow.tag : "";
  const prevRung = LADDER.filter((l) => l.meters <= lifeAfter).pop()?.meters ?? 0;
  const club = fresh.inMonth && fresh.monthBefore < fresh.goal && monthAfter >= fresh.goal;

  return (
    <View style={{ marginTop: 16 }}>
      <Pop>
        <Text style={mono(12, true, C.accent)}>Row logged</Text>
      </Pop>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Text style={{ fontFamily: F.black, fontSize: 68, lineHeight: 74, letterSpacing: -1, color: C.accent, fontVariant: ["tabular-nums"] }}>+{fmtInt(added)}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.gray }}>m</Text>
      </View>
      {line}

      {fresh.inMonth ? (
        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <Text style={mono(11, true)}>{fresh.monthWord}</Text>
            <Text style={mono(11, false, C.gray)}>
              <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(month)}</Text> of {fmtInt(fresh.goal)} m
            </Text>
          </View>
          <Fill from={fresh.monthBefore / fresh.goal} to={monthAfter / fresh.goal} go={go} height={12} />
          {club ? (
            <Pop delay={1500}>
              <Text style={{ fontFamily: F.black, fontSize: 26, color: C.ink, marginTop: 12 }}>
                THE <Text style={{ color: C.accent }}>100K</Text> CLUB
              </Text>
            </Pop>
          ) : monthAfter < fresh.goal ? (
            <Text style={[mono(11, false, C.gray), { marginTop: 8 }]}>{fmtInt(fresh.goal - monthAfter)} m to 100K</Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: 22 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <Text style={mono(11, true)}>All time</Text>
          <Text style={mono(11, false, C.gray)}>
            <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(life)}</Text> m
          </Text>
        </View>
        {tagNow?.next ? <Fill from={Math.max(0, fresh.lifeBefore - prevRung) / (tagNow.next.meters - prevRung)} to={(lifeAfter - prevRung) / (tagNow.next.meters - prevRung)} go={go} height={6} /> : null}
        {newTag ? (
          <Pop delay={1700}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }}>
              <Text style={{ fontFamily: F.monoBold, fontSize: 14, letterSpacing: 1, color: "#fff", backgroundColor: C.accent, paddingHorizontal: 9, paddingVertical: 3 }}>{newTag}</Text>
              <Text style={mono(11, true)}>New tag</Text>
            </View>
          </Pop>
        ) : tagNow?.next ? (
          <Text style={[mono(11, false, C.gray), { marginTop: 8 }]}>
            {fmtInt(tagNow.next.meters - lifeAfter)} m to {tagNow.next.tag}
          </Text>
        ) : null}
      </View>

      {fresh.inMonth ? <Climb meters={meters} /> : null}
    </View>
  );
}

/* A bar that starts where it was and fills to where it is. */
function Fill({ from, to, go, height }: { from: number; to: number; go: boolean; height: number }) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const a = useRef(new Animated.Value(clamp(from))).current;
  useEffect(() => {
    if (go) Animated.timing(a, { toValue: clamp(to), duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, go, to]);
  return (
    <View style={{ height, backgroundColor: C.pale }}>
      <Animated.View style={{ height: "100%", backgroundColor: C.accent, width: a.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${clamp(from) * 100}%`, backgroundColor: C.ink }} />
    </View>
  );
}

/* THE CLIMB: the board as it stands now, read back one row: where the rower
 * was before this row, who that carried them past, and the place it leaves
 * them. Their line starts under the rowers passed and rises over them.
 * Nothing draws for a rower who is not on the month's board. */
const ROW_H = 44;

function Climb({ meters }: { meters: number }) {
  const { data } = useLoad(() => api<BoardData>("/api/row100k/app/board"), []);
  const a = useRef(new Animated.Value(0)).current;
  const me = data?.rows.find((x) => x.me);
  const ranked = data ? data.rows.filter((x) => !x.unranked && x.blocks === undefined) : [];
  const at = me ? ranked.findIndex((x) => x.me) : -1;
  const before = me ? me.meters - meters : 0;
  /* Everybody the row carried them past: at or over where they were, under where they are. */
  const passed = me && at >= 0 ? ranked.filter((x) => !x.me && x.meters < me.meters && x.meters >= before) : [];
  const shown = passed.slice(0, 4);
  useEffect(() => {
    if (shown.length) Animated.timing(a, { toValue: 1, duration: 1100, delay: 1500, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: false }).start();
  }, [a, shown.length]);
  if (!data || !me || at < 0) return null;
  const place = at + 1;
  const line = (num: number, name: string, m: number, mine: boolean) => (
    <View style={{ height: ROW_H, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, backgroundColor: mine ? C.pale : C.tint, borderBottomWidth: 1, borderColor: C.line }}>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.ink }}>
        <Text style={{ fontFamily: mine ? F.monoBold : F.mono, fontSize: 12, color: mine ? C.accent : C.gray }}>{String(num).padStart(3, "0")} · </Text>
        {name}
      </Text>
      <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(m)}</Text>
    </View>
  );
  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8 }}>
        <Text style={mono(11, true)}>{passed.length ? `Passed ${passed.length}` : "The board"}</Text>
        <Dot size={11} />
        <Text style={mono(11, true, C.accent)}>
          {passed.length ? "Now " : ""}
          {ordinal(place)}
        </Text>
        <Text style={mono(11, false, C.gray)}> of {data.rows.length}</Text>
      </View>
      {shown.length ? (
        <View style={{ height: ROW_H * (shown.length + 1) }}>
          {shown.map((x, i) => (
            <Animated.View key={x.rowerNumber} style={{ position: "absolute", left: 0, right: 0, top: a.interpolate({ inputRange: [0, 1], outputRange: [i * ROW_H, (i + 1) * ROW_H] }) }}>
              {line(x.rowerNumber, x.name, x.meters, false)}
            </Animated.View>
          ))}
          <Animated.View style={{ position: "absolute", left: 0, right: 0, top: a.interpolate({ inputRange: [0, 1], outputRange: [shown.length * ROW_H, 0] }) }}>{line(me.rowerNumber, me.name, me.meters, true)}</Animated.View>
        </View>
      ) : (
        line(me.rowerNumber, me.name, me.meters, true)
      )}
      {passed.length > shown.length ? <Text style={[mono(11, false, C.gray), { marginTop: 8 }]}>and {passed.length - shown.length} more</Text> : null}
      {at > 0 ? (
        <Text style={[mono(11, false, C.gray, 0.12), { marginTop: 8, lineHeight: 18 }]}>
          {fmtInt(ranked[at - 1].meters - me.meters)} m behind {ranked[at - 1].name}
        </Text>
      ) : (
        <Text style={[mono(11, true, C.accent), { marginTop: 8 }]}>Leading the board</Text>
      )}
    </View>
  );
}

/* ---- STICKERS ---------------------------------------------------------- */

/* The art is white on nothing, so it is shown on ink, the way the site's
 * dialog shows it. */
const GROUND = "#1f2226";

/* THE STICKERS (owner, 2026-11-21: "whenever I open them up, I want to be
 * able to swipe through them ... I need a share button and a copy button
 * ... and then I can close it"). One screen on the dark ground the stickers
 * are made for, one sticker to a page, a swipe to the next; SHARE hands the
 * one showing to the phone's share sheet, COPY puts it on the clipboard. */
function StickerViewer({ rowId, onClose }: { rowId: string; onClose: () => void }) {
  const win = useWindowDimensions();
  const w = Math.min(win.width, 560);
  const { data, error } = useLoad(() => deck(rowId), [rowId]);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState<"" | "share" | "copy">("");
  const [note, setNote] = useState("");
  const cards = data?.cards ?? [];
  const card = cards[Math.min(at, cards.length - 1)];
  const run = async (what: "share" | "copy") => {
    if (!card) return;
    setBusy(what);
    setNote("");
    try {
      if (what === "copy") {
        await copySticker(card.id, rowId, data?.rowerNumber);
        setNote("Copied.");
      } else if ((await shareSticker(card.id, rowId, data?.rowerNumber)) === "download") setNote("Saved to your downloads.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy("");
  };
  const pill = (label: string, what: "share" | "copy", fill: boolean) => (
    <Pressable accessibilityRole="button" disabled={busy !== "" || !card} onPress={() => run(what)} style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: fill ? C.accent : "transparent", borderWidth: fill ? 0 : 2, borderColor: "#fff", opacity: busy !== "" || !card ? 0.5 : pressed ? 0.7 : 1 })}>
      <Text style={mono(12, true, "#fff", 0.14)}>{busy === what ? "Working" : label}</Text>
    </Pressable>
  );
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: GROUND, alignItems: "center" }}>
        <View style={{ flex: 1, width: w, paddingTop: 44, paddingBottom: 30 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <CloseIcon color="#fff" size={26} />
            </Pressable>
            <Text numberOfLines={1} style={[mono(12, true, "#fff"), { flex: 1, textAlign: "center" }]}>
              {card?.label ?? ""}
            </Text>
            <View style={{ width: 44 }} />
          </View>
          {!data ? (
            <View style={{ flex: 1, justifyContent: "center" }}>{error ? <Text style={[mono(11, false, "#fff", 0.12), { textAlign: "center", paddingHorizontal: 20 }]}>{error}</Text> : <ActivityIndicator color="#fff" />}</View>
          ) : (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, w)))} scrollEventThrottle={32} style={{ flex: 1 }}>
              {cards.map((c) => (
                <View key={c.id} style={{ width: w, paddingHorizontal: 20, justifyContent: "center" }}>
                  <StickerImage id={c.id} rowId={rowId} ratio={c.width / c.height} />
                </View>
              ))}
            </ScrollView>
          )}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 7, marginTop: 14, minHeight: 8 }}>
            {cards.map((c, i) => (
              <View key={c.id} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === at ? "#fff" : "rgba(255,255,255,0.3)" }} />
            ))}
          </View>
          <Text style={[mono(11, false, "#fff", 0.12), { textAlign: "center", marginTop: 12, minHeight: 16 }]}>{note}</Text>
          <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 10 }}>
            {pill("Copy", "copy", false)}
            {pill("Share", "share", true)}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StickerImage({ id, rowId, ratio }: { id: string; rowId: string; ratio: number }) {
  const [uri, setUri] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    stickerUri(id, rowId)
      .then((u) => live && setUri(u))
      .catch(() => live && setBad(true));
    return () => {
      live = false;
    };
  }, [id, rowId]);
  if (bad) return <Text style={mono(10, false, C.gray)}>Could not be drawn</Text>;
  if (!uri) return <ActivityIndicator color="#fff" />;
  return <Image source={{ uri }} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: "100%", aspectRatio: ratio }} />;
}

/* ---- REEL OVERLAYS ----------------------------------------------------- */

/* The six clips the site's reel studio films (erg/reel/paint.ts), each
 * shown as the frame it ends on. A tap picks the ground and the length and
 * films it: the server paints every frame and sends back an MP4. Video
 * cannot be see-through, so the overlay comes on a colour to key out
 * (green, blue) or to blend away (black). */
function Reels({ rowId }: { rowId: string }) {
  const [open, setOpen] = useState<ClipId | null>(null);
  const [bg, setBg] = useState<GroundId>("green");
  const [len, setLen] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const film = async () => {
    if (!open) return;
    setBusy(true);
    setNote("");
    try {
      const did = await shareReel(rowId, open, bg, len);
      if (did === "download") setNote("Saved to your downloads.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy(false);
  };
  return (
    <>
      <Eye left="Reel overlays" right="For your edit" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {CLIPS.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Reel overlay: ${c.label}`} onPress={() => (setNote(""), setOpen(c.id))} style={{ width: 124 }}>
            <View style={{ height: 220, backgroundColor: GROUND, alignItems: "center", justifyContent: "center" }}>
              <Still rowId={rowId} clip={c.id} />
            </View>
            <Text numberOfLines={1} style={[mono(10, true, C.ink, 0.12), { marginTop: 6 }]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Dash style={{ marginTop: 14 }} />

      <Modal visible={open !== null} transparent animationType="none" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: GROUND, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 30 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={mono(12, true, "#fff")}>{CLIPS.find((c) => c.id === open)?.label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} onPress={() => setOpen(null)} hitSlop={14}>
              <Text style={mono(12, true, "#fff")}>Close</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14 }}>{open ? <Still rowId={rowId} clip={open} tall /> : null}</View>
          <Text style={[mono(10, false, C.gray, 0.12), { marginBottom: 8 }]}>The ground to key out</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {GROUNDS.map((g) => (
              <Light key={g.id} label={g.label} on={bg === g.id} onPress={() => setBg(g.id)} />
            ))}
          </View>
          <Text style={[mono(10, false, C.gray, 0.12), { marginBottom: 8 }]}>How long</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {LENGTHS.map((l) => (
              <Light key={l} label={`${l} s`} on={len === l} onPress={() => setLen(l)} />
            ))}
          </View>
          {note ? <Text style={[mono(11, false, "#fff", 0.12), { marginBottom: 12 }]}>{note}</Text> : null}
          <Text style={[mono(10, false, C.gray, 0.12), { marginBottom: 12, lineHeight: 16 }]}>
            Video cannot be see-through. Drop the clip over your footage and key the {bg === "black" ? "black out with a Screen blend" : `${bg} out`}. Filming takes about {len * 2} seconds.
          </Text>
          <Btn label={busy ? "Filming" : "Film it and share"} disabled={busy} onPress={film} />
        </View>
      </Modal>
    </>
  );
}

/* A choice on the ink sheet: outlined in white, white when on. */
function Light({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={{ borderWidth: 2, borderColor: "#fff", backgroundColor: on ? "#fff" : "transparent", minHeight: 40, paddingHorizontal: 14, justifyContent: "center" }}>
      <Text style={mono(12, true, on ? GROUND : "#fff", 0.08)}>{label}</Text>
    </Pressable>
  );
}

function Still({ rowId, clip, tall }: { rowId: string; clip: ClipId; tall?: boolean }) {
  const [uri, setUri] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    setUri("");
    setBad(false);
    reelStillUri(rowId, clip)
      .then((u) => live && setUri(u))
      .catch(() => live && setBad(true));
    return () => {
      live = false;
    };
  }, [rowId, clip]);
  if (bad) return <Text style={mono(10, false, C.gray)}>No preview</Text>;
  if (!uri) return <ActivityIndicator color="#fff" />;
  return <Image source={{ uri }} resizeMode="contain" accessibilityIgnoresInvertColors style={tall ? { height: "100%", aspectRatio: 9 / 16 } : { width: "100%", aspectRatio: 9 / 16 }} />;
}
