import { useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { SAME_ORIGIN, SITE, api } from "../api";
import { useSession } from "../session";
import { useAllTimeMeters, zeroed } from "../splash";
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

/* SIGNING IN, SAID PLAINLY (owner, 2026-11-24, of the Developer sign-in:
 * "it just like pauses for a bit. There's no loading animation or
 * anything"). From the press until the account is read and the app swaps
 * to it (session.tsx take: the token, then /me), a dark bar with a spinner
 * in place of the quiet button. The first sign-in of a day is the slow
 * one: the server copies the sample rower's rows to the Developer then. */
/* THE LITTLE GRAPHIC: three lines of water under the count, the blue
 * fading as they go down, the way a hull leaves a wake. */
function Water() {
  const wave = (y: number) => `M0 ${y} Q 15 ${y - 5} 30 ${y} T 60 ${y} T 90 ${y} T 120 ${y} T 150 ${y} T 180 ${y}`;
  return (
    <Svg width={180} height={34} viewBox="0 0 180 34" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[8, 18, 28].map((y, i) => (
        <Path key={y} d={wave(y)} stroke={C.accent} strokeOpacity={1 - i * 0.3} strokeWidth={2} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  );
}

/* THE TOP HALF OF THE SIGN-IN PAGE (owner, 2026-11-24: "login page should
 * probably have the same preview as our splash screen. You should have like
 * the row app name and the total number of meters rowed. Because right now
 * it's kind of bare ... put some header there, do a little graphic"): the
 * splash's mark, its count of every meter logged (still, not rolling: the
 * splash has just rolled it), and the water under it. */
function Masthead() {
  const meters = useAllTimeMeters();
  return (
    <View style={{ alignItems: "center" }}>
      <Text accessibilityRole="header" accessibilityLabel="Row" style={{ fontFamily: F.black, fontSize: 76, lineHeight: 84, letterSpacing: 1, color: C.ink }}>
        R<Text style={{ color: C.accent }}>O</Text>W
      </Text>
      <View style={{ height: 58, alignItems: "center", marginTop: 10 }}>
        {meters > 0 ? (
          <>
            <Text accessibilityLabel={`${fmt(meters)} meters rowed`} style={{ fontFamily: F.black, fontSize: 30, lineHeight: 36, color: C.ink, fontVariant: ["tabular-nums"] }}>
              {zeroed(meters, meters)}
              <Text style={{ color: C.accent }}> M</Text>
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2.2, color: C.gray, marginTop: 6 }}>METERS ROWED</Text>
          </>
        ) : null}
      </View>
      <View style={{ marginTop: 18 }}>
        <Water />
      </View>
    </View>
  );
}
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function Working() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Signing in" style={[styles.btn, { backgroundColor: C.ink, borderColor: C.ink, flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 10 }]}>
      <ActivityIndicator color={C.paper} />
      <Text style={[styles.btnText, { color: C.paper }]}>Signing in…</Text>
    </View>
  );
}

export function SignIn(_props: { why: string }) {
  const { signInDev, signInSite, signInApple, signInReview } = useSession();
  const [email, setEmail] = useState("");
  /* The Developer's sign-in, a password alone, folded away until asked
     for: Apple's reviewer and the owner's own testing (2026-11-23). */
  const [review, setReview] = useState(false);
  const [pass, setPass] = useState("");
  const asReviewer = async () => {
    setBusy(true);
    setError("");
    try {
      await signInReview(pass);
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
    /* THE BUTTONS AND NOTHING ELSE (owner, 2026-11-23: "remove the copy at
       the top. On the sign-in page, it's just sign with Apple, sign with
       Google, and then the developer sign in, and then the terms and
       policy. We also don't need to say by signing in you agree"). The
       heading, the line of why, and the line on abusive content are gone. */
    /* THE BUTTONS NEAR THE MIDDLE (owner, 2026-11-24: "let's put the
       buttons closer to the center of the screen"): the masthead fills the
       top half and stands on the middle; the buttons start just under it.
       A scroll, so the Developer's field is never under the keyboard. */
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 96 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={{ flex: 1, justifyContent: "flex-end", paddingTop: 24, paddingBottom: 34 }}>
        <Masthead />
      </View>
      <View style={{ flex: 1, width: "100%", maxWidth: 400, alignSelf: "center" }}>
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
      {/* APP REVIEW SIGN-IN (owner, 2026-11-22: "Add a reviewer login").
          Apple's reviewer is handed a name and a password in the review
          notes; nobody else has them, and with none set on the server the
          door is shut. A quiet line until it is pressed. */}
      {review ? (
        <View style={{ marginTop: 22 }}>
          <Eyebrow>Developer sign-in</Eyebrow>
          <TextInput style={field} value={pass} onChangeText={setPass} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Password" placeholderTextColor={C.gray} accessibilityLabel="Developer password" onSubmitEditing={asReviewer} />
          {busy ? <Working /> : <Btn label="Sign in" quiet disabled={pass.length < 8} onPress={asReviewer} />}
        </View>
      ) : (
        <Text accessibilityRole="button" onPress={() => setReview(true)} suppressHighlighting style={[styles.body, { fontSize: 13, marginTop: 18, textAlign: "center", textDecorationLine: "underline" }]}>
          Developer sign-in
        </Text>
      )}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 22 }}>
        <Text accessibilityRole="link" suppressHighlighting style={[styles.body, { fontSize: 13, textDecorationLine: "underline" }]} onPress={() => Linking.openURL(SITE + "/row100k/app-terms").catch(() => null)}>
          Terms
        </Text>
        <Text accessibilityRole="link" suppressHighlighting style={[styles.body, { fontSize: 13, textDecorationLine: "underline" }]} onPress={() => Linking.openURL(SITE + "/row100k/app-privacy").catch(() => null)}>
          Privacy policy
        </Text>
      </View>
      {__DEV__ ? (
        <View style={{ marginTop: 22 }}>
          <Eyebrow>Development: an existing account's email</Eyebrow>
          <TextInput style={field} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" accessibilityLabel="Account email" onSubmitEditing={dev} />
          <Btn label={busy ? "Signing in" : "Dev sign in"} quiet disabled={busy || !email.includes("@")} onPress={dev} />
        </View>
      ) : null}
      {error ? <Text style={[styles.body, { color: C.accent, marginTop: 12 }]}>{error}</Text> : null}
      </View>
    </ScrollView>
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
