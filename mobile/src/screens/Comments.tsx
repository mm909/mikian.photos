import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, FlatList, Keyboard, Modal, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { api, type Person } from "../api";
import { CommentIcon, HeartIcon, SendIcon, ShareIcon } from "../icons";
import { useSession } from "../session";
import { mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Avatar, useModalHold } from "../ui";
import { buzz } from "../buzz";
import { ReportSheet } from "./Social";

/* LIKE, COMMENT, SHARE (owner, 2026-11-22: "I've officially bit the bullet.
 * I think we want like, comment, share on the posts. And that way, that's
 * where that share button can go"; "allow me to reply to comments. I really
 * want it to work just like Instagram's").
 *
 * So, as there: three marks in a line under a row, the heart and the bubble
 * each with its count at the left, the share at the right ("likes and
 * comments on the left, shares on the right"). The heart fills with the
 * blue. A comment has a heart of its own ("allow me to like comments as
 * well"), and a rower can be tagged in one: an @ and the start of a name
 * brings the roster up over the field ("I meant tagging someone in a
 * comment"). The
 * bubble brings the comments up from the foot of the screen over whatever
 * was being read; a comment has REPLY under it, a reply sits indented under
 * the comment it answers, and the field at the foot says who is being
 * answered. Who may read, write and remove is the server's
 * (api/row100k/app/like, /comments). */

/* ---- the three marks -------------------------------------------------- */

export function PostActions({
  id,
  likes,
  liked,
  comments,
  onComments,
  onShare,
  onChange,
  style,
}: {
  id: string;
  likes: number;
  liked: boolean;
  comments: number;
  onComments: () => void;
  onShare?: () => void;
  /* The row's like, as it now stands, for whoever keeps the list. */
  onChange?: (likes: number, liked: boolean) => void;
  style?: object;
}) {
  const { me } = useSession();
  const [mine, setMine] = useState(liked);
  const [n, setN] = useState(likes);
  useEffect(() => {
    setMine(liked);
    setN(likes);
  }, [liked, likes, id]);
  const pop = useRef(new Animated.Value(1)).current;

  /* The heart answers the thumb at once; the server's count replaces the
   * guess, and a like that did not go through is taken back. */
  const press = async () => {
    if (!me.me) return;
    const next = !mine;
    const guess = Math.max(0, n + (next ? 1 : -1));
    setMine(next);
    setN(guess);
    onChange?.(guess, next);
    if (next) {
      /* The little knock of a like (buzz.ts). */
      buzz.tap();
      pop.setValue(0.7);
      Animated.timing(pop, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(3)), useNativeDriver: Platform.OS !== "web" }).start();
    }
    try {
      const r = await api<{ likes: number; liked: boolean }>("/api/row100k/app/like", { body: { entryId: id, on: next } });
      setMine(r.liked);
      setN(r.likes);
      onChange?.(r.likes, r.liked);
    } catch {
      setMine(!next);
      setN(n);
      onChange?.(n, !next);
    }
  };

  const count = (v: number) => (v > 0 ? <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(v)}</Text> : null);
  const hit = ({ pressed }: { pressed: boolean }) => ({ flexDirection: "row" as const, alignItems: "center" as const, gap: 6, minHeight: 36, opacity: pressed ? 0.5 : 1 });
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 18 }, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={mine ? `Unlike. ${n} likes` : `Like. ${n} likes`} accessibilityState={{ selected: mine }} onPress={press} hitSlop={8} style={hit}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <HeartIcon color={mine ? C.accent : C.ink} full={mine} size={25} />
        </Animated.View>
        {count(n)}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Comments, ${comments}`} onPress={onComments} hitSlop={8} style={hit}>
        <CommentIcon size={25} />
        {count(comments)}
      </Pressable>
      <View style={{ flex: 1 }} />
      {onShare ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Share this row" onPress={onShare} hitSlop={8} style={hit}>
          <ShareIcon size={24} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---- the comments ----------------------------------------------------- */

type Line = { id: string; parentId: string | null; rowerNumber: number; numStr: string; name: string; avatar: string | null; text: string; likes: number; liked: boolean; mine: boolean; canRemove: boolean; dayStr: string; clockStr: string };
type Top = Line & { replies: Line[] };
type Answer = { comments: Top[]; count: number; tags?: Record<string, string> };
/* A rower tagged in a comment travels as @[<rower number>]. */
const TAG = /(@\[\d{1,6}\])/;

export function CommentsSheet({ entryId, onClose, onRower, onCount }: { entryId: string; onClose: () => void; onRower: (n: number) => void; onCount?: (n: number) => void }) {
  useModalHold();
  const { me } = useSession();
  const win = useWindowDimensions();
  const path = `/api/row100k/app/comments?entry=${entryId}`;
  const [data, setData] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [to, setTo] = useState<Line | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Line | null>(null);
  /* Names picked from the roster while writing, and whose number each is. */
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [offer, setOffer] = useState<Person[]>([]);
  const turn = useRef(0);
  const field = useRef<{ focus: () => void } | null>(null);
  const list = useRef<FlatList<Top>>(null);

  const read = async () => {
    try {
      const r = await api<Answer>(path);
      setData(r);
      onCount?.(r.count);
      setError("");
      return r;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The comments could not be read.");
      return null;
    }
  };
  useEffect(() => {
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  /* AN @ AND THE START OF A NAME at the end of what is being written
   * brings up to five of the roster over the field; a press writes the
   * name in. */
  const at = /(?:^|\s)@([^\s@]{0,24})$/.exec(text);
  const ask = at ? at[1] : null;
  useEffect(() => {
    const mine = ++turn.current;
    if (ask === null) {
      setOffer([]);
      return;
    }
    const wait = setTimeout(() => {
      api<{ people: Person[] }>(`/api/row100k/app/people?q=${encodeURIComponent(ask)}`).then(
        (r) => {
          if (mine === turn.current) setOffer(r.people.filter((p) => !p.me).slice(0, 5));
        },
        () => null,
      );
    }, 160);
    return () => clearTimeout(wait);
  }, [ask]);
  const pick = (p: Person) => {
    setText((t) => t.replace(/@[^\s@]{0,24}$/, `@${p.name} `));
    setPicked((m) => ({ ...m, [p.name]: p.rowerNumber }));
    setOffer([]);
    field.current?.focus();
  };

  /* THE KEYBOARD (owner, 2026-11-21: "we still see those little edges
   * around the keyboard"; "it scrolls the comments box up, but it goes a
   * little too far up the screen"; and the field "is not vertically
   * centered"). The sheet is moved by the keyboard's own height, read off
   * the keyboard, and is made SHORTER while it is up so its top stays on
   * the screen with the row still showing over it. Paper runs behind the
   * whole keyboard, so its rounded corners show paper. And the room left
   * under the field for the phone's home bar is given back while the
   * keyboard covers that bar. */
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const up = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      Keyboard.scheduleLayoutAnimation(e);
      setKb(e.endCoordinates.height);
    });
    const down = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", (e) => {
      Keyboard.scheduleLayoutAnimation(e);
      setKb(0);
    });
    return () => {
      up.remove();
      down.remove();
    };
  }, []);
  const tall = Math.round(Math.min(win.height * 0.72, win.height - kb - 110));

  /* Up from the foot, like every other sheet here. */
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [a]);
  /* AND DOWN TO THE FOOT AGAIN (owner, 2026-11-23: "there's an animation
   * when it comes in, but there's not an animation when it goes out"): the
   * sheet goes down and the shade lifts, and only then is it gone; what a
   * press was on its way to (a rower's page) opens after it. */
  const going = useRef(false);
  const shut = (then?: () => void) => {
    if (going.current) return;
    going.current = true;
    Keyboard.dismiss();
    Animated.timing(a, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start(() => {
      onClose();
      then?.();
    });
  };

  const post = async () => {
    let t = text.trim();
    if (!t || busy) return;
    /* Each picked name goes as its rower's number, the longest name first
     * so one name inside another is not cut. */
    for (const [name, num] of Object.entries(picked).sort((x, y) => y[0].length - x[0].length)) t = t.split(`@${name}`).join(`@[${num}]`);
    setBusy(true);
    try {
      await api("/api/row100k/app/comments", { body: { entryId, text: t, parentId: to?.id } });
      const wasReply = !!to;
      setText("");
      setTo(null);
      setPicked({});
      await read();
      /* A new comment is the last one; a reply stays where it was read. */
      if (!wasReply) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    }
    setBusy(false);
  };
  const remove = async (c: Line) => {
    try {
      await api("/api/row100k/app/comments", { body: { remove: c.id } });
    } catch {
      /* Read again either way: the list says what is true. */
    }
    read();
  };
  /* A reply opens on the name of who it answers, as Instagram's does. */
  const reply = (c: Line) => {
    setTo(c);
    if (!c.mine && !text.trim()) {
      setText(`@${c.name} `);
      setPicked((m) => ({ ...m, [c.name]: c.rowerNumber }));
    }
    field.current?.focus();
  };
  /* The heart on a comment answers at once; the server's count replaces
   * the guess. */
  const setLike = (id: string, likes: number, liked: boolean) =>
    setData((d) => {
      if (!d) return d;
      const on = <T extends Line>(c: T): T => (c.id === id ? { ...c, likes, liked } : c);
      return { ...d, comments: d.comments.map((c) => ({ ...on(c), replies: c.replies.map(on) })) };
    });
  const like = async (c: Line) => {
    if (!me.me) return;
    const next = !c.liked;
    setLike(c.id, Math.max(0, c.likes + (next ? 1 : -1)), next);
    try {
      const r = await api<{ likes: number; liked: boolean }>("/api/row100k/app/like", { body: { commentId: c.id, on: next } });
      setLike(c.id, r.likes, r.liked);
    } catch {
      setLike(c.id, c.likes, c.liked);
    }
  };
  /* The words of a comment, a tagged rower in the blue and pressable. */
  const words = (t: string) =>
    t.split(TAG).map((part, i) => {
      const m = /^@\[(\d{1,6})\]$/.exec(part);
      if (!m) return part;
      const name = data?.tags?.[String(Number(m[1]))];
      if (!name) return "@rower";
      return (
        <Text
          key={i}
          accessibilityRole="link"
          style={{ fontFamily: F.bold, color: C.accent }}
          onPress={() => {
            shut(() => onRower(Number(m[1])));
          }}
        >
          @{name}
        </Text>
      );
    });

  const small = { fontFamily: F.monoBold, fontSize: 11, color: C.gray } as const;
  const one = (c: Line, inner: boolean) => (
    <View key={c.id} style={{ flexDirection: "row", gap: 10, paddingVertical: 10, paddingLeft: inner ? 44 : 0 }}>
      <Pressable
        accessibilityLabel={`${c.name}'s page`}
        onPress={() => shut(() => onRower(c.rowerNumber))}
      >
        <Avatar uri={c.avatar} name={c.name} num={c.rowerNumber} size={inner ? 26 : 34} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 20, color: C.ink }}>
          {/* The viewer's own name is ink like anybody's (owner, 2026-11-23:
              "my name whenever I'm in the comments is blue. I don't like
              that"). */}
          <Text style={{ fontFamily: F.bold, color: C.ink }}>{c.name}</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.gray }}>
            {"  "}
            {c.dayStr} · {c.clockStr}
          </Text>
        </Text>
        <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 2 }}>{words(c.text)}</Text>
        <View style={{ flexDirection: "row", gap: 18, marginTop: 6 }}>
          {me.me ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${c.name}`} onPress={() => reply(c)} hitSlop={8}>
              <Text style={small}>Reply</Text>
            </Pressable>
          ) : null}
          {c.canRemove ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Remove this comment" onPress={() => remove(c)} hitSlop={8}>
              <Text style={small}>Remove</Text>
            </Pressable>
          ) : null}
          {me.me && !c.mine ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Report ${c.name}'s comment`} onPress={() => setReport(c)} hitSlop={8}>
              <Text style={small}>Report</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {/* Its own heart, the count under it. */}
      <Pressable accessibilityRole="button" accessibilityLabel={c.liked ? `Unlike this comment. ${c.likes} likes` : `Like this comment. ${c.likes} likes`} accessibilityState={{ selected: c.liked }} onPress={() => like(c)} hitSlop={10} style={({ pressed }) => ({ width: 30, alignItems: "center", paddingTop: 4, opacity: pressed ? 0.5 : 1 })}>
        <HeartIcon color={c.liked ? C.accent : C.gray} full={c.liked} size={17} />
        {c.likes > 0 ? <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.gray, marginTop: 2, fontVariant: ["tabular-nums"] }}>{fmtInt(c.likes)}</Text> : null}
      </Pressable>
    </View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => shut()}>
      <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: kb }}>
        <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", opacity: a }}>
          <Pressable accessibilityLabel="Close the comments" onPress={() => shut()} style={{ flex: 1 }} />
        </Animated.View>
        {/* Paper under the sheet, so nothing darker shows round the
            corners of the keyboard when it is up (owner, 2026-11-22: "some
            edges around there that aren't the same color"). */}
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: kb + 60, alignItems: "center", opacity: a }}>
          <View style={{ flex: 1, width: "100%", maxWidth: 560, backgroundColor: C.paper }} />
        </Animated.View>
        <Animated.View style={{ backgroundColor: C.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, width: "100%", maxWidth: 560, alignSelf: "center", height: tall, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [win.height * 0.72, 0] }) }] }}>
          {/* The grip and the name of the sheet. */}
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.line }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>Comments</Text>
          </View>

          {!data ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>{error ? <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.soft, textAlign: "center" }}>{error}</Text> : <ActivityIndicator color={C.ink} />}</View>
          ) : (
            <FlatList
              ref={list}
              data={data.comments}
              keyExtractor={(c) => c.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 8, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View>
                  {one(item, false)}
                  {item.replies.map((r) => one(r, true))}
                </View>
              )}
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.ink }}>No comments yet</Text>
                  <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.soft, marginTop: 6 }}>Say something about this row.</Text>
                </View>
              }
            />
          )}

          {/* The field at the foot, and who it answers. */}
          {me.me ? (
            <View style={{ borderTopWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingTop: 8, paddingBottom: kb > 0 ? 8 : Platform.OS === "ios" ? 26 : 12 }}>
              {data && error ? <Text style={[mono(10, false, C.accent), { marginBottom: 6 }]}>{error}</Text> : null}
              {/* The roster, while a name is being written after an @. */}
              {offer.map((p) => (
                <Pressable key={p.rowerNumber} accessibilityRole="button" accessibilityLabel={`Tag ${p.name}`} onPress={() => pick(p)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
                  <Avatar uri={p.avatar} name={p.name} num={p.rowerNumber} size={28} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.ink }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{p.numStr} · </Text>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
              {offer.length ? <View style={{ height: 8 }} /> : null}
              {to ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 12, color: C.gray, flex: 1 }}>
                    Replying to {to.name}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Stop replying" onPress={() => setTo(null)} hitSlop={10}>
                    <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.gray }}>✕</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
                {/* The face sits on the middle of the field's one line. */}
                <View style={{ height: 40, justifyContent: "center" }}>
                  <Avatar uri={me.avatar} name={me.me.displayName} num={me.me.rowerNumber} size={34} />
                </View>
                <View style={{ flex: 1, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, justifyContent: "center" }}>
                  <TextInput
                    ref={field as never}
                    accessibilityLabel={to ? `Reply to ${to.name}` : "Add a comment"}
                    value={text}
                    onChangeText={setText}
                    multiline
                    /* One line tall until more is written; a browser's own field starts at two. */
                    {...(Platform.OS === "web" ? { rows: 1 } : {})}
                    maxLength={500}
                    placeholder={to ? `Reply to ${to.name}` : "Add a comment"}
                    placeholderTextColor={C.gray}
                    style={[{ fontFamily: F.sans, fontSize: 16, color: C.ink, paddingVertical: 9, maxHeight: 110 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
                  />
                </View>
                {/* SEND: an arrow going up, in a disc (owner, 2026-11-22). */}
                <Pressable accessibilityRole="button" accessibilityLabel="Post" disabled={!text.trim() || busy} onPress={post} hitSlop={8} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: !text.trim() || busy ? C.line : C.ink, opacity: pressed ? 0.6 : 1 })}>
                  <SendIcon color={C.paper} size={22} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={{ fontFamily: F.sans, fontSize: 14, color: C.soft, textAlign: "center", paddingVertical: 18, borderTopWidth: 1, borderColor: C.line }}>Sign in to comment.</Text>
          )}
        </Animated.View>
        {report ? <ReportSheet num={report.rowerNumber} name={report.name} entryId={entryId} onClose={() => setReport(null)} /> : null}
      </View>
    </Modal>
  );
}
