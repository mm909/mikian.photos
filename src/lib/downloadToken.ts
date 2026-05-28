import { SignJWT, jwtVerify } from "jose";

/**
 * Short-lived JWT minted at order capture. Carries only the order id —
 * everything else (which photos are entitled, expiry, refund status) is
 * looked up against the Order row at verify time.
 *
 * Why so small: an earlier version of this token stashed every entitled
 * photo id in the claims, which blew past the Postgres btree row-size
 * limit when stored back on the order row (the Lighthouse Half has ~1200+
 * photos × ~25-char cuids). Keeping the token to a single id keeps it
 * tiny and pushes entitlement to a join you'd do anyway.
 *
 * Signed with NEXTAUTH_SECRET (we already provision one for NextAuth).
 * Default TTL: 30 days — buyers can re-download within that window and
 * the receipt email's magic link stays valid that long.
 */
export const DOWNLOAD_TOKEN_TTL_DAYS = 30;
const TTL_SECONDS = 60 * 60 * 24 * DOWNLOAD_TOKEN_TTL_DAYS;

export type DownloadClaims = {
  orderId: string;
};

function secretKey(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET missing — required to mint download tokens");
  return new TextEncoder().encode(s);
}

export async function mintDownloadToken(claims: DownloadClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TTL_SECONDS)
    .sign(secretKey());
}

export async function verifyDownloadToken(token: string): Promise<DownloadClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
    if (!orderId) return null;
    return { orderId };
  } catch {
    return null;
  }
}
