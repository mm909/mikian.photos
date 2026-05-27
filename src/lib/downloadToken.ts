import { SignJWT, jwtVerify } from "jose";

/**
 * Short-lived JWT minted at order capture. Carries the order ID + a list of
 * photo IDs the buyer is entitled to download. Signed with NEXTAUTH_SECRET
 * (we already have one provisioned for NextAuth — reuse it).
 *
 * Default TTL: 30 days. Buyers can re-download within that window. If they
 * lose the link, /account (Phase 2) will let them re-mint.
 */
const TTL_SECONDS = 60 * 60 * 24 * 30;

type DownloadClaims = {
  orderId: string;
  photoIds: string[];
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
    const photoIds = Array.isArray(payload.photoIds) ? (payload.photoIds as string[]) : null;
    if (!orderId || !photoIds) return null;
    return { orderId, photoIds };
  } catch {
    return null;
  }
}
