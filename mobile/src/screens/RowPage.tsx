import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { api, type BoardData, type Photo } from "../api";
import type { TelemetryDoc } from "../pm5/session";
import { useSession } from "../session";
import { Chip, Ctl, Dash, Dateline, Dot, Eye, Lead, mono } from "../site";
import { CLIPS, GROUNDS, LENGTHS, deck, reelStillUri, shareReel, shareSticker, stickerUri, type ClipId, type GroundId, type Sticker } from "../stickers";
import type { Row } from "../store";
import { C, F, LADDER, fmtInt, lifetimeTag } from "../theme";
import { Blocks, Btn, PhotoPair, Pop, Waiting, useCount, useLoad } from "../ui";
import { Review } from "./Review";
import { ConfirmSheet, ReportSheet } from "./Social";

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
 *   LOGGED, only when the row was logged a moment ago: the metres counting
 *     up, the month's bar filling from where it was, the all-time total and
 *     any tag just earned, and the climb past the rowers just passed;
 *   the row: who, when, the metres, the time and the split, the two photos;
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
  canShare: boolean;
  canReel: boolean;
  erg: { id: string; device: string; simulated: boolean; watts: number | null; spm: number | null; hr: number | null; drag: number | null; strokes: number } | null;
  doc: TelemetryDoc | null;
};

export function RowPage({ id, fresh, rows, localDoc, onRower, onDone }: { id: string; fresh?: Fresh; rows: Row[]; localDoc?: TelemetryDoc; onRower: (n: number) => void; onDone: () => void }) {
  const { me } = useSession();
  const [reporting, setReporting] = useState(false);
  /* The owner's tools: which photo to take off, or the whole row. */
  const [taking, setTaking] = useState<number | "row" | null>(null);
  const { data, error, reload } = useLoad(() => api<{ row: RowData }>(`/api/row100k/app/row?id=${id}`), [id]);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const r = data.row;
  const doc = r.doc ?? localDoc ?? null;
  const erg = r.erg ? [r.erg.watts ? [`${r.erg.watts}`, "Watts"] : null, r.erg.spm ? [`${r.erg.spm}`, "Strokes a minute"] : null, r.erg.hr ? [`${r.erg.hr}`, "Heart rate"] : null, r.erg.drag ? [`${r.erg.drag}`, "Drag factor"] : null].filter((x): x is string[] => x !== null) : [];

  /* The time and the split, under the metres wherever the metres are. */
  const figures = (
    <Text style={{ fontFamily: F.mono, fontSize: 14, color: C.gray, marginTop: 10, fontVariant: ["tabular-nums"] }}>
      {r.masked ? null : <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{r.durationStr}  </Text>}
      {r.splitStr} /500m
    </Text>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 56 }}>
      <Dateline left={`${r.rowedStr}${r.title ? ` · ${r.title}` : ""}`} right={r.clockStr} />
      <Pressable accessibilityRole="link" accessibilityLabel={`${r.name}, rower ${r.numStr}`} onPress={() => onRower(r.rowerNumber)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 12 }}>
        <Text style={mono(12, false, C.gray, 0.12)}>
          {r.numStr} · <Text style={{ fontFamily: F.monoBold, color: r.mine ? C.accent : C.ink, textDecorationLine: "underline", textDecorationStyle: "dotted" }}>{r.name}</Text>
        </Text>
      </Pressable>

      {fresh && r.meters ? (
        <Logged fresh={fresh} meters={r.meters} line={figures} />
      ) : r.masked ? (
        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Blocks n={r.digits ?? 4} size={44} />
          {r.elite ? <Text style={mono(11, true)}>Lights out</Text> : null}
        </View>
      ) : (
        <Lead value={fmtInt(r.meters ?? 0)} unit="m" size={64} />
      )}
      {fresh && r.meters ? null : figures}

      <PhotoPair photos={r.photos} style={{ marginTop: 16 }} />

      {r.canShare && !r.masked ? <Stickers rowId={r.id} /> : null}
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

      {/* REPORT, on anybody else's row (owner, 2026-11-20: "we will need a
          report func to comply w/ apple"). */}
      {!r.mine && me.me ? (
        <View style={{ marginTop: 44 }}>
          <Ctl label="Report this row" onPress={() => setReporting(true)} />
        </View>
      ) : null}
      {reporting ? <ReportSheet num={r.rowerNumber} name={r.name} entryId={r.id} onClose={() => setReporting(false)} /> : null}

      {/* THE OWNER'S TOOLS (owner, 2026-11-21: "give me the ability to remove
          posts and photos ... sometimes maybe I don't remove the row, but I
          remove the photo"). Admins only; the server checks again. */}
      {r.admin ? (
        <>
          <Eye left="Owner" right="Only you see this" />
          <View style={{ gap: 18 }}>
            {r.photos.map((_, i) => (
              <Ctl key={i} label={`Remove photo ${i + 1}${i === 0 ? " (the rower)" : " (the monitor)"}`} onPress={() => setTaking(i)} />
            ))}
            <Ctl label="Remove this row" onPress={() => setTaking("row")} />
          </View>
        </>
      ) : null}
      {taking === "row" ? (
        <ConfirmSheet
          title="Remove this row"
          body={`This takes the row off the feed, off ${r.name}'s page and out of their total. It cannot be undone from here.`}
          yes="Remove the row"
          onClose={() => setTaking(null)}
          onYes={async () => {
            await api(`/api/row100k/rows/${r.id}`, { method: "DELETE" });
            onDone();
          }}
        />
      ) : null}
      {typeof taking === "number" ? (
        <ConfirmSheet
          title={`Remove photo ${taking + 1}`}
          body="The row, its metres and its other photo stay. The photo cannot be put back from here."
          yes="Remove the photo"
          onClose={() => setTaking(null)}
          onYes={async () => {
            await api("/api/row100k/app/moderate", { body: { entryId: r.id, photo: taking } });
            await reload();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

/* ---- LOGGED ------------------------------------------------------------ */

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

function Stickers({ rowId }: { rowId: string }) {
  const { data } = useLoad(() => deck(rowId), [rowId]);
  const [open, setOpen] = useState<Sticker | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (!data || !data.cards.length) return null;
  const share = async (c: Sticker) => {
    setBusy(true);
    setNote("");
    try {
      const did = await shareSticker(c.id, rowId, data.rowerNumber);
      if (did === "download") setNote("Saved to your downloads.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy(false);
  };
  return (
    <>
      <Eye left="Stickers" right="Tap one to share" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {data.cards.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Sticker: ${c.label}`} onPress={() => (setNote(""), setOpen(c))} style={{ width: 172 }}>
            <View style={{ height: 172, backgroundColor: GROUND, alignItems: "center", justifyContent: "center", padding: 8 }}>
              <StickerImage id={c.id} rowId={rowId} ratio={c.width / c.height} />
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
            <Text style={mono(12, true, "#fff")}>{open?.label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(null)} hitSlop={14}>
              <Text style={mono(12, true, "#fff")}>Close</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1, justifyContent: "center" }}>{open ? <StickerImage id={open.id} rowId={rowId} ratio={open.width / open.height} /> : null}</View>
          {note ? <Text style={[mono(11, false, "#fff", 0.12), { marginBottom: 12 }]}>{note}</Text> : null}
          <Text style={[mono(10, false, C.gray, 0.12), { marginBottom: 12, lineHeight: 16 }]}>White on a clear ground: lay it over your photo or video.</Text>
          <Btn label={busy ? "Getting it ready" : "Share"} disabled={busy} onPress={() => open && share(open)} />
        </View>
      </Modal>
    </>
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
