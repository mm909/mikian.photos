import { unstable_cache } from "next/cache";
import { r2List } from "@/lib/r2";
import { COLORS, type Color } from "./shirtPreorder";
import { thumbKey } from "./photoUrls";

/* THE SHIRT PHOTOS (owner, 2026-10-01: "instead of the graphic of the T,
 * give me a carousel that I can post photos in"). One folder per shirt
 * under row100k/shirts/<color>/, the gallery's idiom (galleryList.ts): the
 * owner uploads through the sign route, the page lists the prefix through
 * this cached read, and a delete drops the key and its thumb. The listing
 * is the same for every visitor, so it is cached the way the gallery is —
 * a time backstop plus a tag the sign and delete routes revalidate.
 *
 * OLDEST FIRST, unlike the gallery: a carousel is read left to right and
 * the owner posts the shots in the order he wants them seen. */

export const SHIRT_PHOTO_PREFIX = "row100k/shirts/";
export const SHIRT_PHOTO_TAG = "row100k-shirt-photos";

/* row100k/shirts/<color>/<uuid>.<ext> — what the sign route mints and the
 * only shape the delete route takes back. */
export const SHIRT_PHOTO_KEY_RE = /^row100k\/shirts\/(black|cream)\/[a-z0-9-]+\.(jpe?g|png|webp)$/i;

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const THUMB_RE = /\.thumb\.[a-z0-9]+$/i;

/* Plain JSON on purpose: unstable_cache round-trips its value through JSON. */
export type ShirtPhotoObject = { key: string; hasThumb: boolean; lastModifiedMs: number };

export type ShirtPhotoList = Record<Color, ShirtPhotoObject[]>;

export function colorOfKey(key: string): Color | null {
  const m = SHIRT_PHOTO_KEY_RE.exec(key);
  return m ? (m[1].toLowerCase() as Color) : null;
}

const loadShirtPhotos = async (): Promise<ShirtPhotoList> => {
  const objects = (await r2List(SHIRT_PHOTO_PREFIX)).filter((o) => IMAGE_RE.test(o.key));
  const thumbs = new Set(objects.filter((o) => THUMB_RE.test(o.key)).map((o) => o.key));
  const out = Object.fromEntries(COLORS.map((c) => [c, [] as ShirtPhotoObject[]])) as ShirtPhotoList;
  for (const o of objects) {
    if (THUMB_RE.test(o.key)) continue;
    const color = colorOfKey(o.key);
    if (!color) continue;
    out[color].push({
      key: o.key,
      hasThumb: thumbs.has(thumbKey(o.key)),
      lastModifiedMs: o.lastModified?.getTime() ?? 0,
    });
  }
  for (const c of COLORS) out[c].sort((a, b) => a.lastModifiedMs - b.lastModifiedMs);
  return out;
};

export const listShirtPhotos = unstable_cache(loadShirtPhotos, ["row100k-shirt-photos-list"], {
  revalidate: 300,
  tags: [SHIRT_PHOTO_TAG],
});
