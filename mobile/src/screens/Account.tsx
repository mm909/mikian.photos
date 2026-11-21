import { useState } from "react";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SAME_ORIGIN, api } from "../api";
import { useSession } from "../session";
import { C, F } from "../theme";
import { Btn, Eyebrow, styles } from "../ui";

/* SIGNING IN AND JOINING, the two doors in front of a rower's own screens.
 *
 * The account is the site's Google account (owner, 2026-11-20: "Yes, google
 * logins, same as rowtember"). On the web build served by the site the
 * site's own sign-in is used and its cookie carries over. On the phone the
 * app signs in with Google itself and trades the result for a token
 * (api/row100k/app/session); that button needs the phone's Google client
 * id, which does not exist until the first phone build. In development an
 * existing account can be entered by email. */

const field = { borderBottomWidth: 1, borderColor: C.ink, fontSize: 20, fontFamily: F.bold, paddingVertical: 8, color: C.ink, marginBottom: 16 } as const;

export function SignIn({ why }: { why: string }) {
  const { signInDev } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dev = async () => {
    setBusy(true);
    setError("");
    try {
      await signInDev(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy(false);
  };
  return (
    <View style={{ padding: 20 }}>
      <Eyebrow>Your account</Eyebrow>
      <Text style={{ fontFamily: F.black, fontSize: 32, lineHeight: 36, color: C.ink, marginTop: 6, marginBottom: 8 }}>
        Sign <Text style={{ color: C.accent }}>in</Text>
      </Text>
      <Text style={[styles.body, { marginBottom: 18 }]}>{why}</Text>
      {SAME_ORIGIN ? (
        <Btn
          label="Sign in with Google"
          onPress={() => {
            const back = typeof window !== "undefined" ? window.location.pathname : "/row100k/app/";
            /* Same host as the page, so the cookie it sets is the one this
               build reads. */
            Linking.openURL(`/sign-in?callbackUrl=${encodeURIComponent(back)}`);
          }}
        />
      ) : Platform.OS !== "web" ? (
        <Text style={styles.body}>Google sign-in on the phone arrives with the first phone build.</Text>
      ) : null}
      {__DEV__ ? (
        <View style={{ marginTop: 22 }}>
          <Eyebrow>Development: an existing account's email</Eyebrow>
          <TextInput style={field} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" accessibilityLabel="Account email" onSubmitEditing={dev} />
          <Btn label={busy ? "Signing in" : "Dev sign in"} quiet disabled={busy || !email.includes("@")} onPress={dev} />
        </View>
      ) : null}
      {error ? <Text style={[styles.body, { color: C.accent, marginTop: 12 }]}>{error}</Text> : null}
    </View>
  );
}

/* A signed-in account that has no rower yet: the four things the site's
 * join asks for, sent to the same route. */
export function Join() {
  const { me, refresh, signOut } = useSession();
  const [name, setName] = useState(me.name ?? "");
  const [instagram, setInstagram] = useState("");
  const [division, setDivision] = useState<"M" | "F" | "">("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = name.trim().length >= 2 && division !== "" && /^\d{4}-\d{2}-\d{2}$/.test(birthday);
  const join = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/row100k/join", { body: { displayName: name, instagram, division, birthday } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy(false);
  };
  return (
    <View style={{ padding: 20 }}>
      <Eyebrow>One more step</Eyebrow>
      <Text style={{ fontFamily: F.black, fontSize: 32, lineHeight: 36, color: C.ink, marginTop: 6, marginBottom: 18 }}>
        Your <Text style={{ color: C.accent }}>rower</Text>
      </Text>
      <Eyebrow>Name on the board</Eyebrow>
      <TextInput style={field} value={name} onChangeText={setName} maxLength={40} accessibilityLabel="Name on the board" />
      <Eyebrow>Instagram (optional)</Eyebrow>
      <TextInput style={field} value={instagram} onChangeText={setInstagram} autoCapitalize="none" maxLength={30} accessibilityLabel="Instagram handle" />
      <Eyebrow>Board</Eyebrow>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 16 }}>
        {(["M", "F"] as const).map((d) => (
          <Pressable key={d} accessibilityRole="radio" accessibilityState={{ selected: division === d }} onPress={() => setDivision(d)} style={{ flex: 1, minHeight: 48, borderWidth: 1.5, borderColor: division === d ? C.accent : C.line, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2.2, color: division === d ? C.accent : C.soft }}>{d === "M" ? "MEN" : "WOMEN"}</Text>
          </Pressable>
        ))}
      </View>
      <Eyebrow>Birthday (YYYY-MM-DD)</Eyebrow>
      <TextInput style={field} value={birthday} onChangeText={setBirthday} placeholder="1994-06-30" placeholderTextColor={C.line} maxLength={10} accessibilityLabel="Birthday" />
      <Btn label={busy ? "Joining" : "Join"} disabled={!ok || busy} onPress={join} />
      {error ? <Text style={[styles.body, { color: C.accent, marginTop: 12 }]}>{error}</Text> : null}
      <Btn label="Sign out" quiet onPress={signOut} style={{ marginTop: 10 }} />
    </View>
  );
}
