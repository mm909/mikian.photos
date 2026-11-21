import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { api, peek, type Counts, type FollowState, type Notice, type Person, type Rel, type SocialSettings } from "../api";
import { SearchIcon } from "../icons";
import { useLookSwitch } from "../look";
import { useSession } from "../session";
import { Ctl, Eye, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pickFace, setAvatar } from "../upload";
import { Avatar, Waiting, useLoad } from "../ui";

/* FOLLOWING, SEARCH, THE NOTIFICATION CENTRE, PRIVACY, BLOCK AND REPORT
 * (pass 3, 2026-11-21). The owner's list, 2026-11-20: "follow someone, set
 * my account private, accept (or decline) a follow request when private,
 * block someone, see only who I follow in my feed, turn notifications on
 * or off per person, a notification centre"; "search function"; "we will
 * need a report func to comply w/ apple".
 *
 * THE LOOK, after his read of the first version (2026-11-21): no tinted
 * rows ("not a fan of this yellow backdrop"), no boxed buttons on a line
 * that can simply be pressed ("we don't need the follow button on the
 * search ... let us just click on the rower"), no labels a rower does not
 * need ("we do not need to label if an account is private"). So: paper,
 * hairlines between lines, the grey number and the bold name as on the
 * board, and the blue kept for the one thing to press.
 *
 * Every rule about who sees what is the server's (lib/rowSocial.ts there);
 * these screens only ask and draw the answer. */

const num3 = (n: number) => String(n).padStart(3, "0");
/* In a browser the field must not draw the browser's own focus ring. */
const WEB_NO_RING = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as object;

/* ---- pieces ---------------------------------------------------------- */

/* A small button: the blue one acts, the outlined one is the way out. */
export function Small({ label, onPress, fill, disabled }: { label: string; onPress: () => void; fill?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={4} style={({ pressed }) => ({ height: 32, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1.5, borderColor: fill ? C.accent : C.gray, backgroundColor: fill ? C.accent : "transparent", opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}>
      <Text style={mono(10, true, fill ? "#fff" : C.ink, 0.12)}>{label}</Text>
    </Pressable>
  );
}

/* FOLLOW (the blue), REQUESTED (a private rower has been asked; a press
 * takes it back), FOLLOWING (a press stops). The server answers how the
 * two now stand and the caller redraws from that. */
export function FollowButton({ num, state, onChange }: { num: number; state: Rel["following"]; onChange: (r: { rel: Rel; counts: Counts }) => void }) {
  const { me, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  if (!me.me) return null;
  const press = async () => {
    setBusy(true);
    try {
      onChange(await api<{ rel: Rel; counts: Counts }>("/api/row100k/app/follow", { body: { num, action: state === "none" ? "follow" : "unfollow" } }));
      refresh();
    } catch {
      /* The button stays as it was; a second press tries again. */
    }
    setBusy(false);
  };
  return <Small label={state === "none" ? "Follow" : state === "pending" ? "Requested" : "Following"} fill={state === "none"} disabled={busy} onPress={press} />;
}

/* One rower in a list: the grey number, the bold name, the handle under
 * it, and whatever the list puts at the right. The whole line opens them. */
function PersonLine({ p, onRower, right, share }: { p: { rowerNumber: number; numStr: string; name: string; instagram: string; avatar?: string | null }; onRower: (n: number) => void; right?: ReactNode; share?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, borderBottomWidth: 1, borderColor: C.line }}>
      {share !== undefined ? <Wash share={share} /> : null}
      <Avatar uri={p.avatar} name={p.name} size={36} />
      <Pressable accessibilityRole="link" accessibilityLabel={`${p.name}, rower ${p.numStr}`} onPress={() => onRower(p.rowerNumber)} style={({ pressed }) => ({ flex: 1, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
        <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{p.numStr} · </Text>
          {p.name}
        </Text>
        {p.instagram ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray, marginTop: 3 }}>@{p.instagram}</Text> : null}
      </Pressable>
      {right}
    </View>
  );
}

/* THE BAR BEHIND A LINE of the opening list on the search tab (owner,
 * 2026-11-22: "bars that fill up kind of like the board ... the bar full
 * for the first one and then a proportion of that for all the others").
 * The board's own wash, grown in from the left once. */
function Wash({ share }: { share: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: Math.max(0, Math.min(1, share)), duration: 800, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: false }).start();
  }, [a, share]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: -20, right: -20, top: 0, bottom: 0 }}>
      <Animated.View style={{ height: "100%", backgroundColor: C.wash, width: a.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

/* A sheet that comes up from the foot of the screen, for a short choice. */
export function Sheet({ title, right, onClose, children }: { title: string; right?: string; onClose: () => void; children: ReactNode }) {
  /* UP FROM THE FOOT (owner, 2026-11-22: "especially when we click these
   * three dots ... it animates up from the bottom. So let's make sure we
   * animate up from the bottom"): the shade fades in while the sheet rises. */
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [a]);
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", opacity: a }}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View style={{ backgroundColor: C.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34, width: "100%", maxWidth: 560, alignSelf: "center", transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderColor: C.ink, paddingBottom: 8, marginBottom: 6 }}>
            <Text style={mono(11, true)}>{title}</Text>
            {right ? (
              <Text numberOfLines={1} style={[mono(11, false, C.gray), { flexShrink: 1, marginLeft: 12 }]}>
                {right}
              </Text>
            ) : null}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* A line of a sheet that does something. */
function Act({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 52, justifyContent: "center", borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontFamily: F.bold, fontSize: 16, color: danger ? C.accent : C.ink }}>{label}</Text>
    </Pressable>
  );
}

/* THE SWITCH (owner, 2026-11-21, of a square one: "these buttons still are
 * looking a little silly ... let's make them like the Apple on-offs, but I
 * don't want it to be green ... they should be like a little oval ...
 * really just what Instagram's buttons look like. Let's just copy that").
 * A pill with a round knob that slides: white with a dark knob when off,
 * the blue with a white knob when on. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const a = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: on ? 1 : 0, duration: 160, useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, on]);
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={() => onChange(!on)} hitSlop={10} style={{ width: 52, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: on ? C.accent : C.gray, backgroundColor: on ? C.accent : "#fff", justifyContent: "center" }}>
      <Animated.View style={{ width: 22, height: 22, borderRadius: 11, marginLeft: 2.5, backgroundColor: on ? "#fff" : "#15171a", transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }] }} />
    </Pressable>
  );
}

/* ---- search ---------------------------------------------------------- */

/* SEARCH (owner, 2026-11-20: "search function"; 2026-11-21: "rower 01,
 * first name, last name, meters, Instagram handle. That's it"): one field,
 * the roster under it. A name, a handle or a rower number.
 *
 * As it stands after his read of 2026-11-22: the FIELD is in the app's top
 * bar, where the mark is on other tabs ("maybe that's where the search text
 * box actually goes"); the keyboard waits to be asked for ("let's not open
 * up the keyboard right when we click the search button") and goes away
 * when the list is dragged ("the same behavior as Instagram"). With
 * nothing typed: the rowers lately opened from here ("a recent section,
 * just like Instagram search"), then the ten with the most lifetime
 * meters, wearing the board's bars. A line opens the rower. */
export function SearchScreen({ text, onRower }: { text: string; onRower: (n: number) => void }) {
  const TOP = "/api/row100k/app/people?q=";
  const [q, setQ] = useState("");
  /* The opening list is read as the app starts (App.tsx), so it is here. */
  const top = peek<{ people: Person[] }>(TOP)?.people ?? null;
  const [found, setFound] = useState<Person[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<Person[]>([]);
  const [, bump] = useState(0);
  const turn = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(RECENT)
      .then((raw) => setRecent(raw ? (JSON.parse(raw) as Person[]) : []))
      .catch(() => null);
    /* The ten, if the app has not read them yet. */
    if (!top) api(TOP).then(() => bump((n) => n + 1), () => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The roster is read a beat after the typing stops, and only the last
   * answer asked for is drawn. Cleared, the ten are back AT ONCE, with
   * nothing of the last search left on screen (owner, 2026-11-22: "I hit
   * clear, and for a second, the bars come back, and then it swaps"). */
  useEffect(() => {
    const t = text.trim();
    if (!t) {
      turn.current++;
      setQ("");
      setFound(null);
      return;
    }
    const wait = setTimeout(() => setQ(t), 220);
    return () => clearTimeout(wait);
  }, [text]);
  useEffect(() => {
    if (!q) return;
    const mine = ++turn.current;
    api<{ people: Person[]; more?: boolean }>(`/api/row100k/app/people?q=${encodeURIComponent(q)}`)
      .then((r) => {
        if (mine !== turn.current) return;
        setFound(r.people);
        setMore(!!r.more);
        setError("");
      })
      .catch((err) => {
        if (mine === turn.current) setError(err instanceof Error ? err.message : "That could not be read.");
      });
  }, [q]);

  /* A rower opened from here is remembered on the phone, newest first. */
  const open = (p: Person) => {
    const next = [p, ...recent.filter((r) => r.rowerNumber !== p.rowerNumber)].slice(0, 8);
    setRecent(next);
    AsyncStorage.setItem(RECENT, JSON.stringify(next)).catch(() => null);
    onRower(p.rowerNumber);
  };
  const forget = () => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT).catch(() => null);
  };

  const searching = text.trim() !== "";
  const list = searching ? found : top;
  const head = (label: string, right?: ReactNode) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 18, paddingBottom: 8 }}>
      <Text style={mono(11, true)}>{label}</Text>
      {right}
    </View>
  );
  const meters = (p: Person) =>
    p.meters !== null ? (
      <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>
        {fmtInt(p.meters)} <Text style={{ color: C.gray }}>m</Text>
      </Text>
    ) : null;

  if (!list) return <Waiting error={error} />;
  return (
    <FlatList
      data={list}
      keyExtractor={(p) => String(p.rowerNumber)}
      /* A drag on the list puts the keyboard away, and a press on a line
         goes through with it still up. */
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 124 }}
      ListHeaderComponent={
        searching ? undefined : (
          <View>
            {recent.length ? (
              <>
                {head("Recent", <Ctl label="Clear" onPress={forget} />)}
                {recent.map((p) => (
                  <PersonLine key={p.rowerNumber} p={p} onRower={() => open(p)} />
                ))}
              </>
            ) : null}
            {head("Most meters, all time")}
          </View>
        )
      }
      renderItem={({ item }) => <PersonLine p={item} onRower={() => open(item)} share={!searching && list[0]?.meters ? (item.meters ?? 0) / list[0].meters : undefined} right={meters(item)} />}
      ListEmptyComponent={<Text style={[mono(11, false, C.gray), { paddingVertical: 20 }]}>Nobody by that name, handle or number.</Text>}
      ListFooterComponent={more && searching ? <Text style={[mono(11, false, C.gray), { paddingVertical: 20 }]}>More than this match. Type a little more.</Text> : undefined}
    />
  );
}
const RECENT = "search/recent/1";

/* ---- followers, following, requests, blocked ------------------------- */

export type PeopleList = "followers" | "following" | "requests" | "blocked" | "muted";

/* A list of rowers: who follows one, who they follow (owner, 2026-11-20:
 * "anyone can see who a rower follows and who follows them"), and the
 * viewer's own two: requests to answer, and the rowers they have blocked. */
export function PeopleScreen({ list, num, onRower }: { list: PeopleList; num?: number; onRower: (n: number) => void }) {
  const { refresh, me } = useSession();
  const path = `/api/row100k/app/people?list=${list}${num ? `&num=${num}` : ""}`;
  const { data, error, loading, reload } = useLoad(() => api<{ people: Person[] }>(path), [path], path);
  /* My own FOLLOWING list is where I stop following (owner, 2026-11-21:
   * "when I'm on my profile and I click following ... I should be able to
   * unfollow from there"). What a press here changed, until read again. */
  const mineFollowing = list === "following" && num !== undefined && num === me.me?.rowerNumber;
  const [now, setNow] = useState<Record<number, FollowState>>({});
  const [busy, setBusy] = useState(0);
  if (!data) return <Waiting error={error} onRetry={reload} />;

  const act = async (n: number, path: string, body: Record<string, unknown>) => {
    setBusy(n);
    try {
      await api(path, { body: { num: n, ...body } });
      await reload();
      refresh();
    } catch {
      /* The line stays; the next press tries again. */
    }
    setBusy(0);
  };
  const empty = list === "followers" ? "No followers yet." : list === "following" ? "Not following anybody yet." : list === "requests" ? "No requests waiting." : list === "muted" ? "Nobody muted." : "Nobody blocked.";

  return (
    <FlatList
      data={data.people}
      keyExtractor={(p) => String(p.rowerNumber)}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 124 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}
      renderItem={({ item }) => (
        <PersonLine
          p={item}
          onRower={onRower}
          right={
            list === "requests" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Small label="Confirm" fill disabled={busy === item.rowerNumber} onPress={() => act(item.rowerNumber, "/api/row100k/app/follow", { action: "accept" })} />
                <Small label="Delete" disabled={busy === item.rowerNumber} onPress={() => act(item.rowerNumber, "/api/row100k/app/follow", { action: "decline" })} />
              </View>
            ) : list === "blocked" ? (
              <Small label="Unblock" disabled={busy === item.rowerNumber} onPress={() => act(item.rowerNumber, "/api/row100k/app/block", { on: false })} />
            ) : list === "muted" ? (
              <Small label="Unmute" disabled={busy === item.rowerNumber} onPress={() => act(item.rowerNumber, "/api/row100k/app/follow", { action: "mute", on: false })} />
            ) : mineFollowing ? (
              <FollowButton num={item.rowerNumber} state={now[item.rowerNumber] ?? item.following} onChange={(r) => setNow((m) => ({ ...m, [item.rowerNumber]: r.rel.following }))} />
            ) : null
          }
        />
      )}
      ListEmptyComponent={<Text style={[mono(11, false, C.gray), { paddingTop: 20 }]}>{empty}</Text>}
    />
  );
}

/* ---- the notification centre ----------------------------------------- */

/* NOTIFICATIONS (owner, 2026-11-20: "a notification centre lists them
 * all"). Newest first under a head for each day. A line leads where it is
 * about: a pass to the board, a follow to the rower. A request still
 * waiting carries CONFIRM and DELETE on its own line, at the right, the
 * way a phone's own apps lay one out (owner, 2026-11-21, of the first
 * version: "looks like a high school computer science student made it").
 * Unread lines wear a blue square. Opening the screen marks them read.
 * Nothing else lives here: settings are behind the menu on the profile. */
export function NewsScreen({ onRower, onRow, onBoard, onPeople }: { onRower: (n: number) => void; onRow: (id: string) => void; onBoard: () => void; onPeople: (list: PeopleList) => void }) {
  const { me, refresh } = useSession();
  const { data, error, loading, reload } = useLoad(() => api<{ items: Notice[]; unread: number }>("/api/row100k/app/notifications"), [], "/api/row100k/app/notifications");
  const marked = useRef(false);
  const [busy, setBusy] = useState(0);
  useEffect(() => {
    if (!data || marked.current) return;
    marked.current = true;
    if (data.unread > 0) api("/api/row100k/app/notifications", { body: { read: true } }).then(refresh, () => null);
  }, [data, refresh]);

  if (!data) return <Waiting error={error} onRetry={reload} />;
  const answer = async (n: number, action: "accept" | "decline") => {
    setBusy(n);
    try {
      await api("/api/row100k/app/follow", { body: { num: n, action } });
    } catch {
      /* Read again either way: the line says what is true. */
    }
    await reload();
    refresh();
    setBusy(0);
  };
  const open = (it: Notice) => (it.kind === "rowed" && it.entryId ? onRow(it.entryId) : it.kind === "passed" ? onBoard() : onRower(it.rowerNumber));
  const requests = me.social?.requests ?? 0;

  return (
    <FlatList
      data={data.items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 124 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}
      ListHeaderComponent={
        requests > 0 ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Follow requests, ${requests}`} onPress={() => onPeople("requests")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 58, borderBottomWidth: 1, borderColor: C.ink, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 16, color: C.ink }}>Follow requests</Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent, marginRight: 10 }}>{requests}</Text>
            <Text style={{ fontFamily: F.black, fontSize: 16, color: C.ink }}>→</Text>
          </Pressable>
        ) : undefined
      }
      renderItem={({ item, index }) => (
        <View>
          {index === 0 || data.items[index - 1].dayKey !== item.dayKey ? <Text style={[mono(11, false, C.gray, 0.14), { paddingTop: 22, paddingBottom: 4 }]}>{item.dayStr}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderBottomWidth: 1, borderColor: C.line }}>
            <View>
              <Avatar uri={item.avatar} name={item.name} size={36} />
              {item.unread ? <View style={{ position: "absolute", right: -2, top: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent, borderWidth: 2, borderColor: C.paper }} /> : null}
            </View>
            <Pressable accessibilityRole="link" accessibilityLabel={`${item.name} ${item.text}`} onPress={() => open(item)} style={({ pressed }) => ({ flex: 1, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 20, color: C.ink }}>
                <Text style={{ fontFamily: F.bold }}>{item.name}</Text> {item.text}
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.gray, marginTop: 3 }}>{item.clockStr}</Text>
            </Pressable>
            {item.open ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Small label="Confirm" fill disabled={busy === item.rowerNumber} onPress={() => answer(item.rowerNumber, "accept")} />
                <Small label="Delete" disabled={busy === item.rowerNumber} onPress={() => answer(item.rowerNumber, "decline")} />
              </View>
            ) : null}
          </View>
        </View>
      )}
      ListEmptyComponent={requests > 0 ? undefined : <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, paddingTop: 24 }}>Nothing yet. Follow a rower and you are told when they pass you on the board.</Text>}
    />
  );
}

/* ---- settings -------------------------------------------------------- */

const KIND: Record<string, [string, string]> = {
  passed: ["A rower I follow passes me", "At most one a day, however many passed."],
  follow: ["Somebody follows me", "Requests to follow a private account always arrive."],
};

/* SETTINGS, behind the three lines on the rower's own profile (owner,
 * 2026-11-21: "the settings should probably just be like ... how do they
 * have it on Instagram"). The account (private or not), the two kinds of
 * notification, the look of this phone, the blocked list, and the way out.
 * A change saves as it is made. */
export function SettingsScreen({ onPeople, onSignedOut }: { onPeople: (list: PeopleList) => void; onSignedOut: () => void }) {
  const { refresh, signOut, me } = useSession();
  const look = useLookSwitch();
  const { data, error, reload } = useLoad(() => api<{ settings: SocialSettings }>("/api/row100k/app/settings"), [], "/api/row100k/app/settings");
  const [s, setS] = useState<SocialSettings | null>(data?.settings ?? null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);

  /* The profile photo: one picture out of the library, sent, then named
   * as mine. `face` is "busy" while it goes, or what went wrong. */
  const [face, setFace] = useState("");
  const choose = async () => {
    setFace("");
    try {
      const got = await pickFace();
      if (!got) return;
      setFace("busy");
      await setAvatar(got);
      setS((await api<{ settings: SocialSettings }>("/api/row100k/app/settings")).settings);
      refresh();
      setFace("");
    } catch (err) {
      setFace(err instanceof Error ? err.message : "That photo did not go up.");
    }
  };

  const save = async (body: { isPrivate?: boolean; notifyOff?: string[]; avatarKey?: null }) => {
    if (!s) return;
    const before = s;
    setS({ ...s, ...(body.avatarKey === null ? { avatar: null } : body) });
    setFailed("");
    try {
      setS((await api<{ settings: SocialSettings }>("/api/row100k/app/settings", { body })).settings);
      refresh();
    } catch (err) {
      setS(before);
      setFailed(err instanceof Error ? err.message : "That did not save.");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 140 }}>
      {s ? (
        <>
          <Eye style={{ marginTop: 0, marginBottom: 0 }} left="Profile photo" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
            <Avatar uri={s.avatar} name={me.me?.displayName ?? ""} size={64} />
            <View style={{ flex: 1, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Small label={face === "busy" ? "Sending" : s.avatar ? "Change photo" : "Add a photo"} fill disabled={face === "busy"} onPress={choose} />
                {s.avatar ? <Small label="Remove" disabled={face === "busy"} onPress={() => save({ avatarKey: null })} /> : null}
              </View>
              <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray }}>{face && face !== "busy" ? face : "Shown beside your name. Without one, your initials are."}</Text>
            </View>
          </View>

          <Eye style={{ marginBottom: 0 }} left="Account" />
          <Setting title="Private account" body="Your rows and photos are shown only to followers you accept. You stay on the board, and your page keeps your totals." on={s.isPrivate} onChange={(v) => save({ isPrivate: v })} />
          {failed ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{failed}</Text> : null}

          <Eye style={{ marginBottom: 0 }} left="Notifications" right="From rowers you follow" />
          {s.kinds.map((k) => (
            <Setting key={k} title={KIND[k]?.[0] ?? k} body={KIND[k]?.[1] ?? ""} on={!s.notifyOff.includes(k)} onChange={(v) => save({ notifyOff: v ? s.notifyOff.filter((x) => x !== k) : [...s.notifyOff, k] })} />
          ))}
          <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 12 }}>Notifications are off for a rower until you turn them on, from the three dots on their page or on one of their rows.</Text>
        </>
      ) : (
        <Waiting error={error} onRetry={reload} />
      )}

      <Eye style={{ marginBottom: 0 }} left="This phone" />
      <Setting title="Dark mode" body="Ink for the page, cream for the type. Only on this phone." on={look.dark} onChange={look.setDark} />

      <Eye style={{ marginBottom: 0 }} left="More" />
      <Act label="Muted rowers" onPress={() => onPeople("muted")} />
      <Act label="Blocked rowers" onPress={() => onPeople("blocked")} />
      <Act
        label="Sign out"
        onPress={async () => {
          await signOut();
          onSignedOut();
        }}
      />
    </ScrollView>
  );
}

/* A setting: what it is, what it does in a sentence, and its switch. */
function Setting({ title, body, on, onChange }: { title: string; body: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>{title}</Text>
        {body ? <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 4 }}>{body}</Text> : null}
      </View>
      <Toggle label={title} on={on} onChange={onChange} />
    </View>
  );
}

/* ---- the three dots on somebody else's profile ----------------------- */

/* WHAT CAN BE DONE ABOUT A ROWER (owner, 2026-11-21, of a MORE word beside
 * the follow button: "it's just in a weird spot. So maybe try those 3 dots
 * type of deal"): the three dots at the top right of their profile bring
 * up this sheet. Notifications from them (off until turned on: "it's off
 * by default"), mute, block and report for everybody; for the owner, DELETE THIS
 * ROWER ("I need to be able to delete a rower"), which takes the rower's
 * number typed out before it will go, because it takes their whole log
 * with them and cannot be undone here. */
export function RowerMenu({
  num,
  name,
  rel,
  adminId,
  onClose,
  onRel,
  onBlocked,
  onGone,
}: {
  num: number;
  name: string;
  /* How the viewer stands to them: following or not, the bell, muted. */
  rel: { following: FollowState; bell: boolean; muted?: boolean };
  adminId?: string | null;
  onClose: () => void;
  onRel: (r: { rel: Rel; counts: Counts }) => void;
  onBlocked: () => void;
  onGone: () => void;
}) {
  const [step, setStep] = useState<"" | "block" | "report" | "delete">("");
  /* Notifications from this rower, and muting them, are one press each. */
  const flip = async (body: Record<string, unknown>) => {
    try {
      onRel(await api<{ rel: Rel; counts: Counts }>("/api/row100k/app/follow", { body: { num, ...body } }));
    } catch {
      /* Nothing changed; the sheet closes and the page says what is true. */
    }
    onClose();
  };
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");

  const block = async () => {
    setBusy(true);
    try {
      await api("/api/row100k/app/block", { body: { num, on: true } });
      onBlocked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/row100k/participants/${adminId}`, { method: "DELETE" });
      onClose();
      onGone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    }
    setBusy(false);
  };

  if (step === "report") return <ReportSheet num={num} name={name} onClose={onClose} />;
  return (
    <Sheet title={step === "block" ? "Block this rower" : step === "delete" ? "Delete this rower" : "This rower"} right={`${num3(num)} · ${name}`} onClose={onClose}>
      {step === "" ? (
        <>
          {rel.following === "accepted" ? <Act label={rel.bell ? "Turn off notifications" : "Turn on notifications"} onPress={() => flip({ action: "bell", on: !rel.bell })} /> : null}
          <Act label={rel.muted ? "Unmute" : "Mute"} onPress={() => flip({ action: "mute", on: !rel.muted })} />
          <Act label="Block" onPress={() => setStep("block")} />
          <Act label="Report" onPress={() => setStep("report")} />
          {adminId ? (
            <Act
              label="Remove their profile photo"
              danger
              onPress={async () => {
                await api("/api/row100k/app/moderate", { body: { avatarOf: adminId } }).catch(() => null);
                onBlocked();
                onClose();
              }}
            />
          ) : null}
          {adminId ? <Act label="Delete this rower" danger onPress={() => setStep("delete")} /> : null}
        </>
      ) : step === "block" ? (
        <>
          <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 10 }}>You will not see each other's rows or pages, and neither of you will follow the other. You both stay on the board. They are not told.</Text>
          {error ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{error}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Small label="Cancel" onPress={onClose} />
            <Small label={busy ? "Blocking" : "Block"} fill disabled={busy} onPress={block} />
          </View>
        </>
      ) : (
        <>
          <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 10 }}>
            This removes {name} from the challenge with every row they have logged, in every month. It cannot be undone from here. Type their rower number, {num3(num)}, to go ahead.
          </Text>
          <TextInput
            accessibilityLabel="The rower's number"
            value={typed}
            onChangeText={setTyped}
            keyboardType="number-pad"
            placeholder={num3(num)}
            placeholderTextColor={C.line}
            style={[{ marginTop: 14, borderBottomWidth: 2, borderColor: C.ink, fontFamily: F.black, fontSize: 28, color: C.ink, paddingVertical: 6 }, WEB_NO_RING]}
          />
          {error ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{error}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Small label="Cancel" onPress={onClose} />
            <Small label={busy ? "Deleting" : "Delete this rower"} fill disabled={busy || Number(typed) !== num || typed.trim() === ""} onPress={remove} />
          </View>
        </>
      )}
    </Sheet>
  );
}

/* WHAT CAN BE DONE ABOUT A ROW (owner, 2026-11-21: "on each one of these
 * rows, let's also give those three dots ... I want to steal Strava's
 * things ... turn on notifications, mute, unfollow, report"). The same
 * sheet comes up from the dots on a row in the feed, from the dots over
 * its photos, and from the dots at the top of the row's own page.
 *
 * For anybody: the rower's page, follow or unfollow, notifications from
 * them, mute, report the row. For the owner, the tools he asked not to
 * have sitting at the foot of the page ("that doesn't belong there"):
 * remove one photo, or the row. */
export type RowMenuRow = { id: string; rowerNumber: number; name: string; mine: boolean; photos: number; rel: { following: FollowState; bell: boolean; muted?: boolean } };
export type RowMenuChange = "rel" | "muted" | "blocked" | "row-gone" | "photo";
export function RowMenu({ row, onClose, onRower, onRow, onShare, onChange }: { row: RowMenuRow; onClose: () => void; onRower?: (n: number) => void; onRow?: (id: string) => void; onShare?: () => void; onChange: (what: RowMenuChange, rel?: { following: FollowState; bell: boolean }) => void }) {
  const { me, refresh } = useSession();
  const [step, setStep] = useState<"" | "report" | "row" | number>("");
  const num = row.rowerNumber;
  const go = async (body: Record<string, unknown>, what: RowMenuChange) => {
    try {
      const r = await api<{ rel: Rel }>("/api/row100k/app/follow", { body: { num, ...body } });
      onChange(what, { following: r.rel.following, bell: r.rel.bell });
      refresh();
    } catch {
      /* Nothing changed. */
    }
    onClose();
  };
  if (step === "report") return <ReportSheet num={num} name={row.name} entryId={row.id} onClose={onClose} />;
  if (step === "row")
    return (
      <ConfirmSheet
        title="Remove this row"
        body={`This takes the row off the feed, off ${row.name}'s page and out of their total. It cannot be undone from here.`}
        yes="Remove the row"
        onClose={onClose}
        onYes={async () => {
          await api(`/api/row100k/rows/${row.id}`, { method: "DELETE" });
          onChange("row-gone");
        }}
      />
    );
  if (typeof step === "number")
    return (
      <ConfirmSheet
        title={`Remove photo ${step + 1}`}
        body="The row, its meters and its other photo stay. The photo cannot be put back from here."
        yes="Remove the photo"
        onClose={onClose}
        onYes={async () => {
          await api("/api/row100k/app/moderate", { body: { entryId: row.id, photo: step } });
          onChange("photo");
        }}
      />
    );
  const others = !row.mine && !!me.me;
  return (
    <Sheet title="This row" right={`${num3(num)} · ${row.name}`} onClose={onClose}>
      {onShare && (row.mine || me.isAdmin) ? (
        <Act
          label="Share"
          onPress={() => {
            onClose();
            onShare();
          }}
        />
      ) : null}
      {!me.me ? <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.gray, paddingVertical: 12 }}>Sign in to follow this rower or report this row.</Text> : null}
      {onRow ? (
        <Act
          label="Open the row"
          onPress={() => {
            onClose();
            onRow(row.id);
          }}
        />
      ) : null}
      {onRower ? (
        <Act
          label={row.mine ? "Go to your page" : `Go to ${row.name}'s page`}
          onPress={() => {
            onClose();
            onRower(num);
          }}
        />
      ) : null}
      {others ? (
        <>
          {row.rel.following === "none" ? <Act label="Follow" onPress={() => go({ action: "follow" }, "rel")} /> : null}
          {row.rel.following === "accepted" ? <Act label={row.rel.bell ? "Turn off notifications" : "Turn on notifications"} onPress={() => go({ action: "bell", on: !row.rel.bell }, "rel")} /> : null}
          <Act label={row.rel.muted ? "Unmute" : "Mute"} onPress={() => go({ action: "mute", on: !row.rel.muted }, row.rel.muted ? "rel" : "muted")} />
          {row.rel.following !== "none" ? <Act label={row.rel.following === "pending" ? "Take back the follow request" : "Unfollow"} onPress={() => go({ action: "unfollow" }, "rel")} /> : null}
          <Act label="Report" onPress={() => setStep("report")} />
        </>
      ) : null}
      {me.isAdmin ? (
        <>
          <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 18 }]}>Owner</Text>
          {Array.from({ length: row.photos }, (_, i) => (
            <Act key={i} label={`Remove photo ${i + 1}`} danger onPress={() => setStep(i)} />
          ))}
          <Act label="Remove this row" danger onPress={() => setStep("row")} />
        </>
      ) : null}
    </Sheet>
  );
}

/* A question with one way forward and one way back, for the owner's tools
 * on a row. */
export function ConfirmSheet({ title, body, yes, onYes, onClose }: { title: string; body: string; yes: string; onYes: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await onYes();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
      setBusy(false);
    }
  };
  return (
    <Sheet title={title} onClose={onClose}>
      <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 10 }}>{body}</Text>
      {error ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{error}</Text> : null}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Small label="Cancel" onPress={onClose} />
        <Small label={busy ? "Working" : yes} fill disabled={busy} onPress={go} />
      </View>
    </Sheet>
  );
}

/* ---- report ---------------------------------------------------------- */

const REASONS: [string, string][] = [
  ["photo", "A photo that should not be here"],
  ["fake", "A row that was not rowed"],
  ["abuse", "Harassment or hate"],
  ["spam", "Spam"],
  ["other", "Something else"],
];

/* REPORT (owner, 2026-11-20: "we will need a report func to comply w/
 * apple"): a rower, or one row with its photos. Why, a line if there is
 * more to say, and it goes to the owner. The rower is not told. */
export function ReportSheet({ num, name, entryId, onClose }: { num: number; name: string; entryId?: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"" | "busy" | "sent">("");
  const [error, setError] = useState("");
  const send = async () => {
    setState("busy");
    setError("");
    try {
      await api("/api/row100k/app/report", { body: { num, entryId, reason, note } });
      setState("sent");
    } catch (err) {
      setState("");
      setError(err instanceof Error ? err.message : "That did not go through.");
    }
  };
  return (
    <Sheet title={entryId ? "Report this row" : "Report this rower"} right={`${num3(num)} · ${name}`} onClose={onClose}>
      {state === "sent" ? (
        <>
          <Text style={{ fontFamily: F.black, fontSize: 28, color: C.ink, marginTop: 14 }}>Sent.</Text>
          <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 8 }}>It has gone to the people who run ROW. The rower is not told who reported them.</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 20 }}>
            <Small label="Done" fill onPress={onClose} />
          </View>
        </>
      ) : (
        <>
          {REASONS.map(([key, label]) => (
            <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: reason === key }} onPress={() => setReason(key)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46 }}>
              <View style={{ width: 16, height: 16, borderWidth: 2, borderColor: reason === key ? C.accent : C.ink, backgroundColor: reason === key ? C.accent : "transparent" }} />
              <Text style={{ fontFamily: reason === key ? F.bold : F.sans, fontSize: 15, color: C.ink }}>{label}</Text>
            </Pressable>
          ))}
          <TextInput
            accessibilityLabel="Anything to add"
            value={note}
            onChangeText={setNote}
            maxLength={500}
            multiline
            placeholder="Anything to add (optional)"
            placeholderTextColor={C.gray}
            style={[{ marginTop: 10, minHeight: 64, borderWidth: 1, borderColor: C.line, padding: 10, fontFamily: F.sans, fontSize: 15, color: C.ink, textAlignVertical: "top" }, WEB_NO_RING]}
          />
          {error ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{error}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <Small label="Cancel" onPress={onClose} />
            <Small label={state === "busy" ? "Sending" : "Send report"} fill disabled={!reason || state === "busy"} onPress={send} />
          </View>
        </>
      )}
    </Sheet>
  );
}
