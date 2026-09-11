/* poster/racePhoto.ts — the photograph the race day ads are judged over.
 * SERVER ONLY: it reads the gallery listing and the R2 public base, neither
 * of which exists in a browser bundle.
 *
 * The owner picks it (owner, 2026-09-11: "allow me to change that photo and
 * have it be black and white most likely"), so RaceDef.photo carries a
 * gallery KEY and a black-and-white switch, and the settings console writes
 * both. A key of null means "whatever I shot last": the gallery listing is
 * newest first (galleryList.ts), so the newest upload is the default and the
 * ads follow the month without anybody touching a field.
 *
 * Fails soft to null, every path: an ad with no photograph behind it is
 * still an ad, and the studio falls back to the chequer. */

import { listGallery } from "../galleryList";
import { photoUrl, photosServable } from "../photoUrls";
import type { RaceDef } from "../raceday";
import type { RacePhoto } from "./raceAssemble";

export async function racePhoto(race: RaceDef): Promise<RacePhoto> {
  const bw = race.photo.bw;
  try {
    if (!photosServable()) return { url: null, bw };
    // His pick first; the newest gallery shot when he has made none. A key
    // that has since been deleted resolves to a URL that 404s — the preview
    // shows the chequer through it, which is the right tell that the photo
    // is gone rather than a silent swap to a different picture.
    const key = race.photo.key ?? (await listGallery())[0]?.key ?? null;
    if (!key) return { url: null, bw };
    return { url: await photoUrl(key), bw };
  } catch (err) {
    console.error("row100k/poster: race photo resolve failed", err);
    return { url: null, bw };
  }
}
