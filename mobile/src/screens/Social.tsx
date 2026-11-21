import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { api, type Counts, type Notice, type Person, type Rel, type SocialSettings } from "../api";
import { SearchIcon } from "../icons";
import { useLookSwitch } from "../look";
import { useSession } from "../session";
import { Ctl, Eye, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Waiting, useLoad } from "../ui";

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
function PersonLine({ p, onRower, right }: { p: { rowerNumber: number; numStr: string; name: string; instagram: string }; onRower: (n: number) => void; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, borderBottomWidth: 1, borderColor: C.line }}>
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

/* A sheet that comes up from the foot of the screen, for a short choice. */
export function Sheet({ title, right, onClose, children }: { title: string; right?: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.paper, borderTopWidth: 2, borderColor: C.ink, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34, width: "100%", maxWidth: 560, alignSelf: "center" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderColor: C.ink, paddingBottom: 8, marginBottom: 6 }}>
            <Text style={mono(11, true)}>{title}</Text>
            {right ? (
              <Text numberOfLines={1} style={[mono(11, false, C.gray), { flexShrink: 1, marginLeft: 12 }]}>
                {right}
              </Text>
            ) : null}
          </View>
          {children}
        </Pressable>
      </Pressable>
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

/* THE SWITCH, drawn in the house's own shapes (owner, 2026-11-21, of the
 * phone's stock switch on the settings page: "the color scheme on here is
 * terrible ... the blue and the green dot, not good"): a square track that
 * is the blue when on, and a square of paper that slides across it. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const a = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: on ? 1 : 0, duration: 140, useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, on]);
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={() => onChange(!on)} hitSlop={10} style={{ width: 50, height: 28, borderWidth: 2, borderColor: on ? C.accent : C.gray, backgroundColor: on ? C.accent : "transparent", justifyContent: "center" }}>
      <Animated.View style={{ width: 18, height: 18, marginLeft: 3, backgroundColor: on ? "#fff" : C.gray, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }] }} />
    </Pressable>
  );
}

/* ---- search ---------------------------------------------------------- */

/* SEARCH (owner, 2026-11-20: "search function"; 2026-11-21: "rower 01,
 * first name, last name, meters, Instagram handle. That's it"): one field,
 * the roster under it. A name, a handle or a rower number; nothing typed
 * lists everybody in number order. A line opens the rower. */
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

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 6, gap: 10 }}>
          <SearchIcon size={20} />
          <TextInput
            accessibilityLabel="Search rowers by name, Instagram or number"
            value={text}
            onChangeText={setText}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            placeholder="Name, @handle or number"
            placeholderTextColor={C.gray}
            style={[{ flex: 1, fontFamily: F.bold, fontSize: 18, color: C.ink, paddingVertical: 8 }, WEB_NO_RING]}
          />
          {text ? <Ctl label="Clear" onPress={() => setText("")} /> : null}
        </View>
      </View>
      {!people ? (
        <Waiting error={error} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => String(p.rowerNumber)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <PersonLine
              p={item}
              onRower={onRower}
              right={
                item.meters !== null ? (
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>
                    {fmtInt(item.meters)} <Text style={{ color: C.gray }}>m</Text>
                  </Text>
                ) : null
              }
            />
          )}
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
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40 }}
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
  const { data, error, loading, reload } = useLoad(() => api<{ items: Notice[]; unread: number }>("/api/row100k/app/notifications"), []);
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
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
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
            <View style={{ width: 8, height: 8, backgroundColor: item.unread ? C.accent : "transparent" }} />
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
  const { refresh, signOut } = useSession();
  const look = useLookSwitch();
  const { data, error, reload } = useLoad(() => api<{ settings: SocialSettings }>("/api/row100k/app/settings"), []);
  const [s, setS] = useState<SocialSettings | null>(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);

  const save = async (body: { isPrivate?: boolean; notifyOff?: string[] }) => {
    if (!s) return;
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

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 56 }}>
      {s ? (
        <>
          <Eye style={{ marginTop: 0, marginBottom: 0 }} left="Account" />
          <Setting title="Private account" body="Your rows and photos are shown only to followers you accept. You stay on the board, and your page keeps your totals." on={s.isPrivate} onChange={(v) => save({ isPrivate: v })} />
          {failed ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{failed}</Text> : null}

          <Eye style={{ marginBottom: 0 }} left="Notifications" right="From rowers you follow" />
          {s.kinds.map((k) => (
            <Setting key={k} title={KIND[k]?.[0] ?? k} body={KIND[k]?.[1] ?? ""} on={!s.notifyOff.includes(k)} onChange={(v) => save({ notifyOff: v ? s.notifyOff.filter((x) => x !== k) : [...s.notifyOff, k] })} />
          ))}
          <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 12 }}>The bell on a rower's page switches that one rower off without unfollowing them.</Text>
        </>
      ) : (
        <Waiting error={error} onRetry={reload} />
      )}

      <Eye style={{ marginBottom: 0 }} left="This phone" />
      <Setting title="Dark mode" body="Ink for the page, cream for the type. Only on this phone." on={look.dark} onChange={look.setDark} />

      <Eye style={{ marginBottom: 0 }} left="More" />
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
 * up this sheet. Block and report for everybody; for the owner, DELETE THIS
 * ROWER ("I need to be able to delete a rower"), which takes the rower's
 * number typed out before it will go, because it takes their whole log
 * with them and cannot be undone here. */
export function RowerMenu({ num, name, adminId, onClose, onBlocked, onGone }: { num: number; name: string; adminId?: string | null; onClose: () => void; onBlocked: () => void; onGone: () => void }) {
  const [step, setStep] = useState<"" | "block" | "report" | "delete">("");
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
          <Act label="Block" onPress={() => setStep("block")} />
          <Act label="Report" onPress={() => setStep("report")} />
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
