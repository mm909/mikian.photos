import { useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SAME_ORIGIN, SITE, api } from "../api";
import { useSession } from "../session";
import { C, F, onLook } from "../theme";
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

const fieldOf = () => ({ borderBottomWidth: 1, borderColor: C.ink, fontSize: 20, fontFamily: F.bold, paddingVertical: 8, color: C.ink, marginBottom: 16 }) as const;
let field = fieldOf();
onLook(() => {
  field = fieldOf();
});

export function SignIn({ why }: { why: string }) {
  const { signInDev, signInSite, signInApple, signInReview } = useSession();
  const [email, setEmail] = useState("");
  /* The App Store reviewer's sign-in, folded away until asked for. */
  const [review, setReview] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const asReviewer = async () => {
    setBusy(true);
    setError("");
    try {
      await signInReview(user, pass);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    }
    setBusy(false);
  };
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
      {/* SIGN IN WITH APPLE, on an iPhone (2026-11-21: Apple asks for it
          beside any other sign-in). Apple's own button, as Apple draws it.
          Closing the sheet is not an error. */}
      {Platform.OS === "ios" ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={0}
          style={{ height: 52, marginBottom: 12 }}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              const got = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
              if (!got.identityToken) throw new Error("Apple did not finish that sign-in. Try again.");
              await signInApple(got.identityToken, [got.fullName?.givenName, got.fullName?.familyName].filter(Boolean).join(" "));
            } catch (err) {
              if ((err as { code?: string }).code !== "ERR_REQUEST_CANCELED") setError(err instanceof Error ? err.message : "That did not work.");
            }
            setBusy(false);
          }}
        />
      ) : null}
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
        /* ON A PHONE: the site's own sign-in, in the phone's sign-in sheet,
           which hands the app its token when it is done. */
        <Btn
          label={busy ? "Signing in" : "Sign in with Google"}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              await signInSite();
            } catch (err) {
              setError(err instanceof Error ? err.message : "That did not work.");
            }
            setBusy(false);
          }}
        />
      ) : null}
      <Text style={[styles.body, { fontSize: 13, lineHeight: 19, marginTop: 14 }]}>
        By signing in you agree to the{" "}
        <Text accessibilityRole="link" style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(SITE + "/row100k/app-terms").catch(() => null)}>
          terms
        </Text>{" "}
        and the{" "}
        <Text accessibilityRole="link" style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(SITE + "/row100k/app-privacy").catch(() => null)}>
          privacy policy
        </Text>
        . There is no tolerance for abusive content: rows and rowers can be reported and blocked.
      </Text>
      {/* APP REVIEW SIGN-IN (owner, 2026-11-22: "Add a reviewer login").
          Apple's reviewer is handed a name and a password in the review
          notes; nobody else has them, and with none set on the server the
          door is shut. A quiet line until it is pressed. */}
      {review ? (
        <View style={{ marginTop: 22 }}>
          <Eyebrow>App review sign-in</Eyebrow>
          <TextInput style={field} value={user} onChangeText={setUser} autoCapitalize="none" autoCorrect={false} placeholder="Name" placeholderTextColor={C.gray} accessibilityLabel="Review sign-in name" />
          <TextInput style={field} value={pass} onChangeText={setPass} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Password" placeholderTextColor={C.gray} accessibilityLabel="Review sign-in password" onSubmitEditing={asReviewer} />
          <Btn label={busy ? "Signing in" : "Sign in"} quiet disabled={busy || user.trim().length < 3 || pass.length < 8} onPress={asReviewer} />
        </View>
      ) : (
        <Text accessibilityRole="button" onPress={() => setReview(true)} suppressHighlighting style={[styles.body, { fontSize: 13, marginTop: 18, textDecorationLine: "underline" }]}>
          App review sign-in
        </Text>
      )}
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
