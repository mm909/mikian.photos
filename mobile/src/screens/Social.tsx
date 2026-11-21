import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { api, type Counts, type Notice, type Person, type Rel, type SocialSettings } from "../api";
import { useSession } from "../session";
import { Ctl, Dash, Eye, TINT, mono } from "../site";
import { C, F } from "../theme";
import { Waiting, useLoad } from "../ui";

/* FOLLOWING, SEARCH, THE NOTIFICATION CENTRE, PRIVACY, BLOCK AND REPORT
 * (pass 3, 2026-11-21). The owner's list, 2026-11-20: "follow someone, set
 * my account private, accept (or decline) a follow request when private,
 * block someone, see only who I follow in my feed, turn notifications on
 * or off per person, a notification centre"; "search function"; "we will
 * need a report func to comply w/ apple".
 *
 * The website has none of this, so these are drawn from the site's pieces
 * (site.tsx): mono capitals, ink rules, the tinted table row with its grey
 * number and bold name, the blue for the one thing to press.
 *
 * Every rule about who sees what is the server's (lib/rowSocial.ts there);
 * these screens only ask and draw the answer. */

const num3 = (n: number) => String(n).padStart(3, "0");

/* In a browser only: the switch keeps a white thumb when it is on, and the
 * search field does not draw the browser's own focus ring over the rule. */
const WEB_SWITCH = (Platform.OS === "web" ? { activeThumbColor: "#fff" } : {}) as object;
const WEB_NO_RING = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as object;

/* ---- the two glyphs in the top bar ----------------------------------- */

export function SearchGlyph({ color = C.ink }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Circle cx={9.5} cy={9.5} r={6} stroke={color} strokeWidth={2} fill="none" />
      <Line x1={14} y1={14} x2={20} y2={20} stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}

/* The bell, with how many lines are waiting. */
export function BellGlyph({ count = 0, color = C.ink }: { count?: number; color?: string }) {
  return (
    <View>
      <Svg width={22} height={22} viewBox="0 0 22 22">
        <Path d="M4 16 V10 a7 7 0 0 1 14 0 V16 Z" stroke={color} strokeWidth={2} fill="none" strokeLinejoin="miter" />
        <Line x1={2} y1={16} x2={20} y2={16} stroke={color} strokeWidth={2} />
        <Line x1={9} y1={20} x2={13} y2={20} stroke={color} strokeWidth={2} />
      </Svg>
      {count > 0 ? (
        <View style={{ position: "absolute", top: -6, right: -9, minWidth: 17, height: 17, paddingHorizontal: 4, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: F.monoBold, fontSize: 10, color: "#fff" }}>{count > 99 ? "99" : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ---- follow ---------------------------------------------------------- */

/* One press each way: FOLLOW (the blue), REQUESTED (a private rower has
 * been asked; a press takes it back), FOLLOWING (a press stops). The
 * server answers how the two now stand and the caller redraws from that. */
export function FollowButton({ num, state, small, onChange }: { num: number; state: Rel["following"]; small?: boolean; onChange: (r: { rel: Rel; counts: Counts }) => void }) {
  const { me, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!me.me) return null;
  const press = async () => {
    setBusy(true);
    setError("");
    try {
      onChange(await api<{ rel: Rel; counts: Counts }>("/api/row100k/app/follow", { body: { num, action: state === "none" ? "follow" : "unfollow" } }));
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    }
    setBusy(false);
  };
  const on = state === "none";
  const label = state === "none" ? "Follow" : state === "pending" ? "Requested" : "Following";
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state === "none" ? "Follow" : state === "pending" ? "Requested. Press to take the request back" : "Following. Press to stop"}
        disabled={busy}
        onPress={press}
        style={({ pressed }) => ({ minHeight: small ? 34 : 40, paddingHorizontal: small ? 10 : 16, justifyContent: "center", borderWidth: 2, borderColor: on ? C.accent : state === "pending" ? C.gray : C.ink, backgroundColor: on ? C.accent : "transparent", opacity: pressed || busy ? 0.6 : 1 })}
      >
        <Text style={mono(small ? 10 : 12, true, on ? "#fff" : state === "pending" ? C.gray : C.ink, 0.12)}>{label}</Text>
      </Pressable>
      {error ? <Text style={[mono(10, false, C.gray, 0.08), { marginTop: 4, maxWidth: 160 }]}>{error}</Text> : null}
    </View>
  );
}

/* One rower in a list of people: the grey number, the bold name, a quiet
 * word under it, and whatever the list puts at the right. */
function PersonLine({ p, onRower, right }: { p: Person; onRower: (n: number) => void; right?: ReactNode }) {
  const sub = [p.instagram ? `@${p.instagram}` : "", p.isPrivate ? "Private" : "", p.followsYou === "accepted" ? "Follows you" : ""].filter(Boolean).join(" · ");
  return (
    <View style={{ backgroundColor: p.me ? C.pale : TINT }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 9, minHeight: 56, gap: 10 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`${p.name}, rower ${p.numStr}`} onPress={() => onRower(p.rowerNumber)} style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray, fontVariant: ["tabular-nums"] }}>{p.numStr}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray, marginHorizontal: 7 }}>·</Text>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.ink }}>
              {p.name}
            </Text>
          </View>
          {sub ? <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 3 }]}>{sub}</Text> : null}
        </Pressable>
        {right}
      </View>
      <Dash />
    </View>
  );
}

/* ---- search ---------------------------------------------------------- */

/* SEARCH (owner, 2026-11-20: "search function"): one field, the roster
 * under it. A name, an Instagram handle or a rower number; nothing typed
 * lists everybody in number order. Each line carries its FOLLOW. */
export function SearchScreen({ onRower }: { onRower: (n: number) => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const turn = useRef(0);

  /* The roster is read a beat after the typing stops, and only the last
   * answer asked for is drawn. */
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 220);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    const mine = ++turn.current;
    api<{ people: Person[]; more?: boolean }>(`/api/row100k/app/people?q=${encodeURIComponent(q)}`)
      .then((r) => {
        if (mine !== turn.current) return;
        setPeople(r.people);
        setMore(!!r.more);
        setError("");
      })
      .catch((err) => {
        if (mine === turn.current) setError(err instanceof Error ? err.message : "That could not be read.");
      });
  }, [q]);

  const change = (n: number, rel: Rel) => setPeople((prev) => (prev ?? []).map((p) => (p.rowerNumber === n ? { ...p, following: rel.following } : p)));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8, gap: 10 }}>
          <SearchGlyph />
          <TextInput
            accessibilityLabel="Search rowers by name, Instagram or number"
            value={text}
            onChangeText={setText}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            placeholder="Name, @handle or number"
            placeholderTextColor={C.gray}
            style={[{ flex: 1, fontFamily: F.bold, fontSize: 18, color: C.ink, paddingVertical: 6 }, WEB_NO_RING]}
          />
          {text ? <Ctl label="Clear" onPress={() => setText("")} /> : null}
        </View>
        <Text style={[mono(11, false, C.gray), { marginTop: 12, marginBottom: 10 }]}>{people ? (q ? `${people.length}${more ? "+" : ""} ${people.length === 1 ? "rower" : "rowers"}` : "Every rower, by number") : " "}</Text>
      </View>
      {!people ? (
        <Waiting error={error} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => String(p.rowerNumber)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => <PersonLine p={item} onRower={onRower} right={item.me ? null : <FollowButton small num={item.rowerNumber} state={item.following} onChange={(r) => change(item.rowerNumber, r.rel)} />} />}
          ListEmptyComponent={<Text style={[mono(11, false, C.gray), { paddingVertical: 20 }]}>Nobody by that name, handle or number.</Text>}
          ListFooterComponent={more ? <Text style={[mono(11, false, C.gray), { paddingVertical: 20 }]}>More than this match. Type a little more.</Text> : undefined}
        />
      )}
    </View>
  );
}

/* ---- followers, following, requests, blocked ------------------------- */

export type PeopleList = "followers" | "following" | "requests" | "blocked";

/* A list of rowers: who follows one, who they follow (owner, 2026-11-20:
 * "anyone can see who a rower follows and who follows them"), and the
 * viewer's own two: requests to answer, and the rowers they have blocked. */
export function PeopleScreen({ list, num, onRower }: { list: PeopleList; num?: number; onRower: (n: number) => void }) {
  const { refresh } = useSession();
  const { data, error, loading, reload } = useLoad(() => api<{ people: Person[] }>(`/api/row100k/app/people?list=${list}${num ? `&num=${num}` : ""}`), [list, num]);
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
  const empty = list === "followers" ? "No followers yet." : list === "following" ? "Not following anybody yet." : list === "requests" ? "No requests waiting." : "Nobody blocked.";

  return (
    <FlatList
      data={data.people}
      keyExtractor={(p) => String(p.rowerNumber)}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}
      ListHeaderComponent={<Eye style={{ marginTop: 0 }} left={list === "requests" ? "Follow requests" : list} right={`${data.people.length}`} />}
      renderItem={({ item }) => (
        <PersonLine
          p={item}
          onRower={onRower}
          right={
            list === "requests" ? (
              <View style={{ flexDirection: "row", gap: 8, opacity: busy === item.rowerNumber ? 0.5 : 1 }}>
                <Small label="Accept" fill onPress={() => act(item.rowerNumber, "/api/row100k/app/follow", { action: "accept" })} />
                <Small label="Decline" onPress={() => act(item.rowerNumber, "/api/row100k/app/follow", { action: "decline" })} />
              </View>
            ) : list === "blocked" ? (
              <Small label="Unblock" onPress={() => act(item.rowerNumber, "/api/row100k/app/block", { on: false })} />
            ) : item.me ? null : (
              <FollowButton small num={item.rowerNumber} state={item.following} onChange={() => reload()} />
            )
          }
        />
      )}
      ListEmptyComponent={<Text style={mono(11, false, C.gray)}>{empty}</Text>}
    />
  );
}

/* A small outlined button for a line in a list. */
function Small({ label, onPress, fill }: { label: string; onPress: () => void; fill?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 34, paddingHorizontal: 10, justifyContent: "center", borderWidth: 2, borderColor: fill ? C.accent : C.ink, backgroundColor: fill ? C.accent : "transparent", opacity: pressed ? 0.6 : 1 })}>
      <Text style={mono(10, true, fill ? "#fff" : C.ink, 0.12)}>{label}</Text>
    </Pressable>
  );
}

/* ---- the notification centre ----------------------------------------- */

/* NOTIFICATIONS (owner, 2026-11-20: "a notification centre lists them
 * all"). Newest first under a head for each day, the way the feed heads
 * its days. A line leads where it is about: a row to its page, a pass to
 * the board, a follow to the rower. A request still waiting carries its
 * two buttons. Opening the screen marks everything read. */
export function NewsScreen({ onRower, onRow, onBoard, onPeople, onSettings }: { onRower: (n: number) => void; onRow: (id: string) => void; onBoard: () => void; onPeople: (list: PeopleList) => void; onSettings: () => void }) {
  const { me, refresh } = useSession();
  const { data, error, loading, reload } = useLoad(() => api<{ items: Notice[]; unread: number }>("/api/row100k/app/notifications"), []);
  const marked = useRef(false);
  useEffect(() => {
    if (!data || marked.current) return;
    marked.current = true;
    if (data.unread > 0) api("/api/row100k/app/notifications", { body: { read: true } }).then(refresh, () => null);
  }, [data, refresh]);

  if (!data) return <Waiting error={error} onRetry={reload} />;
  const answer = async (n: number, action: "accept" | "decline") => {
    try {
      await api("/api/row100k/app/follow", { body: { num: n, action } });
    } catch {
      /* Read again either way: the line says what is true. */
    }
    await reload();
    refresh();
  };
  const open = (it: Notice) => (it.kind === "rowed" && it.entryId ? onRow(it.entryId) : it.kind === "passed" ? onBoard() : onRower(it.rowerNumber));
  const requests = me.social?.requests ?? 0;

  return (
    <FlatList
      data={data.items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}
      ListHeaderComponent={
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 10 }}>
          {requests > 0 ? <Ctl label={`${requests} follow ${requests === 1 ? "request" : "requests"} →`} onPress={() => onPeople("requests")} /> : <Text style={mono(11, true)}>Notifications</Text>}
          <Ctl label="Settings" onPress={onSettings} />
        </View>
      }
      renderItem={({ item, index }) => (
        <View>
          {index === 0 || data.items[index - 1].dayKey !== item.dayKey ? <Text style={[mono(11, true, C.ink, 0.14), { paddingTop: 22, paddingBottom: 8 }]}>{item.dayStr}</Text> : null}
          <View style={{ backgroundColor: item.unread ? C.pale : TINT }}>
            <Pressable accessibilityRole="link" accessibilityLabel={`${item.name} ${item.text}`} onPress={() => open(item)} style={({ pressed }) => ({ paddingHorizontal: 8, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.ink }}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{item.numStr} · </Text>
                <Text style={{ fontFamily: F.bold }}>{item.name}</Text> {item.text}
              </Text>
              <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 4 }]}>
                {item.clockStr}
                {item.kind === "rowed" ? "  ·  Open the row →" : item.kind === "passed" ? "  ·  Open the board →" : ""}
              </Text>
            </Pressable>
            {item.open ? (
              <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingBottom: 12 }}>
                <Small label="Accept" fill onPress={() => answer(item.rowerNumber, "accept")} />
                <Small label="Decline" onPress={() => answer(item.rowerNumber, "decline")} />
              </View>
            ) : null}
            <Dash />
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={[mono(11, false, C.gray, 0.12), { paddingTop: 22, lineHeight: 18 }]}>Nothing yet. Follow a rower and you are told when they row, and when they pass you on the board.</Text>}
    />
  );
}

/* ---- settings -------------------------------------------------------- */

const KIND: Record<string, [string, string]> = {
  rowed: ["A rower I follow logs a row", "One line for each row, from the rowers whose bell is on."],
  passed: ["A rower I follow passes me", "At most one a day, however many passed."],
  follow: ["Somebody follows me", "Requests to follow a private account always arrive."],
};

/* PRIVACY AND NOTIFICATIONS (owner, 2026-11-20: "set my account private";
 * "notifications only from people he cares about"). One switch for the
 * account, one for each kind of notification, and the way to the list of
 * blocked rowers. A change saves as it is made. */
export function SettingsScreen({ onPeople }: { onPeople: (list: PeopleList) => void }) {
  const { refresh } = useSession();
  const { data, error, reload } = useLoad(() => api<{ settings: SocialSettings }>("/api/row100k/app/settings"), []);
  const [s, setS] = useState<SocialSettings | null>(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);
  if (!s) return <Waiting error={error} onRetry={reload} />;

  const save = async (body: { isPrivate?: boolean; notifyOff?: string[] }) => {
    const before = s;
    setS({ ...s, ...body });
    setFailed("");
    try {
      setS((await api<{ settings: SocialSettings }>("/api/row100k/app/settings", { body })).settings);
      refresh();
    } catch (err) {
      setS(before);
      setFailed(err instanceof Error ? err.message : "That did not save.");
    }
  };
  const flip = (kind: string, on: boolean) => save({ notifyOff: on ? s.notifyOff.filter((k) => k !== kind) : [...s.notifyOff, kind] });

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 56 }}>
      <Eye style={{ marginTop: 0 }} left="The account" />
      <Line2 title="Private account" body="Your rows and photos are shown only to followers you accept. You stay on the board, and your page keeps your totals: metres, hours, average split, sessions." on={s.isPrivate} onChange={(v) => save({ isPrivate: v })} />
      {failed ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{failed}</Text> : null}

      <Eye left="Notifications" right="From rowers you follow" />
      {s.kinds.map((k) => (
        <Line2 key={k} title={KIND[k]?.[0] ?? k} body={KIND[k]?.[1] ?? ""} on={!s.notifyOff.includes(k)} onChange={(v) => flip(k, v)} />
      ))}
      <Text style={[mono(11, false, C.gray, 0.1), { marginTop: 14, lineHeight: 18 }]}>The bell on a rower's page switches one rower off without unfollowing them.</Text>

      <Eye left="Blocked" />
      <Ctl label="Rowers you have blocked →" onPress={() => onPeople("blocked")} />
    </ScrollView>
  );
}

/* A setting: what it is, what it does in a sentence, and its switch. */
function Line2({ title, body, on, onChange }: { title: string; body: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ backgroundColor: TINT }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 8, paddingVertical: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{title}</Text>
          {body ? <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.soft, marginTop: 4 }}>{body}</Text> : null}
        </View>
        <Switch accessibilityLabel={title} value={on} onValueChange={onChange} trackColor={{ false: C.line, true: C.accent }} thumbColor="#fff" {...WEB_SWITCH} />
      </View>
      <Dash />
    </View>
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
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(21,23,26,0.45)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.paper, borderTopWidth: 2, borderColor: C.ink, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34, width: "100%", maxWidth: 560, alignSelf: "center" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderColor: C.ink, paddingBottom: 8 }}>
            <Text style={mono(11, true)}>{entryId ? "Report this row" : "Report this rower"}</Text>
            <Text numberOfLines={1} style={[mono(11, false, C.gray), { flexShrink: 1, marginLeft: 12 }]}>
              {num3(num)} · {name}
            </Text>
          </View>
          {state === "sent" ? (
            <>
              <Text style={{ fontFamily: F.black, fontSize: 28, color: C.ink, marginTop: 20 }}>Sent.</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 8 }}>It has gone to the people who run ROW. The rower is not told who reported them.</Text>
              <View style={{ marginTop: 22 }}>
                <Ctl label="Done" onPress={onClose} />
              </View>
            </>
          ) : (
            <>
              {REASONS.map(([key, label]) => (
                <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: reason === key }} onPress={() => setReason(key)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46 }}>
                  <View style={{ width: 16, height: 16, borderWidth: 2, borderColor: C.ink, backgroundColor: reason === key ? C.accent : "transparent" }} />
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
                style={{ marginTop: 10, minHeight: 64, borderWidth: 1, borderColor: C.ink, padding: 10, fontFamily: F.sans, fontSize: 15, color: C.ink, textAlignVertical: "top" }}
              />
              {error ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{error}</Text> : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
                <Ctl label="Cancel" onPress={onClose} />
                <Pressable accessibilityRole="button" disabled={!reason || state === "busy"} onPress={send} style={({ pressed }) => ({ minHeight: 42, paddingHorizontal: 18, justifyContent: "center", backgroundColor: C.accent, opacity: !reason || state === "busy" ? 0.4 : pressed ? 0.7 : 1 })}>
                  <Text style={mono(12, true, "#fff", 0.14)}>{state === "busy" ? "Sending" : "Send report"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
