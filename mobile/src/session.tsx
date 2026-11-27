import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { STAMP } from "./splash";
import * as WebBrowser from "expo-web-browser";
import { API, api, loadToken, setToken, type Me } from "./api";

/* WHO IS HOLDING THE PHONE. One read of /api/row100k/app/me when the app
 * opens and after anything that changes it (a sign-in, a join, a logged
 * row). Signed out is a state the app works in: the feed, the board, the
 * stats and anybody's profile are public, as they are on the site. */

type Session = {
  ready: boolean;
  me: Me;
  refresh: () => Promise<void>;
  /* DEVELOPMENT: sign in as an existing account by email (the server only
   * honours this outside a production build). */
  signInDev: (email: string) => Promise<void>;
  signInGoogle: (idToken: string) => Promise<void>;
  /* SIGN IN WITH APPLE: the token Apple's own sheet handed over, and the
   * name, which Apple gives only the first time. */
  signInApple: (appleToken: string, name: string) => Promise<void>;
  /* THE APP STORE REVIEWER'S SIGN-IN: a name and a password the owner sets
   * on the server and writes in the review notes (lib/appReview.ts). */
  signInReview: (pass: string) => Promise<void>;
  /* ON A PHONE: sign in through the site, in the phone's own sign-in sheet
   * (the site's /api/row100k/app/session/handoff says how). */
  signInSite: () => Promise<void>;
  signOut: () => Promise<void>;
};

const OUT: Me = { signedIn: false };
const Ctx = createContext<Session>({ ready: false, me: OUT, refresh: async () => {}, signInDev: async () => {}, signInGoogle: async () => {}, signInApple: async () => {}, signInReview: async () => {}, signInSite: async () => {}, signOut: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>(OUT);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await loadToken();
      setMe(await api<Me>("/api/row100k/app/me"));
    } catch {
      /* Offline, or the server is away: the app opens signed out and the
       * screens say what they could not read. */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* THE APP, OPENED (owner, 2026-11-26: "I need to know who's using the
   * app"): once signed in, and each time the app comes back to the front,
   * the site counts a day of use (api/row100k/app/seen). Nothing waits on
   * it and nothing is said if it fails. */
  const signedIn = me.signedIn;
  const lastSeen = useRef(0);
  useEffect(() => {
    if (!signedIn) return;
    const seen = () => {
      const now = Date.now();
      if (now - lastSeen.current < 60_000) return;
      lastSeen.current = now;
      api("/api/row100k/app/seen", { body: { platform: Platform.OS, version: STAMP } }).catch(() => null);
    };
    seen();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") seen();
    });
    return () => sub.remove();
  }, [signedIn]);

  const take = useCallback(
    async (body: Record<string, string>) => {
      const r = await api<{ token: string }>("/api/row100k/app/session", { body });
      await setToken(r.token);
      await refresh();
    },
    [refresh],
  );

  const signInSite = useCallback(async () => {
    const res = await WebBrowser.openAuthSessionAsync(`${API}/api/row100k/app/session/handoff`, "rowtember://auth");
    /* Closed without finishing: nothing happened, and that is not an error. */
    if (res.type !== "success") return;
    const q = res.url.split("?")[1] ?? "";
    const got = Object.fromEntries(q.split("&").map((p) => p.split("=").map(decodeURIComponent) as [string, string]));
    if (got.error) throw new Error(got.error);
    if (!got.token) throw new Error("Sign-in did not finish. Try again.");
    await setToken(got.token);
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await setToken(null);
    setMe(OUT);
    await refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ ready, me, refresh, signInDev: (email) => take({ devEmail: email }), signInGoogle: (idToken) => take({ idToken }), signInApple: (appleToken, name) => take({ appleToken, name }), signInReview: (reviewPass) => take({ reviewPass }), signInSite, signOut }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
