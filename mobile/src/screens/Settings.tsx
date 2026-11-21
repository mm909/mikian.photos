import { useEffect, useState, type ReactNode } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SITE, api, edits, type SocialSettings } from "../api";
import { useLookSwitch } from "../look";
import { useSession } from "../session";
import { Eye, mono } from "../site";
import { C, F } from "../theme";
import { pickFace, setAvatar } from "../upload";
import { Avatar, Waiting, useLoad } from "../ui";
import { Act, Sheet, Small, Toggle, type PeopleList } from "./Social";

/* SETTINGS, behind the three lines on the rower's own profile (owner,
 * 2026-11-21: "the settings should probably just be like ... how do they
 * have it on Instagram").
 *
 * A SHORT LIST THAT LEADS TO PAGES (owner, 2026-11-21: "let's tuck some of
 * these things into other settings pages ... private account can be under
 * privacy. The notifications can be under notifications, and the dark mode
 * can be under appearance ... I want to have to click on them to go to
 * their settings. And then ... the profile photo can just be account"):
 *
 *   ACCOUNT        the photo, the bio ("allow me to put in a bio"), and the
 *                  rower's own birthday, height and weight ("places to fill
 *                  in things like height, weight"), which print nowhere
 *   PRIVACY        private account, the muted and the blocked
 *   NOTIFICATIONS  each kind and its switch; the two about rows being
 *                  logged are OFF until turned on
 *   APPEARANCE     dark mode, on this phone
 *
 * and the way out. A switch saves as it is pressed; what is typed on the
 * account page saves with SAVE. */
export type SettingsPage = "account" | "privacy" | "notifications" | "appearance";

const KIND: Record<string, [string, string]> = {
  passed: ["A rower I follow passes me", "At most one a day, however many passed."],
  follow: ["Somebody follows me", "Requests to follow a private account always arrive."],
  liked: ["Likes", "Of a row of mine, or of a comment."],
  commented: ["Comments, replies and tags", "A comment on my row, a reply to one of mine, or my name in one."],
  rowed: ["A rower I follow logs a row", "Every row, from everybody you follow."],
  rowedAll: ["Anybody logs a row", "Every row there is."],
};
const WEB_NO_RING = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as object;
const PATH = "/api/row100k/app/settings";

export function SettingsScreen({ page, onPage, onPeople, onSignedOut }: { page?: SettingsPage; onPage: (p: SettingsPage) => void; onPeople: (list: PeopleList) => void; onSignedOut: () => void }) {
  const { refresh, signOut, me } = useSession();
  const look = useLookSwitch();
  const { data, error, reload } = useLoad(() => api<{ settings: SocialSettings }>(PATH), [], PATH);
  const [s, setS] = useState<SocialSettings | null>(data?.settings ?? null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);

  const save = async (body: Record<string, unknown>): Promise<boolean> => {
    if (!s) return false;
    const before = s;
    setS({ ...s, ...(body.avatarKey === null ? { avatar: null } : (body as Partial<SocialSettings>)) });
    setFailed("");
    try {
      setS((await api<{ settings: SocialSettings }>(PATH, { body })).settings);
      edits.n++;
      refresh();
      return true;
    } catch (err) {
      setS(before);
      setFailed(err instanceof Error ? err.message : "That did not save.");
      return false;
    }
  };
  const wrap = (children: ReactNode) => (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 140 }}>
      {children}
      {failed ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 12 }]}>{failed}</Text> : null}
    </ScrollView>
  );

  /* THE LIST. */
  if (!page) {
    return wrap(
      <>
        <Go label="Account" sub="Photo, bio, birthday, height, weight" onPress={() => onPage("account")} />
        <Go label="Privacy" sub={s ? (s.isPrivate ? "Private account" : "Public account") : ""} onPress={() => onPage("privacy")} />
        <Go label="Notifications" sub="What you are told about" onPress={() => onPage("notifications")} />
        <Go label="Appearance" sub={look.dark ? "Dark" : "Light"} onPress={() => onPage("appearance")} />
        <View style={{ height: 26 }} />
        {/* What the store asks to be a press away: the policy and the terms. */}
        <Go label="Privacy policy" onPress={() => Linking.openURL(SITE + "/row100k/app-privacy").catch(() => null)} />
        <Go label="Terms of use" onPress={() => Linking.openURL(SITE + "/row100k/app-terms").catch(() => null)} />
        <View style={{ height: 26 }} />
        <Act
          label="Sign out"
          onPress={async () => {
            await signOut();
            onSignedOut();
          }}
        />
      </>,
    );
  }

  if (page === "appearance") {
    return wrap(<Setting title="Dark mode" body="Ink for the page, cream for the type. Only on this phone." on={look.dark} onChange={look.setDark} />);
  }
  if (!s) return <Waiting error={error} onRetry={reload} />;

  if (page === "privacy") {
    return wrap(
      <>
        <Setting title="Private account" body="Your rows and photos are shown only to followers you accept. You stay on the board, and your page keeps your totals." on={s.isPrivate} onChange={(v) => save({ isPrivate: v })} />
        <View style={{ height: 18 }} />
        <Go label="Muted rowers" onPress={() => onPeople("muted")} />
        <Go label="Blocked rowers" onPress={() => onPeople("blocked")} />
      </>,
    );
  }

  if (page === "notifications") {
    const on = s.notifyOn ?? [];
    return wrap(
      <>
        <Eye style={{ marginTop: 0, marginBottom: 0 }} left="About you" />
        {s.kinds.map((k) => (
          <Setting key={k} title={KIND[k]?.[0] ?? k} body={KIND[k]?.[1] ?? ""} on={!s.notifyOff.includes(k)} onChange={(v) => save({ notifyOff: v ? s.notifyOff.filter((x) => x !== k) : [...s.notifyOff, k] })} />
        ))}
        {/* OFF until asked for (owner, 2026-11-21: "leave that as off for
            now, like default off"). */}
        <Eye style={{ marginBottom: 0 }} left="When a row is logged" right="Off until you turn them on" />
        {(s.optIn ?? []).map((k) => (
          <Setting key={k} title={KIND[k]?.[0] ?? k} body={KIND[k]?.[1] ?? ""} on={on.includes(k)} onChange={(v) => save({ notifyOn: v ? [...on, k] : on.filter((x) => x !== k) })} />
        ))}
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 12 }}>For one rower only, press the bell beside FOLLOWING on their page.</Text>
      </>,
    );
  }

  return wrap(
    <AccountPage
      s={s}
      name={me.me?.displayName ?? ""}
      num={me.me?.rowerNumber ?? 0}
      save={save}
      onPhoto={async () => setS((await api<{ settings: SocialSettings }>(PATH)).settings)}
      onDeleted={async () => {
        await signOut();
        onSignedOut();
      }}
    />,
  );
}

/* ACCOUNT: the photo, the bio, and three lines that are the rower's own. */
function AccountPage({ s, name, num, save, onPhoto, onDeleted }: { s: SocialSettings; name: string; num: number; save: (body: Record<string, unknown>) => Promise<boolean>; onPhoto: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const { refresh } = useSession();
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
      await onPhoto();
      edits.n++;
      refresh();
      setFace("");
    } catch (err) {
      setFace(err instanceof Error ? err.message : "That photo did not go up.");
    }
  };

  /* Height and weight are typed the way a rower in the States says them
   * and kept metric, as the site keeps them. */
  const inches = s.heightCm ? Math.round(s.heightCm / 2.54) : 0;
  const [bio, setBio] = useState(s.bio ?? "");
  const [ft, setFt] = useState(inches ? String(Math.floor(inches / 12)) : "");
  const [inch, setInch] = useState(inches ? String(inches % 12) : "");
  const [lb, setLb] = useState(s.weightKg ? String(Math.round(s.weightKg * 2.2046)) : "");
  const [born, setBorn] = useState(s.birthday ? `${s.birthday.slice(5, 7)}/${s.birthday.slice(8, 10)}/${s.birthday.slice(0, 4)}` : "");
  const [state, setState] = useState<"" | "busy" | "saved">("");
  const [bad, setBad] = useState("");
  const edited = () => {
    setState("");
    setBad("");
  };
  const submit = async () => {
    const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(born.trim());
    if (born.trim() && !b) return setBad("Write the birthday as month/day/year: 04/23/1994.");
    const total = (Number(ft) || 0) * 12 + (Number(inch) || 0);
    setState("busy");
    setBad("");
    const ok = await save({
      bio,
      heightCm: total > 0 ? Math.round(total * 2.54) : null,
      weightKg: Number(lb) > 0 ? Math.round((Number(lb) / 2.2046) * 10) / 10 : null,
      birthday: b ? `${b[3]}-${b[1].padStart(2, "0")}-${b[2].padStart(2, "0")}` : null,
    });
    setState(ok ? "saved" : "");
  };
  const field = { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.sans, fontSize: 16, color: C.ink } as const;
  const label = (t: string) => <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 18, marginBottom: 6 }]}>{t}</Text>;

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line }}>
        <Avatar uri={s.avatar} name={name} size={64} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Small label={face === "busy" ? "Sending" : s.avatar ? "Change photo" : "Add a photo"} fill disabled={face === "busy"} onPress={choose} />
            {s.avatar ? <Small label="Remove" disabled={face === "busy"} onPress={() => save({ avatarKey: null })} /> : null}
          </View>
          <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray }}>{face && face !== "busy" ? face : "Shown beside your name. Without one, your initials are."}</Text>
        </View>
      </View>

      {label(`Bio · ${bio.length}/150`)}
      <TextInput
        accessibilityLabel="Bio"
        value={bio}
        onChangeText={(t) => {
          setBio(t.slice(0, 150));
          edited();
        }}
        multiline
        maxLength={150}
        placeholder="A line or two, shown on your page"
        placeholderTextColor={C.gray}
        style={[field, { minHeight: 76, textAlignVertical: "top" }, WEB_NO_RING]}
      />

      <Eye left="Only you see these" style={{ marginBottom: 0, marginTop: 30 }} />
      {label("Birthday")}
      <TextInput
        accessibilityLabel="Birthday, month, day, year"
        value={born}
        onChangeText={(t) => {
          setBorn(t);
          edited();
        }}
        keyboardType="numbers-and-punctuation"
        placeholder="MM/DD/YYYY"
        placeholderTextColor={C.gray}
        style={[field, WEB_NO_RING]}
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          {label("Height · ft")}
          <TextInput
            accessibilityLabel="Height, feet"
            value={ft}
            onChangeText={(t) => {
              setFt(t.replace(/\D/g, "").slice(0, 1));
              edited();
            }}
            keyboardType="number-pad"
            placeholder="5"
            placeholderTextColor={C.gray}
            style={[field, WEB_NO_RING]}
          />
        </View>
        <View style={{ flex: 1 }}>
          {label("in")}
          <TextInput
            accessibilityLabel="Height, inches"
            value={inch}
            onChangeText={(t) => {
              setInch(t.replace(/\D/g, "").slice(0, 2));
              edited();
            }}
            keyboardType="number-pad"
            placeholder="10"
            placeholderTextColor={C.gray}
            style={[field, WEB_NO_RING]}
          />
        </View>
        <View style={{ flex: 1.3 }}>
          {label("Weight · lb")}
          <TextInput
            accessibilityLabel="Weight, pounds"
            value={lb}
            onChangeText={(t) => {
              setLb(t.replace(/\D/g, "").slice(0, 3));
              edited();
            }}
            keyboardType="number-pad"
            placeholder="170"
            placeholderTextColor={C.gray}
            style={[field, WEB_NO_RING]}
          />
        </View>
      </View>

      {bad ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 12 }]}>{bad}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 22 }}>
        <Small label={state === "busy" ? "Saving" : "Save"} fill disabled={state === "busy"} onPress={submit} />
        {state === "saved" ? <Text style={mono(11, false, C.gray)}>Saved</Text> : null}
      </View>

      {/* THE WAY OUT FOR GOOD. Apple asks that an account made in an app
          can be deleted in it; and it is the rower's own to delete. */}
      <View style={{ marginTop: 44, borderTopWidth: 1, borderColor: C.line }}>
        <Act label="Delete account" danger onPress={() => setDeleting(true)} />
      </View>
      {deleting ? <DeleteSheet num={num} onClose={() => setDeleting(false)} onDeleted={onDeleted} /> : null}
    </>
  );
}

/* DELETE ACCOUNT: what goes, and the rower's own number typed back before
 * it will. */
function DeleteSheet({ num, onClose, onDeleted }: { num: number; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const n3 = String(num).padStart(3, "0");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/row100k/app/account", { method: "DELETE", body: { confirm: num } });
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
      setBusy(false);
    }
  };
  return (
    <Sheet title="Delete account" right={"Rower " + n3} onClose={onClose}>
      <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 10 }}>
        This deletes your rower for good: every row you have logged, your photos, your followers and who you follow, your likes, comments and saved telemetry. It cannot be undone. Type your rower number, {n3}, to go ahead.
      </Text>
      <TextInput accessibilityLabel="Your rower number" value={typed} onChangeText={setTyped} keyboardType="number-pad" placeholder={n3} placeholderTextColor={C.line} style={[{ marginTop: 14, borderBottomWidth: 2, borderColor: C.ink, fontFamily: F.black, fontSize: 28, color: C.ink, paddingVertical: 6 }, WEB_NO_RING]} />
      {error ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{error}</Text> : null}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Small label="Cancel" onPress={onClose} />
        <Small label={busy ? "Deleting" : "Delete my account"} fill disabled={busy || typed.trim() === "" || Number(typed) !== num} onPress={go} />
      </View>
    </Sheet>
  );
}

/* A line that leads to a page: its name, a word about what is there, and
 * the arrow. */
function Go({ label, sub, onPress }: { label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 60, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.gray, marginTop: 3 }}>{sub}</Text> : null}
      </View>
      <Text style={{ fontFamily: F.black, fontSize: 16, color: C.gray }}>→</Text>
    </Pressable>
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
