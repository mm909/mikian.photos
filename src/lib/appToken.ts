import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

/* THE PHONE APP'S SIGN-IN (2026-11-20). The app cannot carry the site's
 * session cookie (a cookie belongs to its host and a native app has none),
 * so it signs in with Google itself, hands the Google ID token to
 * /api/row100k/app/session, and gets back this token: a small JWT naming
 * the account, sent as `Authorization: Bearer` on every request.
 * getEffectiveActor (permissions.ts) reads it, so every route that already
 * knows who is asking knows the app too.
 *
 * Signed with NEXTAUTH_SECRET, like the download tokens. The token carries
 * the account id and nothing else: roles are read off the account on every
 * request, so a role change lands without a new sign-in. */

/* A token minted by a dev server is for dev servers only. A laptop's dev
 * server signs with the same secret as the live site and lets an account in
 * by its email alone, so without this a token made on a laptop would open
 * the live site. */
const AUDIENCE = process.env.NODE_ENV === "production" ? "row-app" : "row-app-dev";
const TTL_SECONDS = 60 * 60 * 24 * 90;

function secretKey(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET missing — required to mint app tokens");
  return new TextEncoder().encode(s);
}

export async function mintAppToken(photographerId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(photographerId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TTL_SECONDS)
    .sign(secretKey());
}

/* The account id a token names, or null for anything that is not a live
 * token of ours. Never throws. */
export async function verifyAppToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: AUDIENCE, algorithms: ["HS256"] });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/* The token off a request's Authorization header, or null. */
export function bearerOf(header: string | null | undefined): string | null {
  const m = /^Bearer\s+([A-Za-z0-9._-]{20,2000})$/.exec((header ?? "").trim());
  return m ? m[1] : null;
}

/* GOOGLE'S OWN ID TOKEN, checked against Google's published keys. The
 * audience must be one of OUR client ids: the web one the site signs in
 * with, and the phone ones once they exist (GOOGLE_IOS_CLIENT_ID,
 * GOOGLE_ANDROID_CLIENT_ID). A token minted for anybody else's app is
 * refused, however genuine. */
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleIdentity = { sub: string; email: string; name: string };

/* APPLE'S ID TOKEN, checked the same way: signed by Apple, and minted for
 * THIS app (its bundle id; APPLE_BUNDLE_ID overrides the one the app
 * ships with). Apple puts the email in the token, a relay address when the
 * person chose to hide theirs, and never the name: the app hands the name
 * over beside the token, the one time Apple gives it. */
const APPLE_KEYS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
export async function verifyAppleIdToken(idToken: string, name?: string): Promise<GoogleIdentity | null> {
  try {
    const { payload } = await jwtVerify(idToken, APPLE_KEYS, { issuer: "https://appleid.apple.com", audience: process.env.APPLE_BUNDLE_ID || "com.rowtember.app" });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
    if (!payload.sub || !email || payload.email_verified === false || payload.email_verified === "false") return null;
    const said = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    return { sub: payload.sub, email, name: said || email.split("@")[0] };
  } catch {
    return null;
  }
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const audience = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID, process.env.GOOGLE_ANDROID_CLIENT_ID].filter((v): v is string => !!v);
  if (audience.length === 0) return null;
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_KEYS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
    if (!payload.sub || !email || payload.email_verified === false) return null;
    const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0];
    return { sub: payload.sub, email, name };
  } catch {
    return null;
  }
}
