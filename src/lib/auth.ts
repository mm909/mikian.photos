import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "./db";

/**
 * NextAuth config — Google OAuth, JWT sessions.
 *
 * On first sign-in we upsert a Photographer row keyed on the Google subject
 * (stable Google user ID). The session token then carries that photographerId,
 * so any /api/photographer/* route can authorize the caller in one DB read.
 *
 * No DB adapter for sessions (JWT strategy) — keeps things simple and lets
 * us iterate on the Photographer schema without touching auth machinery.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      // Reject if missing the bits we depend on
      if (!user.email || !account?.providerAccountId) return false;
      // Upsert a Photographer row for this Google identity
      await db.photographer.upsert({
        where: { googleSubject: account.providerAccountId },
        update: {
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
        },
        create: {
          googleSubject: account.providerAccountId,
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
        },
      });
      return true;
    },
    async jwt({ token, account, user }) {
      // First sign-in: stash the Google subject so we can look up the row below
      if (account?.providerAccountId) {
        token.googleSubject = account.providerAccountId;
      }
      // Subsequent calls: hydrate photographerId + isAdmin from DB if we
      // don't already have them on the token
      if (token.googleSubject && (!token.photographerId || token.isAdmin === undefined)) {
        const pg = await db.photographer.findUnique({
          where: { googleSubject: token.googleSubject as string },
          select: { id: true, isAdmin: true },
        });
        if (pg) {
          token.photographerId = pg.id;
          token.isAdmin = pg.isAdmin;
        }
      }
      // Helpful fallbacks for the session shape
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      session.photographerId = (token.photographerId as string | undefined) ?? null;
      session.isAdmin = Boolean(token.isAdmin);
      return session;
    },
  },
  pages: {
    signIn: "/photographer/sign-in",
  },
};
