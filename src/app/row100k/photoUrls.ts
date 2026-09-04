import { unstable_cache } from "next/cache";
import { r2Configured, r2List, r2PresignGet } from "@/lib/r2";
import { CHALLENGE } from "@/lib/row100k";

/* Server-side photo-key → display-URL resolution, shared by the feed and the
 * rower profile. Demo keys ("demo:#0077B6", written by the demo seed) are
 * flat color squares rendered as inline SVG data URIs and never touch R2.
 * Real keys are presigned for an hour, or dropped when R2 isn't configured —
 * rows without resolvable photos still render as text.
 *
 * THUMBNAIL CONVENTION: for a main key like row100k/.../uuid.jpg the
 * thumbnail (if one exists) lives at row100k/.../uuid.thumb.jpg — same
 * folder, ".thumb" spliced in before the extension. Uploaders write the
 * thumb as a best-effort second object; DB rows store MAIN KEYS ONLY and
 * thumbs are derived here by convention. Legacy photos have no thumb, so
 * resolvePhotoMedia only emits a thumb URL when the thumb object actually
 * exists in the bucket (checked against a briefly-cached prefix listing —
 * never by probing per-photo, which would 404-spam the R2 logs). */

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

const THUMB_KEY_RE = /\.thumb\.[a-z0-9]+$/i;

/* The set of thumbnail keys that exist under this challenge's prefix, as one
 * cached listing (revalidates every ~120s) so resolving a page of feed rows
 * costs one cached lookup instead of a HEAD per photo. A fresh upload's thumb
 * can lag up to the revalidate window — its rows just render the full image
 * until the listing refreshes, same as a legacy photo. Fail-soft: any listing
 * error means "no thumbs known" rather than a broken page. */
const loadThumbKeys = async (): Promise<string[]> => {
  try {
    if (!r2Configured()) return [];
    const objects = await r2List(`row100k/${CHALLENGE}/`);
    return objects.map((o) => o.key).filter((k) => THUMB_KEY_RE.test(k));
  } catch (err) {
    console.error("row100k: thumb-key listing failed", err);
    return [];
  }
};

const getThumbKeys = unstable_cache(loadThumbKeys, ["row100k-thumb-keys", CHALLENGE], {
  revalidate: 120,
});

/* One entry's keys → display URLs, order preserved (rower photo first). */
export async function resolvePhotoUrls(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  const canSign = r2Configured();
  try {
    const urls = await Promise.all(
      keys.map((key) =>
        key.startsWith("demo:") ? demoPhotoUrl(key) : canSign ? r2PresignGet(key, 3600) : "",
      ),
    );
    return urls.filter(Boolean);
  } catch (err) {
    console.error("row100k: photo presign failed", err);
    return [];
  }
}

/* Like resolvePhotoUrls, but each photo comes back with its grid-sized thumb
 * URL when the thumb object exists — null otherwise, and the caller renders
 * the full URL in its place. Demo color squares are their own thumb. Order
 * preserved; unresolvable keys drop out; any failure resolves to []. */
export type PhotoMedia = { full: string; thumb: string | null };

export async function resolvePhotoMedia(keys: string[]): Promise<PhotoMedia[]> {
  if (keys.length === 0) return [];
  const canSign = r2Configured();
  try {
    const thumbSet = canSign ? new Set(await getThumbKeys()) : new Set<string>();
    const media = await Promise.all(
      keys.map(async (key): Promise<PhotoMedia | null> => {
        if (key.startsWith("demo:")) {
          const url = demoPhotoUrl(key);
          return { full: url, thumb: url };
        }
        if (!canSign) return null;
        const tk = thumbKey(key);
        const [full, thumb] = await Promise.all([
          r2PresignGet(key, 3600),
          thumbSet.has(tk) ? r2PresignGet(tk, 3600) : Promise.resolve(null),
        ]);
        return { full, thumb };
      }),
    );
    return media.filter((m): m is PhotoMedia => m != null && m.full !== "");
  } catch (err) {
    console.error("row100k: photo media presign failed", err);
    return [];
  }
}
