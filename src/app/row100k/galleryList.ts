import { unstable_cache } from "next/cache";
import { r2List } from "@/lib/r2";
import { thumbKey } from "./photoUrls";

/* The one listing of row100k/gallery/ that the gallery page and the post
 * pack share. Until now each page paginated the whole prefix on EVERY
 * request (both are force-dynamic), which is the same kind of per-render
 * bucket call that made the feed slow. The listing is identical for every
 * visitor, so it is cached the way the board is (boardData.ts): a time
 * backstop plus a tag that the gallery sign and delete routes revalidate, so
 * the owner still sees an upload or a removal on the next load.
 *
 * Thumb presence is decided HERE, from the same listing, and travels as a
 * boolean — the gallery is the owner's finished exports, some uploaded
 * before the thumb convention and never backfilled, so unlike row photos it
 * cannot assume a thumb exists. */

export const GALLERY_PREFIX = "row100k/gallery/";
export const GALLERY_TAG = "row100k-gallery";

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const THUMB_RE = /\.thumb\.[a-z0-9]+$/i;

/* Plain JSON on purpose: unstable_cache round-trips its value through JSON,
 * so a Date would come back as a string on a cache hit. */
export type GalleryObject = {
  key: string;
  hasThumb: boolean;
  lastModifiedMs: number;
};

/* Newest upload first — the order both consumers want. Throws on a listing
 * failure so the failure is NOT cached; callers fail soft themselves. */
const loadGallery = async (): Promise<GalleryObject[]> => {
  const objects = (await r2List(GALLERY_PREFIX)).filter((o) => IMAGE_RE.test(o.key));
  const thumbs = new Set(objects.filter((o) => THUMB_RE.test(o.key)).map((o) => o.key));
  return objects
    .filter((o) => !THUMB_RE.test(o.key))
    .map((o) => ({
      key: o.key,
      hasThumb: thumbs.has(thumbKey(o.key)),
      lastModifiedMs: o.lastModified?.getTime() ?? 0,
    }))
    .sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);
};

export const listGallery = unstable_cache(loadGallery, ["row100k-gallery-list"], {
  revalidate: 300,
  tags: [GALLERY_TAG],
});
