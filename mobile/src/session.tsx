import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, loadToken, setToken, type Me } from "./api";

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
  signOut: () => Promise<void>;
};

const OUT: Me = { signedIn: false };
const Ctx = createContext<Session>({ ready: false, me: OUT, refresh: async () => {}, signInDev: async () => {}, signInGoogle: async () => {}, signOut: async () => {} });

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

  const take = useCallback(
    async (body: Record<string, string>) => {
      const r = await api<{ token: string }>("/api/row100k/app/session", { body });
      await setToken(r.token);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await setToken(null);
    setMe(OUT);
    await refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ ready, me, refresh, signInDev: (email) => take({ devEmail: email }), signInGoogle: (idToken) => take({ idToken }), signOut }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
