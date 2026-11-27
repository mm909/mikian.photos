import Constants from "expo-constants";
import { M2dPlanner, M2dReturn } from "./M2D";
import * as Updates from "expo-updates";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SITE, api, edits, type SocialSettings } from "../api";
import { resetBoat, resetCoins, resetHull, resetSkills } from "../arcade/boat";
import { resetLook, resetUnlocks, unlockAll } from "../arcade/locker";
import { setXp } from "../arcade/progress";
import { addBoxes, resetBoxes, resetRun } from "../arcade/run";
import { useLookSwitch } from "../look";
import { arcadeFor } from "../arcade/gate";
import { useSession } from "../session";
import { STAMP } from "../splash";
import { Eye, mono } from "../site";
import { C, F } from "../theme";
import { pickFace, setAvatar } from "../upload";
import { Avatar, Waiting, useLoad } from "../ui";
import { Act, Sheet, Small, type PeopleList } from "./Social";
import { Concept2Card } from "../concept2";

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
 * account page saves with SAVE.
 *
 * THE DEVELOPER ACCOUNT (owner, 2026-11-23; lib/devAccount.ts on the site):
 * signed in as the Developer, RESET THIS ACCOUNT puts rower 001's copy
 * back at once; signed in as an admin, DEVELOPER PASSWORD sets the one
 * password that opens it, so the host's settings never need opening. */
/* DEVELOPER is one page (owner, 2026-11-24: every developer option "into
 * one submenu", like the others): the arcade's resets, the Developer
 * account's reset, and the way to PASSWORD. */
export type SettingsPage = "account" | "privacy" | "notifications" | "appearance" | "concept2" | "developer" | "password" | "planner" | "return" | "about";

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

export function SettingsScreen({ page, onPage, onPeople, onSignedOut, onWiki, onLocker }: { page?: SettingsPage; onPage: (p: SettingsPage) => void; onPeople: (list: PeopleList) => void; onSignedOut: () => void; /* The owner's wiki (screens/Wiki.tsx), for an admin only. */ onWiki?: () => void; /* The skins won from the arcade's chests (screens/Locker.tsx), for an admin only while the arcade is his. */ onLocker?: () => void }) {
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
        {/* THE CONCEPT2 LOGBOOK (2026-11-26, ../concept2.tsx): in
            development, an admin only until the owner says it goes live. */}
        {me.isAdmin ? <Go label="Concept2 Logbook" sub="Send your rows there by themselves" onPress={() => onPage("concept2")} /> : null}
        {/* THE WIKI, the owner's plans, for him alone (owner, 2026-11-24:
            "put it in the settings page"). */}
        {/* M2D EXPOSURE, a press from the list (owner, 2026-11-25: "I need
            that exposure page in the app"): what M2D can cost at the rate. */}
        {me.isAdmin ? <Go label="M2D exposure" sub="What the match can cost: so far, projected, per cent. Only you see this." onPress={() => onPage("planner")} /> : null}
        {/* M2D RETURN, under the exposure (owner, 2026-11-25 evening: "a
            section for my ROI"): who started, who rowed, who keeps rowing. */}
        {me.isAdmin ? <Go label="M2D return" sub="Cost per rower, who started and who rowed, who keeps rowing after. Only you see this." onPress={() => onPage("return")} /> : null}
        {me.isAdmin && onWiki ? <Go label="Wiki" sub="The plans, the arcade, the order of work. Only you see this." onPress={onWiki} /> : null}
        {arcadeFor(me) && onLocker ? <Go label="Locker" sub="Your piece's skins from the arcade's chests. Only you see this." onPress={onLocker} /> : null}
        <View style={{ height: 26 }} />
        {/* What the store asks to be a press away: the policy and the terms. */}
        <Go label="Privacy policy" onPress={() => Linking.openURL(SITE + "/row100k/app-privacy").catch(() => null)} />
        <Go label="Terms of use" onPress={() => Linking.openURL(SITE + "/row100k/app-terms").catch(() => null)} />
        {me.isDev || me.isAdmin ? <Go label="Developer" sub={me.isAdmin ? "Resets for the arcade, the Developer password. Only you see this." : "Reset this account"} onPress={() => onPage("developer")} /> : null}
        <View style={{ height: 26 }} />
        <Act
          label="Sign out"
          onPress={async () => {
            await signOut();
            onSignedOut();
          }}
        />
        <View style={{ height: 26 }} />
        <Go label="About" sub={`Version ${nativeVersion() || "—"} · ${STAMP}`} onPress={() => onPage("about")} />
        {/* THE FOOT OF SETTINGS (owner, 2026-11-24: "we just put it just not
            a link to my Instagram. We just put for yourself and others as a
            footer there in the settings tab"): the splash's line, plain. */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: C.gray, textAlign: "center", marginTop: 40 }}>FOR YOURSELF AND OTHERS</Text>
      </>,
    );
  }

  if (page === "password") return wrap(<DeveloperPassword />);
  /* What M2D costs, and ROWTEMBER's rate (owner, 2026-11-25): an admin
   * only, in the developer settings (screens/M2D.tsx M2dPlanner). */
  if (page === "planner") return wrap(me.isAdmin ? <M2dPlanner /> : null);
  if (page === "return") return wrap(me.isAdmin ? <M2dReturn /> : null);
  /* ABOUT, A PAGE OF ITS OWN (owner, 2026-11-25: "the about should
   * definitely just be in its own little settings folder"). */
  if (page === "about") return wrap(<About />);
  if (page === "concept2") return wrap(me.isAdmin ? <Concept2Card full /> : null);
  if (page === "developer") {
    return wrap(
      <>
        {me.isAdmin ? <Go label="M2D cost planner" sub="What M2D costs, and ROWTEMBER's rate. Only you see this." onPress={() => onPage("planner")} /> : null}
        {me.isAdmin ? <ArcadeDev /> : null}
        {me.isDev || me.isAdmin ? <DeveloperRows isDev={!!me.isDev} onPassword={() => onPage("password")} onReset={() => refresh()} /> : null}
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
  const field = { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderCurve: "continuous", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.sans, fontSize: 16, color: C.ink } as const;
  const label = (t: string) => <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 18, marginBottom: 6 }]}>{t}</Text>;

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line }}>
        <Avatar uri={s.avatar} name={name} num={num} size={64} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Small label={face === "busy" ? "Sending" : s.avatar ? "Change photo" : "Add a photo"} fill disabled={face === "busy"} onPress={choose} />
            {s.avatar ? <Small label="Remove" disabled={face === "busy"} onPress={() => save({ avatarKey: null })} /> : null}
          </View>
          {/* No line of what the photo is for (owner, 2026-11-23: "we can
              remove the text that says shown beside your name, without one
              your initials are"); only a word while it is being sent. */}
          {face && face !== "busy" ? <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray }}>{face}</Text> : null}
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
/* What the Developer and an admin see in the list, under the policy and
 * the terms. A reset is pressed twice: once to ask, once to do it. */
function DeveloperRows({ isDev, onPassword, onReset }: { isDev: boolean; onPassword: () => void; onReset: () => void }) {
  const [ask, setAsk] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    if (!ask) {
      setAsk(true);
      setNote("Everything this account changed goes, and rower 001's rows are copied back. Press again to reset.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const r = await api<{ rows: number }>("/api/row100k/app/dev", { body: { reset: true } });
      edits.n++;
      onReset();
      setNote(`Reset. ${r.rows.toLocaleString("en-US")} rows copied from rower 001.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    }
    setAsk(false);
    setBusy(false);
  };
  return (
    <>
      <View style={{ height: 26 }} />
      <Eye style={{ marginTop: 0, marginBottom: 0 }} left="The Developer account" />
      {isDev ? <Act label={busy ? "Resetting" : ask ? "Press again to reset" : "Reset this account"} danger={ask} onPress={busy ? () => null : reset} /> : null}
      {isDev && !note ? <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 8 }}>A copy of rower 001 that only this account sees. What you change stays until tomorrow, then rower 001 is copied again.</Text> : null}
      {note ? <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 8 }}>{note}</Text> : null}
      {!isDev ? <Go label="Developer password" sub="Opens the Developer account, rower 000" onPress={onPassword} /> : null}
    </>
  );
}

/* THE ARCADE'S DEVELOPER BUTTONS (owner, 2026-11-24: "Maybe there's a
 * section for developer in the settings and put that as one of them"), for
 * an admin: each pressed twice, once to ask and once to do it. They touch
 * only the arcade kept on this phone (the XP, the boat, the locker); never
 * a row, the meters or anything on the site. */
type DevReset = { id: string; label: string; ask: string; done: string; run: () => Promise<unknown> };
/* THE WHOLE CHARACTER, at the top (owner, 2026-11-24: one button that puts
 * everything back to level 1): the XP, the coins, the boat, the skills,
 * the look and the unlocks. */
const WHOLE: DevReset = {
  id: "whole",
  label: "Reset my whole character",
  ask: "Level 1: XP, coins, boat, skills, appearance, unlocks, the run, its stars and the boxes all go. Press again.",
  done: "Level 1: no XP, no coins, no upgrades, the plain box, an empty locker, floor 1, no stars, no boxes.",
  run: async () => {
    await setXp(0);
    await resetBoat();
    await resetLook();
    await resetUnlocks();
    await resetRun();
    await resetBoxes();
  },
};
const ARCADE_DEV: DevReset[] = [
  { id: "level", label: "Reset my level", ask: "Your XP goes to 0. Press again.", done: "Level 1, no XP.", run: () => setXp(0) },
  { id: "run", label: "Reset my run", ask: "Back to floor 1 of run 1, and the stars go. Press again.", done: "Floor 1, run 1, no stars.", run: () => resetRun() },
  { id: "boxes", label: "Add 5 boxes and a boss box", ask: "Five boxes and a boss box, to open after your next row. Press again.", done: "Added: five boxes and a boss box.", run: () => addBoxes(5, 1) },
  { id: "coins", label: "Reset my coins", ask: "Your coins go to 0. Press again.", done: "No coins.", run: () => resetCoins() },
  { id: "boat", label: "Reset my boat", ask: "The HULL upgrade goes to level 0. Press again.", done: "The hull is at level 0.", run: () => resetHull() },
  { id: "skills", label: "Reset my skills", ask: "DAMAGE, QUICK and EASE go to level 0. Press again.", done: "The skills' upgrades are at 0.", run: () => resetSkills() },
  { id: "look", label: "Reset my appearance", ask: "Your piece goes back to the plain box. Press again.", done: "The plain box, nothing on.", run: () => resetLook() },
  { id: "unlocks", label: "Reset all unlocks", ask: "Every item you have won goes. Press again.", done: "No items: the locker is empty.", run: () => resetUnlocks() },
  { id: "all", label: "Unlock everything", ask: "Every item in the locker becomes yours. Press again.", done: "Every item is yours.", run: () => unlockAll() },
];
function ArcadeDev() {
  const [ask, setAsk] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const press = async (d: DevReset) => {
    if (ask !== d.id) {
      setAsk(d.id);
      setNote(d.ask);
      return;
    }
    setAsk(null);
    try {
      await d.run();
      setNote(d.done);
    } catch {
      setNote("That did not work.");
    }
  };
  return (
    <>
      <Eye style={{ marginTop: 0, marginBottom: 0 }} left="The arcade" right="Only you" />
      <Act label={ask === WHOLE.id ? `Press again: ${WHOLE.label.toLowerCase()}` : WHOLE.label} danger onPress={() => press(WHOLE)} />
      <View style={{ height: 14 }} />
      <Eye style={{ marginTop: 0, marginBottom: 0 }} left="One at a time" />
      {ARCADE_DEV.map((d) => (
        <Act key={d.id} label={ask === d.id ? `Press again: ${d.label.toLowerCase()}` : d.label} danger={ask === d.id} onPress={() => press(d)} />
      ))}
      <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 8 }}>{note || "The arcade on this phone only: your rows and meters are never touched."}</Text>
    </>
  );
}

/* THE PASSWORD, for an admin: typed here, kept on the site only as a
 * digest. Nobody can read it back, so a forgotten one is set again. */
function DeveloperPassword() {
  const { data } = useLoad(() => api<{ passwordSet: boolean }>("/api/row100k/app/dev"), [], "/api/row100k/app/dev");
  const [pass, setPass] = useState("");
  const [state, setState] = useState<"" | "busy" | "saved">("");
  const [bad, setBad] = useState("");
  const field = { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderCurve: "continuous", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.sans, fontSize: 16, color: C.ink } as const;
  const submit = async () => {
    if (pass.length < 8) {
      setBad("At least 8 characters.");
      return;
    }
    setBad("");
    setState("busy");
    try {
      await api("/api/row100k/app/dev", { body: { password: pass } });
      setPass("");
      setState("saved");
    } catch (err) {
      setBad(err instanceof Error ? err.message : "That did not save.");
      setState("");
    }
  };
  return (
    <>
      <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.ink }}>
        The Developer account is rower 000: a copy of rower 001 that only it can see. Under the sign-in buttons, Developer sign-in opens it with this password alone. Give it to Apple's reviewer in the review notes.
      </Text>
      <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 22, marginBottom: 6 }]}>
        {state === "saved" || data?.passwordSet ? "New password · one is set" : "Password · none set yet"}
      </Text>
      <TextInput
        accessibilityLabel="Developer password"
        value={pass}
        onChangeText={(t) => {
          setPass(t);
          if (state === "saved") setState("");
        }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="8 characters or more"
        placeholderTextColor={C.gray}
        onSubmitEditing={submit}
        style={[field, WEB_NO_RING]}
      />
      {bad ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 12 }]}>{bad}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18 }}>
        <Small label={state === "busy" ? "Saving" : "Save"} fill disabled={state === "busy"} onPress={submit} />
        {state === "saved" ? <Text style={mono(11, false, C.gray)}>Saved</Text> : null}
      </View>
    </>
  );
}

/* ABOUT (owner, 2026-11-24, unable to tell whether his phone had the
 * newest code: "Maybe if I could have the Apple version be in my settings
 * somewhere, right? Like an about type of deal"). At the foot of the list:
 * the store's version and build number, the update stamp the splash
 * prints, the channel, and whether a newer update is waiting, with a
 * button that fetches it and starts the app again on it.
 *
 * The build number comes from expo-application, which the build already
 * carries (expo-notifications brings it), read in a try so a build without
 * it shows the version alone. */
function nativeVersion(): string {
  let v = "";
  let n = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const A = require("expo-application") as { nativeApplicationVersion: string | null; nativeBuildVersion: string | null };
    v = A.nativeApplicationVersion ?? "";
    n = A.nativeBuildVersion ?? "";
  } catch {
    /* not in this build */
  }
  if (!v) v = Constants.expoConfig?.version ?? "";
  return n ? `${v} (${n})` : v;
}

type Fresh = "checking" | "current" | "newer" | "fetching" | "failed" | "off";
function About() {
  const off = Platform.OS === "web" || __DEV__ || !Updates.isEnabled;
  const [state, setState] = useState<Fresh>(off ? "off" : "checking");
  const check = () => {
    setState("checking");
    Updates.checkForUpdateAsync().then(
      (r) => setState(r.isAvailable ? "newer" : "current"),
      () => setState("failed"),
    );
  };
  useEffect(() => {
    if (!off) check();
    // Once, as the list opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const take = async () => {
    setState("fetching");
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setState("failed");
    }
  };
  const published = !off && !Updates.isEmbeddedLaunch && Updates.createdAt ? Updates.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const line = (k: string, v: string) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
      <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.ink }}>{k}</Text>
      <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.gray, fontVariant: ["tabular-nums"], flexShrink: 1, textAlign: "right" }}>{v}</Text>
    </View>
  );
  /* CHECK FOR UPDATES, A LINE OF THE TABLE (owner, 2026-11-25: "the up to
   * date and check it again buttons are a little weird ... there could be a
   * check version ... not in a table, not in a button"): its name on the
   * left, what the check found on the right; a press checks again, or,
   * with one waiting, gets it. */
  const right =
    state === "checking" ? "Checking…" : state === "current" ? "Up to date ✓" : state === "newer" ? "Get the update" : state === "fetching" ? "Getting it…" : state === "failed" ? "Try again" : "—";
  const say =
    state === "off"
      ? Platform.OS === "web"
        ? "The web build is always the newest: the site serves it fresh."
        : "Updates are off in a development build: it runs the code on this computer."
      : state === "checking"
        ? "Checking for a newer update…"
        : state === "current"
          ? "Up to date."
          : state === "newer"
            ? "A newer update is ready: close and reopen ROW, or get it now."
            : state === "fetching"
              ? "Getting the update…"
              : "Could not check just now. Try again in a moment.";
  return (
    <View>
      <Eye left="About" />
      {line("Version", nativeVersion() || "—")}
      {line("Update", published ? `${STAMP} · ${published}` : `${STAMP} · in the build`)}
      {!off && Updates.channel ? line("Channel", Updates.channel) : null}
      {off ? (
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 12 }}>{say}</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Check for updates. ${say}`}
          accessibilityLiveRegion="polite"
          disabled={state === "checking" || state === "fetching"}
          onPress={state === "newer" ? take : check}
          style={({ pressed }) => ({ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, minHeight: 48, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.ink }}>Check for updates</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {state === "checking" || state === "fetching" ? <ActivityIndicator color={C.gray} /> : null}
            <Text style={{ fontFamily: state === "newer" ? F.bold : F.sans, fontSize: 15, color: state === "newer" ? C.accent : C.gray }}>{right}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

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
      <Switch accessibilityLabel={title} value={on} onValueChange={onChange} trackColor={{ false: C.line, true: C.accent }} thumbColor={Platform.OS === "android" ? "#fff" : undefined} ios_backgroundColor={C.line} />
    </View>
  );
}
