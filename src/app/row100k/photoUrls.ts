import { unstable_cache } from "next/cache";
import { r2Configured, r2PresignGet } from "@/lib/r2";

/* Server-side photo-key → display-URL resolution, shared by the feed, the
 * rower profile, the gallery and the post pack. Demo keys ("demo:#0077B6",
 * written by the demo seed) are flat color squares rendered as inline SVG
 * data URIs and never touch R2.
 *
 * Real keys become PUBLIC CDN URLs — `${R2_PUBLIC_URL}/${key}` — built as
 * plain strings with no I/O at all. The owner's top complaint was the feed
 * taking seconds to open and photos sometimes not loading; both traced back
 * to the presigned-URL era: a page of 60 rows cost ~300 Data Cache hops to
 * presign, every URL was ~700 characters (a 355 KB feed HTML), and a
 * presigned URL cached for 30 minutes but valid for 60 would be handed to a
 * phone tab that lazily loaded it after expiry — a 403 and a broken image.
 * A public URL is short, never expires, and the browser and the CDN edge
 * cache it by the key alone. The bucket is bucket-wide public behind the
 * custom domain already (the marketplace serves previews/ the same way), and
 * every row100k object is published work, so nothing here needs signing.
 *
 * Presigning survives ONLY as the fallback for a machine with R2 credentials
 * but no R2_PUBLIC_URL (the marketplace has the same split); with neither,
 * real keys drop out and rows without resolvable photos still render as text.
 *
 * THUMBNAIL CONVENTION: for a main key like row100k/.../uuid.jpg the
 * thumbnail lives at row100k/.../uuid.thumb.jpg — same folder, ".thumb"
 * spliced in before the extension. Uploaders write the thumb as a
 * best-effort second object; DB rows store MAIN KEYS ONLY and thumbs are
 * derived here by convention. The thumb URL is ALWAYS emitted — the back
 * catalogue was backfilled (scripts/row100k-thumbs.ts) and every uploader
 * has written thumbs since — because checking existence meant listing the
 * whole challenge prefix on every feed render. The rare thumb that never
 * landed 404s once and the img onError in each consumer swaps in the full
 * frame, so the worst case is a slightly heavier square, never a broken one. */

/* No trailing slash, so `${PUBLIC_BASE}/${key}` never doubles one. Read once
 * at module load: it is a deploy-time setting, not a per-request one. */
const PUBLIC_BASE = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") || null;

/* Anything after "demo:" that isn't a hex color falls back to a neutral gray
 * rather than being interpolated into the SVG raw. */
function demoPhotoUrl(key: string): string {
  const color = key.slice("demo:".length);
  const fill = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#7A7A74";
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'%3E%3Crect width='100%25' height='100%25' fill='${encodeURIComponent(fill)}'/%3E%3C/svg%3E`;
}

/* Main key → thumbnail key: ".thumb" goes in front of the final extension
 * ("a/b/uuid.jpg" → "a/b/uuid.thumb.jpg"). A key with no extension (never
 * minted by our sign routes) gets ".thumb.jpg" appended so the result is
 * still deterministic. */
export function thumbKey(key: string): string {
  const m = key.match(/^(.*)\.([A-Za-z0-9]+)$/);
  return m ? `${m[1]}.thumb.${m[2]}` : `${key}.thumb.jpg`;
}

/* True when real keys can be turned into URLs at all: the public base needs
 * no credentials (local dev without R2 keys still shows photos), presigning
 * needs them. */
export function photosServable(): boolean {
  return PUBLIC_BASE != null || r2Configured();
}

/* The public CDN URL for a key. Keys are minted by our own sign routes from
 * [a-z0-9/._-] only, so no encoding is needed. Throws rather than returning
 * a half URL when the base is unset — callers go through photoUrl(), which
 * checks first. */
export function publicPhotoUrl(key: string): string {
  if (!PUBLIC_BASE) throw new Error("R2_PUBLIC_URL is not set");
  return `${PUBLIC_BASE}/${key}`;
}

/* FALLBACK ONLY (no R2_PUBLIC_URL): signing the same key twice produces two
 * DIFFERENT urls — the signature carries the moment it was minted — and a
 * browser treats those as two unrelated images, so every visit re-downloaded
 * photos it already had. Caching the signed url hands the same string to
 * every render, which is what lets the browser cache do its job. Cached for
 * half the signature's life; a reader who keeps a tab open past the other
 * half sees a 403 on a lazy image, which is exactly the failure the public
 * path retires. */
const SIGN_TTL = 3600;

/* One key → one display URL, order-independent and safe to call per photo:
 * a plain string on the public path (a resolved promise, so the signature is
 * the same either way and callers never care which path served them). */
export function photoUrl(key: string): Promise<string> {
  if (PUBLIC_BASE) return Promise.resolve(publicPhotoUrl(key));
  return unstable_cache(() => r2PresignGet(key, SIGN_TTL), ["row100k-photo-url", key], {
    revalidate: Math.floor(SIGN_TTL / 2),
  })();
}

/* Each photo comes back with its full URL and its grid-sized thumb URL
 * (always emitted — see the header; consumers fall back to full on error).
 * Demo color squares are their own thumb. Order preserved (rower photo
 * first); unresolvable keys drop out; any failure resolves to []. On the
 * public path nothing here waits on the network — the feed's only real
 * await is its Prisma query. */
export type PhotoMedia = { full: string; thumb: string };

export async function resolvePhotoMedia(keys: string[]): Promise<PhotoMedia[]> {
  if (keys.length === 0) return [];
  const canServe = photosServable();
  try {
    const media = await Promise.all(
      keys.map(async (key): Promise<PhotoMedia | null> => {
        if (key.startsWith("demo:")) {
          const url = demoPhotoUrl(key);
          return { full: url, thumb: url };
        }
        if (!canServe) return null;
        const [full, thumb] = await Promise.all([photoUrl(key), photoUrl(thumbKey(key))]);
        return { full, thumb };
      }),
    );
    return media.filter((m): m is PhotoMedia => m != null && m.full !== "");
  } catch (err) {
    console.error("row100k: photo media resolve failed", err);
    return [];
  }
}
