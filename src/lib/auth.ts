import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "./db";
import {
  ALL_ROLES,
  OWNER_IMPLIED_ROLES,
  normalizeRoles,
  ownerEmail,
  type Role,
} from "./permissions";
import { isSiteGateOn, isAllowedGateEmail } from "./siteGate";

/**
 * NextAuth config — Google OAuth, JWT sessions.
 *
 * On first sign-in we make sure a Photographer row exists for this Google
 * identity. Resolution order:
 *   1. Existing row whose `googleSubject` matches the OAuth subject.
 *   2. Existing row whose `email` matches (claims a pre-seeded row — the
 *      seed creates a few placeholder photographers; this lets us link a
 *      real Google login to that row instead of creating a duplicate).
 *   3. Brand-new row.
 *
 * Roles are assigned on first signIn:
 *   - email matches OWNER_EMAIL (default mikian.photos@gmail.com)
 *     → ["runner","photographer","race_director","owner"]
 *   - otherwise: keep existing roles if any, else default to ["runner"]
 *
 * No DB adapter for sessions (JWT strategy) — keeps things simple.
 * Session/JWT carry `photographerId`, `roles`, and (legacy) `isAdmin`.
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
      if (!user.email || !account?.providerAccountId) return false;
      const email = user.email.toLowerCase().trim();

      // Site gate: while the whole site is private, refuse to mint a session
      // for any account other than the one allowed in — before any DB write.
      // (See src/lib/siteGate.ts; disabled by SITE_PUBLIC=true.)
      if (isSiteGateOn() && !isAllowedGateEmail(email)) return false;

      const displayName = user.name ?? user.email.split("@")[0];
      const isOwnerEmail = email === ownerEmail();

      // 1. Look up by googleSubject first (stable across email changes)
      let existing = await db.photographer.findUnique({
        where: { googleSubject: account.providerAccountId },
        select: { id: true, roles: true, email: true },
      });

      // 2. Fall back to email match (claims pre-seeded rows)
      if (!existing) {
        existing = await db.photographer.findUnique({
          where: { email },
          select: { id: true, roles: true, email: true },
        });
      }

      // Compute roles: owner-by-email gets the full set; otherwise inherit
      // any existing roles, or default to ["runner"] for net-new users.
      const baseRoles: Role[] = isOwnerEmail
        ? OWNER_IMPLIED_ROLES
        : existing
          ? normalizeRoles(existing.roles)
          : ["runner"];
      // Always ensure "runner" is present — a baseline so signed-in users
      // can buy photos via their account.
      const roles: Role[] = baseRoles.includes("runner")
        ? baseRoles
        : (["runner", ...baseRoles] as Role[]);
      const isAdmin = roles.includes("owner");

      if (existing) {
        await db.photographer.update({
          where: { id: existing.id },
          data: {
            googleSubject: account.providerAccountId,
            email,
            name: displayName,
            roles,
            isAdmin,
          },
        });
      } else {
        await db.photographer.create({
          data: {
            googleSubject: account.providerAccountId,
            email,
            name: displayName,
            roles,
            isAdmin,
          },
        });
      }
      return true;
    },
    async jwt({ token, account, user }) {
      // First sign-in: stash the Google subject so we can look up the row below
      if (account?.providerAccountId) {
        token.googleSubject = account.providerAccountId;
      }
      // Hydrate photographerId + roles from DB when missing on the token.
      // Re-hydrate every time so role updates from /admin/users land
      // without forcing the user to sign out.
      if (token.googleSubject) {
        const pg = await db.photographer.findUnique({
          where: { googleSubject: token.googleSubject as string },
          select: { id: true, isAdmin: true, roles: true },
        });
        if (pg) {
          token.photographerId = pg.id;
          token.isAdmin = pg.isAdmin;
          token.roles = normalizeRoles(pg.roles);
        }
      }
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      session.photographerId = (token.photographerId as string | undefined) ?? null;
      session.isAdmin = Boolean(token.isAdmin);
      session.roles = Array.isArray(token.roles)
        ? (token.roles as string[]).filter((r): r is Role =>
            (ALL_ROLES as readonly string[]).includes(r)
          )
        : ["runner"];
      return session;
    },
  },
  pages: {
    signIn: "/photographer/sign-in",
  },
};
